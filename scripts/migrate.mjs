// Creates the app's tables. Run once: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`create table if not exists subscriptions (
  user_id text primary key,
  stripe_customer_id text not null unique,
  stripe_subscription_id text,
  status text not null default 'none',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
)`;
await sql`create table if not exists ai_usage (
  user_id text not null,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, day)
)`;
console.log("tables ready");
