import React, { useState } from 'react';
import { X, CreditCard, Sparkles, CheckCircle2, ShieldCheck, ArrowRight, AlertTriangle, ExternalLink } from 'lucide-react';
import { createCashfreeSubscription } from '../api/client';

export default function PaymentModal({ restoInfo, planTier = 'pro', planPrice = 999, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSetupSubscription = async () => {
    setLoading(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      const token = localStorage.getItem('touchqr_admin_token') || localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Admin session token missing. Please log in again.');
      }

      const data = await createCashfreeSubscription(planTier, token);

      if (!data.configured) {
        setErrorMsg('⚠️ Cashfree Sandbox gateway is not configured on the server. Please configure gateway credentials in Super Admin Settings.');
        setLoading(false);
        return;
      }

      if (!data.success) {
        setErrorMsg(data.message || 'Failed to initiate Cashfree Sandbox subscription.');
        setLoading(false);
        return;
      }

      // 1. Primary Authorization Method: Launch Cashfree Web JS SDK or Redirect to auth_link
      if (data.subscription_session_id) {
        if (!window.Cashfree) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Cashfree JS SDK'));
            document.body.appendChild(script);
          });
        }

        if (window.Cashfree) {
          const cashfree = window.Cashfree({ mode: data.is_sandbox ? 'sandbox' : 'production' });
          // Launch Cashfree SDK subscription checkout
          if (typeof cashfree.subscriptionsCheckout === 'function') {
            cashfree.subscriptionsCheckout({
              subsSessionId: data.subscription_session_id,
              subscriptionSessionId: data.subscription_session_id,
              redirectTarget: '_modal'
            });
          } else if (typeof cashfree.checkout === 'function') {
            cashfree.checkout({
              subsSessionId: data.subscription_session_id,
              subscriptionSessionId: data.subscription_session_id,
              redirectTarget: '_modal'
            });
          }
          setStatusMsg('🚀 Cashfree Sandbox Mandate Checkout launched! Please complete subscription authorization.');
          setLoading(false);
          return;
        }
      }

      if (data.auth_link) {
        setStatusMsg('🔗 Cashfree Sandbox Subscription Session Created! Redirecting to Mandate Authorization page...');
        setTimeout(() => {
          window.location.href = data.auth_link;
        }, 1200);
        return;
      }

      if (data.subscription_id) {
        setStatusMsg(`📌 Cashfree Subscription Session Created (ID: ${data.subscription_id}). Mandate Authorization required.`);
        setLoading(false);
        return;
      }

      setStatusMsg('⏳ Subscription session initialized. Authorization pending on Cashfree gateway.');
    } catch (err) {
      console.error('Subscription setup error:', err);
      setErrorMsg(err.message || 'Failed to initiate Cashfree subscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12000,
      background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: '24px', maxWidth: '480px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        position: 'relative', animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
          color: '#FFFFFF', padding: '20px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
          borderBottom: '3px solid #DFBA67', textAlign: 'center', position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '14px', right: '14px',
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFF',
              borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>

          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFFFFF', color: '#0A2315', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={24} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#DFBA67' }}>
            Subscription & Billing
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#E2E8F0' }}>
            {restoInfo?.name || 'Restaurant'} — {planTier.toUpperCase()} Plan
          </span>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          
          {/* Mode Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: '#FEF3C7', border: '1px solid #F59E0B', color: '#B45309',
            padding: '4px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800,
            marginBottom: '14px'
          }}>
            <span>🔒 Secure AutoPay Billing Setup</span>
          </div>

          {statusMsg && (
            <div style={{
              background: '#ECFDF5', border: '1.5px solid #10B981', color: '#047857',
              padding: '12px 16px', borderRadius: '12px', fontSize: '0.84rem', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
            }}>
              <CheckCircle2 size={18} color="#10B981" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{
              background: '#FEF2F2', border: '1.5px solid #EF4444', color: '#991B1B',
              padding: '12px 16px', borderRadius: '12px', fontSize: '0.84rem', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
            }}>
              <AlertTriangle size={18} color="#EF4444" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pricing & Trial Box */}
          <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#334155' }}>
                Selected Plan Rate:
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                ₹{planPrice} / month
              </span>
            </div>

            <div style={{
              background: '#F0FDF4', border: '1px dashed #22C55E', borderRadius: '10px',
              padding: '10px 12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '0.78rem', fontWeight: 800, color: '#15803D'
            }}>
              <Sparkles size={16} />
              <span>🎁 Free trial period applies — no charges until your trial concludes. Auto-renew can be managed anytime from settings.</span>
            </div>
          </div>

          {/* Setup Action Button */}
          <button
            onClick={handleSetupSubscription}
            disabled={loading}
            aria-label="Continue to Payment Authorization"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '13px 18px',
              borderRadius: '14px',
              fontWeight: 900,
              fontSize: '0.95rem',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)'
            }}
          >
            <CreditCard size={18} />
            <span>{loading ? 'Processing...' : 'Continue to Payment'}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

