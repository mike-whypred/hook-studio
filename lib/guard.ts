import { currentUser } from "@/lib/auth/server";
import { hasAccess } from "@/lib/billing";
import { MetricoolError } from "@/lib/metricool";

/** The signed-in, subscribed user, or the response to send instead. */
export async function paidUser() {
  const user = await currentUser();
  if (!user) return { user: null, deny: Response.json({ error: "sign_in" }, { status: 401 }) } as const;
  if (!(await hasAccess(user.id))) return { user: null, deny: Response.json({ error: "subscribe" }, { status: 402 }) } as const;
  return { user, deny: null } as const;
}

const STATUS: Record<MetricoolError["code"], number> = {
  not_configured: 503,
  not_connected: 400,
  bad_token: 400,
  no_brand: 400,
  unavailable: 502,
};

/** Turns a thrown error into a JSON response the Analyse page understands. */
export function failure(err: unknown) {
  if (err instanceof MetricoolError) {
    if (err.code === "unavailable") console.error("metricool", err.message);
    return Response.json({ error: err.code }, { status: STATUS[err.code] });
  }
  console.error("analyse failed", err);
  return Response.json({ error: "failed" }, { status: 500 });
}
