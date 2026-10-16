import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

// Uses Codex's plugin API in a temporary Codex home. Installs only the test copy
// with its server disabled. Does not alter the user's installation, authenticate,
// or invoke tools. Both variants live in a temporary directory.
// Usage: node scripts/check-plugin-loader.mjs [plugin-directory]
const source = resolve(process.argv[2] ?? "plugins/promotercat");
const root = await realpath(
  await mkdtemp(join(tmpdir(), "promotercat-loader-")),
);
const pending = new Map();
let nextId = 0;
let child;
try {
  for (const variant of ["current", "with-auth-extension"]) {
    const directory = join(root, variant);
    await cp(source, join(directory, "plugin"), { recursive: true });
    if (variant === "with-auth-extension") {
      const path = join(directory, "plugin/mcp.json");
      const config = JSON.parse(await readFile(path, "utf8"));
      config.mcpServers.promotercat.extensions = {
        "com.openai": {
          auth: {
            type: "oauth",
            client: { mode: "dcr" },
            baseScopes: ["email"],
          },
        },
      };
      await writeFile(path, JSON.stringify(config));
    }
    await mkdir(join(directory, ".agents/plugins"), { recursive: true });
    await writeFile(
      join(directory, ".agents/plugins/marketplace.json"),
      JSON.stringify({
        name: `repro-${variant}`,
        plugins: [
          {
            name: "promotercat",
            source: { source: "local", path: "./plugin" },
          },
        ],
      }),
    );
  }
  const codexHome = join(root, "codex-home");
  await mkdir(codexHome);
  child = spawn(
    "codex",
    [
      "-c",
      'plugins."promotercat@repro-current".mcp_servers.promotercat.enabled=false',
      "--disable",
      "remote_plugin",
      "app-server",
      "--stdio",
    ],
    { stdio: "pipe", env: { ...process.env, CODEX_HOME: codexHome } },
  );
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  createInterface({ input: child.stderr }).on("line", (line) => {
    // Print only this test's manifest diagnostics, not unrelated app logs.
    if (line.includes(root) && line.includes("failed to parse plugin MCP")) {
      console.error(line);
    }
  });
  child.on("error", (error) => {
    for (const request of pending.values()) request.reject(error);
  });
  function call(method, params) {
    const id = ++nextId;
    return new Promise((resolveResult, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 20_000);
      pending.set(id, { resolve: resolveResult, reject, timeout });
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }
  const initialized = await call("initialize", {
    clientInfo: { name: "promotercat-loader-repro", version: "1.0.0" },
    capabilities: { experimentalApi: true, explicitGatewayOauth: true },
  });
  console.log(initialized.userAgent);
  child.stdin.write(
    `${JSON.stringify({ method: "initialized", params: {} })}\n`,
  );
  await call("plugin/install", {
    pluginName: "promotercat",
    marketplacePath: join(root, "current", ".agents/plugins/marketplace.json"),
  });
  const results = {};
  for (const variant of ["current", "with-auth-extension"]) {
    const { plugin } = await call("plugin/read", {
      pluginName: "promotercat",
      marketplacePath: join(root, variant, ".agents/plugins/marketplace.json"),
    });
    if (variant === "current") {
      assert.equal(
        plugin.onboardingSkill?.path,
        plugin.skills.find((skill) => skill.name === "promotercat:setup")?.path,
        "Codex must resolve the setup action to the packaged skill",
      );
      assert.ok(
        plugin.skills.some((skill) => skill.name === "promotercat:setup"),
        "Codex must discover the setup skill",
      );
      console.log("PASS Codex discovers the plugin's setup action");
    }
    results[variant] = plugin.mcpServers;
    console.log(`${variant}: ${JSON.stringify(plugin.mcpServers)}`);
  }
  assert.deepEqual(
    results.current,
    ["promotercat"],
    "Codex must discover the packaged server",
  );
  console.log("PASS Codex discovers the current plugin's MCP server");
  if (!results["with-auth-extension"].includes("promotercat")) {
    console.log(
      "Compatibility check: this Codex loader rejects the auth extension",
    );
  } else {
    console.log(
      "Compatibility check: this Codex loader accepts the auth extension",
    );
  }
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout);
  child?.kill();
  await rm(root, { recursive: true, force: true });
}
