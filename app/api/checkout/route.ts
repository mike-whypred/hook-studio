import { currentUser } from "@/lib/auth/server";
import { customerFor, getSub, isActive, isComp, needsPayment, portalUrl, syncFromStripe } from "@/lib/billing";
import { appUrl, stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await currentUser();
  const base = appUrl(req);
  if (!user) return Response.redirect(`${base}/sign-in?next=/pricing`, 303);

  // Never start a second subscription. Already paid (or comp): go to the studio.
  // Payment failed: fix it in the portal instead of subscribing again.
  let sub = await getSub(user.id);
  if (isActive(sub) || isComp(sub)) return Response.redirect(`${base}/studio`, 303);
  if (sub && !needsPayment(sub)) {
    // Our row may be stale (e.g. a checkout just finished in another tab). Check Stripe itself.
    await syncFromStripe(sub.stripe_customer_id).catch((err) => console.error("stripe sync failed", err));
    sub = await getSub(user.id);
    if (isActive(sub)) return Response.redirect(`${base}/studio`, 303);
  }
  if (sub && needsPayment(sub)) {
    const url = await portalUrl(sub.stripe_customer_id, `${base}/studio`);
    return Response.redirect(url ?? `${base}/pricing?billing=unavailable`, 303);
  }

  const customer = await customerFor(user.id, user.email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pricing`,
  });
  return Response.redirect(session.url!, 303);
}
