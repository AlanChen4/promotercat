"use client";

import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";

export default function PostLoginPage() {
  const { user, isAuthenticatedLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAuthenticatedLoading) return;
      const userId = user?.id;
      if (userId) {
        posthog.identify(userId, {
          email: user?.email ?? undefined,
        });
      }
      if (!cancelled) {
        router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, isAuthenticatedLoading, user]);

  return null;
}
