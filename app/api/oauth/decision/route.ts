import { NextResponse } from "next/server";
import { AGENT_HEADERS } from "@/lib/agent-api";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { message: "A same-origin request is required." },
      { status: 403, headers: AGENT_HEADERS },
    );
  const form = await request.formData();
  const authorizationId = form.get("authorization_id");
  const decision = form.get("decision");
  if (
    typeof authorizationId !== "string" ||
    !authorizationId ||
    !["approve", "deny"].includes(String(decision))
  )
    return NextResponse.json(
      { message: "Invalid connection decision." },
      { status: 400, headers: AGENT_HEADERS },
    );
  try {
    const client = await createClient();
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user || user.is_anonymous)
      return NextResponse.json(
        { message: "Sign in before connecting your agent." },
        { status: 401, headers: AGENT_HEADERS },
      );
    const { data, error } =
      decision === "approve"
        ? await client.auth.oauth.approveAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          })
        : await client.auth.oauth.denyAuthorization(authorizationId, {
            skipBrowserRedirect: true,
          });
    if (error || !data)
      return NextResponse.json(
        {
          message:
            "Connection request expired or could not be completed. Start again from your agent.",
        },
        { status: 400, headers: AGENT_HEADERS },
      );
    const response = NextResponse.redirect(data.redirect_url, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json(
      { message: "Connection service unavailable. Please try again." },
      { status: 503, headers: AGENT_HEADERS },
    );
  }
}
