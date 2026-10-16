<p align="center">
  <img src="public/logo.png" alt="PromoterCat logo" width="200" />
</p>

[PromoterCat](https://www.promotercat.com/?utm_source=github&utm_medium=readme&utm_campaign=promotercat) helps you find subreddits where you can promote your product for free.

## Search embeddings

Search uses `openai/text-embedding-3-small` at 1,536 dimensions. Documents remain
`name: description`, without rules or generated summaries. Queries use plain
normalized terms. A community qualifies when any term scores at least **0.30**;
results are ordered by the mean score across terms. See
[`evals/search-threshold.json`](evals/search-threshold.json) for the ten-query
calibration and its limitations.

Deploy the OpenAI embedding migration before deploying the application. It adds
`description_embedding_openai` and a separate search RPC, preserving the old
Qwen column and RPC during rollout. Backfill the new vector column on existing
description snapshots without changing descriptions, rules, or policy classifications.
Verify that every current description has an OpenAI vector before deploying the application. Keep
old ingestion workers stopped during cutover; an old writer that changes a
description cannot supply its OpenAI vector. Re-run the backfill after old
workers finish. The new model, dimensions, and cache version isolate query caches.

Checks:

```sh
# Against a migrated local database; fixtures are rolled back:
docker exec -i supabase_db_promotercat psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/openai_embeddings.sql
```
