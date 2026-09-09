import { resolveImageChain, type ImageProviderId } from "./providers.ts";
import { AiError } from "./text.ts";

/**
 * Visual styles for the share-card illustration. Each style is a prompt
 * wrapper: the model gets `${prefix} ${subject}. ${suffix}`, tuned so the
 * result stays playful, high-contrast and free of text (text on AI images is
 * unreliable; the frontend draws its own typography with canvas).
 */
export const IMAGE_STYLES = {
  playful: {
    label: "Playful",
    emoji: "\u{1F388}",
    prefix:
      "Playful flat vector illustration, bold friendly shapes, cheerful pastel and candy colors,",
    suffix: "cute sticker style, joyful mood, no text, no letters.",
  },
  doodle: {
    label: "Doodle",
    emoji: "✏️",
    prefix:
      "Hand-drawn doodle illustration, thick marker outlines, quirky characters, notebook sketch style, limited bright palette,",
    suffix: "white background, no text, no letters, fun and energetic.",
  },
  retro: {
    label: "Retro",
    emoji: "\u{1F4FB}",
    prefix:
      "Retro 1970s poster illustration, warm orange mustard and teal palette, grainy texture, mid-century shapes,",
    suffix: "no text, no letters, vintage vibe, balanced composition.",
  },
  neon: {
    label: "Neon",
    emoji: "\u{1F303}",
    prefix:
      "Vibrant synthwave neon illustration, glowing magenta cyan and violet, dark background, dramatic lighting,",
    suffix: "no text, no letters, cinematic, sharp details.",
  },
  paper: {
    label: "Papercut",
    emoji: "\u{1F3A8}",
    prefix:
      "Layered paper-cut craft illustration, soft shadows, tactile textures, warm harmonious colors,",
    suffix: "no text, no letters, cozy handmade feel.",
  },
  minimal: {
    label: "Minimal",
    emoji: "⚪",
    prefix:
      "Minimalist geometric illustration, two or three flat colors, generous negative space, elegant abstract shapes,",
    suffix: "no text, no letters, calm and modern.",
  },
} as const;

export type ImageStyle = keyof typeof IMAGE_STYLES;

export function isImageStyle(s: string): s is ImageStyle {
  return Object.prototype.hasOwnProperty.call(IMAGE_STYLES, s);
}

export interface ImageRequest {
  /** What the picture is about (comes from the summary's coverPrompt). */
  subject: string;
  style: ImageStyle;
  width: number;
  height: number;
  seed: number;
}

export interface ImageResult {
  bytes: Buffer;
  contentType: string;
  provider: ImageProviderId;
}

export function buildImagePrompt(req: ImageRequest): string {
  const s = IMAGE_STYLES[req.style];
  return `${s.prefix} ${req.subject}. ${s.suffix}`;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

async function pollinations(req: ImageRequest, prompt: string): Promise<ImageResult> {
  const token = env("POLLINATIONS_TOKEN");
  const params = new URLSearchParams({
    width: String(req.width),
    height: String(req.height),
    seed: String(req.seed),
    model: env("POLLINATIONS_IMAGE_MODEL") ?? "flux",
    private: "true",
    safe: "true",
  });
  if (token) params.set("nologo", "true");
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
  const res = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    throw new AiError(`pollinations ${res.status}`, res.status, await res.text().catch(() => ""));
  }
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  if (!ct.startsWith("image/")) throw new AiError("pollinations returned non-image", 502);
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: ct, provider: "pollinations" };
}

async function huggingface(req: ImageRequest, prompt: string): Promise<ImageResult> {
  const model = env("HF_IMAGE_MODEL") ?? "black-forest-labs/FLUX.1-schnell";
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env("HF_TOKEN")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { width: req.width, height: req.height, seed: req.seed, num_inference_steps: 4 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    throw new AiError(`huggingface ${res.status}`, res.status, await res.text().catch(() => ""));
  }
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: ct, provider: "huggingface" };
}

async function cloudflare(req: ImageRequest, prompt: string): Promise<ImageResult> {
  const model = env("CF_IMAGE_MODEL") ?? "@cf/black-forest-labs/flux-1-schnell";
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env("CF_ACCOUNT_ID")}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("CF_API_TOKEN")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt, seed: req.seed, steps: 4 }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!res.ok) {
    throw new AiError(`cloudflare ${res.status}`, res.status, await res.text().catch(() => ""));
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.startsWith("image/")) {
    return { bytes: Buffer.from(await res.arrayBuffer()), contentType: ct, provider: "cloudflare" };
  }
  // flux-1-schnell answers { result: { image: "<base64>" } }
  const json = (await res.json()) as { result?: { image?: string } };
  if (!json.result?.image) throw new AiError("cloudflare returned no image", 502);
  return {
    bytes: Buffer.from(json.result.image, "base64"),
    contentType: "image/jpeg",
    provider: "cloudflare",
  };
}

const impls: Record<ImageProviderId, (r: ImageRequest, p: string) => Promise<ImageResult>> = {
  pollinations,
  huggingface,
  cloudflare,
};

export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  const prompt = buildImagePrompt(req);
  const errors: string[] = [];
  for (const id of resolveImageChain()) {
    try {
      return await impls[id](req, prompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${id}: ${msg}`);
      console.warn(`[ai:image] ${id} failed: ${msg}`);
    }
  }
  throw new AiError("All image providers failed", 503, errors);
}
