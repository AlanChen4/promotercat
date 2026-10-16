# PromoterCat plugins

The `promotercat@promotercat` plugin supports Codex and Claude Code from one package
in `plugins/promotercat/`. Both clients read the repository's
`.claude-plugin/marketplace.json` catalog and use the same `find-communities` skill.
The package includes portable Codex configuration (`plugin.json`, `mcp.json`) and
Claude Code configuration (`.claude-plugin/plugin.json`, `.mcp.json`).
No user API key is needed.

## Local plugin installation

Run from the repository root:

```sh
codex plugin marketplace add "$PWD"
codex plugin add promotercat@promotercat

claude plugin marketplace add "$PWD"
claude plugin install promotercat@promotercat
```

Restart the client, choose PromoterCat in its MCP connections menu, and complete
browser sign-in and approval. The client stores and refreshes its own tokens.
The bundled endpoint is `https://www.promotercat.com/mcp`; local code is not
published to that endpoint until release.

## Use in chat

After installation, start a new chat and complete OAuth sign-in when prompted.
In the desktop app, open the `@` menu and select the `promotercat` plugin. In Codex CLI,
use `/skills` to select its `find-communities` skill. In Claude Code, use
`/promotercat:find-communities`. You can also ask naturally for communities where you
can promote your project.

The `promotercat` name identifies the marketplace and bundled MCP connection;
`promotercat` also identifies the installed plugin and its chat mention.

## Test the local MCP endpoint directly

Start the local Supabase services and app with `pnpm dev`. Local configuration
enables the Supabase OAuth server and dynamic client registration.

Use direct MCP registration instead of the installed plugin when testing localhost:

```sh
codex mcp add promotercat-local --url http://localhost:3000/mcp
codex mcp login promotercat-local --scopes email

claude mcp add --transport http promotercat-local http://localhost:3000/mcp
claude mcp login promotercat-local
```

Sign in and approve the consent screen. Then ask the client to search communities
for an indie game. The session-authenticated `/api/oauth/connections` endpoint supports listing and
revoking grants.

## Before production release

1. Apply the agent-access database migration and deploy the application.
2. Enable OAuth 2.1 Server and dynamic client registration in the hosted Supabase
   project's Authentication settings. Set its authorization path to `/oauth/consent`
   and Site URL to `https://www.promotercat.com`.
3. Confirm the Google sign-in callback is permitted for the production origin.
4. Check `/.well-known/oauth-protected-resource/mcp`, client registration, consent,
   search, token refresh, and disconnect with both real clients.
5. Release the plugin catalogs. Public installation commands reference this
   repository's released contents; local-only changes are not available remotely.

The resource uses Supabase's project issuer and `authenticated` audience plus the
OAuth client/session claims. The project issues identity-scoped tokens (`email`);
MCP access is additionally checked against active grants and server permissions.
