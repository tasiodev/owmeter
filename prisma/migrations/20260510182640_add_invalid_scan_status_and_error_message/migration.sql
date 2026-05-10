-- AlterEnum
ALTER TYPE "ScanStatus" ADD VALUE 'INVALID';

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "errorMessage" TEXT;
