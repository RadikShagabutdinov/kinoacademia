ALTER TABLE "permanent_contracts" ADD COLUMN IF NOT EXISTS "breakup_initiated_by" text;
--> statement-breakpoint
ALTER TABLE "temporary_contracts" ADD COLUMN IF NOT EXISTS "breakup_initiated_by" text;
