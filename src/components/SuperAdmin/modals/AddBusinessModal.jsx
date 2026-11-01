import React, { useState, useMemo } from 'react';
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
  CheckCircle,
  Copy,
  Check,
  Share2,
  KeyRound,
  MessageSquare
} from 'lucide-react';
import { 
  BUSINESS_TYPES, 
  BUSINESS_TYPE_METADATA, 
  resolveServiceModelForBusinessType 
} from '../../../utils/businessTaxonomy';
import { SAAS_PLANS, getPlanDetails } from '../../../config/plans';
import { 
  createSuperAdminBusinessCheckout,
  createTenantRestaurant as apiCreateTenantRestaurant 
} from '../../../api/client';

export default function AddBusinessModal({ 
  show, 
  onClose, 
  onSuccess, 
  plansList = [], 
  token, 
  createTenantRestaurant = apiCreateTenantRestaurant,
  defaultTrialDays = 16
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkoutState, setCheckoutState] = useState(null); // null | { status: 'launching' | 'launched' | 'failed', data }
  const [createdSuccessData, setCreatedSuccessData] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  // Comprehensive Form State across all 5 steps
  const [formData, setFormData] = useState({
    // Step 1: Business Information
    name: '',
    business_type: 'restaurant',
    service_model: 'dine_in',
    total_tables: 20,
    total_rooms: 20,
    total_seats: 150,
    total_screens: 3,
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

    // Step 2: Documents / KYC (Optional)
    pan_number: '',
    trade_license_number: '',
    gst_cert_ref: '',
    owner_id_ref: '',

    // Step 3: Plan & Billing
    plan_tier: 'pro',
    billing_cycle: 'monthly',
    onboarding_mode: 'trial', // 'trial' (Instant Free Trial) | 'vip' | 'cashfree_paid' | 'cashfree_trial'
    plan_price: 999,
    trial_days: defaultTrialDays || 16,
    vip_duration_days: 'lifetime',
    vip_valid_until: '',

    // Step 4: Owner / Admin Account
    owner_name: '',
    owner_username: '',
    owner_password: '',
    owner_email: '',
    owner_phone: ''
  });

  // Effective Super Admin Token with resilient fallbacks
  const getEffectiveToken = () => {
    return token || (typeof window !== 'undefined' ? (localStorage.getItem('touchqr_superadmin_token') || localStorage.getItem('token')) : null);
  };

  // Reset form completely
  const handleResetForm = () => {
    setCurrentStep(1);
    setShowPassword(false);
    setSubmitting(false);
    setError('');
    setCheckoutState(null);
    setCreatedSuccessData(null);
    setCopiedField('');
    setFormData({
      name: '',
      business_type: 'restaurant',
      service_model: 'dine_in',
      total_tables: 20,
      total_rooms: 20,
      total_seats: 150,
      total_screens: 3,
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
      pan_number: '',
      trade_license_number: '',
      gst_cert_ref: '',
      owner_id_ref: '',
      plan_tier: 'pro',
      billing_cycle: 'monthly',
      onboarding_mode: 'trial',
      plan_price: 999,
      trial_days: defaultTrialDays || 16,
      vip_duration_days: 'lifetime',
      vip_valid_until: '',
      owner_name: '',
      owner_username: '',
      owner_password: '',
      owner_email: '',
      owner_phone: ''
    });
  };

  const handleModalClose = () => {
    handleResetForm();
    onClose();
  };

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

  // Resolve service model and matching plan when business type changes
  const handleBusinessTypeChange = (bType) => {
    const sModel = resolveServiceModelForBusinessType ? resolveServiceModelForBusinessType(bType) : 'dine_in';
    const isHotel = sModel === 'hotel' || bType === 'hotel_resort';
    const isCinema = sModel === 'cinema' || bType === 'cinema_theatre';
    const nextIndustry = isHotel ? 'hotel' : (isCinema ? 'cinema' : 'restaurant');
    const nextPlan = nextIndustry === 'hotel' ? 'hotel_pro' : (nextIndustry === 'cinema' ? 'cinema_pro' : 'pro');

    setFormData(prev => ({
      ...prev,
      business_type: bType,
      service_model: sModel,
      plan_tier: nextPlan
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

  // Authoritative catalog plan resolution dynamically filtered by selected industry
  const targetIndustry = (formData.service_model === 'hotel' || formData.business_type === 'hotel_resort')
    ? 'hotel'
    : (formData.service_model === 'cinema' || formData.business_type === 'cinema_theatre')
      ? 'cinema'
      : 'restaurant';

  const rawPlansCatalog = plansList.length > 0 ? plansList : Object.values(SAAS_PLANS);
  const activePlansCatalog = useMemo(() => {
    const filtered = rawPlansCatalog.filter(p => {
      const pInd = (p.industry || 'restaurant').toLowerCase();
      const pKey = (p.key || p.id || '').toLowerCase();
      return pInd === targetIndustry || pKey.startsWith(targetIndustry);
    });
    const fallbackPlans = Object.values(SAAS_PLANS).filter(p => (p.industry || 'restaurant') === targetIndustry || p.key.startsWith(targetIndustry));
    return filtered.length > 0 ? filtered : (fallbackPlans.length > 0 ? fallbackPlans : rawPlansCatalog.filter(p => ['basic', 'pro', 'enterprise'].includes(p.key)));
  }, [rawPlansCatalog, targetIndustry]);

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
      const authToken = getEffectiveToken();

      // 1. CASHFREE CHECKOUT PATH -> Only if user explicitly selected Cashfree Mandate
      if (formData.onboarding_mode === 'cashfree_paid' || formData.onboarding_mode === 'cashfree_trial' || formData.onboarding_mode === 'active') {
        const checkoutPayload = {
          name: formData.name.trim(),
          slug: formData.slug.trim().toLowerCase(),
          owner_name: (formData.owner_name || '').trim(),
          owner_username: formData.owner_username.trim(),
          owner_password: formData.owner_password,
          phone: formData.phone || formData.owner_phone || '',
          whatsapp_number: formData.whatsapp_number || formData.phone || '',
          address: [formData.address, formData.city, formData.state, formData.pincode].filter(Boolean).join(', '),
          city: formData.city || '',
          state: formData.state || '',
          pincode: formData.pincode || '',
          tagline: formData.tagline || '100% Quality Food & Customer Service',
          plan_tier: formData.plan_tier,
          theme_color: formData.theme_color || 'gold',
          business_type: formData.business_type,
          service_model: formData.service_model,
          owner_email: formData.email || formData.owner_email || '',
          gstin_number: formData.is_gst_applicable ? formData.gstin : '',
          onboarding_mode: (formData.onboarding_mode === 'cashfree_trial' ? 'trial' : 'active'),
          trial_days: formData.trial_days || defaultTrialDays || 16,
          total_tables: Number(formData.total_tables || 0),
          total_rooms: Number(formData.total_rooms || 0),
          total_seats: Number(formData.total_seats || 0),
          total_screens: Number(formData.total_screens || 0)
        };

        const res = await createSuperAdminBusinessCheckout(checkoutPayload, authToken);
        setCheckoutState({ status: 'launching', data: res });
        
        await launchCashfreeCheckout(res);
        return;
      }

      // 2. DIRECT PROVISIONING PATH (Instant Free Trial or VIP Complimentary)
      let expiryDate = null;
      if (formData.onboarding_mode === 'trial') {
        const tDays = parseInt(formData.trial_days || defaultTrialDays || 16, 10);
        expiryDate = new Date(Date.now() + (tDays > 0 ? tDays : 16) * 86400 * 1000).toISOString();
      } else if (formData.onboarding_mode === 'vip') {
        if (formData.vip_duration_days === 'custom') {
          if (!formData.vip_valid_until) {
            throw new Error('Please select an expiry date for custom VIP duration.');
          }
          const dateParts = String(formData.vip_valid_until).split('-');
          let customDate;
          if (dateParts.length === 3) {
            const [y, m, d] = dateParts.map(Number);
            customDate = new Date(y, m - 1, d, 23, 59, 59, 999);
          } else {
            customDate = new Date(formData.vip_valid_until);
            customDate.setHours(23, 59, 59, 999);
          }
          if (isNaN(customDate.getTime()) || customDate.getTime() <= Date.now()) {
            throw new Error('Custom VIP expiry date must be in the future.');
          }
          expiryDate = customDate.toISOString();
        } else if (formData.vip_duration_days && formData.vip_duration_days !== 'lifetime') {
          const days = parseInt(formData.vip_duration_days, 10);
          if (!isNaN(days) && days > 0) {
            expiryDate = new Date(Date.now() + days * 86400 * 1000).toISOString();
          }
        }
      }

      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        owner_name: (formData.owner_name || '').trim(),
        owner_username: formData.owner_username.trim(),
        owner_password: formData.owner_password,
        phone: formData.phone || formData.owner_phone || '',
        whatsapp_number: formData.whatsapp_number || formData.phone || '',
        address: [formData.address, formData.city, formData.state, formData.pincode].filter(Boolean).join(', '),
        city: formData.city || '',
        state: formData.state || '',
        pincode: formData.pincode || '',
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
        onboarding_mode: formData.onboarding_mode,
        trial_days: formData.trial_days || defaultTrialDays || 16,
        total_tables: Number(formData.total_tables || 0),
        total_rooms: Number(formData.total_rooms || 0),
        total_seats: Number(formData.total_seats || 0),
        total_screens: Number(formData.total_screens || 0),
        trade_license_number: formData.trade_license_number || '',
        fssai_lic_no: formData.trade_license_number || ''
      };

      const result = await createTenantRestaurant(payload, authToken);
      
      // Notify parent to refresh tenants
      if (onSuccess) onSuccess(result);

      // Present Celebration & Credentials Distribution Screen
      setCreatedSuccessData({
        ...result,
        name: formData.name,
        slug: formData.slug.trim().toLowerCase(),
        owner_name: formData.owner_name,
        owner_username: formData.owner_username,
        owner_password: formData.owner_password,
        plan_tier: formData.plan_tier,
        service_model: formData.service_model,
        mode: formData.onboarding_mode,
        trial_days: formData.trial_days || defaultTrialDays || 16,
        expiryDate
      });
    } catch (err) {
      setError(err.message || 'Failed to create and activate business tenant');
      setCheckoutState(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Copy helper
  const handleCopyText = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  // Generate complete welcome message for WhatsApp / Email
  const generateWelcomeMessage = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://touchqr.com';
    const cleanSlug = createdSuccessData?.slug || formData.slug.trim().toLowerCase();
    const storeUrl = `${origin}/r/${cleanSlug}`;
    const adminUrl = `${origin}/admin/login?slug=${cleanSlug}`;
    const bName = createdSuccessData?.name || formData.name;
    const uName = createdSuccessData?.owner_username || formData.owner_username;
    const pWord = createdSuccessData?.owner_password || formData.owner_password;

    return `🎉 *Welcome to TouchQR!*
Your digital business platform has been provisioned and is ready for live operations:

🏢 *Business Name:* ${bName}
🌐 *Live Digital Menu:* ${storeUrl}
🔑 *Admin Portal:* ${adminUrl}

👤 *Username:* ${uName}
🔒 *Password:* ${pWord}

📲 You can log in right away, customize your menu items, print luxury QR standees, and receive instant customer orders.
Need assistance? Reply directly to this message.`;
  };

  // 1-Click WhatsApp share to business owner
  const handleShareWhatsApp = () => {
    const rawPhone = (formData.phone || formData.whatsapp_number || formData.owner_phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const message = encodeURIComponent(generateWelcomeMessage());
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const stepsMeta = [
    { num: 1, label: 'Business Info', icon: Building2 },
    { num: 2, label: 'Documents & KYC', icon: FileText },
    { num: 3, label: 'Plan & Provisioning', icon: CreditCard },
    { num: 4, label: 'Admin Account', icon: UserCheck },
    { num: 5, label: 'Review & Launch', icon: CheckCircle2 }
  ];

  const currentMeta = stepsMeta.find(s => s.num === currentStep) || stepsMeta[0];

  if (!show) return null;

  return (
    <div 
      className="sa-modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5, 20, 11, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={handleModalClose}
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
        .add-biz-chip-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #CBD5E1;
          background: #FFFFFF;
          font-size: 0.72rem;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .add-biz-chip-btn.active {
          background: #1E40AF;
          color: #FFFFFF;
          border-color: #1E40AF;
        }
        @media (max-width: 767px) {
          .add-biz-grid-2 {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
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
          maxWidth: '700px',
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
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.2)', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Store size={20} color="#DFBA67" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.12rem', fontWeight: 900, color: '#DFBA67', margin: 0, lineHeight: 1.2 }}>
                  Add New Business Tenant
                </h3>
                <p style={{ fontSize: '0.74rem', color: '#CBD5E1', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {createdSuccessData ? 'Tenant provisioned successfully' : 'Instant 16-Day Trial, VIP, or Cashfree Mandate Onboarding'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              aria-label="Close modal"
              style={{ background: 'rgba(255,255,255,0.12)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Stepper Progress Bar (Hidden on Success Card) */}
          {!createdSuccessData && (
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
          )}

          {/* Mobile-Only Active Step Pill Indicator */}
          {!createdSuccessData && (
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
          )}
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

          {/* CELEBRATION & CREDENTIALS SUCCESS SCREEN */}
          {createdSuccessData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                border: '2px solid #10B981',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FFFFFF', border: '2.5px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
                  <CheckCircle size={32} color="#059669" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.18rem', fontWeight: 900, color: '#064E3B', margin: '0 0 4px' }}>
                    🎉 {createdSuccessData.name} is Provisioned!
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#047857', margin: 0 }}>
                    {createdSuccessData.mode === 'vip' 
                      ? 'Complimentary VIP Access has been successfully granted.' 
                      : `Instant ${createdSuccessData.trial_days}-Day Free Trial is live with 100% database isolation.`}
                  </p>
                </div>
              </div>

              {/* Public Store & Live Menu Link Card */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🌐 LIVE DIGITAL MENU URL
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${createdSuccessData.slug}`, 'url')}
                    style={{ background: 'none', border: 'none', color: copiedField === 'url' ? '#10B981' : '#B45309', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedField === 'url' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '10px 14px' }}>
                  <span style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', wordBreak: 'break-all' }}>
                    /r/{createdSuccessData.slug}
                  </span>
                  <a
                    href={`/r/${createdSuccessData.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sa-btn sa-btn-accent"
                    style={{ minHeight: '34px', padding: '6px 14px', fontSize: '0.76rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', flexShrink: 0, marginLeft: '8px' }}
                  >
                    <span>Open Menu</span> <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Admin Portal Credentials Card */}
              <div style={{ background: '#FEFCE8', border: '1.5px solid #FEF08A', borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#854D0E', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <KeyRound size={15} color="#B45309" /> ADMIN PORTAL CREDENTIALS
                  </span>
                  <a
                    href={`/admin/login?slug=${createdSuccessData.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.74rem', fontWeight: 800, color: '#B45309', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Open Admin Login</span> <ExternalLink size={13} />
                  </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #FDE047', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#713F12', fontWeight: 700, marginBottom: '2px' }}>ADMIN USERNAME</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{createdSuccessData.owner_username}</strong>
                      <button
                        type="button"
                        onClick={() => handleCopyText(createdSuccessData.owner_username, 'username')}
                        style={{ background: 'none', border: 'none', color: copiedField === 'username' ? '#10B981' : '#64748B', cursor: 'pointer', padding: '2px' }}
                        title="Copy Username"
                      >
                        {copiedField === 'username' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #FDE047', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#713F12', fontWeight: 700, marginBottom: '2px' }}>INITIAL PASSWORD</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0F172A', fontFamily: showPassword ? 'inherit' : 'monospace' }}>
                        {showPassword ? createdSuccessData.owner_password : '••••••••'}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px' }}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(createdSuccessData.owner_password, 'password')}
                          style={{ background: 'none', border: 'none', color: copiedField === 'password' ? '#10B981' : '#64748B', cursor: 'pointer', padding: '2px' }}
                          title="Copy Password"
                        >
                          {copiedField === 'password' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: WhatsApp Share & Copy Welcome Pack */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  style={{
                    flex: '1 1 180px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    background: '#15803D',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 900,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(21, 128, 61, 0.3)'
                  }}
                >
                  <MessageSquare size={17} />
                  <span>Send on WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyText(generateWelcomeMessage(), 'pack')}
                  className="sa-btn sa-btn-secondary"
                  style={{
                    flex: '1 1 180px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 800,
                    fontSize: '0.84rem'
                  }}
                >
                  {copiedField === 'pack' ? (
                    <>
                      <Check size={17} color="#10B981" />
                      <span style={{ color: '#10B981' }}>Welcome Pack Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={17} />
                      <span>Copy Welcome Pack</span>
                    </>
                  )}
                </button>
              </div>

              {/* Success Modal Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '14px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="sa-btn sa-btn-secondary"
                  style={{ minHeight: '40px', fontWeight: 800, fontSize: '0.80rem' }}
                >
                  + Add Another Business
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="sa-btn sa-btn-accent"
                  style={{ minHeight: '40px', fontWeight: 900, padding: '0 24px', fontSize: '0.84rem' }}
                >
                  Done (Close)
                </button>
              </div>
            </div>
          )}

          {/* DEDICATED CASHFREE CHECKOUT LAUNCH SCREEN */}
          {!createdSuccessData && checkoutState && (
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
          {!createdSuccessData && !checkoutState && currentStep === 1 && (
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

              {/* Dynamic Industry Capacity Setup */}
              {formData.service_model === 'cinema' || formData.business_type === 'cinema_theatre' ? (
                <div className="add-biz-grid-2">
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      AUDITORIUM SCREENS
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.total_screens}
                      onChange={e => setFormData({ ...formData, total_screens: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      AUDITORIUM SEATS
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={formData.total_seats}
                      onChange={e => setFormData({ ...formData, total_seats: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              ) : formData.service_model === 'hotel' || formData.business_type === 'hotel_resort' ? (
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    TOTAL GUEST ROOMS / SUITES
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.total_rooms}
                    onChange={e => setFormData({ ...formData, total_rooms: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    TOTAL DINING TABLES
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.total_tables}
                    onChange={e => setFormData({ ...formData, total_tables: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  URL SLUG <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', fontSize: '0.82rem', fontWeight: 800, color: '#94A3B8', pointerEvents: 'none' }}>
                    /r/
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="royal-pizza"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    style={{ width: '100%', minHeight: '44px', padding: '10px 14px 10px 36px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 800, color: '#B45309', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
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
                  placeholder="Street address, landmark"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', minHeight: '44px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>CITY</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: '100%', minHeight: '40px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>STATE</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    style={{ width: '100%', minHeight: '40px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>PINCODE</label>
                  <input
                    type="text"
                    placeholder="e.g. 400001"
                    value={formData.pincode}
                    onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                    style={{ width: '100%', minHeight: '40px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
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
                    GST APPLICABLE <span style={{ color: '#64748B', fontWeight: 700 }}>(5% F&B / Service GST)</span>
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

          {/* STEP 2: DOCUMENTS / KYC (OPTIONAL) */}
          {!createdSuccessData && !checkoutState && currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                <div style={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <ShieldCheck size={16} color="#15803D" /> Optional Verification & KYC Registry
                </div>
                Business documents are stored securely with tenant database isolation. You can leave these blank now and complete verification later from Tenant 360 profile.
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

          {/* STEP 3: PLAN & PROVISIONING MODE */}
          {!createdSuccessData && !checkoutState && currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                SELECT SAAS SUBSCRIPTION PLAN ({targetIndustry.toUpperCase()} CATALOG)
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
                        {p.tagline || (() => {
                          const planKeyStr = String(p.key || p.id || '').toLowerCase();
                          return planKeyStr.includes('basic') ? 'Essential Starter Suite' :
                            planKeyStr.includes('enterprise') ? 'Full Multi-Unit Enterprise' :
                            'Pro Operations & Billing';
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Onboarding Mode Selection */}
              <div style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  ONBOARDING & PROVISIONING MODE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  {/* Mode 1: Instant Free Trial (Recommended) */}
                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'trial' })}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      border: formData.onboarding_mode === 'trial' ? '2.5px solid #2563EB' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'trial' ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.80rem', fontWeight: 900, color: '#1E40AF' }}>🎁 Instant Free Trial</span>
                      {formData.onboarding_mode === 'trial' && <CheckCircle size={15} color="#2563EB" />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#1E3A8A', fontWeight: 700 }}>₹0 Due • Instant Provisioning</div>
                    <div style={{ fontSize: '0.64rem', color: '#64748B', marginTop: '4px', lineHeight: 1.3 }}>
                      Live immediately. No card required. Client subscribes later from admin portal.
                    </div>
                  </div>

                  {/* Mode 2: VIP Access */}
                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'vip' })}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      border: formData.onboarding_mode === 'vip' ? '2.5px solid #D4AF37' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'vip' ? '#FEFCE8' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.80rem', fontWeight: 900, color: '#854D0E' }}>👑 VIP Complimentary</span>
                      {formData.onboarding_mode === 'vip' && <CheckCircle size={15} color="#D4AF37" />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#A16207', fontWeight: 700 }}>
                      ₹0 Due • {formData.vip_duration_days === 'lifetime' || !formData.vip_duration_days ? 'Lifetime' : `${formData.vip_duration_days}-Day`} Access
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#64748B', marginTop: '4px', lineHeight: 1.3 }}>
                      Complimentary grant for partners, flagship demos, or enterprise accounts.
                    </div>
                  </div>

                  {/* Mode 3: Paid Cashfree Mandate */}
                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'cashfree_paid' })}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      border: (formData.onboarding_mode === 'cashfree_paid' || formData.onboarding_mode === 'active') ? '2.5px solid #10B981' : '1.5px solid #CBD5E1',
                      background: (formData.onboarding_mode === 'cashfree_paid' || formData.onboarding_mode === 'active') ? '#ECFDF5' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.80rem', fontWeight: 900, color: '#065F46' }}>💳 Paid Mandate</span>
                      {(formData.onboarding_mode === 'cashfree_paid' || formData.onboarding_mode === 'active') && <CheckCircle size={15} color="#10B981" />}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>₹{authoritativePrice}/mo • Cashfree SDK</div>
                    <div style={{ fontSize: '0.64rem', color: '#64748B', marginTop: '4px', lineHeight: 1.3 }}>
                      Launches Cashfree recurrent billing checkout for instant payment mandate.
                    </div>
                  </div>
                </div>

                {/* Sub-options for Free Trial */}
                {formData.onboarding_mode === 'trial' && (
                  <div style={{ marginTop: '12px', background: '#EFF6FF', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #BFDBFE' }}>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#1E40AF', marginBottom: '6px' }}>
                      🎁 FREE TRIAL DURATION (DAYS):
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={formData.trial_days || defaultTrialDays || 16}
                        onChange={(e) => setFormData({ ...formData, trial_days: e.target.value })}
                        style={{ width: '80px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #93C5FD', fontWeight: 900, fontSize: '0.9rem', color: '#1E3A8A' }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[7, 14, 16, 30].map(d => (
                          <button
                            key={d}
                            type="button"
                            className={`add-biz-chip-btn ${Number(formData.trial_days || defaultTrialDays || 16) === d ? 'active' : ''}`}
                            onClick={() => setFormData({ ...formData, trial_days: d })}
                          >
                            {d} Days
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563EB' }}>
                        • Full access, instant provisioning
                      </span>
                    </div>
                  </div>
                )}

                {/* Sub-options for VIP */}
                {formData.onboarding_mode === 'vip' && (
                  <div style={{ marginTop: '12px', background: '#FEFCE8', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #FEF08A' }}>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#854D0E', marginBottom: '6px' }}>
                      👑 VIP COMPLIMENTARY ACCESS DURATION:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={formData.vip_duration_days || 'lifetime'}
                        onChange={(e) => setFormData({ ...formData, vip_duration_days: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #FDE047', fontWeight: 800, fontSize: '0.85rem', color: '#713F12', background: '#FFFFFF' }}
                      >
                        <option value="lifetime">👑 Lifetime Access</option>
                        <option value="7">7 Days</option>
                        <option value="16">16 Days</option>
                        <option value="30">30 Days (1 Month)</option>
                        <option value="90">90 Days (3 Months)</option>
                        <option value="180">180 Days (6 Months)</option>
                        <option value="365">365 Days (1 Year)</option>
                        <option value="custom">Custom Expiry Date</option>
                      </select>

                      {formData.vip_duration_days === 'custom' && (
                        <input
                          type="date"
                          value={formData.vip_valid_until || ''}
                          onChange={(e) => setFormData({ ...formData, vip_valid_until: e.target.value })}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #FDE047', fontWeight: 700, fontSize: '0.85rem', background: '#FFFFFF' }}
                        />
                      )}

                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#854D0E' }}>
                        ₹0 Customer Charge • Direct SuperAdmin Provisioning
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: OWNER / ADMIN ACCOUNT */}
          {!createdSuccessData && !checkoutState && currentStep === 4 && (
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

          {/* STEP 5: REVIEW & LAUNCH */}
          {!createdSuccessData && !checkoutState && currentStep === 5 && (
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
                  <div><strong>Space Capacity:</strong> {formData.service_model === 'cinema' ? `${formData.total_screens} Screens · ${formData.total_seats} Seats` : formData.service_model === 'hotel' ? `${formData.total_rooms} Rooms` : `${formData.total_tables} Tables`}</div>
                  <div><strong>Phone:</strong> {formData.phone || 'N/A'}</div>
                  <div><strong>Location:</strong> {[formData.city, formData.state].filter(Boolean).join(', ') || 'N/A'}</div>
                  <div><strong>GSTIN:</strong> {formData.is_gst_applicable ? (formData.gstin || 'Pending') : 'N/A'}</div>
                  <div><strong>Theme:</strong> {formData.theme_color}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span>💳 Plan & Provisioning Mode</span>
                  <span style={{ fontWeight: 900, color: (formData.onboarding_mode === 'cashfree_paid' || formData.onboarding_mode === 'active') ? '#B45309' : '#059669' }}>
                    {formData.onboarding_mode === 'trial' ? 'FREE TRIAL (₹0)' : formData.onboarding_mode === 'vip' ? 'VIP GRANTED (₹0)' : `₹${authoritativePrice}/mo (CASHFREE)`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '0.76rem' }}>
                  <div><strong>Plan Tier:</strong> {selectedPlanDetails?.name || formData.plan_tier}</div>
                  <div><strong>Catalog Price:</strong> ₹{authoritativePrice} / month</div>
                  <div><strong>Mode:</strong> {formData.onboarding_mode === 'trial' ? '🎁 INSTANT FREE TRIAL' : formData.onboarding_mode === 'vip' ? '👑 VIP COMPLIMENTARY' : '💳 CASHFREE MANDATE CHECKOUT'}</div>
                  <div><strong>Duration:</strong> {formData.onboarding_mode === 'vip' ? (formData.vip_duration_days === 'custom' ? `Until ${formData.vip_valid_until || 'Custom'}` : (formData.vip_duration_days === 'lifetime' || !formData.vip_duration_days ? '👑 Lifetime Access' : `${formData.vip_duration_days} Days`)) : (formData.onboarding_mode === 'trial' ? `🎁 ${formData.trial_days || defaultTrialDays || 16} Days Free Trial` : 'Monthly Auto-Renew')}</div>
                  <div><strong>Gateway:</strong> {(formData.onboarding_mode === 'cashfree_paid' || formData.onboarding_mode === 'active') ? 'Cashfree Sandbox' : 'None (Direct SuperAdmin Provisioning)'}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '8px' }}>
                  👤 Admin Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '0.76rem' }}>
                  <div><strong>Owner Name:</strong> {formData.owner_name || 'Admin'}</div>
                  <div><strong>Admin Username:</strong> <code style={{ color: '#0F172A', fontWeight: 800 }}>{formData.owner_username}</code></div>
                  <div><strong>Password:</strong> •••••••••••• (Encrypted)</div>
                  <div><strong>Recovery Phone:</strong> {formData.owner_phone || formData.phone || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        {!createdSuccessData && !checkoutState && (
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
                onClick={handleModalClose}
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
                  {currentStep === 4 ? 'Review & Launch' : 'Continue'} <ChevronRight size={16} />
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
                      <span>Provisioning...</span>
                    </>
                  ) : formData.onboarding_mode === 'trial' ? (
                    <>
                      <Gift size={16} />
                      <span>🎁 Provision {formData.trial_days || defaultTrialDays || 16}-Day Free Trial (Instant)</span>
                    </>
                  ) : formData.onboarding_mode === 'vip' ? (
                    <>
                      <Crown size={16} />
                      <span>👑 Provision VIP Tenant (Instant)</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>💳 Launch Cashfree Gateway Mandate</span>
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
