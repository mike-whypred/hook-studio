import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/** Statuses that open the studio. */
const ACTIVE = new Set(["active", "trialing"]);
/** A subscription exists but payment needs fixing: send the user to the Stripe portal, not a new checkout. */
const NEEDS_PAYMENT = new Set(["past_due", "unpaid", "paused"]);

export type Sub = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
};

export async function getSub(userId: string): Promise<Sub | null> {
  const rows = (await sql`select * from subscriptions where user_id = ${userId}`) as Sub[];
  return rows[0] ?? null;
}

export function isActive(sub: Sub | null) {
  return !!sub && ACTIVE.has(sub.status);
}

export function needsPayment(sub: Sub | null) {
  return !!sub && !isComp(sub) && NEEDS_PAYMENT.has(sub.status);
}

/** Free accounts granted by hand have customer id "comp_<user id>" and no Stripe billing. */
export function isComp(sub: Sub | null) {
  return !!sub && sub.stripe_customer_id.startsWith("comp_");
}

/** True when the user has a real Stripe customer whose billing they can manage in the portal. */
export function canManageBilling(sub: Sub | null) {
  return !!sub && !isComp(sub) && sub.status !== "none";
}

export async function hasAccess(userId: string) {
  return isActive(await getSub(userId));
}

/** Find or create the Stripe customer for a user. */
export async function customerFor(userId: string, email: string) {
  const sub = await getSub(userId);
  if (sub) return sub.stripe_customer_id;
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await sql`insert into subscriptions (user_id, stripe_customer_id, status)
            values (${userId}, ${customer.id}, 'none')
            on conflict (user_id) do nothing`;
  return (await getSub(userId))!.stripe_customer_id;
}

/**
 * Copy a Stripe subscription's state onto our row, keyed by its customer.
 * If the customer has more than one subscription, an event about an old or failed one
 * must not overwrite the one that gives access. So a different subscription only replaces
 * the stored one when it is active, or when the stored one has ended.
 */
export async function saveSubscription(s: Stripe.Subscription) {
  const customerId = typeof s.customer === "string" ? s.customer : s.customer.id;
  const end = s.items.data[0]?.current_period_end;
  const live = ACTIVE.has(s.status);
  await sql`update subscriptions
            set stripe_subscription_id = ${s.id}, status = ${s.status},
                current_period_end = ${end ? new Date(end * 1000).toISOString() : null},
                updated_at = now()
            where stripe_customer_id = ${customerId}
              and (stripe_subscription_id is null
                   or stripe_subscription_id = ${s.id}
                   or ${live}::boolean
                   or status in ('none', 'canceled', 'incomplete', 'incomplete_expired'))`;
}

/**
 * Ask Stripe whether this customer already has a subscription that is live or awaiting payment,
 * and store it. Catches a checkout finished in another tab before its webhook arrives.
 */
export async function syncFromStripe(customerId: string) {
  const { data } = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const current =
    data.find((s) => ACTIVE.has(s.status)) ?? data.find((s) => NEEDS_PAYMENT.has(s.status));
  if (current) await saveSubscription(current);
  return current ?? null;
}

/** A Stripe customer portal link, or null when the portal is not set up or Stripe fails. */
export async function portalUrl(customerId: string, returnUrl: string) {
  try {
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return portal.url;
  } catch (err) {
    console.error("billing portal failed", err instanceof Error ? err.message : err);
    return null;
  }
}

const DAILY_AI_LIMIT = Number(process.env.DAILY_AI_LIMIT ?? 300);

/** Counts one AI call for today. Returns false once the daily limit is reached. */
export async function takeAiCall(userId: string) {
  const rows = (await sql`insert into ai_usage (user_id, day, calls) values (${userId}, current_date, 1)
                          on conflict (user_id, day) do update set calls = ai_usage.calls + 1
                          returning calls`) as { calls: number }[];
  return rows[0].calls <= DAILY_AI_LIMIT;
}
