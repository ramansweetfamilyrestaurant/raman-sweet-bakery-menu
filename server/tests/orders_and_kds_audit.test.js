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
const { default: apiRoutes } = await import('../routes/api.js');
const { generateHmacQrToken } = await import('../utils/qrSecurity.js');

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
    app.use('/api', apiRoutes);
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

    // 1f. Reject order stores rejection_reason, writes ORDER_CANCELLED audit log, and hides from live GET /orders
    const rejOrdIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, order_type, customer_name, items, total_amount, status, sent_to_kds, kitchen_prepared, created_at)
      VALUES ($1, '7', 'dine_in', 'Cancel Guest', '[{"name":"Cold Coffee","price":120,"quantity":1}]', 120, 'pending', 0, 0, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId]);
    const rejId = rejOrdIns[0].id;
    const rejRes = await fetch(`${baseUrl}/api/admin/orders/${rejId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'rejected', rejection_reason: 'Dish / Item out of stock' })
    });
    assert.equal(rejRes.status, 200);
    const rejBody = await rejRes.json();
    assert.equal(rejBody.status, 'rejected');
    assert.equal(rejBody.rejection_reason, 'Dish / Item out of stock');

    const rejDb = await query('SELECT status, rejection_reason FROM orders WHERE id = $1 AND restaurant_id = $2', [rejId, restoId]);
    assert.equal(rejDb.length, 1);
    assert.equal(rejDb[0].status, 'rejected');
    assert.equal(rejDb[0].rejection_reason, 'Dish / Item out of stock');

    const liveAdminOrdersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const liveAdminOrders = await liveAdminOrdersRes.json();
    assert.ok(!liveAdminOrders.some(o => Number(o.id) === Number(rejId)), 'Rejected order must remain excluded from live GET /api/admin/orders');

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
            StandaloneKdsPage: path.join(ROOT_DIR, 'src/components/Admin/views/StandaloneKdsPage.jsx'),
            OrdersView: path.join(ROOT_DIR, 'src/components/Admin/views/OrdersView.jsx')
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
        const { default: OrdersView } = await import(pathToFileURL(path.join(compiledDir, 'OrdersView.mjs')).href);

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
          get options() { return this.childNodes.filter(c => c.tagName === 'OPTION'); }
          get value() { return this._value ?? (this.attrs.get('value') || ''); }
          set value(v) { this._value = String(v ?? ''); }
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

        // Verify OrdersView mobile responsive layout classes, wrapping actions, drawer, and subtabs
        const hasClass = (node, cls) => String(node?.className || node?.getAttribute?.('class') || '').split(/\s+/).includes(cls);
        const sampleOrders = [
          {
            id: 901,
            table_number: '3',
            customer_name: 'Aarav',
            status: 'pending',
            round_number: 1,
            total_amount: 420,
            notes: 'Extra spicy, no onion',
            created_at: new Date().toISOString(),
            items: [{ name: 'Masala Dosa', price: 210, quantity: 2 }]
          },
          {
            id: 902,
            table_number: '3',
            customer_name: 'Aarav',
            status: 'served',
            round_number: 2,
            total_amount: 180,
            created_at: new Date().toISOString(),
            items: [{ name: 'Filter Coffee', price: 90, quantity: 2 }]
          },
          {
            id: 903,
            table_number: 'COUNTER',
            order_type: 'takeaway',
            token_display: 'TK-09',
            customer_name: 'Counter Guest',
            status: 'kitchen',
            kitchen_prepared: 1,
            is_settled: 1,
            round_number: 1,
            total_amount: 150,
            created_at: new Date().toISOString(),
            items: [{ name: 'Samosa', price: 75, quantity: 2 }]
          }
        ];
        const sampleReqs = [
          { id: 301, table_number: '2', request_type: 'Water & Napkins', created_at: new Date().toISOString() }
        ];
        const sampleResto = { id: restoId, name: 'Orders KDS Cafe', slug: 'orders-kds-cafe', business_type: 'restaurant', total_tables: 4, counter_ordering_enabled: 1, kds_enabled: 1 };

        let currentSubTab = 'orders';
        let currentKotFilter = 'all';
        const renderOrdersView = async () => {
          await React.act(async () => {
            activeRoot.render(
              React.createElement(OrdersView, {
                orders: sampleOrders,
                activeSubTab: currentSubTab,
                setActiveSubTab: (next) => { currentSubTab = next; },
                kotFilter: currentKotFilter,
                setKotFilter: (next) => { currentKotFilter = next; },
                serviceRequests: sampleReqs,
                restaurantInfo: sampleResto,
                ordersEnabled: true,
                onOpenDayClosing: () => { },
                onOpenBillModal: () => { },
                onUpdateStatus: () => { }
              })
            );
            await flushMicrotasks();
          });
        };

        await renderOrdersView();

        assert.ok(findNodes(container, n => hasClass(n, 'orders-view-root')).length === 1, 'OrdersView renders .orders-view-root wrapper');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-master-header')).length === 1, 'OrdersView renders .orders-master-header');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-subnav-pills')).length === 1, 'OrdersView renders .orders-subnav-pills');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-filter-strip')).length === 1, 'OrdersView renders .orders-filter-strip');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-status-tabs')).length === 1, 'OrdersView renders .orders-status-tabs');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-source-select')).length === 1, 'OrdersView renders .orders-source-select');
        const mobileCards = findNodes(container, n => hasClass(n, 'orders-mobile-card'));
        assert.equal(mobileCards.length, 3, 'OrdersView renders mobile order cards for every active order');
        assert.equal(findNodes(container, n => hasClass(n, 'orders-card-actions')).length, 3, 'OrdersView renders .orders-card-actions wrapping footer bar per mobile card');
        assert.ok((container.textContent || '').includes('Extra spicy, no onion'), 'OrdersView displays customer cooking notes');

        const ordersStyleText = findNodes(container, n => n.tagName === 'STYLE').map(n => n.textContent).join('\n');
        for (const ruleToken of [
          '@media (max-width: 768px)',
          '@media (max-width: 640px)',
          '.orders-card-actions',
          '.orders-source-select',
          '.orders-calls-grid',
          '.orders-space-grid',
          '.orders-drawer-cta-grid',
          '.orders-drawer-print-grid',
          'height: 100dvh'
        ]) {
          assert.ok(ordersStyleText.includes(ruleToken), `OrdersView style block includes responsive rule ${ruleToken}`);
        }

        // Open Order Details drawer on mobile card and verify drawer CTA + print grid responsive classes
        const detailsBtn = findNodes(mobileCards[0], n => n.tagName === 'BUTTON' && n.textContent.includes('Details'))[0];
        assert.ok(detailsBtn, 'Mobile card has Details button');
        await React.act(async () => {
          detailsBtn.dispatchEvent({ type: 'click', bubbles: true, target: detailsBtn });
          await flushMicrotasks();
        });
        assert.ok(findNodes(container, n => hasClass(n, 'orders-drawer-panel')).length === 1, 'Details click opens .orders-drawer-panel');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-drawer-print-grid')).length === 1, 'Drawer includes .orders-drawer-print-grid');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-drawer-footer')).length === 1, 'Drawer includes .orders-drawer-footer');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-drawer-cta-grid')).length === 1, 'Pending drawer footer includes .orders-drawer-cta-grid');

        // Verify pending card omits redundant standalone KOT button when +KOT is already shown
        const pendingKotOnlyBtns = findNodes(mobileCards[0], n => n.tagName === 'BUTTON' && n.textContent.trim() === 'KOT');
        assert.equal(pendingKotOnlyBtns.length, 0, 'Pending mobile card must not render duplicate standalone KOT button alongside +KOT');

        // Verify Reject Order Reason Modal opens on Reject click
        const rejectBtn = findNodes(mobileCards[0], n => n.tagName === 'BUTTON' && n.textContent.includes('Reject'))[0];
        assert.ok(rejectBtn, 'Pending mobile card has Reject button');
        await React.act(async () => {
          rejectBtn.dispatchEvent({ type: 'click', bubbles: true, target: rejectBtn });
          await flushMicrotasks();
        });
        assert.ok(findNodes(container, n => hasClass(n, 'orders-reject-modal')).length === 1, 'Reject click opens .orders-reject-modal reason picker');

        // Verify Floor Map & Service Calls responsive classes + Floor Map prepaid Handover + KDS tab ExternalLink render
        currentSubTab = 'floor-map';
        await renderOrdersView();
        assert.ok(findNodes(container, n => hasClass(n, 'orders-floor-counters')).length === 1, 'Floor Map renders .orders-floor-counters');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-space-grid')).length === 1, 'Floor Map renders .orders-space-grid');
        assert.ok((container.textContent || '').includes('Handover'), 'Floor Map renders direct Handover CTA for settled prepaid counter order');

        currentSubTab = 'kds';
        await renderOrdersView();
        assert.ok((container.textContent || '').includes('Tablet view'), 'KDS Display subtab renders Tablet view with ExternalLink without ReferenceError');

        currentSubTab = 'service-requests';
        await renderOrdersView();
        assert.ok(findNodes(container, n => hasClass(n, 'orders-calls-header')).length === 1, 'Service Calls renders .orders-calls-header');
        assert.ok(findNodes(container, n => hasClass(n, 'orders-calls-grid')).length === 1, 'Service Calls renders .orders-calls-grid');

        // Verify kitchen_prepared=1 order in kitchen status keeps single drawer CTA (no double-footer collision)
        const kdsPreparedDiningOrder = {
          id: 904,
          table_number: '4',
          customer_name: 'KDS Guest',
          status: 'kitchen',
          kitchen_prepared: 1,
          is_settled: 0,
          round_number: 1,
          total_amount: 260,
          created_at: new Date().toISOString(),
          items: [{ name: 'Paneer Tikka', price: 260, quantity: 1 }]
        };
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [kdsPreparedDiningOrder],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { },
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: () => { }
            })
          );
          await flushMicrotasks();
        });
        const kdsCard = findNodes(container, n => hasClass(n, 'orders-mobile-card'))[0];
        assert.ok(kdsCard && kdsCard.textContent.includes('Serve'), 'KDS-prepared kitchen card retains Serve action');
        const kdsDetailsBtn = findNodes(kdsCard, n => n.tagName === 'BUTTON' && n.textContent.includes('Details'))[0];
        await React.act(async () => {
          kdsDetailsBtn.dispatchEvent({ type: 'click', bubbles: true, target: kdsDetailsBtn });
          await flushMicrotasks();
        });
        const drawerFooterText = findNodes(container, n => hasClass(n, 'orders-drawer-footer'))[0]?.textContent || '';
        assert.ok(drawerFooterText.includes('Mark Order Served'), 'Drawer shows Mark Order Served for KDS-prepared kitchen order');
        assert.ok(!drawerFooterText.includes('Settle Bill & Complete Order'), 'Drawer must NOT stack Settle Bill & Complete Order footer while still in kitchen stage');

        // Verify unprepared kitchen order shows OrdersView Ready button wired to kitchen_prepared: 1 (synced with KDS)
        const { isOrderActiveInKitchen } = await import('../../src/utils/kdsQueueFilter.js');
        let syncedReadyCalls = [];
        const unpreparedKitchenOrder = {
          id: 907,
          table_number: '7',
          customer_name: 'Sync Guest',
          status: 'kitchen',
          sent_to_kds: 1,
          kitchen_prepared: 0,
          is_settled: 0,
          round_number: 1,
          total_amount: 190,
          created_at: new Date().toISOString(),
          items: [{ name: 'Masala Dosa', price: 190, quantity: 1 }]
        };
        assert.equal(isOrderActiveInKitchen(unpreparedKitchenOrder), true, 'Unprepared kitchen order is active in KDS before Ready');
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [unpreparedKitchenOrder],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { },
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: (...args) => syncedReadyCalls.push(args)
            })
          );
          await flushMicrotasks();
        });
        const unpreparedCard = findNodes(container, n => hasClass(n, 'orders-mobile-card'))[0];
        const readySyncBtn = findNodes(unpreparedCard, n => n.tagName === 'BUTTON' && n.textContent.includes('Ready') && !n.textContent.includes('Served'))[0];
        assert.ok(readySyncBtn, 'OrdersView renders Ready button on unprepared kitchen order');
        assert.ok(!unpreparedCard.textContent.includes('Mark Served'), 'Unprepared kitchen card hides Mark Served until Ready is tapped');
        await React.act(async () => {
          readySyncBtn.dispatchEvent({ type: 'click', bubbles: true, target: readySyncBtn });
          await flushMicrotasks();
        });
        assert.equal(syncedReadyCalls.length, 1);
        assert.equal(syncedReadyCalls[0][0], 907);
        assert.equal(syncedReadyCalls[0][1], 'kitchen');
        assert.deepEqual(syncedReadyCalls[0][2], { kitchen_prepared: 1 });
        assert.equal(isOrderActiveInKitchen({ ...unpreparedKitchenOrder, kitchen_prepared: 1 }), false, 'Marking Ready via OrdersView removes order from KDS active queue identically');

        // Verify open Detail Drawer live-updates from orders prop when KDS marks kitchen_prepared=1
        const openDetailsBtn = findNodes(unpreparedCard, n => n.tagName === 'BUTTON' && n.textContent.includes('Details'))[0];
        await React.act(async () => {
          openDetailsBtn.dispatchEvent({ type: 'click', bubbles: true, target: openDetailsBtn });
          await flushMicrotasks();
        });
        const drawerBeforeSync = findNodes(container, n => hasClass(n, 'orders-drawer-panel'))[0]?.textContent || '';
        assert.ok(drawerBeforeSync.includes('PREPARING') && drawerBeforeSync.includes('Mark Food Ready') && !drawerBeforeSync.includes('Mark Served'), 'Open drawer starts in PREPARING state with Mark Food Ready button and no premature Mark Served');
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [{ ...unpreparedKitchenOrder, kitchen_prepared: 1 }],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { },
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: (...args) => syncedReadyCalls.push(args)
            })
          );
          await flushMicrotasks();
        });
        const drawerAfterSync = findNodes(container, n => hasClass(n, 'orders-drawer-panel'))[0]?.textContent || '';
        assert.ok(drawerAfterSync.includes('KITCHEN READY') && !drawerAfterSync.includes('Mark Food Ready') && drawerAfterSync.includes('Mark Order Served') && !drawerAfterSync.includes('Quick Settle'), 'Open drawer syncs cleanly in real time to Mark Order Served without mixing Settle');

        // Verify prepaid settled Cinema order renders Handover directly instead of reopening payment
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [{
                id: 905,
                table_number: 'Screen 1 Seat A4',
                space_type: 'cinema_seat',
                customer_name: 'Cinema Guest',
                status: 'served',
                is_settled: 1,
                round_number: 1,
                total_amount: 310,
                created_at: new Date().toISOString(),
                items: [{ name: 'Caramel Popcorn', price: 310, quantity: 1 }]
              }],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { },
              serviceRequests: [],
              restaurantInfo: { ...sampleResto, business_type: 'cinema_theatre' },
              ordersEnabled: true,
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: () => { }
            })
          );
          await flushMicrotasks();
        });
        const cinemaCard = findNodes(container, n => hasClass(n, 'orders-mobile-card'))[0];
        assert.ok(cinemaCard && cinemaCard.textContent.includes('Handover'), 'Prepaid settled Cinema served order renders Handover directly');

        // Verify Counter Skip-KDS ('accepted', sent_to_kds=0) & auto_print_kot unified Accept button
        const counterSkippedOrder = {
          id: 906,
          table_number: 'Counter',
          space_type: 'counter',
          order_type: 'takeaway',
          token_display: 'TK-12',
          customer_name: 'Counter Direct',
          status: 'accepted',
          sent_to_kds: 0,
          kitchen_prepared: 0,
          is_settled: 1,
          round_number: 1,
          total_amount: 120,
          created_at: new Date().toISOString(),
          items: [{ name: 'Gulab Jamun Box', price: 120, quantity: 1 }]
        };
        assert.equal(isOrderActiveInKitchen(counterSkippedOrder), false, 'Counter order accepted with sent_to_kds=0 must NOT appear on KDS screen');

        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [sampleOrders[0], counterSkippedOrder],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { },
              serviceRequests: [],
              restaurantInfo: { ...sampleResto, auto_print_kot: 1 },
              settingsForm: { auto_print_kot: 1 },
              ordersEnabled: true,
              onDirectPrint: () => { },
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: () => { }
            })
          );
          await flushMicrotasks();
        });
        const cardsAfterAuto = findNodes(container, n => hasClass(n, 'orders-mobile-card'));
        assert.ok(cardsAfterAuto[0].textContent.includes('Accept + KOT'), 'Pending card collapses Accept & KOT into Accept + KOT when auto_print_kot is enabled');
        assert.equal(findNodes(cardsAfterAuto[0], n => n.tagName === 'BUTTON' && n.textContent.trim() === '+KOT').length, 0, 'Duplicate +KOT button hidden when auto_print_kot is enabled');
        assert.ok(cardsAfterAuto[1].textContent.includes('PACKING AT COUNTER') && cardsAfterAuto[1].textContent.includes('Mark Ready'), 'Counter Skip-KDS order renders PACKING AT COUNTER + Mark Ready');

        const adminDashSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Admin/AdminDashboard.jsx'), 'utf8');
        assert.ok(adminDashSrc.includes('isAutoPrintKotEnabled()') && adminDashSrc.includes("handlePrintKOT(acceptedOrder)"), 'AdminDashboard handleUpdateStatus triggers handlePrintKOT when auto_print_kot is enabled');
        assert.ok(adminDashSrc.includes("await handleUpdateStatus(targetId, 'accepted', extra);"), 'Counter Direct Fulfillment modal routes via status=accepted so KDS is genuinely skipped');
        assert.ok(adminDashSrc.includes('Final Payable') && adminDashSrc.includes('shouldPrintOnSettle') && adminDashSrc.includes('settleModalError'), 'Settle Bill modal renders Final Payable breakdown, print receipt toggle, and inline error state');
        assert.ok(adminDashSrc.includes('isAutoPrintBillEnabled()') && adminDashSrc.includes('setShouldPrintOnSettle(isAutoPrintBillEnabled())'), 'Settle Bill modal honors auto_print_bill setting for paperless digital paid bill workflow');

        // Verify empty-orders state uses compact mobile .orders-empty-state class
        currentSubTab = 'orders';
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { },
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true
            })
          );
          await flushMicrotasks();
        });
        assert.ok(findNodes(container, n => hasClass(n, 'orders-empty-state')).length === 1, 'OrdersView renders .orders-empty-state when orders list is empty');
        pass('OrdersView mobile responsive classes, drawer, floor map, service calls, and empty state verified');

        // 5. Targeted code-review regression checks on OrdersView rendering, floor map, filters, and mutual exclusion
        let resetKotCalls = 0;
        let currentSourceRendered = false;
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [
                {
                  id: 920,
                  table_number: '2',
                  space_type: 'table',
                  customer_name: 'Prepared Guest',
                  status: 'kitchen',
                  kitchen_prepared: 1,
                  is_settled: 0,
                  round_number: 1,
                  total_amount: 150,
                  order_source: 'direct',
                  created_at: new Date().toISOString(),
                  items: [{ name: 'Idli', price: 150, quantity: 1 }]
                },
                {
                  id: 921,
                  table_number: 'Counter:Counter',
                  order_type: 'takeaway',
                  token_display: 'TK-99',
                  customer_name: 'Prepaid Takeaway',
                  status: 'kitchen',
                  kitchen_prepared: 0,
                  is_settled: '1',
                  session_id: 'sess_counter_a',
                  round_number: 1,
                  total_amount: 100,
                  created_at: new Date().toISOString(),
                  items: [{ name: 'Tea', price: 100, quantity: 1 }]
                },
                {
                  id: 922,
                  table_number: 'Counter',
                  space_type: 'counter',
                  order_type: 'takeaway',
                  token_display: 'TK-100',
                  customer_name: 'Other Counter',
                  status: 'pending',
                  is_settled: 0,
                  session_id: 'sess_counter_b',
                  round_number: 1,
                  total_amount: 450,
                  created_at: new Date().toISOString(),
                  items: [{ name: 'Platter', price: 450, quantity: 1 }]
                }
              ],
              activeSubTab: 'floor-map',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { resetKotCalls += 1; },
              serviceRequests: [],
              restaurantInfo: { ...sampleResto, counter_ordering_enabled: 1, total_tables: 3 },
              settingsForm: { counter_ordering_enabled: 1, total_tables: 3 },
              ordersEnabled: true,
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: () => true
            })
          );
          await flushMicrotasks();
        });

        const spaceCards = findNodes(container, n => hasClass(n, 'orders-space-card'));
        const table2Card = spaceCards.find(c => c.textContent.includes('TABLE 2'));
        const counterCard = spaceCards.find(c => c.textContent.includes('Takeaway Counter'));
        assert.ok(table2Card && table2Card.textContent.includes('🍳 READY'), 'Floor-map card displays READY badge when active order has kitchen_prepared=1');
        assert.ok(table2Card && table2Card.textContent.includes('Serve') && !table2Card.textContent.includes('Settle'), 'Floor-map Ready dine-in card shows Serve instead of premature Settle');
        assert.ok(counterCard && counterCard.textContent.includes('+1 queued'), 'Counter floor card separates second queued session instead of merging totals');
        assert.ok(counterCard && counterCard.textContent.includes('100') && !counterCard.textContent.includes('550'), 'Counter floor card session total matches active session only');
        assert.ok(counterCard && !counterCard.textContent.includes('Slip') && counterCard.textContent.includes('Preparing') && !counterCard.textContent.includes('✓ Handover'), 'Floor card handles string is_settled="1" (hides Slip) and gates Handover until Ready/Served');

        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [
                {
                  id: 920,
                  table_number: '2',
                  status: 'kitchen',
                  kitchen_prepared: 0,
                  is_settled: 0,
                  round_number: 1,
                  total_amount: 150,
                  order_source: 'direct',
                  created_at: new Date().toISOString(),
                  items: [{ name: 'Idli', price: 150, quantity: 1 }]
                },
                {
                  id: 921,
                  table_number: 'Counter:Counter',
                  order_type: 'takeaway',
                  token_display: 'TK-99',
                  customer_name: 'Takeaway Colon',
                  status: 'kitchen',
                  kitchen_prepared: 0,
                  is_settled: 0,
                  created_at: new Date().toISOString(),
                  items: [{ name: 'Tea', price: 100, quantity: 1 }]
                },
                {
                  id: 923,
                  table_number: '1',
                  order_type: 'takeaway',
                  token_display: 'TK-01',
                  customer_name: 'Unpaid Table Takeaway',
                  status: 'kitchen',
                  kitchen_prepared: 0,
                  is_settled: 0,
                  round_number: 2,
                  created_at: new Date().toISOString(),
                  items: [{ name: 'Noodles', price: 50, quantity: 1 }]
                }
              ],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { resetKotCalls += 1; },
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => { },
              onOpenBillModal: () => { },
              onUpdateStatus: () => true
            })
          );
          await flushMicrotasks();
        });

        assert.ok(container.textContent.includes('Ready / Served'), 'Metric label reads Ready / Served');
        const sourceSelect = findNodes(container, n => n.tagName === 'SELECT' && hasClass(n, 'orders-source-select'))[0];
        const sourceLabel = findNodes(container, n => n.tagName === 'LABEL' && n.textContent.trim() === 'Source:')[0];
        assert.ok(sourceLabel && sourceSelect && sourceLabel.getAttribute('for') === 'orders-source-filter' && sourceSelect.getAttribute('id') === 'orders-source-filter', 'Source filter label is associated with select via htmlFor/id');

        const counterRow = findNodes(container, n => hasClass(n, 'orders-mobile-card')).find(c => c.textContent.includes('TK-99'));
        assert.ok(counterRow && counterRow.textContent.includes('Mark Ready') && !counterRow.textContent.includes('🍳 Ready'), 'Counter:Counter order without space_type shows counter pickup label instead of dine-in Ready');
        const unpaidTkRow = findNodes(container, n => hasClass(n, 'orders-mobile-card')).find(c => c.textContent.includes('TK-01'));
        assert.ok(unpaidTkRow && unpaidTkRow.textContent.includes('PREPARING') && !unpaidTkRow.textContent.includes('PREPARING (PAID)'), 'Unpaid takeaway order does not falsely display PREPARING (PAID)');

        // Open drawer on order 920 then remove order 920 from orders prop -> drawer must close automatically
        const detailsBtn920 = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Details'))[0];
        await React.act(async () => {
          detailsBtn920.dispatchEvent({ type: 'click', bubbles: true, target: detailsBtn920 });
          await flushMicrotasks();
        });
        assert.equal(findNodes(container, n => hasClass(n, 'orders-drawer-panel')).length, 1, 'Detail drawer opens for selected order');
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [],
              activeSubTab: 'orders',
              setActiveSubTab: () => { },
              kotFilter: 'all',
              setKotFilter: () => { resetKotCalls += 1; },
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => { }
            })
          );
          await flushMicrotasks();
        });
        assert.equal(findNodes(container, n => hasClass(n, 'orders-drawer-panel')).length, 0, 'Detail drawer closes when selected order disappears from orders list');
        assert.ok(!currentSourceRendered);
        pass('OrdersView floor-map Ready state, Counter:Counter routing, session scoping, Slip/Handover gates, accessible source filter, and drawer cleanup verified');
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

    // 6. Backend security & lifecycle regression checks: prev_order_id observer credential, non-regressive served guard, atomic presence lock, db index ordering, AdminDashboard reconciliation
    const prevSlug = `orders-kds-${ts}`;
    const prevQrSecret = `secret_prev_${ts}`;
    await query('UPDATE restaurants SET qr_secret = $1 WHERE id = $2', [prevQrSecret, restoId]);
    const t2Token = generateHmacQrToken(prevSlug, 'table', '2', prevQrSecret, restoId);

    const p1Ins = await query(`
      INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, status, session_id, round_number, tracking_token_hash, created_at)
      VALUES ($1, '2', 'Device A', '[{"name":"Coffee","price":90,"quantity":1}]', 90, 'kitchen', $2, 1, $3, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId, `sess_${restoId}_2_obs`, 'a'.repeat(64)]);
    const obsOrderId = p1Ins[0].id;

    // Second device observes active session with QR token and receives opaque observer token + kitchen_prepared sync
    await query(`UPDATE orders SET kitchen_prepared = 1 WHERE id = $1`, [obsOrderId]);
    const obsActiveRes = await fetch(`${baseUrl}/api/orders/active-table?slug=${encodeURIComponent(prevSlug)}&table_number=2&space_type=table&tkn=${encodeURIComponent(t2Token)}`);
    assert.equal(obsActiveRes.status, 200);
    const obsActiveBody = await obsActiveRes.json();
    assert.ok(obsActiveBody && obsActiveBody.session_observer_token && obsActiveBody.session_observer_token.startsWith('tq_obs_'), 'Active-table endpoint issues opaque session_observer_token while session is active');
    assert.equal(obsActiveBody.kitchen_prepared, 1, 'Active-table endpoint forwards top-level kitchen_prepared=1 to customer polling when Ready is tapped');

    // Non-regressive status guard: served order cannot be reverted to kitchen by delayed Ready write
    await query(`UPDATE orders SET status = 'served', kitchen_prepared = 0 WHERE id = $1`, [obsOrderId]);
    const nonRegRes = await fetch(`${baseUrl}/api/admin/orders/${obsOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'kitchen', kitchen_prepared: 1 })
    });
    assert.equal(nonRegRes.status, 200);
    const [afterNonReg] = await query('SELECT status, kitchen_prepared FROM orders WHERE id = $1', [obsOrderId]);
    assert.equal(afterNonReg.status, 'served', 'Delayed Ready write preserves served status without reverting to kitchen');
    assert.equal(Number(afterNonReg.kitchen_prepared), 1, 'Delayed Ready write still sets kitchen_prepared=1');

    // Settle the order so orders.length === 0 for table 2
    const settleObsRes = await fetch(`${baseUrl}/api/admin/orders/${obsOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'completed', settle: { method: 'cash', expected_order_ids: [obsOrderId], expected_total: 90 } })
    });
    assert.equal(settleObsRes.status, 200);

    // Table QR alone WITHOUT observer/tracking credential MUST NOT leak settled historical order
    const qrOnlyHistRes = await fetch(`${baseUrl}/api/orders/active-table?slug=${encodeURIComponent(prevSlug)}&table_number=2&space_type=table&tkn=${encodeURIComponent(t2Token)}&prev_order_id=${obsOrderId}`);
    assert.equal(qrOnlyHistRes.status, 200);
    assert.equal(await qrOnlyHistRes.json(), null, 'prev_order_id with table QR alone does not return historical order details');

    // Device 2 holding session_observer_token CAN still retrieve the settled bill confirmation
    const obsHistRes = await fetch(`${baseUrl}/api/orders/active-table?slug=${encodeURIComponent(prevSlug)}&table_number=2&space_type=table&tkn=${encodeURIComponent(t2Token)}&prev_order_id=${obsOrderId}`, {
      headers: { 'X-Session-Observer-Token': obsActiveBody.session_observer_token }
    });
    assert.equal(obsHistRes.status, 200);
    const obsHistBody = await obsHistRes.json();
    assert.ok(obsHistBody && obsHistBody.id === obsOrderId && obsHistBody.is_settled === 1, 'Authorized observer device retrieves settled confirmation for its session');

    // Atomic presence Approve vs Reject mutual exclusion
    const pvTok = `tq_staff_race_${ts}`;
    await query(`
      INSERT INTO table_location_verifications (restaurant_id, table_number, space_type, verification_token, verification_method, status, expires_at)
      VALUES ($1, '2', 'table', $2, 'STAFF', 'pending', '2030-01-01T00:00:00Z')
    `, [restoId, pvTok]);
    const srIns = await query(`
      INSERT INTO service_requests (restaurant_id, table_number, space_type, request_type, note, status)
      VALUES ($1, '2', 'table', 'presence_verification', $2, 'pending') RETURNING id
    `, [restoId, `Staff check ${pvTok}`]);
    const srId = srIns[0].id;
    const approveRace = await fetch(`${baseUrl}/api/admin/service-requests/${srId}/approve-presence`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(approveRace.status, 200);
    const rejectRace = await fetch(`${baseUrl}/api/admin/service-requests/${srId}/reject-presence`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rejection_reason: 'Late reject' })
    });
    assert.equal(rejectRace.status, 409, 'Second conflicting presence decision is rejected as stale (409)');

    // db.js index creation happens after column migrations in both PG & SQLite blocks
    const dbSrc = fs.readFileSync(path.join(ROOT_DIR, 'server/db.js'), 'utf8');
    const pgColIdx = dbSrc.indexOf('ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id');
    const pgSessIdx = dbSrc.indexOf('idx_orders_resto_session ON orders');
    const pgParentIdx = dbSrc.indexOf('idx_orders_resto_parent ON orders');
    assert.ok(pgColIdx !== -1 && pgSessIdx > pgColIdx && pgParentIdx > pgColIdx, 'Postgres session/parent index creation runs after column migrations');
    const sqColIdx = dbSrc.indexOf("ALTER TABLE orders ADD COLUMN parent_order_id");
    const sqSessIdx = dbSrc.lastIndexOf('idx_orders_resto_session ON orders');
    const sqParentIdx = dbSrc.lastIndexOf('idx_orders_resto_parent ON orders');
    assert.ok(sqColIdx !== -1 && sqSessIdx > sqColIdx && sqParentIdx > sqColIdx, 'SQLite session/parent index creation runs after column migrations');

    // AdminDashboard source checks for sibling status preservation, settlement attempt identity, and KOT non-reprint on Ready
    const adminDashAudit = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Admin/AdminDashboard.jsx'), 'utf8');
    assert.ok(adminDashAudit.includes('activeSettlementIdRef') && adminDashAudit.includes('if (activeSettlementIdRef.current === settlementAttemptId)'), 'Settlement cleanup is guarded by activeSettlementIdRef');
    assert.ok(adminDashAudit.includes('sKey === key\n          ? { status: confirmedStatus') || adminDashAudit.includes(': { is_settled: confirmedSettled, payment_method: confirmedPaymentMethod }'), 'Sibling settlement override preserves sibling lifecycle status');
    assert.ok(adminDashAudit.includes('!isMarkingPrepared &&') && adminDashAudit.includes('!wasAlreadyInKds'), 'Ready action skips auto KOT re-printing');
    pass('Backend observer-token history protection, non-regressive status guard, atomic presence check, DB index ordering, and AdminDashboard settlement reconciliation verified');

    // 7. Live SSE order stream delivers immediate customer wakeup upon admin Ready action & rejects unauthorized stream attempts
    const unauthStreamRes = await fetch(`${baseUrl}/api/orders/live-stream?slug=${encodeURIComponent(prevSlug)}&table_number=2&space_type=table&tkn=bad_token`);
    assert.equal(unauthStreamRes.status, 403, 'Unauthorized SSE stream subscription is rejected with 403');

    const streamOrdIns = await query(`
      INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, status, kitchen_prepared, sent_to_kds, session_id, round_number, created_at)
      VALUES ($1, '2', 'SSE Guest', '[{"name":"Tea","price":40,"quantity":1}]', 40, 'kitchen', 0, 1, $2, 1, CURRENT_TIMESTAMP)
      RETURNING id
    `, [restoId, `sess_${restoId}_2_sse`]);
    const sseOrderId = streamOrdIns[0].id;
    const sseAbort = new AbortController();
    const sseRes = await fetch(
      `${baseUrl}/api/orders/live-stream?slug=${encodeURIComponent(prevSlug)}&table_number=2&space_type=table&tkn=${encodeURIComponent(t2Token)}`,
      { signal: sseAbort.signal }
    );
    assert.equal(sseRes.status, 200, 'Authorized Table QR opens SSE order live stream');
    const sseReader = sseRes.body.getReader();
    const sseDecoder = new TextDecoder();

    // Trigger Ready update on Admin route while stream is connected
    const readyPushRes = await fetch(`${baseUrl}/api/admin/orders/${sseOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'kitchen', kitchen_prepared: 1 })
    });
    assert.equal(readyPushRes.status, 200);

    let receivedEventText = '';
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline && !receivedEventText.includes('event: order_update')) {
      const { value, done } = await sseReader.read();
      if (done) break;
      receivedEventText += sseDecoder.decode(value, { stream: true });
    }
    sseAbort.abort();
    assert.ok(receivedEventText.includes('event: order_update') && receivedEventText.includes('"kitchen_prepared":1'), 'SSE stream immediately pushes kitchen_prepared=1 event to customer');
    pass('Real-time SSE order stream authentication and instant kitchen_prepared push verified');

    // 8. Admin settlement stamps terminal_at on all session rounds (including TK-01 takeaway add-on) & returns full consolidated bill to customer track and BillCompletedModal
    const oldCreatedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const settledSessionId = `sess_${restoId}_5_bill_e2e`;
    const cryptoMod = await import('crypto');
    const tk1Raw = 'tok_round1_e2e_secret';
    const tk1Hash = cryptoMod.createHash('sha256').update(tk1Raw).digest('hex');
    const tk2Raw = 'tok_round2_e2e_secret';
    const tk2Hash = cryptoMod.createHash('sha256').update(tk2Raw).digest('hex');

    const r1Ins = await query(`
      INSERT INTO orders (restaurant_id, table_number, order_type, customer_name, items, total_amount, subtotal_amount, grand_total_amount, status, sent_to_kds, kitchen_prepared, session_id, round_number, is_settled, tracking_token_hash, created_at)
      VALUES ($1, '5', 'dine_in', 'Bill Guest', '[{"name":"Papdi Chaat","price":120,"quantity":1}]', 120, 120, 120, 'served', 1, 1, $2, 1, 0, $3, $4)
      RETURNING id
    `, [restoId, settledSessionId, tk1Hash, oldCreatedAt]);
    const billR1Id = r1Ins[0].id;

    const r2Ins = await query(`
      INSERT INTO orders (restaurant_id, table_number, order_type, token_number, token_display, customer_name, items, total_amount, subtotal_amount, grand_total_amount, status, sent_to_kds, kitchen_prepared, session_id, round_number, parent_order_id, is_settled, tracking_token_hash, created_at)
      VALUES ($1, '5', 'takeaway', 1, 'TK-01', 'Bill Guest', '[{"name":"Veg Chowmein","price":50,"quantity":1}]', 50, 50, 50, 'kitchen', 1, 0, $2, 2, $3, 0, $4, $5)
      RETURNING id
    `, [restoId, settledSessionId, billR1Id, tk2Hash, oldCreatedAt]);
    const billR2Id = r2Ins[0].id;

    const t5Token = generateHmacQrToken(prevSlug, 'table', '5', prevQrSecret, restoId);
    const activeBeforeSettleRes = await fetch(`${baseUrl}/api/orders/active-table?slug=${encodeURIComponent(prevSlug)}&table_number=5&space_type=table&tkn=${encodeURIComponent(t5Token)}`);
    assert.equal(activeBeforeSettleRes.status, 200);
    const activeBeforeSettleBody = await activeBeforeSettleRes.json();
    assert.ok(activeBeforeSettleBody && activeBeforeSettleBody.session_observer_token, 'Table 5 observer token issued before settle');

    const settleSessionRes = await fetch(`${baseUrl}/api/admin/orders/${billR1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'upi', expected_order_ids: [billR1Id, billR2Id], expected_total: 170 }
      })
    });
    assert.equal(settleSessionRes.status, 200);

    const settledDbRows = await query('SELECT id, is_settled, terminal_at FROM orders WHERE session_id = $1 ORDER BY id ASC', [settledSessionId]);
    assert.equal(settledDbRows.length, 2);
    assert.ok(settledDbRows[0].terminal_at && settledDbRows[1].terminal_at, 'Settlement stamps terminal_at on BOTH primary and sibling TK-01 rounds');

    // Tracking Round 2 (even though >2h after created_at and order_type='takeaway') returns 200 with consolidated 2-round bill_summary and no-store cache headers!
    const customerR2TrackRes = await fetch(`${baseUrl}/api/orders/track/${billR2Id}?slug=${encodeURIComponent(prevSlug)}`, {
      headers: { 'X-Order-Tracking-Token': tk2Raw }
    });
    assert.equal(customerR2TrackRes.status, 200, 'Recently settled sibling round must NOT fail with 410 tracking_expired');
    assert.ok(String(customerR2TrackRes.headers.get('cache-control') || '').includes('no-store'), 'Track endpoint must send Cache-Control: no-store');
    const customerR2TrackBody = await customerR2TrackRes.json();
    assert.equal(customerR2TrackBody.is_settled, 1);
    assert.equal(customerR2TrackBody.payment_method, 'upi');
    assert.ok(customerR2TrackBody.bill_summary, 'Customer track response includes consolidated bill_summary');
    assert.equal(customerR2TrackBody.bill_summary.round_count, 2);
    assert.equal(Number(customerR2TrackBody.bill_summary.grand_total_amount), 170);

    // Observer device (Device B) tracking prev_order_id = Round 2 ALSO receives 200 with consolidated bill_summary!
    const observerAfterSettleRes = await fetch(`${baseUrl}/api/orders/active-table?slug=${encodeURIComponent(prevSlug)}&table_number=5&space_type=table&tkn=${encodeURIComponent(t5Token)}&prev_order_id=${billR2Id}`, {
      headers: { 'X-Session-Observer-Token': activeBeforeSettleBody.session_observer_token }
    });
    assert.equal(observerAfterSettleRes.status, 200);
    const observerAfterSettleBody = await observerAfterSettleRes.json();
    assert.ok(observerAfterSettleBody && observerAfterSettleBody.is_settled === 1 && observerAfterSettleBody.bill_summary, `Observer receives consolidated bill_summary after settlement (got: ${JSON.stringify(observerAfterSettleBody)})`);
    assert.equal(Number(observerAfterSettleBody.bill_summary.grand_total_amount), 170);

    // Verify BillCompletedModal renders full itemized digital receipt for that settled bill payload
    {
      const { renderToStaticMarkup } = await import('react-dom/server');
      const cacheRoot = path.join(ROOT_DIR, 'node_modules/.cache');
      fs.mkdirSync(cacheRoot, { recursive: true });
      const billUiDir = fs.mkdtempSync(path.join(cacheRoot, 'bill-modal-test-'));
      await esbuild.build({
        entryPoints: [path.join(ROOT_DIR, 'src/components/BillCompletedModal.jsx')],
        outfile: path.join(billUiDir, 'BillCompletedModal.mjs'),
        bundle: true,
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        external: ['react', 'react-dom', 'react-dom/client', 'lucide-react']
      });
      const { default: BillCompletedModal } = await import(pathToFileURL(path.join(billUiDir, 'BillCompletedModal.mjs')).href);
      const modalHtml = renderToStaticMarkup(React.createElement(BillCompletedModal, {
        bill: { ...customerR2TrackBody, spaceLabelSnapshot: 'Table 5' },
        info: { name: 'Orders KDS Cafe', currency_symbol: '₹' },
        lang: 'en',
        spaceLabel: 'Table 5',
        onClose: () => {}
      }));
      assert.ok(modalHtml.includes('Bill Settled'), 'BillCompletedModal renders settled header');
      assert.ok(modalHtml.includes('Paid via UPI'), 'BillCompletedModal renders payment method');
      assert.ok(modalHtml.includes('Papdi Chaat') && modalHtml.includes('Veg Chowmein'), 'BillCompletedModal renders items from both rounds');
      assert.ok(modalHtml.includes('2 Rounds Merged') && modalHtml.includes('170'), 'BillCompletedModal renders merged rounds total ₹170');
      fs.rmSync(billUiDir, { recursive: true, force: true });
    }
    pass('Settlement stamps terminal_at across rounds, prevents premature 410 expiry, and delivers consolidated BillCompletedModal receipt');

    // Verify customer App.jsx guards transient trackOrderStatus failures from triggering Session Expired red banner
    const customerAppSource = fs.readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
    assert.ok(
      customerAppSource.includes('if (activeOrderId && trackRequestFailed) {\n                return;\n              }') ||
      customerAppSource.includes('if (activeOrderId && trackRequestFailed)'),
      'Customer polling loop must not trigger Session Expired red banner when trackOrderStatus suffered a transient failure'
    );
    assert.ok(
      customerAppSource.includes("sessionStorage.getItem('tq_active_tracking_token')") &&
      customerAppSource.includes('localStorage.getItem(`tq_track_${activeOrderId}`)'),
      'Customer polling loop must fall back to persisted tracking tokens before treating tracking token as missing'
    );
    pass('Customer App.jsx transient track error and tracking-token fallback guards verified');

    console.log(`\nAll ${passed} Orders & KDS audit tests passed.`);
  } catch (err) {
    console.error('Orders & KDS audit test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
    }
    if (typeof closeDbPool === 'function') await closeDbPool();
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { }
    process.exit(process.exitCode || 0);
  }
})();
