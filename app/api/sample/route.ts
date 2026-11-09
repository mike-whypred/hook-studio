import Anthropic from "@anthropic-ai/sdk";
import { currentUser } from "@/lib/auth/server";
import { hasAccess, takeAiCall } from "@/lib/billing";
import { referenceBlock } from "@/lib/hook-references";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const MAX_PROMPT = 24_000;

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
    if (msg.stop_reason === "refusal") return Response.json({ result: null });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json({ result: parseJson(text) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (err instanceof Anthropic.APIError) console.error("anthropic error", err.status, err.message);
    else console.error("sample failed", err);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
