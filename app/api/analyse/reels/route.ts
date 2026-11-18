import { takeAiCall } from "@/lib/billing";
import { sql } from "@/lib/db";
import { failure, paidUser } from "@/lib/guard";
import { fetchReels, getConnection, localStamp, MetricoolError, type Reel } from "@/lib/metricool";
import { groupNewReels, loadGrouping, type Recommendation } from "@/lib/reel-analysis";
import { benchmark } from "@/lib/reel-bench";

// Grouping new reels reads their covers with Claude, which can take a while.
export const maxDuration = 300;

const RANGES = new Set([7, 30, 90]);

/** Recent reels, grouped by underlying video, with benchmarks and the last recommendation per group. */
export async function GET(req: Request) {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  const days = Number(new URL(req.url).searchParams.get("days"));
  if (!RANGES.has(days)) return Response.json({ error: "bad_input" }, { status: 400 });

  try {
    const conn = await getConnection(user.id);
    if (!conn) throw new MetricoolError("not_connected");
    if (!conn.blogId) throw new MetricoolError("no_brand");
    const reels = await fetchReels(conn, days);
    const blogId = conn.blogId;

    // Place reels we haven't seen before into groups (one Claude call per batch).
    let grouping: "ok" | "failed" | "rate_limited" = "ok";
    const { members: before } = await loadGrouping(user.id, blogId);
    if (reels.some((r) => !before.has(r.id))) {
      if (!(await takeAiCall(user.id))) grouping = "rate_limited";
      else if (!(await groupNewReels(user.id, blogId, reels))) grouping = "failed";
    }

    const { groups, members } = await loadGrouping(user.id, blogId);
    const recs = (await sql`select r.group_id, r.result, r.reel_ids, r.created_at
                            from reel_recommendations r join reel_groups g on g.id = r.group_id
                            where g.user_id = ${user.id} and g.blog_id = ${blogId}`) as {
      group_id: number;
      result: Recommendation;
      reel_ids: string[];
      created_at: string;
    }[];
    const recBy = new Map(recs.map((r) => [r.group_id, r]));
    const nowLocal = localStamp(new Date(), conn.timezone);

    const inGroup = new Map<number, Reel[]>();
    const ungrouped: Reel[] = [];
    const hidden: Reel[] = [];
    for (const r of reels) {
      const m = members.get(r.id);
      if (m?.hidden) hidden.push(r);
      else if (m?.group_id) inGroup.set(m.group_id, [...(inGroup.get(m.group_id) ?? []), r]);
      else ungrouped.push(r);
    }

    const out = groups
      .filter((g) => inGroup.has(g.id))
      .map((g) => {
        const bench = benchmark(inGroup.get(g.id)!, nowLocal);
        const rec = recBy.get(g.id);
        return {
          id: g.id,
          label: g.label,
          bench,
          latestPost: bench.reels[bench.reels.length - 1].postedAt,
          rec: rec
            ? {
                result: rec.result,
                at: rec.created_at,
                newSince: bench.reels.filter((r) => !rec.reel_ids.includes(r.id)).map((r) => r.id),
              }
            : null,
        };
      })
      .sort((a, b) => b.latestPost.localeCompare(a.latestPost));

    return Response.json({
      brand: { label: conn.brandLabel, timezone: conn.timezone },
      days,
      total: reels.length,
      groups: out,
      allGroups: groups,
      ungrouped,
      hidden,
      grouping,
    });
  } catch (err) {
    return failure(err);
  }
}
