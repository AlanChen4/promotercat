import { NextResponse } from "next/server";
import { createGeminiClient } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;
type SubredditRow = Pick<
  Tables<"subreddits">,
  "name" | "self_promotion" | "self_promotion_detail" | "members_count"
>;
type SortField = "name" | "members";
type SortDirection = "asc" | "desc";

const RESULTS_PER_PAGE = 10;
const FREE_RESULT_LIMIT = 3;
const SEMANTIC_MATCH_THRESHOLD = 0.65;
const SEMANTIC_MATCH_COUNT = 100;

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

  const supabase = await createClient();
  const supabaseAdmin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  let isPremium: boolean = false;
  if (userId) {
    const { data: userRecord } = await supabase
      .from("users")
      .select("is_premium")
      .eq("id", userId)
      .single();
    if (!userRecord) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    isPremium = userRecord.is_premium ?? false;
  }

  const pageSize = isPremium ? RESULTS_PER_PAGE : FREE_RESULT_LIMIT;
  const currentPage = isPremium ? requestedPage : 1;
  const rangeStart = isPremium ? (currentPage - 1) * RESULTS_PER_PAGE : 0;
  const rangeEnd = rangeStart + pageSize - 1;
  const canUseSorting = Boolean(userId);
  const sortField: SortField =
    canUseSorting && requestedSortField ? requestedSortField : "name";
  const sortDirection: SortDirection =
    canUseSorting && requestedSortDirection ? requestedSortDirection : "asc";

  const shouldUseSemanticSearch = searchTerm.length > 0;
  let semanticCandidateNames: string[] = [];

  if (shouldUseSemanticSearch) {
    semanticCandidateNames = await fetchSemanticCandidateNames({
      searchTerm,
      supabaseAdmin,
    });

    if (semanticCandidateNames.length === 0) {
      return NextResponse.json({
        subreddits: [],
        totalCount: 0,
        page: currentPage,
        pageSize,
      });
    }
  }

  let query = supabaseAdmin
    .from("subreddits")
    .select("name,self_promotion,self_promotion_detail,members_count", {
      count: "exact",
    });

  if (shouldUseSemanticSearch) {
    query = query.in("name", semanticCandidateNames);
  }

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

  const { data, error, count } = await query
    .order(sortField === "members" ? "members_count" : "name", {
      ascending: sortDirection === "asc",
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

async function fetchSemanticCandidateNames({
  searchTerm,
  supabaseAdmin,
}: SemanticCandidateArgs): Promise<string[]> {
  const geminiClient = createGeminiClient();
  const response = await geminiClient.models.embedContent({
    model: "gemini-embedding-001",
    contents: searchTerm,
    config: {
      taskType: "RETRIEVAL_QUERY",
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

  return Array.from(
    new Set(
      (data ?? [])
        .filter((row): row is Tables<"subreddits"> => Boolean(row?.name))
        .map((row) => row.name),
    ),
  );
}
