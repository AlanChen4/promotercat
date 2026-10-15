import { z } from "zod";

export const AGENT_HEADERS = { "Cache-Control": "private, no-store" };

export const admissionSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(true) }),
  z.object({
    allowed: z.literal(false),
    allowance: z.enum(["minute", "day", "minute_and_day"]),
    resetAt: z.string(),
    retryAfter: z.number().int().positive(),
  }),
]);
