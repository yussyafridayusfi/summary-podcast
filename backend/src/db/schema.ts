import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Which section of the app a summary belongs to. */
export const SUMMARY_KINDS = ["podcast", "food"] as const;
export type SummaryKind = (typeof SUMMARY_KINDS)[number];

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Either a users.id or an anonymous guest UUID from the browser. */
  userId: text("user_id").notNull(),
  kind: text("kind").$type<SummaryKind>().notNull().default("podcast"),
  podcastName: text("podcast_name").notNull(),
  sessionTitle: text("session_title").notNull(),
  url: text("url"),
  /** Raw listener notes. */
  content: text("content").notNull().default(""),
  /** AI-generated fields. All optional: a summary can be purely manual. */
  headline: text("headline"),
  aiSummary: text("ai_summary"),
  takeaways: jsonb("takeaways").$type<string[]>().notNull().default([]),
  quotes: jsonb("quotes").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  mood: text("mood"),
  coverPrompt: text("cover_prompt"),
  coverStyle: text("cover_style"),
  coverSeed: integer("cover_seed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SummaryRow = typeof summaries.$inferSelect;
export type NewSummaryRow = typeof summaries.$inferInsert;

/* ------------------------------------------------------------------ auth */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    avatarStyle: text("avatar_style").notNull().default("adventurer"),
    avatarSeed: text("avatar_seed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export type UserRow = typeof users.$inferSelect;

/** One-time verification codes (hashed). */
export const emailCodes = pgTable("email_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  /** Username captured at sign-up time so verify can create the account. */
  username: text("username"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EmailCodeRow = typeof emailCodes.$inferSelect;

/** Bearer sessions (token stored hashed). */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SessionRow = typeof sessions.$inferSelect;
