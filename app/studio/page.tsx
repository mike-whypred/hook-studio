import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { hasAccess } from "@/lib/billing";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";

export default async function Studio() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/studio");
  if (!(await hasAccess(user.id))) redirect("/pricing");
  return <StudioClient email={user.email} />;
}
