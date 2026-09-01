import { Router } from "express";
import {
  createFoodReview,
  deleteFoodReview,
  getFoodReview,
  listFoodReviews,
  updateFoodReview,
  type CreateFoodReviewInput,
  type UpdateFoodReviewInput,
} from "../db/foodReviews.ts";
import { requireUser } from "../middleware/user.ts";

export const foodReviewsRouter = Router();

foodReviewsRouter.use(requireUser);

/** Empty string means "cleared" from the UI's point of view, so store NULL. */
function nullable(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Postgres `date` rejects anything that isn't a valid day, and the client sends
 * whatever an `<input type="date">` produced — so reject malformed values here
 * rather than letting the driver throw a 500.
 */
function parseDateVisit(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const s = nullable(v);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return s;
}

foodReviewsRouter.get("/", async (req, res) => {
  const items = await listFoodReviews(req.userId);
  res.json({ items });
});

foodReviewsRouter.get("/:id", async (req, res) => {
  const item = await getFoodReview(req.userId, req.params.id);
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(item);
});

foodReviewsRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateFoodReviewInput>;
  if (!body.restoName?.trim()) {
    res.status(400).json({ error: "restoName is required" });
    return;
  }
  const dateVisit = parseDateVisit(body.dateVisit);
  if (body.dateVisit !== undefined && dateVisit === undefined) {
    res.status(400).json({ error: "dateVisit must be a YYYY-MM-DD date" });
    return;
  }
  const created = await createFoodReview(req.userId, {
    restoName: body.restoName.trim(),
    description: nullable(body.description),
    dateVisit: dateVisit ?? null,
    location: nullable(body.location),
    urlWebResto: nullable(body.urlWebResto),
    content: body.content ?? "",
    summaryGeneratorText: body.summaryGeneratorText ?? "",
    imageDataUri: body.imageDataUri ?? null,
  });
  res.status(201).json(created);
});

/** Partial update — only the keys present in the body are touched. */
foodReviewsRouter.patch("/:id", async (req, res) => {
  const body = req.body as UpdateFoodReviewInput;

  const dateVisit = parseDateVisit(body.dateVisit);
  if (body.dateVisit !== undefined && dateVisit === undefined) {
    res.status(400).json({ error: "dateVisit must be a YYYY-MM-DD date" });
    return;
  }
  if (body.restoName !== undefined && !body.restoName.trim()) {
    res.status(400).json({ error: "restoName cannot be empty" });
    return;
  }

  const patch: UpdateFoodReviewInput = {};
  if (body.restoName !== undefined) patch.restoName = body.restoName.trim();
  if (body.description !== undefined) patch.description = nullable(body.description);
  if (body.dateVisit !== undefined) patch.dateVisit = dateVisit;
  if (body.location !== undefined) patch.location = nullable(body.location);
  if (body.urlWebResto !== undefined) patch.urlWebResto = nullable(body.urlWebResto);
  if (body.content !== undefined) patch.content = body.content;
  if (body.summaryGeneratorText !== undefined)
    patch.summaryGeneratorText = body.summaryGeneratorText;
  if (body.imageDataUri !== undefined) patch.imageDataUri = body.imageDataUri;

  const updated = await updateFoodReview(req.userId, req.params.id, patch);
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(updated);
});

/** Full replace — every optional field the body omits is cleared. */
foodReviewsRouter.put("/:id", async (req, res) => {
  const body = req.body as Partial<CreateFoodReviewInput>;
  if (!body.restoName?.trim()) {
    res.status(400).json({ error: "restoName is required" });
    return;
  }
  const dateVisit = parseDateVisit(body.dateVisit);
  if (body.dateVisit !== undefined && dateVisit === undefined) {
    res.status(400).json({ error: "dateVisit must be a YYYY-MM-DD date" });
    return;
  }
  const updated = await updateFoodReview(req.userId, req.params.id, {
    restoName: body.restoName.trim(),
    description: nullable(body.description),
    dateVisit: dateVisit ?? null,
    location: nullable(body.location),
    urlWebResto: nullable(body.urlWebResto),
    content: body.content ?? "",
    // Left alone unless explicitly sent: a plain save from the edit form must
    // not wipe a generated summary or an uploaded photo.
    ...(body.summaryGeneratorText !== undefined
      ? { summaryGeneratorText: body.summaryGeneratorText }
      : {}),
    ...(body.imageDataUri !== undefined
      ? { imageDataUri: body.imageDataUri }
      : {}),
  });
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(updated);
});

foodReviewsRouter.delete("/:id", async (req, res) => {
  const ok = await deleteFoodReview(req.userId, req.params.id);
  if (!ok) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.status(204).end();
});
