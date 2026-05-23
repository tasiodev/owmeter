-- CreateEnum
CREATE TYPE "FalsePositiveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FalsePositiveReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "category" "OWASPCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FalsePositiveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FalsePositiveReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FalsePositiveReport_projectId_category_title_filePath_key" ON "FalsePositiveReport"("projectId", "category", "title", "filePath");

-- AddForeignKey
ALTER TABLE "FalsePositiveReport" ADD CONSTRAINT "FalsePositiveReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FalsePositiveReport" ADD CONSTRAINT "FalsePositiveReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FalsePositiveReport" ADD CONSTRAINT "FalsePositiveReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
