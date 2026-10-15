import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AGENT_HEADERS } from "@/lib/agent-api";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin-server";

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

const claimsSchema = z.object({
  sub: z.uuid(),
  session_id: z.uuid(),
  client_id: z.uuid(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  role: z.literal("authenticated"),
  is_anonymous: z.literal(false).optional(),
});

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
        headers: { ...AGENT_HEADERS, "WWW-Authenticate": challenge },
      },
    );
  if (!bearer) return { response: unauthorized() };
  try {
    const client = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await client.auth.getClaims(bearer[1]);
    if (error) {
      if (!error.status || error.status === 429 || error.status >= 500)
        throw error;
      return { response: unauthorized() };
    }
    const parsed = claimsSchema.safeParse(data?.claims);
    if (!parsed.success) return { response: unauthorized() };
    const claims = parsed.data;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (
      claims.iss !== `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1` ||
      !audience.includes("authenticated")
    )
      return { response: unauthorized() };
    // Signature validation alone does not notice a revoked grant. Check its
    // active session before accepting a tool call, including with cached JWTs.
    const { data: active, error: sessionError } = await createAdminClient(
      env,
    ).rpc("is_active_agent_session", {
      p_session_id: claims.session_id,
      p_account_id: claims.sub,
      p_client_id: claims.client_id,
    });
    if (sessionError) throw sessionError;
    if (!active) return { response: unauthorized() };
    return { accountId: claims.sub, clientId: claims.client_id };
  } catch {
    return {
      response: NextResponse.json(
        { message: "Agent authentication is unavailable. Please try again." },
        { status: 503, headers: AGENT_HEADERS },
      ),
    };
  }
}
