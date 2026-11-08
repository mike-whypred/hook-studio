import { currentUser } from "@/lib/auth/server";
import { getSub } from "@/lib/billing";
import { appUrl, stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await currentUser();
  const base = appUrl(req);
  if (!user) return Response.redirect(`${base}/sign-in`, 303);
  const sub = await getSub(user.id);
  if (!sub) return Response.redirect(`${base}/pricing`, 303);

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${base}/studio`,
  });
  return Response.redirect(portal.url, 303);
}
