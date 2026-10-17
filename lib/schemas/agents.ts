import { z } from "zod";
import { RESULTS_PER_PAGE, selfPromotionSchema } from "./subreddits.ts";

export const admissionSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(true) }),
  z.object({
    allowed: z.literal(false),
    allowance: z.enum(["minute", "day", "minute_and_day"]),
    resetAt: z.string(),
    retryAfter: z.number().int().positive(),
  }),
]);

export const agentClaimsSchema = z.object({
  sub: z.uuid(),
  client_id: z.uuid(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  role: z.literal("authenticated"),
  is_anonymous: z.literal(false).optional(),
});

export const agentSearchInputSchema = z
  .object({
    search: z.string().max(1000).optional(),
    self_promotion: z.array(selfPromotionSchema).min(1).optional(),
    page: z
      .number()
      .int()
      .min(1)
      .max(Math.floor(Number.MAX_SAFE_INTEGER / RESULTS_PER_PAGE))
      .optional(),
  })
  .strict();
