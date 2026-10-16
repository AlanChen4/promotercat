import { createEnv } from "@t3-oss/env-nextjs";
import { environmentFields } from "./schemas/env.ts";

export const env = createEnv({
  ...environmentFields,
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VERCEL_AI_GATEWAY: process.env.VERCEL_AI_GATEWAY,
    TINYFISH_API_KEY: process.env.TINYFISH_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    APIFY_API_KEYS: process.env.APIFY_API_KEYS,
    CI: Boolean(process.env.CI),
  },
});
