"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  Search01Icon,
  SortByDown02Icon,
  SortByUp02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GripVertical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Empty,
  EmptyContent,
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
  SortField,
  SortState,
  SubredditResult,
} from "@/lib/schemas/subreddits";
import logo from "@/public/logo.png";
import { AccountMenu } from "./account-menu";
import { ForAgents } from "./for-agents";
import { GitHubStars } from "./github-stars";
import { type SearchSuggestion, SearchSuggestions } from "./search-suggestions";
import { SignInOptions } from "./sign-in-options";

function PromotionText({
  status,
  detail,
}: {
  status: string;
  detail: string | null;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const [fullHeight, setFullHeight] = useState(20);

  useEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const measure = () => {
      setFullHeight(Math.ceil(text.getBoundingClientRect().height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative h-5 overflow-hidden leading-5 transition-[height] duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:h-[var(--promotion-height)] group-focus-within:h-[var(--promotion-height)] motion-reduce:transition-none"
      style={{ "--promotion-height": `${fullHeight}px` } as CSSProperties}
    >
      <div ref={textRef} className="whitespace-normal break-words">
        {status}
        {detail ? (
          <span className="ml-2 text-muted-foreground">{detail}</span>
        ) : null}
      </div>
      {fullHeight > 20 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 w-5 bg-linear-to-r from-transparent to-card to-40% text-right text-muted-foreground group-hover:invisible group-focus-within:invisible"
        >
          …
        </span>
      ) : null}
    </div>
  );
}

type ResultsTableProps = {
  returnTo: string;
  filters: ReactNode;
  pagination: ReactNode;
  suggestions: SearchSuggestion[];
  onSuggestionSelect: (query: string) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
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
  returnTo,
  filters,
  pagination,
  suggestions,
  onSuggestionSelect,
  searchInput,
  onSearchInputChange,
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

  const showLoadingMessage = isLoading && !isSortLoading;
  const showSkeleton =
    isLoading && (!isSortLoading || displayedResults.length === 0);
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
        <HugeiconsIcon
          icon={Icon}
          className="size-4 shrink-0 translate-y-px"
          aria-hidden="true"
        />
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border bg-card w-full max-w-4xl"
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
            placeholder='Keywords separated by commas (e.g. "gaming, game development")'
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
              {showLoadingMessage ? (
                <Spinner />
              ) : (
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
      {showSkeleton ? (
        <output className="sr-only">Loading results</output>
      ) : null}
      {errorMessage && !isLoading ? (
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
              {showSkeleton ? (
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
                      <div className="h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 rounded bg-muted motion-safe:animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-5/6 rounded bg-muted motion-safe:animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : lockedRowCount > 0 ? (
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
                        Weekly promotion thread
                      </span>
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
                        <EmptyMedia
                          variant={searchInput.trim() ? "icon" : "default"}
                        >
                          {searchInput.trim() ? (
                            <HugeiconsIcon icon={Alert02Icon} />
                          ) : (
                            <Image
                              src={logo}
                              alt="PromoterCat"
                              width={64}
                              height={64}
                            />
                          )}
                        </EmptyMedia>
                        <EmptyTitle>
                          {searchInput.trim()
                            ? "No matches this time"
                            : "Find your purr-fect community"}
                        </EmptyTitle>
                        {searchInput.trim() ? (
                          <EmptyDescription>
                            Try different keywords.
                          </EmptyDescription>
                        ) : (
                          <EmptyDescription>
                            Try a suggested search below to see how it works
                          </EmptyDescription>
                        )}
                      </EmptyHeader>
                      {searchInput.trim() ? null : (
                        <EmptyContent className="max-w-none">
                          <SearchSuggestions
                            suggestions={suggestions}
                            onSelect={onSuggestionSelect}
                          />
                        </EmptyContent>
                      )}
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                displayedResults.map((subreddit) => (
                  <TableRow key={subreddit.name} className="group h-10">
                    <TableCell className="font-medium">
                      <Link
                        href={`https://www.reddit.com/r/${subreddit.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate transition-colors duration-200 hover:text-orange-600 focus-visible:text-orange-600 motion-reduce:transition-none"
                        title={`r/${subreddit.name}`}
                      >
                        r/{subreddit.name}
                      </Link>
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
                  </TableRow>
                ))
              )}
              {!showSkeleton &&
              (lockedRowCount > 0 || displayedResults.length > 0 || isLoading)
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
          {lockedRowCount > 0 && !showSkeleton ? (
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
