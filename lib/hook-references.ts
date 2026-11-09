import { sql } from "@/lib/db";

type Ref = { category: string; text: string };

/** How many masterlist hooks go into each hook request. */
const SAMPLE_SIZE = 60;
const CACHE_MS = 10 * 60 * 1000;

let cache: { at: number; byCategory: Map<string, string[]> } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byCategory;
  const rows = (await sql`select category, text from hook_references order by id`) as Ref[];
  const byCategory = new Map<string, string[]>();
  for (const r of rows) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r.text]);
  cache = { at: Date.now(), byCategory };
  return byCategory;
}

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** A fresh random pick each call, spread across every category so each batch of hooks gets new angles. */
async function sample(): Promise<Ref[]> {
  const pools = shuffle([...(await load())]).map(([category, texts]) => ({ category, texts: shuffle(texts) }));
  const out: Ref[] = [];
  // Round-robin: one from each category in turn until the sample is full or every category is used up.
  for (let round = 0; out.length < SAMPLE_SIZE; round++) {
    const before = out.length;
    for (const p of pools) {
      const text = p.texts[round];
      if (text && out.length < SAMPLE_SIZE) out.push({ category: p.category, text });
    }
    if (out.length === before) break;
  }
  return out;
}

/**
 * Masterlist hooks to append to a hook-writing prompt, or "" if the table is empty or unavailable
 * (so hook writing still works before the migration has been run).
 */
export async function referenceBlock() {
  try {
    const refs = await sample();
    if (!refs.length) return "";
    const lines = refs.map((r) => `- [${r.category}] ${r.text}`).join("\n");
    return `

Reference hooks from our team's masterlist of hooks that have worked. They are templates: x, ___ and [brackets] are blanks.
Use them for structure, rhythm and angle ideas. Fill any blank with this video's specifics, never copy one word for word, and only use a template when it fits the video.
${lines}

Everything above still applies: same length rules, same kinds and tone, and reply with only the JSON array of 10 strings.`;
  } catch (err) {
    console.error("hook references unavailable", err instanceof Error ? err.message : err);
    return "";
  }
}
