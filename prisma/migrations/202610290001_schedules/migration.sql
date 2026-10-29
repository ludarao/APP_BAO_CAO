-- AlterTable
ALTER TABLE "Period" ADD COLUMN     "autoKey" TEXT,
ADD COLUMN     "scheduleOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReportingSchedule" (
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "openingDay" INTEGER NOT NULL DEFAULT 1,
    "opensTime" TEXT NOT NULL DEFAULT '08:00',
    "dueTime" TEXT NOT NULL DEFAULT '16:00',
    "closesTime" TEXT NOT NULL DEFAULT '17:00',
    "dueAfterDays" INTEGER NOT NULL DEFAULT 0,
    "closeAfterDays" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingSchedule_pkey" PRIMARY KEY ("kind")
);

-- CreateIndex
CREATE UNIQUE INDEX "Period_autoKey_key" ON "Period"("autoKey");

-- Defaults apply from activation onward, never retroactively create overdue obligations.
INSERT INTO "ReportingSchedule" ("kind", "updatedAt") VALUES
('WEEK', CURRENT_TIMESTAMP), ('MONTH', CURRENT_TIMESTAMP), ('QUARTER', CURRENT_TIMESTAMP),
('HALF_YEAR', CURRENT_TIMESTAMP), ('YEAR', CURRENT_TIMESTAMP);
