import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().trim().min(1).optional(),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  VERCEL_AI_GATEWAY: z.string().trim().min(1),
  CI: z.string().optional(),
});

function validateEnv<T extends z.ZodType>(
  schema: T,
  input: unknown,
  scope: string,
): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Report settings and constraints, never their values.
    throw new Error(
      `Invalid ${scope} environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

// Keep explicit reads so Next.js can inline public values in browser bundles.
export const env = validateEnv(
  envSchema,
  {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
  "public",
);

function getServerEnv() {
  if (typeof window !== "undefined") {
    // Public imports must not validate or expose private settings in the browser.
    return {
      get SUPABASE_SERVICE_ROLE_KEY(): never {
        throw new Error(
          "Server environment variables are unavailable in the browser.",
        );
      },
      get VERCEL_AI_GATEWAY(): never {
        throw new Error(
          "Server environment variables are unavailable in the browser.",
        );
      },
      get CI(): never {
        throw new Error(
          "Server environment variables are unavailable in the browser.",
        );
      },
    };
  }
  return validateEnv(
    serverEnvSchema,
    {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      VERCEL_AI_GATEWAY: process.env.VERCEL_AI_GATEWAY,
      CI: process.env.CI,
    },
    "server",
  );
}

export const serverEnv = getServerEnv();
