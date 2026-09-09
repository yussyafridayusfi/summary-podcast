ALTER TABLE "summaries" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "takeaways" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "quotes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "mood" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "cover_prompt" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "cover_style" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "cover_seed" integer;