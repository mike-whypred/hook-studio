import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { canManageBilling, getSub, isActive } from "@/lib/billing";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";

export default async function Studio({ searchParams }: PageProps<"/studio">) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/studio");
  const sub = await getSub(user.id);
  if (!isActive(sub)) redirect("/pricing");
  const { billing } = await searchParams;
  return (
    <StudioClient
      email={user.email}
      showBilling={canManageBilling(sub)}
      billingError={billing === "unavailable"}
    />
  );
}
