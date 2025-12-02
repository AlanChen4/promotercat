import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin-server";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: unknown;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  const supabase = await createAdminClient();

  const typedEvent = event as {
    type: string;
    data: { object: unknown };
  };
  switch (typedEvent.type) {
    case "checkout.session.completed": {
      const session = typedEvent.data.object as {
        id: string;
        customer?: string | null;
        client_reference_id?: string | null;
        mode?: string | null;
        subscription?: string | null;
      };

      const userId = session.client_reference_id;
      const customerId = session.customer ?? null;

      if (userId && customerId) {
        await supabase
          .from("users")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = typedEvent.data.object as {
        id: string;
        status:
          | "trialing"
          | "active"
          | "past_due"
          | "canceled"
          | "unpaid"
          | "incomplete"
          | "incomplete_expired"
          | string;
        customer: string | { id: string } | null;
      };

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : (subscription.customer?.id ?? null);

      if (customerId) {
        let latestStatus = subscription.status as string;
        try {
          const latest = await stripe.subscriptions.retrieve(subscription.id);
          latestStatus = latest.status as string;
        } catch {
          // If fetching latest fails, fall back to status from the event
        }

        const grantPremium = ["active", "trialing", "past_due"].includes(
          latestStatus,
        );
        const revokePremium = [
          "canceled",
          "unpaid",
          "incomplete_expired",
        ].includes(latestStatus);

        if (grantPremium) {
          await supabase
            .from("users")
            .update({ is_premium: true })
            .eq("stripe_customer_id", customerId);
        } else if (revokePremium) {
          await supabase
            .from("users")
            .update({ is_premium: false })
            .eq("stripe_customer_id", customerId);
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = typedEvent.data.object as {
        id: string;
        customer: string | { id: string } | null;
      };
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : (subscription.customer?.id ?? null);
      if (customerId) {
        await supabase
          .from("users")
          .update({ is_premium: false })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = typedEvent.data.object as {
        id: string;
        customer: string | null;
      };
      if (invoice.customer) {
        await supabase
          .from("users")
          .update({ is_premium: true })
          .eq("stripe_customer_id", invoice.customer);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = typedEvent.data.object as {
        subscription?: string | null;
      };

      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : null;

      if (subscriptionId) {
        try {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          if (subscription.status !== "canceled") {
            await stripe.subscriptions.cancel(subscriptionId);
          }
        } catch {
          // Intentionally ignore errors from canceling an already-canceled subscription
        }
      }

      break;
    }
    default: {
      // Unhandled event type
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
