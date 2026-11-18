import { takeAiCall } from "@/lib/billing";
import { sql } from "@/lib/db";
import { failure, paidUser } from "@/lib/guard";
import { fetchReels, getConnection, localStamp, MetricoolError } from "@/lib/metricool";
import { median, recommend } from "@/lib/reel-analysis";
import { benchmark } from "@/lib/reel-bench";

export const maxDuration = 300;

/** Recommend changes for one group of reels: { groupId }. Looks back 90 days so older versions count too. */
export async function POST(req: Request) {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { groupId?: unknown } | null;
  const groupId = typeof body?.groupId === "number" ? body.groupId : NaN;
  try {
    const conn = await getConnection(user.id);
    if (!conn?.blogId) throw new MetricoolError(conn ? "no_brand" : "not_connected");
    const [group] = (await sql`select id, label from reel_groups
                               where id = ${groupId} and user_id = ${user.id} and blog_id = ${conn.blogId}`) as {
      id: number;
      label: string;
    }[];
    if (!group) return Response.json({ error: "bad_input" }, { status: 400 });

    const ids = new Set(
      ((await sql`select reel_id from reel_group_members where group_id = ${group.id} and not hidden`) as { reel_id: string }[]).map(
        (r) => r.reel_id,
      ),
    );
    const all = await fetchReels(conn, 90);
    const reels = all.filter((r) => ids.has(r.id));
    if (!reels.length) return Response.json({ error: "no_reels" }, { status: 400 });

    const others = all.filter((r) => !ids.has(r.id));
    const account = {
      medianViews: Math.round(median(others.map((r) => r.views)) ?? 0),
      medianSkip: median(others.filter((r) => r.skipRate !== null).map((r) => r.skipRate!)),
    };
    if (!(await takeAiCall(user.id))) return Response.json({ error: "rate_limited" }, { status: 429 });

    const bench = benchmark(reels, localStamp(new Date(), conn.timezone));
    const result = await recommend(group.label, bench, account);
    if (!result) return Response.json({ error: "ai_failed" }, { status: 502 });
    const reelIds = reels.map((r) => r.id);
    await sql`insert into reel_recommendations (group_id, result, reel_ids)
              values (${group.id}, ${JSON.stringify(result)}::jsonb, ${reelIds}::text[])
              on conflict (group_id) do update set result = excluded.result, reel_ids = excluded.reel_ids, created_at = now()`;
    return Response.json({ result, at: new Date().toISOString(), newSince: [] });
  } catch (err) {
    return failure(err);
  }
}
