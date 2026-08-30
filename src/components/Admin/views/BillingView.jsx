import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  RefreshCw, 
  Zap, 
  Crown, 
  Rocket, 
  Lock, 
  Check, 
  X, 
  HelpCircle, 
  Download, 
  Printer, 
  FileText, 
  Sparkles, 
  ExternalLink,
  Layers,
  Utensils,
  ShoppingBag,
  TrendingUp,
  Tag,
  AlertTriangle,
  Info
} from 'lucide-react';
import { 
  fetchSubscriptionStatus, 
  fetchPaymentHistory, 
  fetchPublicPlans, 
  cancelSubscription, 
  changePlan, 
  createCashfreeSubscription,
  verifyCashfreeSubscription 
} from '../../../api/client';
import { resolveTenantCapabilities } from '../../../utils/planCapabilities';
import { getCurrencySymbol, formatPriceNumber } from '../../../utils/currencyHelper';
import PlanLockedCard from '../components/PlanLockedCard';

export default function BillingView({
  restaurantInfo = {},
  settingsForm = {},
  dishes = [],
  categories = [],
  combos = [],
  totalTablesCount = 0,
  token,
  capabilities,
  currencySymbol = '₹',
  onUpgrade,
  onNavigate,
  onRefreshInfo
}) {
  const sym = getCurrencySymbol(settingsForm?.currency_symbol !== undefined ? settingsForm.currency_symbol : (restaurantInfo?.currency_symbol || currencySymbol));
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);

  // Active Internal Tab: 'overview' | 'plans' | 'history' | 'invoices'
  const [activeTab, setActiveTab] = useState('overview');

  // Subscription & Billing Data State
  const [subData, setSubData] = useState(null);
  const [paymentsList, setPaymentsList] = useState([]);
  const [plansCatalog, setPlansCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Auto-Renew Confirmation Modal State
  const [showAutoRenewModal, setShowAutoRenewModal] = useState(false);
  const [cancellingAutoRenew, setCancellingAutoRenew] = useState(false);

  // Selected Invoice Modal for Viewing / Printing
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Plan Change In-Progress State
  const [changingPlanKey, setChangingPlanKey] = useState(null);

  // Load live subscription status, payment history, and public plans catalog
  const loadBillingData = useCallback(async (isManual = false) => {
    if (!token) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    try {
      const [subRes, payRes, plansRes] = await Promise.allSettled([
        fetchSubscriptionStatus(token),
        fetchPaymentHistory(token),
        fetchPublicPlans()
      ]);

      if (subRes.status === 'fulfilled' && subRes.value) {
        setSubData(subRes.value);
      }
      if (payRes.status === 'fulfilled' && payRes.value) {
        const payData = payRes.value;
        setPaymentsList(Array.isArray(payData?.payments) ? payData.payments : []);
      }
      if (plansRes.status === 'fulfilled' && plansRes.value) {
        const plans = Array.isArray(plansRes.value) ? plansRes.value : [];
        setPlansCatalog(plans);
      }
    } catch (err) {
      console.warn('Failed to load billing data:', err);
      setErrorMsg('Failed to load live billing details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Current Active Plan Details from Server
  const currentPlanTier = (
    subData?.plan_tier || 
    restaurantInfo?.plan_tier || 
    settingsForm?.plan_tier || 
    'pro'
  ).toLowerCase();

  const currentPlanPrice = Number(
    subData?.plan_price || 
    restaurantInfo?.plan_price || 
    (currentPlanTier === 'enterprise' ? 1999 : currentPlanTier === 'basic' ? 499 : 999)
  );

  // Parse lifecycle dates
  const parseSafeDate = (d) => {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    const str = String(d).trim().replace(' ', 'T');
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const nextBillingDateObj = parseSafeDate(
    subData?.subscription?.current_period_end ||
    subData?.subscription?.next_billing_at ||
    subData?.access_until ||
    subData?.trial_ends_at ||
    restaurantInfo?.trial_ends_at ||
    restaurantInfo?.plan_expires_at
  );

  const formattedRenewalDate = nextBillingDateObj 
    ? nextBillingDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Active';

  // Subscription Status Calculation (Factual Mapping)
  const rawStatus = (subData?.status || restaurantInfo?.subscription_status || 'active').toLowerCase();
  const isMandateActive = subData?.mandate_status === 'active' || Boolean(restaurantInfo?.mandate_id);
  const isComplimentary = restaurantInfo?.subscription_type === 'ADMIN_GRANTED' || subData?.mandate_status === 'admin_granted';
  const autoRenewEnabled = subData?.auto_renew !== 0 && !subData?.cancel_requested_at;

  const statusConfig = useMemo(() => {
    if (isComplimentary) {
      return { label: 'VIP (Complimentary)', bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF', icon: Crown, desc: 'Lifetime complimentary SaaS access granted by platform.' };
    }
    if (rawStatus === 'trialing') {
      return { label: 'Free Trial', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A', icon: Sparkles, desc: `Trial period active until ${formattedRenewalDate}.` };
    }
    if (rawStatus === 'awaiting_charge') {
      return { label: 'Awaiting First Charge', bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE', icon: Clock, desc: 'Mandate verified. Awaiting initial scheduled billing charge.' };
    }
    if (rawStatus === 'payment_failed') {
      return { label: 'Payment Failed', bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5', icon: AlertTriangle, desc: 'Payment requires attention to keep subscription active.' };
    }
    if (rawStatus === 'cancelled' || subData?.cancel_requested_at) {
      return { label: 'Cancelled (Active Period)', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: AlertCircle, desc: `Auto-renew is OFF. Plan access remains active until ${formattedRenewalDate}.` };
    }
    return { label: 'Active', bg: '#ECFDF5', color: '#064E3B', border: '#A7F3D0', icon: CheckCircle2, desc: `Subscription active. Renews automatically on ${formattedRenewalDate}.` };
  }, [rawStatus, isComplimentary, subData, formattedRenewalDate]);

  // Quota usage computations
  const maxDishes = resolvedCaps?.max_dishes ?? (subData?.permissions?.max_dishes || 9999);
  const maxCategories = resolvedCaps?.max_categories ?? (subData?.permissions?.max_categories || 9999);
  const maxCombos = resolvedCaps?.max_combos ?? (subData?.permissions?.max_combos || 10);
  const maxTables = resolvedCaps?.max_tables ?? (subData?.permissions?.max_tables || 9999);

  const dishesCount = Array.isArray(dishes) ? dishes.length : 0;
  const categoriesCount = Array.isArray(categories) ? categories.length : 0;
  const combosCount = Array.isArray(combos) ? combos.length : 0;
  const tablesCount = Number(totalTablesCount || restaurantInfo?.total_tables || 0);

  // Auto-renew toggle handler
  const handleConfirmCancelAutoRenew = async () => {
    setCancellingAutoRenew(true);
    try {
      const res = await cancelSubscription(token, 'Owner disabled auto-renew from dashboard');
      if (res && res.success) {
        setActionSuccessMsg('✓ Auto-renew has been turned off. Your current access continues until the end of this billing period.');
        setShowAutoRenewModal(false);
        await loadBillingData(true);
        if (onRefreshInfo) onRefreshInfo();
        setTimeout(() => setActionSuccessMsg(''), 5000);
      } else {
        alert(res?.error || 'Failed to update auto-renew settings');
      }
    } catch (err) {
      alert(err.message || 'Failed to update auto-renew');
    } finally {
      setCancellingAutoRenew(false);
    }
  };

  // Plan Upgrade / Change handler
  const handleInitiatePlanChange = async (targetPlan) => {
    if (!targetPlan || targetPlan.key === currentPlanTier) return;
    setChangingPlanKey(targetPlan.key);

    try {
      // If Cashfree mandate exists, call changePlan API
      if (isMandateActive) {
        const res = await changePlan(targetPlan.key, token);
        if (res && res.success) {
          setActionSuccessMsg(`✓ Plan upgrade to ${targetPlan.name} scheduled successfully!`);
          await loadBillingData(true);
          if (onRefreshInfo) onRefreshInfo();
          setTimeout(() => setActionSuccessMsg(''), 5000);
        } else {
          // Fallback to Cashfree subscription checkout flow
          if (onUpgrade) onUpgrade(targetPlan.key);
          else {
            const checkoutRes = await createCashfreeSubscription(targetPlan.key, token, window.location.href);
            if (checkoutRes?.payment_url) {
              window.location.href = checkoutRes.payment_url;
            }
          }
        }
      } else {
        // Direct Cashfree Checkout
        const checkoutRes = await createCashfreeSubscription(targetPlan.key, token, window.location.href);
        if (checkoutRes?.payment_url) {
          window.location.href = checkoutRes.payment_url;
        } else if (onUpgrade) {
          onUpgrade(targetPlan.key);
        }
      }
    } catch (err) {
      console.warn('Plan change error:', err);
      alert(err.message || 'Failed to initiate plan upgrade. Please contact support.');
    } finally {
      setChangingPlanKey(null);
    }
  };

  // Feature capability items list for "Included in your plan"
  const planFeaturesList = useMemo(() => {
    return [
      { name: 'Digital QR Code Menu', enabled: true, benefit: 'Browse dishes & photos on customer smartphones' },
      { name: 'Direct Table QR Ordering', enabled: Boolean(resolvedCaps?.direct_ordering_enabled), benefit: 'Customers place live orders directly from tables' },
      { name: 'WhatsApp Direct Ordering', enabled: Boolean(resolvedCaps?.whatsapp_ordering_enabled), benefit: 'Receive structured food orders directly on WhatsApp' },
      { name: 'Kitchen Display System (KDS)', enabled: Boolean(resolvedCaps?.kds_enabled), benefit: 'Live chef prep screen with sound alerts' },
      { name: 'Bluetooth Thermal KOT & Bill Printing', enabled: Boolean(resolvedCaps?.bluetooth_kot_enabled), benefit: 'Print 58mm/80mm kitchen tickets and final receipts' },
      { name: 'Dual Printer Routing', enabled: Boolean(resolvedCaps?.dual_printer_enabled), benefit: 'Route kitchen tickets to kitchen and bills to counter' },
      { name: 'Sales Analytics & Heatmaps', enabled: true, benefit: 'Daily trends, revenue summaries, and peak hour matrix' },
      { name: 'CSV & Excel Report Export', enabled: Boolean(resolvedCaps?.analytics_export_enabled), benefit: 'Download RFC 4180 CSV & XLSX spreadsheets' },
      { name: '5% GST Tax Invoicing', enabled: Boolean(resolvedCaps?.gst_invoice_enabled), benefit: 'Automatic CGST/SGST tax calculation on orders' },
      { name: 'Google Reviews Smart Redirect', enabled: Boolean(resolvedCaps?.google_reviews_enabled), benefit: 'Direct happy customers to your Google Maps review page' },
      { name: 'AI Smart Review Highlights', enabled: Boolean(resolvedCaps?.ai_review_enabled), benefit: 'AI-generated review sentiments and badges' },
      { name: 'Dish Modifiers & Add-ons', enabled: Boolean(resolvedCaps?.modifiers_enabled), benefit: 'Customizable toppings, crusts, and portion sizes' },
      { name: 'Watermark Removal (White-Label)', enabled: Boolean(resolvedCaps?.watermark_removal_enabled), benefit: 'Remove TouchQR branding from customer menu footer' },
      { name: 'GPS Presence Verification', enabled: Boolean(resolvedCaps?.presence_verification_enabled), benefit: 'Verify diner is physically in hall before ordering' }
    ];
  }, [resolvedCaps]);

  // Master Plans Catalog Fallback if backend plans list is loading
  const masterPlans = useMemo(() => {
    if (plansCatalog.length > 0) return plansCatalog;
    return [
      {
        key: 'basic',
        name: 'Basic Starter',
        price: 499,
        badge: '⚡ BASIC',
        description: 'Essential digital QR menu for cafés & small dining outlets',
        max_combos: 3,
        max_tables: 9999,
        direct_ordering_enabled: false,
        whatsapp_ordering_enabled: false,
        kds_enabled: false
      },
      {
        key: 'pro',
        name: 'Pro Luxury',
        price: 999,
        badge: '👑 PRO (MOST POPULAR)',
        popular: true,
        description: 'Complete digital menu, WhatsApp ordering & sales growth suite',
        max_combos: 10,
        max_tables: 9999,
        direct_ordering_enabled: false,
        whatsapp_ordering_enabled: true,
        kds_enabled: false
      },
      {
        key: 'enterprise',
        name: 'Enterprise VIP',
        price: 1999,
        badge: '🚀 ENTERPRISE VIP',
        description: 'Full-suite restaurant management, Direct Table Ordering & KOT',
        max_combos: 9999,
        max_tables: 9999,
        direct_ordering_enabled: true,
        whatsapp_ordering_enabled: true,
        kds_enabled: true
      }
    ];
  }, [plansCatalog]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '0 0 40px 0',
      width: '100%',
      maxWidth: '1440px',
      margin: '0 auto',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .billing-nav-tab-btn {
          transition: all 0.15s ease;
        }
        .billing-nav-tab-btn:hover {
          border-color: #064E3B !important;
          color: #064E3B !important;
        }
        .plan-card-item {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .plan-card-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.06) !important;
        }
        @media (max-width: 900px) {
          .billing-main-grid {
            grid-template-columns: 1fr !important;
          }
          .billing-desktop-table {
            display: none !important;
          }
          .billing-mobile-cards {
            display: flex !important;
          }
          .plans-grid-container {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 901px) {
          .billing-desktop-table {
            display: block !important;
          }
          .billing-mobile-cards {
            display: none !important;
          }
          .plans-grid-container {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>

      {/* =========================================================================
          1. PAGE HEADER (Breadcrumb + Title + Live Status Badge)
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Left: Breadcrumb + Title */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
            <span>Settings</span>
            <span>/</span>
            <span style={{ color: '#064E3B' }}>Billing & Subscription</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{
              fontSize: '1.24rem',
              fontWeight: 900,
              color: '#0F172A',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Billing & Subscription
            </h1>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Manage your TouchQR plan, subscription, payments and invoices.
          </p>
        </div>

        {/* Right: Status Badge & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          <div style={{
            background: statusConfig.bg,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.border}`,
            borderRadius: '12px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.76rem',
            fontWeight: 800
          }}>
            <statusConfig.icon size={15} />
            <span>● {statusConfig.label}</span>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => loadBillingData(true)}
            disabled={refreshing || loading}
            title="Refresh billing status"
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>

          {/* Need Help CTA */}
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('support') : window.open('https://wa.me/919876543210', '_blank')}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FAF8F5',
              color: '#0F172A',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <HelpCircle size={14} color="#064E3B" />
            <span>Need Help?</span>
          </button>
        </div>
      </div>

      {/* Action Success Toast */}
      {actionSuccessMsg && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: '12px',
          padding: '12px 16px',
          color: '#064E3B',
          fontSize: '0.78rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMsg && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FCA5A5',
          borderRadius: '12px',
          padding: '12px 16px',
          color: '#DC2626',
          fontSize: '0.78rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => loadBillingData(true)}
            style={{
              background: '#FFFFFF',
              border: '1px solid #FCA5A5',
              borderRadius: '6px',
              padding: '3px 8px',
              color: '#DC2626',
              fontSize: '0.70rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          2. BILLING INTERNAL NAVIGATION (Overview, Plans, Payment History, Invoices)
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '8px 12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'overview', label: 'Overview & Current Plan' },
          { id: 'plans', label: 'All Plans & Upgrade' },
          { id: 'history', label: `Payment History (${paymentsList.length})` },
          { id: 'invoices', label: 'Invoices' }
        ].map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="billing-nav-tab-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.76rem',
                fontWeight: active ? 800 : 600,
                border: active ? '1.5px solid #064E3B' : '1px solid #E2E8F0',
                background: active ? '#064E3B' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          3. TAB CONTENT: OVERVIEW
         ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="billing-main-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '16px',
          alignItems: 'start'
        }}>
          {/* LEFT MAIN AREA: CURRENT PLAN + USAGE + FEATURES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Current Plan Primary Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1.5px solid #EAE5DF',
              padding: '20px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle top accent bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #064E3B 0%, #10B981 100%)'
              }} />

              {/* Plan Header Row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    CURRENT ACTIVE PLAN
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                      {currentPlanTier === 'enterprise' ? 'Enterprise VIP Plan' : currentPlanTier === 'basic' ? 'Basic Starter Plan' : 'Pro Luxury Plan'}
                    </h2>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      color: currentPlanTier === 'enterprise' ? '#7E22CE' : (currentPlanTier === 'basic' ? '#0284C7' : '#B45309'),
                      background: currentPlanTier === 'enterprise' ? '#FAF5FF' : (currentPlanTier === 'basic' ? '#F0F9FF' : '#FEF3C7'),
                      border: `1px solid ${currentPlanTier === 'enterprise' ? '#E9D5FF' : (currentPlanTier === 'basic' ? '#BAE6FD' : '#FDE68A')}`,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {currentPlanTier === 'enterprise' ? '🚀 ENTERPRISE' : currentPlanTier === 'basic' ? '⚡ BASIC' : '👑 PRO'}
                    </span>
                  </div>
                </div>

                {/* Price Display */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#064E3B', lineHeight: 1 }}>
                    ₹{formatPriceNumber(currentPlanPrice)}
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B' }}> / month</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '3px' }}>
                    + 18% GST (Tax Invoice Included)
                  </span>
                </div>
              </div>

              {/* Status & Billing Cycle Info Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                background: '#FAF8F5',
                borderRadius: '12px',
                padding: '14px',
                border: '1px solid #EAE5DF',
                marginBottom: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Status</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: statusConfig.color, marginTop: '2px' }}>
                    ● {statusConfig.label}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Billing Cycle</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                    Monthly Recurring
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Next Renewal / Period</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                    {formattedRenewalDate}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Auto-Renew</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: autoRenewEnabled ? '#059669' : '#DC2626', marginTop: '2px' }}>
                    {autoRenewEnabled ? 'ON (Active)' : 'OFF (Paused)'}
                  </div>
                </div>
              </div>

              {/* Status Explanation Banner */}
              <div style={{
                fontSize: '0.74rem',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: 1.4
              }}>
                <Info size={16} color="#064E3B" style={{ flexShrink: 0 }} />
                <span>{statusConfig.desc}</span>
              </div>

              {/* Quick Actions Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid #EAE5DF'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#064E3B',
                    color: '#FFFFFF',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                  }}
                >
                  <Sparkles size={14} />
                  <span>Change or Upgrade Plan</span>
                </button>

                {autoRenewEnabled && !isComplimentary && (
                  <button
                    type="button"
                    onClick={() => setShowAutoRenewModal(true)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#64748B',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Manage Auto-Renew
                  </button>
                )}
              </div>
            </div>

            {/* Plan Usage Section (Live Factual Quotas) */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#064E3B" />
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                    Plan Usage & Limits
                  </h3>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                  Based on {currentPlanTier.toUpperCase()} Plan Entitlements
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {/* Dishes Usage */}
                <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px 14px', border: '1px solid #EAE5DF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>Menu Dishes</span>
                    <strong style={{ color: '#064E3B' }}>
                      {dishesCount} / {maxDishes === 9999 ? 'Unlimited' : maxDishes}
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: maxDishes === 9999 ? '100%' : `${Math.min(100, Math.round((dishesCount / maxDishes) * 100))}%`,
                      height: '100%',
                      background: '#064E3B',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>

                {/* Categories Usage */}
                <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px 14px', border: '1px solid #EAE5DF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>Categories</span>
                    <strong style={{ color: '#064E3B' }}>
                      {categoriesCount} / {maxCategories === 9999 ? 'Unlimited' : maxCategories}
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: maxCategories === 9999 ? '100%' : `${Math.min(100, Math.round((categoriesCount / maxCategories) * 100))}%`,
                      height: '100%',
                      background: '#064E3B',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>

                {/* Combos Usage */}
                <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px 14px', border: '1px solid #EAE5DF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>Combos & Thalis</span>
                    <strong style={{ color: combosCount >= maxCombos && maxCombos !== 9999 ? '#DC2626' : '#064E3B' }}>
                      {combosCount} / {maxCombos === 9999 ? 'Unlimited' : maxCombos}
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: maxCombos === 9999 ? '100%' : `${Math.min(100, Math.round((combosCount / maxCombos) * 100))}%`,
                      height: '100%',
                      background: combosCount >= maxCombos && maxCombos !== 9999 ? '#DC2626' : '#064E3B',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>

                {/* Tables Usage */}
                <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px 14px', border: '1px solid #EAE5DF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>Tables & Spaces</span>
                    <strong style={{ color: '#064E3B' }}>
                      {tablesCount} / {maxTables === 9999 ? 'Unlimited' : maxTables}
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: maxTables === 9999 ? '100%' : `${Math.min(100, Math.round((tablesCount / maxTables) * 100))}%`,
                      height: '100%',
                      background: '#064E3B',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Features Included Section (Canonical Capability Resolver) */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#064E3B" />
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                    Included in your plan
                  </h3>
                </div>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                  Live Plan Matrix
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                {planFeaturesList.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      background: f.enabled ? '#FAF8F5' : '#FFFFFF',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      border: f.enabled ? '1px solid #EAE5DF' : '1px dashed #CBD5E1',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      opacity: f.enabled ? 1 : 0.65
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: f.enabled ? '#ECFDF5' : '#F1F5F9',
                      color: f.enabled ? '#059669' : '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px'
                    }}>
                      {f.enabled ? <Check size={13} strokeWidth={2.5} /> : <Lock size={12} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: f.enabled ? '#0F172A' : '#64748B' }}>
                        {f.name}
                      </div>
                      <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                        {f.benefit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT SIDE PANEL: BILLING SUMMARY + AUTO RENEW + SUPPORT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Card 1: Billing Summary */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: '0 0 12px 0' }}>
                Billing Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                  <span style={{ color: '#64748B' }}>Current Plan:</span>
                  <strong style={{ color: '#0F172A' }}>₹{formatPriceNumber(currentPlanPrice)} / mo</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                  <span style={{ color: '#64748B' }}>Next Payment Due:</span>
                  <strong style={{ color: '#064E3B' }}>{formattedRenewalDate}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                  <span style={{ color: '#64748B' }}>Payment Gateway:</span>
                  <strong style={{ color: '#0F172A' }}>Cashfree AutoPay</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                  <span style={{ color: '#64748B' }}>Invoices Recorded:</span>
                  <strong style={{ color: '#0F172A' }}>{paymentsList.length}</strong>
                </div>
              </div>
            </div>

            {/* Card 2: Auto-Renew Settings Control */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <RefreshCw size={16} color="#064E3B" />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Subscription Auto-Renew
                </h3>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#475569', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                {autoRenewEnabled
                  ? 'Your subscription will renew automatically at the end of each billing cycle.'
                  : 'Your subscription will not renew after the current billing period.'}
              </p>

              {autoRenewEnabled && !isComplimentary ? (
                <button
                  type="button"
                  onClick={() => setShowAutoRenewModal(true)}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FAF8F5',
                    color: '#475569',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Turn Off Auto-Renew
                </button>
              ) : !isComplimentary ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#064E3B',
                    color: '#FFFFFF',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Re-Enable Auto-Renew
                </button>
              ) : null}
            </div>

            {/* Card 3: Billing & Payment Support */}
            <div style={{
              background: 'linear-gradient(135deg, #FAF8F5 0%, #F4EFE6 100%)',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <HelpCircle size={18} color="#064E3B" />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Need help with billing?
                </h3>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#475569', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                Contact TouchQR support for subscription or payment assistance.
              </p>
              <button
                type="button"
                onClick={() => onNavigate ? onNavigate('support') : window.open('https://wa.me/919876543210', '_blank')}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#064E3B',
                  color: '#FFFFFF',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(6, 78, 59, 0.2)'
                }}
              >
                <span>Contact Billing Support</span>
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          4. TAB CONTENT: ALL PLANS & UPGRADE
         ========================================================================= */}
      {activeTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Note */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Choose the Right TouchQR Plan for Your Business
              </h2>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Instant plan upgrades via secure Cashfree subscription mandate.
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800, background: '#ECFDF5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
              🔒 100% Secure AutoPay Mandate
            </span>
          </div>

          {/* 3-Column Plan Cards Grid */}
          <div className="plans-grid-container" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {masterPlans.map(plan => {
              const isCurrent = plan.key === currentPlanTier;
              const isUpgrade = (
                (currentPlanTier === 'basic' && (plan.key === 'pro' || plan.key === 'enterprise')) ||
                (currentPlanTier === 'pro' && plan.key === 'enterprise')
              );

              return (
                <div
                  key={plan.key}
                  className="plan-card-item"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    border: isCurrent ? '2px solid #064E3B' : '1px solid #EAE5DF',
                    padding: '20px',
                    boxShadow: isCurrent ? '0 4px 14px rgba(6, 78, 59, 0.1)' : '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    position: 'relative'
                  }}
                >
                  <div>
                    {/* Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        color: plan.key === 'enterprise' ? '#7E22CE' : (plan.key === 'basic' ? '#0284C7' : '#B45309'),
                        background: plan.key === 'enterprise' ? '#FAF5FF' : (plan.key === 'basic' ? '#F0F9FF' : '#FEF3C7'),
                        border: `1px solid ${plan.key === 'enterprise' ? '#E9D5FF' : (plan.key === 'basic' ? '#BAE6FD' : '#FDE68A')}`,
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {plan.badge || plan.name.toUpperCase()}
                      </span>
                      {isCurrent && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 900, color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                          Current Plan
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>
                      {plan.name}
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#064E3B' }}>
                        ₹{formatPriceNumber(plan.price)}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}> / month</span>
                    </div>

                    {/* Features checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                        <Check size={14} color="#059669" strokeWidth={2.5} />
                        <span><strong>{plan.max_combos === 9999 ? 'Unlimited' : plan.max_combos}</strong> Combos & Thalis</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                        <Check size={14} color="#059669" strokeWidth={2.5} />
                        <span><strong>{plan.max_tables === 9999 ? 'Unlimited' : plan.max_tables}</strong> Tables & Spaces</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                        {plan.whatsapp_ordering_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                        <span style={{ color: plan.whatsapp_ordering_enabled ? '#334155' : '#94A3B8' }}>WhatsApp Direct Ordering</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                        {plan.direct_ordering_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                        <span style={{ color: plan.direct_ordering_enabled ? '#334155' : '#94A3B8' }}>Direct Table QR Ordering</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                        {plan.kds_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                        <span style={{ color: plan.kds_enabled ? '#334155' : '#94A3B8' }}>Kitchen Display System (KDS)</span>
                      </div>
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div style={{ marginTop: '16px' }}>
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          borderRadius: '10px',
                          border: '1.5px solid #064E3B',
                          background: '#ECFDF5',
                          color: '#064E3B',
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          cursor: 'default',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>Current Active Plan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInitiatePlanChange(plan)}
                        disabled={changingPlanKey === plan.key}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          borderRadius: '10px',
                          background: isUpgrade ? '#064E3B' : '#FAF8F5',
                          color: isUpgrade ? '#FFFFFF' : '#0F172A',
                          border: isUpgrade ? 'none' : '1px solid #E2E8F0',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: changingPlanKey === plan.key ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: isUpgrade ? '0 2px 6px rgba(6, 78, 59, 0.25)' : 'none'
                        }}
                      >
                        <span>{changingPlanKey === plan.key ? 'Processing...' : isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. TAB CONTENT: PAYMENT HISTORY
         ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAE5DF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #EAE5DF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Payment History
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                All recorded SaaS subscription payments and charges
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#064E3B', background: '#ECFDF5', padding: '3px 8px', borderRadius: '6px' }}>
              {paymentsList.length} Records Found
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="billing-desktop-table">
            {paymentsList.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <CreditCard size={28} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
                  No payments yet
                </h3>
                <p style={{ fontSize: '0.74rem', color: '#64748B', margin: 0 }}>
                  Your payment receipts will appear here after your first subscription billing cycle.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#FAF8F5', borderBottom: '1px solid #EAE5DF' }}>
                    <th style={{ padding: '10px 18px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Invoice #</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Plan</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Payment Method</th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '10px 18px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map(pay => {
                    const payDate = parseSafeDate(pay.paid_at || pay.created_at);
                    const isSuccess = pay.status === 'SUCCESS' || pay.status === 'success' || pay.status === 'paid';
                    return (
                      <tr key={pay.id} style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
                        <td style={{ padding: '12px 18px', fontSize: '0.76rem', color: '#0F172A', fontWeight: 700 }}>
                          {payDate ? payDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.74rem', color: '#475569', fontWeight: 800 }}>
                          INV-{pay.id}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.74rem', color: '#0F172A', fontWeight: 800 }}>
                          {currentPlanTier.toUpperCase()} Plan
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#064E3B', fontWeight: 900 }}>
                          ₹{formatPriceNumber(pay.amount)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.72rem', color: '#64748B' }}>
                          {pay.gateway ? `Cashfree (${pay.gateway.toUpperCase()})` : 'AutoPay Mandate'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: isSuccess ? '#064E3B' : '#DC2626',
                            background: isSuccess ? '#ECFDF5' : '#FEE2E2',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {isSuccess ? 'Paid' : (pay.status || 'Pending')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(pay)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #E2E8F0',
                              background: '#FAF8F5',
                              color: '#064E3B',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            View Invoice
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Cards View */}
          <div className="billing-mobile-cards" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
            {paymentsList.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.74rem', color: '#64748B', margin: 0 }}>No payments recorded yet.</p>
              </div>
            ) : (
              paymentsList.map(pay => {
                const payDate = parseSafeDate(pay.paid_at || pay.created_at);
                const isSuccess = pay.status === 'SUCCESS' || pay.status === 'success' || pay.status === 'paid';
                return (
                  <div key={pay.id} style={{ background: '#FAF8F5', borderRadius: '12px', border: '1px solid #EAE5DF', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.80rem', color: '#0F172A' }}>INV-{pay.id}</strong>
                      <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#064E3B' }}>₹{formatPriceNumber(pay.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#64748B', marginBottom: '8px' }}>
                      <span>{payDate ? payDate.toLocaleDateString('en-IN') : 'Recent'}</span>
                      <span style={{ color: isSuccess ? '#059669' : '#DC2626', fontWeight: 800 }}>{isSuccess ? 'Paid' : 'Pending'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(pay)}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        color: '#064E3B',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      View Invoice Details
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          6. TAB CONTENT: INVOICES
         ========================================================================= */}
      {activeTab === 'invoices' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAE5DF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Tax Invoices & GST Receipts
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Official GST-compliant tax invoices for business accounting
              </span>
            </div>
            <FileText size={20} color="#064E3B" />
          </div>

          {paymentsList.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', background: '#FAF8F5', borderRadius: '12px', border: '1px solid #EAE5DF' }}>
              <FileText size={28} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
                No invoices yet
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#64748B', margin: 0 }}>
                Your invoices will appear here after your first successful payment.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paymentsList.map(pay => {
                const payDate = parseSafeDate(pay.paid_at || pay.created_at);
                return (
                  <div
                    key={pay.id}
                    style={{
                      background: '#FAF8F5',
                      borderRadius: '12px',
                      border: '1px solid #EAE5DF',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.84rem', color: '#0F172A' }}>Tax Invoice #INV-{pay.id}</strong>
                        <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '1px' }}>
                          Issued on {payDate ? payDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'} • {currentPlanTier.toUpperCase()} Plan
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.90rem', fontWeight: 900, color: '#064E3B' }}>
                        ₹{formatPriceNumber(pay.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(pay)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #064E3B',
                          background: '#FFFFFF',
                          color: '#064E3B',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Printer size={13} />
                        <span>Print / View</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          7. MODAL: AUTO-RENEW TURN OFF CONFIRMATION
         ========================================================================= */}
      {showAutoRenewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 12, 10, 0.6)',
          backdropFilter: 'blur(2px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Turn off auto-renew?
              </h3>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Your current {currentPlanTier.toUpperCase()} plan will remain <strong>fully active until {formattedRenewalDate}</strong>. After this date, your subscription will not renew automatically.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAutoRenewModal(false)}
                disabled={cancellingAutoRenew}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Keep Auto-Renew
              </button>

              <button
                type="button"
                onClick={handleConfirmCancelAutoRenew}
                disabled={cancellingAutoRenew}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: cancellingAutoRenew ? 'not-allowed' : 'pointer'
                }}
              >
                {cancellingAutoRenew ? 'Updating...' : 'Turn Off Auto-Renew'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. MODAL: INVOICE VIEWER & PRINT DIALOG
         ========================================================================= */}
      {selectedInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 12, 10, 0.6)',
          backdropFilter: 'blur(2px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Invoice Top */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EAE5DF', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  TouchQR Official Tax Invoice
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', margin: '2px 0 0 0' }}>
                  Invoice #INV-{selectedInvoice.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Bill Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#475569' }}>
              <div>
                <strong>Billed To:</strong>
                <div>{restaurantInfo?.name || 'Restaurant Partner'}</div>
                <div>Ph: {restaurantInfo?.phone || 'N/A'}</div>
                {restaurantInfo?.gstin_number && <div>GSTIN: {restaurantInfo.gstin_number}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Issuer:</strong>
                <div>TouchQR Technologies</div>
                <div>Date: {parseSafeDate(selectedInvoice.paid_at || selectedInvoice.created_at)?.toLocaleDateString('en-IN') || 'Recent'}</div>
                <div>Status: <span style={{ color: '#059669', fontWeight: 800 }}>PAID</span></div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 800, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '6px' }}>
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#334155' }}>
                <span>TouchQR {currentPlanTier.toUpperCase()} SaaS Monthly Subscription</span>
                <strong style={{ color: '#064E3B' }}>₹{formatPriceNumber(selectedInvoice.amount)}</strong>
              </div>
            </div>

            {/* Print & Close Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #064E3B',
                  background: '#ECFDF5',
                  color: '#064E3B',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={14} />
                <span>Print Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#064E3B',
                  color: '#FFFFFF',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
