"use client";

import {
  SortByDown02Icon,
  SortByUp02Icon,
  SquareLock01Icon,
  TickDouble03FreeIcons,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Fragment } from "react";
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
import { UpgradeModal } from "@/components/upgrade-modal";
import { useAuth } from "@/providers/auth-provider";
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
  const { isAuthenticated, isPremium, isPremiumLoading } = useAuth();
  const showLoadingMessage = isLoading && !isSortLoading;
  const shouldShowPlaceholderCta =
    placeholderRows.length > 0 && !isPremium && !isPremiumLoading;
  const placeholderCtaIndex =
    placeholderRows.length > 0
      ? Math.floor((placeholderRows.length - 1) / 2)
      : 0;

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

  const renderPlaceholderCta = () => {
    if (!shouldShowPlaceholderCta) {
      return null;
    }

    return (
      <TableRow key="placeholder-cta">
        <TableCell colSpan={3} className="bg-muted py-4">
          <div className="relative overflow-hidden">
            <div className="relative flex md:justify-center items-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {!isAuthenticated ? (
                  <Button asChild variant="outline">
                    <Link href="/auth">
                      Log in or Sign Up{" "}
                      <span className="text-muted-foreground">— it's free</span>
                    </Link>
                  </Button>
                ) : null}
                {!isPremium && !isPremiumLoading && isAuthenticated ? (
                  <UpgradeModal
                    source="search_placeholder"
                    trigger={
                      <Button>
                        <HugeiconsIcon
                          icon={SquareLock01Icon}
                          className="size-4"
                        />
                        Upgrade{" "}
                        <span className="text-primary-foreground/80">
                          — Money Back Guarantee
                        </span>
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </TableCell>
      </TableRow>
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
              <TableHead className="text-muted-foreground">Promotion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedResults.length === 0 && !isLoading && !isLockedPage ? (
              <TableRow>
                <TableCell
                  colSpan={3}
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
                      {(subreddit.self_promotion === "allowed_limited" ||
                        subreddit.self_promotion === "allowed_full") && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {subreddit.self_promotion_detail}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {placeholderRows.map((placeholderKey, index) => {
                  const placeholder =
                    placeholderSubreddits[
                      (page + index) % placeholderSubreddits.length
                    ];
                  const showPlaceholderCta =
                    shouldShowPlaceholderCta && index === placeholderCtaIndex;

                  return (
                    <Fragment key={placeholderKey}>
                      <TableRow
                        className="pointer-events-none select-none"
                        style={{ filter: "blur(4px)" }}
                        aria-hidden="true"
                      >
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
                      </TableRow>
                      {showPlaceholderCta ? renderPlaceholderCta() : null}
                    </Fragment>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
