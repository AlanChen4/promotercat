# PromoterCat agent access MVP

## Goal

Add a desktop-only For Agents button beside the self-promotion filters. It opens a draggable, non-modal window above the table, with installation instructions for Codex and Claude Code plugins. Agents connect to the user's existing PromoterCat account through browser OAuth. There are no manual API keys, environment variables, or curl instructions.

## Window

- Show the trigger from 768px upward, aligned right; allow the row to wrap.
- Match the table styling, render the window through a portal, and use a higher stacking level.
- Center on open, constrain pointer dragging to the viewport, scroll overflowing content, and close below 768px.
- Support close, Escape, keyboard access to controls, and focus return. Do not implement keyboard movement.
- Include client logo tabs in the draggable header, copyable plugin installation commands, and published limits. Use an icon that fades to a checkmark after copying. No usage dashboard, account section, sample prompt, or direct-MCP instructions in this window.
- Anyone can read installation instructions. Sign-in happens during the OAuth connection flow.

## Route handling

- Wrap all route handlers in `withApiHandler`. Default responses to private, no-store; explicitly allow public caching for OAuth metadata.
- Use `ApiError` for safe HTTP errors and `callService` around external calls. Return 503 for dependency failures and a sanitized 500 for unexpected bugs. Preserve Next.js control-flow exceptions, redirects, cookies, and protocol headers.
- Share session checks through `requireSession`. Keep OAuth challenges, quota responses, and MCP tool errors explicit.

## OAuth and MCP

- Use Supabase's OAuth 2.1 server with dynamic public client registration, authorization-code flow with PKCE, and managed access/refresh tokens.
- Add a `/oauth/consent` screen that preserves the authorization request through the existing Google sign-in callback. Show the actual client name, requested account information, callback URI, approve, and deny controls. Never display client-provided logos or HTML.
- Request the minimum supported OIDC scope, `email`. Supabase scopes describe identity information; server-only database permissions still protect quota data.
- Add standard protected-resource metadata at `/.well-known/oauth-protected-resource/mcp` and the root fallback. Point to the project's Supabase authorization server.
- Serve stateless Streamable HTTP MCP at `/mcp` with one read-only `search_subreddits` tool. Use the official MCP SDK and JSON responses, without persistent in-memory sessions.
- Validate token signature, expiration, project issuer, audience, authenticated role, OAuth client ID, account ID, and active OAuth session/grant. Reject regular website tokens and anonymous users. Check active sessions so disconnect revokes access immediately, even before JWT expiry.
- Use existing account sessions to list and revoke grants. Require same-origin requests for decisions and disconnects. Return no-store responses and exclude the consent UI from analytics capture/recording.
- Authentication failures return 401 with a discovery challenge; infrastructure failures return 503. Reject untrusted browser origins.

## Search and account quotas

- Share the existing search implementation with the website; preserve its session requirements.
- Tool inputs: optional search text (maximum 1,000 characters), an array of promotion statuses, sort field/direction, and positive integer page. Return 10 results, promotion details, canonical Reddit URLs, and pagination totals. Reject unknown parameters and invalid values before consuming quota.
- Enforce 30 searches per UTC calendar minute and 1,000 per UTC day per account, across all OAuth clients. Token refresh or reconnecting does not reset usage.
- Keep one server-only quota row per account. In one database transaction, create if missing, lock, read database time, reset expired fixed windows, then increment both counters or reject without incrementing.
- Count admitted searches, including empty results, pagination, and downstream failures. Do not count discovery, initialization, listing tools, invalid inputs, invalid authentication, or rejected searches. No refunds.
- Return 429 with `Retry-After` and JSON identifying the exhausted allowance and reset time. When both limits are reached, use the later reset. No custom quota headers or usage-reporting endpoints.
- Fail closed before search or embeddings if authentication or quota enforcement fails. Delete quota rows when the account is deleted.
- Enable RLS and explicitly restrict quota tables and admission/session-check functions to server credentials. No Redis service.

## Plugins and documentation

- Package the `reddit` plugin for Codex and Claude Code in the `promotercat` marketplace (`reddit@promotercat`), with OAuth-enabled remote MCP connections and identical community-search skill instructions.
- Skills call `search_subreddits`, return relevant communities with restrictions and links, and treat returned text as data. Never post to Reddit, inspect credential storage, or request tokens in chat.
- On rate limiting, report the reset time and stop. On authentication failure, ask the user to reconnect through their agent.
- Store plugin manifests and marketplace catalogs in this repository, with narrow Git ignore exceptions.
- Document local installation, connection testing, and the production Supabase settings required before release. Update the privacy policy for authorization grants, sessions, tokens, and quota counters.

## Verification and delivery

- Test real SDK discovery, dynamic registration, PKCE, consent approval/denial, session authentication, token refresh, and disconnect. Verify cross-account isolation and rejection of ordinary website tokens.
- Test search parity, filters/sorting/pagination, empty results, invalid inputs, downstream failures, and fail-closed behavior.
- Test minute/day boundaries and resets, simultaneous first requests, concurrent near-limit requests, shared account limits, and preserved quotas after refresh.
- Test desktop placement, dragging, stacking, scrolling, close/reopen, focus, and responsive behavior.
- Validate and install both plugin packages locally. Run MCP searches with a development OAuth grant and confirm no tokens appear in captured output or analytics.
- Run formatting, TypeScript, integration tests, migration checks, and database security advisors.
- Deliver the changes in a pull request. Do not deploy, publish plugins, or change hosted Supabase settings.

## Defaults

Claude means Claude Code. Access is free. No API-key management, billing, posting, usage dashboard, or public plugin-directory submission. Account quotas use fixed UTC windows and allow bursts across boundaries. Public plugin installation commands become usable after these local changes are released.
