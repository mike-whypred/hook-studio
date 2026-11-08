import type Stripe from "stripe";
import { saveSubscription } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

/** Keeps each user's subscription status in sync with Stripe. */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.mode === "subscription" && s.subscription && s.payment_status !== "unpaid") {
        const id = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
        await saveSubscription(await stripe.subscriptions.retrieve(id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await saveSubscription(event.data.object);
      break;
    case "invoice.paid":
    case "invoice.payment_failed": {
      // Renewals and failed payments change the subscription status; re-read it.
      const subId = event.data.object.parent?.subscription_details?.subscription;
      if (subId) {
        const id = typeof subId === "string" ? subId : subId.id;
        await saveSubscription(await stripe.subscriptions.retrieve(id));
      }
      break;
    }
  }
  return new Response("ok");
}
