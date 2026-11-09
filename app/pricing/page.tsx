import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { canManageBilling, getSub, isActive, needsPayment } from "@/lib/billing";
import { PLAN_FEATURES, PLAN_NAME, PLAN_PRICE } from "@/lib/plan";
import SignOutButton from "../sign-out-button";

export const dynamic = "force-dynamic";

export default async function Pricing({ searchParams }: PageProps<"/pricing">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/pricing");
  const sub = await getSub(user.id);
  if (isActive(sub)) redirect("/studio");
  const { billing } = await searchParams;

  const fixPayment = needsPayment(sub);
  const ended = sub?.status === "canceled";
  const lead = fixPayment
    ? "Your last payment didn't go through, so the studio is paused. Update your card to pick up where you left off."
    : ended
      ? "Your plan has ended. Subscribe again to get back into the studio."
      : "One plan with everything in it.";

  return (
    <div className="wrap narrow" style={{ marginTop: 40 }}>
      <h1><Link href="/">Hook Studio</Link></h1>
      <p className="lead">{lead}</p>
      {billing === "unavailable" && (
        <p className="note err" role="alert">
          Billing couldn&apos;t be opened just now. Please try again in a minute.
        </p>
      )}
      <div className="card-s">
        <h3>{PLAN_NAME}</h3>
        <p className="price">
          {PLAN_PRICE} <small>/ month</small>
        </p>
        <ul className="ticks">
          {PLAN_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {fixPayment ? (
          <form action="/api/portal" method="post">
            <input type="hidden" name="from" value="/pricing" />
            <button className="btn" style={{ width: "100%" }}>Update payment</button>
          </form>
        ) : (
          <form action="/api/checkout" method="post">
            <button className="btn" style={{ width: "100%" }}>{ended ? "Subscribe again" : "Subscribe"}</button>
          </form>
        )}
      </div>
      <p className="note">
        Signed in as {user.email}. <SignOutButton className="linkbtn" label="Not you? Sign out" />
      </p>
      {canManageBilling(sub) && !fixPayment && (
        <form action="/api/portal" method="post" className="note">
          <input type="hidden" name="from" value="/pricing" />
          <button className="linkbtn">Past invoices and billing details</button>
        </form>
      )}
    </div>
  );
}
