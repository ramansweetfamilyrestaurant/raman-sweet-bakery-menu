async function testFlow() {
  console.log('🧪 Starting End-to-End Payment & Autopay Flow Test...\n');

  const BASE_URL = 'https://khana-master.onrender.com';

  // Step 1: Create Test Order
  console.log('1. Testing POST /api/payment/create-order...');
  try {
    const res = await fetch(`${BASE_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: 1,
        plan_tier: 'pro',
        coupon_code: 'LAUNCH50',
        gateway: 'cashfree'
      })
    });
    const data = await res.json();
    console.log('   Response status:', res.status);
    console.log('   Order Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('   create-order error:', err.message);
  }

  // Step 2: Create Mandate
  console.log('\n2. Testing POST /api/payment/create-mandate...');
  try {
    const res = await fetch(`${BASE_URL}/api/payment/create-mandate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant_id: 1,
        plan_tier: 'pro',
        coupon_code: 'LAUNCH50',
        gateway: 'cashfree'
      })
    });
    const data = await res.json();
    console.log('   Response status:', res.status);
    console.log('   Mandate Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('   create-mandate error:', err.message);
  }

  // Step 3: Cashfree Webhook
  console.log('\n3. Testing POST /api/webhooks/cashfree...');
  try {
    const res = await fetch(`${BASE_URL}/api/webhooks/cashfree`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          order: { order_id: 'KM_SUB_1_1723123456', order_amount: 499 },
          payment: { payment_status: 'SUCCESS' }
        }
      })
    });
    const data = await res.json();
    console.log('   Webhook Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('   webhook error:', err.message);
  }
}

testFlow();
