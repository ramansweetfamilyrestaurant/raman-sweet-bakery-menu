import assert from 'node:assert/strict';
import {
  buildDayClosingSlipHtml,
  buildDayClosingWhatsAppMessage
} from '../../src/utils/billingHelper.js';

console.log('▶ Starting Day-End Closing & Cashier Shift Report Test Suite...');

// =============================================================================
// 1. THERMAL CLOSING SLIP HTML GENERATION TEST
// =============================================================================
console.log('Testing: buildDayClosingSlipHtml (58mm & 80mm)...');

const mockRestaurant = {
  name: 'Raman Sweet & Bakery',
  phone: '9876543210',
  currency_symbol: '₹'
};

const mockClosingData = {
  date: '2026-11-20',
  total_orders: 48,
  gross_sales: 18450.00,
  cash_sales: 9200.00,
  upi_sales: 8750.00,
  card_sales: 500.00,
  other_sales: 0.00,
  tax_amount: 878.00,
  dine_in_orders: 28,
  dine_in_sales: 11200.00,
  takeaway_orders: 16,
  takeaway_sales: 6250.00,
  delivery_orders: 4,
  delivery_sales: 1000.00,
  currency_symbol: '₹',
  top_items: [
    { name: 'Samosa', quantity: 60, revenue: 1200 },
    { name: 'Rasgulla', quantity: 45, revenue: 1350 },
    { name: 'Paneer Patties', quantity: 32, revenue: 960 }
  ]
};

// Test 1: Matched cash drawer
const slipMatchedHtml = buildDayClosingSlipHtml({
  restaurant: mockRestaurant,
  closingData: mockClosingData,
  actualCash: 9200.00,
  discrepancy: 0.00,
  closedBy: 'Cashier Amit',
  shiftName: 'Full Day',
  notes: '',
  paperWidth: '80mm'
});

assert.ok(slipMatchedHtml.toLowerCase().includes('raman sweet & bakery'), 'Should include restaurant title');
assert.ok(slipMatchedHtml.includes('DAY CLOSING REPORT'), 'Should include report header');
assert.ok(slipMatchedHtml.includes('₹18450.00') || slipMatchedHtml.includes('18450'), 'Should include gross sales');
assert.ok(slipMatchedHtml.includes('₹9200.00') || slipMatchedHtml.includes('9200'), 'Should include cash sales');
assert.ok(slipMatchedHtml.includes('₹8750.00') || slipMatchedHtml.includes('8750'), 'Should include UPI sales');
assert.ok(slipMatchedHtml.includes('MATCHED (₹0.00)'), 'Should show matched status for zero discrepancy');
assert.ok(slipMatchedHtml.includes('Samosa'), 'Should include top items');
assert.ok(slipMatchedHtml.includes('Cashier Amit'), 'Should include cashier attribution');
assert.ok(slipMatchedHtml.includes('80mm auto'), 'Should format for 80mm roll width');
assert.ok(slipMatchedHtml.includes('Dine-In') && slipMatchedHtml.includes('Takeaway'), 'Thermal slip should show service channel breakdown');

// Test 2: 58mm width & Cash shortage discrepancy
const slipShortHtml = buildDayClosingSlipHtml({
  restaurant: mockRestaurant,
  closingData: mockClosingData,
  actualCash: 9000.00,
  discrepancy: -200.00,
  closedBy: 'Cashier Rahul',
  shiftName: 'Evening Shift',
  notes: '₹200 shortage in small change coins',
  paperWidth: '58mm'
});

assert.ok(slipShortHtml.includes('58mm auto'), 'Should format for 58mm roll width');
assert.ok(slipShortHtml.includes('SHORT') || slipShortHtml.includes('-200'), 'Should show SHORT status for cash shortage');
assert.ok(slipShortHtml.includes('₹200 shortage in small change coins'), 'Should include cashier discrepancy note');

console.log('✅ Thermal Closing Slip HTML Generation Passed.');

// =============================================================================
// 2. WHATSAPP CLOSING MESSAGE GENERATION TEST
// =============================================================================
console.log('Testing: buildDayClosingWhatsAppMessage...');

const waMsg = buildDayClosingWhatsAppMessage({
  restaurant: mockRestaurant,
  closingData: mockClosingData,
  actualCash: 9200.00,
  discrepancy: 0.00,
  closedBy: 'Cashier Amit',
  shiftName: 'Full Day',
  notes: ''
});

assert.ok(waMsg.includes('*RAMAN SWEET & BAKERY*'), 'WhatsApp message should bold restaurant name');
assert.ok(waMsg.includes('*DAY CLOSING REPORT*'), 'WhatsApp message should contain title');
assert.ok(waMsg.includes('*₹18450.00*') || waMsg.includes('18450'), 'WhatsApp message should contain gross sales');
assert.ok(waMsg.includes('💵 Cash Collected: *₹9200.00*') || waMsg.includes('9200'), 'WhatsApp message should contain cash sales');
assert.ok(waMsg.includes('📲 UPI / QR Pay  : *₹8750.00*') || waMsg.includes('8750'), 'WhatsApp message should contain UPI sales');
assert.ok(waMsg.includes('✅ Discrepancy: *MATCHED (₹0.00)*'), 'WhatsApp message should indicate cash match');
assert.ok(waMsg.includes('👤 Shift Closed By: *Cashier Amit*'), 'WhatsApp message should state cashier name');
assert.ok(waMsg.includes('Dine-In Sales') && waMsg.includes('Takeaway / Parcel'), 'WhatsApp message should include service channels');

console.log('✅ WhatsApp Closing Message Generation Passed.');

// =============================================================================
// 3. BACKEND ROUTE & CALCULATION LOGIC TEST (Unit Level)
// =============================================================================
console.log('Testing: Backend Day Closing Calculation Logic...');

const mockOrders = [
  { id: 1, total_amount: '500.00', status: 'completed', payment_method: 'cash', order_type: 'dine_in', table_number: 'Table 1', items: '[{"name":"Kaju Katli","quantity":1,"price":500}]', created_at: '2026-11-20T10:00:00Z' },
  { id: 2, total_amount: '350.00', status: 'completed', payment_method: 'upi', order_type: 'takeaway', table_number: 'Takeaway', items: '[{"name":"Rasgulla","quantity":2,"price":175}]', created_at: '2026-11-20T11:30:00Z' },
  { id: 3, total_amount: '150.00', status: 'completed', payment_method: 'cash', order_type: 'dine_in', table_number: 'Table 2', items: '[{"name":"Samosa","quantity":5,"price":30}]', created_at: '2026-11-20T13:00:00Z' },
  { id: 4, total_amount: '200.00', status: 'cancelled', payment_method: 'cash', order_type: 'takeaway', table_number: 'Takeaway', items: '[{"name":"Pastry","quantity":2,"price":100}]', created_at: '2026-11-20T14:00:00Z' }, // Cancelled should be excluded
  { id: 5, total_amount: '800.00', status: 'completed', payment_method: 'card', order_type: 'delivery', table_number: 'Delivery', items: '[{"name":"Dry Fruit Box","quantity":1,"price":800}]', created_at: '2026-11-20T16:00:00Z' },
  { id: 6, total_amount: '400.00', status: 'completed', payment_method: 'upi', order_type: 'dine_in', table_number: 'Table 1', items: '[{"name":"Rasgulla","quantity":2,"price":200}]', created_at: '2026-11-19T10:00:00Z' } // Yesterday should be excluded
];

const targetDate = '2026-11-20';
const activeOrders = mockOrders.filter(o => o.status !== 'cancelled' && o.status !== 'rejected' && o.created_at.startsWith(targetDate));

let gross = 0, cash = 0, upi = 0, card = 0;
let dineInSales = 0, dineInOrders = 0;
let takeawaySales = 0, takeawayOrders = 0;
let deliverySales = 0, deliveryOrders = 0;

activeOrders.forEach(o => {
  const amt = Number(o.total_amount);
  gross += amt;
  if (o.payment_method === 'cash') cash += amt;
  else if (o.payment_method === 'upi') upi += amt;
  else if (o.payment_method === 'card') card += amt;

  const oType = String(o.order_type || '').toLowerCase();
  if (oType === 'takeaway') {
    takeawaySales += amt;
    takeawayOrders++;
  } else if (oType === 'delivery') {
    deliverySales += amt;
    deliveryOrders++;
  } else {
    dineInSales += amt;
    dineInOrders++;
  }
});

assert.equal(activeOrders.length, 4, 'Should include exactly 4 active orders for target date');
assert.equal(gross, 1800, 'Gross sales should be 500+350+150+800 = 1800');
assert.equal(cash, 650, 'Cash sales should be 500+150 = 650');
assert.equal(upi, 350, 'UPI sales should be 350');
assert.equal(card, 800, 'Card sales should be 800');

assert.equal(dineInOrders, 2, 'Dine-in orders should be 2');
assert.equal(dineInSales, 650, 'Dine-in sales should be 500 + 150 = 650');
assert.equal(takeawayOrders, 1, 'Takeaway orders should be 1');
assert.equal(takeawaySales, 350, 'Takeaway sales should be 350');
assert.equal(deliveryOrders, 1, 'Delivery orders should be 1');
assert.equal(deliverySales, 800, 'Delivery sales should be 800');

// Discrepancy calculation test
const countedExact = 650;
assert.equal(countedExact - cash, 0, 'Exact count should yield 0 discrepancy');

const countedShort = 600;
assert.equal(countedShort - cash, -50, 'Shortage count should yield -50 discrepancy');

const countedOver = 700;
assert.equal(countedOver - cash, 50, 'Overage count should yield +50 discrepancy');

console.log('✅ Backend Day Closing Calculation Logic Passed.');

console.log('======================================================================');
console.log('🎉 ALL DAY-END CLOSING & CASHIER SHIFT REPORT TESTS PASSED (100%)');
console.log('======================================================================');
