import { and, desc, eq } from "drizzle-orm";
import { db } from "./client.ts";
import { foodReviews, type FoodReviewRow } from "./schema.ts";

export interface FoodReview {
  id: string;
  userId: string;
  restoName: string;
  description: string | null;
  /** Calendar day, YYYY-MM-DD. */
  dateVisit: string | null;
  location: string | null;
  urlWebResto: string | null;
  content: string;
  summaryGeneratorText: string;
  imageDataUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFoodReviewInput {
  restoName: string;
  description?: string | null;
  dateVisit?: string | null;
  location?: string | null;
  urlWebResto?: string | null;
  content?: string;
  summaryGeneratorText?: string;
  imageDataUri?: string | null;
}

export interface UpdateFoodReviewInput {
  restoName?: string;
  description?: string | null;
  dateVisit?: string | null;
  location?: string | null;
  urlWebResto?: string | null;
  content?: string;
  summaryGeneratorText?: string;
  imageDataUri?: string | null;
}

function toFoodReview(row: FoodReviewRow): FoodReview {
  return {
    id: row.id,
    userId: row.userId,
    restoName: row.restoName,
    description: row.description,
    dateVisit: row.dateVisit,
    location: row.location,
    urlWebResto: row.urlWebResto,
    content: row.content,
    summaryGeneratorText: row.summaryGeneratorText,
    imageDataUri: row.imageDataUri,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFoodReviews(userId: string): Promise<FoodReview[]> {
  const rows = await db
    .select()
    .from(foodReviews)
    .where(eq(foodReviews.userId, userId))
    .orderBy(desc(foodReviews.updatedAt));
  return rows.map(toFoodReview);
}

export async function getFoodReview(
  userId: string,
  id: string,
): Promise<FoodReview | null> {
  const [row] = await db
    .select()
    .from(foodReviews)
    .where(and(eq(foodReviews.userId, userId), eq(foodReviews.id, id)));
  return row ? toFoodReview(row) : null;
}

export async function createFoodReview(
  userId: string,
  input: CreateFoodReviewInput,
): Promise<FoodReview> {
  const [row] = await db
    .insert(foodReviews)
    .values({
      userId,
      restoName: input.restoName,
      description: input.description ?? null,
      dateVisit: input.dateVisit ?? null,
      location: input.location ?? null,
      urlWebResto: input.urlWebResto ?? null,
      content: input.content ?? "",
      summaryGeneratorText: input.summaryGeneratorText ?? "",
      imageDataUri: input.imageDataUri ?? null,
    })
    .returning();
  return toFoodReview(row);
}

export async function updateFoodReview(
  userId: string,
  id: string,
  input: UpdateFoodReviewInput,
): Promise<FoodReview | null> {
  const patch: Partial<FoodReviewRow> = { updatedAt: new Date() };
  if (input.restoName !== undefined) patch.restoName = input.restoName;
  if (input.description !== undefined) patch.description = input.description;
  if (input.dateVisit !== undefined) patch.dateVisit = input.dateVisit;
  if (input.location !== undefined) patch.location = input.location;
  if (input.urlWebResto !== undefined) patch.urlWebResto = input.urlWebResto;
  if (input.content !== undefined) patch.content = input.content;
  if (input.summaryGeneratorText !== undefined)
    patch.summaryGeneratorText = input.summaryGeneratorText;
  if (input.imageDataUri !== undefined) patch.imageDataUri = input.imageDataUri;

  const [row] = await db
    .update(foodReviews)
    .set(patch)
    .where(and(eq(foodReviews.userId, userId), eq(foodReviews.id, id)))
    .returning();
  return row ? toFoodReview(row) : null;
}

export async function deleteFoodReview(
  userId: string,
  id: string,
): Promise<boolean> {
  const res = await db
    .delete(foodReviews)
    .where(and(eq(foodReviews.userId, userId), eq(foodReviews.id, id)))
    .returning({ id: foodReviews.id });
  return res.length > 0;
}
