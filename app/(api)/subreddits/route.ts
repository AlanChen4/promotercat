import { NextResponse } from "next/server";
import { createGeminiClient } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin-server";
import type { Enums, Tables } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;
type SubredditRow = Pick<
  Tables<"subreddits">,
  "name" | "self_promotion" | "self_promotion_detail" | "members_count"
>;
type SortField = "name" | "members";
type SortDirection = "asc" | "desc";

const RESULTS_PER_PAGE = 10;
const SEMANTIC_MATCH_THRESHOLD = 0.69;
const SEMANTIC_MATCH_COUNT = 300;

const VALID_SELF_PROMOTION = new Set<SelfPromotionStatus>([
  "not_allowed",
  "unspecified",
  "allowed_full",
  "allowed_limited",
]);

const MEMBER_THRESHOLDS = [
  50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000,
];

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

function parseMemberBoundary(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !MEMBER_THRESHOLDS.includes(parsed)) {
    return null;
  }
  return parsed;
}

function parseSortField(rawValue: string | null): SortField | null {
  if (!rawValue) {
    return null;
  }
  const lowered = rawValue.toLowerCase();
  if (lowered === "name" || lowered === "members") {
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
  const minMembers = parseMemberBoundary(url.searchParams.get("min_members"));
  const maxMembers = parseMemberBoundary(url.searchParams.get("max_members"));
  const requestedSortField = parseSortField(url.searchParams.get("sort_by"));
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

    if (minMembers !== null) {
      filteredCandidates = filteredCandidates.filter(
        (candidate) => (candidate.members_count ?? 0) >= minMembers,
      );
    }

    if (
      maxMembers !== null &&
      (minMembers === null || maxMembers >= minMembers)
    ) {
      filteredCandidates = filteredCandidates.filter(
        (candidate) => (candidate.members_count ?? 0) <= maxMembers,
      );
    }

    let orderedCandidates = filteredCandidates;
    if (sortField) {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;
      orderedCandidates = [...filteredCandidates].sort((a, b) => {
        if (sortField === "members") {
          const aMembers = a.members_count ?? 0;
          const bMembers = b.members_count ?? 0;
          if (aMembers === bMembers) {
            return a.name.localeCompare(b.name) * directionMultiplier;
          }
          return aMembers > bMembers
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
    .from("subreddits")
    .select("name,self_promotion,self_promotion_detail,members_count", {
      count: "exact",
    });

  if (selfPromotionFilters.length > 0) {
    query = query.in("self_promotion", selfPromotionFilters);
  }

  if (minMembers !== null) {
    query = query.gte("members_count", minMembers);
  }

  if (
    maxMembers !== null &&
    (minMembers === null || maxMembers >= minMembers)
  ) {
    query = query.lte("members_count", maxMembers);
  }
  const effectiveSortField = sortField ?? "members";
  const { data, error, count } = await query
    .order(effectiveSortField === "members" ? "members_count" : "name", {
      ascending: sortField ? sortDirection === "asc" : true,
    })
    .range(rangeStart, rangeEnd);

  if (error) {
    return NextResponse.json(
      { message: "Failed to load subreddits." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    subreddits: (data ?? []) as SubredditRow[],
    totalCount: count ?? 0,
    page: currentPage,
    pageSize,
  });
}

type SemanticCandidateArgs = {
  searchTerm: string;
  supabaseAdmin: Awaited<ReturnType<typeof createAdminClient>>;
};

async function fetchSemanticCandidates({
  searchTerm,
  supabaseAdmin,
}: SemanticCandidateArgs): Promise<SubredditRow[]> {
  const geminiClient = createGeminiClient();
  const response = await geminiClient.models.embedContent({
    model: "gemini-embedding-001",
    contents: `subreddit related to ${searchTerm}`,
    config: {
      taskType: "RETRIEVAL_QUERY",
      httpOptions: {
        headers: {
          "Helicone-Cache-Enabled": "true",
          "Cache-Control": "max-age=31536000",
        },
      },
    },
  });

  const embeddingValues = response.embeddings?.[0]?.values;
  if (!embeddingValues || embeddingValues.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin.rpc(
    "match_subreddits_by_description",
    {
      // @ts-expect-error: RPC arguments are typed incorrectly and 'query_embedding' works.
      query_embedding: embeddingValues,
      match_threshold: SEMANTIC_MATCH_THRESHOLD,
      match_count: SEMANTIC_MATCH_COUNT,
    },
  );

  if (error) {
    console.error("Failed to fetch semantic matches:", error.message);
    return [];
  }

  const seen = new Set<string>();
  const rows: SubredditRow[] = [];

  for (const row of data ?? []) {
    if (!row?.name || seen.has(row.name)) {
      continue;
    }
    seen.add(row.name);
    rows.push({
      name: row.name,
      self_promotion: row.self_promotion,
      self_promotion_detail: row.self_promotion_detail,
      members_count: row.members_count,
    });
  }

  return rows;
}
