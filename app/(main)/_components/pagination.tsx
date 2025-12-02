"use client";

import {
  Pagination,
  PaginationContent,
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
        {paginationItems.map((pageNumber) => (
          <PaginationItem key={pageNumber}>
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
