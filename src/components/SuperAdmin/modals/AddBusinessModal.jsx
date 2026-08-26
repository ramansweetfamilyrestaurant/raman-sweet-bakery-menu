import React, { useState } from 'react';
import { 
  Building2, 
  FileText, 
  CreditCard, 
  UserCheck, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  Lock, 
  Store, 
  RefreshCw, 
  Crown, 
  Gift,
  ExternalLink,
  CheckCircle
} from 'lucide-react';
import { 
  BUSINESS_TYPES, 
  BUSINESS_TYPE_METADATA, 
  resolveServiceModelForBusinessType 
} from '../../../utils/businessTaxonomy';
import { SAAS_PLANS, getPlanDetails } from '../../../config/plans';
import { createSuperAdminBusinessCheckout } from '../../../api/client';

export default function AddBusinessModal({ 
  show, 
  onClose, 
  onSuccess, 
  plansList = [], 
  token, 
  createTenantRestaurant 
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkoutState, setCheckoutState] = useState(null); // null | { status: 'launching' | 'launched' | 'failed', data }

  // Comprehensive Form State across all 5 steps
  const [formData, setFormData] = useState({
    // Step 1: Business Information
    name: '',
    business_type: 'restaurant',
    service_model: 'dine_in',
    slug: '',
    tagline: '100% Quality Food & Customer Service',
    phone: '',
    whatsapp_number: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    is_gst_applicable: false,
    gstin: '',
    theme_color: 'gold',

    // Step 2: Documents / KYC
    pan_number: '',
    trade_license_number: '',
    gst_cert_ref: '',
    owner_id_ref: '',

    // Step 3: Plan & Billing
    plan_tier: 'pro',
    billing_cycle: 'monthly',
    onboarding_mode: 'active', // 'active' (Paid Cashfree) | 'trial' | 'vip'
    plan_price: 999,

    // Step 4: Owner / Admin Account
    owner_name: '',
    owner_username: '',
    owner_password: '',
    owner_email: '',
    owner_phone: ''
  });

  if (!show) return null;

  // Auto-generate slug & username on typing business name
  const handleNameChange = (e) => {
    const val = e.target.value;
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const autoUser = val.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin';

    setFormData(prev => ({
      ...prev,
      name: val,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
      owner_username: prev.owner_username === '' ? autoUser : prev.owner_username
    }));
  };

  // Resolve service model when business type changes
  const handleBusinessTypeChange = (bType) => {
    const sModel = resolveServiceModelForBusinessType ? resolveServiceModelForBusinessType(bType) : 'dine_in';
    setFormData(prev => ({
      ...prev,
      business_type: bType,
      service_model: sModel
    }));
  };

  // Step 1 validation
  const isStep1Valid = Boolean(
    formData.name.trim() && 
    formData.business_type && 
    formData.slug.trim()
  );

  // Step 4 validation
  const isStep4Valid = Boolean(
    formData.owner_username.trim() && 
    formData.owner_password.length >= 4
  );

  // Authoritative catalog plan resolution
  const activePlansCatalog = plansList.length > 0 ? plansList : Object.values(SAAS_PLANS);
  const selectedPlanDetails = activePlansCatalog.find(p => p.key === formData.plan_tier || p.id === formData.plan_tier) || getPlanDetails(formData.plan_tier);
  const authoritativePrice = selectedPlanDetails ? Number(selectedPlanDetails.price) : 999;

  // Launch Cashfree SDK Subscription Checkout
  const launchCashfreeCheckout = async (checkoutData) => {
    const sessionId = checkoutData.subscription_session_id;

    // Ensure Cashfree SDK is loaded
    let cfInstance = window.Cashfree;
    if (!cfInstance) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
      cfInstance = window.Cashfree;
    }

    if (sessionId && typeof cfInstance === 'function') {
      const cashfree = cfInstance({ mode: checkoutData.environment || 'sandbox' });
      if (typeof cashfree.subscriptionsCheckout === 'function') {
        cashfree.subscriptionsCheckout({
          subsSessionId: sessionId,
          subscriptionSessionId: sessionId,
          redirectTarget: '_self'
        });
        return;
      } else if (typeof cashfree.checkout === 'function') {
        cashfree.checkout({
          subsSessionId: sessionId,
          subscriptionSessionId: sessionId,
          redirectTarget: '_self'
        });
        return;
      }
    }

    if (checkoutData.auth_url) {
      window.location.href = checkoutData.auth_url;
      return;
    }

    throw new Error('Cashfree payment SDK unavailable. Please refresh and try again.');
  };

  // Final Tenant Creation Handler (Executes ONLY on Step 5 confirmation)
  const handleFinalSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      // 1. PAID OR 16-DAY TRIAL PATH -> Cashfree Sandbox Checkout Session
      if (formData.onboarding_mode === 'active' || formData.onboarding_mode === 'trial') {
        const checkoutPayload = {
          name: formData.name.trim(),
          slug: formData.slug.trim().toLowerCase(),
          owner_name: formData.owner_name.trim(),
          owner_username: formData.owner_username.trim(),
          owner_password: formData.owner_password,
          phone: formData.phone || formData.owner_phone || '',
          whatsapp_number: formData.whatsapp_number || formData.phone || '',
          address: [formData.address, formData.city, formData.state, formData.pincode].filter(Boolean).join(', '),
          tagline: formData.tagline || '100% Quality Food & Customer Service',
          plan_tier: formData.plan_tier,
          theme_color: formData.theme_color || 'gold',
          business_type: formData.business_type,
          service_model: formData.service_model,
          owner_email: formData.email || formData.owner_email || '',
          gstin_number: formData.is_gst_applicable ? formData.gstin : '',
          onboarding_mode: formData.onboarding_mode
        };

        const res = await createSuperAdminBusinessCheckout(checkoutPayload, token);
        setCheckoutState({ status: 'launching', data: res });
        
        await launchCashfreeCheckout(res);
        return;
      }

      // 2. VIP ONBOARDING PATH -> Instant Transactional Creation
      const expiryDate = new Date('2099-12-31T23:59:59Z').toISOString();

      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        owner_username: formData.owner_username.trim(),
        owner_password: formData.owner_password,
        phone: formData.phone || formData.owner_phone || '',
        whatsapp_number: formData.whatsapp_number || formData.phone || '',
        address: [formData.address, formData.city, formData.state, formData.pincode].filter(Boolean).join(', '),
        tagline: formData.tagline || '100% Quality Food & Customer Service',
        plan_tier: formData.plan_tier,
        plan_price: 0,
        plan_expires_at: expiryDate,
        theme_color: formData.theme_color || 'gold',
        business_type: formData.business_type,
        service_model: formData.service_model,
        business_category: formData.service_model,
        owner_email: formData.email || formData.owner_email || '',
        gstin_number: formData.is_gst_applicable ? formData.gstin : '',
        onboarding_mode: formData.onboarding_mode
      };

      await createTenantRestaurant(payload, token);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create and activate business tenant');
      setCheckoutState(null);
    } finally {
      setSubmitting(false);
    }
  };

  const stepsMeta = [
    { num: 1, label: 'Business Info', icon: Building2 },
    { num: 2, label: 'Documents & KYC', icon: FileText },
    { num: 3, label: 'Plan & Billing', icon: CreditCard },
    { num: 4, label: 'Admin Account', icon: UserCheck },
    { num: 5, label: 'Review & Confirm', icon: CheckCircle2 }
  ];

  const currentMeta = stepsMeta.find(s => s.num === currentStep) || stepsMeta[0];

  return (
    <div 
      className="sa-modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5, 20, 11, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={onClose}
    >
      <style>{`
        .add-biz-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .add-biz-stepper-label {
          display: block;
        }
        .add-biz-mobile-step-banner {
          display: none;
        }
        .add-biz-footer-btns {
          display: flex;
          gap: 10px;
        }
        @media (max-width: 767px) {
          .add-biz-grid-2 {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .add-biz-stepper-label {
            display: none !important;
          }
          .add-biz-mobile-step-banner {
            display: flex !important;
          }
          .add-biz-body-pad {
            padding: 16px 14px !important;
          }
          .add-biz-head-pad {
            padding: 14px 14px 10px !important;
          }
          .add-biz-foot-pad {
            padding: 12px 14px !important;
            flex-direction: column-reverse !important;
            gap: 10px !important;
          }
          .add-biz-footer-btns {
            width: 100% !important;
            display: flex !important;
            gap: 8px !important;
          }
          .add-biz-footer-btns > button {
            flex: 1 !important;
          }
          .add-biz-cancel-btn {
            width: 100% !important;
          }
        }
      `}</style>

      <div 
        className="sa-modal-box"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          maxWidth: '680px',
          width: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.45)',
          border: '1.5px solid #D4AF37',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header with Title & Stepper Progress */}
        <div className="add-biz-head-pad" style={{
          padding: '18px 22px 14px',
          background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
          color: '#FFFFFF',
          borderBottom: '1.5px solid #D4AF37',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.2)', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Store size={19} color="#DFBA67" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 900, color: '#DFBA67', margin: 0, lineHeight: 1.2 }}>
                  Add New Business
                </h3>
                <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Multi-step tenant setup & Cashfree billing
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginTop: '6px' }}>
            {stepsMeta.map((s) => {
              const Icon = s.icon;
              const isDone = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div 
                  key={s.num} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    flex: 1, 
                    cursor: isDone ? 'pointer' : 'default',
                    opacity: isCurrent || isDone ? 1 : 0.45,
                    padding: '0 2px'
                  }}
                  onClick={() => { if (isDone && !checkoutState) setCurrentStep(s.num); }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isDone ? '#10B981' : isCurrent ? '#D4AF37' : '#334155',
                    color: isDone || isCurrent ? '#0A2315' : '#94A3B8',
                    fontWeight: 900,
                    fontSize: '0.74rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '2px',
                    boxShadow: isCurrent ? '0 0 10px rgba(212, 175, 55, 0.5)' : 'none'
                  }}>
                    {isDone ? '✓' : <Icon size={13} />}
                  </div>
                  <span className="add-biz-stepper-label" style={{ fontSize: '0.64rem', fontWeight: 800, color: isCurrent ? '#DFBA67' : '#E2E8F0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile-Only Active Step Pill Indicator */}
          <div className="add-biz-mobile-step-banner" style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '8px',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#DFBA67'
          }}>
            <span>Step {currentStep} of 5:</span>
            <span style={{ color: '#FFFFFF' }}>{currentMeta.label}</span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="add-biz-body-pad" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626',
              padding: '10px 12px', borderRadius: '10px', fontSize: '0.80rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* DEDICATED CASHFREE CHECKOUT LAUNCH SCREEN */}
          {checkoutState && (
            <div style={{
              background: '#F8FAFC',
              border: '2px solid #D4AF37',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#FEFCE8', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={24} className="spin" color="#B45309" />
              </div>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>
                  Secure Cashfree Sandbox Checkout
                </h4>
                <p style={{ fontSize: '0.80rem', color: '#64748B', margin: 0 }}>
                  Connecting to Cashfree recurring mandate gateway...
                </p>
              </div>

              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', width: '100%', maxWidth: '340px', textAlign: 'left', fontSize: '0.80rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Business:</span>
                  <strong>{formData.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Plan:</span>
                  <strong>{selectedPlanDetails?.name || formData.plan_tier}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Amount:</span>
                  <strong style={{ color: '#B45309', fontSize: '0.90rem' }}>₹{authoritativePrice} / month</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Gateway:</span>
                  <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.72rem' }}>
                    Cashfree Sandbox
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                ⚠️ Do not close or refresh the onboarding wizard during mandate authorization.
              </div>

              {checkoutState.data?.auth_url && (
                <button
                  type="button"
                  onClick={() => launchCashfreeCheckout(checkoutState.data)}
                  className="sa-btn sa-btn-accent"
                  style={{ minHeight: '44px', width: '100%', maxWidth: '340px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span>Continue to Cashfree</span> <ExternalLink size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setCheckoutState(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancel Checkout & Back to Form
              </button>
            </div>
          )}

          {/* STEP 1: BUSINESS INFORMATION */}
          {!checkoutState && currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  BUSINESS NAME <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Pizza & Cafe"
                  value={formData.name}
                  onChange={handleNameChange}
                  style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  BUSINESS TYPE <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={formData.business_type}
                  onChange={e => handleBusinessTypeChange(e.target.value)}
                  style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }}
                >
                  {BUSINESS_TYPES.map(type => (
                    <option key={type} value={type}>
                      {BUSINESS_TYPE_METADATA[type]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[type]?.label || type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  CANONICAL SERVICE MODEL
                </label>
                <div style={{
                  width: '100%',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  boxSizing: 'border-box',
                  lineHeight: 1.4
                }}>
                  {formData.service_model === 'hotel' && '🏨 Hotel & Room Dining (Cabins / Rooms)'}
                  {formData.service_model === 'cinema' && '🎬 Cinema & Screen Dining (Screens / Rows / Seats)'}
                  {formData.service_model === 'dine_in' && '🍽️ Dine-In Table Ordering (Standard Tables)'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  URL SLUG <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. royal-pizza"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 800, color: '#B45309', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div className="add-biz-grid-2">
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    BUSINESS PHONE / WHATSAPP
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value, whatsapp_number: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    BUSINESS EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="contact@business.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  BUSINESS ADDRESS
                </label>
                <input
                  type="text"
                  placeholder="Street address, city, landmark"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', lineHeight: 1.4 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_gst_applicable}
                    onChange={e => setFormData({ ...formData, is_gst_applicable: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }}
                  />
                  <span>
                    GST APPLICABLE <span style={{ color: '#64748B', fontWeight: 700 }}>(5% Restaurant / Service GST)</span>
                  </span>
                </label>
                {formData.is_gst_applicable && (
                  <input
                    type="text"
                    placeholder="Enter 15-digit GSTIN (e.g. 07AAAAA0000A1Z5)"
                    value={formData.gstin}
                    onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    style={{ width: '100%', minHeight: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #D4AF37', fontSize: '0.84rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box', marginTop: '8px' }}
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  DEFAULT LUXURY THEME
                </label>
                <select
                  value={formData.theme_color}
                  onChange={e => setFormData({ ...formData, theme_color: e.target.value })}
                  style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', fontWeight: 700, outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }}
                >
                  <option value="gold">👑 Gold & Forest Green (Signature)</option>
                  <option value="emerald">💎 Emerald Mint & Teal</option>
                  <option value="crimson">🍷 Ruby Crimson & Amber</option>
                  <option value="navy">🌌 Midnight Navy & Sapphire</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: DOCUMENTS / KYC */}
          {!checkoutState && currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                <div style={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <ShieldCheck size={16} color="#15803D" /> Verification & KYC Registry
                </div>
                Business documents are stored securely with tenant isolation. Sandbox onboarding allows optional document verification during tenant provisioning.
              </div>

              <div className="add-biz-grid-2">
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    BUSINESS PAN NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABCDE1234F"
                    value={formData.pan_number}
                    onChange={e => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    TRADE LICENSE / FSSAI NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10020042000123"
                    value={formData.trade_license_number}
                    onChange={e => setFormData({ ...formData, trade_license_number: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="add-biz-grid-2">
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    GST CERTIFICATE REFERENCE
                  </label>
                  <input
                    type="text"
                    placeholder="Doc Ref / Certificate Number"
                    value={formData.gst_cert_ref}
                    onChange={e => setFormData({ ...formData, gst_cert_ref: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    OWNER ID PROOF (AADHAAR / PASSPORT)
                  </label>
                  <input
                    type="text"
                    placeholder="ID Reference Number"
                    value={formData.owner_id_ref}
                    onChange={e => setFormData({ ...formData, owner_id_ref: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PLAN & BILLING */}
          {!checkoutState && currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                SELECT SAAS SUBSCRIPTION PLAN (CATALOG-BACKED)
              </div>

              {/* Plan Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {activePlansCatalog.map(p => {
                  const isSelected = (formData.plan_tier === (p.key || p.id));
                  return (
                    <div
                      key={p.key || p.id}
                      onClick={() => setFormData({ ...formData, plan_tier: p.key || p.id })}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #D4AF37' : '1.5px solid #E2E8F0',
                        background: isSelected ? 'rgba(212, 175, 55, 0.08)' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A', marginBottom: '2px' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#D4AF37', marginBottom: '4px' }}>
                        ₹{Number(p.price).toLocaleString('en-IN')}<span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>/mo</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.2 }}>
                        {p.key === 'basic' && 'Essential Menu & QR'}
                        {p.key === 'pro' && 'KDS + GST Invoicing'}
                        {p.key === 'enterprise' && 'Multi-Outlet + Priority'}
                        {p.key === 'vip_ultra_plan' && 'Full Luxury Suite'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Onboarding Mode Selection */}
              <div style={{ marginTop: '6px' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  ONBOARDING & PROVISIONING MODE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'active' })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: formData.onboarding_mode === 'active' ? '2px solid #10B981' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'active' ? '#ECFDF5' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#065F46' }}>💳 Paid Cashfree Mandate</div>
                    <div style={{ fontSize: '0.66rem', color: '#047857', marginTop: '2px' }}>₹{authoritativePrice}/mo • Checkout Flow</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'trial' })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: formData.onboarding_mode === 'trial' ? '2px solid #3B82F6' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'trial' ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#1E40AF' }}>🎁 16-Day Free Trial</div>
                    <div style={{ fontSize: '0.66rem', color: '#2563EB', marginTop: '2px' }}>₹0 Due • Cashfree AutoPay Setup</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'vip' })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: formData.onboarding_mode === 'vip' ? '2px solid #D4AF37' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'vip' ? '#FEFCE8' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#854D0E' }}>👑 VIP Granted</div>
                    <div style={{ fontSize: '0.66rem', color: '#A16207', marginTop: '2px' }}>₹0 Due • Lifetime SuperAdmin Grant</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: OWNER / ADMIN ACCOUNT */}
          {!checkoutState && currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="add-biz-grid-2">
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    PRIMARY OWNER FULL NAME
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.owner_name}
                    onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    ADMIN USERNAME <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. royal_pizza_admin"
                    value={formData.owner_username}
                    onChange={e => setFormData({ ...formData, owner_username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  ADMIN INITIAL PASSWORD <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={17} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter secure initial password (min 4 chars)"
                    value={formData.owner_password}
                    onChange={e => setFormData({ ...formData, owner_password: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 42px 10px 44px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px' }}>
                  🔒 Encrypted with 10 rounds of bcrypt prior to database storage.
                </div>
              </div>

              <div className="add-biz-grid-2">
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    OWNER RECOVERY PHONE
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.owner_phone || formData.phone}
                    onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    OWNER RECOVERY EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="owner@business.com"
                    value={formData.owner_email || formData.email}
                    onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CONFIRM */}
          {!checkoutState && currentStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span>🏢 Business & Taxonomy</span>
                  <span style={{ color: '#B45309' }}>/r/{formData.slug}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '0.76rem' }}>
                  <div><strong>Name:</strong> {formData.name}</div>
                  <div><strong>Type:</strong> {BUSINESS_TYPE_METADATA[formData.business_type]?.label || formData.business_type}</div>
                  <div><strong>Service Model:</strong> {formData.service_model}</div>
                  <div><strong>Phone:</strong> {formData.phone || 'N/A'}</div>
                  <div><strong>GSTIN:</strong> {formData.is_gst_applicable ? (formData.gstin || 'Pending') : 'N/A'}</div>
                  <div><strong>Theme:</strong> {formData.theme_color}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span>💳 Plan & Provisioning Mode</span>
                  <span style={{ fontWeight: 900, color: formData.onboarding_mode === 'active' ? '#B45309' : '#059669' }}>
                    {formData.onboarding_mode === 'trial' ? 'FREE TRIAL (₹0)' : formData.onboarding_mode === 'vip' ? 'VIP GRANTED (₹0)' : `₹${authoritativePrice}/mo (CASHFREE)`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '0.76rem' }}>
                  <div><strong>Plan Tier:</strong> {selectedPlanDetails?.name || formData.plan_tier}</div>
                  <div><strong>Catalog Price:</strong> ₹{authoritativePrice} / month</div>
                  <div><strong>Mode:</strong> {formData.onboarding_mode === 'active' ? 'PAID CASHFREE MANDATE' : formData.onboarding_mode.toUpperCase()}</div>
                  <div><strong>Gateway:</strong> {formData.onboarding_mode === 'active' ? 'Cashfree Sandbox' : 'None (SuperAdmin Grant)'}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px' }}>
                  👤 Admin Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '0.76rem' }}>
                  <div><strong>Admin Username:</strong> <code style={{ color: '#0F172A', fontWeight: 800 }}>{formData.owner_username}</code></div>
                  <div><strong>Password:</strong> •••••••••••• (Encrypted)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        {!checkoutState && (
          <div className="add-biz-foot-pad" style={{
            padding: '14px 22px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={submitting}
                className="sa-btn sa-btn-secondary add-biz-cancel-btn"
                style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800 }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="sa-btn sa-btn-secondary add-biz-cancel-btn"
                style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Cancel
              </button>
            )}

            <div className="add-biz-footer-btns">
              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1 && !isStep1Valid) return;
                    if (currentStep === 4 && !isStep4Valid) return;
                    setCurrentStep(prev => Math.min(5, prev + 1));
                  }}
                  disabled={(currentStep === 1 && !isStep1Valid) || (currentStep === 4 && !isStep4Valid)}
                  className="sa-btn sa-btn-accent"
                  style={{
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 900,
                    opacity: ((currentStep === 1 && !isStep1Valid) || (currentStep === 4 && !isStep4Valid)) ? 0.5 : 1,
                    cursor: ((currentStep === 1 && !isStep1Valid) || (currentStep === 4 && !isStep4Valid)) ? 'not-allowed' : 'pointer',
                    padding: '10px 20px'
                  }}
                >
                  {currentStep === 4 ? 'Review Business' : 'Continue'} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="sa-btn sa-btn-accent"
                  style={{
                    minHeight: '44px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    boxShadow: '0 4px 16px rgba(212, 175, 55, 0.4)'
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>Processing...</span>
                    </>
                  ) : formData.onboarding_mode === 'trial' ? (
                    <>
                      <Gift size={16} />
                      <span>🎁 Setup 16-Day Trial Mandate (₹0 Today)</span>
                    </>
                  ) : formData.onboarding_mode === 'vip' ? (
                    <>
                      <Crown size={16} />
                      <span>👑 Create VIP Tenant Business</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>💳 Proceed to Cashfree Payment</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
