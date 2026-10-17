"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  parseSearchParams,
  RESULTS_PER_PAGE,
  type SelfPromotionStatus,
  type SubredditResponse,
  type SubredditResult,
} from "@/lib/schemas/subreddits";
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

const SEARCH_DEBOUNCE_MS = 300;

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
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[url('/japan.jpg')] bg-cover bg-center bg-no-repeat"
      />
      <Suspense>
        <SearchPage />
      </Suspense>
    </>
  );
}

function SearchPage() {
  const { isAuthenticated, isAuthenticatedLoading } = useAuth();
  const params = useSearchParams();
  const input = useMemo(() => parseSearchParams(params), [params]);
  const {
    search: searchTerm,
    self_promotion: selectedSelfPromotion,
    page,
  } = input;
  const [searchInput, setSearchInput] = useState(searchTerm);
  const isLockedPage = page > 1 && !isAuthenticated;
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    // Keep spaces in the draft when its normalized value matches the URL.
    setSearchInput((current) =>
      current.trim() === searchTerm ? current : searchTerm,
    );
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
      if (isLockedPage) {
        setResults([]);
        setIsLoading(false);
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

        setResults(data.subreddits);
        setLoadedPage(data.page);
        setTotalCount(data.totalCount);
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

  const handlePageChange = (nextPage: number) => {
    updateSearchParams({ page: nextPage === 1 ? null : String(nextPage) });
  };

  const returnTo = params.toString() ? `/?${params.toString()}` : "/";

  return (
    <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-2 p-4">
      <ResultsTable
        returnTo={returnTo}
        filters={
          <Filters
            selectedSelfPromotion={selectedSelfPromotion}
            selfPromotionOptions={SELF_PROMOTION_OPTIONS}
            onSelfPromotionChange={handleFilterChange}
          />
        }
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        isLoading={
          !isLockedPage &&
          (isLoading ||
            (!errorMessage && loadedPage !== page) ||
            searchInput.trim() !== searchTerm)
        }
        errorMessage={errorMessage}
        totalCount={totalCount}
        displayedResults={isLockedPage ? [] : results}
        isLocked={isLockedPage && !isAuthenticatedLoading}
        formatSelfPromotion={formatSelfPromotion}
        formatActivityCount={formatActivityCount}
        pagination={
          isLockedPage || totalPages > 1 ? (
            <SubredditsPagination
              page={page}
              totalPages={
                isLockedPage ? Math.max(page, totalPages) : totalPages
              }
              onPageChange={handlePageChange}
            />
          ) : null
        }
      />
    </div>
  );
}
