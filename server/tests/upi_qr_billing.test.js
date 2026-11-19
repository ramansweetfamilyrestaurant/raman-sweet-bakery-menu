import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the utility from billingHelper.js
import { buildUpiPaymentUri } from '../../src/utils/billingHelper.js';

describe('UPI QR Code Billing & Payment Specifications', () => {
  const billingHelperPath = path.resolve(__dirname, '../../src/utils/billingHelper.js');
  const adminDashboardPath = path.resolve(__dirname, '../../src/components/Admin/AdminDashboard.jsx');
  const adminRoutesPath = path.resolve(__dirname, '../routes/admin.js');
  const apiRoutesPath = path.resolve(__dirname, '../routes/api.js');
  const setupViewPath = path.resolve(__dirname, '../../src/components/Admin/views/SetupView.jsx');
  const dbPath = path.resolve(__dirname, '../db.js');

  test('buildUpiPaymentUri generates correct NPCI UPI deep-link URI', () => {
    // 1. Valid inputs with amount, invoice, space note
    const uri = buildUpiPaymentUri({
      upiId: 'merchant@upi',
      payeeName: 'Raman Sweets & Restro',
      amount: 450,
      invoiceId: 101,
      spaceLabel: 'Table 4'
    });

    assert.ok(uri, 'URI must be generated');
    assert.ok(uri.startsWith('upi://pay?'), 'URI must start with upi://pay?');
    assert.ok(uri.includes('pa=merchant%40upi') || uri.includes('pa=merchant@upi'), 'Must contain payee address');
    assert.ok(uri.includes('am=450.00'), 'Must contain formatted 2-decimal amount 450.00');
    assert.ok(uri.includes('cu=INR'), 'Must contain currency INR');
    assert.ok(uri.includes('pn='), 'Must contain payee name');
    assert.ok(uri.includes('tn='), 'Must contain transaction note');

    // 2. Returns null when UPI ID is missing or invalid (no @)
    assert.strictEqual(buildUpiPaymentUri({ upiId: '' }), null, 'Empty UPI ID must return null');
    assert.strictEqual(buildUpiPaymentUri({ upiId: null }), null, 'Null UPI ID must return null');
    assert.strictEqual(buildUpiPaymentUri({ upiId: 'invalid-no-at-sign' }), null, 'Invalid UPI ID without @ must return null');

    // 3. Decimal precision handling
    const precisionUri = buildUpiPaymentUri({
      upiId: '9876543210@paytm',
      amount: 129.5
    });
    assert.ok(precisionUri.includes('am=129.50'), 'Must format 129.5 to 129.50');
  });

  test('Database migrations include upi_id, upi_payee_name, and print_upi_qr', () => {
    const dbCode = fs.readFileSync(dbPath, 'utf8');
    assert.ok(dbCode.includes('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS upi_id'), 'db.js must alter table for upi_id in PG');
    assert.ok(dbCode.includes('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS upi_payee_name'), 'db.js must alter table for upi_payee_name in PG');
    assert.ok(dbCode.includes('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS print_upi_qr'), 'db.js must alter table for print_upi_qr in PG');
    assert.ok(dbCode.includes("c.name === 'upi_id'"), 'db.js must check upi_id for SQLite');
  });

  test('Admin routes handle upi_id, upi_payee_name, and print_upi_qr in settings update', () => {
    const adminCode = fs.readFileSync(adminRoutesPath, 'utf8');
    assert.ok(adminCode.includes('cleanUpiId'), 'admin.js must sanitize cleanUpiId');
    assert.ok(adminCode.includes('cleanUpiPayeeName'), 'admin.js must sanitize cleanUpiPayeeName');
    assert.ok(adminCode.includes('cleanPrintUpiQr'), 'admin.js must sanitize cleanPrintUpiQr');
    assert.ok(adminCode.includes("'upi_id', 'upi_payee_name', 'print_upi_qr'"), 'admin.js must include fields in ALLOWED_SETTING_FIELDS');
  });

  test('Public API route returns UPI fields in GET /info', () => {
    const apiCode = fs.readFileSync(apiRoutesPath, 'utf8');
    assert.ok(apiCode.includes('upi_id: resto.upi_id'), 'api.js must return upi_id in /info');
    assert.ok(apiCode.includes('upi_payee_name: resto.upi_payee_name'), 'api.js must return upi_payee_name in /info');
    assert.ok(apiCode.includes('print_upi_qr: resto.print_upi_qr'), 'api.js must return print_upi_qr in /info');
  });

  test('AdminDashboard.jsx includes UPI QR code in thermal print & RawBT ESC/POS text', () => {
    const dashboardCode = fs.readFileSync(adminDashboardPath, 'utf8');
    // Bill HTML
    assert.ok(dashboardCode.includes('SCAN TO PAY VIA UPI'), 'getBillHTML must include UPI QR banner');
    assert.ok(dashboardCode.includes('<img src="${upiQrDataUrl}"'), 'getBillHTML must embed QR data URL');
    // RawBT ESC/POS
    assert.ok(dashboardCode.includes('<qrcode size="5">${upiUri}</qrcode>'), 'generateRawBTText must include ESC/POS qrcode tag');
    // Cashier on-screen QR modal
    assert.ok(dashboardCode.includes('Show UPI QR Code on Screen'), 'Cashier modal must offer on-screen UPI QR display');
  });

  test('SetupView.jsx provides UI inputs for UPI ID, Payee Name and Print Toggle', () => {
    const setupCode = fs.readFileSync(setupViewPath, 'utf8');
    assert.ok(setupCode.includes('admin-upi-id'), 'SetupView must have UPI ID input');
    assert.ok(setupCode.includes('admin-upi-payee-name'), 'SetupView must have UPI Payee Name input');
    assert.ok(setupCode.includes('devicePrintUpiQr'), 'SetupView must have devicePrintUpiQr state');
    assert.ok(setupCode.includes('deviceUpiId'), 'SetupView must have deviceUpiId state');
  });
});
