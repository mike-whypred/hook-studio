import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { hasAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function Pricing() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/pricing");
  if (await hasAccess(user.id)) redirect("/studio");

  return (
    <div className="wrap narrow" style={{ marginTop: 40 }}>
      <h1>Hook Studio</h1>
      <p className="lead">One plan with everything in it.</p>
      <div className="card-s">
        <h3>Creator</h3>
        <p className="price">
          {process.env.PLAN_PRICE_LABEL ?? "$19"} <small>/ month</small>
        </p>
        <ul className="ticks">
          <li>Unlimited videos and versions</li>
          <li>Hooks, revisions and captions written by Claude</li>
          <li>All 37 looks and 39 fonts</li>
          <li>Cancel any time</li>
        </ul>
        <form action="/api/checkout" method="post">
          <button className="btn" style={{ width: "100%" }}>Subscribe</button>
        </form>
      </div>
      <p className="note">Signed in as {user.email}.</p>
    </div>
  );
}
