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
  /** Tried in order when `model` is rate-limited or unavailable. */
  fallbacks: string[];
}

/**
 * Free OpenRouter models sit in a shared upstream pool and return 429 on and off
 * through the day, so any single choice fails some of the time. These are the
 * free models that answered a probe quickly; the configured OPENAI_MODEL is
 * always tried first and this list only catches its bad minutes.
 *
 * Override with OPENAI_FALLBACK_MODELS (comma-separated), or set it empty to
 * turn falling back off entirely.
 */
const OPENROUTER_FALLBACKS = [
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m3:free",
];

function configuredFallbacks(defaults: string[]): string[] {
  const raw = process.env.OPENAI_FALLBACK_MODELS;
  if (raw === undefined) return defaults;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
      fallbacks: [],
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      name: "groq",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      fallbacks: [],
    };
  }
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    // Only OpenRouter's free tier has the shared-pool problem; a paid endpoint
    // should fail loudly rather than quietly answer as a different model.
    const isFreeOpenRouter =
      /openrouter\.ai/i.test(process.env.OPENAI_BASE_URL ?? "") &&
      model.endsWith(":free");
    return {
      name: "openai-compatible",
      model,
      fallbacks: isFreeOpenRouter
        ? configuredFallbacks(OPENROUTER_FALLBACKS).filter((m) => m !== model)
        : configuredFallbacks([]),
    };
  }
  return null;
}

/** 429/502/503 mean "this model, right now" — another model may well answer. */
function isTransient(e: unknown): boolean {
  return (
    e instanceof ProviderError && [429, 502, 503, 529].includes(e.status)
  );
}

/**
 * Pulls the human-readable sentence out of a provider error body. OpenRouter
 * nests the useful part under error.metadata.raw and wraps the whole thing in
 * JSON, which is not something to show a user as-is.
 */
function readableProviderError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; metadata?: { raw?: string } };
    };
    const raw = parsed.error?.metadata?.raw;
    const msg = parsed.error?.message;
    const text = (raw ?? msg ?? "").toString().trim();
    if (text) return text.split("\n")[0].slice(0, 220);
  } catch {
    // Not JSON — fall through to the truncated body.
  }
  return `HTTP ${status}: ${body.slice(0, 180)}`;
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
    throw new ProviderError(readableProviderError(res.status, text), res.status);
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

  async function callModel(model: string): Promise<string> {
    const data = (await postJson(
      `${baseUrl}/chat/completions`,
      {
        model,
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
    return text;
  }

  const chain = [provider.model, ...provider.fallbacks];
  const failures: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      return { text: await callModel(model), provider: provider.name, model };
    } catch (e) {
      // A truncated answer is the model's own limit, not availability — another
      // model would hit the same ceiling, so surface it rather than retrying.
      if (e instanceof TruncatedError) throw e;
      if (!isTransient(e) || i === chain.length - 1) {
        if (failures.length && e instanceof ProviderError) {
          const tried = [...failures, model].join(", ");
          throw new ProviderError(
            `Every model is busy right now (tried ${tried}). ` +
              `Free models share an upstream pool — wait a minute and try again, ` +
              `or add your own provider key at openrouter.ai/settings/integrations ` +
              `and point OPENAI_MODEL at it.`,
            e.status,
          );
        }
        throw e;
      }
      failures.push(model);
      console.warn(`[ai] ${model} unavailable, trying ${chain[i + 1]}`);
    }
  }

  throw new NoProviderError();
}
