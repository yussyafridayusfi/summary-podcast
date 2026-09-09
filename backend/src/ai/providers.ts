/**
 * Free-tier AI provider registry.
 *
 * Text providers all speak the OpenAI chat-completions dialect, so a single
 * client covers them. Order matters: the first provider whose key is present
 * wins when AI_TEXT_PROVIDER=auto. Pollinations needs no key and is the
 * always-available fallback.
 *
 * Image providers return raw bytes. Pollinations again needs no key.
 */

export type TextProviderId =
  | "groq"
  | "gemini"
  | "openrouter"
  | "cerebras"
  | "pollinations"
  | "mock";
export type ImageProviderId = "pollinations" | "huggingface" | "cloudflare";

export interface TextProvider {
  id: TextProviderId;
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Free-tier notes shown in the UI. */
  note: string;
  /** Extra headers (OpenRouter attribution etc). */
  headers?: Record<string, string>;
  /** Whether the provider reliably honours response_format json_object. */
  jsonMode: boolean;
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string;
  note: string;
  available: boolean;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

export function textProviders(): TextProvider[] {
  return [
    {
      id: "groq",
      label: "Groq · GPT-OSS 120B",
      baseUrl: "https://api.groq.com/openai/v1",
      model: env("GROQ_MODEL") ?? "openai/gpt-oss-120b",
      apiKey: env("GROQ_API_KEY"),
      note: "Free tier, ~1k req/day, very fast (500 tok/s).",
      jsonMode: true,
    },
    {
      id: "gemini",
      label: "Google · Gemini 2.5 Flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: env("GEMINI_MODEL") ?? "gemini-2.5-flash",
      apiKey: env("GEMINI_API_KEY"),
      note: "Free tier via AI Studio, 1M-token context — best for long transcripts.",
      jsonMode: true,
    },
    {
      id: "cerebras",
      label: "Cerebras · Llama 3.3 70B",
      baseUrl: "https://api.cerebras.ai/v1",
      model: env("CEREBRAS_MODEL") ?? "llama-3.3-70b",
      apiKey: env("CEREBRAS_API_KEY"),
      note: "Free tier, 30 req/min, ~1M tokens/day.",
      jsonMode: true,
    },
    {
      id: "openrouter",
      label: "OpenRouter · free router",
      baseUrl: "https://openrouter.ai/api/v1",
      model: env("OPENROUTER_MODEL") ?? "openrouter/free",
      apiKey: env("OPENROUTER_API_KEY"),
      note: "Rotating free models, 50 req/day without credits.",
      headers: {
        "HTTP-Referer": env("APP_URL") ?? "http://localhost:5173",
        "X-Title": "Podcast Summary",
      },
      jsonMode: false,
    },
    {
      id: "pollinations",
      label: "Pollinations · GPT-OSS 20B",
      baseUrl: "https://text.pollinations.ai/openai",
      model: env("POLLINATIONS_TEXT_MODEL") ?? "openai-fast",
      // No key required; a token lifts the anonymous rate limit.
      apiKey: env("POLLINATIONS_TOKEN") ?? "anonymous",
      note: "No key needed, but the anonymous tier only accepts very short prompts. Last-resort fallback.",
      jsonMode: false,
    },
    {
      id: "mock",
      label: "Demo mode (no AI)",
      baseUrl: "",
      model: "mock",
      apiKey: env("AI_TEXT_PROVIDER") === "mock" ? "mock" : undefined,
      note: "Deterministic sample output for trying the UI without any API key.",
      jsonMode: true,
    },
  ];
}

/** Resolve the ordered list of text providers to try. */
export function resolveTextChain(): TextProvider[] {
  const all = textProviders();
  const forced = env("AI_TEXT_PROVIDER") as TextProviderId | "auto" | undefined;
  if (forced && forced !== "auto") {
    const p = all.find((x) => x.id === forced);
    if (p) {
      const fallback = all.find((x) => x.id === "pollinations");
      return p.id === "pollinations" || p.id === "mock" || !fallback ? [p] : [p, fallback];
    }
  }
  return all.filter((p) => !!p.apiKey && p.id !== "mock");
}

/** True when no real (keyed) text provider is configured. */
export function textNeedsKey(): boolean {
  return resolveTextChain().every((p) => p.id === "pollinations");
}

export function imageProviders(): ImageProvider[] {
  return [
    {
      id: "pollinations",
      label: "Pollinations · Sana / Flux",
      note: "No key needed. Add POLLINATIONS_TOKEN to remove the logo and raise limits.",
      available: true,
    },
    {
      id: "huggingface",
      label: "Hugging Face · FLUX.1-schnell",
      note: "Free monthly inference credits with an HF token.",
      available: !!env("HF_TOKEN"),
    },
    {
      id: "cloudflare",
      label: "Cloudflare Workers AI · FLUX.1-schnell",
      note: "10k free neurons/day (~2k small images).",
      available: !!(env("CF_ACCOUNT_ID") && env("CF_API_TOKEN")),
    },
  ];
}

export function resolveImageChain(): ImageProviderId[] {
  const forced = env("AI_IMAGE_PROVIDER") as ImageProviderId | "auto" | undefined;
  const avail = imageProviders().filter((p) => p.available).map((p) => p.id);
  if (forced && forced !== "auto" && avail.includes(forced)) {
    return [forced, ...avail.filter((x) => x !== forced)];
  }
  // Prefer keyed providers (better quality, no logo) over anonymous Pollinations.
  const order: ImageProviderId[] = ["cloudflare", "huggingface", "pollinations"];
  return order.filter((id) => avail.includes(id));
}
