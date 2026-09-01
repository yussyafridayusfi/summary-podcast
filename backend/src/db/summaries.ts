import { and, desc, eq } from "drizzle-orm";
import { db } from "./client.ts";
import { summaries, type SummaryRow } from "./schema.ts";

export interface Summary {
  id: string;
  userId: string;
  type: "podcast" | "food-review";
  podcastName: string;
  sessionTitle: string;
  url: string | null;
  guest: string | null;
  content: string;
  summaryGeneratorText: string;
  imageDataUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSummaryInput {
  type?: "podcast" | "food-review";
  podcastName: string;
  sessionTitle: string;
  url?: string | null;
  guest?: string | null;
  content?: string;
  summaryGeneratorText?: string;
  imageDataUri?: string | null;
}

export interface UpdateSummaryInput {
  type?: "podcast" | "food-review";
  podcastName?: string;
  sessionTitle?: string;
  url?: string | null;
  guest?: string | null;
  content?: string;
  summaryGeneratorText?: string;
  imageDataUri?: string | null;
}

function toSummary(row: SummaryRow): Summary {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type === "food-review" ? "food-review" : "podcast",
    podcastName: row.podcastName,
    sessionTitle: row.sessionTitle,
    url: row.url,
    guest: row.guest,
    content: row.content,
    summaryGeneratorText: row.summaryGeneratorText,
    imageDataUri: row.imageDataUri,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSummaries(userId: string, type?: "podcast" | "food-review"): Promise<Summary[]> {
  const rows = await db
    .select()
    .from(summaries)
    .where(type ? and(eq(summaries.userId, userId), eq(summaries.type, type)) : eq(summaries.userId, userId))
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
      type: input.type ?? "podcast",
      podcastName: input.podcastName,
      sessionTitle: input.sessionTitle,
      url: input.url ?? null,
      guest: input.guest ?? null,
      content: input.content ?? "",
      summaryGeneratorText: input.summaryGeneratorText ?? "",
      imageDataUri: input.imageDataUri ?? null,
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
  if (input.type !== undefined) patch.type = input.type;
  if (input.sessionTitle !== undefined) patch.sessionTitle = input.sessionTitle;
  if (input.url !== undefined) patch.url = input.url;
  if (input.guest !== undefined) patch.guest = input.guest;
  if (input.content !== undefined) patch.content = input.content;
  if (input.summaryGeneratorText !== undefined)
    patch.summaryGeneratorText = input.summaryGeneratorText;
  if (input.imageDataUri !== undefined) patch.imageDataUri = input.imageDataUri;

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
