DROP TABLE IF EXISTS "scans";
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "companies_system_unique" ON "companies" USING btree ("is_system") WHERE "is_system" = true;
--> statement-breakpoint
CREATE TABLE "scan_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"caption" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_sets" ADD CONSTRAINT "scan_sets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scan_sets" ADD CONSTRAINT "scan_sets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "scan_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"order_idx" integer NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_pages" ADD CONSTRAINT "scan_pages_set_id_scan_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."scan_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "scan_pages_set_order_unique" ON "scan_pages" USING btree ("set_id","order_idx");
--> statement-breakpoint
ALTER TABLE "permanent_contracts" ADD COLUMN "scan_set_id" uuid;
--> statement-breakpoint
ALTER TABLE "permanent_contracts" ADD CONSTRAINT "permanent_contracts_scan_set_id_scan_sets_id_fk" FOREIGN KEY ("scan_set_id") REFERENCES "public"."scan_sets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "temporary_contracts" ADD COLUMN "scan_set_id" uuid;
--> statement-breakpoint
ALTER TABLE "temporary_contracts" ADD CONSTRAINT "temporary_contracts_scan_set_id_scan_sets_id_fk" FOREIGN KEY ("scan_set_id") REFERENCES "public"."scan_sets"("id") ON DELETE set null ON UPDATE no action;
