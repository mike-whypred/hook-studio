import { sql } from "@/lib/db";
import { failure, paidUser } from "@/lib/guard";
import { getConnection, MetricoolError } from "@/lib/metricool";

type Body = {
  action?: "move" | "rename" | "hide";
  reelId?: unknown;
  groupId?: unknown;
  newLabel?: unknown;
  label?: unknown;
  hidden?: unknown;
};

const label = (v: unknown) => String(v ?? "").trim().slice(0, 60);

/** Fix the automatic grouping: move a reel, start a new group, rename a group, or hide a reel. */
export async function POST(req: Request) {
  const { user, deny } = await paidUser();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as Body | null;
  try {
    const conn = await getConnection(user.id);
    if (!conn?.blogId) throw new MetricoolError(conn ? "no_brand" : "not_connected");
    const blogId = conn.blogId;
    const owns = async (id: unknown) =>
      typeof id === "number" &&
      ((await sql`select 1 from reel_groups where id = ${id} and user_id = ${user.id} and blog_id = ${blogId}`) as unknown[]).length > 0;
    const reelId = String(body?.reelId ?? "").slice(0, 100);

    if (body?.action === "move" && reelId) {
      let groupId = body.groupId;
      if (label(body.newLabel)) {
        const [row] = (await sql`insert into reel_groups (user_id, blog_id, label)
                                 values (${user.id}, ${blogId}, ${label(body.newLabel)}) returning id`) as { id: number }[];
        groupId = row.id;
      } else if (!(await owns(groupId))) return Response.json({ error: "bad_input" }, { status: 400 });
      await sql`insert into reel_group_members (user_id, blog_id, reel_id, group_id)
                values (${user.id}, ${blogId}, ${reelId}, ${groupId as number})
                on conflict (user_id, blog_id, reel_id) do update set group_id = excluded.group_id, hidden = false`;
      // Groups left with no reels at all are removed.
      await sql`delete from reel_groups g where g.user_id = ${user.id} and g.blog_id = ${blogId}
                and not exists (select 1 from reel_group_members m where m.group_id = g.id)`;
      return Response.json({ ok: true, groupId });
    }
    if (body?.action === "rename" && label(body.label) && (await owns(body.groupId))) {
      await sql`update reel_groups set label = ${label(body.label)} where id = ${body.groupId as number}`;
      return Response.json({ ok: true });
    }
    if (body?.action === "hide" && reelId) {
      const hidden = body.hidden === true;
      await sql`insert into reel_group_members (user_id, blog_id, reel_id, hidden)
                values (${user.id}, ${blogId}, ${reelId}, ${hidden})
                on conflict (user_id, blog_id, reel_id) do update set hidden = excluded.hidden`;
      return Response.json({ ok: true });
    }
    return Response.json({ error: "bad_input" }, { status: 400 });
  } catch (err) {
    return failure(err);
  }
}
