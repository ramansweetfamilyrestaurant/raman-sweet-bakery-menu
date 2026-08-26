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
  Gift
} from 'lucide-react';
import { 
  BUSINESS_TYPES, 
  BUSINESS_TYPE_METADATA, 
  resolveServiceModelForBusinessType 
} from '../../../utils/businessTaxonomy';
import { SAAS_PLANS, getPlanDetails } from '../../../config/plans';

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
    onboarding_mode: 'active', // 'active' | 'trial' | 'vip'
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

  // Final Tenant Creation Handler (Executes ONLY on Step 5 confirmation)
  const handleFinalSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      // Calculate expiry date based on onboarding mode
      let expiryDate;
      if (formData.onboarding_mode === 'trial') {
        expiryDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();
      } else if (formData.onboarding_mode === 'vip') {
        expiryDate = new Date('2099-12-31T23:59:59Z').toISOString();
      } else {
        expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

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
        plan_price: formData.onboarding_mode === 'vip' || formData.onboarding_mode === 'trial' ? 0 : authoritativePrice,
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

  return (
    <div 
      className="sa-modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5, 20, 11, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div 
        className="sa-modal-box"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.45)',
          border: '1.5px solid #D4AF37',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header with Title & Stepper Progress */}
        <div style={{
          padding: '22px 26px 16px',
          background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
          color: '#FFFFFF',
          borderBottom: '1.5px solid #D4AF37'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.2)', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={20} color="#DFBA67" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#DFBA67', margin: 0 }}>
                  Add New Business • Onboarding Wizard
                </h3>
                <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: '2px 0 0 0' }}>
                  Multi-step tenant setup with verified taxonomy, catalog pricing & KYC
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
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
                    opacity: isCurrent || isDone ? 1 : 0.45
                  }}
                  onClick={() => { if (isDone) setCurrentStep(s.num); }}
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
                    marginBottom: '4px',
                    boxShadow: isCurrent ? '0 0 10px rgba(212, 175, 55, 0.5)' : 'none'
                  }}>
                    {isDone ? '✓' : <Icon size={14} />}
                  </div>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: isCurrent ? '#DFBA67' : '#E2E8F0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626',
              padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px'
            }}>
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: BUSINESS INFORMATION */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    BUSINESS NAME <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grand Royal Hotel & Dining"
                    value={formData.name}
                    onChange={handleNameChange}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    BUSINESS TYPE <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    value={formData.business_type}
                    onChange={e => handleBusinessTypeChange(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    {BUSINESS_TYPES.map(type => (
                      <option key={type} value={type}>
                        {BUSINESS_TYPE_METADATA[type]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[type]?.label || type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Service Model & Slug Preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    CANONICAL SERVICE MODEL
                  </label>
                  <div style={{ height: '42px', display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '10px', background: '#F1F5F9', border: '1.5px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                    {formData.service_model === 'hotel' && '🏨 Hotel & Room Dining (Cabins / Rooms)'}
                    {formData.service_model === 'cinema' && '🎬 Cinema & Screen Dining (Screens / Rows / Seats)'}
                    {formData.service_model === 'dine_in' && '🍽️ Dine-In Table Ordering (Standard Tables)'}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    URL SLUG <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. grand-royal"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 800, color: '#B45309', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    BUSINESS PHONE / WHATSAPP
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value, whatsapp_number: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    BUSINESS EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="contact@business.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Address / Location */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  BUSINESS ADDRESS
                </label>
                <input
                  type="text"
                  placeholder="Street address, city, landmark"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* GST Setting & Theme */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_gst_applicable}
                      onChange={e => setFormData({ ...formData, is_gst_applicable: e.target.checked })}
                    />
                    GST APPLICABLE (5% RESTAURANT / SERVICE GST)
                  </label>
                  {formData.is_gst_applicable && (
                    <input
                      type="text"
                      placeholder="Enter 15-digit GSTIN"
                      value={formData.gstin}
                      onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      style={{ width: '100%', height: '38px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #D4AF37', fontSize: '0.82rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box', marginTop: '4px' }}
                    />
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    DEFAULT LUXURY THEME
                  </label>
                  <select
                    value={formData.theme_color}
                    onChange={e => setFormData({ ...formData, theme_color: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', fontWeight: 700, outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="gold">👑 Gold & Forest Green (Signature)</option>
                    <option value="emerald">💎 Emerald Mint & Teal</option>
                    <option value="crimson">🍷 Ruby Crimson & Amber</option>
                    <option value="navy">🌌 Midnight Navy & Sapphire</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DOCUMENTS / KYC */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', fontSize: '0.80rem', color: '#475569', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <ShieldCheck size={16} color="#15803D" /> Verification & KYC Registry
                </div>
                Business documents are stored securely with tenant isolation. SuperAdmin onboarding allows optional document verification during Sandbox provisioning.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    BUSINESS PAN NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABCDE1234F"
                    value={formData.pan_number}
                    onChange={e => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    TRADE LICENSE / FSSAI NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10020042000123"
                    value={formData.trade_license_number}
                    onChange={e => setFormData({ ...formData, trade_license_number: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    GST CERTIFICATE REFERENCE
                  </label>
                  <input
                    type="text"
                    placeholder="Doc Ref / Certificate Number"
                    value={formData.gst_cert_ref}
                    onChange={e => setFormData({ ...formData, gst_cert_ref: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    OWNER ID PROOF (AADHAAR / PASSPORT)
                  </label>
                  <input
                    type="text"
                    placeholder="ID Reference Number"
                    value={formData.owner_id_ref}
                    onChange={e => setFormData({ ...formData, owner_id_ref: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PLAN & BILLING */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '-6px' }}>
                SELECT SAAS SUBSCRIPTION PLAN (CATALOG-BACKED)
              </div>

              {/* Plan Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
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
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  ONBOARDING & PROVISIONING MODE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'active' })}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: formData.onboarding_mode === 'active' ? '2px solid #10B981' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'active' ? '#ECFDF5' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#065F46' }}>🟢 Immediate Active</div>
                    <div style={{ fontSize: '0.68rem', color: '#047857' }}>Standard 30-Day Cycle</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'trial' })}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: formData.onboarding_mode === 'trial' ? '2px solid #3B82F6' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'trial' ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#1E40AF' }}>🎁 16-Day Free Trial</div>
                    <div style={{ fontSize: '0.68rem', color: '#2563EB' }}>Zero upfront payment</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, onboarding_mode: 'vip' })}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: formData.onboarding_mode === 'vip' ? '2px solid #D4AF37' : '1.5px solid #CBD5E1',
                      background: formData.onboarding_mode === 'vip' ? '#FEFCE8' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.80rem', fontWeight: 900, color: '#854D0E' }}>👑 VIP Granted</div>
                    <div style={{ fontSize: '0.68rem', color: '#A16207' }}>Admin Lifetime Access</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: OWNER / ADMIN ACCOUNT */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    PRIMARY OWNER FULL NAME
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.owner_name}
                    onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    ADMIN USERNAME <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. grand_royal_admin"
                    value={formData.owner_username}
                    onChange={e => setFormData({ ...formData, owner_username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  ADMIN INITIAL PASSWORD <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={17} color="#94A3B8" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter secure initial password (min 4 chars)"
                    value={formData.owner_password}
                    onChange={e => setFormData({ ...formData, owner_password: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 40px 8px 38px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px' }}>
                  🔒 Password is encrypted with 10 salt rounds of bcrypt before being written to PostgreSQL.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    OWNER RECOVERY PHONE
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.owner_phone || formData.phone}
                    onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    OWNER RECOVERY EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="owner@business.com"
                    value={formData.owner_email || formData.email}
                    onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CONFIRM */}
          {currentStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🏢 Business & Taxonomy</span>
                  <span style={{ color: '#D4AF37' }}>/r/{formData.slug}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                  <div><strong>Name:</strong> {formData.name}</div>
                  <div><strong>Type:</strong> {BUSINESS_TYPE_METADATA[formData.business_type]?.label || formData.business_type}</div>
                  <div><strong>Service Model:</strong> {formData.service_model}</div>
                  <div><strong>Contact Phone:</strong> {formData.phone || 'None provided'}</div>
                  <div><strong>GSTIN:</strong> {formData.is_gst_applicable ? (formData.gstin || 'Pending entry') : 'Not Applicable'}</div>
                  <div><strong>Theme:</strong> {formData.theme_color}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>💳 Plan & Provisioning Mode</span>
                  <span style={{ fontWeight: 900, color: '#059669' }}>
                    {formData.onboarding_mode === 'trial' ? 'FREE TRIAL' : formData.onboarding_mode === 'vip' ? 'VIP GRANTED' : `₹${authoritativePrice}/mo`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                  <div><strong>Plan Tier:</strong> {selectedPlanDetails?.name || formData.plan_tier}</div>
                  <div><strong>Catalog Price:</strong> ₹{authoritativePrice} / month</div>
                  <div><strong>Provisioning Mode:</strong> {formData.onboarding_mode.toUpperCase()}</div>
                  <div><strong>Initial Window:</strong> {formData.onboarding_mode === 'trial' ? '16 Days Trial' : formData.onboarding_mode === 'vip' ? 'Lifetime Granted' : '30 Days Standard'}</div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '8px', marginBottom: '10px' }}>
                  👤 Admin Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                  <div><strong>Admin Username:</strong> <code style={{ color: '#0F172A', fontWeight: 800 }}>{formData.owner_username}</code></div>
                  <div><strong>Password:</strong> •••••••••••• (Encrypted)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        <div style={{
          padding: '16px 28px',
          background: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={submitting}
              className="sa-btn sa-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="sa-btn sa-btn-secondary"
            >
              Cancel
            </button>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 900,
                  opacity: ((currentStep === 1 && !isStep1Valid) || (currentStep === 4 && !isStep4Valid)) ? 0.45 : 1,
                  cursor: ((currentStep === 1 && !isStep1Valid) || (currentStep === 4 && !isStep4Valid)) ? 'not-allowed' : 'pointer'
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
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  boxShadow: '0 4px 16px rgba(212, 175, 55, 0.4)'
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Creating & Provisioning...</span>
                  </>
                ) : formData.onboarding_mode === 'trial' ? (
                  <>
                    <Gift size={16} />
                    <span>🎁 Start 16-Day Trial Business</span>
                  </>
                ) : formData.onboarding_mode === 'vip' ? (
                  <>
                    <Crown size={16} />
                    <span>👑 Create VIP Tenant Business</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>✓ Create & Activate Business</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
