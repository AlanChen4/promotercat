import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ApiError, callService } from "@/lib/api-handler";
import { env } from "@/lib/env";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

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
