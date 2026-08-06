-- ============================================================
-- S7 — Financial Settings + BOQ (Session 2026-07-16, Deep mode)
-- ============================================================
--
-- Adds three additive tables for the project financial / BOQ system:
--   1. project_financial_settings — one-to-one with projects. Holds
--      contract value, retention %, advance amount/%, warranty window.
--      Every PATCH is audited (entity_type=project_financial_settings).
--   2. boq_items — Bill-of-Quantities tree (self-relation via parent_id).
--      Soft-delete only (deleted_at/deleted_by/deletion_reason). Deleting
--      an item with active children is blocked at the service layer.
--   3. boq_item_updates — join between an APPROVED daily update and a BOQ
--      item. UNIQUE(boq_item_id, update_id) prevents duplicate links; it
--      drives the real-time completedPct per item.
--
-- Purely additive: no ALTER on existing tables. The Prisma-side back
-- relations (Project.financialSettings / Project.boqItems / Update.boqLinks)
-- are client-only and emit no DDL.
--
-- Money columns use DECIMAL(15,2); percentages DECIMAL(5,2) (0-100 enforced
-- in the DTO). FKs use ON DELETE RESTRICT (parent_id: SET NULL) — consistent
-- with the rest of the schema; hard deletes never happen (soft-delete only).
-- ------------------------------------------------------------

-- CreateTable
CREATE TABLE "project_financial_settings" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "contract_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retention_pct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "advance_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "advance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "warranty_months" INTEGER NOT NULL DEFAULT 0,
    "warranty_start_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_financial_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "contract_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "deletion_reason" TEXT,

    CONSTRAINT "boq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_item_updates" (
    "id" UUID NOT NULL,
    "boq_item_id" UUID NOT NULL,
    "update_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boq_item_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_financial_settings_project_id_key" ON "project_financial_settings"("project_id");

-- CreateIndex
CREATE INDEX "boq_items_project_id_idx" ON "boq_items"("project_id");

-- CreateIndex
CREATE INDEX "boq_items_project_id_parent_id_idx" ON "boq_items"("project_id", "parent_id");

-- CreateIndex
CREATE INDEX "boq_items_project_id_deleted_at_idx" ON "boq_items"("project_id", "deleted_at");

-- CreateIndex
CREATE INDEX "boq_item_updates_boq_item_id_idx" ON "boq_item_updates"("boq_item_id");

-- CreateIndex
CREATE INDEX "boq_item_updates_update_id_idx" ON "boq_item_updates"("update_id");

-- CreateIndex
CREATE UNIQUE INDEX "boq_item_updates_boq_item_id_update_id_key" ON "boq_item_updates"("boq_item_id", "update_id");

-- AddForeignKey
ALTER TABLE "project_financial_settings" ADD CONSTRAINT "project_financial_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_item_updates" ADD CONSTRAINT "boq_item_updates_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_item_updates" ADD CONSTRAINT "boq_item_updates_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
