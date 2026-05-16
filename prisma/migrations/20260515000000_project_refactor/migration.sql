-- Project refactor: Website → Project, add CODE_REPO type, rename scan types
-- Idempotent: handles both fresh DBs and partially-applied state
-- (ALTER TYPE ADD VALUE is non-transactional in PostgreSQL, so partial commits happen)

-- 1. Wipe leftover test data (Website may already be gone)
DELETE FROM "Finding";
DELETE FROM "Scan";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Website' AND table_schema = 'public') THEN
    DELETE FROM "Website";
  END IF;
END $$;

-- 2. Create ProjectType enum
DO $$ BEGIN
  CREATE TYPE "ProjectType" AS ENUM ('WEBSITE', 'CODE_REPO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add new ScanType values
DO $$ BEGIN ALTER TYPE "ScanType" ADD VALUE 'PASSIVE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ScanType" ADD VALUE 'FULL';    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ScanType" ADD VALUE 'CODE';    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Create Project table
CREATE TABLE IF NOT EXISTS "Project" (
    "id"                    TEXT NOT NULL,
    "type"                  "ProjectType" NOT NULL DEFAULT 'WEBSITE',
    "name"                  TEXT NOT NULL,
    "domain"                TEXT,
    "verified"              BOOLEAN NOT NULL DEFAULT false,
    "verificationToken"     TEXT NOT NULL,
    "verificationMethod"    "VerificationMethod",
    "verifiedAt"            TIMESTAMP(3),
    "repoUrl"               TEXT,
    "repoVerified"          BOOLEAN NOT NULL DEFAULT false,
    "repoVerificationToken" TEXT,
    "repoVerifiedAt"        TIMESTAMP(3),
    "userId"                TEXT NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Project_verificationToken_key"     ON "Project"("verificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_repoVerificationToken_key" ON "Project"("repoVerificationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_domain_userId_key"         ON "Project"("domain", "userId");

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Add projectId column to Scan
DO $$ BEGIN
  ALTER TABLE "Scan" ADD COLUMN "projectId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Remove old websiteId
ALTER TABLE "Scan" DROP CONSTRAINT IF EXISTS "Scan_websiteId_fkey";
ALTER TABLE "Scan" DROP COLUMN IF EXISTS "websiteId";

-- 7. Enforce projectId NOT NULL + FK
ALTER TABLE "Scan" ALTER COLUMN "projectId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Scan" ADD CONSTRAINT "Scan_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Drop old Website table
DROP TABLE IF EXISTS "Website";

-- 9. Finalize ScanType enum (ScanType_old exists when partial commit occurred)
-- NOTE: SET DEFAULT 'PASSIVE' is intentionally omitted here because PostgreSQL
-- forbids using a newly-added enum value in the same transaction. It is applied
-- in the following migration once the new values are committed.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanType_old') THEN
    ALTER TABLE "Scan" ALTER COLUMN "type" DROP DEFAULT;
    BEGIN
      CREATE TYPE "ScanType" AS ENUM ('PASSIVE', 'FULL', 'CODE');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    ALTER TABLE "Scan" ALTER COLUMN "type" TYPE "ScanType" USING "type"::text::"ScanType";
    DROP TYPE "ScanType_old";
  END IF;
END $$;
