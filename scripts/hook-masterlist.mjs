// Reads data/hook-masterlist.md into [{ section, category, text }].
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function readMasterlist(path = new URL("../data/hook-masterlist.md", import.meta.url)) {
  const md = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const hooks = [];
  const seen = new Set();
  let section = "", category = "";
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("# ")) [section, category] = [line.slice(2).trim(), ""];
    else if (line.startsWith("## ")) category = line.slice(3).trim();
    else if (line.startsWith("- ")) {
      const text = line.slice(2).trim();
      if (!section || !category) throw new Error(`hook outside a section/category: ${text}`);
      if (text && !seen.has(text)) {
        seen.add(text);
        hooks.push({ section, category, text });
      }
    }
  }
  return hooks;
}

// `node scripts/hook-masterlist.mjs` prints a count per category, as a check.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const hooks = readMasterlist();
  const counts = {};
  for (const h of hooks) counts[`${h.section} / ${h.category}`] = (counts[`${h.section} / ${h.category}`] ?? 0) + 1;
  console.table(counts);
  console.log(hooks.length, "hooks");
}
