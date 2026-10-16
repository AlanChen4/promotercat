---
name: setup
description: Set up or repair the PromoterCat connection, guide account sign-in, and verify that community search works. Use for plugin setup and connection troubleshooting.
---

# Set up PromoterCat

Help the user connect their PromoterCat account and verify community search. Plugin installation alone does not confirm that sign-in or setup succeeded.

1. Check whether `search_subreddits` is available. Use tool discovery if the host supports it. If the host exposes connection status, check the PromoterCat MCP server as well.
2. If sign-in is required, start the host's PromoterCat connection flow when supported. Otherwise, direct the user to the plugin's MCP connection menu and ask them to select Connect or Sign in. Explain that browser sign-in and approval are required. Use the host-generated authorization flow; do not construct a login URL or substitute a normal website sign-in. Never ask for tokens or read the agent client's credential files.
3. After sign-in, check tool availability again. If the tool is still missing, report the connection or loading error if known. Explain that no search ran. Direct the user to refresh the plugin and start a new chat if the host requires it. Do not repeatedly restart sign-in or claim the connection works because the browser flow completed.
4. When the tool is available, explain that verification uses one search from the account's allowance. Call `search_subreddits` once with `page: 1` and `self_promotion: ["allowed_full", "allowed_limited"]`; omit `search`. This check does not require a product description or private project content.
5. Report Ready only after a successful tool response. A successful response with no matches still confirms the connection. On an authentication, rate-limit, or service error, state the failure and stop. Report any rate-limit reset time. Do not retry automatically or use another source to make setup appear successful.

Keep the outcome concise: whether sign-in is needed, whether verification ran, and whether community search is ready. Do not turn setup into community recommendations or post to Reddit.
