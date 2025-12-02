import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const POST = async (req: Request) => {
  // 1. Destructure the price and quantity from the POST body
  const { line_items, metadata = {}, user_id, chart_ids } = await req.json();

  // 2. Get the user from Supabase auth
  const supabase = await createClient();

  const user = await supabase
    .from("users")
    .select("*")
    .eq("id", user_id)
    .single();

  let customer: string | undefined;

  if (user.data?.stripe_customer_id) {
    customer = user.data.stripe_customer_id;
  } else {
    const customerObject = await stripe.customers.create({
      email: user.data?.email,
    });
    customer = customerObject.id;
    await supabase
      .from("users")
      .update({
        stripe_customer_id: customerObject.id,
      })
      .eq("id", user_id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    billing_address_collection: "required",
    customer,
    customer_update: {
      address: "auto",
    },
    line_items,
    mode: "subscription",
    allow_promotion_codes: true,
    metadata: {
      chart_ids: JSON.stringify(chart_ids),
      ...metadata,
    },
    client_reference_id: user_id,
    success_url: `${baseUrl}/?checkout=success`,
    cancel_url: `${baseUrl}/?checkout=cancelled`,
  });

  if (session) {
    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
    });
  } else {
    return new Response(
      JSON.stringify({
        error: { statusCode: 500, message: "Session is not defined" },
      }),
      { status: 500 },
    );
  }
};
