-- TouchQR Migration 005 Rollback: Audit Logs Performance Optimization Indexes
-- Target Database: PostgreSQL 14+ / Neon Serverless Postgres
-- Execution Mode: NON-TRANSACTIONAL (DO NOT WRAP IN BEGIN ... COMMIT)
--
-- CRITICAL POSTGRESQL CONSTRAINT:
-- PostgreSQL does NOT allow DROP INDEX CONCURRENTLY inside a transaction block (ERROR: 25001).
-- Each statement below MUST be executed as a standalone query outside of a transaction.

-- 1. Drop Tenant-scoped Activity Index
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_resto_created_id;

-- 2. Drop Global Activity Pagination Index
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_created_id;
