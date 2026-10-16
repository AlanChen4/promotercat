import { NextResponse } from "next/server";
import { embedDescription } from "@/lib/ai/embeddings";
import { ApiError, callService } from "@/lib/api/handler";
import { env } from "@/lib/config/env";
import {
  RESULTS_PER_PAGE,
  type SelfPromotionStatus,
  type SubredditResult as SubredditRow,
  selfPromotionSchema,
  sortDirectionSchema,
  sortFieldSchema,
} from "@/lib/schemas/subreddits";
import { createAdminClient } from "@/lib/supabase/admin-server";

const SEMANTIC_MATCH_THRESHOLD = 0.5;
const SEMANTIC_MATCH_COUNT = 200;
// These words help the semantic query, but should not independently match names.
const NAME_STOP_WORDS = new Set(
  "a an and are as at be by for from i in is it my of on or our that the this to we with you your".split(
    " ",
  ),
);

function parsePage(requestedPage: string | null): number {
  const parsed = Number(requestedPage);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function extractSelfPromotionFilters(
  rawFilter: string | null,
): SelfPromotionStatus[] {
  if (!rawFilter) {
    return [];
  }

  return rawFilter.split(",").flatMap((value) => {
    const result = selfPromotionSchema.safeParse(value.trim().toLowerCase());
    return result.success ? [result.data] : [];
  });
}

export async function searchSubreddits(request: Request) {
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search")?.trim() ?? "";
  const selfPromotionFilters = extractSelfPromotionFilters(
    url.searchParams.get("self_promotion"),
  );
  const requestedPage = parsePage(url.searchParams.get("page"));
  const requestedSortField = sortFieldSchema.safeParse(
    url.searchParams.get("sort")?.toLowerCase(),
  ).data;
  const requestedSortDirection = sortDirectionSchema.safeParse(
    url.searchParams.get("sort_direction")?.toLowerCase(),
  ).data;

  const supabaseAdmin = createAdminClient(env);
  const pageSize = RESULTS_PER_PAGE;
  const currentPage = requestedPage;
  const rangeStart = (currentPage - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  const sortField = requestedSortField;
  const sortDirection = requestedSortDirection ?? "asc";

  const shouldUseSemanticSearch = searchTerm.length > 0;
  if (shouldUseSemanticSearch) {
    const semanticCandidates = await fetchSemanticCandidates({
      searchTerm,
      supabaseAdmin,
    });

    if (semanticCandidates.length === 0) {
      return NextResponse.json({
        subreddits: [],
        totalCount: 0,
        page: currentPage,
        pageSize,
      });
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

    return NextResponse.json({
      subreddits: paginated,
      totalCount,
      page: currentPage,
      pageSize,
    });
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
  const { data, error, count } = await callService(
    "Failed to load subreddits.",
    () =>
      query
        .order(
          effectiveSortField === "weekly_active"
            ? "weekly_active_users"
            : "name",
          {
            ascending: sortField ? sortDirection === "asc" : true,
            nullsFirst: false,
          },
        )
        .order("name", { ascending: true })
        .range(rangeStart, rangeEnd),
  );

  // PostgREST returns 416 for a valid page beyond the last row.
  if (error?.code === "PGRST103") {
    const total = await callService("Failed to load subreddits.", () =>
      supabaseAdmin
        .from("current_subreddits")
        .select("name", { count: "exact", head: true })
        .not("self_promotion", "is", null)
        .in(
          "self_promotion",
          selfPromotionFilters.length
            ? selfPromotionFilters
            : selfPromotionSchema.options,
        ),
    );
    if (!total.error)
      return NextResponse.json({
        subreddits: [],
        totalCount: total.count ?? 0,
        page: currentPage,
        pageSize,
      });
  }
  if (error) throw new ApiError(503, "Failed to load subreddits.");
  return NextResponse.json({
    subreddits: (data ?? []) as SubredditRow[],
    totalCount: count ?? 0,
    page: currentPage,
    pageSize,
  });
}

type SemanticCandidateArgs = {
  searchTerm: string;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
};

async function fetchSemanticCandidates({
  searchTerm,
  supabaseAdmin,
}: SemanticCandidateArgs): Promise<SubredditRow[]> {
  const query = searchTerm.replace(/^r\//i, "");
  const nameTerms = [
    ...new Set(query.toLowerCase().match(/[a-z0-9_]+/g) ?? []),
  ].filter((term) => term.length > 1 && !NAME_STOP_WORDS.has(term));
  const embeddingValues = await callService(
    "Search embeddings are unavailable.",
    () => embedDescription(query, "RETRIEVAL_QUERY", env.VERCEL_AI_GATEWAY),
  );

  const { data, error } = await callService(
    "Failed to fetch semantic matches.",
    () =>
      supabaseAdmin.rpc("match_subreddits_by_description", {
        query_embedding: JSON.stringify(embeddingValues),
        match_threshold: SEMANTIC_MATCH_THRESHOLD,
        match_count: SEMANTIC_MATCH_COUNT,
        name_terms: nameTerms,
      }),
  );

  if (error) throw new ApiError(503, "Failed to fetch semantic matches.");

  return data ?? [];
}
