import { NextResponse } from "next/server";
import { z } from "zod";
import { AGENT_HEADERS } from "@/lib/agent-api";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && (!error.status || error.status === 429 || error.status >= 500))
    throw error;
  return !error && user && !user.is_anonymous ? client : null;
}
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: AGENT_HEADERS });
}
export async function GET() {
  try {
    const client = await session();
    if (!client)
      return json({ message: "Sign in to manage connections." }, 401);
    const { data, error } = await client.auth.oauth.listGrants();
    if (error) throw error;
    return json({ connections: data });
  } catch {
    return json({ message: "Could not load connected agents." }, 503);
  }
}
export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ message: "A same-origin request is required." }, 403);
  try {
    const client = await session();
    if (!client)
      return json({ message: "Sign in to manage connections." }, 401);
    const body = await request.json().catch(() => null);
    const parsed = z.object({ clientId: z.uuid() }).strict().safeParse(body);
    if (!parsed.success) return json({ message: "Invalid client." }, 400);
    const { error } = await client.auth.oauth.revokeGrant(parsed.data);
    if (error) throw error;
    return json({ disconnected: true });
  } catch {
    return json({ message: "Could not disconnect this agent." }, 503);
  }
}
