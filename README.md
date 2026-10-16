<p align="center">
  <img src="public/logo.png" alt="PromoterCat logo" width="200" />
</p>

[PromoterCat](https://www.promotercat.com/?utm_source=github&utm_medium=readme&utm_campaign=promotercat) helps you find subreddits where you can promote your product for free.

## Search

Commas separate unordered search terms. Terms are trimmed, lowercased,
deduplicated, and sorted; phrases within a term keep their word order.
A community qualifies when its description has semantic similarity of at least
0.5 to any term. Default ranking uses average similarity across every term,
including scores below 0.5. Explicit sorting and promotion filters still apply.

Query embeddings use Vercel Runtime Cache with a 30-day TTL. Each term has a
separate entry, keyed by its normalized text, model, dimensions, instruction,
and configuration version. Concurrent requests within one function instance
share embedding generation. Vercel can evict entries before their TTL expires;
misses regenerate them, and cache failures do not prevent searches. Local runs
use the SDK's in-memory fallback.

Search results are not cached. Description updates take effect on the next
search. Changes to the embedding model, dimensions, or instruction produce new
cache keys; changes to preprocessing or vector normalization must also bump
`CACHE_VERSION` in `lib/ai/query-embeddings.ts`. Model changes require compatible
description embeddings.

Apply `20261016190755_multi_term_semantic_search.sql` before deploying the
application changes. The old search RPC remains available for older deployments.
The new RPC returns all matches before pagination so adding terms cannot remove
matches through a candidate limit.
