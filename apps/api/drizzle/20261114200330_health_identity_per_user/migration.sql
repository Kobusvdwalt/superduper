-- A raw record's identity becomes (user, origin, record type, source record id) instead of
-- (client, ...). Duplicates created by re-pairing a phone are merged first: the row with the
-- newest modified_at survives, every version is kept under it, and the duplicates' projections
-- go with them. On a database without duplicates every data statement touches no rows and this
-- is a pure constraint swap. Deleting a client no longer deletes its health data.
ALTER TABLE "health_raw_record_versions" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "health_raw_records" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_batches" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" DROP CONSTRAINT "health_raw_record_versions_client_id_clients_id_fkey", ADD CONSTRAINT "health_raw_record_versions_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "health_raw_records" DROP CONSTRAINT "health_raw_records_client_id_clients_id_fkey", ADD CONSTRAINT "health_raw_records_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sync_batches" DROP CONSTRAINT "sync_batches_client_id_clients_id_fkey", ADD CONSTRAINT "sync_batches_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" DROP CONSTRAINT "health_raw_record_versions_content_key";--> statement-breakpoint
ALTER TABLE "health_raw_records" DROP CONSTRAINT "health_raw_records_source_key";--> statement-breakpoint
CREATE TEMPORARY TABLE "health_raw_record_merge" AS
SELECT "id" AS "loser_id",
  first_value("id") OVER (
    PARTITION BY "user_id", "origin", "record_type", "source_record_id"
    ORDER BY "modified_at" DESC, "received_at" DESC, "id" DESC
  ) AS "survivor_id"
FROM "health_raw_records";--> statement-breakpoint
DELETE FROM "health_raw_record_merge" WHERE "loser_id" = "survivor_id";--> statement-breakpoint
UPDATE "health_raw_records" AS r
SET "deleted_at" = m."deleted_at", "updated_at" = now()
FROM (
  SELECT merge."survivor_id", max(loser."deleted_at") AS "deleted_at"
  FROM "health_raw_record_merge" AS merge
  JOIN "health_raw_records" AS loser ON loser."id" = merge."loser_id"
  GROUP BY merge."survivor_id"
) AS m
WHERE r."id" = m."survivor_id"
  AND m."deleted_at" >= r."modified_at"
  AND (r."deleted_at" IS NULL OR m."deleted_at" > r."deleted_at");--> statement-breakpoint
DELETE FROM "health_quantity_samples" WHERE "raw_record_id" IN (
  SELECT r."id" FROM "health_raw_records" AS r
  JOIN "health_raw_record_merge" AS m ON m."survivor_id" = r."id"
  WHERE r."deleted_at" IS NOT NULL
);--> statement-breakpoint
DELETE FROM "health_sleep_sessions" WHERE "raw_record_id" IN (
  SELECT r."id" FROM "health_raw_records" AS r
  JOIN "health_raw_record_merge" AS m ON m."survivor_id" = r."id"
  WHERE r."deleted_at" IS NOT NULL
);--> statement-breakpoint
DELETE FROM "health_workouts" WHERE "raw_record_id" IN (
  SELECT r."id" FROM "health_raw_records" AS r
  JOIN "health_raw_record_merge" AS m ON m."survivor_id" = r."id"
  WHERE r."deleted_at" IS NOT NULL
);--> statement-breakpoint
DELETE FROM "health_nutrition_entries" WHERE "raw_record_id" IN (
  SELECT r."id" FROM "health_raw_records" AS r
  JOIN "health_raw_record_merge" AS m ON m."survivor_id" = r."id"
  WHERE r."deleted_at" IS NOT NULL
);--> statement-breakpoint
UPDATE "health_raw_record_versions" AS v
SET "raw_record_id" = m."survivor_id"
FROM "health_raw_record_merge" AS m
WHERE v."raw_record_id" = m."loser_id";--> statement-breakpoint
DELETE FROM "health_raw_records" WHERE "id" IN (SELECT "loser_id" FROM "health_raw_record_merge");--> statement-breakpoint
DROP TABLE "health_raw_record_merge";--> statement-breakpoint
DELETE FROM "health_raw_record_versions" AS v
USING (
  SELECT "id", row_number() OVER (
    PARTITION BY "user_id", "origin", "record_type", "source_record_id", "content_hash"
    ORDER BY "received_at", "id"
  ) AS "n"
  FROM "health_raw_record_versions"
) AS d
WHERE v."id" = d."id" AND d."n" > 1;--> statement-breakpoint
ALTER TABLE "health_raw_record_versions" ADD CONSTRAINT "health_raw_record_versions_content_key" UNIQUE("user_id","origin","record_type","source_record_id","content_hash");--> statement-breakpoint
ALTER TABLE "health_raw_records" ADD CONSTRAINT "health_raw_records_source_key" UNIQUE("user_id","origin","record_type","source_record_id");
