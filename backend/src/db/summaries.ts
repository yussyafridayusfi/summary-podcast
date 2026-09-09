import { and, desc, eq } from "drizzle-orm";
import { SUMMARY_KINDS, summaries, type SummaryKind, type SummaryRow } from "./schema.ts";
import { useMemoryStorage } from "./storage.ts";

export type { SummaryKind };

export interface Summary {
  id: string;
  userId: string;
  kind: SummaryKind;
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  content: string;
  headline: string | null;
  aiSummary: string | null;
  takeaways: string[];
  quotes: string[];
  tags: string[];
  mood: string | null;
  coverPrompt: string | null;
  coverStyle: string | null;
  coverSeed: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSummaryInput {
  kind?: SummaryKind;
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  content?: string;
  headline?: string | null;
  aiSummary?: string | null;
  takeaways?: string[];
  quotes?: string[];
  tags?: string[];
  mood?: string | null;
  coverPrompt?: string | null;
  coverStyle?: string | null;
  coverSeed?: number | null;
}

export type UpdateSummaryInput = Partial<CreateSummaryInput>;

const AI_FIELDS = [
  "headline",
  "aiSummary",
  "takeaways",
  "quotes",
  "tags",
  "mood",
  "coverPrompt",
  "coverStyle",
  "coverSeed",
] as const;

export function isKind(v: unknown): v is SummaryKind {
  return typeof v === "string" && (SUMMARY_KINDS as readonly string[]).includes(v);
}

/** Whitelist and coerce incoming body fields so junk never reaches the DB. */
export function sanitizeInput(body: Record<string, unknown>): UpdateSummaryInput {
  const str = (v: unknown, max: number): string | null | undefined =>
    v === undefined ? undefined : v === null ? null : String(v).slice(0, max);
  const list = (v: unknown, max: number): string[] | undefined =>
    v === undefined
      ? undefined
      : Array.isArray(v)
        ? v
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.slice(0, 300))
            .slice(0, max)
        : [];
  const out: UpdateSummaryInput = {};
  if (body.kind !== undefined) out.kind = isKind(body.kind) ? body.kind : "podcast";
  if (body.podcastName !== undefined) out.podcastName = String(body.podcastName).slice(0, 200);
  if (body.sessionTitle !== undefined) out.sessionTitle = String(body.sessionTitle).slice(0, 300);
  if (body.url !== undefined) out.url = str(body.url, 2000) || null;
  if (body.content !== undefined) out.content = String(body.content ?? "").slice(0, 60_000);
  if (body.headline !== undefined) out.headline = str(body.headline, 200);
  if (body.aiSummary !== undefined) out.aiSummary = str(body.aiSummary, 20_000);
  if (body.takeaways !== undefined) out.takeaways = list(body.takeaways, 10);
  if (body.quotes !== undefined) out.quotes = list(body.quotes, 5);
  if (body.tags !== undefined) out.tags = list(body.tags, 10)?.map((t) => t.toLowerCase());
  if (body.mood !== undefined) out.mood = str(body.mood, 40);
  if (body.coverPrompt !== undefined) out.coverPrompt = str(body.coverPrompt, 500);
  if (body.coverStyle !== undefined) out.coverStyle = str(body.coverStyle, 30);
  if (body.coverSeed !== undefined) {
    const n = Number(body.coverSeed);
    out.coverSeed = Number.isFinite(n) ? Math.round(n) : null;
  }
  return out;
}

function toSummary(row: SummaryRow): Summary {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind ?? "podcast",
    podcastName: row.podcastName,
    sessionTitle: row.sessionTitle,
    url: row.url,
    content: row.content,
    headline: row.headline,
    aiSummary: row.aiSummary,
    takeaways: row.takeaways ?? [],
    quotes: row.quotes ?? [],
    tags: row.tags ?? [],
    mood: row.mood,
    coverPrompt: row.coverPrompt,
    coverStyle: row.coverStyle,
    coverSeed: row.coverSeed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface SummaryRepo {
  list(userId: string, kind?: SummaryKind): Promise<Summary[]>;
  get(userId: string, id: string): Promise<Summary | null>;
  create(userId: string, input: CreateSummaryInput): Promise<Summary>;
  update(userId: string, id: string, input: UpdateSummaryInput): Promise<Summary | null>;
  remove(userId: string, id: string): Promise<boolean>;
}

function rowFromInput(userId: string, input: CreateSummaryInput) {
  return {
    userId,
    kind: input.kind ?? ("podcast" as SummaryKind),
    podcastName: input.podcastName,
    sessionTitle: input.sessionTitle,
    url: input.url ?? null,
    content: input.content ?? "",
    headline: input.headline ?? null,
    aiSummary: input.aiSummary ?? null,
    takeaways: input.takeaways ?? [],
    quotes: input.quotes ?? [],
    tags: input.tags ?? [],
    mood: input.mood ?? null,
    coverPrompt: input.coverPrompt ?? null,
    coverStyle: input.coverStyle ?? null,
    coverSeed: input.coverSeed ?? null,
  };
}

function pgRepo(): SummaryRepo {
  // Lazy import so memory mode never opens a pool.
  const dbp = import("./client.ts").then((m) => m.db);
  return {
    async list(userId, kind) {
      const db = await dbp;
      const where = kind
        ? and(eq(summaries.userId, userId), eq(summaries.kind, kind))
        : eq(summaries.userId, userId);
      const rows = await db.select().from(summaries).where(where).orderBy(desc(summaries.updatedAt));
      return rows.map(toSummary);
    },
    async get(userId, id) {
      const db = await dbp;
      const [row] = await db
        .select()
        .from(summaries)
        .where(and(eq(summaries.userId, userId), eq(summaries.id, id)));
      return row ? toSummary(row) : null;
    },
    async create(userId, input) {
      const db = await dbp;
      const [row] = await db.insert(summaries).values(rowFromInput(userId, input)).returning();
      return toSummary(row);
    },
    async update(userId, id, input) {
      const db = await dbp;
      const patch: Partial<SummaryRow> = { updatedAt: new Date() };
      if (input.kind !== undefined) patch.kind = input.kind;
      if (input.podcastName !== undefined) patch.podcastName = input.podcastName;
      if (input.sessionTitle !== undefined) patch.sessionTitle = input.sessionTitle;
      if (input.url !== undefined) patch.url = input.url;
      if (input.content !== undefined) patch.content = input.content;
      for (const k of AI_FIELDS) {
        if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
      }
      const [row] = await db
        .update(summaries)
        .set(patch)
        .where(and(eq(summaries.userId, userId), eq(summaries.id, id)))
        .returning();
      return row ? toSummary(row) : null;
    },
    async remove(userId, id) {
      const db = await dbp;
      const res = await db
        .delete(summaries)
        .where(and(eq(summaries.userId, userId), eq(summaries.id, id)))
        .returning({ id: summaries.id });
      return res.length > 0;
    },
  };
}

const memoryStore = new Map<string, SummaryRow>();

function memoryRepo(): SummaryRepo {
  const store = memoryStore;
  return {
    async list(userId, kind) {
      return [...store.values()]
        .filter((r) => r.userId === userId && (!kind || r.kind === kind))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(toSummary);
    },
    async get(userId, id) {
      const r = store.get(id);
      return r && r.userId === userId ? toSummary(r) : null;
    },
    async create(userId, input) {
      const now = new Date();
      const row: SummaryRow = {
        id: globalThis.crypto.randomUUID(),
        ...rowFromInput(userId, input),
        createdAt: now,
        updatedAt: now,
      };
      store.set(row.id, row);
      return toSummary(row);
    },
    async update(userId, id, input) {
      const r = store.get(id);
      if (!r || r.userId !== userId) return null;
      const next: SummaryRow = { ...r, updatedAt: new Date() };
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) (next as Record<string, unknown>)[k] = v;
      }
      store.set(id, next);
      return toSummary(next);
    },
    async remove(userId, id) {
      const r = store.get(id);
      if (!r || r.userId !== userId) return false;
      store.delete(id);
      return true;
    },
  };
}

/** Memory-mode helper used by the auth repo to re-own a guest's rows. */
export async function claimGuestSummaries(guestId: string, userId: string): Promise<number> {
  let n = 0;
  for (const row of memoryStore.values()) {
    if (row.userId === guestId) {
      row.userId = userId;
      n++;
    }
  }
  return n;
}

export const repo: SummaryRepo = useMemoryStorage ? memoryRepo() : pgRepo();

export const listSummaries = repo.list.bind(repo);
export const getSummary = repo.get.bind(repo);
export const createSummary = repo.create.bind(repo);
export const updateSummary = repo.update.bind(repo);
export const deleteSummary = repo.remove.bind(repo);
