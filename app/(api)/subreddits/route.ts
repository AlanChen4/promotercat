import { NextResponse } from "next/server";
import { ACTIVITY_THRESHOLD_OPTIONS } from "@/constants/subreddit-filters";
import { serverEnv } from "@/env";
import { embedDescription } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;
type SubredditRow = {
  name: string;
  self_promotion: SelfPromotionStatus;
  self_promotion_detail: string;
  weekly_active_users: number | null;
};
type SortField = "name" | "weekly_active";
type SortDirection = "asc" | "desc";

const RESULTS_PER_PAGE = 10;
const SEMANTIC_MATCH_THRESHOLD = 0.69;
const SEMANTIC_MATCH_COUNT = 300;
const RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

const VALID_SELF_PROMOTION = new Set<SelfPromotionStatus>([
  "not_allowed",
  "unspecified",
  "allowed_full",
  "allowed_limited",
]);

const ACTIVITY_THRESHOLDS = ACTIVITY_THRESHOLD_OPTIONS.map(
  (option) => option.value,
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

  return rawFilter
    .split(",")
    .map((value) => value.trim().toLowerCase() as SelfPromotionStatus)
    .filter((value) => VALID_SELF_PROMOTION.has(value));
}

function parseActivityBoundary(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !ACTIVITY_THRESHOLDS.includes(parsed)) {
    return null;
  }
  return parsed;
}

function parseSortField(rawValue: string | null): SortField | null {
  if (!rawValue) {
    return null;
  }
  const lowered = rawValue.toLowerCase();
  if (lowered === "name" || lowered === "weekly_active") {
    return lowered as SortField;
  }
  return null;
}

function parseSortDirection(rawValue: string | null): SortDirection | null {
  if (!rawValue) {
    return null;
  }
  const lowered = rawValue.toLowerCase();
  if (lowered === "asc" || lowered === "desc") {
    return lowered as SortDirection;
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search")?.trim() ?? "";
  const selfPromotionFilters = extractSelfPromotionFilters(
    url.searchParams.get("self_promotion"),
  );
  const requestedPage = parsePage(url.searchParams.get("page"));
  if (requestedPage > 1) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (
      error &&
      (error.status === undefined ||
        error.status === 0 ||
        error.status === 429 ||
        error.status >= 500)
    ) {
      return NextResponse.json(
        { message: "Unable to verify your session. Please try again." },
        { status: 503, headers: RESPONSE_HEADERS },
      );
    }
    if (error || !user || user.is_anonymous) {
      return NextResponse.json(
        { message: "Sign up or log in to view more results." },
        { status: 401, headers: RESPONSE_HEADERS },
      );
    }
  }
  const minActivity = parseActivityBoundary(
    url.searchParams.get("min_weekly_active"),
  );
  const maxActivity = parseActivityBoundary(
    url.searchParams.get("max_weekly_active"),
  );
  const requestedSortField = parseSortField(url.searchParams.get("sort"));
  const requestedSortDirection = parseSortDirection(
    url.searchParams.get("sort_direction"),
  );

  const supabaseAdmin = await createAdminClient();
  const pageSize = RESULTS_PER_PAGE;
  const currentPage = requestedPage;
  const rangeStart = (currentPage - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  const sortField = requestedSortField;
  const sortDirection = requestedSortDirection ?? "asc";

  const shouldUseSemanticSearch = searchTerm.length > 0;
  if (shouldUseSemanticSearch) {
    let semanticCandidates: SubredditRow[];
    try {
      semanticCandidates = await fetchSemanticCandidates({
        searchTerm,
        supabaseAdmin,
      });
    } catch {
      return NextResponse.json(
        { message: "Failed to load subreddits." },
        { status: 500, headers: RESPONSE_HEADERS },
      );
    }

    if (semanticCandidates.length === 0) {
      return NextResponse.json(
        {
          subreddits: [],
          totalCount: 0,
          page: currentPage,
          pageSize,
        },
        { headers: RESPONSE_HEADERS },
      );
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

    if (minActivity !== null) {
      filteredCandidates = filteredCandidates.filter(
        (candidate) =>
          candidate.weekly_active_users !== null &&
          candidate.weekly_active_users >= minActivity,
      );
    }

    if (
      maxActivity !== null &&
      (minActivity === null || maxActivity >= minActivity)
    ) {
      filteredCandidates = filteredCandidates.filter(
        (candidate) =>
          candidate.weekly_active_users !== null &&
          candidate.weekly_active_users <= maxActivity,
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

    return NextResponse.json(
      {
        subreddits: paginated,
        totalCount,
        page: currentPage,
        pageSize,
      },
      { headers: RESPONSE_HEADERS },
    );
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

  if (minActivity !== null) {
    query = query.gte("weekly_active_users", minActivity);
  }

  if (
    maxActivity !== null &&
    (minActivity === null || maxActivity >= minActivity)
  ) {
    query = query.lte("weekly_active_users", maxActivity);
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

  if (error) {
    return NextResponse.json(
      { message: "Failed to load subreddits." },
      { status: 500, headers: RESPONSE_HEADERS },
    );
  }
  return NextResponse.json(
    {
      subreddits: (data ?? []) as SubredditRow[],
      totalCount: count ?? 0,
      page: currentPage,
      pageSize,
    },
    { headers: RESPONSE_HEADERS },
  );
}

type SemanticCandidateArgs = {
  searchTerm: string;
  supabaseAdmin: Awaited<ReturnType<typeof createAdminClient>>;
};

async function fetchSemanticCandidates({
  searchTerm,
  supabaseAdmin,
}: SemanticCandidateArgs): Promise<SubredditRow[]> {
  const embeddingValues = await embedDescription(
    `subreddit related to ${searchTerm}`,
    "RETRIEVAL_QUERY",
    serverEnv.VERCEL_AI_GATEWAY,
  );

  const { data, error } = await supabaseAdmin.rpc(
    "match_subreddits_by_description",
    {
      query_embedding: JSON.stringify(embeddingValues),
      match_threshold: SEMANTIC_MATCH_THRESHOLD,
      match_count: SEMANTIC_MATCH_COUNT,
    },
  );

  if (error) throw new Error("Failed to fetch semantic matches.");

  return (data ?? []).map(
    ({ name, self_promotion, self_promotion_detail, weekly_active_users }) => ({
      name,
      self_promotion,
      self_promotion_detail,
      weekly_active_users,
    }),
  );
}
