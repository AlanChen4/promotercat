"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  RESULTS_PER_PAGE,
  type SelfPromotionStatus,
  type SortField,
  type SortState,
  type SubredditResponse,
  type SubredditResult,
  selfPromotionSchema,
  sortDirectionSchema,
  sortFieldSchema,
} from "@/lib/subreddits";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Filters } from "./_components/filters";
import { SubredditsPagination } from "./_components/pagination";
import { ResultsTable } from "./_components/results-table";

const SELF_PROMOTION_OPTIONS: {
  label: string;
  value: SelfPromotionStatus;
}[] = [
  { label: "Yes", value: "allowed_full" },
  { label: "Limited", value: "allowed_limited" },
  { label: "Not Specified", value: "unspecified" },
  { label: "No", value: "not_allowed" },
];

const SELF_PROMOTION_LABELS: Record<SelfPromotionStatus, string> =
  SELF_PROMOTION_OPTIONS.reduce(
    (record, option) => {
      record[option.value] = option.label;
      return record;
    },
    {} as Record<SelfPromotionStatus, string>,
  );

const DEFAULT_SELF_PROMOTION_SELECTION: SelfPromotionStatus[] = [
  "allowed_full",
  "allowed_limited",
  "unspecified",
];

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_SUGGESTIONS = [
  {
    label: "Game Development",
    emoji: "🕹️",
    query: "gaming, game development, indie games",
  },
  {
    label: "AI & SaaS",
    emoji: "🧠",
    query: "ai tools, saas, machine learning, automation",
  },
  {
    label: "Startups",
    emoji: "🚀",
    query: "startups, founders, entrepreneurship",
  },
  {
    label: "Fitness",
    emoji: "💪",
    query: "fitness, exercise, strength training, workouts",
  },
  {
    label: "Marketing",
    emoji: "📣",
    query: "marketing, digital marketing, advertising, content marketing",
  },
];

function updateSearchParams(
  updates: Record<string, string | null>,
  replace = false,
) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history[replace ? "replaceState" : "pushState"](
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const { isAuthenticated, isAuthenticatedLoading } = useAuth();
  const params = useSearchParams();
  const searchTerm = params.get("search")?.trim() ?? "";
  const [searchInput, setSearchInput] = useState(searchTerm);
  const selectedSelfPromotion = useMemo(() => {
    const raw = params.get("self_promotion");
    if (raw === null) return DEFAULT_SELF_PROMOTION_SELECTION;
    const selection = [
      ...new Set(
        raw.split(",").flatMap((value) => {
          const parsed = selfPromotionSchema.safeParse(value);
          return parsed.success ? [parsed.data] : [];
        }),
      ),
    ];
    return selection.length ? selection : DEFAULT_SELF_PROMOTION_SELECTION;
  }, [params]);
  const page = z.coerce
    .number()
    .int()
    .positive()
    .catch(1)
    .parse(params.get("page") ?? 1);
  const sortState = useMemo<SortState>(() => {
    const field = sortFieldSchema.safeParse(params.get("sort"));
    const direction = sortDirectionSchema.safeParse(
      params.get("sort_direction"),
    );
    return field.success && direction.success
      ? { field: field.data, direction: direction.data }
      : null;
  }, [params]);
  const isLockedPage = page > 1 && !isAuthenticated;
  const [isLoading, setIsLoading] = useState(Boolean(searchTerm));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isSortLoading, setIsSortLoading] = useState(false);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmedSearch = searchInput.trim();
      if (searchTerm !== trimmedSearch) {
        updateSearchParams({ search: trimmedSearch || null, page: null }, true);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [searchInput, searchTerm]);

  useEffect(() => {
    if (isAuthenticatedLoading) return;
    const abortController = new AbortController();

    const fetchData = async () => {
      if (!searchTerm) {
        setResults([]);
        setTotalCount(0);
        setIsLoading(false);
        setIsSortLoading(false);
        setErrorMessage(null);
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);

      const query = new URLSearchParams();
      if (searchTerm) {
        query.set("search", searchTerm);
      }
      if (selectedSelfPromotion.length > 0) {
        query.set("self_promotion", selectedSelfPromotion.join(","));
      }
      if (sortState) {
        query.set("sort", sortState.field);
        query.set("sort_direction", sortState.direction);
      }
      query.set("page", String(isLockedPage ? 1 : page));

      try {
        const response = await fetch(`/subreddits?${query.toString()}`, {
          signal: abortController.signal,
          credentials: "include",
        });

        if (abortController.signal.aborted) {
          return;
        }

        if (response.status === 401) {
          await createClient().auth.signOut({ scope: "local" });
          setResults([]);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load subreddits.");
        }

        const data = (await response.json()) as SubredditResponse;

        if (abortController.signal.aborted) {
          return;
        }

        setResults(isLockedPage ? [] : (data.subreddits ?? []));
        setTotalCount(data.totalCount ?? 0);
      } catch {
        if (abortController.signal.aborted) {
          return;
        }
        setErrorMessage("Failed to load subreddits. Please try again.");
        setResults([]);
        setTotalCount(0);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          setIsSortLoading(false);
        }
      }
    };

    fetchData();

    return () => abortController.abort();
  }, [
    searchTerm,
    selectedSelfPromotion,
    page,
    isLockedPage,
    sortState,
    isAuthenticatedLoading,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / RESULTS_PER_PAGE));
  }, [totalCount]);

  const formatSelfPromotion = (status: SelfPromotionStatus) =>
    SELF_PROMOTION_LABELS[status];

  const formatActivityCount = (count: number | null): string => {
    if (count === null) return "Unknown";
    if (count >= 1_000_000) {
      const millions = count / 1_000_000;
      return `${millions.toFixed(1)}M`;
    }
    if (count >= 1_000) {
      const thousands = count / 1_000;
      return `${thousands.toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleFilterChange = (value: SelfPromotionStatus, checked: boolean) => {
    const selection = checked
      ? [...new Set([...selectedSelfPromotion, value])]
      : selectedSelfPromotion.filter((item) => item !== value);
    if (selection.length === 0) return;
    updateSearchParams({ self_promotion: selection.join(","), page: null });
  };

  const handleSortToggle = (field: SortField) => {
    setIsSortLoading(true);
    const next: SortState =
      sortState?.field !== field
        ? { field, direction: "desc" }
        : sortState.direction === "desc"
          ? { field, direction: "asc" }
          : null;
    updateSearchParams({
      sort: next?.field ?? null,
      sort_direction: next?.direction ?? null,
      page: null,
    });
  };

  const handlePageChange = (nextPage: number) => {
    updateSearchParams({ page: nextPage === 1 ? null : String(nextPage) });
  };

  const handleSuggestionSelect = (query: string) => {
    setSearchInput(query);
    updateSearchParams({ search: query, page: null });
  };

  const returnTo = params.toString() ? `/?${params.toString()}` : "/";

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 p-4">
      <ResultsTable
        returnTo={returnTo}
        filters={
          <Filters
            selectedSelfPromotion={selectedSelfPromotion}
            selfPromotionOptions={SELF_PROMOTION_OPTIONS}
            onSelfPromotionChange={handleFilterChange}
          />
        }
        suggestions={SEARCH_SUGGESTIONS}
        onSuggestionSelect={handleSuggestionSelect}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        isLoading={isLoading || searchInput.trim() !== searchTerm}
        errorMessage={errorMessage}
        totalCount={totalCount}
        displayedResults={isLockedPage ? [] : results}
        lockedRowCount={
          isLockedPage
            ? Math.min(
                RESULTS_PER_PAGE,
                Math.max(0, totalCount - (page - 1) * RESULTS_PER_PAGE),
              )
            : 0
        }
        formatSelfPromotion={formatSelfPromotion}
        formatActivityCount={formatActivityCount}
        sortState={sortState}
        onSortToggle={handleSortToggle}
        isSortLoading={isSortLoading}
        pagination={
          totalPages > 1 ? (
            <SubredditsPagination
              page={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          ) : null
        }
      />
    </div>
  );
}
