# Self-promotion evals

Run explicitly with Doppler installed and logged in:

```sh
pnpm evals
```

This runs the ingestion classifier against 15 frozen cases: 11 real subreddit
policies and 4 synthetic edge cases. It uses the live Jev model through Vercel AI
Gateway, plus DeepSeek when the classification has low confidence or is Limited.
Each run incurs API costs. It does not fetch Reddit, use TinyFish or Apify, or
read/write the database. It is not part of lint, build, or CI.

`self-promotion.json` contains rules captured on October 14, 2026, source URLs,
and expected statuses. These are regression fixtures, not a claim that the rules
are still current. Synthetic cases are labeled `synthetic`.

The command emits one JSON line per case and a totals line. It exits with code 1
if a status differs from its expected value or a request fails. Generated summaries
and confidence are printed for inspection, but only classification is scored.
Model results can vary between runs.

When changing a prompt, run `pnpm evals` and inspect any failures. Add new cases
with their source rules and a reviewed expected status. Do not change an expected
status merely to make an eval pass.
