# Hook Studio

Hook Studio as a paid web app: Next.js on Vercel, Neon Postgres + Neon Auth for accounts, Stripe for subscriptions, Claude via Vercel AI Gateway for hooks, revisions and captions.

## How it fits together

- `public/hook-studio.js`, `app/studio/markup.ts`, `app/studio/studio.css` are the original Hook Studio page, split out by `scripts/port-artifact.py`. The video work (preview, recording, zip) still runs entirely in the browser.
- `scripts/claude-shim.js` (prepended to `hook-studio.js`) replaces the artifact runtime's `claude.use("sample")` with calls to `/api/sample`.
- `/api/sample` checks the user is signed in and subscribed, applies a daily limit (`DAILY_AI_LIMIT`, default 300), and calls `AI_MODEL` (default `anthropic/claude-sonnet-5.5`).
- `/api/checkout`, `/api/portal`, `/api/stripe/webhook` handle the subscription. The webhook keeps the `subscriptions` table in sync.

## Env vars

Set by the Neon integration: `DATABASE_URL`, `NEON_AUTH_BASE_URL`. Added by hand: `NEON_AUTH_COOKIE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`. Optional: `AI_MODEL`, `DAILY_AI_LIMIT`, `PLAN_PRICE_LABEL`, `APP_URL`.

## Local dev

```bash
vercel env pull .env.local --yes
node --env-file=.env.local scripts/migrate.mjs   # once
npm run dev
```
