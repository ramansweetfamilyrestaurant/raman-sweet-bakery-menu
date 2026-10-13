import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createCashfreeSubscriptionSession, fetchCashfreeSubscriptionStatus, getCashfreeConfig, getCashfreeConfigAsync, verifyCashfreeWebhookSignature, verifyCashfreeWebhookSignatureAsync } from '../services/cashfree.js';
import { createOneTimeAuthCode } from '../services/authCodeService.js';
import { JWT_SECRET } from '../config/jwt.js';
import { registrationRateLimiter } from '../middleware/rateLimiters.js';
import { resolveBusinessCategoryFromType } from '../config/businessTaxonomy.js';

const router = express.Router();

function getAppBaseUrl(req) {
  if (process.env.APP_BASE_URL && !process.env.APP_BASE_URL.includes('onrender.com')) {
    return process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  if (req && req.headers) {
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host && !host.includes('onrender.com')) {
      return `${proto}://${host}`;
    }
  }
  return 'https://touchqr.in';
}

// Helper to log payment audit trail
async function logPaymentAudit(restaurantId, action, details) {
  try {
    await query(
      'INSERT INTO audit_logs (restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4)',
      [restaurantId || null, 'payment_gateway', action, typeof details === 'object' ? JSON.stringify(details) : String(details)]
    );
  } catch (err) {
    console.warn('Audit log write error:', err.message);
  }
}

// GET /api/payment/config-status (Backend status check for Cashfree Sandbox)
router.get('/config-status', async (req, res) => {
  const config = await getCashfreeConfigAsync();
  res.json({
    configured: config.isConfigured,
    environment: config.environment,
    is_sandbox: config.isSandbox,
    client_id_present: Boolean(config.clientId)
  });
});



// Validates registration form inputs and initiates Cashfree Subscription Checkout BEFORE creating any database record!
router.post('/checkout-pre-register', registrationRateLimiter, async (req, res) => {
  try {
    const { name, phone, owner_username, owner_password, plan_tier, owner_name, owner_email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Restaurant Name is required!' });
    }

    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Mobile Number!' });
    }

    if (!owner_username || !owner_username.trim()) {
      return res.status(400).json({ error: 'Owner Username is required!' });
    }

    if (!owner_password || owner_password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long!' });
    }

    let cleanOwnerEmail = null;
    if (owner_email && typeof owner_email === 'string') {
      const trimmedEmail = owner_email.trim().toLowerCase();
      if (trimmedEmail) {
        if (trimmedEmail.length > 255) {
          return res.status(400).json({ error: 'Email address cannot exceed 255 characters!' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          return res.status(400).json({ error: 'Please enter a valid email address (e.g. owner@example.com)!' });
        }
        cleanOwnerEmail = trimmedEmail;
      }
    }

    // 1. Check if phone or owner username is ALREADY in the database
    const phoneCheck = await query('SELECT id FROM restaurants WHERE phone = $1', [cleanPhone]);
    if (phoneCheck.length > 0) {
      return res.status(400).json({ error: `Mobile number '${phone}' is already registered with another restaurant!` });
    }

    const adminCheck = await query('SELECT id FROM admins WHERE username = $1', [owner_username.trim()]);
    if (adminCheck.length > 0) {
      return res.status(400).json({ error: `Username '${owner_username}' is already taken! Please choose a different username.` });
    }

    const selectedPlanKey = (plan_tier || 'pro').toLowerCase().trim();

    // 2. Resolve Plan Details
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [selectedPlanKey]);
    const dbPlan = planRows[0] || {
      id: 2,
      key: 'pro',
      name: 'Pro Luxury Plan',
      price: 999
    };

    const sysRows = await query("SELECT value FROM system_settings WHERE key = 'default_trial_days'");
    const trialDays = Math.max(1, parseInt(sysRows[0]?.value || '16', 10));
    const trialEndISO = new Date(Date.now() + trialDays * 86400 * 1000).toISOString();

    const regId = `reg_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const baseUrl = getAppBaseUrl(req);
    const returnUrl = `${baseUrl}/api/payment/register-return?reg_id=${regId}`;

    // 3. Create Cashfree Subscription Session WITHOUT touching restaurants or admins tables!
    const tempRestoId = Math.floor(100000 + Math.random() * 900000);
    const cfResult = await createCashfreeSubscriptionSession({
      restaurantId: tempRestoId,
      planKey: dbPlan.key,
      planName: dbPlan.name,
      planPrice: Number(dbPlan.price) || 999,
      trialEndISO,
      customerName: (owner_name || name).trim(),
      customerPhone: cleanPhone,
      returnUrl
    });

    if (!cfResult.configured || !cfResult.success) {
      return res.status(400).json({
        error: cfResult.message || 'Payment Gateway is currently unavailable. Please contact support.'
      });
    }

    // Securely hash password before storing in pending registration
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(owner_password, salt);

    const regPayload = {
      name: name.trim(),
      owner_name: (owner_name || '').trim(),
      owner_email: cleanOwnerEmail,
      phone: cleanPhone,
      owner_username: owner_username.trim(),
      owner_password,
      password_hash: passwordHash,
      plan_tier: dbPlan.key,
      plan_price: dbPlan.price,
      trial_days: trialDays,
      subscription_id: cfResult.subscription_id
    };

    // Store registration payload in pending_registrations table with explicit columns & secure hash
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await query(
      `INSERT INTO pending_registrations (
        id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, trial_days, cashfree_subscription_id, cashfree_subscription_session_id, mandate_status, status, expires_at, owner_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        regId,
        JSON.stringify(regPayload),
        name.trim(),
        cleanPhone,
        owner_username.trim(),
        passwordHash,
        dbPlan.key,
        dbPlan.price,
        trialDays,
        cfResult.subscription_id,
        cfResult.subscription_session_id || cfResult.payment_session_id || null,
        'pending',
        'checkout_started',
        expiresAt,
        cleanOwnerEmail
      ]
    );

    res.json({
      success: true,
      subscription_id: cfResult.subscription_id,
      subscription_session_id: cfResult.subscription_session_id || cfResult.payment_session_id,
      auth_url: cfResult.auth_url || cfResult.auth_link || cfResult.payment_link,
      environment: cfResult.environment || 'sandbox'
    });

  } catch (err) {
    console.error('Checkout pre-register error:', err);
    res.status(500).json({ error: err.message || 'Failed to initialize subscription checkout' });
  }
});

/**
 * Dedicated server-side finalization function for pending registrations.
 * Uses a single database transaction to guarantee atomic creation of restaurant, subscription, & admin.
 * Fully idempotent — safe against duplicate webhooks & user page refreshes.
 */
export async function finalizePendingRegistration(reg_id, inputSubId = null) {
  const regRows = await query('SELECT payload, created_slug, created_jwt, created_user, status, cashfree_subscription_id FROM pending_registrations WHERE id = $1', [reg_id]);
  if (!regRows || regRows.length === 0) {
    throw new Error('Registration session expired or invalid');
  }

  const regRecord = regRows[0];
  let regData = {};
  try {
    regData = typeof regRecord.payload === 'string' ? JSON.parse(regRecord.payload) : (regRecord.payload || {});
  } catch (err) {
    console.error('Failed to parse registration payload:', err);
    throw new Error('Corrupted registration session payload');
  }

  // Idempotent Check: Return existing result if already finalized
  if (regRecord.created_jwt && regRecord.created_slug) {
    console.log('[REGISTRATION] Already finalized for session:', reg_id);
    return {
      already_completed: true,
      cleanSlug: regRecord.created_slug,
      jwtToken: regRecord.created_jwt,
      username: regRecord.created_user || regData.owner_username
    };
  }

  // Authoritative server-issued subscription ID from pending_registrations record
  const authoritativeSubId = regRecord.cashfree_subscription_id || regData.subscription_id;

  if (!authoritativeSubId) {
    console.warn('[REGISTRATION] verification failed — missing authoritative subscription_id in DB record');
    throw new Error('Payment session verification failed. Missing authoritative subscription ID in registration record.');
  }

  // Enforce ownership: reject if client callback supplies a mismatched subscription ID
  if (inputSubId && String(inputSubId).trim() !== String(authoritativeSubId).trim()) {
    console.warn(`[REGISTRATION] Security Violation: Client callback subscription ID '${inputSubId}' does not match authoritative ID '${authoritativeSubId}'`);
    throw new Error('Subscription reference mismatch: The callback subscription identifier does not match this registration session.');
  }

  const targetSubId = authoritativeSubId;

  // Server-side Cashfree API Verification
  console.log('[REGISTRATION] verification started for subId:', targetSubId);
  const cfStatus = await fetchCashfreeSubscriptionStatus(targetSubId);
  console.log('[REGISTRATION] Cashfree API response status:', cfStatus);

  const statusStr = (cfStatus.subscription_status || cfStatus.status || '').toUpperCase();
  const isAuthorized = cfStatus.success && ['ACTIVE', 'BANK_APPROVAL_PENDING', 'COMPLETED'].includes(statusStr);

  if (!isAuthorized) {
    console.warn(`[REGISTRATION] verification failed — status '${statusStr}' not authorized`);
    await query("UPDATE pending_registrations SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [reg_id]);
    throw new Error(`Subscription payment was not authorized (Status: ${statusStr || 'FAILED'})`);
  }

  // Validate customer phone from Cashfree against registration data if present
  const cfPhone = (cfStatus.customer_details?.customer_phone || '').replace(/[^0-9]/g, '').slice(-10);
  const regPhone = (regData.phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (cfPhone && regPhone && cfPhone !== regPhone) {
    console.warn(`[REGISTRATION] Security Alert: Customer phone mismatch! Cashfree has '${cfPhone}', registration has '${regPhone}'`);
    throw new Error('Customer identity mismatch between registration session and payment gateway mandate.');
  }

  console.log('[REGISTRATION] verification successful for subId:', targetSubId);

  // Re-verify existing restaurant / admin idempotency
  const existingResto = await query('SELECT id, slug, phone FROM restaurants WHERE phone = $1', [regData.phone]);
  const existingAdmin = await query('SELECT id, username, restaurant_id FROM admins WHERE username = $1', [regData.owner_username]);

  if (existingResto.length > 0 && existingAdmin.length > 0) {
    const cleanSlug = existingResto[0].slug;
    const adminUsername = regData.owner_username;
    const adminId = existingAdmin[0].id;
    const jwtToken = jwt.sign(
      { id: adminId, username: adminUsername, role: 'restaurant_admin', restaurant_id: existingAdmin[0].restaurant_id, slug: cleanSlug },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    await query("UPDATE pending_registrations SET status = 'completed', completed_at = CURRENT_TIMESTAMP, restaurant_id = $1, created_slug = $2, created_jwt = $3, created_user = $4 WHERE id = $5", [existingResto[0].id, cleanSlug, jwtToken, adminUsername, reg_id]);

    return { newRestoId: existingResto[0].id, cleanSlug, jwtToken, username: adminUsername };
  }

  // Database Transaction for Atomic Creation
  const result = await withTransaction(async (txQuery) => {
    const phoneCheck = await txQuery('SELECT id FROM restaurants WHERE phone = $1', [regData.phone]);
    if (phoneCheck.length > 0) throw new Error('Mobile number already registered');

    const adminCheck = await txQuery('SELECT id FROM admins WHERE username = $1', [regData.owner_username]);
    if (adminCheck.length > 0) throw new Error('Username already taken');

    let baseSlug = regData.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
    if (!baseSlug || baseSlug.length < 2) baseSlug = 'resto-' + Math.floor(1000 + Math.random() * 9000);
    let cleanSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await txQuery('SELECT id FROM restaurants WHERE slug = $1', [cleanSlug]);
      if (existing.length === 0) break;
      cleanSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const planRows = await txQuery('SELECT * FROM saas_plans WHERE key = $1', [regData.plan_tier || 'pro']);
    const dbPlan = planRows[0] || { id: 2, key: 'pro', name: 'Pro Luxury Plan', price: 999 };

    const now = new Date();
    const isTrialMode = (regData.subscription_type === 'TRIAL' || regData.onboarding_mode === 'trial' || (regData.trial_days && Number(regData.trial_days) > 0 && regData.onboarding_mode !== 'active'));
    const subType = isTrialMode ? 'TRIAL' : 'PAID';
    const subStatus = isTrialMode ? 'trialing' : 'awaiting_charge';
    const trialDays = isTrialMode ? (Number(regData.trial_days) || 16) : null;
    const trialStartedAt = isTrialMode ? now.toISOString() : null;
    const trialEndsAt = isTrialMode ? new Date(now.getTime() + (trialDays || 16) * 86400 * 1000).toISOString() : null;
    const expiryDateISO = isTrialMode ? trialEndsAt : new Date(now.getTime() + 30 * 86400 * 1000).toISOString();
    const nowISO = now.toISOString();

    const effectiveBiz = regData.business_type || 'restaurant';
    const regCategory = resolveBusinessCategoryFromType(effectiveBiz);

    const restoRes = await txQuery(`
      INSERT INTO restaurants (
        name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, trial_started_at, trial_ends_at, whatsapp_number, theme_color, business_type, service_model, business_category, active, total_tables, mandate_status, mandate_id, auto_debit_enabled, onboarding_completed, location_initialized, owner_name, owner_email, subscription_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) RETURNING id
    `, [
      regData.name, cleanSlug, regData.tagline || '100% Fresh & Authentic Food',
      '/images/default-logo.webp',
      regData.phone, regData.address || '', '8:00 AM - 10:30 PM',
      dbPlan.key, dbPlan.price, expiryDateISO, trialStartedAt, trialEndsAt, regData.whatsapp_number || regData.phone, regData.theme_color || 'gold',
      effectiveBiz,
      regCategory,
      regCategory,
      1, 0, 'active', targetSubId || null, 1, false, false, regData.owner_name || '',
      regData.owner_email || null,
      subType
    ]);

    const newRestoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    await txQuery(`
      INSERT INTO subscriptions (
        restaurant_id, plan_id, gateway, gateway_subscription_id, status, amount, currency, billing_cycle, trial_start, trial_end, current_period_start, current_period_end, subscription_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      newRestoId, dbPlan.id, 'cashfree', targetSubId || null, subStatus, dbPlan.price, 'INR', 'monthly', trialStartedAt, trialEndsAt, nowISO, expiryDateISO, subType
    ]);

    const hash = regData.password_hash || (await bcrypt.hash(regData.owner_password || 'default123', await bcrypt.genSalt(10)));

    const adminRes = await txQuery(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [newRestoId, regData.owner_username, hash, 'restaurant_admin']);

    const adminId = adminRes[0]?.id || adminRes.lastInsertRowid;

    const jwtToken = jwt.sign(
      { id: adminId, username: regData.owner_username, role: 'restaurant_admin', restaurant_id: newRestoId, slug: cleanSlug },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return { newRestoId, cleanSlug, jwtToken, username: regData.owner_username };
  });

  // Clean Fresh Start (No demo categories or dishes seeded)

  await query("UPDATE pending_registrations SET status = 'completed', completed_at = CURRENT_TIMESTAMP, restaurant_id = $1, created_slug = $2, created_jwt = $3, created_user = $4 WHERE id = $5", [result.newRestoId, result.cleanSlug, result.jwtToken, result.username, reg_id]);

  console.log('[REGISTRATION] restaurant finalized successfully for:', result.cleanSlug);
  return result;
}

// ALL /api/payment/register-return - Cashfree subscription return callback for pre-registration (supports GET & POST)
router.all('/register-return', async (req, res) => {
  const reg_id = req.query.reg_id || req.body?.reg_id || req.query.reg_token || req.body?.reg_token;
  const inputSubId = req.query.subscription_id || req.query.sub_id || req.body?.subscription_id || req.body?.sub_id;
  const baseUrl = getAppBaseUrl(req);
  const isSuperAdminOrigin = typeof reg_id === 'string' && reg_id.startsWith('reg_sa_');

  console.log('[REGISTRATION] Received callback. Method:', req.method, 'reg_id:', reg_id, 'isSuperAdmin:', isSuperAdminOrigin);

  if (!reg_id) {
    if (isSuperAdminOrigin) {
      return res.redirect(`${baseUrl}/superadmin?tab=tenants&error=${encodeURIComponent('Invalid or expired registration session')}`);
    }
    return res.redirect(`${baseUrl}/register?error=Invalid registration session`);
  }

  try {
    const result = await finalizePendingRegistration(reg_id, inputSubId);
    const authCode = await createOneTimeAuthCode({
      restaurant_id: result.newRestoId,
      username: result.username,
      slug: result.cleanSlug
    });

    if (isSuperAdminOrigin) {
      return res.redirect(`${baseUrl}/superadmin?tab=tenants&created=${encodeURIComponent(result.cleanSlug)}&msg=${encodeURIComponent(`Business '${result.cleanSlug}' provisioned successfully with Cashfree mandate!`)}`);
    }

    res.redirect(`${baseUrl}/${result.cleanSlug}/admin?code=${encodeURIComponent(authCode)}&slug=${encodeURIComponent(result.cleanSlug)}`);
  } catch (err) {
    console.error('[REGISTRATION] verification failed:', err.message);
    if (isSuperAdminOrigin) {
      return res.redirect(`${baseUrl}/superadmin?tab=tenants&error=${encodeURIComponent(err.message)}`);
    }
    res.redirect(`${baseUrl}/register?error=${encodeURIComponent(err.message)}`);
  }
});

// ==========================================
// 1. CREATE CASHFREE SANDBOX SUBSCRIPTION
// ==========================================
const handleCreateSubscription = async (req, res) => {
  try {
    const targetRestoId = req.user?.restaurant_id;
    if (!targetRestoId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const { plan_tier, return_url } = req.body;
    const requestedPlanKey = (plan_tier || 'pro').toLowerCase().trim();

    // 1. Authoritative Plan Resolution from Database saas_plans Table
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [requestedPlanKey]);
    const dbPlan = planRows[0] || {
      id: 2,
      key: 'pro',
      name: 'Pro Luxury Plan',
      price: 999
    };

    const originalPrice = Number(dbPlan.price) || 999;

    // Fetch Restaurant & Owner Details from DB
    const restoRows = await query('SELECT id, name, phone, slug FROM restaurants WHERE id = $1', [targetRestoId]);
    const resto = restoRows[0] || { id: targetRestoId, name: `Restaurant ${targetRestoId}`, phone: '9876543210', slug: 'demo' };

    // Fetch active trial end from database for subscription_first_charge_time alignment
    const subTrailRows = await query(`
      SELECT trial_end FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);
    const trialEndISO = subTrailRows[0]?.trial_end || new Date(Date.now() + 16 * 86400 * 1000).toISOString();

    // 2. Call Cashfree Sandbox Client Service — planPrice = ORIGINAL FULL PRICE for recurring billing
    const cfResult = await createCashfreeSubscriptionSession({
      restaurantId: targetRestoId,
      planKey: dbPlan.key,
      planName: dbPlan.name,
      planPrice: originalPrice,
      trialEndISO,
      customerName: resto.name,
      customerPhone: resto.phone,
      returnUrl: return_url || `${getAppBaseUrl(req)}/api/payment/subscription-return`
    });

    if (!cfResult.configured) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: 'CASHFREE_SANDBOX_CREDENTIALS_MISSING',
        message: 'Cashfree Sandbox API keys (CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET) are not configured in backend environment.'
      });
    }

    if (!cfResult.success) {
      return res.status(400).json({
        success: false,
        configured: true,
        error: cfResult.error || 'CASHFREE_CREATION_FAILED',
        message: cfResult.message || 'Failed to create Cashfree Sandbox subscription.'
      });
    }

    // 4. Store/Update Real Gateway Identifiers in Database `subscriptions` Table
    const nowISO = new Date().toISOString();
    const existingSubRows = await query(`
      SELECT id FROM subscriptions 
      WHERE restaurant_id = $1 AND gateway = 'cashfree' AND status IN ('pending', 'trialing')
      ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);

    if (existingSubRows && existingSubRows.length > 0) {
      await query(`
        UPDATE subscriptions 
        SET gateway_subscription_id = $1, gateway_customer_id = $2, plan_id = $3, amount = $4
        WHERE id = $5
      `, [cfResult.subscription_id, cfResult.customer_id, dbPlan.id || 2, Number(dbPlan.price), existingSubRows[0].id]);
    } else {
      await query(`
        INSERT INTO subscriptions (
          restaurant_id, plan_id, gateway, gateway_subscription_id, gateway_customer_id, status, amount, currency, billing_cycle, trial_start
        ) VALUES ($1, $2, 'cashfree', $3, $4, 'pending', $5, 'INR', 'monthly', $6)
      `, [
        targetRestoId,
        dbPlan.id || 2,
        cfResult.subscription_id,
        cfResult.customer_id,
        Number(dbPlan.price),
        nowISO
      ]);
    }

    // Update `restaurants` table mandate references
    await query(`
      UPDATE restaurants SET mandate_id = $1, mandate_status = 'pending' WHERE id = $2
    `, [cfResult.subscription_id, targetRestoId]);

    await logPaymentAudit(targetRestoId, 'CASHFREE_SANDBOX_SUB_CREATED', {
      subscription_id: cfResult.subscription_id,
      customer_id: cfResult.customer_id,
      plan_key: dbPlan.key,
      amount: dbPlan.price
    });

    res.json({
      success: true,
      configured: true,
      subscription_id: cfResult.subscription_id,
      subscription_session_id: cfResult.subscription_session_id,
      customer_id: cfResult.customer_id,
      auth_link: cfResult.auth_link,
      subscription_status: cfResult.subscription_status || 'INITIALIZED',
      is_sandbox: cfResult.is_sandbox,
      plan: {
        id: dbPlan.id,
        key: dbPlan.key,
        name: dbPlan.name,
        price: Number(dbPlan.price)
      },
      message: 'Cashfree Sandbox subscription created successfully.'
    });
  } catch (err) {
    console.error('Create Cashfree subscription error:', err);
    res.status(500).json({ error: 'Internal server error while creating subscription' });
  }
};

router.post('/create-subscription', authenticateToken, handleCreateSubscription);
router.post('/create-mandate', authenticateToken, handleCreateSubscription);

// ==========================================
// 2. SERVER-SIDE SUBSCRIPTION VERIFICATION
// ==========================================
router.get('/verify-subscription', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    const subscriptionId = (req.query.subscription_id || '').trim();

    if (!restoId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscription_id parameter is required' });
    }

    // 1. Authoritative Local Record Check: verify that subscriptionId belongs strictly to this restaurant!
    const subRows = await query(
      'SELECT id, gateway_subscription_id, status FROM subscriptions WHERE restaurant_id = $1 AND gateway_subscription_id = $2',
      [restoId, subscriptionId]
    );

    const restoRows = await query(
      'SELECT id, mandate_id FROM restaurants WHERE id = $1',
      [restoId]
    );

    const isOwnedByResto = (subRows && subRows.length > 0) || (restoRows && restoRows[0]?.mandate_id === subscriptionId);
    if (!isOwnedByResto) {
      console.warn(`[VERIFY-SUB] Cross-tenant access attempt rejected: Restaurant ${restoId} attempted to verify unowned subscription ${subscriptionId}`);
      return res.status(403).json({
        error: 'SUBSCRIPTION_OWNERSHIP_MISMATCH',
        message: 'The requested subscription does not belong to this restaurant.'
      });
    }

    // 2. Fetch Cashfree Subscription Status server-side
    const cfStatus = await fetchCashfreeSubscriptionStatus(subscriptionId);
    if (!cfStatus.success) {
      return res.status(400).json(cfStatus);
    }

    // 3. Verify Cashfree customer identity
    const expectedCustomerId = `cust_${restoId}`;
    const cfCustomerId = cfStatus.customer_details?.customer_id;
    if (cfCustomerId && cfCustomerId !== expectedCustomerId) {
      console.warn(`[VERIFY-SUB] Cashfree customer ID mismatch: Expected ${expectedCustomerId}, got ${cfCustomerId}`);
      return res.status(403).json({
        error: 'TENANT_MISMATCH',
        message: 'The payment gateway customer details do not match your restaurant identity.'
      });
    }

    const isAuthorized = cfStatus.subscription_status === 'ACTIVE';

    if (isAuthorized) {
      await query(`
        UPDATE restaurants SET mandate_id = $1, mandate_status = 'active', auto_debit_enabled = 1 WHERE id = $2
      `, [subscriptionId, restoId]);

      await query(`
        UPDATE subscriptions SET status = 'trialing', updated_at = CURRENT_TIMESTAMP WHERE restaurant_id = $1 AND gateway_subscription_id = $2 AND status = 'pending'
      `, [restoId, subscriptionId]);

      await logPaymentAudit(restoId, 'CASHFREE_SANDBOX_SUB_VERIFIED', {
        subscription_id: subscriptionId,
        status: cfStatus.subscription_status
      });
    }

    res.json({
      success: true,
      subscription_id: subscriptionId,
      subscription_status: cfStatus.subscription_status,
      authorized: isAuthorized,
      details: cfStatus
    });
  } catch (err) {
    console.error('Verify subscription error:', err);
    res.status(500).json({ error: 'Failed to verify subscription status' });
  }
});

// Calendar-month date calculation helper (e.g. Jan 15 -> Feb 15, Jan 31 -> Feb 28)
function addCalendarMonth(date = new Date()) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0);
  }
  return d.toISOString();
}

// ==========================================
// 3A. CASHFREE SUBSCRIPTION RETURN HANDLER
// Primary: POST (Cashfree sends form POST after mandate authorization)
// Secondary: GET (browser direct navigation / compatibility)
// ==========================================

/**
 * Shared handler logic for both POST and GET return from Cashfree.
 * Cashfree POSTs application/x-www-form-urlencoded after mandate authorization.
 * NEVER trusts the frontend — always verifies server-side via GET /pg/subscriptions/{id}
 */
const handleSubscriptionReturn = async (req, res) => {
  let appBase = 'https://touchqr.in';
  let baseRedirectUrl = 'https://touchqr.in/billing';

  try {
    console.log('[Cashfree Return] HTTP Method:', req.method);
    console.log('[Cashfree Return] Query Params:', req.query);
    console.log('[Cashfree Return] Body Fields:', req.body);

    appBase = getAppBaseUrl(req);
    baseRedirectUrl = `${appBase}/billing`;

    // 1. Read subscriptionId from POST body fields OR query parameters strictly
    const rawSubId =
      (req.body && (req.body.subscriptionId || req.body.subscription_id || req.body.subId || req.body.cf_subscription_id || req.body.sub_id)) ||
      req.query.subscription_id ||
      req.query.subscriptionId ||
      req.query.sub_id ||
      req.query.subId ||
      req.query.cf_subscription_id ||
      null;

    const subscriptionId = rawSubId ? String(rawSubId).trim() : null;

    // Strict rejection: NEVER use global database fallback (ORDER BY id DESC LIMIT 1)!
    if (!subscriptionId) {
      console.warn('[Cashfree Return] Rejected: Missing subscription ID in callback request.');
      return res.redirect(303, `${baseRedirectUrl}?verified=false&status=MISSING_SUBSCRIPTION_REFERENCE`);
    }

    console.log('[Cashfree Return] Processing return for subscription_id:', subscriptionId);

    // 2. Resolve target restaurant strictly by authoritative mapping in database
    const subRows = await query(
      'SELECT restaurant_id FROM subscriptions WHERE gateway_subscription_id = $1 ORDER BY id DESC LIMIT 1',
      [subscriptionId]
    );
    let restoId = subRows[0]?.restaurant_id || null;

    if (!restoId) {
      const restoRows = await query(
        'SELECT id FROM restaurants WHERE mandate_id = $1 LIMIT 1',
        [subscriptionId]
      );
      restoId = restoRows[0]?.id || null;
    }

    if (!restoId) {
      console.warn('[Cashfree Return] Rejected: Unmapped subscription reference:', subscriptionId);
      return res.redirect(303, `${baseRedirectUrl}?verified=false&status=UNMAPPED_SUBSCRIPTION`);
    }

    // 3. Fetch Cashfree Subscription Status server-side
    const cfStatus = await fetchCashfreeSubscriptionStatus(subscriptionId);
    const subStatus = cfStatus.subscription_status || 'PENDING';
    const isAuthorized = cfStatus.success && (subStatus === 'ACTIVE' || subStatus === 'BANK_APPROVAL_PENDING');

    // 4. Verify tenant customer identity matches Cashfree record
    const cfCustomerId = cfStatus.customer_details?.customer_id;
    const expectedCustomerId = `cust_${restoId}`;
    if (cfCustomerId && cfCustomerId !== expectedCustomerId) {
      console.error('[Cashfree Return] Security Violation: Customer ID mismatch. Expected:', expectedCustomerId, 'Received:', cfCustomerId);
      return res.redirect(303, `${baseRedirectUrl}?verified=false&status=TENANT_MISMATCH`);
    }

    if (isAuthorized) {
      const restoRows = await query('SELECT slug FROM restaurants WHERE id = $1', [restoId]);
      const restoSlug = restoRows[0]?.slug;

      // Mandate Authorized! Update active status in DB
      await query(
        "UPDATE restaurants SET mandate_id = $1, mandate_status = 'active', auto_debit_enabled = 1 WHERE id = $2",
        [subscriptionId, restoId]
      );
      await query(
        "UPDATE subscriptions SET status = 'trialing', updated_at = CURRENT_TIMESTAMP WHERE restaurant_id = $1 AND (status = 'pending' OR status = 'initialized')",
        [restoId]
      );
      await logPaymentAudit(restoId, 'CASHFREE_RETURN_VERIFIED', {
        subscription_id: subscriptionId,
        status: subStatus,
        via: req.method === 'POST' ? 'FORM_POST' : 'GET'
      });
      console.log('[Cashfree Return] ✅ Mandate authorized & activated for restaurant', restoId, 'slug:', restoSlug);

      if (restoSlug) {
        return res.redirect(303, `${appBase}/${restoSlug}/admin?verified=true`);
      }
      return res.redirect(303, `${baseRedirectUrl}?verified=true&status=ACTIVE`);
    }

    // Mandate Authorization Failed, Pending, or Cancelled!
    console.warn('[Cashfree Return] Mandate NOT authorized. Status:', subStatus, 'restoId:', restoId);
    await query(
      "UPDATE restaurants SET mandate_status = 'pending', auto_debit_enabled = 0 WHERE id = $1 AND (mandate_status IS NULL OR mandate_status != 'active')",
      [restoId]
    );
    return res.redirect(303, `${baseRedirectUrl}?verified=false&status=${encodeURIComponent(subStatus)}`);
  } catch (err) {
    console.error('[Cashfree Return] Error during return processing:', err.message);
    return res.redirect(303, `${baseRedirectUrl}?verified=false&status=SERVER_ERROR`);
  }
};

// POST is primary — Cashfree sends application/x-www-form-urlencoded form POST
router.post('/subscription-return', handleSubscriptionReturn);
// GET is supported for compatibility and browser direct navigation
router.get('/subscription-return', handleSubscriptionReturn);


// ==========================================
// 3. PHASE 2B PRODUCTION WEBHOOK HANDLER
// ==========================================
const handleCashfreeWebhook = async (req, res) => {
  const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const signature = req.headers['x-webhook-signature'] || req.headers['x-cashfree-signature'];
  const timestamp = req.headers['x-webhook-timestamp'] || req.headers['x-cashfree-timestamp'];

  if (!rawBody || !signature || !timestamp) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE', message: 'Missing signature headers or raw request payload' });
  }

  // 1. Signature Verification Security Check (Strict Async Resolution from system_settings or env)
  // Request header bypass ('x-test-bypass') is REMOVED permanently.
  const isValidSignature = await verifyCashfreeWebhookSignatureAsync(rawBody, timestamp, signature);

  if (!isValidSignature) {
    console.warn(`⚠️ [WEBHOOK REJECTED] Invalid Cashfree signature from IP: ${req.ip}`);
    return res.status(401).json({ error: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' });
  }

  let payload = {};
  try {
    payload = (typeof req.body === 'object' && req.body !== null) ? req.body : JSON.parse(rawBody || '{}');
  } catch (e) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Malformed JSON payload' });
  }

  // Support event field according to Cashfree Subscriptions API schema
  const eventType = payload.event || payload.type || payload.event_type || 'UNKNOWN_EVENT';
  const data = payload.data || payload;

  const subscriptionId = data.subscription_details?.subscription_id || data.subscription_id || data.order_tags?.subscription_id || null;
  const paymentId = data.payment_details?.payment_id || data.payment_id || data.cf_payment_id || null;
  const eventId = payload.event_id || payload.id || (subscriptionId && paymentId ? `${eventType}_${subscriptionId}_${paymentId}` : `${eventType}_${Date.now()}`);

  try {
    // 2. Atomic Database Transaction with Webhook Idempotency Check
    const result = await withTransaction(async (txQuery) => {
      // Check idempotency in `webhook_events` table
      const existingEvents = await txQuery(
        'SELECT id FROM webhook_events WHERE gateway = $1 AND event_id = $2',
        ['cashfree', eventId]
      );

      if (existingEvents && existingEvents.length > 0) {
        return { status: 'DUPLICATE_IGNORED', message: 'Event already processed' };
      }

      // Record webhook event in database
      await txQuery(`
        INSERT INTO webhook_events (gateway, event_id, event_type, payload, processed, created_at)
        VALUES ('cashfree', $1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [eventId, eventType, JSON.stringify(payload), false]);

      // Resolve tenant restaurant EXCLUSIVELY by subscription_id mapping in database
      let restoId = null;
      let subDbRecord = null;
      if (subscriptionId) {
        const subRows = await txQuery('SELECT * FROM subscriptions WHERE gateway_subscription_id = $1 LIMIT 1 FOR UPDATE', [subscriptionId]);
        subDbRecord = subRows[0] || null;
        restoId = subDbRecord?.restaurant_id || null;
      }

      if (!restoId && subscriptionId) {
        console.warn(`⚠️ Webhook received for unmapped subscription_id: ${subscriptionId}. Checking pending_registrations...`);
        const pendingRows = await txQuery(
          "SELECT id FROM pending_registrations WHERE cashfree_subscription_id = $1 OR payload LIKE $2 LIMIT 1",
          [subscriptionId, `%${subscriptionId}%`]
        );
        if (pendingRows && pendingRows.length > 0) {
          try {
            const finalized = await finalizePendingRegistration(pendingRows[0].id, subscriptionId);
            restoId = finalized.newRestoId;
          } catch (finErr) {
            console.warn('[WEBHOOK] Pending registration finalization notice:', finErr.message);
          }
        }
      }

      // Out-of-order check: do not reactivate cancelled or expired subscriptions
      if (subDbRecord && ['cancelled', 'expired'].includes(subDbRecord.status)) {
        if (['SUBSCRIPTION_AUTH_STATUS', 'SUBSCRIPTION_AUTHORIZATION_SUCCESS', 'SUBSCRIPTION_STATUS_CHANGED'].includes(eventType)) {
          const incomingStatus = (data.authorization_details?.authorization_status || data.status || data.subscription_status || '').toUpperCase();
          if (incomingStatus === 'ACTIVE' || incomingStatus === 'SUCCESS') {
            console.warn(`[WEBHOOK] Out-of-order activation event ${eventType} ignored for terminated subscription ${subscriptionId}`);
            await txQuery('UPDATE webhook_events SET processed = $1, processed_at = CURRENT_TIMESTAMP WHERE gateway = $2 AND event_id = $3', [true, 'cashfree', eventId]);
            return { status: 'IGNORED_OUT_OF_ORDER', message: 'Subscription is in terminal state' };
          }
        }
      }

      // Handle Specific Event Types
      if (eventType === 'SUBSCRIPTION_AUTH_STATUS' || eventType === 'SUBSCRIPTION_AUTHORIZATION_SUCCESS') {
        // Never default missing/unknown status to ACTIVE
        const authStatus = data.authorization_details?.authorization_status || data.status || data.subscription_status || null;
        if (authStatus === 'ACTIVE' || authStatus === 'SUCCESS') {
          if (restoId) {
            await txQuery("UPDATE restaurants SET mandate_status = 'active', mandate_id = $1, auto_debit_enabled = 1 WHERE id = $2", [subscriptionId, restoId]);
          }
          await txQuery("UPDATE subscriptions SET status = 'trialing' WHERE gateway_subscription_id = $1 AND status = 'pending'", [subscriptionId]);
        } else if (authStatus === 'FAILED' || authStatus === 'REJECTED' || authStatus === 'CANCELLED') {
          if (restoId) {
            await txQuery("UPDATE restaurants SET mandate_status = 'failed' WHERE id = $1", [restoId]);
          }
        } else {
          console.warn(`[WEBHOOK] Authorization status unknown or missing: ${authStatus}. Entitlement will not be granted.`);
        }
      }

      else if (eventType === 'SUBSCRIPTION_STATUS_CHANGED') {
        const subStatus = (data.status || data.subscription_status || '').toUpperCase();
        if (subStatus === 'ACTIVE') {
          if (restoId && subDbRecord && !['cancelled', 'expired'].includes(subDbRecord.status)) {
            await txQuery("UPDATE restaurants SET mandate_status = 'active', auto_debit_enabled = 1 WHERE id = $1", [restoId]);
            await txQuery("UPDATE subscriptions SET status = 'active' WHERE gateway_subscription_id = $1", [subscriptionId]);
          }
        } else if (subStatus === 'CANCELLED') {
          if (restoId) {
            await txQuery(`UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, CURRENT_TIMESTAMP), auto_renew = 0, cancelled_at = CURRENT_TIMESTAMP WHERE gateway_subscription_id = $1`, [subscriptionId]);
            await txQuery("UPDATE restaurants SET mandate_status = 'cancelled', auto_debit_enabled = 0 WHERE id = $1", [restoId]);
          }
        } else if (subStatus === 'PAUSED') {
          if (restoId) {
            await txQuery("UPDATE subscriptions SET status = 'paused' WHERE gateway_subscription_id = $1", [subscriptionId]);
          }
        } else if (subStatus === 'EXPIRED' || subStatus === 'COMPLETED') {
          if (restoId) {
            await txQuery("UPDATE subscriptions SET status = 'expired' WHERE gateway_subscription_id = $1", [subscriptionId]);
          }
        } else {
          console.warn(`[WEBHOOK] SUBSCRIPTION_STATUS_CHANGED received unhandled status: ${subStatus}`);
        }
      }

      else if (eventType === 'SUBSCRIPTION_PAYMENT_SUCCESS' || eventType === 'SUBSCRIPTION_NEW_PAYMENT') {
        const payStatus = (data.payment_details?.payment_status || data.payment_status || data.status || 'SUCCESS').toUpperCase();
        if (payStatus !== 'SUCCESS') {
          console.warn(`[WEBHOOK] Payment status is ${payStatus}, not SUCCESS. Entitlement skipped.`);
        } else if (restoId && subDbRecord) {
          const payAmount = Number(data.payment_details?.payment_amount || data.payment_amount || data.plan_details?.plan_amount || 0);
          const planRows = await txQuery('SELECT * FROM saas_plans WHERE id = $1', [subDbRecord.plan_id || 2]);
          const currentPlan = planRows[0];
          const expectedPrice = Number(currentPlan?.price || 499);

          if (payAmount <= 0) {
            console.warn(`⚠️ Payment amount non-positive: ₹${payAmount}. Entitlement not granted.`);
            await logPaymentAudit(restoId, 'INVALID_PAYMENT_AMOUNT', { subscription_id: subscriptionId, received: payAmount });
          } else if (payAmount < expectedPrice) {
            // Discrepancy: paid amount is less than expected plan price
            // Record payment for reconciliation; do NOT grant higher tier entitlement, but preserve access for paid period
            console.warn(`⚠️ Payment amount discrepancy: Received ₹${payAmount}, expected ₹${expectedPrice}. Reconciling for tenant.`);
            await logPaymentAudit(restoId, 'PAYMENT_AMOUNT_MISMATCH', {
              subscription_id: subscriptionId,
              received: payAmount,
              expected: expectedPrice,
              reconciliation: 'preserved_paid_period_without_higher_tier'
            });

            const existingPayments = await txQuery('SELECT id FROM payments WHERE gateway = $1 AND gateway_payment_id = $2', ['cashfree', paymentId || eventId]);
            if (!existingPayments || existingPayments.length === 0) {
              const paidAtISO = new Date().toISOString();
              await txQuery(`
                INSERT INTO payments (restaurant_id, subscription_id, gateway, gateway_payment_id, amount, currency, status, payment_type, paid_at)
                VALUES ($1, $2, 'cashfree', $3, $4, 'INR', 'SUCCESS', 'recurring_mismatch', $5)
              `, [restoId, subDbRecord.id, paymentId || eventId, payAmount, paidAtISO]);
            }

            const now = new Date();
            const periodEnd = addCalendarMonth(now);
            const periodStart = now.toISOString();

            await txQuery(`
              UPDATE subscriptions SET 
                status = 'active',
                current_period_start = $1,
                current_period_end = $2,
                next_billing_at = $3,
                updated_at = $4
              WHERE gateway_subscription_id = $5
            `, [periodStart, periodEnd, periodEnd, periodStart, subscriptionId]);

            await txQuery(`
              UPDATE restaurants SET active = true, plan_expires_at = $1 WHERE id = $2
            `, [periodEnd, restoId]);
          } else {
            // Paid amount is valid and meets or exceeds expectedPrice
            // Check if there was a scheduled plan upgrade waiting for payment confirmation
            if (subDbRecord.scheduled_plan_id) {
              const scheduledPlanRows = await txQuery('SELECT * FROM saas_plans WHERE id = $1', [subDbRecord.scheduled_plan_id]);
              const schedPlan = scheduledPlanRows[0];
              if (schedPlan && payAmount >= Number(schedPlan.price)) {
                await txQuery(`
                  UPDATE subscriptions SET 
                    plan_id = $1,
                    amount = $2,
                    scheduled_plan_id = NULL,
                    scheduled_plan_key = NULL,
                    plan_change_effective_at = NULL
                  WHERE gateway_subscription_id = $3
                `, [schedPlan.id, Number(schedPlan.price), subscriptionId]);
                await txQuery(`
                  UPDATE restaurants SET plan_tier = $1, plan_price = $2 WHERE id = $3
                `, [schedPlan.key, Number(schedPlan.price), restoId]);
              }
            }

            // Idempotent payment recording
            const existingPayments = await txQuery('SELECT id FROM payments WHERE gateway = $1 AND gateway_payment_id = $2', ['cashfree', paymentId || eventId]);
            if (!existingPayments || existingPayments.length === 0) {
              const paidAtISO = new Date().toISOString();
              await txQuery(`
                INSERT INTO payments (restaurant_id, subscription_id, gateway, gateway_payment_id, amount, currency, status, payment_type, paid_at)
                VALUES ($1, $2, 'cashfree', $3, $4, 'INR', 'SUCCESS', 'recurring', $5)
              `, [restoId, subDbRecord.id, paymentId || eventId, payAmount || expectedPrice, paidAtISO]);
            }

            const now = new Date();
            const periodEnd = addCalendarMonth(now);
            const periodStart = now.toISOString();

            await txQuery(`
              UPDATE subscriptions SET 
                status = 'active',
                current_period_start = $1,
                current_period_end = $2,
                next_billing_at = $3,
                updated_at = $4
              WHERE gateway_subscription_id = $5
            `, [periodStart, periodEnd, periodEnd, periodStart, subscriptionId]);

            await txQuery(`
              UPDATE restaurants SET active = true, plan_expires_at = $1, mandate_status = 'active' WHERE id = $2
            `, [periodEnd, restoId]);
          }
        }
      }

      else if (eventType === 'SUBSCRIPTION_PAYMENT_FAILED' || eventType === 'SUBSCRIPTION_PAYMENT_DECLINED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'payment_failed' WHERE gateway_subscription_id = $1", [subscriptionId]);
        }
      }

      else if (eventType === 'SUBSCRIPTION_CANCELLED') {
        if (restoId) {
          // Set cancel_requested_at and auto_renew=0, but DO NOT immediately expire
          // Let cron determine when access actually ends based on current_period_end/trial_ends_at
          await txQuery(`UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, CURRENT_TIMESTAMP), auto_renew = 0, cancelled_at = CURRENT_TIMESTAMP WHERE gateway_subscription_id = $1`, [subscriptionId]);
          await txQuery("UPDATE restaurants SET mandate_status = 'cancelled', auto_debit_enabled = 0 WHERE id = $1", [restoId]);
        }
      }

      else if (eventType === 'SUBSCRIPTION_PAUSED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'paused' WHERE gateway_subscription_id = $1", [subscriptionId]);
        }
      }

      else if (eventType === 'SUBSCRIPTION_RESUMED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'active' WHERE gateway_subscription_id = $1", [subscriptionId]);
        }
      }

      else if (eventType === 'PRE_DEBIT_NOTIFICATION') {
        if (restoId) {
          await logPaymentAudit(restoId, 'PRE_DEBIT_NOTIFICATION_RECEIVED', { subscription_id: subscriptionId, payload });
        }
      }

      else if (eventType === 'REFUND' || eventType === 'SUBSCRIPTION_REFUND') {
        if (restoId) {
          await logPaymentAudit(restoId, 'REFUND_AUDIT_LOGGED', { subscription_id: subscriptionId, payload });
        }
      }

      // Mark webhook event processed
      await txQuery('UPDATE webhook_events SET processed = $1, processed_at = CURRENT_TIMESTAMP WHERE gateway = $2 AND event_id = $3', [true, 'cashfree', eventId]);

      if (restoId) {
        await logPaymentAudit(restoId, `WEBHOOK_${eventType}`, { subscription_id: subscriptionId, payment_id: paymentId, event_id: eventId });
      }

      return { status: 'PROCESSED', event_type: eventType, event_id: eventId };
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED', message: err.message });
  }
};

router.post('/cashfree', handleCashfreeWebhook);
router.post('/webhook/cashfree', handleCashfreeWebhook);

// ==========================================
// 4. PAYMENT HISTORY & BILLING STATUS FOR ADMIN
// ==========================================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const targetRestoId = req.user?.restaurant_id;
    if (!targetRestoId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const payments = await query(`
      SELECT p.*, s.gateway_subscription_id 
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      WHERE p.restaurant_id = $1
      ORDER BY p.id DESC LIMIT 50
    `, [targetRestoId]);

    const activeSubRows = await query(`
      SELECT * FROM subscriptions 
      WHERE restaurant_id = $1 
      ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);

    res.json({
      success: true,
      subscription: activeSubRows[0] || null,
      payments: payments || []
    });
  } catch (err) {
    console.error('Fetch payment history error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// ==========================================
// 5. CANCEL MANDATE / SUBSCRIPTION
// ==========================================
router.post('/cancel-mandate', authenticateToken, async (req, res) => {
  try {
    const targetRestoId = req.user?.restaurant_id;
    if (!targetRestoId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    // Find the current active/trialing subscription
    const subRows = await query(
      `SELECT s.*, r.trial_ends_at, r.plan_expires_at, r.mandate_status
       FROM subscriptions s
       JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.restaurant_id = $1 AND s.status IN ('trialing', 'pending', 'active')
       ORDER BY s.id DESC LIMIT 1`,
      [targetRestoId]
    );
    const sub = subRows[0];

    if (!sub) {
      return res.json({ success: false, error: 'No active subscription found' });
    }

    // Idempotency: if already cancel-requested, return existing state
    if (sub.cancel_requested_at) {
      const accessUntil = sub.current_period_end || sub.trial_ends_at || sub.plan_expires_at;
      return res.json({
        success: true,
        already_cancelled: true,
        cancel_requested_at: sub.cancel_requested_at,
        auto_renew: 0,
        access_until: accessUntil,
        message: 'Cancellation was already requested. Access continues until the current period ends.'
      });
    }

    // Call Cashfree to cancel future AutoPay (if gateway subscription exists)
    if (sub.gateway_subscription_id && sub.mandate_status === 'active') {
      try {
        const cfConfig = await getCashfreeConfigAsync();
        if (cfConfig.isConfigured) {
          const cancelUrl = `${cfConfig.baseUrl}/subscriptions/${encodeURIComponent(sub.gateway_subscription_id)}/cancel`;
          const cfRes = await fetch(cancelUrl, {
            method: 'POST',
            headers: {
              'x-api-version': cfConfig.apiVersion,
              'x-client-id': cfConfig.clientId,
              'x-client-secret': cfConfig.clientSecret,
              'Content-Type': 'application/json'
            }
          });
          const cfData = await cfRes.json();
          console.log('[Cancel] Cashfree cancel response:', { status: cfRes.status, sub_status: cfData.subscription_status });
        }
      } catch (cfErr) {
        console.warn('[Cancel] Cashfree cancel API error (continuing with local cancel):', cfErr.message);
      }
    }

    const nowISO = new Date().toISOString();
    const reason = req.body?.reason || null;

    // Update subscription: mark cancel requested, turn off auto-renew
    // DO NOT change status to cancelled yet - current period continues
    await query(
      `UPDATE subscriptions SET cancel_requested_at = $1, auto_renew = 0, cancellation_reason = $2, updated_at = $3
       WHERE id = $4`,
      [nowISO, reason, nowISO, sub.id]
    );

    // Update restaurant: stop future auto-debit, but do NOT set active = 0
    await query(
      "UPDATE restaurants SET auto_debit_enabled = 0, mandate_status = 'cancelled' WHERE id = $1",
      [targetRestoId]
    );

    // Compute access_until
    const accessUntil = sub.current_period_end || sub.trial_ends_at || sub.plan_expires_at;

    await logPaymentAudit(targetRestoId, 'SUBSCRIPTION_CANCEL_REQUESTED', {
      subscription_id: sub.gateway_subscription_id,
      cancel_requested_at: nowISO,
      access_until: accessUntil,
      reason: reason
    });

    res.json({
      success: true,
      cancel_requested_at: nowISO,
      auto_renew: 0,
      access_until: accessUntil,
      message: `Subscription cancellation scheduled. Your access continues until ${accessUntil ? new Date(accessUntil).toLocaleDateString('en-IN') : 'the end of your current period'}.`
    });
  } catch (err) {
    console.error('Cancel mandate error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ==========================================
// 6. CHANGE PLAN
// ==========================================
router.post('/change-plan', authenticateToken, async (req, res) => {
  try {
    const targetRestoId = req.user?.restaurant_id;
    if (!targetRestoId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    // Only accept plan key - NEVER accept price/amount from frontend
    const { plan } = req.body;
    const targetPlanKey = (plan || '').toLowerCase().trim();

    if (!targetPlanKey) {
      return res.status(400).json({ error: 'Plan key is required', message: 'Please specify a valid plan (basic, pro, enterprise).' });
    }

    // Resolve authoritative price from saas_plans table
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [targetPlanKey]);
    const targetPlan = planRows[0];

    if (!targetPlan) {
      return res.status(400).json({ error: 'Invalid plan', message: `Plan '${targetPlanKey}' does not exist.` });
    }

    // Get current subscription
    const subRows = await query(
      `SELECT s.*, r.plan_tier, r.trial_ends_at, r.plan_expires_at
       FROM subscriptions s
       JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.restaurant_id = $1 AND s.status IN ('trialing', 'active', 'pending')
       ORDER BY s.id DESC LIMIT 1`,
      [targetRestoId]
    );
    const sub = subRows[0];

    if (!sub) {
      return res.status(400).json({ error: 'No active subscription', message: 'No active subscription found to change plan.' });
    }

    // Reject same plan
    const currentPlanKey = (sub.plan_tier || 'pro').toLowerCase();
    if (currentPlanKey === targetPlanKey) {
      return res.status(400).json({ error: 'Same plan', message: `You are already on the ${targetPlanKey} plan.` });
    }

    // Reject if cancellation already requested
    if (sub.cancel_requested_at) {
      return res.status(400).json({ error: 'Cancellation pending', message: 'Cannot change plan while cancellation is pending. Please reactivate first.' });
    }

    const nowISO = new Date().toISOString();
    const targetPrice = Number(targetPlan.price);
    const currentPrice = Number(sub.amount || sub.plan_price || 0);
    const isHigherPrice = targetPrice > currentPrice;

    // TRIAL: Immediate plan change (trial dates unchanged)
    if (sub.status === 'trialing' || sub.status === 'pending') {
      await query(
        `UPDATE subscriptions SET plan_id = $1, amount = $2, scheduled_plan_key = NULL, plan_change_effective_at = NULL, updated_at = $3
         WHERE id = $4`,
        [targetPlan.id, targetPrice, nowISO, sub.id]
      );

      await query(
        `UPDATE restaurants SET plan_tier = $1, plan_price = $2 WHERE id = $3`,
        [targetPlan.key, targetPrice, targetRestoId]
      );

      await logPaymentAudit(targetRestoId, 'PLAN_CHANGED_TRIAL', {
        from_plan: currentPlanKey,
        to_plan: targetPlanKey,
        new_price: targetPrice,
        effective: 'immediate',
        reauthorization_required: isHigherPrice,
        trial_end: sub.trial_ends_at || sub.plan_expires_at
      });

      return res.json({
        success: true,
        effective: 'immediate',
        from_plan: currentPlanKey,
        to_plan: targetPlanKey,
        new_price: targetPrice,
        reauthorization_required: isHigherPrice,
        trial_ends_at: sub.trial_ends_at || sub.plan_expires_at,
        message: `Plan changed to ${targetPlan.name}. Your trial continues unchanged. First charge after trial will be ₹${targetPrice}/month.`
      });
    }

    // ACTIVE SUBSCRIPTION: Schedule plan change at next billing boundary
    const effectiveAt = sub.current_period_end || sub.plan_expires_at;

    if (!effectiveAt) {
      return res.status(400).json({ error: 'No billing period end date found', message: 'Cannot determine when to switch plans.' });
    }

    await query(
      `UPDATE subscriptions SET scheduled_plan_id = $1, scheduled_plan_key = $2, plan_change_effective_at = $3, updated_at = $4
       WHERE id = $5`,
      [targetPlan.id, targetPlanKey, effectiveAt, nowISO, sub.id]
    );

    await logPaymentAudit(targetRestoId, 'PLAN_CHANGE_SCHEDULED', {
      from_plan: currentPlanKey,
      to_plan: targetPlanKey,
      new_price: targetPrice,
      effective_at: effectiveAt,
      reauthorization_required: isHigherPrice
    });

    res.json({
      success: true,
      effective: 'next_billing_cycle',
      from_plan: currentPlanKey,
      to_plan: targetPlanKey,
      new_price: targetPrice,
      effective_at: effectiveAt,
      reauthorization_required: isHigherPrice,
      message: isHigherPrice
        ? `Plan change scheduled. Your current ${currentPlanKey} plan continues until ${new Date(effectiveAt).toLocaleDateString('en-IN')}. ${targetPlan.name} (₹${targetPrice}/month) will take effect at your next billing cycle. Re-authorization may be prompted at renewal.`
        : `Plan change scheduled. Your current ${currentPlanKey} plan continues until ${new Date(effectiveAt).toLocaleDateString('en-IN')}. ${targetPlan.name} (₹${targetPrice}/month) will activate from your next billing cycle.`
    });
  } catch (err) {
    console.error('Change plan error:', err);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

export default router;
