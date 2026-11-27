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
                onOpenDayClosing: () => {},
                onOpenBillModal: () => {},
                onUpdateStatus: () => {}
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
              setActiveSubTab: () => {},
              kotFilter: 'all',
              setKotFilter: () => {},
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => {},
              onOpenBillModal: () => {},
              onUpdateStatus: () => {}
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
              setActiveSubTab: () => {},
              kotFilter: 'all',
              setKotFilter: () => {},
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => {},
              onOpenBillModal: () => {},
              onUpdateStatus: (...args) => syncedReadyCalls.push(args)
            })
          );
          await flushMicrotasks();
        });
        const unpreparedCard = findNodes(container, n => hasClass(n, 'orders-mobile-card'))[0];
        const readySyncBtn = findNodes(unpreparedCard, n => n.tagName === 'BUTTON' && n.textContent.includes('Ready') && !n.textContent.includes('Served'))[0];
        assert.ok(readySyncBtn, 'OrdersView renders Ready button on unprepared kitchen order');
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
        assert.ok(drawerBeforeSync.includes('PREPARING') && drawerBeforeSync.includes('Mark Food Ready'), 'Open drawer starts in PREPARING state with Mark Food Ready button');
        await React.act(async () => {
          activeRoot.render(
            React.createElement(OrdersView, {
              orders: [{ ...unpreparedKitchenOrder, kitchen_prepared: 1 }],
              activeSubTab: 'orders',
              setActiveSubTab: () => {},
              kotFilter: 'all',
              setKotFilter: () => {},
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true,
              onOpenDayClosing: () => {},
              onOpenBillModal: () => {},
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
              setActiveSubTab: () => {},
              kotFilter: 'all',
              setKotFilter: () => {},
              serviceRequests: [],
              restaurantInfo: { ...sampleResto, business_type: 'cinema_theatre' },
              ordersEnabled: true,
              onOpenDayClosing: () => {},
              onOpenBillModal: () => {},
              onUpdateStatus: () => {}
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
              setActiveSubTab: () => {},
              kotFilter: 'all',
              setKotFilter: () => {},
              serviceRequests: [],
              restaurantInfo: { ...sampleResto, auto_print_kot: 1 },
              settingsForm: { auto_print_kot: 1 },
              ordersEnabled: true,
              onDirectPrint: () => {},
              onOpenDayClosing: () => {},
              onOpenBillModal: () => {},
              onUpdateStatus: () => {}
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
              setActiveSubTab: () => {},
              kotFilter: 'all',
              setKotFilter: () => {},
              serviceRequests: [],
              restaurantInfo: sampleResto,
              ordersEnabled: true
            })
          );
          await flushMicrotasks();
        });
        assert.ok(findNodes(container, n => hasClass(n, 'orders-empty-state')).length === 1, 'OrdersView renders .orders-empty-state when orders list is empty');
        pass('OrdersView mobile responsive classes, drawer, floor map, service calls, and empty state verified');
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
