import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { canManageBilling, getSub, isActive } from "@/lib/billing";
import AnalyseClient from "./analyse-client";

export const dynamic = "force-dynamic";

export default async function Analyse() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/studio/analyse");
  const sub = await getSub(user.id);
  if (!isActive(sub)) redirect("/pricing");
  return <AnalyseClient email={user.email} showBilling={canManageBilling(sub)} />;
}
