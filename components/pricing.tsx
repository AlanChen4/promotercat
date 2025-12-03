"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type PricingProps = {
  source?: string;
};

export function Pricing({ source = "unknown" }: PricingProps) {
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const handleUpgrade = async (planType: "monthly" | "annual") => {
    setLoading(planType);

    try {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      const priceId =
        planType === "monthly"
          ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;

      if (!publishableKey || !priceId) {
        setLoading(null);
        return;
      }

      if (!user) {
        setLoading(null);
        router.push("/auth");
        return;
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          line_items: [{ price: priceId, quantity: 1 }],
          metadata: { source, plan_type: planType },
        }),
      });

      if (!response.ok) {
        setLoading(null);
        return;
      }
      const { sessionId } = (await response.json()) as { sessionId: string };

      const stripe = await loadStripe(publishableKey);
      if (!stripe) {
        setLoading(null);
        return;
      }
      await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      setLoading(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-screen-5xl py-4">
      <div className="flex justify-center">
        <div
          className={cn(
            "flex flex-col lg:flex-row border w-full max-w-screen-5xl rounded-xl",
            source === "landing_pricing" ? "" : "overflow-y-auto",
          )}
        >
          {/* FREE Plan */}
          <div className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 p-4 sm:p-6 flex-1 lg:w-64 flex flex-col">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Free</h3>
              <p className="text-sm text-gray-600 mb-4">
                Perfect for getting started and basic insights.
              </p>
              <div className="mb-4">
                <span className="text-2xl sm:text-3xl font-bold">$0</span>
                <span className="text-gray-600 text-sm"> / month</span>
              </div>
              <Button
                disabled
                className="w-full bg-gray-100 text-gray-400 text-sm sm:text-base"
              >
                Current Plan
              </Button>
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-3">
                Get started with
              </p>
              <ul className="space-y-2 text-base text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="bg-primary/10 rounded-md p-0.5 shrink-0">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-primary"
                    />
                  </div>
                  3 results per search
                </li>
              </ul>
            </div>
          </div>

          {/* PRO Monthly Plan */}
          <div className="relative bg-white border-b lg:border-b-0 border-r-0 lg:border-r border-border p-4 sm:p-6 flex-1 flex flex-col">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Pro — Monthly
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                For advanced users and serious indie hackers.
              </p>
              <div className="mb-4">
                <span className="text-2xl sm:text-3xl font-bold">$4.99</span>
                <span className="text-gray-600 text-sm"> / month</span>
              </div>
              <Button
                onClick={() => handleUpgrade("monthly")}
                disabled={loading !== null}
                className="w-full bg-primary text-white text-sm sm:text-base"
              >
                {loading === "monthly" ? "Loading..." : "Upgrade"}
              </Button>
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-3">
                Everything in the Free Plan, plus
              </p>
              <ul className="space-y-2 text-base text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="bg-primary/10 rounded-md p-0.5 shrink-0">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-primary"
                    />
                  </div>
                  Unlimited results per search
                </li>
                <li className="flex items-center gap-2">
                  <div className="bg-primary/10 rounded-md p-0.5 shrink-0">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-primary"
                    />
                  </div>
                  Priority email support
                </li>
              </ul>
            </div>
          </div>

          {/* PRO Annual Plan */}
          <div className="bg-white p-4 sm:p-6 flex-1 lg:w-64 flex flex-col">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Pro — Annual (33% off)
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Everything in the Pro Plan, plus annual billing with significant
                savings.
              </p>
              <div className="mb-4">
                <span className="text-2xl sm:text-3xl font-bold">$39.99</span>
                <span className="text-gray-600 text-sm"> / year</span>
              </div>
              <Button
                onClick={() => handleUpgrade("annual")}
                disabled={loading !== null}
                className="w-full bg-primary text-white text-sm sm:text-base"
              >
                {loading === "annual" ? "Loading..." : "Upgrade"}
              </Button>
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-3">
                Everything in the Pro Plan, plus
              </p>
              <ul className="space-y-2 text-base text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="bg-primary/10 rounded-md p-0.5 shrink-0">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-primary"
                    />
                  </div>
                  Annual discount
                </li>
                <li className="flex items-center gap-2">
                  <div className="bg-primary/10 rounded-md p-0.5 shrink-0">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={16}
                      className="text-primary"
                    />
                  </div>
                  Priority feature requests
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Pricing;
