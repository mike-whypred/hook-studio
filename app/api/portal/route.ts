import { currentUser } from "@/lib/auth/server";
import { canManageBilling, getSub, isComp, portalUrl } from "@/lib/billing";
import { appUrl } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await currentUser();
  const base = appUrl(req);
  if (!user) return Response.redirect(`${base}/sign-in`, 303);
  const sub = await getSub(user.id);
  // Free accounts granted by hand have no Stripe billing to manage.
  if (isComp(sub)) return Response.redirect(`${base}/studio`, 303);
  if (!canManageBilling(sub)) return Response.redirect(`${base}/pricing`, 303);

  // Back to wherever Billing was clicked: the studio, or the pricing page for lapsed plans.
  const form = await req.formData().catch(() => null);
  const from = form?.get("from") === "/pricing" ? "/pricing" : "/studio";
  const url = await portalUrl(sub!.stripe_customer_id, `${base}${from}`);
  return Response.redirect(url ?? `${base}${from}?billing=unavailable`, 303);
}
