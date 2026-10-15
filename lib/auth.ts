// Sign-in returns to the search page. Reject external or other redirect targets.
export function searchReturnPath(value: string | null | undefined): string {
  return value === "/" || value?.startsWith("/?") ? value : "/";
}
