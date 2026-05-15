-- Add apiKey column to Project for CI/CD webhook authentication
ALTER TABLE "Project" ADD COLUMN "apiKey" TEXT;

-- Populate existing rows with a unique UUID
UPDATE "Project" SET "apiKey" = gen_random_uuid()::text WHERE "apiKey" IS NULL;

-- Make NOT NULL and add UNIQUE constraint
ALTER TABLE "Project" ALTER COLUMN "apiKey" SET NOT NULL;
CREATE UNIQUE INDEX "Project_apiKey_key" ON "Project"("apiKey");
