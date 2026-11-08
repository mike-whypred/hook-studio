import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { getSub, saveSubscription } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** After Checkout: sync the subscription right away so the user doesn't wait on the webhook. */
export default async function BillingReturn({ searchParams }: PageProps<"/billing/return">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const { session_id } = await searchParams;
  const sub = await getSub(user.id);
  if (typeof session_id === "string" && sub) {
    const s = await stripe.checkout.sessions.retrieve(session_id);
    const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
    if (customer === sub.stripe_customer_id && s.subscription) {
      const id = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
      await saveSubscription(await stripe.subscriptions.retrieve(id));
    }
  }
  redirect("/studio");
}
