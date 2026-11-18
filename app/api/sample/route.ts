import Anthropic from "@anthropic-ai/sdk";
import { currentUser } from "@/lib/auth/server";
import { hasAccess, takeAiCall } from "@/lib/billing";
import { referenceBlock } from "@/lib/hook-references";

// Claude thinks before it writes, so a reply can take a minute or more.
// Without this, Vercel can cut the request off first and the studio shows an error.
export const maxDuration = 300;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const MAX_PROMPT = 24_000;

/** Hook replies should be a list; accept one wrapped in an object like {"hooks": [...]}. */
function asList(value: unknown): unknown {
  if (Array.isArray(value) || !value || typeof value !== "object") return value;
  const lists = Object.values(value).filter(Array.isArray);
  return lists.length === 1 ? lists[0] : value;
}

/** Pull the first JSON array or object out of a model reply. */
function parseJson(text: string): unknown {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.search(/[[{]/);
    const end = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "sign_in" }, { status: 401 });
  if (!(await hasAccess(user.id))) return Response.json({ error: "subscribe" }, { status: 402 });

  const body = (await req.json().catch(() => null)) as { prompt?: unknown; task?: unknown } | null;
  let prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > MAX_PROMPT) return Response.json({ error: "bad_prompt" }, { status: 400 });
  // Hook writing gets a fresh sample of the team's masterlist hooks as reference.
  if (body?.task === "hooks") prompt += await referenceBlock();

  if (!(await takeAiCall(user.id))) return Response.json({ error: "rate_limited" }, { status: 429 });

  const started = Date.now();
  const secs = () => ((Date.now() - started) / 1000).toFixed(1);
  try {
    const msg = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        // If a safety check declines the request, the API retries it on a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: "Reply with only valid JSON, no prose and no code fences.",
        messages: [{ role: "user", content: prompt }],
      },
      { signal: req.signal },
    );
    if (msg.stop_reason === "refusal") {
      console.warn("sample refused", { task: body?.task, category: msg.stop_details?.category, secs: secs() });
      return Response.json({ result: null });
    }
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    let result = parseJson(text);
    if (body?.task === "hooks") result = asList(result);
    const usable = body?.task === "hooks" ? Array.isArray(result) : result !== null;
    if (!usable) {
      // Logged so a failure shows up in the Vercel logs with its cause.
      console.warn("sample reply unusable", { task: body?.task, stop: msg.stop_reason, secs: secs(), start: text.slice(0, 200) });
      // A garbled hook list is a failure the studio can retry, not an empty answer.
      if (body?.task === "hooks") return Response.json({ error: "bad_reply" }, { status: 502 });
    }
    return Response.json({ result });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (err instanceof Anthropic.APIError) console.error("anthropic error", err.status, err.message, { secs: secs() });
    else console.error("sample failed", err, { secs: secs() });
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
