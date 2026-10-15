"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import {
  RESULTS_PER_PAGE,
  type SelfPromotionStatus,
  type SortField,
  type SortState,
  type SubredditResponse,
  type SubredditResult,
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

const DEFAULT_SORT_STATE: SortState = null;

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

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSelfPromotion, setSelectedSelfPromotion] = useState<
    SelfPromotionStatus[]
  >(DEFAULT_SELF_PROMOTION_SELECTION);
  const [page, setPage] = useState(1);
  const isLockedPage = page > 1 && !isAuthenticated;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);
  const [isSortLoading, setIsSortLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmedSearch = searchInput.trim();
      if (searchTerm !== trimmedSearch) {
        setIsLoading(Boolean(trimmedSearch));
        setErrorMessage(null);
        setPage(1);
        setSearchTerm(trimmedSearch);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput, searchTerm]);

  useEffect(() => {
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
      if (isLockedPage) {
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
      query.set("page", String(page));

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

        setResults(data.subreddits ?? []);
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
  }, [searchTerm, selectedSelfPromotion, page, isLockedPage, sortState]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / RESULTS_PER_PAGE));
  }, [totalCount]);

  const formatSelfPromotion = (status: SelfPromotionStatus) =>
    SELF_PROMOTION_LABELS[status];

  const formatActivityCount = (count: number | null): string => {
    if (count === null) return "Unknown";
    if (count >= 1_000_000) {
      const millions = count / 1_000_000;
      return `${millions.toFixed(0)}M`;
    }
    if (count >= 1_000) {
      const thousands = count / 1_000;
      return `${thousands.toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleFilterChange = (value: SelfPromotionStatus, checked: boolean) => {
    setSelectedSelfPromotion((previous) => {
      let nextSelection = previous;

      if (checked && !previous.includes(value)) {
        nextSelection = [...previous, value];
      }

      if (!checked && previous.includes(value)) {
        nextSelection = previous.filter((item) => item !== value);
      }

      if (nextSelection !== previous) {
        setPage(1);
      }

      return nextSelection;
    });
  };

  const handleSortToggle = (field: SortField) => {
    setIsSortLoading(true);
    setSortState((previous) => {
      let nextState: SortState;
      if (!previous || previous.field !== field) {
        nextState = { field, direction: "desc" };
      } else if (previous.direction === "desc") {
        nextState = { field, direction: "asc" };
      } else {
        nextState = null;
      }

      if (
        (previous?.field ?? null) !== (nextState?.field ?? null) ||
        (previous?.direction ?? null) !== (nextState?.direction ?? null)
      ) {
        setPage(1);
      }

      return nextState;
    });
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const handleSuggestionSelect = (query: string) => {
    setSearchInput(query);
    const trimmedQuery = query.trim();
    if (searchTerm !== trimmedQuery) {
      setIsLoading(Boolean(trimmedQuery));
      setErrorMessage(null);
      setPage(1);
      setSearchTerm(trimmedQuery);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 p-4">
      <div className="flex w-full items-center justify-end">
        <AccountMenu />
      </div>

      <ResultsTable
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
