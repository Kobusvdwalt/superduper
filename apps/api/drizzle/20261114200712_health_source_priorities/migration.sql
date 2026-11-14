CREATE TABLE "health_source_priorities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"metric" "health_metric" NOT NULL,
	"data_origins" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_source_priorities_user_metric_key" UNIQUE("user_id","metric")
);
--> statement-breakpoint
ALTER TABLE "health_source_priorities" ADD CONSTRAINT "health_source_priorities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;