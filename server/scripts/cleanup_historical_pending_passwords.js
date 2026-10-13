/**
 * HISTORICAL PENDING-REGISTRATION PASSWORD SANITIZATION UTILITY (P1 Hardened)
 * TouchQR Subscription Billing Security
 *
 * Scans pending_registrations for historical plaintext password keys
 * (`owner_password`, `password`, `pwd`) and redundant `password_hash` inside the JSON payload.
 *
 * SAFETY RULES:
 * 1. Default mode is DRY-RUN (read-only audit).
 * 2. NEVER prints or logs passwords, password hashes, usernames, or customer details.
 * 3. Does not run automatically against production.
 * 4. Preserves all other registration and checkout fields.
 * 5. Ensures only valid bcrypt hashes are stored in the dedicated `password_hash` column.
 *    Plaintext is NEVER copied directly; it must be hashed before storage.
 * 6. Never overwrites an existing canonical column hash.
 * 7. Conflicting credentials without an existing canonical hash are deferred for manual review.
 */

import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';

/**
 * Checks if a string is a valid bcrypt hash format ($2a$, $2b$, $2y$).
 * @param {any} str
 * @returns {boolean}
 */
export function isBcryptHash(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(trimmed);
}

const PLAINTEXT_KEYS = Object.freeze(['owner_password', 'password', 'pwd']);

/**
 * Read-only audit function. Counts affected records without modifying data.
 * @param {Function} [customQuery=query]
 * @returns {Promise<{
 *   total: number,
 *   plaintextCount: number,
 *   redundantHashCount: number,
 *   needsColumnMigration: number,
 *   legacyKeyBreakdown: { owner_password: number, password: number, pwd: number, password_hash: number },
 *   conflictingCount: number,
 *   malformedJsonCount: number
 * }>}
 */
export async function auditHistoricalPendingPasswords(customQuery = query) {
  const rows = await customQuery('SELECT id, payload, password_hash FROM pending_registrations');
  let plaintextCount = 0;
  let redundantHashCount = 0;
  let needsColumnMigration = 0;
  let conflictingCount = 0;
  let malformedJsonCount = 0;

  const legacyKeyBreakdown = {
    owner_password: 0,
    password: 0,
    pwd: 0,
    password_hash: 0
  };

  for (const row of rows) {
    if (!row.payload) continue;
    let payloadObj = null;
    try {
      payloadObj = typeof row.payload === 'object' ? row.payload : JSON.parse(row.payload);
    } catch {
      malformedJsonCount++;
      continue;
    }

    if (!payloadObj || typeof payloadObj !== 'object') continue;

    let hasAnyPlaintext = false;
    const foundPlaintexts = [];

    for (const key of PLAINTEXT_KEYS) {
      if (payloadObj[key] !== undefined && payloadObj[key] !== null && String(payloadObj[key]).trim().length > 0) {
        legacyKeyBreakdown[key]++;
        hasAnyPlaintext = true;
        foundPlaintexts.push(String(payloadObj[key]).trim());
      }
    }

    const hasHashInJson = Boolean(payloadObj.password_hash);
    if (hasHashInJson) {
      legacyKeyBreakdown.password_hash++;
    }

    const hasColHash = Boolean(row.password_hash && isBcryptHash(row.password_hash));

    if (hasAnyPlaintext) {
      plaintextCount++;
    }
    if (hasHashInJson) {
      redundantHashCount++;
    }

    // Check for conflicting plaintext credentials
    const distinctPlaintexts = Array.from(new Set(foundPlaintexts));
    if (distinctPlaintexts.length > 1) {
      conflictingCount++;
    }

    if ((hasAnyPlaintext || hasHashInJson) && !hasColHash) {
      needsColumnMigration++;
    }
  }

  return {
    total: rows.length,
    plaintextCount,
    redundantHashCount,
    needsColumnMigration,
    legacyKeyBreakdown,
    conflictingCount,
    malformedJsonCount
  };
}

/**
 * Explicitly invoked cleanup function.
 * Sanitizes legacy password keys from JSON while preserving unrelated metadata.
 * Never copies plaintext directly into the dedicated column.
 *
 * @param {Function} [customQuery=query]
 * @param {Function} [customWithTx=withTransaction]
 * @returns {Promise<{
 *   sanitizedCount: number,
 *   skippedConflictingCount: number,
 *   malformedJsonCount: number
 * }>}
 */
export async function executeHistoricalPendingPasswordCleanup(customQuery = query, customWithTx = withTransaction) {
  return await customWithTx(async (tx) => {
    const rows = await tx('SELECT id, payload, password_hash FROM pending_registrations');
    let sanitizedCount = 0;
    let skippedConflictingCount = 0;
    let malformedJsonCount = 0;

    for (const row of rows) {
      if (!row.payload) continue;
      let payloadObj = null;
      try {
        payloadObj = typeof row.payload === 'object' ? row.payload : JSON.parse(row.payload);
      } catch {
        malformedJsonCount++;
        continue;
      }

      if (!payloadObj || typeof payloadObj !== 'object') continue;

      // Extract all plaintext keys
      const foundPlaintexts = [];
      for (const key of PLAINTEXT_KEYS) {
        if (payloadObj[key] !== undefined && payloadObj[key] !== null && String(payloadObj[key]).trim().length > 0) {
          foundPlaintexts.push(String(payloadObj[key]).trim());
        }
      }

      const distinctPlaintexts = Array.from(new Set(foundPlaintexts));
      const hasHashInJson = Boolean(payloadObj.password_hash);
      const isJsonHashValid = hasHashInJson && isBcryptHash(payloadObj.password_hash);

      const hasLegacyFields = foundPlaintexts.length > 0 || hasHashInJson;
      if (!hasLegacyFields) {
        continue; // Nothing to sanitize on this record
      }

      const existingCanonicalHash = (row.password_hash && isBcryptHash(row.password_hash)) ? row.password_hash : null;

      // Rule 4: Handle conflicting legacy keys conservatively
      if (!existingCanonicalHash && distinctPlaintexts.length > 1) {
        console.warn(`[CLEANUP WARNING] Record ID '${row.id}' has conflicting legacy plaintext keys without a canonical column hash. Deferring for manual review.`);
        skippedConflictingCount++;
        continue; // Do not guess or overwrite with conflicting credentials
      }

      // Rule 3: Resolve password_hash for the column
      // NEVER copy plaintext directly! Plaintext must be hashed before storage.
      let targetColumnHash = existingCanonicalHash;

      if (!targetColumnHash) {
        if (isJsonHashValid) {
          // Valid pre-existing bcrypt hash in JSON can be promoted to column
          targetColumnHash = payloadObj.password_hash.trim();
        } else if (distinctPlaintexts.length === 1) {
          // Single plaintext password: hash with bcrypt
          const salt = await bcrypt.genSalt(10);
          targetColumnHash = await bcrypt.hash(distinctPlaintexts[0], salt);
        } else if (hasHashInJson && !isJsonHashValid) {
          // If password_hash in JSON was mistakenly plaintext, hash it
          const salt = await bcrypt.genSalt(10);
          targetColumnHash = await bcrypt.hash(String(payloadObj.password_hash).trim(), salt);
        }
      }

      // Rule 5: Strip legacy password keys from JSON while preserving other metadata
      for (const key of PLAINTEXT_KEYS) {
        delete payloadObj[key];
      }
      delete payloadObj.password_hash;

      const cleanedJson = JSON.stringify(payloadObj);

      await tx(
        'UPDATE pending_registrations SET payload = $1, password_hash = COALESCE(password_hash, $2), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [cleanedJson, targetColumnHash, row.id]
      );
      sanitizedCount++;
    }

    return { sanitizedCount, skippedConflictingCount, malformedJsonCount };
  });
}

// Standalone CLI runner
if (process.argv[1] && process.argv[1].endsWith('cleanup_historical_pending_passwords.js')) {
  const isExecute = process.argv.includes('--execute');

  (async () => {
    try {
      console.log('🔍 Auditing historical pending_registrations password data...');
      const audit = await auditHistoricalPendingPasswords();

      console.log('----------------------------------------------------');
      console.log(`Total pending registration records examined : ${audit.total}`);
      console.log(`Records with plaintext password in JSON     : ${audit.plaintextCount}`);
      console.log(`Records with redundant password_hash in JSON : ${audit.redundantHashCount}`);
      console.log(`Records needing password_hash column backfill: ${audit.needsColumnMigration}`);
      console.log(`Key breakdown:`);
      console.log(`  - owner_password : ${audit.legacyKeyBreakdown.owner_password}`);
      console.log(`  - password       : ${audit.legacyKeyBreakdown.password}`);
      console.log(`  - pwd            : ${audit.legacyKeyBreakdown.pwd}`);
      console.log(`  - password_hash  : ${audit.legacyKeyBreakdown.password_hash}`);
      if (audit.conflictingCount > 0) {
        console.log(`⚠️ Records with conflicting password keys    : ${audit.conflictingCount}`);
      }
      if (audit.malformedJsonCount > 0) {
        console.log(`⚠️ Records with malformed JSON payloads     : ${audit.malformedJsonCount}`);
      }
      console.log('----------------------------------------------------');

      if (!isExecute) {
        console.log('ℹ️  DRY-RUN MODE COMPLETE: No records were modified.');
        console.log('To execute the sanitization in this environment, rerun with:');
        console.log('  node server/scripts/cleanup_historical_pending_passwords.js --execute');
        process.exit(0);
      }

      console.log('⚡ Executing safe database cleanup...');
      const result = await executeHistoricalPendingPasswordCleanup();
      console.log(`✅ Cleanup completed. ${result.sanitizedCount} records sanitized.`);
      if (result.skippedConflictingCount > 0) {
        console.log(`ℹ️  ${result.skippedConflictingCount} records deferred due to conflicting credentials.`);
      }
      if (result.malformedJsonCount > 0) {
        console.log(`⚠️ ${result.malformedJsonCount} malformed records were skipped.`);
      }
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during pending registration sanitization:', err.message);
      process.exit(1);
    }
  })();
}
