import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { aiRouter } from "./routes/ai.ts";
import { foodReviewsRouter } from "./routes/foodReviews.ts";
import { summariesRouter } from "./routes/summaries.ts";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: true, exposedHeaders: ["x-user-id"] }));
// Food reviews carry the uploaded photo inline as a base64 data URI, which adds
// ~33% on top of the file size — 1mb rejected any real phone photo.
app.use(express.json({ limit: "12mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/summaries", summariesRouter);
app.use("/api/food-reviews", foodReviewsRouter);
app.use("/api/ai", aiRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  },
);

app.listen(port, () => {
  console.log(`🎙️  podcast-summary API on http://localhost:${port}`);
});
