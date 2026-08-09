INSERT INTO "branches" ("code", "name") VALUES ('other', 'Остальное') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
UPDATE "companies" SET "branch_code" = 'other' WHERE "branch_code" = 'news';--> statement-breakpoint
DELETE FROM "branches" WHERE "code" = 'news';
