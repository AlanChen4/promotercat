import { ApiError, callService } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";

export function isAuthServiceError(error: { status?: number }) {
  return !error.status || error.status === 429 || error.status >= 500;
}

export async function requireSession(
  message = "Sign in to manage connections.",
) {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await callService(
    "Unable to verify your session. Please try again.",
    () => client.auth.getUser(),
  );
  if (error && isAuthServiceError(error))
    throw new ApiError(503, "Unable to verify your session. Please try again.");
  if (error || !user || user.is_anonymous) throw new ApiError(401, message);
  return client;
}
