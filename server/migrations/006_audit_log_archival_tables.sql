-- TouchQR Migration 006: Audit Log Archival Tables & Performance Indexes
-- Target Database: PostgreSQL 14+ / Neon Serverless Postgres
-- Execution Mode: TRANSACTIONAL (Safe within BEGIN ... COMMIT)
--
-- Tables Provisioned:
-- 1. audit_log_archives: Catalog chunk tracking, content SHA256, byte sizes, status
-- 2. audit_log_archive_batches: Batch transaction ledger, ID arrays, commit timestamps
-- 3. audit_log_archive_tombstones: Orphan object registry for WORM-locked Cloudflare R2 files
-- 4. audit_logs_archive_staging: Isolated staging table for safe record rehydration on restore
--
-- Indexes Provisioned:
-- - audit_log_archives(status)
-- - audit_log_archives(track, created_at DESC)
-- - audit_log_archives(created_at DESC)
-- - audit_log_archive_batches(archive_id, status)
-- - audit_log_archive_tombstones(created_at DESC)
-- - audit_logs_archive_staging(restored_from_archive_id)
-- - audit_logs_archive_staging(restaurant_id, created_at DESC)

-- 1. Audit Log Archives Catalog
CREATE TABLE IF NOT EXISTS audit_log_archives (
  id SERIAL PRIMARY KEY,
  archive_uid VARCHAR(64) NOT NULL UNIQUE,
  idempotency_key VARCHAR(64) NOT NULL UNIQUE,
  archive_key VARCHAR(500) NOT NULL UNIQUE,
  bucket_name VARCHAR(255) NOT NULL,
  track VARCHAR(20) NOT NULL DEFAULT 'operational',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  min_id INT NOT NULL,
  max_id INT NOT NULL,
  total_records INT NOT NULL,
  pruned_records INT NOT NULL DEFAULT 0,
  file_size_bytes BIGINT NOT NULL,
  file_sha256 VARCHAR(64) NOT NULL,
  content_sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'STAGED',
  last_committed_batch INT NOT NULL DEFAULT 0,
  total_batches INT NOT NULL DEFAULT 1,
  attempt_count INT NOT NULL DEFAULT 1,
  last_error TEXT,
  verified_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Audit Log Archive Batches Ledger
CREATE TABLE IF NOT EXISTS audit_log_archive_batches (
  id SERIAL PRIMARY KEY,
  archive_id INT NOT NULL REFERENCES audit_log_archives(id) ON DELETE CASCADE,
  batch_index INT NOT NULL,
  batch_size INT NOT NULL,
  target_ids INT[] NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  committed_at TIMESTAMP,
  UNIQUE(archive_id, batch_index)
);

-- 3. Audit Log Archive Tombstones
CREATE TABLE IF NOT EXISTS audit_log_archive_tombstones (
  id SERIAL PRIMARY KEY,
  object_key VARCHAR(500) NOT NULL,
  bucket_name VARCHAR(255) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Audit Logs Archive Staging Table (for safe rehydration)
CREATE TABLE IF NOT EXISTS audit_logs_archive_staging (
  id INT PRIMARY KEY,
  restaurant_id INT,
  actor_role VARCHAR(50),
  action VARCHAR(100),
  details TEXT,
  created_at TIMESTAMP,
  restored_from_archive_id INT,
  restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_archives_status 
  ON audit_log_archives (status);

CREATE INDEX IF NOT EXISTS idx_audit_log_archives_track_created 
  ON audit_log_archives (track, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_archives_created_at 
  ON audit_log_archives (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_archive_batches_arch_status 
  ON audit_log_archive_batches (archive_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_log_archive_tombstones_created 
  ON audit_log_archive_tombstones (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_staging_restored_from 
  ON audit_logs_archive_staging (restored_from_archive_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_staging_resto_created 
  ON audit_logs_archive_staging (restaurant_id, created_at DESC);
