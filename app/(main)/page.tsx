"use client";

import { useEffect, useMemo, useState } from "react";
import { ACTIVITY_THRESHOLD_OPTIONS } from "@/constants/subreddit-filters";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import type { Enums } from "@/types/database.types";
import { Filters } from "./_components/filters";
import { SubredditsPagination } from "./_components/pagination";
import type {
  SortField,
  SortState,
  SubredditResult,
} from "./_components/results-table";
import { ResultsTable } from "./_components/results-table";
import { SearchSuggestions } from "./_components/search-suggestions";

type SelfPromotionStatus = Enums<"self_promotion_status">;

type SubredditResponse = {
  subreddits: SubredditResult[];
  totalCount: number;
  page: number;
  pageSize: number;
};

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

const ACTIVITY_FILTER_ANY_VALUE = "any";
const DEFAULT_SORT_STATE: SortState = null;

const SEARCH_DEBOUNCE_MS = 300;
const ROWS_PER_PAGE = 10;
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [minimumActivity, setMinimumActivity] = useState<number | null>(null);
  const [maximumActivity, setMaximumActivity] = useState<number | null>(null);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);
  const [isSortLoading, setIsSortLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmedSearch = searchInput.trim();
      setSearchTerm((previous) => {
        if (previous === trimmedSearch) {
          return previous;
        }
        setPage(1);
        return trimmedSearch;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
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
      if (minimumActivity !== null) {
        query.set("min_weekly_active", String(minimumActivity));
      }
      if (maximumActivity !== null) {
        query.set("max_weekly_active", String(maximumActivity));
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
  }, [
    searchTerm,
    selectedSelfPromotion,
    page,
    isLockedPage,
    minimumActivity,
    maximumActivity,
    sortState,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
  }, [totalCount]);

  const isMinimumOpenEnded = useMemo(() => {
    if (minimumActivity === null) {
      return false;
    }
    return ACTIVITY_THRESHOLD_OPTIONS.some(
      (option) => option.value === minimumActivity && option.isOpenEnded,
    );
  }, [minimumActivity]);

  const maximumActivityOptions = useMemo(() => {
    const cappedOptions = ACTIVITY_THRESHOLD_OPTIONS.filter(
      (option) => !option.isOpenEnded,
    );
    if (minimumActivity === null) {
      return cappedOptions;
    }
    if (isMinimumOpenEnded) {
      return [];
    }
    return cappedOptions.filter((option) => option.value >= minimumActivity);
  }, [minimumActivity, isMinimumOpenEnded]);

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

  const handleMinimumActivityChange = (value: string) => {
    const nextValue =
      value === ACTIVITY_FILTER_ANY_VALUE ? null : Number(value);
    const isOpenEndedSelection = ACTIVITY_THRESHOLD_OPTIONS.some(
      (option) => option.value === nextValue && option.isOpenEnded,
    );
    setMinimumActivity((previous) => {
      if (previous === nextValue) {
        return previous;
      }
      setPage(1);
      return nextValue;
    });
    setMaximumActivity((previousMax) => {
      if (isOpenEndedSelection) {
        return previousMax === null ? previousMax : null;
      }
      if (
        nextValue === null ||
        previousMax === null ||
        previousMax >= nextValue
      ) {
        return previousMax;
      }
      return null;
    });
  };

  const handleMaximumActivityChange = (value: string) => {
    const nextValue =
      value === ACTIVITY_FILTER_ANY_VALUE ? null : Number(value);
    setMaximumActivity((previous) => {
      if (previous === nextValue) {
        return previous;
      }
      setPage(1);
      return nextValue;
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
    setSearchTerm((previous) => {
      if (previous === trimmedQuery) {
        return previous;
      }
      setPage(1);
      return trimmedQuery;
    });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 p-4">
      <Filters
        searchInput={searchInput}
        selectedSelfPromotion={selectedSelfPromotion}
        selfPromotionOptions={SELF_PROMOTION_OPTIONS}
        minimumActivity={minimumActivity}
        maximumActivity={maximumActivity}
        isMinimumOpenEnded={isMinimumOpenEnded}
        maximumActivityOptions={maximumActivityOptions}
        activityThresholdOptions={ACTIVITY_THRESHOLD_OPTIONS}
        activityFilterAnyValue={ACTIVITY_FILTER_ANY_VALUE}
        onSearchInputChange={setSearchInput}
        onSelfPromotionChange={handleFilterChange}
        onMinimumActivityChange={handleMinimumActivityChange}
        onMaximumActivityChange={handleMaximumActivityChange}
      />

      <SearchSuggestions
        suggestions={SEARCH_SUGGESTIONS}
        onSelect={handleSuggestionSelect}
      />

      <ResultsTable
        isLoading={isLoading}
        errorMessage={errorMessage}
        totalCount={totalCount}
        displayedResults={isLockedPage ? [] : results}
        lockedRowCount={
          isLockedPage
            ? Math.min(
                ROWS_PER_PAGE,
                Math.max(0, totalCount - (page - 1) * ROWS_PER_PAGE),
              )
            : 0
        }
        formatSelfPromotion={formatSelfPromotion}
        formatActivityCount={formatActivityCount}
        sortState={sortState}
        onSortToggle={handleSortToggle}
        isSortLoading={isSortLoading}
      />

      <SubredditsPagination
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
