# PromoterCat

Find subreddits that allow self-promotion for you to promote your apps.

PromoterCat is free. Search results, pagination, sorting, and filters are available
without an account or a subscription. Accounts are optional.

## Development

```bash
pnpm install
pnpm dev
```

Environment variables are managed through [Doppler](https://www.doppler.com/).

Run `pnpm test` for search API regression tests and `pnpm build` to check the
production build. The tests mock the database and embedding API.

## Local database

Install Docker and start it before running Supabase:

```bash
pnpm db:start
pnpm db:status
```

The Supabase CLI is installed with pnpm. Configuration and migrations live in
`supabase/`. Local ports use the 553xx range to avoid other Supabase projects:

| Service | URL |
| --- | --- |
| API | http://127.0.0.1:55321 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:55322/postgres |
| Studio | http://127.0.0.1:55323 |

Database, API, Auth, and Studio are enabled. Storage, Realtime, Edge Functions,
analytics, the email testing server, and the connection pooler are disabled.
Auth remains available for optional accounts. Local Google OAuth requires provider
credentials in the Auth configuration.

Use the API URL and keys from `pnpm db:status` in your local Doppler configuration:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Semantic search also needs `GEMINI_API_KEY` and
`LLM_GATEWAY_API_KEY`.

```bash
pnpm db:stop
# Recreate the local database and apply migrations. This deletes local data.
pnpm db:reset
```

## Data collection

The previous Python scraper and its Browserbase/Stagehand dependencies have been
removed. There is currently no data collection job in this repository.

Future work will use two separate jobs: a crawler to discover subreddits and insert
them into the database, and a scraper to update rules, self-promotion status, and
other subreddit data. These jobs are not implemented yet.
