import { Router } from "express";
import { requireUser } from "../middleware/user.ts";
import { generateBackgroundImage } from "../ai/image.ts";
import {
  NoProviderError,
  ProviderError,
  TruncatedError,
  generateText,
  resolveProvider,
} from "../ai/provider.ts";

export const aiRouter = Router();

aiRouter.use(requireUser);

/**
 * Fields the generator reads from the (possibly unsaved) form state. The two
 * record kinds live in different tables and share no descriptive fields, so
 * `type` discriminates which half of this shape is populated.
 */
interface SummaryContext {
  type?: "podcast" | "food-review";
  // podcast
  podcastName?: string;
  sessionTitle?: string;
  guest?: string | null;
  url?: string | null;
  // food review
  restoName?: string;
  description?: string | null;
  dateVisit?: string | null;
  location?: string | null;
  urlWebResto?: string | null;
  // shared
  content?: string;
  imageDataUri?: string | null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describe(
  ctx: SummaryContext,
  opts: { includeNotes?: boolean } = {},
): string {
  if (ctx.type === "food-review") {
    const lines = [`Restaurant: ${ctx.restoName || "(unnamed)"}`];
    if (ctx.description?.trim())
      lines.push(`What was eaten: ${ctx.description.trim()}`);
    if (ctx.dateVisit?.trim()) lines.push(`Date visited: ${ctx.dateVisit.trim()}`);
    if (ctx.location?.trim()) lines.push(`Location: ${ctx.location.trim()}`);
    if (ctx.urlWebResto?.trim())
      lines.push(`Restaurant website: ${ctx.urlWebResto.trim()}`);
    if (opts.includeNotes !== false) {
      const notes = stripHtml(ctx.content ?? "");
      lines.push(
        notes
          ? `Diner's raw notes:\n${notes.slice(0, 12_000)}`
          : "Diner's raw notes: (none provided)",
      );
    }
    return lines.join("\n");
  }
  const lines = [
    `Podcast: ${ctx.podcastName || "(untitled)"}`,
    `Episode / session: ${ctx.sessionTitle || "(untitled)"}`,
  ];
  if (ctx.guest?.trim()) lines.push(`Guest: ${ctx.guest.trim()}`);
  if (ctx.url?.trim()) lines.push(`Source URL: ${ctx.url.trim()}`);
  // The design route quotes the notes itself when they are the chosen source,
  // so it opts out here rather than sending them twice.
  if (opts.includeNotes !== false) {
    const notes = stripHtml(ctx.content ?? "");
    lines.push(
      notes
        ? `Listener's raw notes:\n${notes.slice(0, 12_000)}`
        : "Listener's raw notes: (none provided)",
    );
  }
  return lines.join("\n");
}

/** Reports which provider is active so the UI can warn before the user clicks. */
aiRouter.get("/status", (_req, res) => {
  const provider = resolveProvider();
  res.json({
    textReady: !!provider,
    provider: provider?.name ?? null,
    model: provider?.model ?? null,
    // Pollinations images need no key, so imagery is always available.
    imageReady: true,
  });
});

/** Writes the summary that gets stored in summaries.summary_generator_text. */
aiRouter.post("/summary", async (req, res, next) => {
  try {
    const ctx = req.body as SummaryContext;
    const food = ctx.type === "food-review";
    const { text, provider, model } = await generateText(
      food ? "You are a food writer. Return a short food name on the first line, then a creative description of no more than 5 words on the second line, then a concise food summary grounded only in the supplied description. Do not invent ingredients or claims." :
      "You are an expert podcast note-taker. Write clear, skimmable episode summaries " +
        "in plain prose and short bullet points. Never invent facts that are not " +
        "supported by the notes you are given; if the notes are thin, say so briefly " +
        "and summarise only what is there. Do not use markdown headings larger than '###'.",
      `${describe(ctx)}\n\n${food ? "Return the food name, the maximum-five-word creative description, and a concise review.\n\n" : "Write a summary of this episode with:\n" +
        `1. A one-paragraph overview (2-4 sentences).\n` +
        `2. A "Key takeaways" list of 3-6 concise bullets.\n` +
        `3. A one-line "Why it matters" closer.\n\n`}` +
        `Return plain text or light markdown. Do not wrap the answer in code fences.`,
    );
    res.json({ text, provider, model });
  } catch (e) {
    next(e);
  }
});

/**
 * Undoes HTML-escaping the model sometimes applies to its own markup.
 *
 * Models intermittently return `&lt;br&gt;` instead of `<br>`, which renders as
 * the literal text "<br>" on the card. Only tag-shaped sequences are decoded —
 * `&amp;` and friends are left alone — and this runs BEFORE the <script> strip
 * in unwrapDocument so an escaped script tag cannot slip through by decoding
 * after the sanitiser.
 */
function decodeEscapedTags(html: string): string {
  return html.replace(
    /&lt;(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^&<>]*?)?)\s*(\/?)&gt;/g,
    (_m, close: string, tag: string, attrs: string, selfClose: string) =>
      `<${close}${tag}${attrs}${selfClose}>`,
  );
}

/**
 * Models often return a whole `<!doctype html>` document even when asked for a
 * fragment. The img/pdf composers nest the result inside their own document, so
 * lift out the <style> blocks and <body> contents rather than nesting one
 * document inside another. Scripts are dropped: the preview iframe blocks them
 * anyway, and they have no place in a static artefact.
 */
function unwrapDocument(html: string): string {
  // Decode first, then sanitise, so `&lt;script&gt;` is caught by the strip.
  const withoutScripts = decodeEscapedTags(html).replace(
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    "",
  );
  const isFullDoc =
    /<html[\s>]/i.test(withoutScripts) || /<body[\s>]/i.test(withoutScripts);
  if (!isFullDoc) return withoutScripts.trim();

  const styles = [
    ...withoutScripts.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi),
  ]
    .map((m) => m[0])
    .join("\n");

  const body = withoutScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const inner = body
    ? body[1]
    : withoutScripts.replace(
        /<\/?(?:!doctype|html|head|meta|title|link|base)[^>]*>/gi,
        "",
      );

  return `${styles}\n${inner}`.trim();
}

const FORMAT_BRIEFS = {
  html:
    "a self-contained, responsive HTML page. Include a <style> block. Use a clean, " +
    "readable layout with generous whitespace and a clear type hierarchy.",
  pdf:
    "a print-oriented HTML document sized for A4 / Letter. Use page-friendly margins, " +
    "readable serif or humanist body type, and avoid dark full-bleed backgrounds that " +
    "waste ink. It will be rasterised into a PDF.",
  // Sketchnote brief. The class names here are provided by
  // frontend/src/lib/sketch.ts — keep the two in sync.
  img:
    "an Instagram food post using the uploaded food photo as the central realistic image. Keep the original food and photo realistic. Add hand-drawn doodles around it: arrows, circles, stars, hearts, and sketch lines. Include only a short food name and a short creative description of no more than 5 words in the image. Do not add labels, ingredients, captions, logos, watermarks, or any other text. A hand-drawn SKETCHNOTE (visual notes) page, like a designer's illustrated " +
    "bullet-journal spread. It is placed inside a 1080x1350 portrait stage that " +
    "already supplies dot-grid paper, handwriting fonts and padding — so do NOT set " +
    "width, height, background, font-family or padding on any wrapper, and do NOT " +
    "emit <html>, <head> or <body>.\n\n" +
    "ITEM TEMPLATE — use this EXACT shape for every numbered point, so the doodle " +
    "sits beside the words instead of on its own line (which wastes half the page):\n" +
    "  <div class=\"row\"><i class=\"dd dd-bulb\"></i><div><span class=\"num\">1.</span> " +
    "Short line with <span class=\"mk mk-pink\">key words</span> highlighted</div></div>\n" +
    "And for each lettered section heading:\n" +
    "  <div class=\"row\"><span class=\"badge badge-pink\">a</span>" +
    "<div class=\"sk-h\">Section heading</div></div>\n" +
    "Never place an <i class=\"dd\"> on a line by itself.\n\n" +
    "OUTPUT RULES: return raw HTML only. NEVER HTML-escape your own markup — write " +
    "<br> not &lt;br&gt;. The title must be ONE short plain-text line in " +
    ".sk-title with NO tags inside it; if you want a second line put it in a " +
    "separate .sk-sub element. Never join two phrases with <br> in a heading.\n\n" +
    "COMPOSE USING THESE PROVIDED CLASSES (do not invent your own CSS):\n" +
    "  .sk-title / .sk-sub / .sk-h / .sk-small  — headings and captions\n" +
    "  .mk .mk-pink|mk-yellow|mk-blue|mk-green|mk-purple — highlighter marker BEHIND " +
    "a few key words (use on <span>, sparingly, 4-8 times total)\n" +
    "  .ul .ul-red|ul-blue|ul-green|ul-orange — hand-drawn underline on key phrases\n" +
    "  .badge .badge-pink|badge-blue|badge-green|badge-yellow — circled a/b/c letter\n" +
    "  .num — a bold hand-written number like 1. 2. 3.\n" +
    "  .panel / .panel-dashed — a boxed callout\n" +
    "  .cols + .col — side-by-side columns;  .row — icon beside text\n" +
    "  ul.sk > li — bulleted list with drawn dots;  .rule — dashed divider\n" +
    "  .tilt-l / .tilt-r — tilt a block slightly so it looks placed by hand\n\n" +
    "STRUCTURE: a short punchy title, then 5-6 numbered points, then EXACTLY 3 " +
    "lettered sections (.badge) side by side or stacked, each with 3 short bullets, " +
    "ending with a one-line takeaway wrapped in <div class=\"panel panel-dashed " +
    "push-bottom\">. Rewrite the summary into SHORT scannable fragments — never full " +
    "paragraphs.\n\n" +
    "FILL THE PAGE: the stage is 1080x1350 and empty space at the bottom looks " +
    "unfinished. Aim for 180-240 words plus one or two scene diagrams — enough to " +
    "reach the bottom of the page without overflowing it.\n\n" +
    "SCENE DIAGRAMS — pick EXACTLY ONE, the one that best fits the episode. They are tall, so two will not fit on the page:\n" +
    "  Skills/goal gap, 'where I am vs where I want to be', distance to a target:\n" +
    "    <div class=\"scene scene-gap\"><span class=\"lbl lbl-l\">Where I am</span>" +
    "<span class=\"lbl lbl-r\">Where I want to be</span><span class=\"mid\">GAP</span></div>\n" +
    "  Gradual progress, growth, compounding habits:\n" +
    "    <div class=\"scene scene-stairs\"><span class=\"lbl lbl-r\">Goal</span>" +
    "<span class=\"lbl lbl-l\">Start small</span></div>\n" +
    "  People, networking, community, social influence:\n" +
    "    <div class=\"scene scene-people\"><span class=\"mid\">Your circle</span></div>\n" +
    "  A choice, trade-off or fork in the road:\n" +
    "    <div class=\"scene scene-signpost\"><span class=\"lbl lbl-l\">Option A</span>" +
    "<span class=\"lbl lbl-r\">Option B</span></div>\n" +
    "  Replace the label text with wording from THIS episode. Keep labels to 1-4 " +
    "words. Never nest a scene inside .cols — give it a full-width row.\n\n" +
    "DOODLES (important): use 5-8 of the ready-made line drawings. Write them as " +
    "`<i class=\"dd dd-NAME\"></i>` — never write <svg> or path data yourself. " +
    "Available NAME values: bulb, moon, coffee, clock, star, arrow, swirl, person, " +
    "search, cloud, heart, target, scales, globe, bolt, check, book, sign. " +
    "Add .dd-sm or .dd-lg to shrink or enlarge one. Pick icons that genuinely match " +
    "the point they sit beside, and place one next to most numbered points and each " +
    "lettered section heading.",
} as const;

type Format = keyof typeof FORMAT_BRIEFS;

/** Which body of text the artefact is designed from. */
type DesignSource = "notes" | "summary";

const SOURCE_LABELS: Record<DesignSource, string> = {
  notes:
    "The listener's own raw notes (NOT an AI summary). Use these as the content: " +
    "tidy up the wording and structure them for the layout, but do not add facts " +
    "that are not in the notes",
  summary: "Approved summary text",
};

/**
 * Turns the chosen source text - either the listener's raw notes or the
 * AI-written summary - into a styled artefact. Returns raw HTML that the client
 * previews and then rasterises (img/pdf) or downloads directly (html).
 */
aiRouter.post("/design", async (req, res, next) => {
  try {
    const body = req.body as SummaryContext & {
      format?: string;
      prompt?: string;
      summaryText?: string;
      source?: string;
    };
    const format = body.format as Format;
    if (!format || !(format in FORMAT_BRIEFS)) {
      res.status(400).json({ error: "format must be one of: img, pdf, html" });
      return;
    }

    // Which body of text the design is built from. Defaults to the AI summary
    // so existing callers that omit `source` behave exactly as before.
    const source: DesignSource = body.source === "notes" ? "notes" : "summary";

    // Notes arrive as Quill HTML; the designer only needs the words.
    const sourceText =
      source === "notes"
        ? stripHtml(body.content ?? "").slice(0, 12_000)
        : (body.summaryText ?? "").trim();

    if (!sourceText) {
      res.status(400).json({
        error:
          source === "notes"
            ? "your notes are empty - write some notes first"
            : "summaryText is required - generate the summary first",
      });
      return;
    }

    const { text, provider, model } = await generateText(
      "You are a designer who writes production-ready HTML and CSS. You return ONLY " +
        "raw HTML markup — no explanation, no commentary, and no markdown code fences. " +
        "All CSS must be inline or in a single <style> block. Never reference external " +
        "assets, fonts, scripts, or images: the render environment has no network access " +
        "and any external URL will render as a broken box.",
      `${describe(body, { includeNotes: source !== "notes" })}\n\n` +
      (body.type === "food-review" && body.imageDataUri ? "An uploaded food photo is available; preserve it as the central realistic photo and do not redraw it.\n\n" : "") +
        `${SOURCE_LABELS[source]}:\n${sourceText}\n\n` +
        `Design brief: produce ${FORMAT_BRIEFS[format]}\n\n` +
        `The user's styling request: ${body.prompt?.trim() || "(no specific request - use your judgement)"}\n\n` +
        `Honour the user's styling request. Use only web-safe font stacks. ` +
        `Return only the HTML.`,
      // A full styled document needs far more room than a prose summary.
      { maxTokens: 12288 },
    );

    // Models still occasionally wrap output in fences despite instructions.
    const defenced = text
      .replace(/^\s*```(?:html)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const html = unwrapDocument(defenced);

    res.json({ html, provider, model });
  } catch (e) {
    next(e);
  }
});

/**
 * Fills the text slots of a food card. The three IMG layouts are composed on
 * the client from these fields rather than from model-written HTML: the
 * reference designs are precise about placement, and a model asked to lay out
 * callouts over a photo it cannot see produces something different every run.
 */
aiRouter.post("/food-card", async (req, res, next) => {
  try {
    const ctx = req.body as SummaryContext;
    const notes = stripHtml(ctx.content ?? "");

    const { text, provider, model } = await generateText(
      "You are a food writer producing copy for a social card. You reply with a " +
        "single JSON object and nothing else — no prose, no markdown, no code " +
        "fences. Ground every word in the details you are given: never invent " +
        "ingredients, prices, or claims that are not supported by them.",
      `${describe({ ...ctx, type: "food-review" })}\n\n` +
        `Return exactly this JSON shape:\n` +
        `{\n` +
        `  "title": "the dish name, at most 4 words",\n` +
        `  "tagline": "a creative description, AT MOST 5 words, no full stop",\n` +
        `  "labels": ["2 to 4 callouts naming things visible in the dish, 1-3 words each"],\n` +
        `  "body": "2 short sentences on how it tasted",\n` +
        `  "query": "how someone would search for this place, e.g. 'best sate in Yogyakarta'",\n` +
        `  "suggestion": "the restaurant name as a search suggestion"\n` +
        `}\n\n` +
        (notes
          ? `Base the labels on things actually mentioned in the notes.`
          : `There are no notes, so keep labels to what the dish name implies.`),
      // The JSON itself is ~150 tokens, but several of the free fallback models
      // are reasoning models that spend output tokens thinking first — at a
      // tighter ceiling they hit the limit before emitting any of it.
      { maxTokens: 2500 },
    );

    res.json({ card: parseCard(text), provider, model });
  } catch (e) {
    next(e);
  }
});

/**
 * Pulls the JSON object out of a model reply. Models still wrap it in fences or
 * add a sentence in front, and a card with some empty slots renders fine — so
 * every field falls back rather than failing the request.
 */
function parseCard(raw: string): {
  title: string;
  tagline: string;
  labels: string[];
  body: string;
  query: string;
  suggestion: string;
} {
  const empty = {
    title: "",
    tagline: "",
    labels: [] as string[],
    body: "",
    query: "",
    suggestion: "",
  };

  const defenced = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  // Fall back to the outermost {...} when the model prefixes a sentence.
  const start = defenced.indexOf("{");
  const end = defenced.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(defenced.slice(start, end + 1));
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;

  const o = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    title: str(o.title),
    tagline: str(o.tagline),
    labels: Array.isArray(o.labels)
      ? o.labels.map(str).filter(Boolean).slice(0, 4)
      : [],
    body: str(o.body),
    query: str(o.query),
    suggestion: str(o.suggestion),
  };
}

/** Generates the illustrated backdrop layered behind the IMG card's real text. */
aiRouter.post("/image", async (req, res, next) => {
  try {
    const body = req.body as { prompt?: string; seed?: number };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    const image = await generateBackgroundImage(prompt, {
      width: 1080,
      height: 1080,
      seed: body.seed,
    });
    res.json(image);
  } catch (e) {
    next(e);
  }
});

/** Maps provider failures onto useful status codes instead of a blanket 500. */
aiRouter.use(
  (
    err: unknown,
    _req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    if (err instanceof NoProviderError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof TruncatedError) {
      res.status(502).json({ error: err.message });
      return;
    }
    if (err instanceof ProviderError) {
      res.status(502).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      res.status(504).json({ error: "the AI provider timed out - try again" });
      return;
    }
    next(err);
  },
);
