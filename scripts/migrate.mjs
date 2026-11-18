// Creates the app's tables and loads the hook masterlist.
// Run once, and again after editing data/hook-masterlist.md:
//   node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";
import { readMasterlist } from "./hook-masterlist.mjs";

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
await sql`create table if not exists hook_references (
  id serial primary key,
  section text not null,
  category text not null,
  text text not null unique,
  created_at timestamptz not null default now()
)`;

// Analyse tab: each user's Metricool connection (token encrypted by lib/metricool.ts),
// how their reels are grouped by underlying video, and the last recommendation per group.
await sql`create table if not exists metricool_connections (
  user_id text primary key,
  mc_user_id text not null,
  token_enc text not null,
  blog_id text,
  brand_label text,
  brand_timezone text,
  updated_at timestamptz not null default now()
)`;
await sql`create table if not exists reel_groups (
  id serial primary key,
  user_id text not null,
  blog_id text not null,
  label text not null,
  created_at timestamptz not null default now()
)`;
await sql`create table if not exists reel_group_members (
  user_id text not null,
  blog_id text not null,
  reel_id text not null,
  group_id integer references reel_groups(id) on delete set null,
  hidden boolean not null default false,
  primary key (user_id, blog_id, reel_id)
)`;
await sql`create table if not exists reel_recommendations (
  group_id integer primary key references reel_groups(id) on delete cascade,
  result jsonb not null,
  reel_ids text[] not null,
  created_at timestamptz not null default now()
)`;

// The markdown file is the source of truth: add new hooks, update moved ones, drop removed ones.
const hooks = readMasterlist();
const texts = hooks.map((h) => h.text);
await sql.transaction([
  sql`delete from hook_references where not (text = any(${texts}::text[]))`,
  sql`insert into hook_references (section, category, text)
      select * from unnest(${hooks.map((h) => h.section)}::text[], ${hooks.map((h) => h.category)}::text[], ${texts}::text[])
      on conflict (text) do update set section = excluded.section, category = excluded.category`,
]);
const [{ n }] = await sql`select count(*)::int as n from hook_references`;
console.log(`tables ready, ${n} reference hooks loaded`);
