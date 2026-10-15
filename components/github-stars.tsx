"use client";

import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadStars = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/AlanChen4/promotercat",
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(10_000),
            ]),
          },
        );
        if (!response.ok) return;
        const data: { stargazers_count?: unknown } = await response.json();
        const count = data.stargazers_count;
        if (
          typeof count === "number" &&
          Number.isSafeInteger(count) &&
          count >= 0
        )
          setStars(count);
      } catch {
        // Keep the repository link usable when GitHub is unavailable or private.
      }
    };
    void loadStars();
    return () => controller.abort();
  }, []);

  return (
    <Button asChild variant="ghost" size="sm" className="min-w-18 shrink-0">
      <a
        href="https://github.com/AlanChen4/promotercat"
        target="_blank"
        rel="noopener noreferrer"
        title="Star PromoterCat on GitHub"
        aria-label={`Star PromoterCat on GitHub${stars === null ? "" : ` (${stars.toLocaleString("en-US")} stars)`}`}
      >
        <HugeiconsIcon
          icon={GithubIcon}
          className="size-4"
          aria-hidden="true"
        />
        <span className="min-w-6 text-right tabular-nums">
          {stars === null
            ? "Star"
            : Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(stars)}
        </span>
      </a>
    </Button>
  );
}
