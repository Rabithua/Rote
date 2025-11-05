/*
  Warnings:

  - You are about to drop the `timelines` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "timelines" DROP CONSTRAINT "timelines_roteid_fkey";

-- DropTable
DROP TABLE "timelines";

-- CreateTable
CREATE TABLE "rote_changes" (
    "id" UUID NOT NULL,
    "originid" UUID NOT NULL,
    "roteid" UUID,
    "action" VARCHAR(50) NOT NULL DEFAULT 'CREATE',
    "userid" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rote_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rote_changes_originid_createdAt_idx" ON "rote_changes"("originid", "createdAt");

-- CreateIndex
CREATE INDEX "rote_changes_originid_action_idx" ON "rote_changes"("originid", "action");

-- CreateIndex
CREATE INDEX "rote_changes_roteid_createdAt_idx" ON "rote_changes"("roteid", "createdAt");

-- CreateIndex
CREATE INDEX "rote_changes_userid_idx" ON "rote_changes"("userid");

-- CreateIndex
CREATE INDEX "rote_changes_roteid_action_idx" ON "rote_changes"("roteid", "action");

-- AddForeignKey
ALTER TABLE "rote_changes" ADD CONSTRAINT "rote_changes_roteid_fkey" FOREIGN KEY ("roteid") REFERENCES "rotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
