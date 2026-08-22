import { and, desc, eq } from "drizzle-orm";
import { db } from "./client.ts";
import { summaries, type SummaryRow } from "./schema.ts";

export interface Summary {
  id: string;
  userId: string;
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSummaryInput {
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  content?: string;
}

export interface UpdateSummaryInput {
  podcastName?: string;
  sessionTitle?: string;
  url?: string | null;
  content?: string;
}

function toSummary(row: SummaryRow): Summary {
  return {
    id: row.id,
    userId: row.userId,
    podcastName: row.podcastName,
    sessionTitle: row.sessionTitle,
    url: row.url,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSummaries(userId: string): Promise<Summary[]> {
  const rows = await db
    .select()
    .from(summaries)
    .where(eq(summaries.userId, userId))
    .orderBy(desc(summaries.updatedAt));
  return rows.map(toSummary);
}

export async function getSummary(
  userId: string,
  id: string,
): Promise<Summary | null> {
  const [row] = await db
    .select()
    .from(summaries)
    .where(and(eq(summaries.userId, userId), eq(summaries.id, id)));
  return row ? toSummary(row) : null;
}

export async function createSummary(
  userId: string,
  input: CreateSummaryInput,
): Promise<Summary> {
  const [row] = await db
    .insert(summaries)
    .values({
      userId,
      podcastName: input.podcastName,
      sessionTitle: input.sessionTitle,
      url: input.url ?? null,
      content: input.content ?? "",
    })
    .returning();
  return toSummary(row);
}

export async function updateSummary(
  userId: string,
  id: string,
  input: UpdateSummaryInput,
): Promise<Summary | null> {
  const patch: Partial<SummaryRow> = { updatedAt: new Date() };
  if (input.podcastName !== undefined) patch.podcastName = input.podcastName;
  if (input.sessionTitle !== undefined) patch.sessionTitle = input.sessionTitle;
  if (input.url !== undefined) patch.url = input.url;
  if (input.content !== undefined) patch.content = input.content;

  const [row] = await db
    .update(summaries)
    .set(patch)
    .where(and(eq(summaries.userId, userId), eq(summaries.id, id)))
    .returning();
  return row ? toSummary(row) : null;
}

export async function deleteSummary(
  userId: string,
  id: string,
): Promise<boolean> {
  const res = await db
    .delete(summaries)
    .where(and(eq(summaries.userId, userId), eq(summaries.id, id)))
    .returning({ id: summaries.id });
  return res.length > 0;
}
