import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { aiRouter } from "./routes/ai.ts";
import { summariesRouter } from "./routes/summaries.ts";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: true, exposedHeaders: ["x-user-id"] }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/summaries", summariesRouter);
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
