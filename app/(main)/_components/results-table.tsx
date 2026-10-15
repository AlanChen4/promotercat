"use client";

import { SortByDown02Icon, SortByUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  SelfPromotionStatus,
  SortField,
  SortState,
  SubredditResult,
} from "@/lib/subreddits";

type ResultsTableProps = {
  isLoading: boolean;
  errorMessage: string | null;
  totalCount: number;
  displayedResults: SubredditResult[];
  lockedRowCount: number;
  formatSelfPromotion: (status: SelfPromotionStatus) => string;
  formatActivityCount: (count: number | null) => string;
  sortState: SortState;
  onSortToggle: (field: SortField) => void;
  isSortLoading: boolean;
};

export function ResultsTable({
  isLoading,
  errorMessage,
  totalCount,
  displayedResults,
  lockedRowCount,
  formatSelfPromotion,
  formatActivityCount,
  sortState,
  onSortToggle,
  isSortLoading,
}: ResultsTableProps) {
  const showLoadingMessage = isLoading && !isSortLoading;
  const placeholderRows = Array.from(
    { length: lockedRowCount },
    (_, offset) => `locked-row-${offset}`,
  );
  const paddingRows = Array.from(
    { length: Math.max(0, 10 - (lockedRowCount || displayedResults.length)) },
    (_, offset) => `padding-row-${offset}`,
  );

  const getSortIcon = (field: SortField) => {
    if (sortState?.field !== field) {
      return SortByDown02Icon;
    }
    return sortState.direction === "asc" ? SortByUp02Icon : SortByDown02Icon;
  };

  const renderSortableHeader = (label: string, field: SortField) => {
    const Icon = getSortIcon(field);
    const isActive = sortState?.field === field;
    const sortLabel = isActive
      ? `Sort by ${label.toLowerCase()} ${sortState.direction === "asc" ? "ascending" : "descending"}`
      : `Sort by ${label.toLowerCase()}`;

    return (
      <button
        type="button"
        onClick={() => onSortToggle(field)}
        aria-pressed={isActive}
        aria-label={sortLabel}
        className="flex cursor-pointer items-center gap-2 rounded p-1"
      >
        <span>{label}</span>
        <HugeiconsIcon icon={Icon} className="size-4" />
      </button>
    );
  };

  return (
    <div className="rounded-xl border bg-card w-full max-w-4xl">
      <div className="flex h-11 justify-between items-center border-b px-4">
        <p className="text-sm text-muted-foreground">
          {showLoadingMessage ? (
            <Spinner />
          ) : (
            `${totalCount.toLocaleString()} subreddit${totalCount === 1 ? "" : "s"} found`
          )}
        </p>
      </div>
      {errorMessage ? (
        <div className="flex h-[27.5rem] items-center px-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <div className="relative h-[27.5rem]">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[30%] sm:w-48" />
              <col className="w-36" />
              <col />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="text-muted-foreground">
                  {renderSortableHeader("Name", "name")}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  {renderSortableHeader("Weekly active", "weekly_active")}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Promotion
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lockedRowCount > 0 ? (
                placeholderRows.map((placeholderKey) => (
                  <TableRow
                    key={placeholderKey}
                    className="h-10 pointer-events-none select-none blur-[4px]"
                    aria-hidden="true"
                  >
                    <TableCell className="font-medium truncate">
                      r/community
                    </TableCell>
                    <TableCell>128K</TableCell>
                    <TableCell className="truncate">
                      Limited{" "}
                      <span className="text-muted-foreground">
                        — Weekly promotion thread
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : displayedResults.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-[25rem] text-center text-muted-foreground"
                  >
                    No subreddits found. Try a different search.
                  </TableCell>
                </TableRow>
              ) : (
                displayedResults.map((subreddit) => (
                  <TableRow key={subreddit.name} className="h-10">
                    <TableCell className="font-medium">
                      <Link
                        href={`https://www.reddit.com/r/${subreddit.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate hover:underline underline-offset-4"
                        title={`r/${subreddit.name}`}
                      >
                        r/{subreddit.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatActivityCount(subreddit.weekly_active_users)}
                    </TableCell>
                    <TableCell>
                      <div
                        className="truncate"
                        title={
                          subreddit.self_promotion_detail
                            ? `${formatSelfPromotion(subreddit.self_promotion)} — ${subreddit.self_promotion_detail}`
                            : formatSelfPromotion(subreddit.self_promotion)
                        }
                      >
                        {formatSelfPromotion(subreddit.self_promotion)}
                        {subreddit.self_promotion_detail ? (
                          <span className="text-muted-foreground">
                            {" "}
                            — {subreddit.self_promotion_detail}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {lockedRowCount > 0 || displayedResults.length > 0 || isLoading
                ? paddingRows.map((paddingKey) => (
                    <TableRow
                      key={paddingKey}
                      aria-hidden="true"
                      className="h-10 pointer-events-none border-0 hover:bg-transparent"
                    >
                      <TableCell colSpan={3} className="p-0" />
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
          {lockedRowCount > 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-10 bottom-0 flex items-center justify-center">
              <div className="flex w-full justify-center bg-muted/95 py-4">
                <Button
                  asChild
                  variant="outline"
                  className="pointer-events-auto"
                >
                  <Link href="/auth">
                    Log in or Sign Up{" "}
                    <span className="text-muted-foreground">— it's free</span>
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
