import { unstable_rethrow } from "next/navigation";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Keep route-specific responses intact; cache successful responses only by opt-in. */
export function withApiHandler(
  handler: (request: Request) => Response | Promise<Response>,
  options: { cacheControl?: string } = {},
) {
  return async (request: Request): Promise<Response> => {
    try {
      const result = await handler(request);
      // Fetch responses and Response.redirect() can have immutable headers.
      // Reuse the body stream without reading it and copy all response headers.
      const response = new Response(result.body, result);
      response.headers.set(
        "Cache-Control",
        response.ok && options.cacheControl
          ? options.cacheControl
          : "private, no-store",
      );
      return response;
    } catch (error) {
      // Preserve redirect(), notFound(), and Next.js rendering control flow.
      unstable_rethrow(error);
      const status = error instanceof ApiError ? error.status : 500;
      // Do not log request bodies, query strings, credentials, or upstream errors.
      if (status >= 500)
        console.error("API request failed", {
          method: request.method,
          path: new URL(request.url).pathname,
          status,
        });
      return Response.json(
        {
          message:
            error instanceof ApiError
              ? error.message
              : "An unexpected error occurred. Please try again.",
        },
        { status, headers: { "Cache-Control": "private, no-store" } },
      );
    }
  };
}
