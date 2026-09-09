import { Router } from "express";
import { requireUser } from "../middleware/user.ts";
import { summarize, type SummarizeInput } from "../ai/summarize.ts";
import { generateImage, IMAGE_STYLES, isImageStyle } from "../ai/image.ts";
import {
  imageProviders,
  resolveImageChain,
  resolveTextChain,
  textNeedsKey,
  textProviders,
} from "../ai/providers.ts";
import { AiError } from "../ai/text.ts";

export const aiRouter = Router();

/** Public: lets the UI show which free providers are wired up. */
aiRouter.get("/providers", (_req, res) => {
  const textChain = resolveTextChain().map((p) => p.id);
  const imageChain = resolveImageChain();
  res.json({
    /** True when only the anonymous fallback is available; UI shows setup hint. */
    needsKey: textNeedsKey(),
    demo: textChain[0] === "mock",
    text: textProviders().map((p) => ({
      id: p.id,
      label: p.label,
      note: p.note,
      model: p.model,
      active: textChain.includes(p.id),
      primary: textChain[0] === p.id,
    })),
    image: imageProviders().map((p) => ({ ...p, primary: imageChain[0] === p.id })),
    styles: Object.entries(IMAGE_STYLES).map(([id, s]) => ({
      id,
      label: s.label,
      emoji: s.emoji,
    })),
  });
});

aiRouter.post("/summarize", requireUser, async (req, res) => {
  const body = (req.body ?? {}) as Partial<SummarizeInput>;
  if (!body.podcastName?.trim() || !body.sessionTitle?.trim()) {
    res.status(400).json({ error: "podcastName and sessionTitle are required" });
    return;
  }
  try {
    const out = await summarize({
      kind: body.kind === "food" ? "food" : "podcast",
      podcastName: body.podcastName.trim(),
      sessionTitle: body.sessionTitle.trim(),
      notes: String(body.notes ?? "").slice(0, 60_000),
      url: body.url ? String(body.url).trim() : null,
      language: body.language ? String(body.language).trim() : undefined,
      tone: body.tone,
    });
    res.json(out);
  } catch (e) {
    if (e instanceof AiError) {
      res.status(e.status).json({ error: e.message, code: e.code, details: e.details });
      return;
    }
    throw e;
  }
});

/**
 * Image proxy. Streaming the bytes through our origin keeps the canvas
 * untainted so the frontend can export a PNG, and hides provider tokens.
 * Cached aggressively: same prompt + seed gives the same picture.
 */
aiRouter.get("/image", async (req, res) => {
  const subject = String(req.query.prompt ?? "").trim().slice(0, 500);
  if (!subject) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }
  const styleRaw = String(req.query.style ?? "playful");
  const style = isImageStyle(styleRaw) ? styleRaw : "playful";
  const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : dflt;
  };
  const width = clamp(req.query.w, 256, 1536, 1024);
  const height = clamp(req.query.h, 256, 1536, 1024);
  const seed = clamp(req.query.seed, 0, 2_147_483_647, 42);

  try {
    const img = await generateImage({ subject, style, width, height, seed });
    res.setHeader("content-type", img.contentType);
    res.setHeader("cache-control", "public, max-age=86400, immutable");
    res.setHeader("x-ai-provider", img.provider);
    res.send(img.bytes);
  } catch (e) {
    if (e instanceof AiError) {
      res.status(e.status).json({ error: e.message, details: e.details });
      return;
    }
    throw e;
  }
});
