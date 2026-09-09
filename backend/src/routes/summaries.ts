import { Router } from "express";
import {
  createSummary,
  deleteSummary,
  getSummary,
  isKind,
  listSummaries,
  sanitizeInput,
  updateSummary,
} from "../db/summaries.ts";
import { requireUser } from "../middleware/user.ts";

export const summariesRouter = Router();

summariesRouter.use(requireUser);

summariesRouter.get("/", async (req, res) => {
  const kind = isKind(req.query.kind) ? req.query.kind : undefined;
  const items = await listSummaries(req.userId, kind);
  res.json({ items });
});

/** Dashboard numbers for the caller. Cheap: computed from their own rows. */
summariesRouter.get("/stats", async (req, res) => {
  const items = await listSummaries(req.userId);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tagCounts = new Map<string, number>();
  for (const s of items) for (const t of s.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const byKind: Record<string, number> = { podcast: 0, food: 0 };
  for (const s of items) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  res.json({
    total: items.length,
    byKind,
    aiCount: items.filter((s) => !!s.aiSummary).length,
    withCover: items.filter((s) => !!s.coverPrompt).length,
    thisWeek: items.filter((s) => new Date(s.createdAt).getTime() > weekAgo).length,
    takeaways: items.reduce((n, s) => n + s.takeaways.length, 0),
    tags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
    recent: items.slice(0, 6),
    lastUpdated: items[0]?.updatedAt ?? null,
  });
});

summariesRouter.get("/:id", async (req, res) => {
  const item = await getSummary(req.userId, req.params.id);
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(item);
});

function hasTitles(body: ReturnType<typeof sanitizeInput>): body is ReturnType<
  typeof sanitizeInput
> & { podcastName: string; sessionTitle: string } {
  return !!body.podcastName?.trim() && !!body.sessionTitle?.trim();
}

summariesRouter.post("/", async (req, res) => {
  const body = sanitizeInput(req.body ?? {});
  if (!hasTitles(body)) {
    res.status(400).json({ error: "podcastName and sessionTitle are required" });
    return;
  }
  const created = await createSummary(req.userId, body);
  res.status(201).json(created);
});

summariesRouter.patch("/:id", async (req, res) => {
  const body = sanitizeInput(req.body ?? {});
  const updated = await updateSummary(req.userId, req.params.id, body);
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(updated);
});

summariesRouter.put("/:id", async (req, res) => {
  const body = sanitizeInput(req.body ?? {});
  if (!hasTitles(body)) {
    res.status(400).json({ error: "podcastName and sessionTitle are required" });
    return;
  }
  const updated = await updateSummary(req.userId, req.params.id, body);
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(updated);
});

summariesRouter.delete("/:id", async (req, res) => {
  const ok = await deleteSummary(req.userId, req.params.id);
  if (!ok) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.status(204).end();
});
