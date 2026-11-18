import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

/*
 * Metricool's REST API (https://app.metricool.com/resources/apidocs/index.html).
 * Every call sends the user's API token in the X-Mc-Auth header, plus their
 * Metricool userId and, for brand data, the brand's blogId as query parameters.
 */
const API = "https://app.metricool.com/api";

export class MetricoolError extends Error {
  constructor(
    public code: "not_configured" | "not_connected" | "bad_token" | "no_brand" | "unavailable",
    message: string = code,
  ) {
    super(message);
  }
}

// Tokens are stored encrypted (AES-256-GCM) with a key from METRICOOL_TOKEN_KEY.
function key() {
  const secret = process.env.METRICOOL_TOKEN_KEY;
  if (!secret) throw new MetricoolError("not_configured");
  return createHash("sha256").update(secret).digest();
}
function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}
function decrypt(stored: string) {
  const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
export const metricoolConfigured = () => !!process.env.METRICOOL_TOKEN_KEY;

export type Connection = {
  userId: string;
  mcUserId: string;
  token: string;
  blogId: string | null;
  brandLabel: string | null;
  timezone: string;
};

export async function getConnection(userId: string): Promise<Connection | null> {
  const rows = (await sql`select * from metricool_connections where user_id = ${userId}`) as {
    mc_user_id: string;
    token_enc: string;
    blog_id: string | null;
    brand_label: string | null;
    brand_timezone: string | null;
  }[];
  const r = rows[0];
  if (!r) return null;
  return {
    userId,
    mcUserId: r.mc_user_id,
    token: decrypt(r.token_enc),
    blogId: r.blog_id,
    brandLabel: r.brand_label,
    timezone: r.brand_timezone || "UTC",
  };
}

export async function saveConnection(userId: string, mcUserId: string, token: string) {
  await sql`insert into metricool_connections (user_id, mc_user_id, token_enc)
            values (${userId}, ${mcUserId}, ${encrypt(token)})
            on conflict (user_id) do update
            set mc_user_id = excluded.mc_user_id, token_enc = excluded.token_enc,
                blog_id = null, brand_label = null, brand_timezone = null, updated_at = now()`;
}

export async function chooseBrand(userId: string, brand: Brand) {
  await sql`update metricool_connections
            set blog_id = ${brand.id}, brand_label = ${brand.label}, brand_timezone = ${brand.timezone}, updated_at = now()
            where user_id = ${userId}`;
}

export async function removeConnection(userId: string) {
  await sql`delete from metricool_connections where user_id = ${userId}`;
}

async function call(token: string, path: string, query: Record<string, string>) {
  const url = `${API}${path}?${new URLSearchParams(query)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-Mc-Auth": token, accept: "application/json" }, cache: "no-store" });
  } catch {
    throw new MetricoolError("unavailable", "Metricool couldn't be reached");
  }
  if (res.status === 401 || res.status === 403) throw new MetricoolError("bad_token");
  if (!res.ok) throw new MetricoolError("unavailable", `Metricool returned ${res.status} for ${path}`);
  return res.json();
}

export type Brand = { id: string; label: string; instagram: string; timezone: string; picture: string | null };

/** The user's Metricool brands that have Instagram connected. */
export async function listBrands(token: string, mcUserId: string): Promise<Brand[]> {
  const data = await call(token, "/admin/simpleProfiles", { userId: mcUserId });
  const list = (Array.isArray(data) ? data : (data?.data ?? [])) as Record<string, unknown>[];
  return list
    .filter((b) => b.instagram && !b.deleted)
    .map((b) => ({
      id: String(b.id),
      label: String(b.label || b.instagram),
      instagram: String(b.instagram),
      timezone: String(b.timezone || "UTC"),
      picture: (b.instagramPicture || b.picture || null) as string | null,
    }));
}

export type Reel = {
  id: string;
  url: string;
  caption: string;
  thumb: string | null;
  postedAt: string; // local date-time in the brand's timezone, e.g. 2026-11-15T05:09:39
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  avgWatch: number | null; // seconds
  duration: number | null; // seconds
  skipRate: number | null; // % who swiped away in the first 3 seconds
};

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const maybe = (v: unknown) => (v === null || v === undefined || v === "" ? null : num(v));

export function toReel(r: Record<string, unknown>): Reel {
  const published = r.publishedAt as { dateTime?: string } | string | undefined;
  return {
    id: String(r.reelId ?? r.businessId ?? r.url),
    url: String(r.url ?? ""),
    caption: String(r.content ?? ""),
    thumb: (r.imageUrl as string) || null,
    postedAt: typeof published === "string" ? published : (published?.dateTime ?? ""),
    views: num(r.views ?? r.videoViews),
    reach: num(r.reach),
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    saves: num(r.saved),
    avgWatch: maybe(r.averageWatchTime),
    duration: maybe(r.durationSeconds),
    skipRate: maybe(r.reelsSkipRate),
  };
}

/** "YYYY-MM-DDTHH:MM:SS" for a moment, as the clock reads in the given timezone. */
export function localStamp(d: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** Instagram reels posted in the last `days` days, newest first. */
export async function fetchReels(conn: Connection, days: number): Promise<Reel[]> {
  if (!conn.blogId) throw new MetricoolError("no_brand");
  const now = new Date();
  const query = {
    userId: conn.mcUserId,
    blogId: conn.blogId,
    from: localStamp(new Date(now.getTime() - days * 86_400_000), conn.timezone),
    to: localStamp(now, conn.timezone),
    timezone: conn.timezone,
  };
  const out: Reel[] = [];
  let data = await call(conn.token, "/v2/analytics/reels/instagram", query);
  for (let page = 0; page < 10; page++) {
    const rows = (Array.isArray(data) ? data : (data?.data ?? data?.page?.data ?? [])) as Record<string, unknown>[];
    out.push(...rows.map(toReel));
    const next = data?.page?.next as string | undefined;
    if (!next || !next.startsWith(API)) break;
    const u = new URL(next);
    data = await call(conn.token, u.pathname.replace(/^\/api/, ""), Object.fromEntries(u.searchParams));
  }
  const seen = new Set<string>();
  return out
    .filter((r) => r.id && !seen.has(r.id) && seen.add(r.id))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
