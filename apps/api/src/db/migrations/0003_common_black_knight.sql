CREATE TABLE "job_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cron_expr" text NOT NULL,
	"timezone" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_key" text NOT NULL,
	"slot" text NOT NULL,
	"status" text NOT NULL,
	"triggered_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"output" jsonb
);
--> statement-breakpoint
DROP INDEX "persons_user_id_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_key_slot_uq" ON "job_runs" USING btree ("job_key","slot");--> statement-breakpoint
CREATE INDEX "job_runs_started_at_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_user_id_open_unique" ON "persons" USING btree ("user_id") WHERE "persons"."is_open" = true AND "persons"."user_id" IS NOT NULL;