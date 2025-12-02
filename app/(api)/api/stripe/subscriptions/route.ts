import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const GET = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (userError) {
    return new Response(userError.message, { status: 400 });
  }

  const customerId = userRow?.stripe_customer_id;
  if (!customerId) {
    return new Response("Stripe customer not found for user", {
      status: 400,
    });
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    // Limit expand depth to avoid Stripe's nested expand limit
    expand: ["data.items.data.price"],
  });

  const activeish = subscriptions.data.filter((s) =>
    ["active", "trialing", "past_due"].includes(s.status as string),
  );

  // Build a unique list of product IDs to fetch names
  const productIds = new Set<string>();
  for (const s of activeish) {
    const firstItem = s.items.data[0];
    const price = (firstItem as any)?.price as any | undefined;
    const product = price?.product as any | undefined;
    const productId = typeof product === "string" ? product : product?.id;
    if (productId) productIds.add(productId);
  }

  const productIdToName = new Map<string, string>();
  await Promise.all(
    Array.from(productIds).map(async (pid) => {
      try {
        const product = await stripe.products.retrieve(pid);
        if (product?.name) {
          productIdToName.set(pid, product.name);
        }
      } catch {
        // ignore failures; we'll fall back to nickname/price id
      }
    }),
  );

  const payload = activeish.map((s) => {
    const firstItem = s.items.data[0];
    const price = (firstItem as any)?.price as any | undefined;
    const product = price?.product as any | undefined;
    const productId = typeof product === "string" ? product : product?.id;
    const productName = productId ? productIdToName.get(productId) : undefined;
    const nickname = price?.nickname as string | undefined;
    const priceId = price?.id as string | undefined;
    const label = productName || nickname || priceId || "Subscription";
    return {
      id: s.id,
      status: s.status,
      label,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      cancelAt: s.cancel_at,
    };
  });

  return new Response(JSON.stringify({ subscriptions: payload }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
