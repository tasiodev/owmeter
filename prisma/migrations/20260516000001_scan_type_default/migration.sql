-- Set PASSIVE as default ScanType.
-- This runs in a separate transaction from the ADD VALUE statements so that
-- PostgreSQL allows using the newly-committed enum value.
ALTER TABLE "Scan" ALTER COLUMN "type" SET DEFAULT 'PASSIVE'::"ScanType";
