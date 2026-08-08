import Database from 'better-sqlite3';
import path from 'path';

const sqliteDb = new Database(path.resolve('menu.db'));

console.log('=== SQLITE RESTAURANTS ===');
const restos = sqliteDb.prepare("SELECT id, name, slug, plan_tier, plan_expires_at, trial_started_at, trial_ends_at, active FROM restaurants").all();
console.log(restos);

console.log('=== SQLITE SUBSCRIPTIONS ===');
const subs = sqliteDb.prepare("SELECT * FROM subscriptions").all();
console.log(subs);
