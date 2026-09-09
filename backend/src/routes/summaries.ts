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
