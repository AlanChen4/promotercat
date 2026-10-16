import { ApiError, callService, withApiHandler } from "@/lib/api/handler";
import { oauthConnectionSchema } from "@/lib/schemas/agents";
import { requireSession } from "@/lib/supabase/server";

export const GET = withApiHandler(async () => {
  const client = await requireSession();
  const message = "Could not load connected agents.";
  const { data, error } = await callService(message, () =>
    client.auth.oauth.listGrants(),
  );
  if (error) throw new ApiError(503, message);
  return Response.json({ connections: data });
});

export const DELETE = withApiHandler(async (request) => {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ApiError(403, "A same-origin request is required.");
  const client = await requireSession();
  const body = await request.json().catch(() => null);
  const parsed = oauthConnectionSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "Invalid client.");
  const message = "Could not disconnect this agent.";
  const { error } = await callService(message, () =>
    client.auth.oauth.revokeGrant(parsed.data),
  );
  if (error) throw new ApiError(503, message);
  return Response.json({ disconnected: true });
});
