import { Router } from "express";
import {
  createSummary,
  deleteSummary,
  getSummary,
  listSummaries,
  updateSummary,
  type CreateSummaryInput,
  type UpdateSummaryInput,
} from "../db/summaries.ts";
import { requireUser } from "../middleware/user.ts";

export const summariesRouter = Router();

summariesRouter.use(requireUser);

summariesRouter.get("/", async (req, res) => {
  const items = await listSummaries(req.userId);
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

summariesRouter.post("/", async (req, res) => {
  const body = req.body as Partial<CreateSummaryInput>;
  if (!body.podcastName || !body.sessionTitle) {
    res
      .status(400)
      .json({ error: "podcastName and sessionTitle are required" });
    return;
  }
  const created = await createSummary(req.userId, {
    podcastName: body.podcastName,
    sessionTitle: body.sessionTitle,
    url: body.url ?? null,
    guest: body.guest ?? null,
    content: body.content ?? "",
    summaryGeneratorText: body.summaryGeneratorText ?? "",
  });
  res.status(201).json(created);
});

summariesRouter.patch("/:id", async (req, res) => {
  const body = req.body as UpdateSummaryInput;
  const updated = await updateSummary(req.userId, req.params.id, body);
  if (!updated) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(updated);
});

summariesRouter.put("/:id", async (req, res) => {
  const body = req.body as Partial<CreateSummaryInput>;
  if (!body.podcastName || !body.sessionTitle) {
    res
      .status(400)
      .json({ error: "podcastName and sessionTitle are required" });
    return;
  }
  const updated = await updateSummary(req.userId, req.params.id, {
    podcastName: body.podcastName,
    sessionTitle: body.sessionTitle,
    url: body.url ?? null,
    guest: body.guest ?? null,
    content: body.content ?? "",
    ...(body.summaryGeneratorText !== undefined
      ? { summaryGeneratorText: body.summaryGeneratorText }
      : {}),
  });
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
