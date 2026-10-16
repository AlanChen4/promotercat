---
name: setup
description: Connect or troubleshoot PromoterCat and verify community search when automatic sign-in does not complete.
---

# Set up PromoterCat

1. Discover `search_subreddits` and check connection status if available.
2. If authentication is needed, use the host's PromoterCat connection flow or direct the user to its MCP connection menu. Complete browser sign-in and approval; never construct login URLs, request tokens, or read credential files.
3. Rediscover the tool. If missing, report the known error and that no search ran. Suggest refreshing the plugin or starting a new chat when required; do not loop sign-in.
4. Explain that verification uses one search, then call `search_subreddits` once with `page: 1`, `self_promotion: ["allowed_full", "allowed_limited"]`, and no `search`.
5. Report ready only after a successful response, including an empty result. On failure, report the error and any rate-limit reset time, then stop without automatic retries or substitute sources.

If a response includes `pluginUpdate`, show the version notice and relevant update commands once per chat. Updates are optional; run commands only if requested.

Keep the outcome brief. Installation or browser sign-in alone does not prove readiness.
