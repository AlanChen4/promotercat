import { z } from "zod";
import {
  type SelfPromotionStatus,
  selfPromotionSchema,
  subredditUrlSchema,
} from "./subreddits.ts";

export const fetchResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      final_url: z.string().nullable(),
      text: z.string().nullable(),
    }),
  ),
  errors: z.array(z.object({ url: z.string(), error: z.string() })),
});

export const apifyRunSchema = z.object({
  data: z.object({
    id: z.string().regex(/^[A-Za-z0-9]+$/),
    status: z.string(),
    defaultDatasetId: z.string().regex(/^[A-Za-z0-9]+$/),
  }),
});
export const apifyCommunitySchema = z.object({
  dataType: z.literal("community"),
  name: z.string(),
  url: subredditUrlSchema,
  subredditType: z.literal("public"),
  publicDescription: z.string().nullish(),
  rules: z
    .array(
      z.object({
        shortName: z.string().trim().min(1),
        description: z.string().nullable(),
        priority: z.number().int().nonnegative(),
      }),
    )
    .max(100)
    .refine(
      (rules) =>
        new Set(rules.map((rule) => rule.priority)).size === rules.length,
      "Apify returned duplicate rule positions.",
    )
    .transform((rules) =>
      rules
        .sort((a, b) => a.priority - b.priority)
        .map((rule) => ({
          title: rule.shortName,
          description: rule.description?.trim() || null,
        })),
    ),
});

export type ApifyRun = z.infer<typeof apifyRunSchema>["data"];
export const apifyErrorSchema = z.object({
  error: z.object({ type: z.string(), message: z.string() }),
});
export const apifyDatasetSchema = z.array(z.unknown());
export const apifyIdentitySchema = z.object({ name: z.string() });
export const policySummarySchema = (status: SelfPromotionStatus) =>
  z.object({
    summary: z
      .string()
      .trim()
      .min(status === "allowed_limited" ? 1 : 0),
  });

export const policyEvalCasesSchema = z
  .array(
    z.object({
      name: z.string().min(1),
      source: z.string().min(1),
      expected: selfPromotionSchema,
      summaryChecks: z
        .object({
          required: z.array(z.string()).default([]),
          forbidden: z.array(z.string()).default([]),
        })
        .optional(),
      rules: z.array(
        z.object({ title: z.string(), description: z.string().nullable() }),
      ),
    }),
  )
  .min(1);

export const policyConfidenceSchema = z.number().min(0).max(1);
