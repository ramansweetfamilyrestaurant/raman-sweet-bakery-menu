// TouchQR Web Push & Screen WakeLock helpers for Admin / KDS background reliability

const tokenGenerationMap = new Map();
const activeSubscribeControllers = new Map();
const inFlightSubscribeSaves = new Map();
let lastPushOpTs = 0;

function nextPushOpTimestamp() {
  const now = Date.now();
  lastPushOpTs = now > lastPushOpTs ? now : lastPushOpTs + 1;
  return lastPushOpTs;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerTouchQrServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('[PUSH] Service Worker registration failed:', err?.message || err);
    return null;
  }
}

export async function ensureAdminPushSubscription(token) {
  if (typeof window === 'undefined' || !token) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const gen = tokenGenerationMap.get(token) || 0;
  const subscribeOpTs = nextPushOpTimestamp();
  const prevController = activeSubscribeControllers.get(token);
  if (prevController) {
    try { prevController.abort(); } catch (_) { }
  }
  const controller = new AbortController();
  activeSubscribeControllers.set(token, controller);

  const isCancelled = () =>
    controller.signal.aborted || (tokenGenerationMap.get(token) || 0) !== gen;

  try {
    const registration = await registerTouchQrServiceWorker();
    if (!registration || !registration.pushManager || isCancelled()) return false;

    await navigator.serviceWorker.ready;
    if (isCancelled()) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (isCancelled()) return false;

    if (!subscription) {
      const keyRes = await fetch('/api/admin/push/vapid-public-key', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      if (!keyRes.ok || isCancelled()) return false;
      const keyData = await keyRes.json();
      if (!keyData?.publicKey || isCancelled()) return false;

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    if (!subscription || isCancelled()) return false;

    const subJson = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
    const savePromise = fetch('/api/admin/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ subscription: subJson, client_ts: subscribeOpTs }),
      signal: controller.signal
    });
    inFlightSubscribeSaves.set(token, savePromise);
    try {
      const saveRes = await savePromise;
      return Boolean(saveRes?.ok) && !isCancelled();
    } finally {
      if (inFlightSubscribeSaves.get(token) === savePromise) {
        inFlightSubscribeSaves.delete(token);
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.warn('[PUSH] Subscription setup skipped/failed:', err?.message || err);
    }
    return false;
  } finally {
    if (activeSubscribeControllers.get(token) === controller) {
      activeSubscribeControllers.delete(token);
    }
  }
}

export async function removeAdminPushSubscription(token) {
  if (typeof window === 'undefined' || !token) return false;

  const unsubscribeOpTs = nextPushOpTimestamp();
  // Invalidate any in-flight ensureAdminPushSubscription for this token immediately
  tokenGenerationMap.set(token, (tokenGenerationMap.get(token) || 0) + 1);
  const controller = activeSubscribeControllers.get(token);
  if (controller) {
    try { controller.abort(); } catch (_) { }
    activeSubscribeControllers.delete(token);
  }

  // Wait for any already-dispatched /subscribe request to settle before unsubscribing
  const pendingSave = inFlightSubscribeSaves.get(token);
  if (pendingSave) {
    try { await pendingSave; } catch (_) { }
  }

  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;
    if (!subscription?.endpoint) return false;

    const res = await fetch('/api/admin/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ endpoint: subscription.endpoint, client_ts: unsubscribeOpTs }),
      keepalive: true
    });
    return Boolean(res?.ok);
  } catch (err) {
    console.warn('[PUSH] Unsubscribe skipped/failed:', err?.message || err);
    return false;
  }
}

export async function requestScreenWakeLock() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  if (!('wakeLock' in navigator) || typeof navigator.wakeLock?.request !== 'function') {
    return null;
  }
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    return sentinel;
  } catch (_) {
    return null;
  }
}
