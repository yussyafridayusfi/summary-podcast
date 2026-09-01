ALTER TABLE "summaries" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'podcast' NOT NULL;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN IF NOT EXISTS "image_data_uri" text;
