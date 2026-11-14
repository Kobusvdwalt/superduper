CREATE TYPE "client_kind" AS ENUM('DEVICE', 'CONNECTOR');--> statement-breakpoint
CREATE TYPE "health_metric" AS ENUM('STEPS', 'DISTANCE', 'FLOORS_CLIMBED', 'ELEVATION_GAINED', 'WHEELCHAIR_PUSHES', 'ACTIVE_ENERGY_BURNED', 'TOTAL_ENERGY_BURNED', 'BASAL_METABOLIC_RATE', 'HEART_RATE', 'RESTING_HEART_RATE', 'HEART_RATE_VARIABILITY_RMSSD', 'OXYGEN_SATURATION', 'RESPIRATORY_RATE', 'VO2_MAX', 'WEIGHT', 'HEIGHT', 'BODY_FAT', 'LEAN_BODY_MASS', 'BONE_MASS', 'BODY_WATER_MASS', 'BODY_TEMPERATURE', 'BASAL_BODY_TEMPERATURE', 'SKIN_TEMPERATURE_BASELINE', 'SKIN_TEMPERATURE_DELTA', 'BLOOD_GLUCOSE', 'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'HYDRATION', 'SPEED', 'POWER', 'CYCLING_PEDALING_CADENCE', 'STEPS_CADENCE');--> statement-breakpoint
CREATE TYPE "health_origin" AS ENUM('HEALTH_CONNECT');--> statement-breakpoint
CREATE TYPE "health_record_operation" AS ENUM('UPSERT', 'DELETE');--> statement-breakpoint
CREATE TYPE "health_route_status" AS ENUM('DATA', 'NO_DATA', 'CONSENT_REQUIRED');--> statement-breakpoint
CREATE TYPE "health_sleep_stage" AS ENUM('UNKNOWN', 'AWAKE', 'AWAKE_IN_BED', 'OUT_OF_BED', 'SLEEPING', 'LIGHT', 'DEEP', 'REM');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "client_kind" NOT NULL,
	"platform" text,
	"token_hash" text NOT NULL UNIQUE,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_nutrition_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"raw_record_id" uuid NOT NULL UNIQUE,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"start_zone_offset_seconds" integer,
	"end_zone_offset_seconds" integer,
	"meal_type" text,
	"name" text,
	"energy_kilocalories" double precision,
	"protein_grams" double precision,
	"total_carbohydrate_grams" double precision,
	"total_fat_grams" double precision,
	"dietary_fiber_grams" double precision,
	"sugar_grams" double precision,
	"nutrients" jsonb NOT NULL,
	"data_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_quantity_samples" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"raw_record_id" uuid NOT NULL,
	"metric" "health_metric" NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"data_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_raw_record_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"origin" "health_origin" NOT NULL,
	"record_type" text NOT NULL,
	"source_record_id" text NOT NULL,
	"raw_record_id" uuid,
	"operation" "health_record_operation" NOT NULL,
	"applied" boolean NOT NULL,
	"data_origin" text,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"start_zone_offset_seconds" integer,
	"end_zone_offset_seconds" integer,
	"modified_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"schema_version" integer NOT NULL,
	"payload" jsonb,
	"content_hash" text NOT NULL,
	"sync_batch_id" uuid NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_raw_record_versions_content_key" UNIQUE("client_id","origin","record_type","source_record_id","content_hash")
);
--> statement-breakpoint
CREATE TABLE "health_raw_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"origin" "health_origin" NOT NULL,
	"record_type" text NOT NULL,
	"source_record_id" text NOT NULL,
	"data_origin" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"start_zone_offset_seconds" integer,
	"end_zone_offset_seconds" integer,
	"modified_at" timestamp with time zone NOT NULL,
	"schema_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"received_at" timestamp with time zone NOT NULL,
	"sync_batch_id" uuid NOT NULL,
	"projected_at" timestamp with time zone,
	"projection_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_raw_records_source_key" UNIQUE("client_id","origin","record_type","source_record_id")
);
--> statement-breakpoint
CREATE TABLE "health_sleep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"raw_record_id" uuid NOT NULL UNIQUE,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"start_zone_offset_seconds" integer,
	"end_zone_offset_seconds" integer,
	"title" text,
	"notes" text,
	"data_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_sleep_stages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"session_id" uuid NOT NULL,
	"stage" "health_sleep_stage" NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_workout_laps" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workout_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"length_meters" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_workout_route_points" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workout_id" uuid NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"altitude_meters" double precision,
	"horizontal_accuracy_meters" double precision,
	"vertical_accuracy_meters" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_workout_segments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"workout_id" uuid NOT NULL,
	"segment_type" text NOT NULL,
	"repetitions" integer,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_workouts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"raw_record_id" uuid NOT NULL UNIQUE,
	"activity_type" text NOT NULL,
	"title" text,
	"notes" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"start_zone_offset_seconds" integer,
	"end_zone_offset_seconds" integer,
	"route_status" "health_route_status",
	"data_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_batches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"record_count" integer NOT NULL,
	"deletion_count" integer NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_batches_client_batch_key" UNIQUE("client_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "clients_user_id_idx" ON "clients" ("user_id");--> statement-breakpoint
CREATE INDEX "health_nutrition_entries_user_time_idx" ON "health_nutrition_entries" ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "health_quantity_samples_user_metric_time_idx" ON "health_quantity_samples" ("user_id","metric","start_time");--> statement-breakpoint
CREATE INDEX "health_quantity_samples_raw_record_idx" ON "health_quantity_samples" ("raw_record_id");--> statement-breakpoint
CREATE INDEX "health_raw_record_versions_raw_record_idx" ON "health_raw_record_versions" ("raw_record_id");--> statement-breakpoint
CREATE INDEX "health_raw_records_user_type_time_idx" ON "health_raw_records" ("user_id","record_type","start_time");--> statement-breakpoint
CREATE INDEX "health_raw_records_sync_batch_idx" ON "health_raw_records" ("sync_batch_id");--> statement-breakpoint
CREATE INDEX "health_sleep_sessions_user_time_idx" ON "health_sleep_sessions" ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "health_sleep_stages_session_idx" ON "health_sleep_stages" ("session_id","start_time");--> statement-breakpoint
CREATE INDEX "health_workout_laps_workout_idx" ON "health_workout_laps" ("workout_id","start_time");--> statement-breakpoint
CREATE INDEX "health_workout_route_points_workout_idx" ON "health_workout_route_points" ("workout_id","time");--> statement-breakpoint
CREATE INDEX "health_workout_segments_workout_idx" ON "health_workout_segments" ("workout_id","start_time");--> statement-breakpoint
CREATE INDEX "health_workouts_user_time_idx" ON "health_workouts" ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "sync_batches_user_received_idx" ON "sync_batches" ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_nutrition_entries" ADD CONSTRAINT "health_nutrition_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_nutrition_entries" ADD CONSTRAINT "health_nutrition_entries_qul18PicUJge_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "health_raw_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_quantity_samples" ADD CONSTRAINT "health_quantity_samples_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_quantity_samples" ADD CONSTRAINT "health_quantity_samples_ekOPmIVioTsA_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "health_raw_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" ADD CONSTRAINT "health_raw_record_versions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" ADD CONSTRAINT "health_raw_record_versions_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" ADD CONSTRAINT "health_raw_record_versions_Js5yMs1B0PKZ_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "health_raw_records"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" ADD CONSTRAINT "health_raw_record_versions_sync_batch_id_sync_batches_id_fkey" FOREIGN KEY ("sync_batch_id") REFERENCES "sync_batches"("id");--> statement-breakpoint
ALTER TABLE "health_raw_records" ADD CONSTRAINT "health_raw_records_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_raw_records" ADD CONSTRAINT "health_raw_records_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_raw_records" ADD CONSTRAINT "health_raw_records_sync_batch_id_sync_batches_id_fkey" FOREIGN KEY ("sync_batch_id") REFERENCES "sync_batches"("id");--> statement-breakpoint
ALTER TABLE "health_sleep_sessions" ADD CONSTRAINT "health_sleep_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_sleep_sessions" ADD CONSTRAINT "health_sleep_sessions_raw_record_id_health_raw_records_id_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "health_raw_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_sleep_stages" ADD CONSTRAINT "health_sleep_stages_session_id_health_sleep_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "health_sleep_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_workout_laps" ADD CONSTRAINT "health_workout_laps_workout_id_health_workouts_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "health_workouts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_workout_route_points" ADD CONSTRAINT "health_workout_route_points_workout_id_health_workouts_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "health_workouts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_workout_segments" ADD CONSTRAINT "health_workout_segments_workout_id_health_workouts_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "health_workouts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_workouts" ADD CONSTRAINT "health_workouts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "health_workouts" ADD CONSTRAINT "health_workouts_raw_record_id_health_raw_records_id_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "health_raw_records"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;