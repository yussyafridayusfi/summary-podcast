import { pgTable, uuid, text, timestamp, date } from "drizzle-orm/pg-core";

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  type: text("type").notNull().default("podcast"),
  podcastName: text("podcast_name").notNull(),
  sessionTitle: text("session_title").notNull(),
  url: text("url"),
  guest: text("guest"),
  content: text("content").notNull().default(""),
  summaryGeneratorText: text("summary_generator_text").notNull().default(""),
  imageDataUri: text("image_data_uri"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SummaryRow = typeof summaries.$inferSelect;
export type NewSummaryRow = typeof summaries.$inferInsert;

/**
 * Food reviews live in their own table rather than sharing `summaries`: the two
 * record types have almost no fields in common beyond the AI/export plumbing
 * (content, summaryGeneratorText, imageDataUri), so a shared table would mean a
 * column is NULL for every row of the other kind.
 */
export const foodReviews = pgTable("food_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  restoName: text("resto_name").notNull(),
  description: text("description"),
  // `date` not `timestamp`: a visit is a calendar day, not an instant, and
  // mode "string" keeps it as a plain YYYY-MM-DD across the wire.
  dateVisit: date("date_visit", { mode: "string" }),
  location: text("location"),
  urlWebResto: text("url_web_resto"),
  // Shared with summaries — the generate/export pipeline reads these three.
  content: text("content").notNull().default(""),
  summaryGeneratorText: text("summary_generator_text").notNull().default(""),
  imageDataUri: text("image_data_uri"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FoodReviewRow = typeof foodReviews.$inferSelect;
export type NewFoodReviewRow = typeof foodReviews.$inferInsert;
