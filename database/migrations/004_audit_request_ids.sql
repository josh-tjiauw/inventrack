-- 004_audit_request_ids.sql
-- Adds request correlation to audit logs so API mutations can be traced from response/logs to durable audit rows.

BEGIN;

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

COMMIT;
