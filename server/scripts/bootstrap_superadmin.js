/**
 * Secure Super Admin Bootstrap CLI Script for TouchQR
 *
 * Provides a dedicated, secure method for bootstrapping the initial Super Admin
 * in production or newly provisioned environments.
 *
 * SAFETY INVARIANTS:
 * 1. Accepts secret ONLY via SUPERADMIN_BOOTSTRAP_PASSWORD environment variable
 *    or hidden interactive prompt (when run in a TTY).
 * 2. Strictly PROHIBITS plaintext password passing via CLI flags (--password=...)
 *    to prevent credential exposure in shell history, process listings, and task logs.
 * 3. Hashes the secret using bcrypt (10 rounds).
 * 4. NEVER prints credentials, tokens, or plain-text secrets to stdout/stderr or logs.
 * 5. STRICTLY REFUSES to overwrite or reset an existing Super Admin account.
 * 6. Enforces a password of at least 8 characters.
 *
 * Usage:
 *   SUPERADMIN_BOOTSTRAP_PASSWORD="mySecretPassword" node server/scripts/bootstrap_superadmin.js
 *   or:
 *   node server/scripts/bootstrap_superadmin.js (prompts interactively with hidden input)
 */

import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import readline from 'readline';
import { Writable } from 'stream';

dotenv.config();

const { Pool } = pg;

/**
 * Prompts user for password in an interactive terminal with hidden/suppressed echo.
 */
async function promptPasswordHidden(promptText = 'Enter Super Admin bootstrap password: ') {
  if (!process.stdin.isTTY) {
    return null;
  }

  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      // Suppress stdout echoing of keystrokes
      callback();
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  return new Promise((resolve) => {
    process.stdout.write(promptText);
    rl.question('', (answer) => {
      process.stdout.write('\n');
      rl.close();
      resolve(answer ? answer.trim() : null);
    });
  });
}

/**
 * Programmatic bootstrap method.
 *
 * @param {object} options
 * @param {string} [options.databaseUrl] - Connection string
 * @param {string} [options.username] - Target username (defaults to 'superadmin')
 * @param {string} [options.password] - Plaintext password (only for programmatic test invocation)
 */
export async function bootstrapSuperAdmin(options = {}) {
  const targetUrl = options.databaseUrl || process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    throw new Error('BOOTSTRAP_CONFIG_ERROR: DATABASE_URL or MIGRATION_DATABASE_URL environment variable is required.');
  }

  const username = String(options.username || process.env.SUPERADMIN_BOOTSTRAP_USERNAME || 'superadmin').trim();
  
  // Prefer securely injected env var or programmatically passed secret
  let rawPassword = options.password || process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;

  if (!rawPassword && process.stdin.isTTY) {
    rawPassword = await promptPasswordHidden('Enter Super Admin bootstrap password (hidden): ');
  }

  if (!rawPassword || typeof rawPassword !== 'string' || rawPassword.trim().length < 8) {
    throw new Error(
      'BOOTSTRAP_VALIDATION_ERROR: A password of at least 8 characters is required. ' +
      'Please set the SUPERADMIN_BOOTSTRAP_PASSWORD environment variable or enter it at the prompt. ' +
      'Passing passwords via command-line arguments is strictly prohibited for security.'
    );
  }

  const isPostgres = targetUrl.startsWith('postgres://') || targetUrl.startsWith('postgresql://');
  if (!isPostgres) {
    throw new Error('BOOTSTRAP_CONFIG_ERROR: Dedicated bootstrap runner expects a PostgreSQL database URL.');
  }

  const isLocalOrNoSsl =
    targetUrl.includes('sslmode=disable') ||
    targetUrl.includes('localhost') ||
    targetUrl.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: targetUrl,
    ssl: isLocalOrNoSsl ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    // 1. Guard: Refuse to overwrite existing Super Admin
    const checkRes = await pool.query(
      "SELECT id, username, role FROM admins WHERE role = 'superadmin' OR username = $1",
      [username]
    );

    if (checkRes.rows && checkRes.rows.length > 0) {
      const existing = checkRes.rows[0];
      throw new Error(
        `BOOTSTRAP_REFUSED: A Super Admin account ('${existing.username}', ID ${existing.id}) already exists. ` +
        'Overwriting or resetting existing accounts via bootstrap is strictly prohibited.'
      );
    }

    // 2. Hash using project bcrypt utility (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword.trim(), salt);

    // 3. Insert new Super Admin
    await pool.query(
      'INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
      [null, username, hash, 'superadmin']
    );

    return {
      success: true,
      username,
      message: `Initial Super Admin account successfully created for username '${username}'.`
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('bootstrap_superadmin.js')) {
  const args = process.argv.slice(2);
  let cliUsername = null;

  // STRICT SECURITY CHECK: Reject plaintext passwords via CLI arguments
  const hasCliPassword = args.some(arg => arg.startsWith('--password=') || arg === '--password' || arg === '-p');
  if (hasCliPassword) {
    console.error(
      '\n❌ SECURITY ERROR: Passing passwords via command-line arguments (--password=...) is strictly prohibited.\n' +
      '   CLI arguments are visible in process listings (ps), shell history, and logs.\n' +
      '   Please inject the password via the SUPERADMIN_BOOTSTRAP_PASSWORD environment variable or enter it interactively.\n'
    );
    process.exit(1);
  }

  for (const arg of args) {
    if (arg.startsWith('--username=')) {
      cliUsername = arg.split('=')[1];
    }
  }

  console.log('======================================================================');
  console.log('🛡️  TOUCHQR SECURE SUPER ADMIN BOOTSTRAPPER');
  console.log('======================================================================');

  bootstrapSuperAdmin({ username: cliUsername })
    .then((result) => {
      console.log(`\n✅ ${result.message}`);
      console.log('🔒 Security Notice: Credentials were encrypted and never written to logs.');
      console.log('======================================================================\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ BOOTSTRAP FAILED:', err.message);
      process.exit(1);
    });
}
