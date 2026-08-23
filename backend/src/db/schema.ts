import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  podcastName: text("podcast_name").notNull(),
  sessionTitle: text("session_title").notNull(),
  url: text("url"),
  guest: text("guest"),
  content: text("content").notNull().default(""),
  summaryGeneratorText: text("summary_generator_text").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SummaryRow = typeof summaries.$inferSelect;
export type NewSummaryRow = typeof summaries.$inferInsert;
