import type { IncomingMessage, ServerResponse } from "node:http";
import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Next.js needs direct runtime checks to exclude Node-only code from edge bundles.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { subscribe } = await import("node:diagnostics_channel");
    // Next's rewrite proxy and Sentry add 11 normal close listeners.
    // Remove this workaround when https://github.com/vercel/next.js/issues/97757 is fixed.
    subscribe("http.server.request.start", (message) => {
      const { request, response } = message as {
        request: IncomingMessage;
        response: ServerResponse;
      };
      const path = request.url?.split("?")[0];
      const limit = response.getMaxListeners();
      if (
        (path === "/ingest" || path?.startsWith("/ingest/")) &&
        limit > 0 &&
        limit < 20
      ) {
        response.setMaxListeners(20);
      }
    });
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
