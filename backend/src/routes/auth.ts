import { Router } from "express";
import {
  authRepo,
  MAX_CODE_ATTEMPTS,
  newCode,
  newSeed,
  newToken,
  sha256,
} from "../db/auth.ts";
import { requireAccount, UUID_RE } from "../middleware/user.ts";
import { exposeDevCode, sendCode, smtpConfigured } from "../auth/mailer.ts";

export const authRouter = Router();

export const AVATAR_STYLES = [
  "adventurer",
  "fun-emoji",
  "notionists",
  "bottts",
  "pixel-art",
  "thumbs",
  "ai",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();

/** Per-email throttle so a form can't hammer the mailer. */
const lastSent = new Map<string, number>();
const RESEND_MS = 30_000;

authRouter.get("/config", (_req, res) => {
  res.json({
    mailer: smtpConfigured ? "smtp" : "console",
    devCodes: exposeDevCode,
    avatarStyles: AVATAR_STYLES,
  });
});

/**
 * Step 1: request a code. `mode` is "signup" (needs username, email must be
 * new) or "signin" (email must exist). Unknown emails on signin return the
 * same shape as success to avoid leaking who has an account.
 */
authRouter.post("/request-code", async (req, res) => {
  const body = (req.body ?? {}) as { email?: unknown; username?: unknown; mode?: unknown };
  const email = normEmail(body.email);
  const mode = body.mode === "signup" ? "signup" : "signin";
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const existing = await authRepo.findUserByEmail(email);
  let username: string | null = null;
  if (mode === "signup") {
    username = String(body.username ?? "").trim();
    if (!USERNAME_RE.test(username)) {
      res.status(400).json({ error: "Username: 3-20 letters, numbers or underscores." });
      return;
    }
    if (existing) {
      res.status(409).json({ error: "That email already has an account. Sign in instead.", code: "EXISTS" });
      return;
    }
  } else if (!existing) {
    // Pretend we sent it; nothing to verify against so verify will fail.
    res.json({ ok: true, resendIn: RESEND_MS / 1000 });
    return;
  }

  const last = lastSent.get(email) ?? 0;
  if (Date.now() - last < RESEND_MS) {
    res.status(429).json({
      error: `Please wait ${Math.ceil((RESEND_MS - (Date.now() - last)) / 1000)} s before requesting another code.`,
    });
    return;
  }

  const code = newCode();
  await authRepo.storeCode(email, sha256(code), username);
  lastSent.set(email, Date.now());
  const { delivered } = await sendCode({ to: email, code, purpose: mode });
  res.json({
    ok: true,
    delivered,
    resendIn: RESEND_MS / 1000,
    ...(exposeDevCode ? { devCode: code } : {}),
  });
});

/**
 * Step 2: verify the code. Creates the account on signup, opens a session,
 * and optionally claims summaries made as a guest (`guestId`).
 */
authRouter.post("/verify", async (req, res) => {
  const body = (req.body ?? {}) as { email?: unknown; code?: unknown; guestId?: unknown };
  const email = normEmail(body.email);
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!EMAIL_RE.test(email) || code.length !== 6) {
    res.status(400).json({ error: "Enter the 6-digit code from your email." });
    return;
  }
  const rec = await authRepo.latestCode(email);
  if (!rec) {
    res.status(400).json({ error: "That code has expired. Request a new one.", code: "EXPIRED" });
    return;
  }
  if (rec.attempts >= MAX_CODE_ATTEMPTS) {
    res.status(429).json({ error: "Too many attempts. Request a new code.", code: "LOCKED" });
    return;
  }
  if (rec.codeHash !== sha256(code)) {
    const attempts = await authRepo.bumpAttempts(rec.id);
    res.status(400).json({
      error: `Wrong code. ${Math.max(0, MAX_CODE_ATTEMPTS - attempts)} attempts left.`,
      code: "WRONG",
    });
    return;
  }
  await authRepo.consumeCode(rec.id);

  let user = await authRepo.findUserByEmail(email);
  let created = false;
  if (!user) {
    if (!rec.username) {
      res.status(400).json({ error: "No account for this email. Sign up first.", code: "NO_ACCOUNT" });
      return;
    }
    user = await authRepo.createUser({ email, username: rec.username });
    created = true;
  }
  await authRepo.touchLogin(user.id);

  let claimed = 0;
  const guestId = typeof body.guestId === "string" ? body.guestId : "";
  if (UUID_RE.test(guestId) && guestId !== user.id) {
    claimed = await authRepo.claimGuest(guestId, user.id);
  }

  const token = newToken();
  await authRepo.createSession(user.id, sha256(token));
  res.status(created ? 201 : 200).json({ token, user, created, claimed });
});

authRouter.get("/me", requireAccount, (req, res) => {
  res.json({ user: req.user });
});

authRouter.patch("/me", requireAccount, async (req, res) => {
  const body = (req.body ?? {}) as { username?: unknown; avatarStyle?: unknown; avatarSeed?: unknown };
  const patch: { username?: string; avatarStyle?: string; avatarSeed?: string } = {};
  if (body.username !== undefined) {
    const u = String(body.username).trim();
    if (!USERNAME_RE.test(u)) {
      res.status(400).json({ error: "Username: 3-20 letters, numbers or underscores." });
      return;
    }
    patch.username = u;
  }
  if (body.avatarStyle !== undefined) {
    const s = String(body.avatarStyle);
    if (!(AVATAR_STYLES as readonly string[]).includes(s)) {
      res.status(400).json({ error: "Unknown avatar style." });
      return;
    }
    patch.avatarStyle = s;
  }
  if (body.avatarSeed !== undefined) {
    patch.avatarSeed = body.avatarSeed === "shuffle" ? newSeed() : String(body.avatarSeed).slice(0, 40);
  }
  const user = await authRepo.updateUser(req.userId, patch);
  res.json({ user });
});

authRouter.post("/logout", async (req, res) => {
  const h = req.header("authorization");
  if (h?.startsWith("Bearer ")) await authRepo.deleteSession(sha256(h.slice(7).trim()));
  res.status(204).end();
});
