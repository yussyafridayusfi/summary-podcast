import type { NextFunction, Request, Response } from "express";
import { authRepo, sha256, type User } from "../db/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Owner of the data: a users.id when signed in, else the guest UUID. */
      userId: string;
      /** Present only for signed-in requests. */
      user?: User;
    }
  }
}

function bearer(req: Request): string | null {
  const h = req.header("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7).trim() || null : null;
}

/**
 * Resolves the caller. A valid `Authorization: Bearer <token>` wins; an
 * expired or unknown token is rejected (so the client knows to sign in
 * again) rather than silently downgraded. Without a bearer token the
 * anonymous `x-user-id` guest UUID is used.
 */
export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = bearer(req);
  if (token) {
    const user = await authRepo.userBySession(sha256(token));
    if (!user) {
      res.status(401).json({ error: "session expired, please sign in again", code: "UNAUTHENTICATED" });
      return;
    }
    req.userId = user.id;
    req.user = user;
    next();
    return;
  }
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

/** Like requireUser but only accepts signed-in users. */
export async function requireAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = bearer(req);
  const user = token ? await authRepo.userBySession(sha256(token)) : null;
  if (!user) {
    res.status(401).json({ error: "sign in required", code: "UNAUTHENTICATED" });
    return;
  }
  req.userId = user.id;
  req.user = user;
  next();
}

export { UUID_RE };
