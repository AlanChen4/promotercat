import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SubredditResult } from "../lib/schemas/subreddits.ts";

const container = process.env.SEARCH_TEST_DATABASE_CONTAINER;

test(
  "multi-term semantic search in an isolated local database",
  {
    skip:
      !container && "Run pnpm test:db to include PostgreSQL integration tests.",
  },
  async (t) => {
    const database = `search_test_${randomUUID().replaceAll("-", "")}`;
    function docker(args: string[], input?: string) {
      const result = spawnSync(
        "docker",
        ["exec", "-i", container as string, ...args],
        {
          input,
          encoding: "utf8",
        },
      );
      assert.equal(result.status, 0, result.stderr || String(result.error));
      return result.stdout.trim();
    }
    function sql(query: string) {
      return docker(
        [
          "psql",
          "-X",
          "-qAt",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
          "-d",
          database,
        ],
        query,
      );
    }
    function matches(
      terms = "test_vector(1,0)::text::jsonb,test_vector(0,1)::text::jsonb",
    ) {
      return JSON.parse(
        sql(`select public.match_subreddits_by_descriptions(
      jsonb_build_array(${terms}), 0.5);`),
      ) as SubredditResult[];
    }

    docker(["createdb", "-U", "postgres", database]);
    try {
      sql(`
      create schema extensions;
      grant usage on schema extensions to service_role;
      create extension vector with schema extensions;
      create type public.self_promotion_status as enum ('allowed_full');
      create table public.search_test_communities (
        name text primary key,
        description_embedding extensions.vector(4096),
        self_promotion public.self_promotion_status default 'allowed_full',
        self_promotion_detail text default '',
        weekly_active_users bigint
      );
      alter table public.search_test_communities enable row level security;
      grant select on public.search_test_communities to service_role;
      create view public.current_subreddits with (security_invoker = true) as
        select * from public.search_test_communities;
      grant select on public.current_subreddits to service_role;
      create function test_vector(x real, y real) returns extensions.vector
      language sql immutable as $$
        select (array[x,y,sqrt(greatest(0,1-x*x-y*y))] ||
          array_fill(0::real,array[4093]))::extensions.vector(4096);
      $$;
      insert into public.search_test_communities(name,description_embedding) values
        ('both',test_vector(0.65,0.65)),
        ('marketing',test_vector(0.1,0.9)),
        ('facebook',test_vector(0.9,0.1)),
        ('weak-other-term',test_vector(0.2,0.9)),
        ('below-threshold',test_vector(0.49,0.49)),
        ('boundary',test_vector(0.5,0)),
        ('no-embedding',null),
        ('facebook marketing literal',test_vector(0.1,0.1));
      insert into public.search_test_communities(name,description_embedding,self_promotion)
        values ('unclassified',test_vector(0.65,0.65),null);
    `);
      sql(
        readFileSync(
          new URL(
            "../supabase/migrations/20261016190755_multi_term_semantic_search.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );

      await t.test(
        "rank by average across all terms, even below-threshold scores",
        () => {
          assert.deepEqual(
            matches().map((row) => row.name),
            ["both", "weak-other-term", "facebook", "marketing", "boundary"],
          );
        },
      );
      await t.test("term order does not affect results", () => {
        assert.deepEqual(
          matches(
            "test_vector(0,1)::text::jsonb,test_vector(1,0)::text::jsonb",
          ),
          matches(),
        );
      });
      await t.test(
        "adding a term preserves matches from either single-term search",
        () => {
          const union = new Set(matches().map((row) => row.name));
          for (const term of [
            "test_vector(1,0)::text::jsonb",
            "test_vector(0,1)::text::jsonb",
          ]) {
            for (const row of matches(term)) assert.ok(union.has(row.name));
          }
        },
      );
      await t.test("empty input and no matches return arrays", () => {
        assert.deepEqual(matches(""), []);
        assert.deepEqual(matches("test_vector(-1,0)::text::jsonb"), []);
      });
      await t.test(
        "description updates affect searches without query cache invalidation",
        () => {
          sql(
            "update public.search_test_communities set description_embedding=test_vector(0.7,0.7) where name='below-threshold';",
          );
          assert.equal(matches()[0].name, "below-threshold");
        },
      );
      await t.test(
        "all matches survive the old 200-candidate and 1000-row limits",
        () => {
          sql(
            "insert into public.search_test_communities(name,description_embedding) select 'extra-'||n,test_vector(0.65,0.65) from generate_series(1,1200) n;",
          );
          assert.equal(matches().length, 1206);
        },
      );
      await t.test("only service_role can execute the search RPC", () => {
        assert.equal(
          sql(
            "select has_function_privilege('anon','public.match_subreddits_by_descriptions(jsonb,double precision)','execute');",
          ),
          "f",
        );
        assert.equal(
          sql(
            "select has_function_privilege('authenticated','public.match_subreddits_by_descriptions(jsonb,double precision)','execute');",
          ),
          "f",
        );
        assert.equal(
          sql(
            "set role service_role; select jsonb_array_length(public.match_subreddits_by_descriptions(jsonb_build_array(test_vector(1,0)::text::jsonb,test_vector(0,1)::text::jsonb),0.5));",
          ),
          "1206",
        );
      });
    } finally {
      docker(["dropdb", "-U", "postgres", database]);
    }
  },
);
