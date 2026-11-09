# Hook Studio

Hook Studio as a paid web app: Next.js on Vercel, Neon Postgres + Neon Auth for accounts, Stripe for subscriptions, Claude via the Anthropic SDK for hooks, revisions and captions.

## How it fits together

- `public/hook-studio.js`, `app/studio/markup.ts`, `app/studio/studio.css` are the original Hook Studio page, split out by `scripts/port-artifact.py`. The video work (preview, recording, zip) still runs entirely in the browser.
- `scripts/claude-shim.js` (prepended to `hook-studio.js`) replaces the artifact runtime's `claude.use("sample")` with calls to `/api/sample`.
- `/api/sample` checks the user is signed in and subscribed, applies a daily limit (`DAILY_AI_LIMIT`, default 300), and calls Claude with `@anthropic-ai/sdk` (`ANTHROPIC_MODEL`, default `claude-opus-5-5`). We never use Vercel AI Gateway.
- `/api/checkout`, `/api/portal`, `/api/stripe/webhook` handle the subscription. The webhook keeps the `subscriptions` table in sync.
- Hook writing references the team's Hook Masterlist. `data/hook-masterlist.md` is the source; `scripts/migrate.mjs` loads it into the `hook_references` table, and `/api/sample` adds a random sample of 60 (spread across categories) to every hook request. Edit the file and re-run the migration to update it.

## Env vars

Set by the Neon integration: `DATABASE_URL`, `NEON_AUTH_BASE_URL`. Added by hand: `ANTHROPIC_API_KEY`, `NEON_AUTH_COOKIE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`. Optional: `ANTHROPIC_MODEL`, `DAILY_AI_LIMIT`, `PLAN_PRICE_LABEL`, `APP_URL`.

## Local dev

```bash
vercel env pull .env.local --yes
node --env-file=.env.local scripts/migrate.mjs   # once
npm run dev
```

## Deploy on your own Vercel

You need accounts on Vercel, Stripe and the Claude Developer Platform. Install the Vercel CLI (`npm i -g vercel@latest`) and run `vercel login`.

1. **Install and link.** In this folder: `npm install`, then `vercel link` and choose to create a new project.
2. **Database and login.** Run `vercel integration add neon`. This sets `DATABASE_URL` and `NEON_AUTH_BASE_URL`. If `NEON_AUTH_BASE_URL` is missing from `vercel env ls`, turn on Auth for the database in the Neon console and copy its URL in.
3. **Stripe plan.** In Stripe, create a product with a monthly recurring price and copy its `price_...` id.
4. **Secrets.** Add each one for production, preview and development (`vercel env add NAME production`, and so on). See `.env.example`:
   `NEON_AUTH_COOKIE_SECRET` (`openssl rand -base64 32`), `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`. Set `PLAN_PRICE_LABEL` if the price isn't $19.
5. **Create the tables and load the hook masterlist.** Run `vercel env pull .env.local --yes`, then `node --env-file=.env.local scripts/migrate.mjs`. Re-run it whenever `data/hook-masterlist.md` changes.
6. **Deploy.** Run `vercel deploy --prod`.
7. **Stripe webhook.** In Stripe > Developers > Webhooks, add an endpoint at `https://<your-domain>/api/stripe/webhook` with these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`. Add its signing secret as `STRIPE_WEBHOOK_SECRET`, then run `vercel deploy --prod` again.
8. **Billing portal.** In Stripe > Settings > Billing > Customer portal, turn the portal on so the studio's Billing button works.

Test first with Stripe test-mode keys and card `4242 4242 4242 4242`, then switch to live keys.
