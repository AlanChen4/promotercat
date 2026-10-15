import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const base = process.env.AGENT_TEST_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const local = (url) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

// Creates disposable users and clients, and changes only local quota counters
// and privileges. Never run against a hosted Supabase project.
test(
  "MCP OAuth, consent, revocation, search, and atomic quotas",
  { timeout: 120_000 },
  async (t) => {
    assert.ok(
      supabaseUrl && local(supabaseUrl) && local(base),
      "Use local app and Supabase URLs",
    );
    const admin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const users = [];
    const providers = [];
    const request = (path, init = {}) => fetch(`${base}${path}`, init);
    const db = (sql) =>
      execFileSync(
        "docker",
        [
          "exec",
          "supabase_db_promotercat",
          "psql",
          "-U",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          sql,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    const toolRequest = (provider, args = {}, init = {}) =>
      request("/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.savedTokens.access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "search_subreddits", arguments: args },
        }),
        ...init,
      });
    async function makeAccount() {
      const email = `agent-test-${randomUUID()}@promotercat.local`;
      const password = randomUUID();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(!error, "Create test account");
      users.push(data.user.id);
      const cookies = new Map();
      const client = createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll: () =>
              [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (items) => {
              for (const { name, value } of items) cookies.set(name, value);
            },
          },
        },
      );
      const signIn = await client.auth.signInWithPassword({ email, password });
      assert.ok(!signIn.error, "Sign in test account");
      return {
        id: data.user.id,
        client,
        token: signIn.data.session.access_token,
        cookie: [...cookies]
          .map(([name, value]) => `${name}=${value}`)
          .join("; "),
      };
    }
    async function beginOAuth() {
      const provider = {
        redirectUrl: "http://localhost:4010/callback",
        clientMetadata: {
          client_name: "PromoterCat integration test",
          redirect_uris: ["http://localhost:4010/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "email",
        },
        clientInformation() {
          return this.info;
        },
        saveClientInformation(info) {
          this.info = info;
        },
        tokens() {
          return this.savedTokens;
        },
        saveTokens(tokens) {
          this.savedTokens = tokens;
        },
        redirectToAuthorization(url) {
          this.authorizeUrl = url;
        },
        saveCodeVerifier(verifier) {
          this.verifier = verifier;
        },
        codeVerifier() {
          return this.verifier;
        },
        state() {
          return "integration-test-state";
        },
      };
      providers.push(provider);
      const outcome = await auth(provider, {
        serverUrl: new URL(`${base}/mcp`),
        resourceMetadataUrl: new URL(
          `${base}/.well-known/oauth-protected-resource/mcp`,
        ),
      });
      assert.equal(outcome, "REDIRECT");
      const response = await fetch(provider.authorizeUrl, {
        redirect: "manual",
      });
      assert.equal(response.status, 302);
      const target = new URL(response.headers.get("location"));
      provider.authorizationId = target.searchParams.get("authorization_id");
      assert.ok(
        provider.authorizationId,
        "Authorization request redirects to consent",
      );
      return provider;
    }
    const decide = (account, provider, decision = "approve", origin = base) =>
      request("/api/oauth/decision", {
        method: "POST",
        redirect: "manual",
        headers: {
          cookie: account.cookie,
          origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          authorization_id: provider.authorizationId,
          decision,
        }),
      });
    async function approve(account, provider) {
      const details = await account.client.auth.oauth.getAuthorizationDetails(
        provider.authorizationId,
      );
      assert.ok(!details.error, "Bind consent to the signed-in account");
      const response = await decide(account, provider);
      assert.equal(response.status, 303);
      const callback = new URL(response.headers.get("location"));
      assert.equal(
        callback.searchParams.get("state"),
        "integration-test-state",
      );
      const result = await auth(provider, {
        serverUrl: new URL(`${base}/mcp`),
        resourceMetadataUrl: new URL(
          `${base}/.well-known/oauth-protected-resource/mcp`,
        ),
        authorizationCode: callback.searchParams.get("code"),
      });
      assert.equal(result, "AUTHORIZED");
      return provider;
    }
    const minute = () =>
      new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const day = () =>
      new Date(new Date().toISOString().slice(0, 10)).toISOString();
    const setQuota = async (account, values) => {
      assert.ok(
        !(
          await admin
            .from("agent_api_quotas")
            .upsert({ account_id: account.id, ...values })
        ).error,
      );
    };
    const quota = async (account) => {
      const result = await admin
        .from("agent_api_quotas")
        .select("*")
        .eq("account_id", account.id)
        .single();
      assert.ok(!result.error);
      return result.data;
    };
    const resetQuota = (account) =>
      setQuota(account, {
        minute_start: minute(),
        minute_count: 0,
        day_start: day(),
        day_count: 0,
      });
    try {
      const first = await makeAccount();
      const second = await makeAccount();
      let provider;
      await t.test("discovery and anonymous challenges", async () => {
        const metadata = await (
          await request("/.well-known/oauth-protected-resource/mcp")
        ).json();
        assert.equal(metadata.resource, `${base}/mcp`);
        const response = await request("/mcp");
        assert.equal(response.status, 401);
        assert.match(
          response.headers.get("www-authenticate"),
          /resource_metadata=/,
        );
        assert.equal(
          (await request("/mcp", { headers: { cookie: first.cookie } })).status,
          401,
        );
        assert.equal(
          (
            await request("/mcp", {
              headers: { Authorization: "Bearer invalid" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/mcp", {
              headers: { Authorization: `Bearer ${first.token}` },
            })
          ).status,
          401,
        );
      });
      await t.test(
        "DCR, PKCE, approval, and real MCP SDK connection",
        async () => {
          provider = await beginOAuth();
          assert.equal(
            (await decide(first, provider, "approve", "https://example.com"))
              .status,
            403,
          );
          assert.equal(
            (
              await request("/api/oauth/decision", {
                method: "POST",
                headers: {
                  origin: base,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  authorization_id: provider.authorizationId,
                  decision: "approve",
                }),
              })
            ).status,
            401,
          );
          const details = await first.client.auth.oauth.getAuthorizationDetails(
            provider.authorizationId,
          );
          assert.ok(
            !details.error &&
              details.data.client.name === "PromoterCat integration test",
          );
          await approve(first, provider);
          const client = new Client({
            name: "promotercat-test",
            version: "0.1.0",
          });
          await client.connect(
            new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
              authProvider: provider,
            }),
          );
          const tools = await client.listTools();
          assert.deepEqual(
            tools.tools.map((tool) => tool.name),
            ["search_subreddits"],
          );
          const result = await client.callTool({
            name: "search_subreddits",
            arguments: {
              self_promotion: ["allowed_full", "allowed_limited"],
              sort: "name",
              sort_direction: "desc",
            },
          });
          assert.ok(
            !result.isError && result.structuredContent.subreddits.length > 0,
          );
          const web = await (
            await request(
              "/subreddits?self_promotion=allowed_full,allowed_limited&sort=name&sort_direction=desc",
            )
          ).json();
          assert.deepEqual(
            result.structuredContent.subreddits.map(({ url, ...row }) => row),
            web.subreddits,
          );
          assert.ok(
            result.structuredContent.subreddits.every(
              (row) =>
                row.url ===
                `https://www.reddit.com/r/${encodeURIComponent(row.name)}/`,
            ),
          );
          const semantic = await client.callTool({
            name: "search_subreddits",
            arguments: {
              search: "indie game development",
              self_promotion: ["allowed_full", "allowed_limited"],
            },
          });
          assert.ok(
            !semantic.isError &&
              Array.isArray(semantic.structuredContent.subreddits),
            "Semantic search succeeds through MCP",
          );
          await client.close();
        },
      );
      await t.test("validation, pagination, and quota accounting", async () => {
        await resetQuota(first);
        for (const args of [
          { page: 0 },
          { page: 1.5 },
          { sort: "nope" },
          { self_promotion: ["nope"] },
          { search: "a".repeat(1001) },
          { unknown: true },
        ])
          assert.equal((await toolRequest(provider, args)).status, 400);
        assert.equal((await quota(first)).day_count, 0);
        assert.equal((await toolRequest(provider, { page: 2 })).status, 200);
        const empty = await (
          await toolRequest(provider, { page: 99999 })
        ).json();
        assert.equal(empty.result.structuredContent.subreddits.length, 0);
        assert.equal((await quota(first)).day_count, 2);
      });
      await t.test("simultaneous first requests admit exactly 30", async () => {
        // Avoid intentionally spanning a fixed-window boundary in this assertion.
        const remaining = 60_000 - (Date.now() % 60_000);
        if (remaining < 1500)
          await new Promise((resolve) => setTimeout(resolve, remaining + 20));
        await admin
          .from("agent_api_quotas")
          .delete()
          .eq("account_id", first.id);
        const results = await Promise.all(
          Array.from({ length: 45 }, () =>
            admin.rpc("admit_agent_request", { p_account_id: first.id }),
          ),
        );
        assert.ok(results.every((result) => !result.error));
        assert.equal(
          results.filter((result) => result.data.allowed).length,
          30,
        );
        const response = await toolRequest(provider);
        assert.equal(response.status, 429);
        assert.ok(Number(response.headers.get("retry-after")) > 0);
        assert.equal((await response.json()).allowance, "minute");
        assert.equal((await quota(first)).day_count, 30);
      });
      await t.test(
        "daily boundary, resets, and account isolation",
        async () => {
          await setQuota(first, {
            minute_start: minute(),
            minute_count: 0,
            day_start: day(),
            day_count: 999,
          });
          assert.equal((await toolRequest(provider)).status, 200);
          const limited = await toolRequest(provider);
          assert.equal(limited.status, 429);
          assert.equal((await limited.json()).allowance, "day");
          await setQuota(first, {
            minute_start: "2000-01-01T00:00:00Z",
            minute_count: 30,
            day_start: day(),
            day_count: 1000,
          });
          assert.equal((await toolRequest(provider)).status, 429);
          await setQuota(first, {
            minute_start: minute(),
            minute_count: 30,
            day_start: day(),
            day_count: 1000,
          });
          const both = await (await toolRequest(provider)).json();
          assert.equal(both.allowance, "minute_and_day");
          assert.equal(
            Date.parse(both.resetAt),
            Date.parse(day()) + 86_400_000,
          );
          await setQuota(first, {
            minute_start: "2000-01-01T00:00:00Z",
            minute_count: 30,
            day_start: "2000-01-01T00:00:00Z",
            day_count: 1000,
          });
          assert.equal((await toolRequest(provider)).status, 200);
          assert.equal((await quota(first)).day_count, 1);
          const independent = await approve(second, await beginOAuth());
          assert.equal((await toolRequest(independent)).status, 200);
        },
      );
      await t.test("daily limit remains atomic", async () => {
        await setQuota(first, {
          minute_start: minute(),
          minute_count: 0,
          day_start: day(),
          day_count: 999,
        });
        const results = await Promise.all(
          Array.from({ length: 10 }, () =>
            admin.rpc("admit_agent_request", { p_account_id: first.id }),
          ),
        );
        assert.equal(
          results.filter((result) => !result.error && result.data.allowed)
            .length,
          1,
        );
        assert.equal((await quota(first)).day_count, 1000);
      });
      await t.test("token refresh preserves account quota", async () => {
        const count = (await quota(first)).day_count;
        const response = await fetch(`${supabaseUrl}/auth/v1/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: provider.info.client_id,
            refresh_token: provider.savedTokens.refresh_token,
          }),
        });
        assert.equal(response.status, 200);
        provider.saveTokens(await response.json());
        assert.equal((await toolRequest(provider)).status, 429);
        assert.equal((await quota(first)).day_count, count);
      });
      await t.test(
        "server-only permissions, fail-closed admission, and failed searches",
        async () => {
          db(
            "revoke execute on function public.admit_agent_request(uuid) from service_role",
          );
          try {
            assert.equal((await toolRequest(provider)).status, 503);
          } finally {
            db(
              "grant execute on function public.admit_agent_request(uuid) to service_role",
            );
          }
          const anon = createClient(
            supabaseUrl,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          );
          assert.ok((await anon.from("agent_api_quotas").select("*")).error);
          assert.ok(
            (await anon.rpc("admit_agent_request", { p_account_id: first.id }))
              .error,
          );
          assert.ok(
            (
              await anon.rpc("is_active_agent_session", {
                p_account_id: first.id,
                p_client_id: randomUUID(),
                p_session_id: randomUUID(),
              })
            ).error,
          );
          await resetQuota(first);
          db("revoke select on public.current_subreddits from service_role");
          try {
            const response = await toolRequest(provider);
            assert.equal(response.status, 200);
            assert.equal((await response.json()).result.isError, true);
          } finally {
            db("grant select on public.current_subreddits to service_role");
          }
          assert.equal((await quota(first)).day_count, 1);
        },
      );
      await t.test(
        "denial returns access_denied and does not create a grant",
        async () => {
          const denied = await beginOAuth();
          assert.ok(
            !(
              await first.client.auth.oauth.getAuthorizationDetails(
                denied.authorizationId,
              )
            ).error,
          );
          const response = await decide(first, denied, "deny");
          assert.equal(response.status, 303);
          assert.equal(
            new URL(response.headers.get("location")).searchParams.get("error"),
            "access_denied",
          );
          assert.ok(
            !(await first.client.auth.oauth.listGrants()).data.some(
              (grant) => grant.client.id === denied.info.client_id,
            ),
          );
        },
      );
      await t.test(
        "disconnect invalidates existing tokens and refresh tokens",
        async () => {
          const before = (await quota(first)).day_count;
          const list = await request("/api/oauth/connections", {
            headers: { cookie: first.cookie },
          });
          assert.equal(list.status, 200);
          assert.ok(
            (await list.json()).connections.some(
              (grant) => grant.client.id === provider.info.client_id,
            ),
          );
          const response = await request("/api/oauth/connections", {
            method: "DELETE",
            headers: {
              cookie: first.cookie,
              origin: base,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ clientId: provider.info.client_id }),
          });
          assert.equal(response.status, 200);
          assert.equal((await toolRequest(provider)).status, 401);
          assert.equal((await quota(first)).day_count, before);
        },
      );
      await t.test("plugin skill instructions are shared", () => {
        assert.equal(
          readFileSync(
            "plugins/codex/skills/find-communities/SKILL.md",
            "utf8",
          ),
          readFileSync(
            "plugins/claude/skills/find-communities/SKILL.md",
            "utf8",
          ),
        );
      });
    } finally {
      for (const id of users) await admin.auth.admin.deleteUser(id);
      for (const provider of providers)
        if (provider.info)
          await admin.auth.admin.oauth.deleteClient(provider.info.client_id);
    }
  },
);
