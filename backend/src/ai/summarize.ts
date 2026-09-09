import { chat, extractJson, AiError } from "./text.ts";
import { IMAGE_STYLES } from "./image.ts";
import type { SummaryKind } from "../db/schema.ts";

export interface SummarizeInput {
  kind: SummaryKind;
  /** Podcast name, or restaurant / cuisine for food. */
  podcastName: string;
  /** Episode title, or dish / meal for food. */
  sessionTitle: string;
  notes: string;
  url?: string | null;
  /** Language hint, e.g. "en" or "id". Defaults to the language of the notes. */
  language?: string;
  tone?: "casual" | "professional" | "playful";
}

export interface AiSummary {
  headline: string;
  summary: string;
  takeaways: string[];
  quotes: string[];
  tags: string[];
  mood: string;
  coverPrompt: string;
  suggestedStyle: keyof typeof IMAGE_STYLES;
  provider: string;
  model: string;
  /** True when extra context was pulled from the URL. */
  usedUrl: boolean;
}

/** Fetch a page and reduce it to readable text (cheap readability). */
async function fetchPageText(url: string, maxChars = 12_000): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const res = await fetch(u, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SummaryHubBot/1.0)" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    const html = (await res.text()).slice(0, 600_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim();
    return text.length > 200 ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

const STYLE_KEYS = Object.keys(IMAGE_STYLES).join(" | ");

/** Kind-specific framing for the model. */
const KIND_BRIEF: Record<SummaryKind, { role: string; a: string; b: string; takeaways: string; quotes: string; cover: string }> = {
  podcast: {
    role: "an editor who turns messy podcast notes into a crisp, shareable summary",
    a: "Podcast",
    b: "Episode",
    takeaways: "the most useful ideas, tips or insights from the episode",
    quotes: "memorable lines from the notes, lightly cleaned; [] if none",
    cover: "a playful illustration capturing the episode's core idea",
  },
  food: {
    role: "a food writer who turns tasting notes, recipes and restaurant visits into a crisp, shareable summary",
    a: "Restaurant / cuisine / cook",
    b: "Dish / meal",
    takeaways:
      "the most useful points: standout flavors, textures, key ingredients or techniques, price-worthiness, who it suits, tips for ordering or cooking it",
    quotes: "short vivid tasting phrases or one-line verdicts from the notes; [] if none",
    cover: "a charming, appetising illustration of the dish or the eating scene",
  },
};

function systemPrompt(kind: SummaryKind, tone: string, language?: string) {
  const k = KIND_BRIEF[kind];
  const lang = language ? `the language with code "${language}"` : "the same language as the notes";
  return `You are ${k.role}.
Write in ${lang}. Tone: ${tone}. Be concrete, avoid filler, never invent facts that are not in the notes or context.

Return ONLY a JSON object with exactly these keys:
{
  "headline": string,        // punchy 6-12 word title for a social card
  "summary": string,         // 2-4 short paragraphs, plain text, blank line between paragraphs
  "takeaways": string[],     // 3-6 items covering ${k.takeaways}; each at most 110 characters, no numbering
  "quotes": string[],        // 0-3 ${k.quotes}
  "tags": string[],          // 3-6 lowercase single-word or hyphenated topic tags
  "mood": string,            // one or two words describing the vibe, e.g. "cozy", "energetic"
  "coverPrompt": string,     // ENGLISH, 12-25 words. ONE concrete scene for ${k.cover}: a main character or object doing something, plus 2-3 supporting props. Concrete nouns only, NO text, NO brand names, NO real people.
  "suggestedStyle": string   // one of: ${STYLE_KEYS}
}`;
}

export async function summarize(input: SummarizeInput): Promise<AiSummary> {
  const notes = input.notes?.trim() ?? "";
  let context: string | null = null;
  if (input.url && notes.length < 4000) context = await fetchPageText(input.url);
  if (!notes && !context) {
    throw new AiError("Add some notes or a URL with readable content first.", 400);
  }

  const k = KIND_BRIEF[input.kind];
  const user = [
    `${k.a}: ${input.podcastName}`,
    `${k.b}: ${input.sessionTitle}`,
    input.url ? `URL: ${input.url}` : null,
    "",
    notes ? `## Notes\n${notes}` : null,
    context ? `## Page context (may be noisy, use only what is relevant)\n${context}` : null,
  ]
    .filter((x) => x !== null)
    .join("\n");

  const result = await chat(
    [
      { role: "system", content: systemPrompt(input.kind, input.tone ?? "casual", input.language) },
      { role: "user", content: user },
    ],
    { json: true, timeoutMs: 90_000 },
  );

  const raw = extractJson<Partial<AiSummary>>(result.text);
  const arr = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, max)
      : [];
  const style: AiSummary["suggestedStyle"] =
    typeof raw.suggestedStyle === "string" && raw.suggestedStyle in IMAGE_STYLES
      ? (raw.suggestedStyle as AiSummary["suggestedStyle"])
      : "playful";

  return {
    headline: String(raw.headline ?? input.sessionTitle).trim().slice(0, 120),
    summary: String(raw.summary ?? "").trim(),
    takeaways: arr(raw.takeaways, 6),
    quotes: arr(raw.quotes, 3),
    tags: arr(raw.tags, 6).map((t) => t.toLowerCase().replace(/^#/, "")),
    mood: String(raw.mood ?? "curious").trim().slice(0, 40),
    coverPrompt: String(
      raw.coverPrompt ??
        (input.kind === "food"
          ? `a beautifully plated ${input.sessionTitle} on a wooden table with steam and fresh herbs`
          : `${input.podcastName} podcast episode about ${input.sessionTitle}`),
    )
      .trim()
      .slice(0, 400),
    suggestedStyle: style,
    provider: result.provider,
    model: result.model,
    usedUrl: !!context,
  };
}
