import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'touchqr-orders-kds-test-'));
const TEST_DB_PATH = path.join(TMP_DIR, 'orders_kds_audit_test.db');
process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const { initDb, query, closeDbPool } = await import('../db.js');
const { default: adminRoutes } = await import('../routes/admin.js');

const JWT_SECRET = process.env.JWT_SECRET || 'touchqr_ultra_secure_jwt_secret_dev_2026';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

(async () => {
  let server;
  let passed = 0;
  const pass = (msg) => {
    passed += 1;
    console.log(`  PASS: ${msg}`);
  };

  try {
    await initDb();
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    await new Promise((resolve, reject) => {
      server = app.listen(0);
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const ts = Date.now();
    const restoIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'pro', 999, 1, 6, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Orders KDS Cafe', `orders-kds-${ts}`]);
    const restoId = restoIns[0].id;
    const token = jwt.sign({ id: 501, restaurant_id: restoId, username: 'ok_admin', role: 'restaurant_admin' }, JWT_SECRET);

    // 1. Dine-in order preserves sent_to_kds & kitchen_prepared when marking served without re-sending flags
    const dineOrdIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, status, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, '4', 'Rahul', '[{"name":"Dosa","price":120,"quantity":1}]', 120, 'kitchen', 1, 1, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId]);
    const dineId = dineOrdIns[0].id;

    const serveRes = await fetch(`${baseUrl}/api/admin/orders/${dineId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'served' })
    });
    const serveBody = await serveRes.json();
    assert.equal(serveRes.status, 200);
    assert.equal(serveBody.status, 'served');
    assert.equal(serveBody.sent_to_kds, 1, 'sent_to_kds must remain 1 when omitted on served transition');
    assert.equal(serveBody.kitchen_prepared, 1, 'kitchen_prepared must remain 1 when omitted on served transition');

    // 1b. Direct-fulfillment kitchen order (sent_to_kds = 0) preserves sent_to_kds=0 when PATCH omits status
    const directFulfillIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, status, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, 'Counter', 'Direct Guest', '[{"name":"Cold Drink","price":50,"quantity":1}]', 50, 'kitchen', 0, 0, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId]);
    const directRes = await fetch(`${baseUrl}/api/admin/orders/${directFulfillIns[0].id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ kitchen_prepared: 1 })
    });
    const directBody = await directRes.json();
    assert.equal(directRes.status, 200);
    assert.equal(directBody.status, 'kitchen', 'directBody.status must remain kitchen when status is omitted');
    assert.equal(directBody.sent_to_kds, 0, 'sent_to_kds=0 must NOT flip to 1 when status is omitted on existing kitchen order');
    assert.equal(directBody.kitchen_prepared, 1);
    const persistedDirect = await query('SELECT status, sent_to_kds, kitchen_prepared FROM orders WHERE id = $1', [directFulfillIns[0].id]);
    assert.equal(persistedDirect[0].status, 'kitchen', 'Persisted status must remain kitchen after prep-only PATCH');
    assert.equal(persistedDirect[0].sent_to_kds, 0, 'Persisted sent_to_kds must remain 0');
    assert.equal(persistedDirect[0].kitchen_prepared, 1, 'Persisted kitchen_prepared must be 1');

    // 1c. Unrouted counter order with status='kitchen' & sent_to_kds=0 still requires acknowledgement when sent_to_kds=1 is requested
    const routeDirectFail = await fetch(`${baseUrl}/api/admin/orders/${directFulfillIns[0].id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ sent_to_kds: 1 })
    });
    assert.equal(routeDirectFail.status, 400);
    const routeDirectFailBody = await routeDirectFail.json();
    assert.equal(routeDirectFailBody.error, 'counter_acknowledgement_required');

    // 1d. Settlement preserves omitted KDS/prep flags via COALESCE, and already-settled fallback persists explicit kitchen_prepared change without re-settling
    const settlePreserveIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, status, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, '5', 'Settle Preserve', '[{"name":"Idli","price":60,"quantity":1}]', 60, 'completed', 0, 1, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId]);
    const settlePreserveId = settlePreserveIns[0].id;
    const settleWinRes = await fetch(`${baseUrl}/api/admin/orders/${settlePreserveId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ settle: { method: 'cash' }, sent_to_kds: 0 })
    });
    const settleWinBody = await settleWinRes.json();
    assert.equal(settleWinRes.status, 200);
    assert.equal(settleWinBody.status, 'completed');
    assert.equal(settleWinBody.sent_to_kds, 0, 'Explicit sent_to_kds=0 must be reported from DB');
    assert.equal(settleWinBody.kitchen_prepared, 1, 'Omitted kitchen_prepared must stay 1 on settlement');

    const alreadySettledPrepRes = await fetch(`${baseUrl}/api/admin/orders/${settlePreserveId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'completed', kitchen_prepared: 0, settle: { method: 'upi' } })
    });
    const alreadySettledPrepBody = await alreadySettledPrepRes.json();
    assert.equal(alreadySettledPrepRes.status, 200);
    assert.equal(alreadySettledPrepBody.already_settled, true);
    assert.equal(alreadySettledPrepBody.payment_method, 'cash', 'Settlement must not run again');
    assert.equal(alreadySettledPrepBody.kitchen_prepared, 0, 'Already-settled fallback must persist explicit kitchen_prepared change');
    const persistedAfterFallback = await query('SELECT kitchen_prepared, payment_method FROM orders WHERE id = $1', [settlePreserveId]);
    assert.equal(persistedAfterFallback[0].kitchen_prepared, 0, 'Persisted kitchen_prepared must be 0 in DB after already-settled fallback');
    assert.equal(persistedAfterFallback[0].payment_method, 'cash', 'Persisted payment_method must remain cash in DB after already-settled fallback');

    // 1e. Group settlement when Order A is already settled and Order B in same session is unsettled returns Order A (not sibling B) and rejects unpermitted terminal KDS routing
    const sessionKey = `sess_grp_${ts}`;
    const orderAIns = await query(`
      INSERT INTO orders (restaurant_id, session_id, table_number, customer_name, items, total_amount, status, is_settled, payment_method, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, $2, '6', 'Grp Guest', '[{"name":"Soup","price":100,"quantity":1}]', 100, 'completed', 1, 'upi', 0, 0, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId, sessionKey]);
    const orderBIns = await query(`
      INSERT INTO orders (restaurant_id, session_id, table_number, customer_name, items, total_amount, status, is_settled, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, $2, '6', 'Grp Guest', '[{"name":"Naan","price":50,"quantity":1}]', 50, 'served', 0, 1, 1, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId, sessionKey]);
    const orderAId = orderAIns[0].id;
    const orderBId = orderBIns[0].id;

    const grpSettleRes = await fetch(`${baseUrl}/api/admin/orders/${orderAId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kitchen_prepared: 1, settle: { method: 'cash' } })
    });
    const grpSettleBody = await grpSettleRes.json();
    assert.equal(grpSettleRes.status, 200);
    assert.equal(String(grpSettleBody.id), String(orderAId), 'Group settlement returning only sibling must still return requested Order A');
    assert.equal(grpSettleBody.kitchen_prepared, 1, 'Order A lifecycle update applies even when only sibling B was unsettled');
    assert.equal(grpSettleBody.already_settled, true);
    const siblingBCheck = await query('SELECT is_settled, payment_method FROM orders WHERE id = $1', [orderBId]);
    assert.equal(siblingBCheck[0].is_settled, 1, 'Sibling Order B must still be settled');
    assert.equal(siblingBCheck[0].payment_method, 'cash');

    // Terminal counter order routing sent_to_kds=1 must be rejected without writing COUNTER_ORDER_KITCHEN_ACKNOWLEDGED
    const termCounterIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, order_type, customer_name, items, total_amount, status, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, 'Counter', 'takeaway', 'Term Counter', '[{"name":"Puff","price":30,"quantity":1}]', 30, 'completed', 0, 1, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId]);
    const termRouteRes = await fetch(`${baseUrl}/api/admin/orders/${termCounterIns[0].id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'completed', sent_to_kds: 1, counter_acknowledgement: { confirmed: true } })
    });
    assert.equal(termRouteRes.status, 400);
    const termRouteBody = await termRouteRes.json();
    assert.equal(termRouteBody.error, 'terminal_kitchen_routing_not_allowed');
    const badAckLogs = await query("SELECT id FROM audit_logs WHERE restaurant_id = $1 AND action = 'COUNTER_ORDER_KITCHEN_ACKNOWLEDGED' AND details LIKE $2", [restoId, `%${termCounterIns[0].id}%`]);
    assert.equal(badAckLogs.length, 0);
    pass('PATCH /orders/:id/status preserves sent_to_kds & kitchen_prepared when omitted and enforces COALESCE/settled flag writes');

    // 2. Counter order: requires acknowledgement to enter kitchen, then allows KDS Mark Ready & Undo without re-acknowledgement
    const counterOrdIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, order_type, token_number, token_display, customer_name, items, total_amount, status, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, 'Counter', 'takeaway', 1, 'TK-01', 'Counter Guest', '[{"name":"Samosa","price":40,"quantity":2}]', 80, 'pending', 0, 0, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId]);
    const counterId = counterOrdIns[0].id;

    const unackRes = await fetch(`${baseUrl}/api/admin/orders/${counterId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'kitchen', sent_to_kds: 1 })
    });
    const unackBody = await unackRes.json();
    assert.equal(unackRes.status, 400);
    assert.equal(unackBody.error, 'counter_acknowledgement_required');

    const ackRes = await fetch(`${baseUrl}/api/admin/orders/${counterId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'kitchen', sent_to_kds: 1, counter_acknowledgement: { confirmed: true } })
    });
    assert.equal(ackRes.status, 200);

    const kdsReadyRes = await fetch(`${baseUrl}/api/admin/orders/${counterId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'kitchen', kitchen_prepared: 1 })
    });
    const kdsReadyBody = await kdsReadyRes.json();
    assert.equal(kdsReadyRes.status, 200);
    assert.equal(kdsReadyBody.kitchen_prepared, 1);

    const kdsUndoRes = await fetch(`${baseUrl}/api/admin/orders/${counterId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'kitchen', kitchen_prepared: 0 })
    });
    const kdsUndoBody = await kdsUndoRes.json();
    assert.equal(kdsUndoRes.status, 200);
    assert.equal(kdsUndoBody.kitchen_prepared, 0);
    pass('Counter order requires initial kitchen acknowledgement then supports KDS Mark Ready & Undo');

    // 3. Frontend behavior & regression checks
    const ordersSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Admin/views/OrdersView.jsx'), 'utf8');
    const kdsViewSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Admin/views/KdsDisplayView.jsx'), 'utf8');
    const dashSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Admin/AdminDashboard.jsx'), 'utf8');

    assert.ok(ordersSrc.includes("id: 'counter_COUNTER'"), 'OrdersView Counter space has stable key id');
    assert.ok(kdsViewSrc.includes('prev.filter(o => o.id !== order.id)'), 'KdsDisplayView deduplicates recentlyCompleted');
    assert.ok(dashSrc.includes('if (!token || activeTokenRef.current !== token) return;') && dashSrc.includes('ordersRequestSeqRef') && dashSrc.includes('pollOrders'), 'AdminDashboard checks active token before bumping sequence ref and guards loadOrders');

    // 3b. Behavioral test for StandaloneKdsPage: Undo/Recall blocked until deferred Mark Ready succeeds, then Undo restores ticket
    {
      const cacheRoot = path.join(ROOT_DIR, 'node_modules/.cache');
      fs.mkdirSync(cacheRoot, { recursive: true });
      const compiledDir = fs.mkdtempSync(path.join(cacheRoot, 'kds-ui-test-'));
      const savedKeys = ['window', 'document', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT', 'Notification', 'history', 'HTMLElement', 'Element', 'Node', 'setInterval'];
      const prevGlobals = Object.fromEntries(savedKeys.map(k => [k, globalThis[k]]));
      let activeRoot = null;

      const stubCssPlugin = {
        name: 'kds-ui-stubs',
        setup(build) {
          build.onResolve({ filter: /\.css$/ }, (args) => ({ path: args.path, namespace: 'css-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'css-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
        }
      };

      const flushMicrotasks = async (rounds = 8) => {
        for (let i = 0; i < rounds; i++) await Promise.resolve();
      };

      try {
        await esbuild.build({
          entryPoints: {
            StandaloneKdsPage: path.join(ROOT_DIR, 'src/components/Admin/views/StandaloneKdsPage.jsx')
          },
          outdir: compiledDir,
          bundle: true,
          format: 'esm',
          platform: 'neutral',
          mainFields: ['module', 'main'],
          jsx: 'automatic',
          external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'lucide-react'],
          plugins: [stubCssPlugin],
          outExtension: { '.js': '.mjs' }
        });

        const { default: StandaloneKdsPage } = await import(pathToFileURL(path.join(compiledDir, 'StandaloneKdsPage.mjs')).href);

        const storage = new Map();
        const localStorageMock = {
          getItem: (k) => (storage.has(k) ? storage.get(k) : null),
          setItem: (k, v) => storage.set(k, String(v)),
          removeItem: (k) => storage.delete(k),
          clear: () => storage.clear()
        };
        const createEventBus = () => {
          const listeners = new Map();
          return {
            addEventListener(type, fn) {
              if (!listeners.has(type)) listeners.set(type, new Set());
              listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) {
              listeners.get(type)?.delete(fn);
            },
            dispatchEvent(evt) {
              const event = typeof evt === 'string' ? { type: evt, bubbles: true } : evt;
              if (this.disabled && event.type === 'click') return false;
              if (!event.target) event.target = this;
              event.currentTarget = this;
              event.preventDefault = event.preventDefault || (() => { });
              event.stopPropagation = event.stopPropagation || (() => { event._stopped = true; });
              const set = listeners.get(event.type);
              if (set) {
                for (const fn of Array.from(set)) fn.call(this, event);
              }
              if (event.bubbles && !event._stopped && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
                this.parentNode.dispatchEvent(event);
              }
              return true;
            }
          };
        };
        const doc = { nodeType: 9 };
        class FakeNode {
          constructor(nodeType, nodeName) {
            this.nodeType = nodeType;
            this.nodeName = nodeName;
            this.ownerDocument = doc;
            this.parentNode = null;
            this.childNodes = [];
            Object.assign(this, createEventBus());
          }
          get firstChild() { return this.childNodes[0] || null; }
          get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
          get nextSibling() {
            if (!this.parentNode) return null;
            const idx = this.parentNode.childNodes.indexOf(this);
            return idx >= 0 ? (this.parentNode.childNodes[idx + 1] || null) : null;
          }
          get previousSibling() {
            if (!this.parentNode) return null;
            const idx = this.parentNode.childNodes.indexOf(this);
            return idx > 0 ? this.parentNode.childNodes[idx - 1] : null;
          }
          appendChild(child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = this;
            this.childNodes.push(child);
            return child;
          }
          insertBefore(child, ref) {
            if (!ref) return this.appendChild(child);
            if (child.parentNode) child.parentNode.removeChild(child);
            const idx = this.childNodes.indexOf(ref);
            child.parentNode = this;
            if (idx === -1) this.childNodes.push(child);
            else this.childNodes.splice(idx, 0, child);
            return child;
          }
          removeChild(child) {
            const idx = this.childNodes.indexOf(child);
            if (idx !== -1) {
              this.childNodes.splice(idx, 1);
              child.parentNode = null;
            }
            return child;
          }
        }
        class FakeText extends FakeNode {
          constructor(text) { super(3, '#text'); this._data = String(text ?? ''); }
          get data() { return this._data; }
          set data(v) { this._data = String(v ?? ''); }
          get nodeValue() { return this._data; }
          set nodeValue(v) { this._data = String(v ?? ''); }
          get textContent() { return this._data; }
          set textContent(v) { this._data = String(v ?? ''); }
        }
        class FakeComment extends FakeNode {
          constructor(text) { super(8, '#comment'); this.data = String(text ?? ''); this.nodeValue = this.data; }
        }
        class FakeElement extends FakeNode {
          constructor(tag) {
            const upper = String(tag).toUpperCase();
            super(1, upper);
            this.tagName = upper;
            this.attrs = new Map();
            this._disabled = false;
            this.style = { setProperty() { }, removeProperty() { } };
            this.className = '';
          }
          get disabled() { return this._disabled || this.attrs.has('disabled'); }
          set disabled(v) {
            this._disabled = Boolean(v);
            if (v) this.attrs.set('disabled', '');
            else this.attrs.delete('disabled');
          }
          get children() { return this.childNodes.filter(c => c.nodeType === 1); }
          get textContent() { return this.childNodes.map(c => c.textContent ?? '').join(''); }
          set textContent(v) {
            this.childNodes.forEach(c => { c.parentNode = null; });
            this.childNodes = [];
            if (v !== '' && v !== null && v !== undefined) this.appendChild(new FakeText(v));
          }
          set innerHTML(v) { this.textContent = v ? '' : ''; }
          get innerHTML() { return this.textContent; }
          setAttribute(k, v) {
            const key = String(k);
            this.attrs.set(key, String(v));
            if (key === 'disabled') this._disabled = true;
          }
          getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
          removeAttribute(k) {
            const key = String(k);
            this.attrs.delete(key);
            if (key === 'disabled') this._disabled = false;
          }
        }
        const win = {
          ...createEventBus(),
          location: { search: '', pathname: '/orders-kds-bistro/kitchen', href: 'http://localhost/orders-kds-bistro/kitchen' },
          history: { replaceState() { }, pushState() { } },
          Node: FakeNode,
          Element: FakeElement,
          HTMLElement: FakeElement,
          HTMLIFrameElement: class HTMLIFrameElement extends FakeElement { },
          localStorage: localStorageMock,
          Notification: { permission: 'default' }
        };
        Object.assign(doc, createEventBus(), {
          defaultView: win,
          activeElement: null,
          documentElement: new FakeElement('html'),
          head: new FakeElement('head'),
          body: new FakeElement('body'),
          createElement: (tag) => new FakeElement(tag),
          createElementNS: (_ns, tag) => new FakeElement(tag),
          createTextNode: (t) => new FakeText(t),
          createComment: (t) => new FakeComment(t)
        });
        doc.documentElement.appendChild(doc.head);
        doc.documentElement.appendChild(doc.body);
        doc.documentElement.parentNode = doc;
        doc.body.parentNode = doc.documentElement;
        win.document = doc;

        const findNodes = (node, pred, acc = []) => {
          if (!node) return acc;
          if (pred(node)) acc.push(node);
          for (const ch of node.childNodes || []) findNodes(ch, pred, acc);
          return acc;
        };

        globalThis.window = win;
        globalThis.document = doc;
        globalThis.localStorage = localStorageMock;
        globalThis.Notification = win.Notification;
        globalThis.history = win.history;
        globalThis.HTMLElement = win.HTMLElement;
        globalThis.Element = win.Element;
        globalThis.Node = win.Node;
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;

        localStorageMock.setItem('touchqr_kds_token_orders-kds-bistro', 'kds-tok-1');
        localStorageMock.setItem('touchqr_kds_sound_pref_orders-kds-bistro', 'muted');

        const activeTicket = {
          id: 701,
          table_number: '5',
          customer_name: 'KDS Guest',
          status: 'kitchen',
          sent_to_kds: 1,
          kitchen_prepared: 0,
          is_settled: 0,
          created_at: new Date().toISOString(),
          items: [{ name: 'Paneer Wrap', quantity: 1 }]
        };
        let serverOrders = [activeTicket];
        let serverReconcileStatuses = undefined;
        let resolveCompletePatch = null;
        let rejectCompletePatch = null;
        let resolveRecallPatch = null;
        let rejectRecallPatch = null;
        const completeRequests = [];
        const recallRequests = [];
        const pollUrlsSeen = [];
        let kdsPollIntervalCb = null;
        const origSetInterval = globalThis.setInterval;
        globalThis.setInterval = (fn, ms, ...args) => {
          if (ms === 3000) kdsPollIntervalCb = fn;
          return origSetInterval(fn, ms, ...args);
        };

        const jsonRes = (body, ok = true, status = 200) => ({
          ok,
          status,
          headers: new Headers(),
          text: async () => JSON.stringify(body),
          json: async () => body
        });

        globalThis.fetch = async (url, init = {}) => {
          const u = String(url);
          const method = String(init?.method || 'GET').toUpperCase();
          if (u.includes('/api/info')) {
            return jsonRes({ id: restoId, name: 'Orders KDS Cafe', slug: 'orders-kds-bistro' });
          }
          if (u.includes('/api/kitchen/orders/701/complete')) {
            completeRequests.push({ url: u, method });
            return await new Promise((resolve, reject) => {
              resolveCompletePatch = resolve;
              rejectCompletePatch = reject;
            });
          }
          if (u.includes('/api/kitchen/orders/701/recall')) {
            recallRequests.push({ url: u, method });
            return await new Promise((resolve, reject) => {
              resolveRecallPatch = resolve;
              rejectRecallPatch = reject;
            });
          }
          if (u.includes('/api/kitchen/orders')) {
            pollUrlsSeen.push(u);
            return jsonRes({
              success: true,
              restaurant: { id: restoId, name: 'Orders KDS Cafe' },
              orders: serverOrders,
              ...(serverReconcileStatuses ? { reconcile_statuses: serverReconcileStatuses } : {})
            });
          }
          return jsonRes({});
        };

        const container = doc.createElement('div');
        doc.body.appendChild(container);
        activeRoot = createRoot(container);

        await React.act(async () => {
          activeRoot.render(React.createElement(StandaloneKdsPage, { slug: 'orders-kds-bistro' }));
          await flushMicrotasks();
        });

        assert.ok(container.textContent.includes('Paneer Wrap'), 'Active KDS order must render initially');
        const markReadyBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Mark Ready'))[0];
        assert.ok(markReadyBtn, 'Mark Ready button must render');
        assert.equal(findNodes(container, n => n.tagName === 'BUTTON' && (n.textContent.includes('Recall (') || n.textContent.includes('Undo'))).length, 0, 'No Recall/Undo controls before completion');

        // Trigger Mark Ready and keep completion PATCH deferred
        await React.act(async () => {
          markReadyBtn.dispatchEvent({ type: 'click', bubbles: true, target: markReadyBtn });
          await flushMicrotasks();
        });

        assert.equal(completeRequests.length, 1, 'Mark Ready dispatches completion request');
        assert.equal(completeRequests[0].method, 'PATCH', 'Mark Ready must use HTTP PATCH');
        const pendingBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Marking Ready...'))[0];
        assert.ok(pendingBtn && pendingBtn.disabled, 'Ticket remains disabled showing Marking Ready... while PATCH is pending');
        assert.equal(findNodes(container, n => n.tagName === 'BUTTON' && (n.textContent.includes('Recall (') || n.textContent.includes('Undo'))).length, 0, 'Undo/Recall must not appear or dispatch while Mark Ready is still pending');
        assert.equal(recallRequests.length, 0, 'Recall PATCH must not dispatch before Mark Ready finishes');

        // Resolve deferred Mark Ready PATCH -> ticket moves to Recall drawer
        serverOrders = [];
        await React.act(async () => {
          resolveCompletePatch(jsonRes({ success: true, id: 701, kitchen_prepared: 1 }));
          await flushMicrotasks();
        });

        assert.ok(!container.textContent.includes('Paneer Wrap'), 'Completed ticket leaves active grid after PATCH succeeds');
        const recallDrawerBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Recall (1)'))[0];
        assert.ok(recallDrawerBtn, 'Recall (1) toggle renders after completion succeeds');

        // Open Recall drawer and click Undo
        await React.act(async () => {
          recallDrawerBtn.dispatchEvent({ type: 'click', bubbles: true, target: recallDrawerBtn });
          await flushMicrotasks();
        });
        const undoBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Undo'))[0];
        assert.ok(undoBtn, 'Undo button must appear inside Recall drawer');

        await React.act(async () => {
          undoBtn.dispatchEvent({ type: 'click', bubbles: true, target: undoBtn });
          await flushMicrotasks();
        });
        assert.equal(recallRequests.length, 1, 'Clicking Undo dispatches recall request');
        assert.equal(recallRequests[0].method, 'PATCH', 'Recall Undo must use HTTP PATCH');

        // Resolve recall PATCH -> ticket restored back to active grid
        serverOrders = [activeTicket];
        await React.act(async () => {
          resolveRecallPatch(jsonRes({ success: true, id: 701, kitchen_prepared: 0, message: 'Order recalled' }));
          await flushMicrotasks();
        });

        const activeGrid = findNodes(
          container,
          n => String(n.className || n.getAttribute?.('class') || '').split(/\s+/).includes('touchqr-kds-grid')
        )[0];
        assert.ok(activeGrid && activeGrid.textContent.includes('Paneer Wrap'), 'Recalled ticket is restored into active kitchen queue grid');
        assert.equal(findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Recall (')).length, 0, 'Recall history cleared after restoring sole item');

        // Verify unconfirmed completion persists across multiple polls inside 15s grace window until server confirms Ready
        pollUrlsSeen.length = 0;
        const markReadyBtn2 = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Mark Ready'))[0];
        assert.ok(markReadyBtn2, 'Mark Ready button available for second transition');
        await React.act(async () => {
          markReadyBtn2.dispatchEvent({ type: 'click', bubbles: true, target: markReadyBtn2 });
          await flushMicrotasks();
        });
        serverOrders = [activeTicket];
        serverReconcileStatuses = { '701': { id: 701, status: 'kitchen', kitchen_prepared: 0 } };
        await React.act(async () => {
          rejectCompletePatch(new Error('network error'));
          await flushMicrotasks();
        });
        assert.equal(findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Recall (')).length, 0, 'Unknown Ready outcome does not optimistically add Recall entry');
        assert.ok(pollUrlsSeen.some(u => u.includes('reconcile_ids=701')), 'First poll after unknown Ready sends reconcile_ids=701');

        // Trigger a second poll well inside 15s grace period: tracking must STILL remain active (not dropped after 2 GETs)
        pollUrlsSeen.length = 0;
        await React.act(async () => {
          if (typeof kdsPollIntervalCb === 'function') kdsPollIntervalCb();
          await flushMicrotasks();
        });
        assert.ok(pollUrlsSeen.some(u => u.includes('reconcile_ids=701')), 'Second poll still sends reconcile_ids=701');

        // Trigger a third poll while still inside 15s grace period and verify late Ready commit resolves cleanly
        pollUrlsSeen.length = 0;
        await React.act(async () => {
          if (typeof kdsPollIntervalCb === 'function') kdsPollIntervalCb();
          await flushMicrotasks();
        });
        assert.ok(pollUrlsSeen.some(u => u.includes('reconcile_ids=701')), 'Third poll within 15s still tracks unconfirmed Ready instead of dropping prematurely');

        serverOrders = [];
        serverReconcileStatuses = { '701': { id: 701, status: 'kitchen', kitchen_prepared: 1 } };
        await React.act(async () => {
          if (typeof kdsPollIntervalCb === 'function') kdsPollIntervalCb();
          await flushMicrotasks();
        });
        const recallDrawerBtn2 = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Recall (1)'))[0];
        assert.ok(recallDrawerBtn2, 'Confirmed late Ready resolves into Recall (1)');

        // Unknown Undo outcome where server explicitly reports kitchen_prepared=0 while absent from active queue must NOT restore toRecall history
        let undoBtn2 = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Undo'))[0];
        if (!undoBtn2) {
          await React.act(async () => {
            recallDrawerBtn2.dispatchEvent({ type: 'click', bubbles: true, target: recallDrawerBtn2 });
            await flushMicrotasks();
          });
          undoBtn2 = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Undo'))[0];
        }
        assert.ok(undoBtn2, 'Undo button available inside Recall drawer');
        await React.act(async () => {
          undoBtn2.dispatchEvent({ type: 'click', bubbles: true, target: undoBtn2 });
          await flushMicrotasks();
        });
        serverOrders = [];
        serverReconcileStatuses = { '701': { id: 701, status: 'completed', kitchen_prepared: 0 } };
        await React.act(async () => {
          rejectRecallPatch(new Error('network timeout'));
          await flushMicrotasks();
        });
        assert.equal(findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Recall (')).length, 0, 'Explicit kitchen_prepared=0 even when absent from active orders must NOT restore order to Recall drawer');
      } finally {
        try {
          if (activeRoot) {
            await React.act(async () => {
              activeRoot.unmount();
              await flushMicrotasks();
            });
          }
        } finally {
          for (const k of savedKeys) {
            if (prevGlobals[k] === undefined) delete globalThis[k];
            else globalThis[k] = prevGlobals[k];
          }
          try { fs.rmSync(compiledDir, { recursive: true, force: true }); } catch { }
        }
      }
    }
    pass('StandaloneKdsPage Mark Ready & Undo action sequence verified with deferred requests');

    console.log(`\nAll ${passed} Orders & KDS audit tests passed.`);
  } catch (err) {
    console.error('Orders & KDS audit test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (typeof closeDbPool === 'function') await closeDbPool();
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { }
    process.exit(process.exitCode || 0);
  }
})();
