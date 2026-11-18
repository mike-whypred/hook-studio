// Benchmarks for a group of reels that share the same underlying video.
// Pure functions, so the server and the Analyse page agree on the numbers.
import type { Reel } from "./metricool";

export type BenchReel = Reel & {
  ageHours: number;
  best: boolean; // most views in the group
  heldBack: boolean; // far fewer views than an earlier version: likely flagged as a duplicate
  tooNew: boolean; // under a day old, so its numbers are still moving
};

export type Bench = {
  reels: BenchReel[]; // oldest first
  bestViews: number;
  latest: { id: string; viewsVsBest: number | null; skipVsBest: number | null } | null;
  heldBackCount: number;
};

/** Hours between a "YYYY-MM-DDTHH:MM:SS" posting time and "now" written in the same timezone. */
export function hoursBetween(postedLocal: string, nowLocal: string) {
  const a = Date.parse(postedLocal + "Z"),
    b = Date.parse(nowLocal + "Z");
  return isFinite(a) && isFinite(b) ? Math.max(0, (b - a) / 3_600_000) : 0;
}

export function benchmark(reels: Reel[], nowLocal: string): Bench {
  const sorted = [...reels].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const bestViews = Math.max(0, ...sorted.map((r) => r.views));
  let earlierBest = 0;
  const out: BenchReel[] = sorted.map((r) => {
    const ageHours = hoursBetween(r.postedAt, nowLocal);
    const tooNew = ageHours < 24;
    const heldBack = !tooNew && earlierBest >= 500 && r.views < Math.max(30, earlierBest * 0.02);
    earlierBest = Math.max(earlierBest, r.views);
    return { ...r, ageHours, tooNew, heldBack, best: r.views === bestViews && bestViews > 0 };
  });

  let latest: Bench["latest"] = null;
  if (out.length > 1) {
    const last = out[out.length - 1];
    const prev = out.slice(0, -1).reduce((a, b) => (b.views > a.views ? b : a));
    latest = {
      id: last.id,
      viewsVsBest: prev.views ? last.views / prev.views : null,
      skipVsBest: last.skipRate !== null && prev.skipRate !== null ? last.skipRate - prev.skipRate : null,
    };
  }
  return { reels: out, bestViews, latest, heldBackCount: out.filter((r) => r.heldBack).length };
}
