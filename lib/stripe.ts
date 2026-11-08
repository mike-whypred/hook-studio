import Stripe from "stripe";

let client: Stripe | null = null;

/** Created on first use so builds don't need the secret key. */
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
    return Reflect.get(client, prop, client);
  },
});

export function appUrl(req: Request) {
  return process.env.APP_URL ?? new URL(req.url).origin;
}
