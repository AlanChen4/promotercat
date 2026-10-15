// Allow search and the exact OAuth consent route; reject external redirects.
export function searchReturnPath(value: string | null | undefined): string {
  if (value) {
    const url = URL.canParse(value, "https://promotercat.invalid")
      ? new URL(value, "https://promotercat.invalid")
      : null;
    if (
      value.startsWith("/oauth/consent?") &&
      url?.origin === "https://promotercat.invalid" &&
      url.pathname === "/oauth/consent" &&
      url.searchParams.get("authorization_id")
    ) {
      return `/oauth/consent?authorization_id=${encodeURIComponent(url.searchParams.get("authorization_id") ?? "")}`;
    }
  }
  return value === "/" || value?.startsWith("/?") ? value : "/";
}
