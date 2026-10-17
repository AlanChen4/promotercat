"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GripVertical } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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
  SubredditResult,
} from "@/lib/schemas/subreddits";
import { AccountMenu } from "./account-menu";
import { ForAgents } from "./for-agents";
import { GitHubStars } from "./github-stars";
import { SignInOptions } from "./sign-in-options";

const MotionTableRow = motion.create(TableRow);
const MotionLink = motion.create(Link);
function ResultRow({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <MotionTableRow
      className="group h-10"
      initial="collapsed"
      animate={focused ? "expanded" : "collapsed"}
      whileHover="expanded"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      {children}
    </MotionTableRow>
  );
}

function PromotionText({
  status,
  detail,
}: {
  status: string;
  detail: string | null;
}) {
  return (
    <motion.div
      className="relative overflow-hidden leading-5"
      variants={{ collapsed: { height: 20 }, expanded: { height: "auto" } }}
    >
      <div className="whitespace-normal break-words">
        {status}
        {detail ? (
          <span className="ml-2 text-muted-foreground">{detail}</span>
        ) : null}
      </div>
      {detail ? (
        <motion.span
          aria-hidden="true"
          variants={{ collapsed: { opacity: 1 }, expanded: { opacity: 0 } }}
          className="pointer-events-none absolute right-0 top-0 h-5 w-5 bg-linear-to-r from-transparent to-card"
        />
      ) : null}
    </motion.div>
  );
}

function LoadingBar({ className }: { className: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={`h-4 rounded bg-muted ${className}`}
      animate={{ opacity: reduceMotion ? 1 : [1, 0.45, 1] }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
      }
    />
  );
}

type ResultsTableProps = {
  returnTo: string;
  filters: ReactNode;
  pagination: ReactNode;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  totalCount: number;
  displayedResults: SubredditResult[];
  isLocked: boolean;
  formatSelfPromotion: (status: SelfPromotionStatus) => string;
  formatActivityCount: (count: number | null) => string;
};

export function ResultsTable({
  returnTo,
  filters,
  pagination,
  searchInput,
  onSearchInputChange,
  isLoading,
  errorMessage,
  totalCount,
  displayedResults,
  isLocked,
  formatSelfPromotion,
  formatActivityCount,
}: ResultsTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const resetPosition = () => {
      dragRef.current = null;
      setIsDragging(false);
      setPosition({ x: 0, y: 0 });
    };
    window.addEventListener("resize", resetPosition);
    return () => window.removeEventListener("resize", resetPosition);
  }, []);

  const getMovementBounds = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      minX: position.x - rect.left,
      maxX:
        position.x + Math.max(0, window.innerWidth - rect.width) - rect.left,
      minY: position.y - rect.top,
      maxY:
        position.y + Math.max(0, window.innerHeight - rect.height) - rect.top,
    };
  };

  const paddingRows = Array.from(
    { length: Math.max(0, 10 - displayedResults.length) },
    (_, offset) => `padding-row-${offset}`,
  );
  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border bg-card w-full max-w-3xl"
      aria-busy={isLoading}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div className="flex h-11 items-center gap-3 border-b px-4">
        <div className="relative min-w-0 flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="subreddit-search"
            aria-label="Search subreddits"
            placeholder={
              'Describe what you\'re building (e.g. "AI calorie tracker app")'
            }
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            className="border-0 bg-transparent pl-6 shadow-none text-sm focus-visible:border-transparent focus-visible:ring-0"
          />
        </div>
        {searchInput.trim() ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Clear search"
              title="Clear search"
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => onSearchInputChange("")}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                className="size-4"
                aria-hidden="true"
              />
            </button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isLoading ? (
                <Spinner />
              ) : isLocked ? null : (
                `${totalCount.toLocaleString()} found`
              )}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          aria-label="Move results table"
          title="Drag to move"
          className={`hidden md:inline-flex shrink-0 touch-none select-none rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={(event) => {
            if (
              !event.isPrimary ||
              event.button !== 0 ||
              event.pointerType === "touch" ||
              !window.matchMedia("(min-width: 768px)").matches
            )
              return;
            const bounds = getMovementBounds();
            if (!bounds) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              pointerId: event.pointerId,
              clientX: event.clientX,
              clientY: event.clientY,
              ...position,
              ...bounds,
            };
            setIsDragging(true);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            setPosition({
              x: Math.max(
                drag.minX,
                Math.min(drag.maxX, drag.x + event.clientX - drag.clientX),
              ),
              y: Math.max(
                drag.minY,
                Math.min(drag.maxY, drag.y + event.clientY - drag.clientY),
              ),
            });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
            setIsDragging(false);
          }}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">{filters}</div>
        <ForAgents />
      </div>
      {isLoading ? <output className="sr-only">Loading results</output> : null}
      {errorMessage && !isLoading && !isLocked ? (
        <div className="flex h-[27.5rem] items-center px-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <div className="relative min-h-[27.5rem]">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[30%] sm:w-48" />
              <col className="w-36" />
              <col />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">
                  Weekly active
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Promotion
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLocked ? (
                Array.from(
                  { length: 10 },
                  (_, index) => `locked-row-${index}`,
                ).map((key) => (
                  <TableRow
                    key={key}
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
                        Weekly promotion thread
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : isLoading ? (
                Array.from(
                  { length: 10 },
                  (_, index) => `loading-row-${index}`,
                ).map((key) => (
                  <TableRow
                    key={key}
                    className="h-10 pointer-events-none"
                    aria-hidden="true"
                  >
                    <TableCell>
                      <LoadingBar className="w-3/4" />
                    </TableCell>
                    <TableCell>
                      <LoadingBar className="w-16" />
                    </TableCell>
                    <TableCell>
                      <LoadingBar className="w-5/6" />
                    </TableCell>
                  </TableRow>
                ))
              ) : displayedResults.length === 0 && !isLoading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={3}
                    className="h-[25rem] text-center text-muted-foreground"
                  >
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HugeiconsIcon icon={Alert02Icon} />
                        </EmptyMedia>
                        <EmptyTitle>No matches this time</EmptyTitle>
                        <EmptyDescription>
                          Try different keywords or filters.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                displayedResults.map((subreddit) => (
                  <ResultRow key={subreddit.name}>
                    <TableCell className="font-medium">
                      <MotionLink
                        whileHover={{ color: "var(--primary)" }}
                        whileFocus={{ color: "var(--primary)" }}
                        href={`https://www.reddit.com/r/${subreddit.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate"
                        title={`r/${subreddit.name}`}
                      >
                        r/{subreddit.name}
                      </MotionLink>
                    </TableCell>
                    <TableCell>
                      {formatActivityCount(subreddit.weekly_active_users)}
                    </TableCell>
                    <TableCell>
                      <PromotionText
                        status={formatSelfPromotion(subreddit.self_promotion)}
                        detail={subreddit.self_promotion_detail}
                      />
                    </TableCell>
                  </ResultRow>
                ))
              )}
              {!isLocked && !isLoading && displayedResults.length > 0
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
          {isLocked ? (
            <div className="pointer-events-none absolute inset-x-0 top-10 bottom-0 flex items-center justify-center">
              <div className="flex w-full justify-center bg-muted/95 py-4">
                <div className="pointer-events-auto w-full max-w-xs px-4">
                  <SignInOptions returnTo={returnTo} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div className="flex h-11 items-center gap-2 rounded-b-xl border-t bg-muted/30 px-2 sm:px-4">
        <AccountMenu />
        <div className="min-w-0 flex-1 overflow-x-auto">{pagination}</div>
        <GitHubStars />
      </div>
    </div>
  );
}
