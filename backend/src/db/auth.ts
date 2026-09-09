import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  emailCodes,
  sessions,
  summaries,
  users,
  type EmailCodeRow,
  type UserRow,
} from "./schema.ts";
import { useMemoryStorage } from "./storage.ts";

export interface User {
  id: string;
  email: string;
  username: string;
  avatarStyle: string;
  avatarSeed: string;
  createdAt: string;
}

export const CODE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const newToken = () => randomBytes(32).toString("hex");
export const newSeed = () => randomBytes(6).toString("hex");

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatarStyle: row.avatarStyle,
    avatarSeed: row.avatarSeed,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface AuthRepo {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(input: { email: string; username: string }): Promise<User>;
  updateUser(
    id: string,
    patch: Partial<Pick<User, "username" | "avatarStyle" | "avatarSeed">>,
  ): Promise<User | null>;
  touchLogin(id: string): Promise<void>;

  /** Invalidate previous codes for the email and store a new one. */
  storeCode(email: string, codeHash: string, username: string | null): Promise<void>;
  /** Latest unconsumed, unexpired code for the email. */
  latestCode(email: string): Promise<EmailCodeRow | null>;
  bumpAttempts(id: string): Promise<number>;
  consumeCode(id: string): Promise<void>;

  createSession(userId: string, tokenHash: string): Promise<void>;
  userBySession(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;

  /** Move a guest's summaries into a real account. Returns rows moved. */
  claimGuest(guestId: string, userId: string): Promise<number>;
}

/* ---------------------------------------------------------------- postgres */

function pgRepo(): AuthRepo {
  const dbp = import("./client.ts").then((m) => m.db);
  return {
    async findUserByEmail(email) {
      const db = await dbp;
      const [row] = await db.select().from(users).where(eq(users.email, email));
      return row ? toUser(row) : null;
    },
    async findUserById(id) {
      const db = await dbp;
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row ? toUser(row) : null;
    },
    async createUser(input) {
      const db = await dbp;
      const [row] = await db
        .insert(users)
        .values({ email: input.email, username: input.username, avatarSeed: newSeed() })
        .returning();
      return toUser(row);
    },
    async updateUser(id, patch) {
      const db = await dbp;
      const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      return row ? toUser(row) : null;
    },
    async touchLogin(id) {
      const db = await dbp;
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
    },
    async storeCode(email, codeHash, username) {
      const db = await dbp;
      await db
        .update(emailCodes)
        .set({ consumedAt: new Date() })
        .where(and(eq(emailCodes.email, email), isNull(emailCodes.consumedAt)));
      await db.insert(emailCodes).values({
        email,
        codeHash,
        username,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
    },
    async latestCode(email) {
      const db = await dbp;
      const [row] = await db
        .select()
        .from(emailCodes)
        .where(
          and(
            eq(emailCodes.email, email),
            isNull(emailCodes.consumedAt),
            gt(emailCodes.expiresAt, new Date()),
          ),
        )
        .orderBy(sql`${emailCodes.createdAt} desc`)
        .limit(1);
      return row ?? null;
    },
    async bumpAttempts(id) {
      const db = await dbp;
      const [row] = await db
        .update(emailCodes)
        .set({ attempts: sql`${emailCodes.attempts} + 1` })
        .where(eq(emailCodes.id, id))
        .returning({ attempts: emailCodes.attempts });
      return row?.attempts ?? MAX_CODE_ATTEMPTS;
    },
    async consumeCode(id) {
      const db = await dbp;
      await db.update(emailCodes).set({ consumedAt: new Date() }).where(eq(emailCodes.id, id));
    },
    async createSession(userId, tokenHash) {
      const db = await dbp;
      await db.insert(sessions).values({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
    },
    async userBySession(tokenHash) {
      const db = await dbp;
      const [row] = await db
        .select({ user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())));
      return row ? toUser(row.user) : null;
    },
    async deleteSession(tokenHash) {
      const db = await dbp;
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
    async claimGuest(guestId, userId) {
      const db = await dbp;
      const rows = await db
        .update(summaries)
        .set({ userId })
        .where(eq(summaries.userId, guestId))
        .returning({ id: summaries.id });
      return rows.length;
    },
  };
}

/* ------------------------------------------------------------------ memory */

function memoryRepo(): AuthRepo {
  const userRows = new Map<string, UserRow>();
  const codes: EmailCodeRow[] = [];
  const sess = new Map<string, { userId: string; expiresAt: Date }>();
  const uuid = () => globalThis.crypto.randomUUID();
  const byEmail = (email: string) => [...userRows.values()].find((u) => u.email === email);
  return {
    async findUserByEmail(email) {
      const u = byEmail(email);
      return u ? toUser(u) : null;
    },
    async findUserById(id) {
      const u = userRows.get(id);
      return u ? toUser(u) : null;
    },
    async createUser(input) {
      const row: UserRow = {
        id: uuid(),
        email: input.email,
        username: input.username,
        avatarStyle: "adventurer",
        avatarSeed: newSeed(),
        createdAt: new Date(),
        lastLoginAt: null,
      };
      userRows.set(row.id, row);
      return toUser(row);
    },
    async updateUser(id, patch) {
      const u = userRows.get(id);
      if (!u) return null;
      const next = { ...u, ...patch };
      userRows.set(id, next);
      return toUser(next);
    },
    async touchLogin(id) {
      const u = userRows.get(id);
      if (u) u.lastLoginAt = new Date();
    },
    async storeCode(email, codeHash, username) {
      for (const c of codes) if (c.email === email && !c.consumedAt) c.consumedAt = new Date();
      codes.push({
        id: uuid(),
        email,
        codeHash,
        username,
        attempts: 0,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        consumedAt: null,
        createdAt: new Date(),
      });
    },
    async latestCode(email) {
      const now = Date.now();
      return (
        [...codes]
          .reverse()
          .find((c) => c.email === email && !c.consumedAt && c.expiresAt.getTime() > now) ?? null
      );
    },
    async bumpAttempts(id) {
      const c = codes.find((x) => x.id === id);
      if (!c) return MAX_CODE_ATTEMPTS;
      c.attempts += 1;
      return c.attempts;
    },
    async consumeCode(id) {
      const c = codes.find((x) => x.id === id);
      if (c) c.consumedAt = new Date();
    },
    async createSession(userId, tokenHash) {
      sess.set(tokenHash, { userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
    },
    async userBySession(tokenHash) {
      const s = sess.get(tokenHash);
      if (!s || s.expiresAt.getTime() < Date.now()) return null;
      const u = userRows.get(s.userId);
      return u ? toUser(u) : null;
    },
    async deleteSession(tokenHash) {
      sess.delete(tokenHash);
    },
    async claimGuest(guestId, userId) {
      // The summaries memory repo exposes a hook for this.
      const { claimGuestSummaries } = await import("./summaries.ts");
      return claimGuestSummaries(guestId, userId);
    },
  };
}

export const authRepo: AuthRepo = useMemoryStorage ? memoryRepo() : pgRepo();
