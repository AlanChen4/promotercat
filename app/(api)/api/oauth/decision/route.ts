import { NextResponse } from "next/server";
import { ApiError, withApiHandler } from "@/lib/api/handler";
import { isAuthServiceError, requireSession } from "@/lib/supabase/server";

export const POST = withApiHandler(async (request) => {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ApiError(403, "A same-origin request is required.");
  const form = await request.formData().catch(() => null);
  const authorizationId = form?.get("authorization_id");
  const decision = form?.get("decision");
  if (
    typeof authorizationId !== "string" ||
    !authorizationId ||
    !["approve", "deny"].includes(String(decision))
  )
    throw new ApiError(400, "Invalid connection decision.");
  const client = await requireSession("Sign in before connecting your agent.");
  const { data, error } = await (decision === "approve"
    ? client.auth.oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      })
    : client.auth.oauth.denyAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      }));
  if (error) {
    if (isAuthServiceError(error))
      throw new ApiError(
        503,
        "Connection service unavailable. Please try again.",
      );
    throw new ApiError(
      400,
      "Connection request expired or could not be completed. Start again from your agent.",
    );
  }
  if (!data)
    throw new ApiError(
      503,
      "Connection service unavailable. Please try again.",
    );
  return NextResponse.redirect(data.redirect_url, 303);
});
