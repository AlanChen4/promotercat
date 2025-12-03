"use client";

import { Fragment } from "react";
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
  paginationItems: number[];
  onPageChange: (nextPage: number) => void;
};

export function SubredditsPagination({
  page,
  totalPages,
  paginationItems,
  onPageChange,
}: SubredditsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages =
    paginationItems.length <= 5
      ? paginationItems
      : Array.from(
          new Set(
            [1, totalPages, page - 1, page, page + 1].filter(
              (value) => value >= 1 && value <= totalPages,
            ),
          ),
        ).sort((a, b) => a - b);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) {
                onPageChange(page - 1);
              }
            }}
            aria-disabled={page === 1}
            className={page === 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {visiblePages.map((pageNumber, index) => {
          const previousPage = visiblePages[index - 1];
          const showEllipsis =
            typeof previousPage === "number" && pageNumber - previousPage > 1;

          return (
            <Fragment key={pageNumber}>
              {showEllipsis ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}
              <PaginationItem>
                <PaginationLink
                  href="#"
                  isActive={pageNumber === page}
                  onClick={(event) => {
                    event.preventDefault();
                    if (pageNumber !== page) {
                      onPageChange(pageNumber);
                    }
                  }}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            </Fragment>
          );
        })}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (page < totalPages) {
                onPageChange(page + 1);
              }
            }}
            aria-disabled={page === totalPages}
            className={
              page === totalPages ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
