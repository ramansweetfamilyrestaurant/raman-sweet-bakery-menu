const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 5000;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('=== TESTING FULL ORDER FLOW LOCAL/PROD ===\n');

  try {
    // 1. Fetch Menu Bundle for customer
    console.log('Step 1: Customer fetches /api/menu-bundle?slug=raman-sweet-bakery...');
    const bundle = await makeRequest('GET', '/api/menu-bundle?slug=raman-sweet-bakery');
    console.log('Status:', bundle.status);
    console.log('Resto Name:', bundle.data?.info?.name, '| Dishes:', bundle.data?.dishes?.length);

    if (!bundle.data?.info) {
      console.error('❌ Step 1 FAILED: Restaurant info not returned');
      return;
    }

    // 2. Customer places direct order
    console.log('\nStep 2: Customer places direct order via POST /api/orders/direct...');
    const orderPayload = {
      slug: 'raman-sweet-bakery',
      table_number: '99',
      customer_name: 'Flow Test Customer',
      customer_phone: '9999999999',
      items: [
        { dish_id: 587, name: 'Tandoori Momo', portion: 'Half', price: 70, quantity: 1 }
      ],
      total_amount: 70
    };
    const newOrder = await makeRequest('POST', '/api/orders/direct', orderPayload);
    console.log('Status:', newOrder.status, '| Response:', newOrder.data);

    if (!newOrder.data?.order_id) {
      console.error('❌ Step 2 FAILED: Order placement failed');
      return;
    }

    const orderId = newOrder.data.order_id;

    // 3. Customer tracks order
    console.log(`\nStep 3: Customer tracks order #${orderId} via GET /api/orders/track/${orderId}...`);
    const track = await makeRequest('GET', `/api/orders/track/${orderId}`);
    console.log('Status:', track.status, '| Order Status in DB:', track.data?.status, '| sent_to_kds:', track.data?.sent_to_kds);

    // 4. Kitchen polls orders
    console.log('\nStep 4: Kitchen screen polls GET /api/kitchen/orders?slug=raman-sweet-bakery...');
    const kds1 = await makeRequest('GET', '/api/kitchen/orders?slug=raman-sweet-bakery');
    console.log('Status:', kds1.status, '| Total Orders in Kitchen:', kds1.data?.orders?.length);
    const inKds1 = kds1.data?.orders?.some(o => o.id === orderId);
    console.log(`Is Order #${orderId} in Kitchen right now?`, inKds1 ? 'YES ❌ (SHOULD BE NO - NOT SENT YET)' : 'NO ✅ (CORRECT)');

    // 5. Admin updates order to 'kitchen' (Send to Kitchen)
    console.log(`\nStep 5: Admin sends Order #${orderId} to Kitchen (PATCH /api/orders/${orderId}/status)...`);
    // Need token or backend call
    console.log('(Simulating backend status change to kitchen...)');

  } catch (e) {
    console.error('Test error:', e.message);
  }
}

runTest();
