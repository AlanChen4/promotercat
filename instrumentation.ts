import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Next.js needs direct runtime checks to exclude Node-only code from edge bundles.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
