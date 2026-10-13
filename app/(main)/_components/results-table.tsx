"use client";

import { SortByDown02Icon, SortByUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Enums } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;

export type SubredditResult = {
  name: string;
  self_promotion: SelfPromotionStatus;
  self_promotion_detail: string;
  members_count: number;
};

export type SortField = "name" | "members";
export type SortDirection = "asc" | "desc";
export type SortState = { field: SortField; direction: SortDirection } | null;

type ResultsTableProps = {
  isLoading: boolean;
  errorMessage: string | null;
  totalCount: number;
  displayedResults: SubredditResult[];
  formatSelfPromotion: (status: SelfPromotionStatus) => string;
  formatMembersCount: (count: number) => string;
  sortState: SortState;
  onSortToggle: (field: SortField) => void;
  isSortLoading: boolean;
};

export function ResultsTable({
  isLoading,
  errorMessage,
  totalCount,
  displayedResults,
  formatSelfPromotion,
  formatMembersCount,
  sortState,
  onSortToggle,
  isSortLoading,
}: ResultsTableProps) {
  const showLoadingMessage = isLoading && !isSortLoading;

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
      ? `Sort by ${field} ${sortState.direction === "asc" ? "ascending" : "descending"}`
      : `Sort by ${field}`;

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
      <div className="flex justify-between items-center border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {showLoadingMessage ? (
            <Spinner />
          ) : (
            `${totalCount.toLocaleString()} subreddit${totalCount === 1 ? "" : "s"} found`
          )}
        </p>
      </div>
      {errorMessage ? (
        <div className="px-4 py-8 text-sm text-destructive">{errorMessage}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="text-muted-foreground">
                {renderSortableHeader("Name", "name")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {renderSortableHeader("Members", "members")}
              </TableHead>
              <TableHead className="text-muted-foreground">Promotion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedResults.length === 0 && !isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-muted-foreground"
                >
                  No subreddits found. Try a different search.
                </TableCell>
              </TableRow>
            ) : (
              displayedResults.map((subreddit) => (
                <TableRow key={subreddit.name}>
                  <TableCell className="font-medium w-48">
                    <Link
                      href={`https://www.reddit.com/r/${subreddit.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline underline-offset-4"
                    >
                      r/{subreddit.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {formatMembersCount(subreddit.members_count)}
                  </TableCell>
                  <TableCell>
                    {formatSelfPromotion(subreddit.self_promotion)}
                    {(subreddit.self_promotion === "allowed_limited" ||
                      subreddit.self_promotion === "allowed_full") && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {subreddit.self_promotion_detail}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
