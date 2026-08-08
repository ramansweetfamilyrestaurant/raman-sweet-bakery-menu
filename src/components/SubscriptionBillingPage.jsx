import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles, CreditCard, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { createCashfreeSubscription, verifyCashfreeSubscription } from '../api/client';

export default function SubscriptionBillingPage({ restoInfo, token, onProceedToDashboard }) {
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

  // Read stored plan or restaurant info
  useEffect(() => {
    const savedPlan = localStorage.getItem('selected_plan_tier') || sessionStorage.getItem('selected_plan_tier');
    const tier = (savedPlan || restoInfo?.plan_tier || 'pro').toLowerCase();
    setPlanKey(tier);

    if (tier === 'basic') {
      setPlanDetails({ name: 'Basic Starter Plan', price: 499, badge: '⚡ BASIC' });
    } else if (tier === 'enterprise') {
      setPlanDetails({ name: 'Enterprise VIP Plan', price: 1999, badge: '🚀 ENTERPRISE' });
    } else {
      setPlanDetails({ name: 'Pro Luxury Plan', price: 999, badge: '👑 PRO' });
    }

    // Check if mandate is already active in database
    if (restoInfo?.mandate_status === 'active' || restoInfo?.auto_debit_enabled) {
      setMandateActive(true);
    }
  }, [restoInfo]);

  // Calculate Trial Dates
  const now = new Date();
  const trialStart = restoInfo?.trial_started_at ? new Date(restoInfo.trial_started_at) : now;
  const trialEnd = restoInfo?.trial_ends_at ? new Date(restoInfo.trial_ends_at) : new Date(now.getTime() + 14 * 86400 * 1000);

  const formatDate = (d) => {
    try {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return d.toISOString().substring(0, 10);
    }
  };

  // Check return URL or pending subscription on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subIdParam = params.get('subscription_id') || params.get('sub_id') || localStorage.getItem('pending_subscription_id');
    if (subIdParam) {
      handleVerifySubscription(subIdParam);
    }
  }, []);

  // Initiate Cashfree Subscription Mandate Checkout
  const handleStartFreeTrialMandate = async () => {
    setAuthorizing(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      const authToken = token || localStorage.getItem('raman_admin_token') || localStorage.getItem('adminToken');
      if (!authToken) {
        throw new Error('Authentication session token missing. Please log in again.');
      }

      const returnUrl = window.location.href;
      const res = await createCashfreeSubscription(planKey, authToken, returnUrl);

      if (!res.configured) {
        setErrorMsg('⚠️ Cashfree Sandbox credentials are not configured in backend environment.');
        setAuthorizing(false);
        return;
      }

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to initialize Cashfree subscription session.');
        setAuthorizing(false);
        return;
      }

      // 1. Preserve subscription_id in localStorage for post-return verification
      if (res.subscription_id) {
        localStorage.setItem('pending_subscription_id', res.subscription_id);
      }

      // 2. Ensure Cashfree SDK v3 is loaded
      if (!window.Cashfree) {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Cashfree JS SDK'));
            document.body.appendChild(script);
          });
        } catch (sdkLoadErr) {
          console.warn('Cashfree JS SDK script load warning:', sdkLoadErr.message);
        }
      }

      // 3. Primary Checkout: Official Cashfree Subscriptions SDK Checkout
      if (res.subscription_session_id && window.Cashfree) {
        try {
          const cashfree = window.Cashfree({ mode: res.is_sandbox ? 'sandbox' : 'production' });
          setStatusMsg('🚀 Opening Cashfree Subscription Mandate Checkout...');
          cashfree.subscriptionsCheckout({
            subsSessionId: res.subscription_session_id,
            redirectTarget: '_self'
          });
          setAuthorizing(false);
          return;
        } catch (sdkErr) {
          console.warn('subscriptionsCheckout SDK error, falling back to auth_link:', sdkErr.message);
        }
      }

      // 4. Fallback Checkout: Official auth_link URL from backend
      if (res.auth_link) {
        setStatusMsg('🔗 Opening Cashfree Mandate Authorization page...');
        setTimeout(() => {
          window.location.href = res.auth_link;
        }, 600);
        return;
      }

      // 5. Checkout Load Failure
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

      if (res.authorized || res.subscription_status === 'ACTIVE') {
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
        maxWidth: '560px',
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
          Welcome to KhanaMaster SaaS 🚀
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#A7F3D0', margin: '0 0 24px 0' }}>
          Your digital QR menu account <strong>{restoInfo?.name || 'Restaurant'}</strong> is created!
        </p>

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

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '16px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#DFBA67' }}>
              ₹{planDetails.price}
            </span>
            <span style={{ fontSize: '0.88rem', color: '#CBD5E1', fontWeight: 600 }}>
              / month (after 14-day trial)
            </span>
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
            🔒 <strong>Zero charge today (₹0 Today)</strong>. Your first recurring charge of ₹{planDetails.price} will occur on {formatDate(trialEnd)} when the trial ends.
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
              ✅ UPI Autopay Mandate Active • 14-Day Free Trial Authorized
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
              <span>{authorizing ? 'Opening Cashfree Mandate...' : '🚀 Start 14-Day Free Trial & Authorize Mandate'}</span>
            </button>

            <button
              onClick={onProceedToDashboard}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#CBD5E1',
                padding: '12px',
                borderRadius: '9999px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Continue to Admin Dashboard (Mandate Authorization Pending) →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
