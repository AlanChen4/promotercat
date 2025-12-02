"use client";

import { TickDouble03FreeIcons } from "@hugeicons/core-free-icons";
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
}: ResultsTableProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex justify-between items-center border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {isLoading
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
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">
                Self-Promotion
              </TableHead>
              <TableHead className="text-muted-foreground">Members</TableHead>
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
                      {formatSelfPromotion(subreddit.self_promotion)}
                      {subreddit.self_promotion === "allowed_limited" && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {subreddit.self_promotion_detail}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatMembersCount(subreddit.members_count)}
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
                          <TableCell>{placeholder.members}</TableCell>
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
