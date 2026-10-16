import plugin from "../../plugins/promotercat/plugin.json";

export const pluginVersion = plugin.version;

// Unrecognized versions, including prereleases, are unknown rather than outdated.
function releaseParts(version: string | null) {
  return version &&
    version.length <= 64 &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    ? version.split(".").map(BigInt)
    : undefined;
}

export function pluginUpdateNotice(installedVersion: string | null) {
  const installed = releaseParts(installedVersion);
  const latest = releaseParts(pluginVersion);
  if (!installed || !latest) return {};

  const difference = installed.findIndex((part, i) => part !== latest[i]);
  if (difference < 0 || installed[difference] > latest[difference]) return {};

  return {
    pluginUpdate: {
      installedVersion,
      latestVersion: pluginVersion,
      message: `PromoterCat ${pluginVersion} is available; you're using ${installedVersion}.`,
      updateCommands: {
        codex: [
          "codex plugin marketplace upgrade promotercat",
          "codex plugin add promotercat@promotercat",
        ],
        claudeCode: ["claude plugin update promotercat@promotercat"],
      },
      afterUpdate:
        "Restart Codex or run /reload-plugins in Claude Code, then start a new chat.",
    },
  };
}
