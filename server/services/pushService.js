import { createRequire } from 'node:module';
import dns from 'node:dns/promises';
import net from 'node:net';
import { query } from '../db.js';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

let cachedVapidKeys = null;
let vapidInitPromise = null;

const ALLOWED_PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  '.push.services.mozilla.com',
  'web.push.apple.com',
  '.push.apple.com',
  '.notify.windows.com'
];

function isPrivateOrReservedIp(ip) {
  const normalized = String(ip || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(normalized.slice(7));
  }
  const version = net.isIP(normalized);
  if (version === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    return false;
  }
  return true;
}

function isAllowedPushHostname(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host || host === 'localhost' || net.isIP(host) !== 0) return false;
  return ALLOWED_PUSH_HOST_SUFFIXES.some(suffix =>
    suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix
  );
}

export async function validatePushEndpoint(rawEndpoint) {
  let parsed;
  try {
    parsed = new URL(String(rawEndpoint || '').trim());
  } catch {
    throw new Error('Invalid push endpoint URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Push endpoint must use HTTPS');
  }
  if (!isAllowedPushHostname(parsed.hostname)) {
    throw new Error('Unsupported push provider endpoint');
  }
  const resolved = await dns.lookup(parsed.hostname, { all: true });
  if (!Array.isArray(resolved) || resolved.length === 0) {
    throw new Error('Unable to resolve push endpoint host');
  }
  for (const entry of resolved) {
    if (isPrivateOrReservedIp(entry?.address)) {
      throw new Error('Push endpoint resolves to a disallowed private or loopback address');
    }
  }
  return parsed.toString();
}

/**
 * Loads or lazily generates persistent VAPID keys.
 * Prefers VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY from environment, otherwise inserts
 * atomically (ON CONFLICT DO NOTHING) and reads the winning record from system_settings.
 */
async function ensureVapidKeys() {
  if (cachedVapidKeys) return cachedVapidKeys;
  if (vapidInitPromise) return vapidInitPromise;

  vapidInitPromise = (async () => {
    try {
      const envPub = String(process.env.VAPID_PUBLIC_KEY || '').trim();
      const envPriv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
      const subject = String(process.env.VAPID_SUBJECT || 'mailto:support@touchqr.in').trim();

      if (envPub && envPriv) {
        webpush.setVapidDetails(subject, envPub, envPriv);
        cachedVapidKeys = { publicKey: envPub, privateKey: envPriv };
        return cachedVapidKeys;
      }

      const existing = await query("SELECT value FROM system_settings WHERE key = 'vapid_keys_v1' LIMIT 1");
      if (existing && existing.length > 0 && existing[0].value) {
        const parsed = JSON.parse(existing[0].value);
        if (parsed?.publicKey && parsed?.privateKey) {
          webpush.setVapidDetails(subject, parsed.publicKey, parsed.privateKey);
          cachedVapidKeys = parsed;
          return cachedVapidKeys;
        }
      }

      const generated = webpush.generateVAPIDKeys();
      const payloadStr = JSON.stringify({ publicKey: generated.publicKey, privateKey: generated.privateKey });

      await query(
        `INSERT INTO system_settings (key, value)
         VALUES ('vapid_keys_v1', $1)
         ON CONFLICT (key) DO NOTHING`,
        [payloadStr]
      );

      const winning = await query("SELECT value FROM system_settings WHERE key = 'vapid_keys_v1' LIMIT 1");
      const winningParsed = winning?.[0]?.value ? JSON.parse(winning[0].value) : null;
      if (!winningParsed?.publicKey || !winningParsed?.privateKey) {
        throw new Error('Failed to persist or load VAPID keys');
      }

      webpush.setVapidDetails(subject, winningParsed.publicKey, winningParsed.privateKey);
      cachedVapidKeys = { publicKey: winningParsed.publicKey, privateKey: winningParsed.privateKey };
      return cachedVapidKeys;
    } finally {
      vapidInitPromise = null;
    }
  })();

  return vapidInitPromise;
}

export async function getVapidPublicKey() {
  const keys = await ensureVapidKeys();
  return keys.publicKey;
}

export async function savePushSubscription(restaurantId, adminId, subscription, userAgent = '') {
  const rid = Number(restaurantId);
  if (!rid || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error('Invalid push subscription payload');
  }

  const endpoint = await validatePushEndpoint(subscription.endpoint);
  const p256dh = String(subscription.keys.p256dh).trim();
  const auth = String(subscription.keys.auth).trim();
  const ua = String(userAgent || '').slice(0, 240);

  await query(
    `INSERT INTO push_subscriptions (restaurant_id, admin_id, endpoint, p256dh, auth, user_agent, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (restaurant_id, endpoint)
     DO UPDATE SET
       admin_id = EXCLUDED.admin_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = CURRENT_TIMESTAMP`,
    [rid, adminId || null, endpoint, p256dh, auth, ua]
  );
  return { success: true };
}

export async function deletePushSubscription(restaurantId, endpoint) {
  const rid = Number(restaurantId);
  if (!rid || !endpoint) return { success: true };
  await query('DELETE FROM push_subscriptions WHERE restaurant_id = $1 AND endpoint = $2', [rid, String(endpoint).trim()]);
  return { success: true };
}

/**
 * Best-effort async push dispatch to all subscribed admin devices of a restaurant.
 * Automatically purges expired/unsubscribed endpoints (404 / 410).
 */
export async function sendRestaurantPushNotification(restaurantId, payload = {}) {
  const rid = Number(restaurantId);
  if (!rid || !Number.isFinite(rid)) return;

  try {
    await ensureVapidKeys();
    const subs = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE restaurant_id = $1',
      [rid]
    );
    if (!Array.isArray(subs) || subs.length === 0) return;

    const bodyJson = JSON.stringify({
      title: payload.title || '🛎️ TouchQR Live Alert',
      body: payload.body || 'New activity in your restaurant.',
      tag: payload.tag || 'touchqr-live-alert',
      url: payload.url || '/admin',
      type: payload.type || 'order_alert',
      orderId: payload.orderId || null,
      requireInteraction: payload.requireInteraction !== false,
      vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [300, 100, 300, 100, 400]
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            bodyJson,
            { TTL: 120, urgency: 'high', timeout: 10000 }
          );
        } catch (err) {
          const status = Number(err?.statusCode || 0);
          if (status === 404 || status === 410) {
            await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.warn('[PUSH_NOTIFY] Non-fatal dispatch error:', err?.message || err);
  }
}
