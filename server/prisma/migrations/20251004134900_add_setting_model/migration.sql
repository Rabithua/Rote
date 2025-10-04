/*
  Warnings:

  - You are about to drop the `system_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "system_settings";

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "group" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isInitialized" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_group_key" ON "settings"("group");

-- CreateIndex
CREATE INDEX "settings_isRequired_idx" ON "settings"("isRequired");

-- CreateIndex
CREATE INDEX "settings_isInitialized_idx" ON "settings"("isInitialized");

-- CreateIndex
CREATE INDEX "settings_isSystem_idx" ON "settings"("isSystem");
