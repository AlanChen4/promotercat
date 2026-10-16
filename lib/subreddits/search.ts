import { getQueryEmbedding } from "@/lib/ai/embeddings";
import { ApiError } from "@/lib/api/handler";
import { env } from "@/lib/config/env";
import {
  RESULTS_PER_PAGE,
  type SelfPromotionStatus,
  type SubredditResponse,
  type SubredditResult as SubredditRow,
  type SubredditSearchInput,
  selfPromotionSchema,
  subredditResultSchema,
} from "@/lib/schemas/subreddits";
import { createAdminClient } from "@/lib/supabase/admin-server";

const SEMANTIC_MATCH_THRESHOLD = 0.5;

/** Commas separate unordered terms; word order within a term is meaningful. */
function normalizeSearchTerms(search: string): string[] {
  return [
    ...new Set(
      search
        .split(",")
        .map((term) => term.trim().toLowerCase().replace(/^r\//, "").trim())
        .filter(Boolean),
    ),
  ].sort();
}

export async function searchSubreddits(
  input: SubredditSearchInput,
): Promise<SubredditResponse> {
  const searchTerm = input.search?.trim() ?? "";
  const selfPromotionFilters = input.self_promotion ?? [];
  const supabaseAdmin = createAdminClient(env);
  const pageSize = RESULTS_PER_PAGE;
  const currentPage = input.page ?? 1;
  const rangeStart = (currentPage - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  const sortField = input.sort;
  const sortDirection = input.sort_direction ?? "asc";

  const shouldUseSemanticSearch = searchTerm.length > 0;
  if (shouldUseSemanticSearch) {
    const semanticCandidates = await fetchSemanticCandidates({
      searchTerm,
      supabaseAdmin,
    });

    if (semanticCandidates.length === 0) {
      return {
        subreddits: [],
        totalCount: 0,
        page: currentPage,
        pageSize,
      };
    }

    let filteredCandidates = semanticCandidates;

    if (selfPromotionFilters.length > 0) {
      const allowedStatuses = new Set(selfPromotionFilters);
      filteredCandidates = filteredCandidates.filter((candidate) =>
        candidate.self_promotion
          ? allowedStatuses.has(candidate.self_promotion as SelfPromotionStatus)
          : false,
      );
    }

    let orderedCandidates = filteredCandidates;
    if (sortField) {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;
      orderedCandidates = [...filteredCandidates].sort((a, b) => {
        if (sortField === "weekly_active") {
          if (a.weekly_active_users === null)
            return b.weekly_active_users === null
              ? a.name.localeCompare(b.name)
              : 1;
          if (b.weekly_active_users === null) return -1;
          const aActivity = a.weekly_active_users;
          const bActivity = b.weekly_active_users;
          if (aActivity === bActivity) {
            return a.name.localeCompare(b.name) * directionMultiplier;
          }
          return aActivity > bActivity
            ? directionMultiplier
            : -directionMultiplier;
        }
        return a.name.localeCompare(b.name) * directionMultiplier;
      });
    }

    const totalCount = orderedCandidates.length;
    const sliceStart = rangeStart;
    const sliceEnd = sliceStart + pageSize;
    const paginated = orderedCandidates.slice(sliceStart, sliceEnd);

    return {
      subreddits: paginated,
      totalCount,
      page: currentPage,
      pageSize,
    };
  }

  let query = supabaseAdmin
    .from("current_subreddits")
    .select("name,self_promotion,self_promotion_detail,weekly_active_users", {
      count: "exact",
    })
    .not("self_promotion", "is", null);

  if (selfPromotionFilters.length > 0) {
    query = query.in("self_promotion", selfPromotionFilters);
  }

  const effectiveSortField = sortField ?? "weekly_active";
  const { data, error, count } = await query
    .order(
      effectiveSortField === "weekly_active" ? "weekly_active_users" : "name",
      {
        ascending: sortField ? sortDirection === "asc" : true,
        nullsFirst: false,
      },
    )
    .order("name", { ascending: true })
    .range(rangeStart, rangeEnd);

  // PostgREST returns 416 for a valid page beyond the last row.
  if (error?.code === "PGRST103") {
    const total = await supabaseAdmin
      .from("current_subreddits")
      .select("name", { count: "exact", head: true })
      .not("self_promotion", "is", null)
      .in(
        "self_promotion",
        selfPromotionFilters.length
          ? selfPromotionFilters
          : selfPromotionSchema.options,
      );
    if (!total.error)
      return {
        subreddits: [],
        totalCount: total.count ?? 0,
        page: currentPage,
        pageSize,
      };
  }
  if (error) throw new ApiError(503, "Failed to load subreddits.");
  return {
    subreddits: (data ?? []) as SubredditRow[],
    totalCount: count ?? 0,
    page: currentPage,
    pageSize,
  };
}

type SemanticCandidateArgs = {
  searchTerm: string;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
};

async function fetchSemanticCandidates({
  searchTerm,
  supabaseAdmin,
}: SemanticCandidateArgs): Promise<SubredditRow[]> {
  const terms = normalizeSearchTerms(searchTerm);
  if (terms.length === 0) return [];
  const embeddings = await Promise.all(
    terms.map((term) => getQueryEmbedding(term, env.VERCEL_AI_GATEWAY)),
  );
  const { data, error } = await supabaseAdmin.rpc(
    "match_subreddits_by_descriptions",
    {
      query_embeddings: embeddings,
      match_threshold: SEMANTIC_MATCH_THRESHOLD,
    },
  );

  if (error) throw new ApiError(503, "Failed to fetch semantic matches.");

  const parsed = subredditResultSchema.array().safeParse(data);
  if (!parsed.success) throw new ApiError(503, "Invalid semantic matches.");
  return parsed.data;
}
