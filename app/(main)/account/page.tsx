"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useAuth } from "@/providers/auth-provider";

type SubscriptionItem = {
  id: string;
  label: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
};

export default function AccountPage() {
  const { isPremium, isAuthenticatedLoading } = useAuth();

  if (isAuthenticatedLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Loading your account…</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="space-y-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your plan and subscription</CardDescription>
          </CardHeader>
          <CardContent>
            {isPremium ? <CancelSubscriptionManager /> : <UpgradeSection />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UpgradeSection() {
  return (
    <UpgradeModal
      source="account_page"
      trigger={<Button className="w-fit">Upgrade</Button>}
    />
  );
}

function CancelSubscriptionManager() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<
    string | null
  >(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/stripe/subscriptions");
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load subscriptions");
        }
        const data = (await res.json()) as {
          subscriptions: SubscriptionItem[];
        };
        if (!isMounted) return;
        const list = data.subscriptions || [];
        setSubscriptions(list);
        const firstCancelable = list.find((s) => !s.cancelAtPeriodEnd);
        setSelectedSubscriptionId(firstCancelable ? firstCancelable.id : null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (!isMounted) return;
        setError(message);
        setSubscriptions([]);
        setSelectedSubscriptionId(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const cancelable = useMemo(
    () => subscriptions.filter((s) => !s.cancelAtPeriodEnd),
    [subscriptions],
  );
  const scheduled = useMemo(
    () => subscriptions.filter((s) => s.cancelAtPeriodEnd),
    [subscriptions],
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-muted-foreground">
          Canceling will schedule the end of your current billing period. You
          will retain premium access until that date.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm">Loading subscriptions…</p>
      ) : cancelable.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm">No active subscriptions found.</p>
          {scheduled.length > 0 ? <ScheduledList items={scheduled} /> : null}
        </div>
      ) : (
        <div className="space-y-4">
          {cancelable.length === 1 ? (
            <div className="text-sm flex items-center justify-between">
              <p>
                Selected subscription:{" "}
                <span className="font-medium">{cancelable[0].label}</span>
              </p>
              {cancelable[0].cancelAt ? (
                <span className="text-muted-foreground">
                  {new Date(cancelable[0].cancelAt * 1000).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Select a subscription to cancel:</p>
              <div className="space-y-2">
                {cancelable.map((sub) => (
                  <label
                    key={sub.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="subscription"
                        value={sub.id}
                        checked={selectedSubscriptionId === sub.id}
                        onChange={() => setSelectedSubscriptionId(sub.id)}
                      />
                      {sub.label}
                    </span>
                    {sub.cancelAt ? (
                      <span className="text-muted-foreground">
                        {new Date(sub.cancelAt * 1000).toLocaleDateString()}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </div>
          )}

          {scheduled.length > 0 ? (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm">Scheduled to end:</p>
              <ScheduledList items={scheduled} />
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={
                cancelLoading ||
                !selectedSubscriptionId ||
                subscriptions.length === 0
              }
              onClick={async () => {
                if (cancelLoading || !selectedSubscriptionId) return;
                setError(null);
                setCancelLoading(true);
                try {
                  const res = await fetch(
                    `/api/stripe/cancel-subscription/${selectedSubscriptionId}`,
                    { method: "POST" },
                  );
                  if (!res.ok) {
                    const text = await res.text();
                    setError(text || "Failed to cancel subscription.");
                  } else {
                    // Refetch to reflect new state
                    setLoading(true);
                    const listRes = await fetch("/api/stripe/subscriptions");
                    if (listRes.ok) {
                      const data = (await listRes.json()) as {
                        subscriptions: SubscriptionItem[];
                      };
                      setSubscriptions(data.subscriptions || []);
                      const firstCancelable = (data.subscriptions || []).find(
                        (s) => !s.cancelAtPeriodEnd,
                      );
                      setSelectedSubscriptionId(
                        firstCancelable ? firstCancelable.id : null,
                      );
                    }
                  }
                } finally {
                  setCancelLoading(false);
                  setLoading(false);
                }
              }}
            >
              {cancelLoading ? "Canceling…" : "Confirm cancel"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduledList({ items }: { items: SubscriptionItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((sub) => (
        <li
          key={sub.id}
          className="flex items-center justify-between text-sm text-muted-foreground"
        >
          <span>{sub.label}</span>
          {sub.cancelAt ? (
            <span>{new Date(sub.cancelAt * 1000).toLocaleDateString()}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
