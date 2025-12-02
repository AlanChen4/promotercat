import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;
type SubredditRow = Pick<
  Tables<"subreddits">,
  "name" | "self_promotion" | "self_promotion_detail" | "members_count"
>;

const RESULTS_PER_PAGE = 10;
const FREE_RESULT_LIMIT = 3;

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search")?.trim() ?? "";
  const selfPromotionFilters = extractSelfPromotionFilters(
    url.searchParams.get("self_promotion"),
  );
  const requestedPage = parsePage(url.searchParams.get("page"));
  const minMembers = parseMemberBoundary(url.searchParams.get("min_members"));
  const maxMembers = parseMemberBoundary(url.searchParams.get("max_members"));

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

  let query = supabaseAdmin
    .from("subreddits")
    .select("name,self_promotion,self_promotion_detail,members_count", {
      count: "exact",
    })
    .order("name");

  if (searchTerm) {
    query = query.ilike("name", `%${searchTerm}%`);
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

  const { data, error, count } = await query.range(rangeStart, rangeEnd);

  if (error) {
    return NextResponse.json(
      { message: "Failed to load subreddits." },
      { status: 500 },
    );
  }
  const subreddits: SubredditRow[] = data ?? [];

  return NextResponse.json({
    subreddits,
    totalCount: count ?? 0,
    page: currentPage,
    pageSize,
  });
}
