import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/env";
import type { Database } from "@/types/database.types";

export async function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
