# PromoterCat

Find subreddits that allow self-promotion.

## Layout

- `app/`, `components/`, `lib/`, `providers/` — Next.js 16 frontend (App Router, React 19).
- `scraper/` — Python scraper that pulls top subreddits from Reddit, has Stagehand+LLM extract rules, classifies self-promotion via an LLM, and upserts to Supabase.
- `scraper/supabase/migrations/` — Supabase migrations (canonical schema lives here, not at repo root).
- `types/database.types.ts` — generated from Supabase; regenerate with `pnpm generate-types`.

## Local Supabase

Local stack is driven by the pnpm-installed `supabase` CLI (no brew) against `scraper/supabase/config.toml`. Ports are shifted by +1000 from the defaults to avoid colliding with other local Supabase projects:

| Service   | Port  |
|-----------|-------|
| API       | 55321 |
| DB        | 55322 |
| Studio    | 55323 |
| Inbucket  | 55324 |
| Analytics | 55327 |
| Pooler    | 55329 |
| Shadow DB | 55320 |

```bash
pnpm db:start    # boot local Postgres/Studio/etc + apply migrations
pnpm db:status   # show URLs + service_role key
pnpm db:reset    # re-apply migrations from scratch
pnpm db:stop
```

## Running the scraper

Secrets are managed by Doppler. The `dev_local` Doppler config overrides `SUPABASE_URL` and `SUPABASE_KEY` to point at the local stack.

```bash
cd scraper
sh scripts/run.sh python main.py          # default LOG_LEVEL=INFO
sh scripts/run.sh DEBUG python main.py    # verbose
```

`run.sh` wraps `doppler run -- uv run …`, so it picks up whichever Doppler config is set in the working directory (`doppler setup --config dev_local` in `scraper/` for local).

## Frontend dev

```bash
pnpm install
pnpm dev
```

## Skills

`.claude/skills` is a symlink to `.agents/skills`. The `.agents/` tree is populated by `npx skills` (Matt Pocock's skill pack); the symlink lets Claude Code see them without duplicating files.
