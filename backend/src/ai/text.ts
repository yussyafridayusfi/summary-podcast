import { resolveTextChain, textNeedsKey, type TextProvider } from "./providers.ts";
import { mockCompletion } from "./mock.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  text: string;
  provider: TextProvider["id"];
  model: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
  }
}

export const NO_KEY_MESSAGE =
  "No AI key configured. Add a free GROQ_API_KEY or GEMINI_API_KEY to backend/.env (see .env.example), or set AI_TEXT_PROVIDER=mock to try the UI.";

async function callProvider(
  p: TextProvider,
  messages: ChatMessage[],
  wantJson: boolean,
  signal?: AbortSignal,
): Promise<ChatResult> {
  if (p.id === "mock") {
    await new Promise((r) => setTimeout(r, 900)); // feel like a real call
    return { text: mockCompletion(messages), provider: "mock", model: "mock" };
  }
  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    temperature: 0.6,
  };
  if (wantJson && p.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(p.apiKey && p.apiKey !== "anonymous" ? { authorization: `Bearer ${p.apiKey}` } : {}),
      ...(p.headers ?? {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new AiError(`${p.id} responded ${res.status}`, res.status, txt.slice(0, 500));
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError(`${p.id} returned an empty completion`);
  return { text, provider: p.id, model: json.model ?? p.model };
}

/**
 * Try each configured provider in order until one succeeds. Rate-limit and
 * server errors fall through to the next provider; a hard 4xx (bad key) also
 * falls through but is logged loudly.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; timeoutMs?: number } = {},
): Promise<ChatResult> {
  const chain = resolveTextChain();
  const errors: string[] = [];
  for (const p of chain) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
    try {
      return await callProvider(p, messages, !!opts.json, ctrl.signal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.id}: ${msg}`);
      console.warn(`[ai] ${p.id} failed → ${msg}`);
    } finally {
      clearTimeout(t);
    }
  }
  if (textNeedsKey()) {
    throw new AiError(NO_KEY_MESSAGE, 503, errors, "NO_PROVIDER");
  }
  const rateLimited = errors.some((e) => /\b429\b/.test(e));
  throw new AiError(
    rateLimited
      ? "The free model is rate-limited right now. Wait a moment and try again."
      : "All AI text providers failed",
    rateLimited ? 429 : 503,
    errors,
    rateLimited ? "RATE_LIMITED" : "PROVIDER_FAILED",
  );
}

/** Pull the first JSON object out of a (possibly fenced / chatty) reply. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AiError("Model did not return JSON", 502, text);
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
