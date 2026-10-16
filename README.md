<p align="center">
  <img src="public/logo.png" alt="PromoterCat logo" width="200" />
</p>

[PromoterCat](https://www.promotercat.com/?utm_source=github&utm_medium=readme&utm_campaign=promotercat) helps you find subreddits where you can promote your product for free.

## Plugin checks

Run `pnpm plugin:check` with Codex installed to check MCP configuration loading and the live OAuth discovery endpoints. The checks do not sign in or run subreddit searches.

Keep the portable `plugins/promotercat/mcp.json` server entry limited to `type`, `url`, and optional `headers`. Codex 0.160.1 rejects the documented `extensions.com.openai.auth` field and omits the server. OAuth settings are discovered through the server's authentication challenge and metadata.

For the hosted Supabase project, enable OAuth Server and dynamic client registration under **Authentication > OAuth Server**. Set the Site URL to `https://www.promotercat.com` and the authorization path to `/oauth/consent`. The settings in `supabase/config.toml` apply to local development; they do not enable hosted OAuth.

### After merging a plugin update

The Git-backed marketplace uses the package on `main`. After merging, refresh the marketplace and reinstall the plugin:

```sh
codex plugin marketplace upgrade promotercat
codex plugin add promotercat@promotercat
```

Confirm `codex plugin list --marketplace promotercat --json` reports version `0.1.1`. Restart the desktop app or start a new chat if it still uses the old package. Run the plugin's setup action, or ask PromoterCat to set up its connection. Setup guides browser sign-in when needed and uses one search to verify access before reporting Ready.

Plugin-only changes do not require a website deployment. Hosted OAuth settings must already be enabled as described above. Updating a public directory listing is separate from updating this Git-backed marketplace.
