-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('BASIC', 'COMPLETE');

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "type" "ScanType" NOT NULL DEFAULT 'BASIC';
