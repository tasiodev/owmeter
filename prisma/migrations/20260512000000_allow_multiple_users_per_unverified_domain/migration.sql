-- Drop global unique constraint on domain (one domain per platform)
DROP INDEX IF EXISTS "Website_domain_key";

-- Add per-user unique constraint (one domain per user)
CREATE UNIQUE INDEX "Website_domain_userId_key" ON "Website"("domain", "userId");
