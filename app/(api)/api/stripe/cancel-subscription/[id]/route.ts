import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const POST = async (
  _req: Request,
  context?: { params: Promise<Record<string, string>> },
) => {
  const subscriptionId = context ? (await context.params).id : undefined;
  if (!subscriptionId) {
    return new Response("Missing subscription id", { status: 400 });
  }

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

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const subscriptionCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer?.id ?? null);

  if (!subscriptionCustomerId || subscriptionCustomerId !== customerId) {
    return new Response("Subscription does not belong to user", {
      status: 403,
    });
  }

  if (subscription.cancel_at_period_end) {
    return new Response(
      JSON.stringify({
        ok: true,
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: true,
        cancelAt: subscription.cancel_at,
      }),
      { status: 200 },
    );
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: true,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      subscriptionId: updated.id,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      cancelAt: updated.cancel_at,
    }),
    { status: 200 },
  );
};
