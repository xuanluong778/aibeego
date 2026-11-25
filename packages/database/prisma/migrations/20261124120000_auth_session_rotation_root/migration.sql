ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "rotation_root_id" TEXT;

CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_rotation_root_id_idx" ON "auth_sessions"("user_id", "rotation_root_id");