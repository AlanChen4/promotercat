import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/handler";
import { env } from "@/lib/config/env";
import { agentClaimsSchema } from "@/lib/schemas/agents";
import { isAuthServiceError } from "@/lib/supabase/server";

export function agentResource(request: Request) {
  const origin =
    env.NODE_ENV === "development"
      ? new URL(request.url).origin
      : "https://www.promotercat.com";
  return `${origin}/mcp`;
}

export function oauthMetadata(request: Request) {
  return {
    resource: agentResource(request),
    authorization_servers: [`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
    scopes_supported: ["email"],
    bearer_methods_supported: ["header"],
    resource_name: "PromoterCat community search",
  };
}

export async function authenticateAgent(request: Request) {
  const bearer = /^Bearer (\S+)$/i.exec(
    request.headers.get("authorization") ?? "",
  );
  const challenge = `Bearer resource_metadata="${new URL(agentResource(request)).origin}/.well-known/oauth-protected-resource/mcp", scope="email"`;
  const unauthorized = () =>
    NextResponse.json(
      { message: "Connect your agent to PromoterCat to sign in." },
      {
        status: 401,
        headers: { "WWW-Authenticate": challenge },
      },
    );
  if (!bearer) return { response: unauthorized() };
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.getClaims(bearer[1]);
  if (error) {
    if (isAuthServiceError(error))
      throw new ApiError(
        503,
        "Agent authentication is unavailable. Please try again.",
      );
    return { response: unauthorized() };
  }
  const parsed = agentClaimsSchema.safeParse(data?.claims);
  if (!parsed.success) return { response: unauthorized() };
  const claims = parsed.data;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    claims.iss !== `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1` ||
    !audience.includes("authenticated")
  )
    return { response: unauthorized() };
  // Access tokens remain valid until expiry after a grant is revoked.
  return { accountId: claims.sub };
}
