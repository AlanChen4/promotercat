"use client";

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

  const visiblePages: (number | "ellipsis-start" | "ellipsis-end")[] =
    totalPages <= 7
      ? paginationItems
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
    <Pagination>
      <PaginationContent className="gap-0 sm:gap-1">
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
        {visiblePages.map((pageNumber) => (
          <PaginationItem key={pageNumber}>
            {typeof pageNumber === "number" ? (
              <PaginationLink
                href="#"
                className="size-7 sm:size-9"
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
            ) : (
              <PaginationEllipsis className="size-7 sm:size-9" />
            )}
          </PaginationItem>
        ))}
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
