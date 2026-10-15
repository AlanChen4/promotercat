import { NextResponse } from "next/server";
import { ApiError, callService, withApiHandler } from "@/lib/api-handler";
import { isAuthServiceError } from "@/lib/api-session";
import { searchReturnPath } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const GET = withApiHandler(async (request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchReturnPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const message = "Sign-in service unavailable. Please try again.";
    const { error } = await callService(message, () =>
      supabase.auth.exchangeCodeForSession(code),
    );
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
