import type { NextFunction, Request, Response } from "express";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.header("x-user-id");
  if (!raw || !UUID_RE.test(raw)) {
    res
      .status(400)
      .json({ error: "missing or invalid x-user-id header (expected uuid)" });
    return;
  }
  req.userId = raw;
  next();
}
