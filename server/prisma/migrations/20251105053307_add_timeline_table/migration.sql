-- CreateTable
CREATE TABLE "timelines" (
    "id" UUID NOT NULL,
    "roteid" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "changes" JSONB,
    "userid" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timelines_roteid_createdAt_idx" ON "timelines"("roteid", "createdAt");

-- CreateIndex
CREATE INDEX "timelines_userid_idx" ON "timelines"("userid");

-- CreateIndex
CREATE INDEX "timelines_roteid_action_idx" ON "timelines"("roteid", "action");

-- AddForeignKey
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_roteid_fkey" FOREIGN KEY ("roteid") REFERENCES "rotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
