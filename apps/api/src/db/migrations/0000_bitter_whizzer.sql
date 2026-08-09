CREATE TABLE "branches" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_exist" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_statuses" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominations" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "races" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"race_code" text NOT NULL,
	"role_code" text NOT NULL,
	"age" integer,
	"is_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"branch_code" text NOT NULL,
	"head_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"contract_kind" text NOT NULL,
	"from_status_code" text,
	"to_status_code" text NOT NULL,
	"changed_by_user_id" uuid,
	"comment" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permanent_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status_code" text NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temporary_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status_code" text NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_ratings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"budget" integer DEFAULT 0 NOT NULL,
	"employee_permanent" integer DEFAULT 0 NOT NULL,
	"manual_topup" integer DEFAULT 0 NOT NULL,
	"oscar" integer DEFAULT 0 NOT NULL,
	"penalties" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_ratings" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"generated" integer DEFAULT 0 NOT NULL,
	"now_permanent" integer DEFAULT 0 NOT NULL,
	"last_permanent" integer DEFAULT 0 NOT NULL,
	"base" integer DEFAULT 0 NOT NULL,
	"randomizer" integer DEFAULT 0 NOT NULL,
	"system_topup" integer DEFAULT 0 NOT NULL,
	"manual_topup" integer DEFAULT 0 NOT NULL,
	"oscar" integer DEFAULT 0 NOT NULL,
	"penalties" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_person_id" uuid,
	"donor_company_id" uuid,
	"recipient_person_id" uuid,
	"recipient_company_id" uuid,
	"amount" integer NOT NULL,
	"kind" text NOT NULL,
	"comment" text,
	"author_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "film_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	"contract_id" uuid,
	"contract_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oscars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid,
	"person_id" uuid,
	"nomination_code" text NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"contract_kind" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by_user_id" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_code_roles_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."roles"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_race_code_races_code_fk" FOREIGN KEY ("race_code") REFERENCES "public"."races"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_role_code_roles_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."roles"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_head_person_id_persons_id_fk" FOREIGN KEY ("head_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_status_history" ADD CONSTRAINT "contract_status_history_from_status_code_contract_statuses_code_fk" FOREIGN KEY ("from_status_code") REFERENCES "public"."contract_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_status_history" ADD CONSTRAINT "contract_status_history_to_status_code_contract_statuses_code_fk" FOREIGN KEY ("to_status_code") REFERENCES "public"."contract_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_status_history" ADD CONSTRAINT "contract_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_contracts" ADD CONSTRAINT "permanent_contracts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_contracts" ADD CONSTRAINT "permanent_contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_contracts" ADD CONSTRAINT "permanent_contracts_status_code_contract_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."contract_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_contracts" ADD CONSTRAINT "temporary_contracts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_contracts" ADD CONSTRAINT "temporary_contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_contracts" ADD CONSTRAINT "temporary_contracts_status_code_contract_statuses_code_fk" FOREIGN KEY ("status_code") REFERENCES "public"."contract_statuses"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_ratings" ADD CONSTRAINT "company_ratings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_ratings" ADD CONSTRAINT "person_ratings_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_donor_person_id_persons_id_fk" FOREIGN KEY ("donor_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_donor_company_id_companies_id_fk" FOREIGN KEY ("donor_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_recipient_person_id_persons_id_fk" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_recipient_company_id_companies_id_fk" FOREIGN KEY ("recipient_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_transactions" ADD CONSTRAINT "rating_transactions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_assignments" ADD CONSTRAINT "film_assignments_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_assignments" ADD CONSTRAINT "film_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oscars" ADD CONSTRAINT "oscars_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oscars" ADD CONSTRAINT "oscars_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oscars" ADD CONSTRAINT "oscars_nomination_code_nominations_code_fk" FOREIGN KEY ("nomination_code") REFERENCES "public"."nominations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_user_id_unique" ON "persons" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_name_unique" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "temporary_contracts_person_company_active_unique" ON "temporary_contracts" USING btree ("person_id","company_id") WHERE ended_at IS NULL;