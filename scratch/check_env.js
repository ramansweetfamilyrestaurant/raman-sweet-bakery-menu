import { initDb, query } from '../server/db.js';

async function check() {
  await initDb();
  console.log('ENV keys present:');
  console.log('CASHFREE_CLIENT_ID:', process.env.CASHFREE_CLIENT_ID ? 'SET' : 'NOT SET');
  console.log('CASHFREE_APP_ID:', process.env.CASHFREE_APP_ID ? 'SET' : 'NOT SET');
  console.log('CASHFREE_CLIENT_SECRET:', process.env.CASHFREE_CLIENT_SECRET ? 'SET' : 'NOT SET');
  console.log('CASHFREE_SECRET_KEY:', process.env.CASHFREE_SECRET_KEY ? 'SET' : 'NOT SET');
  console.log('CASHFREE_ENVIRONMENT:', process.env.CASHFREE_ENVIRONMENT || 'not specified');

  const sysRows = await query("SELECT key, value FROM system_settings WHERE key LIKE 'cashfree%'");
  console.log('system_settings cashfree rows:', sysRows);

  process.exit(0);
}

check();
