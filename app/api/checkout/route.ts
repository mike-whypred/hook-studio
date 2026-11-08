import { currentUser } from "@/lib/auth/server";
import { customerFor } from "@/lib/billing";
import { appUrl, stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await currentUser();
  const base = appUrl(req);
  if (!user) return Response.redirect(`${base}/sign-in?next=/pricing`, 303);

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
