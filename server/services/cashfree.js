import crypto from 'crypto';

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
    apiVersion: '2026-01-01',
    isConfigured: Boolean(clientId && clientSecret)
  };
}

/**
 * Verifies Cashfree Webhook Signature (HMAC-SHA256 of timestamp + rawBody)
 */
export function verifyCashfreeWebhookSignature(rawBody, timestamp, signature) {
  const config = getCashfreeConfig();
  if (!config.clientSecret || !rawBody || !signature) {
    return false;
  }
  try {
    const signatureData = (timestamp || '') + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', config.clientSecret)
      .update(signatureData)
      .digest('base64');

    const signatureBuf = Buffer.from(String(signature).trim());
    const expectedBuf = Buffer.from(String(expectedSignature).trim());

    if (signatureBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuf, expectedBuf);
  } catch (err) {
    console.error('Webhook signature verification error:', err.message);
    return false;
  }
}

/**
 * Format a Date object or ISO string to ISO 8601 format in IST timezone (YYYY-MM-DDTHH:MM:SS+05:30)
 */
export function formatISTISO(dateOrIso) {
  const d = dateOrIso ? new Date(dateOrIso) : new Date(Date.now() + 14 * 86400 * 1000);
  // IST is UTC + 5:30 (330 minutes)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  
  const isoStr = istDate.toISOString(); // e.g. "2026-08-22T10:00:00.000Z"
  const formatted = isoStr.substring(0, 19) + '+05:30';
  return formatted;
}

/**
 * Creates a Cashfree Sandbox Subscription Session (v2026-01-01 API)
 */
export async function createCashfreeSubscriptionSession({
  restaurantId,
  planKey,
  planName,
  planPrice,
  trialEndISO,
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
  // MERCHANT-DEFINED CUSTOMER REFERENCE: Passed to Cashfree for tenant matching
  const customerId = `cust_${restaurantId}`;
  const cleanPhone = (customerPhone || '9876543210').replace(/[^0-9]/g, '').slice(-10) || '9876543210';
  const cleanName = (customerName || `Restaurant ${restaurantId}`).trim();
  const cleanEmail = (customerEmail || `owner_${restaurantId}@khanamaster.com`).trim();

  // 14-day SaaS trial alignment for subscription_first_charge_time
  const firstChargeTime = formatISTISO(trialEndISO);
  const amount = Number(planPrice) || 999;
  const maxAmount = Math.max(amount * 5, 5000);

  const subUrl = `${config.baseUrl}/subscriptions`;
  const subPayload = {
    subscription_id: subscriptionId,
    subscription_first_charge_time: firstChargeTime,
    customer_details: {
      customer_id: customerId,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_email: cleanEmail
    },
    plan_details: {
      plan_name: planName || `Khana Master ${planKey.toUpperCase()} Plan`,
      plan_type: 'PERIODIC',
      plan_amount: amount,
      plan_currency: 'INR',
      plan_max_amount: maxAmount,
      plan_max_cycles: 12,
      plan_intervals: 1,
      plan_interval_type: 'MONTH'
    },
    authorization_details: {
      authorization_amount: 1,
      authorization_amount_refund: true,
      payment_methods: ['enach', 'upi', 'card']
    }
  };

  if (returnUrl) {
    subPayload.subscription_meta = {
      return_url: returnUrl,
      notification_channel: ['EMAIL', 'SMS']
    };
  }

  try {
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

    if (subRes.ok && (subData.subscription_id || subData.subscription_session_id || subData.auth_link || subData.authLink)) {
      const sessionId = subData.subscription_session_id || null;
      const authLink = subData.auth_link || subData.authLink || subData.sub_auth_url || (sessionId ? `https://sandbox.cashfree.com/pg/orders/subs?session_id=${sessionId}` : null);

      return {
        success: true,
        configured: true,
        subscription_id: subData.subscription_id || subscriptionId,
        subscription_session_id: sessionId,
        customer_id: customerId,
        cf_subscription_id: subData.cf_subscription_id || null,
        subscription_status: subData.subscription_status || subData.sub_status || 'INITIALIZED',
        auth_link: authLink,
        is_sandbox: config.isSandbox,
        raw_response: subData
      };
    }

    return {
      success: false,
      configured: true,
      error: 'CASHFREE_API_ERROR',
      message: subData.message || subData.error_message || 'Cashfree Subscriptions API returned an error.',
      raw_response: subData
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      error: 'CASHFREE_NETWORK_ERROR',
      message: err.message || 'Failed to connect to Cashfree Sandbox servers.'
    };
  }
}

/**
 * Fetches current subscription status from Cashfree API
 */
export async function fetchCashfreeSubscriptionStatus(subscriptionId) {
  const config = getCashfreeConfig();

  if (!config.isConfigured) {
    return {
      success: false,
      configured: false,
      error: 'CASHFREE_SANDBOX_CREDENTIALS_MISSING',
      message: 'Cashfree Sandbox API keys are not configured in backend environment.'
    };
  }

  try {
    const fetchUrl = `${config.baseUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'x-api-version': config.apiVersion,
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret
      }
    });

    const data = await res.json();

    if (res.ok) {
      return {
        success: true,
        configured: true,
        subscription_id: data.subscription_id || subscriptionId,
        cf_subscription_id: data.cf_subscription_id || null,
        subscription_status: data.subscription_status || data.sub_status || 'UNKNOWN',
        authorisation_details: data.authorisation_details || data.authorization_details || null,
        plan_details: data.plan_details || null,
        customer_details: data.customer_details || null,
        raw_response: data
      };
    }

    return {
      success: false,
      configured: true,
      error: 'CASHFREE_FETCH_ERROR',
      message: data.message || 'Failed to fetch subscription status from Cashfree.',
      raw_response: data
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      error: 'CASHFREE_NETWORK_ERROR',
      message: err.message || 'Failed to connect to Cashfree Sandbox servers.'
    };
  }
}

