-- TouchQR Migration 006 Rollback: Drop Archival Tables & Indexes
-- Target Database: PostgreSQL 14+ / Neon Serverless Postgres
-- Execution Mode: TRANSACTIONAL (Safe within BEGIN ... COMMIT)

DROP TABLE IF EXISTS audit_logs_archive_staging CASCADE;
DROP TABLE IF EXISTS audit_log_archive_tombstones CASCADE;
DROP TABLE IF EXISTS audit_log_archive_batches CASCADE;
DROP TABLE IF EXISTS audit_log_archives CASCADE;
