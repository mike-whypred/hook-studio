import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import type { Reel } from "@/lib/metricool";
import type { Bench } from "@/lib/reel-bench";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

type Block = Anthropic.Beta.BetaContentBlockParam;

/** Pull the first JSON object out of a reply. */
function parseObject(text: string): Record<string, unknown> | null {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return tryParse(t) ?? tryParse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
}

async function ask(content: Block[], effort: "low" | "medium"): Promise<Record<string, unknown> | null> {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort },
    // If a safety check declines the request, the API retries it on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: "Reply with only valid JSON, no prose and no code fences.",
    messages: [{ role: "user", content }],
  });
  if (msg.stop_reason === "refusal") return null;
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const out = parseObject(text);
  if (!out) console.warn("analysis reply not JSON", { stop: msg.stop_reason, start: text.slice(0, 200) });
  return out;
}

/** The reel's cover image as an image block, or null if Instagram's CDN won't give it to us. */
async function thumbBlock(url: string | null): Promise<Block | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    return {
      type: "image",
      source: { type: "base64", media_type: type as "image/jpeg", data: buf.toString("base64") },
    };
  } catch {
    return null;
  }
}

const short = (s: string, n = 160) => (s.length > n ? s.slice(0, n) + "…" : s).replace(/\s+/g, " ");

/* ---------- grouping: which reels are versions of the same video ---------- */

export type Group = { id: number; label: string };
type Member = { reel_id: string; group_id: number | null; hidden: boolean };

export async function loadGrouping(userId: string, blogId: string) {
  const groups = (await sql`select id, label from reel_groups where user_id = ${userId} and blog_id = ${blogId} order by id`) as Group[];
  const members = (await sql`select reel_id, group_id, hidden from reel_group_members
                             where user_id = ${userId} and blog_id = ${blogId}`) as Member[];
  return { groups, members: new Map(members.map((m) => [m.reel_id, m])) };
}

const BATCH = 24;

/**
 * Sort reels that haven't been seen before into groups, one group per underlying video.
 * Reads cover images and captions. Returns false if Claude couldn't do it this time
 * (the reels stay ungrouped and are tried again on the next load).
 */
export async function groupNewReels(userId: string, blogId: string, reels: Reel[]): Promise<boolean> {
  const { groups, members } = await loadGrouping(userId, blogId);
  const fresh = reels.filter((r) => !members.has(r.id));
  if (!fresh.length) return true;

  // One recent cover per existing group, so Claude can match new reels to it.
  const byGroup = new Map<number, Reel>();
  for (const r of reels) {
    const m = members.get(r.id);
    if (m?.group_id && !byGroup.has(m.group_id)) byGroup.set(m.group_id, r);
  }
  const known = groups.filter((g) => byGroup.has(g.id)).slice(0, 24);

  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const content: Block[] = [
      {
        type: "text",
        text: `These are Instagram reels from one creator. Creators post the same filmed video several times as trial reels, each with different on-screen hook text, a different opening clip, music, speed, mirroring or caption. Group the reels by the underlying filmed footage: same person, outfit, setting and moment means the same video, even when the text on screen or the caption is different. Different footage is a different video, even on the same topic.`,
      },
    ];
    if (known.length) content.push({ type: "text", text: "Existing groups, each shown with one of its reels:" });
    for (const g of known) {
      const r = byGroup.get(g.id)!;
      const img = await thumbBlock(r.thumb);
      if (img) content.push(img);
      content.push({ type: "text", text: `GROUP ${g.id}: "${g.label}". Caption of this reel: ${short(r.caption)}` });
    }
    content.push({ type: "text", text: "New reels to place:" });
    for (const r of batch) {
      const img = await thumbBlock(r.thumb);
      if (img) content.push(img);
      content.push({
        type: "text",
        text: `REEL ${r.id}: posted ${r.postedAt}${r.duration ? `, ${r.duration}s long` : ""}${img ? "" : " (no cover image)"}. Caption: ${short(r.caption)}`,
      });
    }
    content.push({
      type: "text",
      text: `Reply with {"assign":[{"reel":"<REEL id>","group":<existing GROUP id>} or {"reel":"<REEL id>","new":"<short label for a new group>"}]}. Give every new reel exactly one entry. New reels that share footage with each other get the same "new" label. A label names the footage in under 6 words, like "Clear aligner talk, pink top".`,
    });

    let out: Record<string, unknown> | null = null;
    try {
      out = await ask(content, "low");
    } catch (err) {
      console.error("grouping failed", err instanceof Error ? err.message : err);
    }
    const assign = Array.isArray(out?.assign) ? (out!.assign as Record<string, unknown>[]) : null;
    if (!assign) return false;

    const ids = new Set(batch.map((r) => r.id));
    const knownIds = new Set(groups.map((g) => g.id));
    const made = new Map<string, number>();
    for (const a of assign) {
      const reel = String(a.reel ?? "");
      if (!ids.has(reel)) continue;
      ids.delete(reel);
      let gid = typeof a.group === "number" && knownIds.has(a.group) ? a.group : null;
      if (!gid) {
        const label = short(String(a.new || "Untitled video"), 60);
        gid = made.get(label) ?? null;
        if (!gid) {
          const [row] = (await sql`insert into reel_groups (user_id, blog_id, label)
                                   values (${userId}, ${blogId}, ${label}) returning id`) as { id: number }[];
          gid = row.id;
          made.set(label, gid);
          groups.push({ id: gid, label });
          knownIds.add(gid);
        }
      }
      await sql`insert into reel_group_members (user_id, blog_id, reel_id, group_id)
                values (${userId}, ${blogId}, ${reel}, ${gid})
                on conflict (user_id, blog_id, reel_id) do nothing`;
    }
    // Anything Claude skipped stays ungrouped and is retried next time.
  }
  return true;
}

/* ---------- recommendations for one group ---------- */

export type Recommendation = {
  summary: string;
  verdicts: { reel: string; note: string }[];
  changes: { what: string; change: string; why: string }[];
  next: "remake" | "edit_yourself" | "reshoot" | "leave_it";
  remake: { hooks: string[]; avoid: string[]; description: string; studioNotes: string[] } | null;
  manualSteps: string[];
};

const CAN = `Hook Studio can do these automatically when remaking: write new on-screen hook text, change the look and position of that text, open each version on a different clip from the same video, add a different song under the voice, change speed (0.9x to 1.1x, voice pitch follows), brightness, mirroring, a slow zoom in the opening, and trimming up to 0.8s off the start. It cannot film new footage, cut or rearrange the middle of the video, record a new voiceover, remove text or captions already burned into the footage, or add the Instagram in-app sound.`;

export async function recommend(label: string, bench: Bench, account: { medianViews: number; medianSkip: number | null }): Promise<Recommendation | null> {
  const content: Block[] = [
    {
      type: "text",
      text: `You are reviewing trial reels for a content creator. All reels below are versions of the same filmed video ("${label}"), posted at different times with different on-screen hook text, openings, music or captions. Instagram shows trial reels to non-followers only, and it holds back reels it sees as duplicates of something already posted (views near zero after an earlier version did well).

How to read the numbers: skip rate is the share of viewers who swiped away in the first 3 seconds, so it judges the hook and opening (lower is better). Average watch time and shares/saves judge the rest of the video. The creator's other reels from the same period have a median of ${account.medianViews} views${account.medianSkip !== null ? ` and a median skip rate of ${account.medianSkip.toFixed(1)}%` : ""}.

${CAN}`,
    },
  ];
  for (const r of bench.reels.slice(-12)) {
    const img = await thumbBlock(r.thumb);
    if (img) content.push(img);
    content.push({
      type: "text",
      text: `REEL ${r.id}, posted ${r.postedAt}${r.tooNew ? " (under a day old, numbers still moving)" : ""}${r.heldBack ? " (looks held back as a duplicate)" : ""}${r.best ? " (best in group)" : ""}: views ${r.views}, reach ${r.reach}, skip rate ${r.skipRate ?? "n/a"}%, average watch ${r.avgWatch ?? "n/a"}s${r.duration ? ` of ${r.duration}s` : ""}, shares ${r.shares}, saves ${r.saves}, likes ${r.likes}, comments ${r.comments}. Caption: ${short(r.caption, 300)}`,
    });
  }
  content.push({
    type: "text",
    text: `Work out what is driving the difference between versions, what to change before posting this video again, and whether it should be posted again at all. Be concrete and plain: name the hook styles that won and lost, by reading the text on each cover. If versions were held back as duplicates, say that more copies of the same cut will likely be held back too, and say what has to change for Instagram to see it as new.

Reply with this JSON:
{"summary":"2-3 sentences","verdicts":[{"reel":"<REEL id>","note":"one sentence on why it did well or badly"}],"changes":[{"what":"hook|opening|sound|pacing|caption|footage|timing","change":"what to do","why":"which numbers show it"}],"next":"remake|edit_yourself|reshoot|leave_it","remake":{"hooks":["8 new on-screen hooks in the style of the winners, lowercase, 2 or 3 short lines each, lines separated by \\n"],"avoid":["hook lines that flopped"],"description":"one sentence describing the video for the hook writer","studioNotes":["settings to use in Hook Studio, e.g. a new song for every version, open on a clip not used before"]},"manualSteps":["steps the creator must do themselves outside Hook Studio, if any"]}
Use "remake" when Hook Studio's automatic changes are enough. Use "edit_yourself" when the fix needs edits Hook Studio can't do, and list them in manualSteps. Use "reshoot" when the footage itself is worn out or the idea is not working. Use "leave_it" when a version is doing well and nothing needs reposting yet. Set "remake" to null unless next is "remake" or "edit_yourself".`,
  });

  const out = await ask(content, "medium");
  if (!out || typeof out.summary !== "string") return null;
  const strs = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  const rm = out.remake && typeof out.remake === "object" ? (out.remake as Record<string, unknown>) : null;
  const next = ["remake", "edit_yourself", "reshoot", "leave_it"].includes(out.next as string)
    ? (out.next as Recommendation["next"])
    : "edit_yourself";
  return {
    summary: out.summary,
    verdicts: (Array.isArray(out.verdicts) ? out.verdicts : []).map((v: Record<string, unknown>) => ({
      reel: String(v.reel ?? ""),
      note: String(v.note ?? ""),
    })),
    changes: (Array.isArray(out.changes) ? out.changes : []).map((c: Record<string, unknown>) => ({
      what: String(c.what ?? ""),
      change: String(c.change ?? ""),
      why: String(c.why ?? ""),
    })),
    next,
    remake: rm
      ? {
          hooks: strs(rm.hooks).slice(0, 12),
          avoid: strs(rm.avoid).slice(0, 12),
          description: String(rm.description ?? ""),
          studioNotes: strs(rm.studioNotes).slice(0, 8),
        }
      : null,
    manualSteps: strs(out.manualSteps).slice(0, 10),
  };
}

export const median = (xs: number[]) => {
  const s = xs.filter((x) => isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
