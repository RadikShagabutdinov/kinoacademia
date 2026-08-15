-- Зеркало постоянного рейтинга сотрудников появилось позже действующих контрактов:
-- без бэкфилла первый же разрыв увёл бы капитализацию компании в минус.
UPDATE "company_ratings" cr
SET "employee_permanent" = cr."employee_permanent" + m."mirror",
    "now_permanent" = cr."employee_permanent" + m."mirror"
                      + cr."manual_topup" + cr."oscar" + cr."penalties"
FROM (
  SELECT pc."company_id" AS company_id, SUM(pr."now_permanent") AS mirror
  FROM "permanent_contracts" pc
  JOIN "person_ratings" pr ON pr."person_id" = pc."person_id"
  WHERE pc."status_code" = 'confirmed' AND pc."ended_at" IS NULL
  GROUP BY pc."company_id"
) m
WHERE cr."company_id" = m."company_id" AND m."mirror" <> 0;
--> statement-breakpoint
-- Компании, у которых строки рейтинга ещё нет: создаём сразу с зеркалом.
INSERT INTO "company_ratings" ("company_id", "employee_permanent", "now_permanent")
SELECT m."company_id", m."mirror", m."mirror"
FROM (
  SELECT pc."company_id" AS company_id, SUM(pr."now_permanent") AS mirror
  FROM "permanent_contracts" pc
  JOIN "person_ratings" pr ON pr."person_id" = pc."person_id"
  WHERE pc."status_code" = 'confirmed' AND pc."ended_at" IS NULL
  GROUP BY pc."company_id"
) m
WHERE m."mirror" <> 0
ON CONFLICT ("company_id") DO NOTHING;
