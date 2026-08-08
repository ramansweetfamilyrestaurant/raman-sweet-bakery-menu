import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles, CreditCard, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { createCashfreeSubscription, verifyCashfreeSubscription } from '../api/client';

export default function SubscriptionBillingPage({ restoInfo, token, onProceedToDashboard }) {
  const [currentResto, setCurrentResto] = useState(restoInfo || null);
  const [planKey, setPlanKey] = useState('pro');
  const [planDetails, setPlanDetails] = useState({
    name: 'Pro Luxury Plan',
    price: 999,
    badge: '👑 PRO'
  });

  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mandateActive, setMandateActive] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // 1. Fetch current restaurant details & subscription status server-side if restoInfo is empty
  useEffect(() => {
    const authToken = token || localStorage.getItem('raman_admin_token') || localStorage.getItem('adminToken');
    if (!restoInfo && authToken) {
      fetch('/api/admin/subscription-status', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setCurrentResto({
              name: data.restaurant_name || localStorage.getItem('raman_admin_user') || 'Your Restaurant',
              plan_tier: data.plan_tier || 'pro',
              mandate_status: data.mandate_status || 'pending',
              auto_debit_enabled: data.auto_debit_enabled,
              trial_started_at: data.trial_started_at,
              trial_ends_at: data.trial_ends_at || data.plan_expires_at
            });
            if (data.mandate_status === 'active' || data.auto_debit_enabled) {
              setMandateActive(true);
            }
          }
        })
        .catch(console.error);
    } else if (restoInfo) {
      setCurrentResto(restoInfo);
    }
  }, [restoInfo, token]);

  // 2. Read stored plan, restaurant info, and auto-validate saved coupon
  useEffect(() => {
    const activeResto = currentResto || restoInfo;
    const savedPlan = localStorage.getItem('selected_plan_tier') || sessionStorage.getItem('selected_plan_tier');
    const tier = (planKey || savedPlan || activeResto?.plan_tier || 'pro').toLowerCase();
    setPlanKey(tier);

    if (tier === 'basic') {
      setPlanDetails({ name: 'Basic Starter Plan', price: 499, badge: '⚡ BASIC' });
    } else if (tier === 'enterprise') {
      setPlanDetails({ name: 'Enterprise VIP Plan', price: 1999, badge: '🚀 ENTERPRISE' });
    } else {
      setPlanDetails({ name: 'Pro Luxury Plan', price: 999, badge: '👑 PRO' });
    }

    // Check saved coupon code from registration or previous attempt
    const savedCoupon = localStorage.getItem('applied_coupon_code');
    if (savedCoupon && !appliedCoupon) {
      setCouponInput(savedCoupon);
      validateCoupon(savedCoupon, tier);
    }

    // Check if mandate is already active in database
    if (activeResto?.mandate_status === 'active' || activeResto?.auto_debit_enabled) {
      setMandateActive(true);
    }
  }, [currentResto, restoInfo, planKey]);

  const validateCoupon = async (codeToValidate, tierToValidate) => {
    if (!codeToValidate || !codeToValidate.trim()) return;
    setCouponLoading(true);
    setCouponMsg('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToValidate.trim(), plan_tier: tierToValidate || planKey, restaurant_id: restoInfo?.id })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon(data);
        localStorage.setItem('applied_coupon_code', data.code);
        setCouponMsg(`✓ Coupon '${data.code}' applied! Saved ₹${data.discount_amount} on your first paid month.`);
      } else {
        setAppliedCoupon(null);
        localStorage.removeItem('applied_coupon_code');
        setCouponMsg(data.error || '❌ Invalid or expired coupon code');
      }
    } catch (e) {
      setAppliedCoupon(null);
      setCouponMsg('❌ Failed to validate coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  // Calculate Trial Dates
  const activeResto = currentResto || restoInfo;
  const now = new Date();
  const trialStart = activeResto?.trial_started_at ? new Date(activeResto.trial_started_at) : now;
  const trialEnd = activeResto?.trial_ends_at ? new Date(activeResto.trial_ends_at) : new Date(now.getTime() + 14 * 86400 * 1000);

  const formatDate = (d) => {
    try {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return d.toISOString().substring(0, 10);
    }
  };

  // 1. Eagerly load Cashfree SDK v3 on component mount
  useEffect(() => {
    if (!window.Cashfree) {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => console.log('⚡ Cashfree JS SDK loaded eagerly');
      script.onerror = () => console.warn('⚠️ Cashfree JS SDK load error');
      document.body.appendChild(script);
    }
  }, []);

  // 2. Check return URL parameters (from backend subscription-return redirect) or pending subscription on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifiedParam = params.get('verified');
    const statusParam = params.get('status');
    const subIdParam = params.get('subscription_id') || params.get('sub_id') || localStorage.getItem('pending_subscription_id');

    if (verifiedParam === 'true') {
      setMandateActive(true);
      setStatusMsg('✅ Cashfree Mandate Authorized Successfully! 14-Day Free Trial is Active.');
      if (subIdParam) localStorage.removeItem('pending_subscription_id');
    } else if (verifiedParam === 'false') {
      setErrorMsg(`⚠️ Mandate authorization pending or not completed. Status: ${statusParam || 'PENDING'}`);
    } else if (subIdParam) {
      handleVerifySubscription(subIdParam);
    }
  }, []);

  // Initiate Cashfree Subscription Mandate Checkout
  const handleStartFreeTrialMandate = async () => {
    setAuthorizing(true);
    setErrorMsg('');
    setStatusMsg('');
    localStorage.removeItem('pending_subscription_id');

    try {
      const authToken = token || localStorage.getItem('raman_admin_token') || localStorage.getItem('adminToken');
      if (!authToken) {
        throw new Error('Authentication session token missing. Please log in again.');
      }

      // Backend subscription-return endpoint handles the Cashfree form POST and redirects back
      const returnUrl = `${window.location.origin}/api/payment/subscription-return`;
      const couponCodeToPass = appliedCoupon?.code || localStorage.getItem('applied_coupon_code') || null;
      const res = await createCashfreeSubscription(planKey, authToken, returnUrl, couponCodeToPass);

      if (!res.configured) {
        setErrorMsg('⚠️ Cashfree Sandbox credentials are not configured in backend environment.');
        setAuthorizing(false);
        return;
      }

      if (!res.success || !res.subscription_session_id) {
        setErrorMsg(res.message || 'Failed to initialize Cashfree subscription session.');
        setAuthorizing(false);
        return;
      }

      // 1. Preserve subscription_id in localStorage for post-return verification fallback
      if (res.subscription_id) {
        localStorage.setItem('pending_subscription_id', res.subscription_id);
      }

      // 2. Ensure Cashfree SDK is ready (loaded eagerly, but fallback script append if needed)
      if (!window.Cashfree) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Cashfree JS SDK'));
          document.body.appendChild(script);
        });
      }

      // 3. Primary Checkout: Official Cashfree Subscriptions SDK Checkout using exact subscription_session_id
      if (window.Cashfree && res.subscription_session_id) {
        setStatusMsg('🚀 Opening Cashfree Subscription Mandate Checkout...');
        const cashfree = window.Cashfree({ mode: res.is_sandbox ? 'sandbox' : 'production' });
        
        // DO NOT set authorizing=false here to prevent UI button state blinking before redirect!
        cashfree.subscriptionsCheckout({
          subsSessionId: res.subscription_session_id,
          redirectTarget: '_self'
        });
        return;
      }

      setErrorMsg('Payment checkout could not be loaded. Please try again.');
      setAuthorizing(false);
    } catch (err) {
      console.error('Cashfree setup error:', err);
      setErrorMsg(err.message || 'Failed to initiate Cashfree subscription.');
      setAuthorizing(false);
    }
  };

  // Server-side Subscription Status Verification
  const handleVerifySubscription = async (subId) => {
    if (!subId) return;
    setVerifying(true);
    try {
      const authToken = token || localStorage.getItem('raman_admin_token') || localStorage.getItem('adminToken');
      const res = await verifyCashfreeSubscription(subId, authToken);

      if (res.authorized || res.subscription_status === 'ACTIVE' || res.subscription_status === 'INITIALIZED') {
        setMandateActive(true);
        setStatusMsg('✅ Cashfree Mandate Authorized Successfully! 14-Day Free Trial is Active.');
      } else {
        setStatusMsg(`⏳ Subscription Status: ${res.subscription_status || 'PENDING'}`);
      }
    } catch (err) {
      console.warn('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  // Calculated Pricing Breakdown
  const originalPrice = planDetails.price;
  const discountAmount = appliedCoupon ? Number(appliedCoupon.discount_amount || 0) : 0;
  const firstPaymentPrice = appliedCoupon && appliedCoupon.final_first_payment_amount !== undefined
    ? Number(appliedCoupon.final_first_payment_amount)
    : Math.max(0, originalPrice - discountAmount);
  const discountPercent = appliedCoupon?.discount_type === 'PERCENTAGE'
    ? `${appliedCoupon.discount_value}% OFF`
    : (appliedCoupon ? `₹${discountAmount} OFF` : null);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, #0A2315 0%, #05140B 60%, #020904 100%)',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        maxWidth: '580px',
        width: '100%',
        background: '#0D1F15',
        borderRadius: '28px',
        border: '2px solid #DFBA67',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
        padding: '36px 28px',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Header Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(223,186,103,0.15)',
          color: '#DFBA67',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          border: '2px solid #DFBA67',
          boxShadow: '0 0 30px rgba(223,186,103,0.3)'
        }}>
          <Sparkles size={38} />
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
          Complete Your Subscription Setup 🚀
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#A7F3D0', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          Your restaurant account <strong>{activeResto?.name || localStorage.getItem('raman_admin_user') || 'Restaurant'}</strong> has been created. Activate your 14-day free trial by authorizing your subscription.
        </p>

        {/* Transparent Notice Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(223,186,103,0.12)',
          border: '1px solid rgba(223,186,103,0.3)',
          borderRadius: '50px',
          padding: '6px 14px',
          fontSize: '0.76rem',
          fontWeight: 800,
          color: '#DFBA67',
          marginBottom: '22px'
        }}>
          🛡️ 14-Day Free Trial • ₹0 Today • UPI AutoPay Authorization Required
        </div>

        {/* Selected Plan Summary Box */}
        <div style={{
          background: 'linear-gradient(135deg, #164E2A 0%, #0A2315 100%)',
          borderRadius: '20px',
          padding: '20px',
          border: '1.5px solid #22C55E',
          marginBottom: '24px',
          textAlign: 'left',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#86EFAC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                SELECTED SAAS PLAN
              </span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FFFFFF', margin: '2px 0 0 0' }}>
                {planDetails.name}
              </h2>
            </div>
            <span style={{
              background: '#DFBA67',
              color: '#0A2315',
              fontWeight: 900,
              fontSize: '0.82rem',
              padding: '6px 14px',
              borderRadius: '50px',
              boxShadow: '0 4px 12px rgba(223,186,103,0.4)'
            }}>
              {planDetails.badge}
            </span>
          </div>

          {/* Detailed Subscription Billing Breakdown */}
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '14px',
            padding: '14px 16px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.84rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
              <span>Normal Plan Price:</span>
              <span style={{ color: '#E2E8F0', fontWeight: 700 }}>₹{originalPrice}/month</span>
            </div>

            {appliedCoupon && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34D399', fontWeight: 800 }}>
                  <span>Applied Coupon Code:</span>
                  <span>{appliedCoupon.code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34D399', fontWeight: 800 }}>
                  <span>Discount:</span>
                  <span>-{discountPercent} (-₹{discountAmount})</span>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#86EFAC', fontWeight: 800 }}>
              <span>Charge Today (Trial Period):</span>
              <span>₹0 (FREE TODAY)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
              <span>Free Trial Duration:</span>
              <span>14 Days</span>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#F1F5F9', fontWeight: 800 }}>First Paid Cycle Charge:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFD700' }}>
                ₹{firstPaymentPrice}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '0.78rem' }}>
              <span>First Charge Date:</span>
              <span style={{ color: '#86EFAC', fontWeight: 700 }}>{formatDate(trialEnd)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '0.78rem' }}>
              <span>Future Monthly Charges:</span>
              <span style={{ color: '#E2E8F0', fontWeight: 700 }}>₹{originalPrice}/month</span>
            </div>
          </div>

          {/* 🎟️ Promo Code Input inside Billing Page */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
              🎟️ HAVE A PROMO / COUPON CODE?
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter code (e.g. LAUNCH50)"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.4)',
                  color: '#FFD700',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}
              />
              <button
                type="button"
                onClick={() => validateCoupon(couponInput, planKey)}
                disabled={couponLoading || !couponInput.trim()}
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: couponLoading || !couponInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {couponLoading ? 'Applying...' : 'Apply'}
              </button>
            </div>
            {couponMsg && (
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: appliedCoupon ? '#34D399' : '#EF4444', marginTop: '4px' }}>
                {couponMsg}
              </div>
            )}
          </div>

          {/* Trial Dates Grid */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '14px',
            padding: '14px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            fontSize: '0.82rem'
          }}>
            <div>
              <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.74rem', fontWeight: 700 }}>
                🎁 14-DAY FREE TRIAL START:
              </span>
              <strong style={{ color: '#FFFFFF', fontWeight: 800 }}>{formatDate(trialStart)}</strong>
            </div>

            <div>
              <span style={{ color: '#86EFAC', display: 'block', fontSize: '0.74rem', fontWeight: 800 }}>
                ⏰ TRIAL ENDS & FIRST CHARGE:
              </span>
              <strong style={{ color: '#86EFAC', fontWeight: 900 }}>{formatDate(trialEnd)}</strong>
            </div>
          </div>

          <p style={{ fontSize: '0.76rem', color: '#94A3B8', margin: '12px 0 0 0', lineHeight: 1.4 }}>
            🔒 <strong>₹0 will be charged today</strong>. Your first paid charge of ₹{firstPaymentPrice} will occur after the 14-day free trial on {formatDate(trialEnd)}. The coupon applies to the first paid cycle only.
          </p>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            padding: '12px 16px',
            borderRadius: '14px',
            fontSize: '0.84rem',
            fontWeight: 700,
            marginBottom: '20px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={20} color="#EF4444" style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {statusMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22C55E',
            color: '#86EFAC',
            padding: '12px 16px',
            borderRadius: '14px',
            fontSize: '0.84rem',
            fontWeight: 800,
            marginBottom: '20px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={20} color="#22C55E" style={{ flexShrink: 0 }} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Mandate Status & Action Buttons */}
        {mandateActive ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(34,197,94,0.2)',
              border: '2px solid #22C55E',
              color: '#86EFAC',
              padding: '14px',
              borderRadius: '16px',
              fontWeight: 800,
              fontSize: '0.92rem',
              marginBottom: '20px'
            }}>
              ✅ Cashfree Mandate Authorized • UPI AutoPay Active • 14-Day Free Trial Activated
            </div>

            <button
              onClick={onProceedToDashboard}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '9999px',
                border: 'none',
                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                color: '#FFFFFF',
                fontSize: '1rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 6px 20px rgba(34,197,94,0.4)'
              }}
            >
              <span>Go to Admin Dashboard</span>
              <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button
              onClick={handleStartFreeTrialMandate}
              disabled={authorizing}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '9999px',
                border: 'none',
                background: 'linear-gradient(135deg, #DFBA67 0%, #C59B3F 100%)',
                color: '#0A2315',
                fontSize: '1rem',
                fontWeight: 900,
                cursor: authorizing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 6px 22px rgba(223,186,103,0.4)'
              }}
            >
              <ShieldCheck size={22} />
              <span>{authorizing ? 'Opening Cashfree Mandate...' : '🚀 Start 14-Day Free Trial & Authorize UPI AutoPay'}</span>
            </button>

            <button
              onClick={() => {
                alert('⚠️ Subscription authorization is incomplete. Please click "Start 14-Day Free Trial & Authorize UPI AutoPay" to activate your subscription and access the Admin Dashboard.');
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94A3B8',
                padding: '12px',
                borderRadius: '9999px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔒 Admin Dashboard Locked (Subscription Authorization Pending)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
