import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Usage: node scripts/plugin-version.ts [sync|patch|minor|major|X.Y.Z|auto BASE_REF]
const root = fileURLToPath(new URL("../", import.meta.url));
const pluginRoot = "plugins/promotercat";
const manifestPath = `${pluginRoot}/plugin.json`;
type PluginManifest = { version: string };
type McpConfig = {
  mcpServers: Record<string, { headers?: Record<string, string> }>;
};
type BumpLevel = "major" | "minor" | "patch";

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function parts(version: unknown) {
  if (
    typeof version !== "string" ||
    version.length > 64 ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
  )
    throw new Error(`Expected a stable X.Y.Z version, got ${version}`);
  return version.split(".").map(BigInt);
}

function greater(left: string, right: string) {
  const a = parts(left);
  const b = parts(right);
  const index = a.findIndex((part, i) => part !== b[i]);
  return index >= 0 && a[index] > b[index];
}

function bump(version: string, level: BumpLevel) {
  const next = parts(version);
  const index = ["major", "minor", "patch"].indexOf(level);
  next[index] += BigInt(1);
  for (let i = index + 1; i < next.length; i++) next[i] = BigInt(0);
  return next.join(".");
}

function main() {
  const [command = "sync", baseRef, ...extra] = process.argv.slice(2);
  if (extra.length || (command !== "auto" && baseRef))
    throw new Error("Use sync, patch, minor, major, X.Y.Z, or auto BASE_REF.");
  const manifest = readJson<PluginManifest>(manifestPath);
  let version = manifest.version;
  parts(version);

  if (command === "auto") {
    if (!baseRef) throw new Error("auto requires a base Git ref.");
    const base = git(
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${baseRef}^{commit}`,
    );
    const changes = git(
      "diff",
      "--name-only",
      `${base}...HEAD`,
      "--",
      pluginRoot,
    );
    if (!changes) {
      console.log("No plugin changes; version unchanged.");
      return;
    }
    const baseVersion = JSON.parse(
      git("show", `${base}:${manifestPath}`),
    ).version;
    // Preserve an explicit increase and reuse it on subsequent pushes to this PR.
    if (!greater(version, baseVersion)) version = bump(baseVersion, "patch");
  } else if (
    command === "patch" ||
    command === "minor" ||
    command === "major"
  ) {
    version = bump(version, command);
  } else if (command !== "sync") {
    parts(command);
    if (!greater(command, version))
      throw new Error(
        "An explicit version must be greater than the current version.",
      );
    version = command;
  }

  const documents: [string, PluginManifest | McpConfig][] = [
    [manifestPath, manifest],
    [
      `${pluginRoot}/.claude-plugin/plugin.json`,
      readJson<PluginManifest>(`${pluginRoot}/.claude-plugin/plugin.json`),
    ],
    [`${pluginRoot}/mcp.json`, readJson<McpConfig>(`${pluginRoot}/mcp.json`)],
    [`${pluginRoot}/.mcp.json`, readJson<McpConfig>(`${pluginRoot}/.mcp.json`)],
  ];
  const writes: [string, string][] = [];
  for (const [path, document] of documents) {
    const previous = JSON.stringify(document);
    if ("version" in document) document.version = version;
    else {
      const server = document.mcpServers.promotercat;
      server.headers ??= {};
      server.headers["X-PromoterCat-Plugin-Version"] = version;
    }
    if (JSON.stringify(document) !== previous)
      writes.push([path, `${JSON.stringify(document, null, 2)}\n`]);
  }
  for (const [path, text] of writes)
    writeFileSync(new URL(`../${path}`, import.meta.url), text);
  console.log(`PromoterCat ${version}: synchronized ${writes.length} file(s).`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
