import { z } from "zod";
import type { Enums } from "../../types/database.types.ts";

export const RESULTS_PER_PAGE = 10;
export const selfPromotionSchema = z.enum([
  "not_allowed",
  "unspecified",
  "allowed_full",
  "allowed_limited",
] satisfies [
  Enums<"self_promotion_status">,
  ...Enums<"self_promotion_status">[],
]);
export type SelfPromotionStatus = z.infer<typeof selfPromotionSchema>;
export const subredditResultSchema = z.object({
  name: z.string(),
  self_promotion: selfPromotionSchema,
  self_promotion_detail: z.string(),
  weekly_active_users: z.number().nullable(),
});
export type SubredditResult = z.infer<typeof subredditResultSchema>;
export type SubredditResponse = {
  subreddits: SubredditResult[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const redditHosts = new Set(["reddit.com", "www.reddit.com", "old.reddit.com"]);
export const redditPageUrlSchema = z
  .url()
  .transform((raw) => new URL(raw))
  .refine(
    (url) =>
      url.protocol === "https:" &&
      redditHosts.has(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password,
    "Use an HTTPS Reddit URL without a port or credentials.",
  );
export const subredditUrlSchema = redditPageUrlSchema
  .refine(
    (url) => /^\/r\/[A-Za-z0-9_]{2,21}\/?$/.test(url.pathname),
    "Use a subreddit URL such as https://www.reddit.com/r/apple/.",
  )
  .transform((url) => {
    const name = url.pathname.split("/")[2].toLowerCase();
    return { name, url: `https://www.reddit.com/r/${name}/` };
  });
export type SubredditTarget = z.output<typeof subredditUrlSchema>;

export type SubredditSearchInput = {
  search?: string;
  self_promotion?: SelfPromotionStatus[];
  page?: number;
};

const defaultPromotionFilters: SelfPromotionStatus[] = [
  "allowed_full",
  "allowed_limited",
  "unspecified",
  "not_allowed",
];
const searchPageSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Math.floor(Number.MAX_SAFE_INTEGER / RESULTS_PER_PAGE))
  .catch(1);

export function parseSearchParams(params: Pick<URLSearchParams, "get">) {
  const filters = [
    ...new Set(
      (params.get("self_promotion") ?? "").split(",").flatMap((value) => {
        const parsed = selfPromotionSchema.safeParse(
          value.trim().toLowerCase(),
        );
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  ];
  return {
    search: params.get("search")?.trim() ?? "",
    self_promotion: filters.length ? filters : defaultPromotionFilters,
    page: searchPageSchema.parse(params.get("page") ?? 1),
  };
}
