import { NextResponse } from "next/server";
import { ApiError, withApiHandler } from "@/lib/api/handler";
import { env } from "@/lib/config/env";
import { createClient, isAuthServiceError } from "@/lib/supabase/server";

// Allow search and the exact OAuth consent route; reject external redirects.
function searchReturnPath(value: string | null | undefined): string {
  if (value) {
    const url = URL.canParse(value, "https://promotercat.invalid")
      ? new URL(value, "https://promotercat.invalid")
      : null;
    if (
      value.startsWith("/oauth/consent?") &&
      url?.origin === "https://promotercat.invalid" &&
      url.pathname === "/oauth/consent" &&
      url.searchParams.get("authorization_id")
    ) {
      return `/oauth/consent?authorization_id=${encodeURIComponent(url.searchParams.get("authorization_id") ?? "")}`;
    }
  }
  return value === "/" || value?.startsWith("/?") ? value : "/";
}

export const GET = withApiHandler(async (request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchReturnPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const message = "Sign-in service unavailable. Please try again.";
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && isAuthServiceError(error)) throw new ApiError(503, message);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(new URL(next, origin));
});
