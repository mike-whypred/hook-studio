import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { getSub, isActive, saveSubscription } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** How many times the page re-checks (every 3 seconds) before it stops and says so. */
const MAX_TRIES = 10;

/**
 * After Checkout: sync the subscription right away so the user doesn't wait on the webhook.
 * If the payment is still processing, say so and check again instead of bouncing to the pricing page.
 */
export default async function BillingReturn({ searchParams }: PageProps<"/billing/return">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/pricing");
  const { session_id, try: tryParam } = await searchParams;
  if (typeof session_id !== "string") redirect("/pricing");

  const sub = await getSub(user.id);
  if (isActive(sub)) redirect("/studio");

  const s = await stripe.checkout.sessions.retrieve(session_id).catch(() => null);
  const customer = typeof s?.customer === "string" ? s.customer : s?.customer?.id;
  // Not this user's checkout, or they left it without finishing: back to the plan.
  if (!s || !sub || customer !== sub.stripe_customer_id || s.status !== "complete") redirect("/pricing");

  if (s.subscription) {
    const id = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
    await saveSubscription(await stripe.subscriptions.retrieve(id));
    if (isActive(await getSub(user.id))) redirect("/studio");
  }

  const tries = Math.max(0, Number(tryParam) || 0);
  const giveUp = tries >= MAX_TRIES;
  const next = `/billing/return?session_id=${encodeURIComponent(session_id)}&try=${tries + 1}`;

  return (
    <div className="wrap narrow" style={{ marginTop: 40 }}>
      {!giveUp && <meta httpEquiv="refresh" content={`3;url=${next}`} />}
      <h1><Link href="/">Hook Studio</Link></h1>
      {giveUp ? (
        <>
          <p className="lead">Your payment is taking longer than usual to clear.</p>
          <div className="card-s">
            <p style={{ marginTop: 0 }}>
              Some payment methods take a few minutes, or longer, to confirm. You won&apos;t be charged twice.
              Come back to the studio once Stripe emails your receipt.
            </p>
            <Link className="btn" href={next} style={{ display: "inline-block", textDecoration: "none" }}>
              Check again
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="lead" role="status">Finishing up your payment…</p>
          <p className="note">This usually takes a few seconds. The studio opens as soon as it&apos;s done.</p>
        </>
      )}
    </div>
  );
}
