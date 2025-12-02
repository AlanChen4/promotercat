"use client";

import { Pricing } from "@/components/pricing";

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 items-center justify-center mb-8">
        <h1 className="text-6xl text-center mb-2">
          Simple, transparent pricing
        </h1>
        <p className="text-2xl text-center max-w-md text-foreground">
          No credit card required, cancel anytime
        </p>
      </div>
      <Pricing source="pricing_page" />
    </div>
  );
}
