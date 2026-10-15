import { z } from "zod";

// Both the CLI and cron use the same validated credentials.
export const ingestionEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  TINYFISH_API_KEY: z.string().trim().min(1),
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
  VERCEL_AI_GATEWAY: z.string().trim().min(1),
});

export function getCronEnv() {
  const result = ingestionEnvSchema
    .extend({ CRON_SECRET: z.string().trim().min(1) })
    .safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid cron environment variables:\n${z.prettifyError(result.error)}`,
    );
  return result.data;
}
