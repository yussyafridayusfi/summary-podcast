ALTER TABLE "summaries" ADD COLUMN "guest" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "summary_generator_text" text DEFAULT '' NOT NULL;