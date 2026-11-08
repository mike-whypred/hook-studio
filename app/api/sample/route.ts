import { generateText } from "ai";
import { currentUser } from "@/lib/auth/server";
import { hasAccess, takeAiCall } from "@/lib/billing";

const MODEL = process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5";
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

  const body = (await req.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt || prompt.length > MAX_PROMPT) return Response.json({ error: "bad_prompt" }, { status: 400 });

  if (!(await takeAiCall(user.id))) return Response.json({ error: "rate_limited" }, { status: 429 });

  try {
    const { text } = await generateText({
      model: MODEL,
      instructions: "Reply with only valid JSON, no prose and no code fences.",
      prompt,
      abortSignal: req.signal,
    });
    return Response.json({ result: parseJson(text) });
  } catch (err) {
    console.error("sample failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
