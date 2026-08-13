ALTER TABLE "company_ratings" ADD COLUMN IF NOT EXISTS "now_permanent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_ratings" ADD COLUMN IF NOT EXISTS "last_permanent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "company_ratings"
SET "now_permanent" = "employee_permanent" + "manual_topup" + "oscar" + "penalties";
--> statement-breakpoint
UPDATE "job_definitions"
SET "cron_expr" = '55 5,17 * * *'
WHERE "key" = 'capitalize_companies';
