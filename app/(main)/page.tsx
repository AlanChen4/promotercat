"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import type { Enums } from "@/types/database.types";
import type { MemberThresholdOption } from "./_components/filters";
import { Filters } from "./_components/filters";
import { SubredditsPagination } from "./_components/pagination";
import type {
  PlaceholderSubreddit,
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

const MEMBER_THRESHOLD_OPTIONS: MemberThresholdOption[] = [
  { label: "50k", value: 50_000 },
  { label: "100k", value: 100_000 },
  { label: "250k", value: 250_000 },
  { label: "500k", value: 500_000 },
  { label: "1M", value: 1_000_000 },
  { label: "5M", value: 5_000_000 },
  { label: "10M+", value: 10_000_000, isOpenEnded: true },
];

const MEMBERS_FILTER_ANY_VALUE = "any";
const DEFAULT_SORT_STATE: SortState = null;

const SEARCH_DEBOUNCE_MS = 300;
const ROWS_PER_PAGE = 10;
const PLACEHOLDER_SUBREDDITS: PlaceholderSubreddit[] = [
  {
    name: "growthstack",
    selfPromotion: "allowed_full" as SelfPromotionStatus,
    members: "128K",
  },
  {
    name: "founderfeedback",
    selfPromotion: "allowed_limited" as SelfPromotionStatus,
    selfPromotionDetail: "Weekly promo thread",
    members: "54.1K",
  },
  {
    name: "sideprojectshowcase",
    selfPromotion: "allowed_limited" as SelfPromotionStatus,
    selfPromotionDetail: "Text posts only",
    members: "212K",
  },
  {
    name: "saaslaunches",
    selfPromotion: "allowed_limited" as SelfPromotionStatus,
    selfPromotionDetail: "Signup posts only",
    members: "33.8K",
  },
  {
    name: "indiehackernews",
    selfPromotion: "allowed_limited" as SelfPromotionStatus,
    selfPromotionDetail: "Allowed on Sundays",
    members: "81.4K",
  },
  {
    name: "designcritique",
    selfPromotion: "allowed_full" as SelfPromotionStatus,
    members: "403K",
  },
  {
    name: "marketingcoop",
    selfPromotion: "not_allowed" as SelfPromotionStatus,
    members: "19.7K",
  },
  {
    name: "appstorelaunch",
    selfPromotion: "allowed_limited" as SelfPromotionStatus,
    selfPromotionDetail: "Demo + screenshots",
    members: "62.5K",
  },
];

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
  const {
    isPremium,
    isPremiumLoading,
    isAuthenticated,
    isAuthenticatedLoading,
  } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSelfPromotion, setSelectedSelfPromotion] = useState<
    SelfPromotionStatus[]
  >(DEFAULT_SELF_PROMOTION_SELECTION);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [minimumMembers, setMinimumMembers] = useState<number | null>(null);
  const [maximumMembers, setMaximumMembers] = useState<number | null>(null);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);
  const [isSortLoading, setIsSortLoading] = useState(false);

  const isLockedPage = !isPremium && !isPremiumLoading && page > 1;
  const canUseMembersFilter = isAuthenticated && !isAuthenticatedLoading;
  const canUseSorting = isAuthenticated && !isAuthenticatedLoading;

  useEffect(() => {
    if (canUseMembersFilter) {
      return;
    }
    setMinimumMembers(null);
    setMaximumMembers(null);
  }, [canUseMembersFilter]);

  useEffect(() => {
    if (!canUseSorting) {
      setSortState(DEFAULT_SORT_STATE);
      setIsSortLoading(false);
    }
  }, [canUseSorting]);

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
      if (canUseMembersFilter && minimumMembers !== null) {
        query.set("min_members", String(minimumMembers));
      }
      if (canUseMembersFilter && maximumMembers !== null) {
        query.set("max_members", String(maximumMembers));
      }
      if (sortState) {
        query.set("sort_by", sortState.field);
        query.set("sort_direction", sortState.direction);
      }
      query.set("page", String(!isPremium && !isPremiumLoading ? 1 : page));

      try {
        const response = await fetch(`/subreddits?${query.toString()}`, {
          signal: abortController.signal,
          credentials: "include",
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Failed to load subreddits.");
        }

        const data = (await response.json()) as SubredditResponse;

        if (abortController.signal.aborted) {
          return;
        }

        setResults(data.subreddits ?? []);
        setTotalCount(data.totalCount ?? 0);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name.toLowerCase() === "aborterror"
        ) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to load subreddits.";
        setErrorMessage(message);
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
    isPremium,
    isPremiumLoading,
    isLockedPage,
    minimumMembers,
    maximumMembers,
    canUseMembersFilter,
    sortState,
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
  }, [totalCount]);

  const expectedRowsOnCurrentPage = useMemo(() => {
    const rowsBeforePage = (page - 1) * ROWS_PER_PAGE;
    const rowsRemaining = Math.max(0, totalCount - rowsBeforePage);
    return Math.min(ROWS_PER_PAGE, rowsRemaining);
  }, [page, totalCount]);

  const placeholderRows = useMemo(() => {
    if (isPremium || isPremiumLoading) {
      return [] as string[];
    }
    const placeholderCount = isLockedPage
      ? expectedRowsOnCurrentPage
      : Math.max(0, expectedRowsOnCurrentPage - results.length);

    return Array.from(
      { length: placeholderCount },
      (_, offset) => `placeholder-${page}-${offset}`,
    );
  }, [
    expectedRowsOnCurrentPage,
    isLockedPage,
    isPremium,
    isPremiumLoading,
    page,
    results.length,
  ]);

  const isMinimumOpenEnded = useMemo(() => {
    if (minimumMembers === null) {
      return false;
    }
    return MEMBER_THRESHOLD_OPTIONS.some(
      (option) => option.value === minimumMembers && option.isOpenEnded,
    );
  }, [minimumMembers]);

  const maximumMembersOptions = useMemo(() => {
    const cappedOptions = MEMBER_THRESHOLD_OPTIONS.filter(
      (option) => !option.isOpenEnded,
    );
    if (minimumMembers === null) {
      return cappedOptions;
    }
    if (isMinimumOpenEnded) {
      return [];
    }
    return cappedOptions.filter((option) => option.value >= minimumMembers);
  }, [minimumMembers, isMinimumOpenEnded]);

  const displayedResults = isLockedPage ? [] : results;

  const formatSelfPromotion = (status: SelfPromotionStatus) =>
    SELF_PROMOTION_LABELS[status];

  const formatMembersCount = (count: number): string => {
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

  const paginationItems = useMemo(() => {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }, [totalPages]);

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

  const handleMinimumMembersChange = (value: string) => {
    const nextValue = value === MEMBERS_FILTER_ANY_VALUE ? null : Number(value);
    const isOpenEndedSelection = MEMBER_THRESHOLD_OPTIONS.some(
      (option) => option.value === nextValue && option.isOpenEnded,
    );
    setMinimumMembers((previous) => {
      if (previous === nextValue) {
        return previous;
      }
      setPage(1);
      return nextValue;
    });
    setMaximumMembers((previousMax) => {
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

  const handleMaximumMembersChange = (value: string) => {
    const nextValue = value === MEMBERS_FILTER_ANY_VALUE ? null : Number(value);
    setMaximumMembers((previous) => {
      if (previous === nextValue) {
        return previous;
      }
      setPage(1);
      return nextValue;
    });
  };

  const handleSortToggle = (field: SortField) => {
    if (!canUseSorting) {
      return;
    }
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
        canUseMembersFilter={canUseMembersFilter}
        minimumMembers={minimumMembers}
        maximumMembers={maximumMembers}
        isMinimumOpenEnded={isMinimumOpenEnded}
        maximumMembersOptions={maximumMembersOptions}
        memberThresholdOptions={MEMBER_THRESHOLD_OPTIONS}
        membersFilterAnyValue={MEMBERS_FILTER_ANY_VALUE}
        onSearchInputChange={setSearchInput}
        onSelfPromotionChange={handleFilterChange}
        onMinimumMembersChange={handleMinimumMembersChange}
        onMaximumMembersChange={handleMaximumMembersChange}
      />

      <SearchSuggestions
        suggestions={SEARCH_SUGGESTIONS}
        onSelect={handleSuggestionSelect}
      />

      <ResultsTable
        isLoading={isLoading}
        errorMessage={errorMessage}
        totalCount={totalCount}
        displayedResults={displayedResults}
        placeholderRows={placeholderRows}
        placeholderSubreddits={PLACEHOLDER_SUBREDDITS}
        page={page}
        isLockedPage={isLockedPage}
        formatSelfPromotion={formatSelfPromotion}
        formatMembersCount={formatMembersCount}
        canUseSorting={canUseSorting}
        sortState={sortState}
        onSortToggle={handleSortToggle}
        isSortLoading={isSortLoading}
      />

      <SubredditsPagination
        page={page}
        totalPages={totalPages}
        paginationItems={paginationItems}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
