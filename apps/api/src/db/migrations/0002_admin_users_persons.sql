ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "closed_at" timestamp with time zone;
--> statement-breakpoint
DROP INDEX IF EXISTS "persons_user_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "persons_user_id_open_unique" ON "persons" USING btree ("user_id") WHERE "is_open" = true AND "user_id" IS NOT NULL;
