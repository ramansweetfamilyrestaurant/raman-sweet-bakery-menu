import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
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
            if (data.mandate_status === 'active') {
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
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlan = urlParams.get('plan');
    const savedPlan = localStorage.getItem('selected_plan_tier') || sessionStorage.getItem('selected_plan_tier');
    
    // Authoritative Tier Resolution: URL ?plan -> DB activeResto.plan_tier -> localStorage -> fallback 'pro'
    const targetTier = (urlPlan || activeResto?.plan_tier || savedPlan || 'pro').toLowerCase().trim();
    setPlanKey(targetTier);

    if (targetTier === 'basic') {
      setPlanDetails({ name: 'Basic Starter Plan', price: 499, badge: '⚡ BASIC' });
    } else if (targetTier === 'enterprise') {
      setPlanDetails({ name: 'Enterprise VIP Plan', price: 1999, badge: '🚀 ENTERPRISE' });
    } else {
      setPlanDetails({ name: 'Pro Luxury Plan', price: 999, badge: '👑 PRO' });
    }

    // Auto-validate default launch promo LAUNCH50 or saved coupon code against targetTier
    const savedCoupon = localStorage.getItem('applied_coupon_code') || 'LAUNCH50';
    setCouponInput(savedCoupon);
    validateCoupon(savedCoupon, targetTier);

    // Check if mandate is already active in database
    if (activeResto?.mandate_status === 'active') {
      setMandateActive(true);
    }
  }, [currentResto, restoInfo]);

  // 3. Active 3-second Subscription Status Polling: Detects live Cashfree payment/mandate authorization automatically
  useEffect(() => {
    if (mandateActive) {
      const timer = setTimeout(() => {
        if (onProceedToDashboard) onProceedToDashboard();
      }, 1000);
      return () => clearTimeout(timer);
    }

    const authToken = token || localStorage.getItem('raman_admin_token') || localStorage.getItem('adminToken');
    if (!authToken) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/subscription-status', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.mandate_status === 'active') {
            setMandateActive(true);
            setStatusMsg('✅ Cashfree Mandate Authorized Successfully! Redirecting to Admin Dashboard...');
            clearInterval(pollInterval);
            if (onProceedToDashboard) onProceedToDashboard();
          }
        }
      } catch (e) {
        console.warn('Subscription status poll notice:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [mandateActive, token, onProceedToDashboard]);

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
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

  // 2. Check return URL parameters (from backend subscription-return redirect) on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifiedParam = params.get('verified');
    const statusParam = params.get('status');
    const subIdParam = params.get('subscription_id') || params.get('sub_id');

    if (verifiedParam === 'true') {
      setMandateActive(true);
      setStatusMsg('✅ Cashfree Mandate Authorized Successfully! 14-Day Free Trial Active. Redirecting...');
      localStorage.removeItem('pending_subscription_id');
      const timer = setTimeout(() => {
        if (onProceedToDashboard) onProceedToDashboard();
      }, 1500);
      return () => clearTimeout(timer);
    } else if (verifiedParam === 'false') {
      setErrorMsg(`⚠️ Subscription authorization pending or failed. Status: ${statusParam || 'PENDING'}`);
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
        throw new Error('Admin session token missing. Please register or log in again.');
      }

      const activeCouponCode = appliedCoupon ? appliedCoupon.code : localStorage.getItem('applied_coupon_code');

      console.log('[Cashfree Checkout] Initiating subscription for plan_tier:', planKey, 'coupon:', activeCouponCode);
      const subRes = await createCashfreeSubscription(planKey, activeCouponCode, authToken);

      if (!subRes || (!subRes.subscription_id && !subRes.payment_session_id)) {
        throw new Error(subRes?.error || subRes?.message || 'Failed to generate Cashfree subscription session');
      }

      const subscriptionId = subRes.subscription_id;

      if (subscriptionId) {
        localStorage.setItem('pending_subscription_id', subscriptionId);
      }

      setStatusMsg('🚀 Session generated! Opening Cashfree UPI AutoPay Checkout...');

      // Mode A: Handle direct auth_url / payment_link returned by Cashfree
      if (subRes.auth_url || subRes.payment_link) {
        const checkoutUrl = subRes.auth_url || subRes.payment_link;
        console.log('[Cashfree Checkout] Redirecting to auth_url:', checkoutUrl);
        window.location.href = checkoutUrl;
        return;
      }

      // Mode B: Launch SDK Checkout Modal using Cashfree JS SDK v3
      if (window.Cashfree && subRes.payment_session_id) {
        const cashfree = window.Cashfree({ mode: subRes.environment || 'sandbox' });
        console.log('[Cashfree SDK] Launching checkout for session:', subRes.payment_session_id);
        
        cashfree.checkout({
          paymentSessionId: subRes.payment_session_id,
          returnUrl: subRes.return_url || `${window.location.origin}/api/payment/subscription-return?subscription_id=${subscriptionId}`
        }).then(result => {
          if (result.error) {
            console.error('[Cashfree SDK Error]', result.error);
            setErrorMsg(`Checkout error: ${result.error.message || 'Payment interrupted'}`);
            setAuthorizing(false);
          }
          if (result.redirect) {
            console.log('[Cashfree SDK Redirecting...]');
          }
        });
      } else {
        throw new Error('Cashfree Payment Gateway unavailable. Please refresh and try again.');
      }
    } catch (err) {
      console.error('[Cashfree Subscription Error]', err);
      setErrorMsg(err.message || 'Failed to start Cashfree checkout. Please try again.');
      setAuthorizing(false);
    }
  };

  const handleVerifySubscription = async (subId) => {
    if (!subId) return;
    setVerifying(true);
    try {
      const authToken = token || localStorage.getItem('raman_admin_token') || localStorage.getItem('adminToken');
      const res = await verifyCashfreeSubscription(subId, authToken);

      if (res.authorized === true || res.subscription_status === 'ACTIVE') {
        setMandateActive(true);
        setStatusMsg('✅ Cashfree Mandate Authorized Successfully! 14-Day Free Trial is Active.');
      } else {
        setMandateActive(false);
        if (res.subscription_status === 'INITIALIZED') {
          setStatusMsg('⏳ Subscription mandate created. Please complete UPI AutoPay authorization to activate.');
        } else {
          setStatusMsg(`⏳ Subscription Status: ${res.subscription_status || 'PENDING'}`);
        }
      }
    } catch (err) {
      console.warn('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const originalPrice = planDetails.price;
  const discountAmount = appliedCoupon ? Number(appliedCoupon.discount_amount) : 0;
  const discountPercent = appliedCoupon ? (appliedCoupon.discount_type === 'PERCENTAGE' ? `${appliedCoupon.discount_value}%` : `₹${appliedCoupon.discount_value}`) : '';
  const firstPaymentPrice = Math.max(0, originalPrice - discountAmount);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, #0A2315 0%, #05140B 60%, #020904 100%)',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'rgba(13, 31, 21, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1.5px solid #DFBA67',
        boxShadow: '0 25px 70px rgba(0,0,0,0.85)',
        padding: '28px 20px',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Header Icon */}
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(223,186,103,0.15)',
          color: '#DFBA67',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
          border: '2px solid #DFBA67',
          boxShadow: '0 0 24px rgba(223,186,103,0.3)'
        }}>
          <Sparkles size={30} />
        </div>

        <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
          Activate 14-Day Free Trial 🚀
        </h1>
        <p style={{ fontSize: '0.84rem', color: '#A7F3D0', margin: '0 0 18px 0', lineHeight: 1.4 }}>
          Account <strong>{activeResto?.name || localStorage.getItem('raman_admin_user') || 'Restaurant'}</strong> ready! Authorize UPI AutoPay to start.
        </p>

        {/* Selected Plan Consolidated Card */}
        <div style={{
          background: 'linear-gradient(135deg, #164E2A 0%, #0A2315 100%)',
          borderRadius: '18px',
          padding: '18px 16px',
          border: '1.5px solid #22C55E',
          marginBottom: '20px',
          textAlign: 'left',
          boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#86EFAC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                SELECTED SAAS PLAN
              </span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF', margin: '2px 0 0 0' }}>
                {planDetails.name}
              </h2>
            </div>
            <span style={{
              background: '#DFBA67',
              color: '#0A2315',
              fontWeight: 900,
              fontSize: '0.78rem',
              padding: '5px 12px',
              borderRadius: '50px',
              boxShadow: '0 4px 10px rgba(223,186,103,0.3)'
            }}>
              {planDetails.badge}
            </span>
          </div>

          {/* Consolidated Billing Table (Zero Duplication) */}
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '12px',
            padding: '12px 14px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
              <span>Monthly Subscription Rate:</span>
              <span style={{ color: '#E2E8F0', fontWeight: 700 }}>₹{originalPrice}/month</span>
            </div>

            {appliedCoupon && Number(appliedCoupon.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34D399', fontWeight: 800 }}>
                <span>Coupon ({appliedCoupon.code}):</span>
                <span>-{discountPercent} (-₹{discountAmount})</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#86EFAC', fontWeight: 800 }}>
              <span>Charge Today (Trial Period):</span>
              <span>₹0 (FREE TODAY)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
              <span>Free Trial Duration:</span>
              <span style={{ color: '#86EFAC', fontWeight: 700 }}>14 Days (Until {formatDate(trialEnd)})</span>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#F1F5F9', fontWeight: 800 }}>First Charge (Day 15):</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#FFD700' }}>
                ₹{firstPaymentPrice}
              </span>
            </div>
          </div>

          {/* Promo / Coupon Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
              🎟️ HAVE A PROMO CODE?
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Enter code (e.g. LAUNCH50)"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.4)',
                  color: '#FFD700',
                  fontSize: '0.82rem',
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
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.76rem',
                  cursor: couponLoading || !couponInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {couponLoading ? '...' : 'Apply'}
              </button>
            </div>
            {couponMsg && (
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: appliedCoupon ? '#34D399' : '#EF4444', marginTop: '4px' }}>
                {couponMsg}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: '16px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {statusMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22C55E',
            color: '#86EFAC',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 800,
            marginBottom: '16px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={18} color="#22C55E" style={{ flexShrink: 0 }} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Action Button */}
        {mandateActive ? (
          <div>
            <div style={{
              background: 'rgba(34,197,94,0.2)',
              border: '1.5px solid #22C55E',
              color: '#86EFAC',
              padding: '12px',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.86rem',
              marginBottom: '16px'
            }}>
              ✅ Mandate Authorized • 14-Day Trial Active
            </div>

            <button
              onClick={onProceedToDashboard}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '50px',
                border: 'none',
                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                color: '#FFFFFF',
                fontSize: '0.95rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(34,197,94,0.4)'
              }}
            >
              <span>Go to Admin Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartFreeTrialMandate}
            disabled={authorizing}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '50px',
              border: 'none',
              background: 'linear-gradient(135deg, #DFBA67 0%, #C59B3F 100%)',
              color: '#0A2315',
              fontSize: '0.95rem',
              fontWeight: 900,
              cursor: authorizing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 20px rgba(223,186,103,0.4)'
            }}
          >
            <ShieldCheck size={20} />
            <span>{authorizing ? 'Opening Cashfree...' : '🚀 Authorize UPI AutoPay & Activate 14-Day Trial'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
