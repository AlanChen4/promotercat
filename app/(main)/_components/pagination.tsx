"use client";

import { LayoutGroup, motion } from "motion/react";
import { useId } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type SubredditsPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
};

export function SubredditsPagination({
  page,
  totalPages,
  onPageChange,
}: SubredditsPaginationProps) {
  const layoutId = useId();

  if (totalPages <= 1) {
    return null;
  }

  const visiblePages: (number | "ellipsis-start" | "ellipsis-end")[] =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : page <= 4
        ? [1, 2, 3, 4, 5, "ellipsis-end", totalPages]
        : page >= totalPages - 3
          ? [
              1,
              "ellipsis-start",
              totalPages - 4,
              totalPages - 3,
              totalPages - 2,
              totalPages - 1,
              totalPages,
            ]
          : [
              1,
              "ellipsis-start",
              page - 1,
              page,
              page + 1,
              "ellipsis-end",
              totalPages,
            ];

  return (
    <LayoutGroup id={layoutId}>
      <Pagination>
        <PaginationContent className="gap-0 sm:gap-1">
          <motion.li initial={false} animate={{ opacity: page === 1 ? 0 : 1 }}>
            <PaginationPrevious
              href="#"
              onClick={(event) => {
                event.preventDefault();
                if (page > 1) {
                  onPageChange(page - 1);
                }
              }}
              aria-hidden={page === 1}
              tabIndex={page === 1 ? -1 : undefined}
              className={page === 1 ? "pointer-events-none" : undefined}
            />
          </motion.li>
          {visiblePages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              {typeof pageNumber === "number" ? (
                <PaginationLink
                  href="#"
                  className="relative isolate size-7 sm:size-9 data-[active=true]:border-transparent data-[active=true]:bg-transparent data-[active=true]:shadow-none"
                  isActive={pageNumber === page}
                  onClick={(event) => {
                    event.preventDefault();
                    if (pageNumber !== page) {
                      onPageChange(pageNumber);
                    }
                  }}
                >
                  {pageNumber === page ? (
                    <motion.span
                      layoutId="active-page"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10 rounded-md border bg-background shadow-xs"
                    />
                  ) : null}
                  {pageNumber}
                </PaginationLink>
              ) : (
                <PaginationEllipsis className="size-7 sm:size-9" />
              )}
            </PaginationItem>
          ))}
          <motion.li
            initial={false}
            animate={{ opacity: page === totalPages ? 0 : 1 }}
          >
            <PaginationNext
              href="#"
              onClick={(event) => {
                event.preventDefault();
                if (page < totalPages) {
                  onPageChange(page + 1);
                }
              }}
              aria-hidden={page === totalPages}
              tabIndex={page === totalPages ? -1 : undefined}
              className={
                page === totalPages ? "pointer-events-none" : undefined
              }
            />
          </motion.li>
        </PaginationContent>
      </Pagination>
    </LayoutGroup>
  );
}
