import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  parseOrderDateSafe,
  getISTDateKey,
  filterOrdersByTimeframe,
  classifyOrderChannel,
  isGenericGuestLabel,
  formatGuestOrderLocation,
  buildGuestRecordsAndMetrics
} from '../../src/utils/customerInsightsHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

test('Customers & Guest Insights CRM Helpers and UI Suite', async (t) => {
  await t.test('1. parseOrderDateSafe & filterOrdersByTimeframe handle SQLite UTC timestamps accurately in IST', () => {
    // 2026-11-28 19:02:00 UTC === 2026-11-29 00:32:00 IST
    const parsedUtc = parseOrderDateSafe('2026-11-28 19:02:00');
    assert.equal(getISTDateKey(parsedUtc), '2026-11-29');

    const nowIstMs = Date.parse('2026-11-29T00:35:00+05:30');
    const orders = [
      { id: 1, status: 'completed', created_at: '2026-11-28 19:02:00', total_amount: 200 }, // today in IST
      { id: 2, status: 'completed', created_at: '2026-11-28 17:00:00', total_amount: 150 }, // 22:30 IST on 28th (yesterday)
      { id: 3, status: 'cancelled', created_at: '2026-11-28 19:03:00', total_amount: 999 }, // cancelled excluded
      { id: 4, status: 'completed', created_at: null, total_amount: 100 }                   // missing timestamp excluded from 'today'
    ];
    const todayOrders = filterOrdersByTimeframe(orders, 'today', nowIstMs);
    assert.equal(todayOrders.length, 1);
    assert.equal(todayOrders[0].id, 1);
  });

  await t.test('2. classifyOrderChannel separates Counter POS orders from Customer QR and WhatsApp orders', () => {
    assert.equal(classifyOrderChannel({
      id: 10,
      order_type: 'takeaway',
      table_number: 'Counter',
      session_id: 'sess_1_counter_1795871111111',
      is_settled: 1,
      payment_method: 'cash'
    }), 'Direct / POS', 'POS Takeaway with sess_counter must classify as Direct / POS');

    assert.equal(classifyOrderChannel({
      id: 11,
      order_type: 'dine_in',
      table_number: 'Room 1',
      session_id: 'sess_1_Room 1_1795872222222',
      is_settled: 1,
      payment_method: 'upi'
    }), 'Direct / POS', 'POS Dine-In settled without tracking_token_hash must classify as Direct / POS');

    assert.equal(classifyOrderChannel({
      id: 12,
      order_type: 'dine_in',
      table_number: '4',
      session_id: 'qr_sess_abc123',
      tracking_token_hash: 'deadbeef',
      is_settled: 0
    }), 'QR', 'Customer table QR order classifies as QR');

    assert.equal(classifyOrderChannel({
      id: 13,
      order_type: 'whatsapp',
      table_number: 'Delivery'
    }), 'WhatsApp', 'WhatsApp checkout classifies as WhatsApp');
  });

  await t.test('3. Guest grouping avoids merging generic Counter/Room/Table Customer labels and normalizes 10-digit phones', () => {
    assert.equal(isGenericGuestLabel('Counter Customer'), true);
    assert.equal(isGenericGuestLabel('Room 1 Guest'), true);
    assert.equal(isGenericGuestLabel('Table 3 Guest'), true);
    assert.equal(isGenericGuestLabel('Rahul Sharma'), false);

    const { guestRecords, metrics } = buildGuestRecordsAndMetrics([
      {
        id: 20,
        customer_name: 'Counter Customer',
        customer_phone: '',
        table_number: 'Counter',
        session_id: 'sess_1_counter_1001',
        order_type: 'takeaway',
        is_settled: 1,
        payment_method: 'cash',
        total_amount: 120.1,
        items: [{ name: 'Chai', quantity: 2, price: 60 }]
      },
      {
        id: 21,
        customer_name: 'Counter Customer',
        customer_phone: '',
        table_number: 'Counter',
        session_id: 'sess_1_counter_1002',
        order_type: 'takeaway',
        is_settled: 1,
        payment_method: 'upi',
        total_amount: 80.2,
        items: [{ name: 'Samosa', quantity: 2, price: 40 }]
      },
      {
        id: 22,
        customer_name: 'Amit Verma',
        customer_phone: '+91 9876543210',
        table_number: 'Room 101',
        session_id: 'qr_room_101',
        tracking_token_hash: 'h1',
        total_amount: 500,
        items: [{ name: 'Thali', quantity: 1, price: 500 }]
      },
      {
        id: 23,
        customer_name: '',
        customer_phone: '9876543210',
        table_number: 'Booth 1',
        session_id: 'sess_1_Booth 1_2002',
        is_settled: 1,
        payment_method: 'card',
        total_amount: 300,
        items: [{ name: 'Pizza', quantity: 1, price: 300 }]
      }
    ], { business_type: 'restaurant', service_model: 'dine_in' });

    assert.equal(guestRecords.length, 3, 'Two anonymous Counter Customers remain separate sessions; normalized phone merges 2 orders');
    const amit = guestRecords.find(g => g.displayName === 'Amit Verma');
    assert.ok(amit && amit.ordersCount === 2 && amit.totalSpend === 800, 'Normalized +91 vs 10-digit phone merges spend accurately');
    assert.equal(metrics.directCount, 3);
    assert.equal(metrics.qrCount, 1);
    assert.equal(metrics.totalRevenue, 1000.3, 'Total revenue avoids floating-point drift');
  });

  await t.test('4. formatGuestOrderLocation formats Room, Booth, Token, and Table without double prefixes', () => {
    assert.equal(formatGuestOrderLocation({ token_display: 'TK-04', table_number: 'Counter' }), 'Token TK-04');
    assert.equal(formatGuestOrderLocation({ table_number: 'Room 102' }, { business_type: 'hotel_resort', service_model: 'hotel' }), 'Room 102');
    assert.equal(formatGuestOrderLocation({ table_number: 'Booth 1' }), 'Booth 1');
    assert.equal(formatGuestOrderLocation({ table_number: 'Booth-2' }), 'Booth-2');
    assert.equal(formatGuestOrderLocation({ table_number: 'Cabin 3' }), 'Cabin 3');
    assert.equal(formatGuestOrderLocation({ table_number: '4' }), 'Table 4');
  });

  await t.test('5. CustomersView renders normalized location/currency and no "Table Room" double prefix', async () => {
    const cacheRoot = path.join(ROOT_DIR, 'node_modules/.cache');
    fs.mkdirSync(cacheRoot, { recursive: true });
    const compiledDir = fs.mkdtempSync(path.join(cacheRoot, 'customers-ui-test-'));
    try {
      await esbuild.build({
        entryPoints: {
          CustomersView: path.join(ROOT_DIR, 'src/components/Admin/views/CustomersView.jsx')
        },
        outdir: compiledDir,
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        mainFields: ['module', 'main'],
        jsx: 'automatic',
        external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'lucide-react'],
        outExtension: { '.js': '.mjs' }
      });

      const { default: CustomersView } = await import(pathToFileURL(path.join(compiledDir, 'CustomersView.mjs')).href);
      const html = renderToStaticMarkup(
        React.createElement(CustomersView, {
          restaurantInfo: { business_type: 'hotel_resort', service_model: 'hotel', currency_symbol: 'none', order_retention_days: 60 },
          orders: [
            {
              id: 501,
              order_number: 12,
              table_number: 'Room 204',
              customer_name: 'Room 204 Guest',
              customer_phone: '',
              session_id: 'qr_r204',
              tracking_token_hash: 'h204',
              total_amount: 650,
              status: 'completed',
              created_at: '2026-11-28 19:02:00',
              items: [{ name: 'Club Sandwich', quantity: 1, price: 650 }]
            }
          ]
        })
      );

      assert.ok(html.includes('Room 204') && !html.includes('Table Room 204'), 'Room location must not render as "Table Room 204"');
      assert.ok(!html.includes('none650'), 'Currency "none" must not prefix amounts with literal "none"');
      assert.ok(html.includes('Activity retained for 60 days'), 'Respects dynamic retentionDays');
    } finally {
      try { fs.rmSync(compiledDir, { recursive: true, force: true }); } catch { }
    }
  });
});
