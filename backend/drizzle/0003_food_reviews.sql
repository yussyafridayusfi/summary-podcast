CREATE TABLE IF NOT EXISTS "food_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"resto_name" text NOT NULL,
	"description" text,
	"date_visit" date,
	"location" text,
	"url_web_resto" text,
	"content" text DEFAULT '' NOT NULL,
	"summary_generator_text" text DEFAULT '' NOT NULL,
	"image_data_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_reviews_user_id_updated_at_idx" ON "food_reviews" ("user_id","updated_at" DESC);
