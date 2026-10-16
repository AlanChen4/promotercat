import { z } from "zod";

const secret = z.string().trim().min(1);

export const environmentFields = {
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
};
