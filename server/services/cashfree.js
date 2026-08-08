// Uses native Node.js global fetch

export function getCashfreeConfig() {
  const clientId = (process.env.CASHFREE_CLIENT_ID || process.env.CASHFREE_APP_ID || '').trim();
  const clientSecret = (process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY || '').trim();
  const environment = (process.env.CASHFREE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
  const isSandbox = environment !== 'production';

  const baseUrl = isSandbox 
    ? 'https://sandbox.cashfree.com/pg' 
    : 'https://api.cashfree.com/pg';

  return {
    clientId,
    clientSecret,
    environment,
    isSandbox,
    baseUrl,
    apiVersion: '2023-08-01',
    isConfigured: Boolean(clientId && clientSecret)
  };
}

/**
 * Creates a Cashfree Sandbox Subscription or Order Checkout Session
 */
export async function createCashfreeSubscriptionSession({
  restaurantId,
  planKey,
  planName,
  planPrice,
  customerName,
  customerPhone,
  customerEmail,
  returnUrl
}) {
  const config = getCashfreeConfig();

  if (!config.isConfigured) {
    return {
      success: false,
      configured: false,
      error: 'CASHFREE_SANDBOX_CREDENTIALS_MISSING',
      message: 'Cashfree Sandbox API keys (CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET) are not configured in backend environment.'
    };
  }

  const subscriptionId = `sub_${restaurantId}_${Date.now()}`;
  const customerId = `cust_${restaurantId}`;
  const cleanPhone = (customerPhone || '9876543210').replace(/[^0-9]/g, '').slice(-10) || '9876543210';
  const cleanName = (customerName || `Restaurant ${restaurantId}`).trim();
  const cleanEmail = (customerEmail || `owner_${restaurantId}@khanamaster.com`).trim();

  // 1. Try Cashfree Subscriptions API (/pg/subscriptions)
  try {
    const subUrl = `${config.baseUrl}/subscriptions`;
    const subPayload = {
      subscription_id: subscriptionId,
      customer_details: {
        customer_id: customerId,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        customer_email: cleanEmail
      },
      plan_details: {
        plan_id: `plan_${planKey}`,
        plan_name: planName || `Khana Master ${planKey.toUpperCase()} Plan`,
        type: 'PERIODIC',
        interval_type: 'MONTH',
        intervals: 1,
        max_cycles: 12,
        amount: Number(planPrice) || 999
      },
      authorization_details: {
        payment_methods: ['enach', 'upi', 'card']
      }
    };

    if (returnUrl) {
      subPayload.subscription_meta = { return_url: returnUrl };
    }

    const subRes = await fetch(subUrl, {
      method: 'POST',
      headers: {
        'x-api-version': config.apiVersion,
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subPayload)
    });

    const subData = await subRes.json();

    if (subRes.ok && (subData.subscription_id || subData.sub_status || subData.auth_link || subData.payment_session_id)) {
      return {
        success: true,
        configured: true,
        subscription_id: subData.subscription_id || subscriptionId,
        customer_id: customerId,
        sub_status: subData.sub_status || 'INITIALIZED',
        auth_link: subData.auth_link || subData.sub_auth_url || null,
        payment_session_id: subData.payment_session_id || null,
        is_sandbox: config.isSandbox,
        raw_response: subData
      };
    }

    console.warn('Cashfree Subscriptions API notice, trying PG Orders Mandate fallback:', subData?.message || subData);
  } catch (err) {
    console.warn('Cashfree Subscriptions API request error, attempting fallback:', err.message);
  }

  // 2. Fallback: Cashfree PG Orders API with Mandate (/pg/orders)
  try {
    const orderUrl = `${config.baseUrl}/orders`;
    const orderPayload = {
      order_id: subscriptionId,
      order_amount: Number(planPrice) || 999,
      order_currency: 'INR',
      customer_details: {
        customer_id: customerId,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        customer_email: cleanEmail
      },
      order_meta: {
        return_url: returnUrl || `https://khanamaster.com/admin?subscription_id=${subscriptionId}`
      },
      order_tags: {
        subscription_id: subscriptionId,
        plan_tier: planKey
      }
    };

    const orderRes = await fetch(orderUrl, {
      method: 'POST',
      headers: {
        'x-api-version': config.apiVersion,
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderRes.json();

    if (orderRes.ok && orderData.payment_session_id) {
      return {
        success: true,
        configured: true,
        subscription_id: subscriptionId,
        customer_id: customerId,
        sub_status: 'INITIALIZED',
        payment_session_id: orderData.payment_session_id,
        is_sandbox: config.isSandbox,
        raw_response: orderData
      };
    }

    return {
      success: false,
      configured: true,
      error: 'CASHFREE_API_ERROR',
      message: orderData.message || 'Cashfree API returned an error during subscription creation.',
      raw_response: orderData
    };
  } catch (fallbackErr) {
    return {
      success: false,
      configured: true,
      error: 'CASHFREE_NETWORK_ERROR',
      message: fallbackErr.message || 'Failed to connect to Cashfree Sandbox servers.'
    };
  }
}
