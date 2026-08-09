DROP INDEX "users_email_lower_idx";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "email" TO "login";--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_lower_idx" ON "users" USING btree ("login");
