import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const secret = z.string().trim().min(1);

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: secret,
    VERCEL_AI_GATEWAY: secret,
    TINYFISH_API_KEY: secret,
    CRON_SECRET: secret,
    CI: z.boolean(),
    APIFY_API_KEYS: z
      .string()
      .transform((raw, ctx) => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "Use a JSON array of Apify API keys.",
          });
          return z.NEVER;
        }
      })
      .pipe(z.array(z.string().trim().min(1)).min(1))
      .transform((keys) => [...new Set(keys)]),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
    NEXT_PUBLIC_POSTHOG_KEY: secret,
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
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
