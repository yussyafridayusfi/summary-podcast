/**
 * Provider-agnostic text generation.
 *
 * Picks whichever provider has a key configured in the environment, so the app
 * isn't tied to one vendor. Image generation is separate (see image.ts) because
 * Pollinations serves images without any key.
 */

export type TextProviderName = "gemini" | "groq" | "openai-compatible";

export interface TextProvider {
  name: TextProviderName;
  model: string;
}

/** Thrown when no provider key is configured, so callers can return a 503 with guidance. */
export class NoProviderError extends Error {
  constructor() {
    super(
      "No AI text provider configured. Set GEMINI_API_KEY (aistudio.google.com), " +
        "GROQ_API_KEY (console.groq.com), or OPENAI_API_KEY + OPENAI_BASE_URL in backend/.env.",
    );
    this.name = "NoProviderError";
  }
}

/** Thrown when the upstream provider rejects the request, preserving its status. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Raised when the model stopped because it hit the output-token ceiling. The
 * partial text is discarded on purpose: a half-written HTML document would
 * otherwise be rasterised and downloaded as if it were complete.
 */
export class TruncatedError extends Error {
  readonly status = 502;
  constructor() {
    super(
      "The model hit its output limit and returned an incomplete result. " +
        "Try again, or shorten the notes / summary text.",
    );
    this.name = "TruncatedError";
  }
}

export function resolveProvider(): TextProvider | null {
  if (process.env.GEMINI_API_KEY) {
    return {
      name: "gemini",
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      name: "openai-compatible",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }
  return null;
}

// Sketchnote generation on a free-tier model routinely runs 45-70s, so a 60s
// ceiling cut off requests that were about to succeed.
const TIMEOUT_MS = 180_000;

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ProviderError(
      `provider returned ${res.status}: ${text.slice(0, 400)}`,
      res.status,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("provider returned non-JSON response", 502);
  }
}

/**
 * Generates text from a system + user prompt pair. Returns plain text.
 */
export async function generateText(
  system: string,
  user: string,
  opts: { maxTokens?: number } = {},
): Promise<{ text: string; provider: TextProviderName; model: string }> {
  const provider = resolveProvider();
  if (!provider) throw new NoProviderError();
  const maxTokens = opts.maxTokens ?? 4096;

  if (provider.name === "gemini") {
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      },
      { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    )) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
    };
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new ProviderError("provider returned empty text", 502);
    if (candidate?.finishReason === "MAX_TOKENS") throw new TruncatedError();
    return { text, provider: provider.name, model: provider.model };
  }

  // Groq and any OpenAI-compatible endpoint share the chat/completions shape.
  const isGroq = provider.name === "groq";
  const baseUrl = isGroq
    ? "https://api.groq.com/openai/v1"
    : (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1");
  const key = isGroq ? process.env.GROQ_API_KEY! : process.env.OPENAI_API_KEY!;

  const data = (await postJson(
    `${baseUrl}/chat/completions`,
    {
      model: provider.model,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { authorization: `Bearer ${key}` },
  )) as {
    choices?: { finish_reason?: string; message?: { content?: string } }[];
  };

  const choice = data.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  if (!text) throw new ProviderError("provider returned empty text", 502);
  if (choice?.finish_reason === "length") throw new TruncatedError();
  return { text, provider: provider.name, model: provider.model };
}
