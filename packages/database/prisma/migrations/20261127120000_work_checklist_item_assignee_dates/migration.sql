-- Hạng mục checklist: người được giao + ngày bắt đầu / kết thúc (chỉ thêm cột, idempotent).
ALTER TABLE "work_checklist_items"
  ADD COLUMN IF NOT EXISTS "assignee_id" TEXT,
  ADD COLUMN IF NOT EXISTS "start_date" DATE,
  ADD COLUMN IF NOT EXISTS "due_date" DATE;

CREATE INDEX IF NOT EXISTS "work_checklist_items_assignee_id_idx"
  ON "work_checklist_items"("assignee_id");
