import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Usage: node scripts/check-plugin.mjs [plugin-directory]
// Checks the portable HTTP server's allowed fields, then probes unauthenticated
// discovery. Does not read credentials, sign in, or run subreddit searches.
const directory = resolve(process.argv[2] ?? "plugins/promotercat");
const manifest = JSON.parse(
  await readFile(resolve(directory, "mcp.json"), "utf8"),
);
async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
}

const schemaResponse = await fetchWithTimeout(manifest.$schema);
assert.equal(schemaResponse.status, 200, "MCP schema must be available");
const schema = await schemaResponse.json();
const serverSchema = schema.$defs.streamableHttpServer;
assert.equal(serverSchema.additionalProperties, false);
const allowedFields = Object.keys(serverSchema.properties);
let invalid = false;

for (const [name, server] of Object.entries(manifest.mcpServers)) {
  assert.equal(server.type, "streamable-http", "Only portable HTTP is checked");
  const unexpected = Object.keys(server).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unexpected.length) {
    invalid = true;
    console.error(
      `FAIL mcpServers.${name}: schema rejects ${unexpected.join(", ")}; allowed fields: ${allowedFields.join(", ")}`,
    );
  } else {
    console.log(`PASS mcpServers.${name}: allowed field check`);
  }

  const response = await fetchWithTimeout(server.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "promotercat-repro", version: "1.0.0" },
      },
    }),
  });
  console.log(`Unauthenticated initialize: HTTP ${response.status}`);
  console.log(`WWW-Authenticate: ${response.headers.get("www-authenticate")}`);
  console.log(await response.text());
  assert.equal(response.status, 401, "Expected authentication challenge");
  const challenge = response.headers.get("www-authenticate") ?? "";
  const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
  assert.ok(metadataUrl, "Challenge must identify OAuth resource metadata");
  const metadataResponse = await fetchWithTimeout(metadataUrl);
  assert.equal(
    metadataResponse.status,
    200,
    "OAuth metadata must be available",
  );
  const metadata = await metadataResponse.json();
  assert.equal(metadata.resource, server.url);
  assert.ok(
    metadata.authorization_servers?.length,
    "OAuth requires an authorization server",
  );
  console.log("PASS OAuth resource metadata is reachable and matches MCP URL");

  for (const issuer of metadata.authorization_servers ?? []) {
    // RFC 8414 inserts the well-known path before the issuer's path.
    const issuerUrl = new URL(issuer);
    const discoveryUrl = new URL(
      `/.well-known/oauth-authorization-server${issuerUrl.pathname.replace(/\/$/, "")}`,
      issuerUrl.origin,
    );
    const discoveryResponse = await fetchWithTimeout(discoveryUrl);
    const discovery = await discoveryResponse.json();
    console.log(
      `OAuth authorization server discovery: HTTP ${discoveryResponse.status}`,
    );
    if (!discoveryResponse.ok) {
      invalid = true;
      console.error(`FAIL OAuth discovery: ${JSON.stringify(discovery)}`);
      continue;
    }
    assert.equal(discovery.issuer, issuer);
    assert.ok(discovery.authorization_endpoint);
    assert.ok(discovery.token_endpoint);
    assert.ok(
      discovery.registration_endpoint,
      "PromoterCat requires dynamic client registration",
    );
    assert.ok(
      discovery.code_challenge_methods_supported?.includes("S256"),
      "OAuth must support PKCE S256",
    );
    console.log("PASS OAuth issuer and required endpoints are advertised");
  }
}

process.exitCode = invalid ? 1 : 0;
