"use client";

import {
  SortByDown02Icon,
  SortByUp02Icon,
  SquareLock01Icon,
  TickDouble03FreeIcons,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
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

export type PlaceholderSubreddit = {
  name: string;
  selfPromotion: SelfPromotionStatus;
  selfPromotionDetail?: string;
  members: string;
};

export type SortField = "name" | "members";
export type SortDirection = "asc" | "desc";
export type SortState = { field: SortField; direction: SortDirection } | null;

type ResultsTableProps = {
  isLoading: boolean;
  errorMessage: string | null;
  totalCount: number;
  displayedResults: SubredditResult[];
  placeholderRows: string[];
  placeholderSubreddits: PlaceholderSubreddit[];
  page: number;
  isLockedPage: boolean;
  formatSelfPromotion: (status: SelfPromotionStatus) => string;
  formatMembersCount: (count: number) => string;
  canUseSorting: boolean;
  sortState: SortState;
  onSortToggle: (field: SortField) => void;
  isSortLoading: boolean;
};

export function ResultsTable({
  isLoading,
  errorMessage,
  totalCount,
  displayedResults,
  placeholderRows,
  placeholderSubreddits,
  page,
  isLockedPage,
  formatSelfPromotion,
  formatMembersCount,
  canUseSorting,
  sortState,
  onSortToggle,
  isSortLoading,
}: ResultsTableProps) {
  const showLoadingMessage = isLoading && !isSortLoading;

  const getSortIcon = (field: SortField) => {
    if (!canUseSorting) {
      return SquareLock01Icon;
    }
    if (sortState?.field !== field) {
      return SortByDown02Icon;
    }
    return sortState.direction === "asc" ? SortByUp02Icon : SortByDown02Icon;
  };

  const renderSortButton = (field: SortField) => {
    const Icon = getSortIcon(field);
    const isActive = sortState?.field === field;
    const label = isActive
      ? `Sort by ${field} ${
          sortState.direction === "asc" ? "ascending" : "descending"
        }`
      : `Sort by ${field}`;

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSortToggle(field);
        }}
        disabled={!canUseSorting}
        aria-pressed={isActive}
        aria-label={label}
        className={`rounded p-1 transition ${
          isActive
            ? "bg-muted text-primary"
            : "text-muted-foreground hover:bg-muted"
        } ${!canUseSorting ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {Icon ? <HugeiconsIcon icon={Icon} className="size-4" /> : null}
      </button>
    );
  };

  const renderSortableHeader = (label: string, field: SortField) => (
    // biome-ignore lint/a11y/useSemanticElements: Button can't be nested in a button
    <div
      role="button"
      className={`flex cursor-pointer items-center gap-2 ${
        !canUseSorting ? "cursor-not-allowed opacity-80" : ""
      }`}
      onClick={() => onSortToggle(field)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSortToggle(field);
        }
      }}
    >
      <span>{label}</span>
      {renderSortButton(field)}
    </div>
  );

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex justify-between items-center border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {showLoadingMessage
            ? "Loading results…"
            : `${totalCount} subreddit${totalCount === 1 ? "" : "s"} found`}
        </p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <HugeiconsIcon icon={TickDouble03FreeIcons} className="size-4" />
          Updated daily
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
              <TableHead className="text-muted-foreground">
                Self-Promotion
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedResults.length === 0 && !isLoading && !isLockedPage ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-10 text-center text-muted-foreground"
                >
                  No subreddits found. Try a different search.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {displayedResults.map((subreddit) => (
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
                      {subreddit.self_promotion === "allowed_limited" && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {subreddit.self_promotion_detail}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {placeholderRows.map((placeholderKey, index) => (
                  <TableRow
                    key={placeholderKey}
                    className="pointer-events-none select-none"
                    style={{ filter: "blur(4px)" }}
                    aria-hidden="true"
                  >
                    {(() => {
                      const placeholder =
                        placeholderSubreddits[
                          (page + index) % placeholderSubreddits.length
                        ];
                      return (
                        <>
                          <TableCell className="font-medium w-48">
                            r/{placeholder.name}
                          </TableCell>
                          <TableCell>{placeholder.members}</TableCell>
                          <TableCell>
                            {formatSelfPromotion(placeholder.selfPromotion)}
                            {placeholder.selfPromotion === "allowed_limited" &&
                            placeholder.selfPromotionDetail ? (
                              <span className="text-muted-foreground">
                                {" "}
                                — {placeholder.selfPromotionDetail}
                              </span>
                            ) : null}
                          </TableCell>
                        </>
                      );
                    })()}
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
