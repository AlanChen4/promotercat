import { z } from "zod";

const secret = z.string().trim().min(1);
const databaseCredentials = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SERVICE_ROLE_KEY: secret,
});

export const publicEnvSchema = databaseCredentials
  .pick({
    NEXT_PUBLIC_SUPABASE_URL: true,
  })
  .extend({
    NODE_ENV: z.enum(["development", "production", "test"]),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
    NEXT_PUBLIC_POSTHOG_KEY: secret,
  });

const serverEnvSchema = databaseCredentials.extend({
  VERCEL_AI_GATEWAY: secret,
  CI: z.boolean(),
});

export const ingestionEnvSchema = serverEnvSchema.omit({ CI: true }).extend({
  TINYFISH_API_KEY: secret,
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
});

export function validateEnv<T extends z.ZodType>(
  schema: T,
  input: unknown,
  scope: string,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Report settings and constraints, never their values.
    throw new Error(
      `Invalid ${scope} environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export function getServerEnv() {
  return validateEnv(
    serverEnvSchema,
    { ...process.env, CI: Boolean(process.env.CI) },
    "server",
  );
}

export function getCronEnv() {
  return validateEnv(
    ingestionEnvSchema.extend({ CRON_SECRET: secret }),
    process.env,
    "cron",
  );
}
