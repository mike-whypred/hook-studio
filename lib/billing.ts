import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const ACTIVE = new Set(["active", "trialing"]);

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

export async function hasAccess(userId: string) {
  const sub = await getSub(userId);
  return !!sub && ACTIVE.has(sub.status);
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

/** Copy a Stripe subscription's state onto our row, keyed by its customer. */
export async function saveSubscription(s: Stripe.Subscription) {
  const customerId = typeof s.customer === "string" ? s.customer : s.customer.id;
  const end = s.items.data[0]?.current_period_end;
  await sql`update subscriptions
            set stripe_subscription_id = ${s.id}, status = ${s.status},
                current_period_end = ${end ? new Date(end * 1000).toISOString() : null},
                updated_at = now()
            where stripe_customer_id = ${customerId}`;
}

const DAILY_AI_LIMIT = Number(process.env.DAILY_AI_LIMIT ?? 300);

/** Counts one AI call for today. Returns false once the daily limit is reached. */
export async function takeAiCall(userId: string) {
  const rows = (await sql`insert into ai_usage (user_id, day, calls) values (${userId}, current_date, 1)
                          on conflict (user_id, day) do update set calls = ai_usage.calls + 1
                          returning calls`) as { calls: number }[];
  return rows[0].calls <= DAILY_AI_LIMIT;
}
