/*
  Warnings:

  - The values [BASIC,COMPLETE] on the enum `ScanType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ScanType_new" AS ENUM ('PASSIVE', 'FULL', 'CODE');
ALTER TABLE "public"."Scan" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Scan" ALTER COLUMN "type" TYPE "ScanType_new" USING ("type"::text::"ScanType_new");
ALTER TYPE "ScanType" RENAME TO "ScanType_old";
ALTER TYPE "ScanType_new" RENAME TO "ScanType";
DROP TYPE "public"."ScanType_old";
ALTER TABLE "Scan" ALTER COLUMN "type" SET DEFAULT 'PASSIVE';
COMMIT;
