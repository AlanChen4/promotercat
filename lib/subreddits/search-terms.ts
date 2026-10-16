/** Commas separate unordered terms; word order within a term is meaningful. */
export function normalizeSearchTerms(search: string): string[] {
  return [
    ...new Set(
      search
        .split(",")
        .map((term) => term.trim().toLowerCase().replace(/^r\//, "").trim())
        .filter(Boolean),
    ),
  ].sort();
}
