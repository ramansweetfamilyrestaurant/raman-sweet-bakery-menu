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
import { getBusinessTerminology } from '../../../utils/businessTaxonomy';
import { SAAS_PLANS, getPlanDetails } from '../../../config/plans';
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
  onOpenBillingModal,
  onNavigate,
  onRefreshInfo
}) {
  const sym = getCurrencySymbol(settingsForm?.currency_symbol !== undefined ? settingsForm.currency_symbol : (restaurantInfo?.currency_symbol || currencySymbol));
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);
  const terminology = useMemo(() => getBusinessTerminology(restaurantInfo || settingsForm || {}), [restaurantInfo, settingsForm]);

  const targetBiz = (settingsForm?.business_type || restaurantInfo?.business_type || 'restaurant').toLowerCase();
  const targetService = (settingsForm?.service_model || restaurantInfo?.service_model || 'dine_in').toLowerCase();
  const isHotel = targetService === 'hotel' || targetBiz === 'hotel_resort';
  const isCinema = targetService === 'cinema' || targetService === 'seat_service' || targetBiz === 'cinema_theatre';
  const targetIndustry = isHotel ? 'hotel' : (isCinema ? 'cinema' : 'restaurant');

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
  const [showAllFeatures, setShowAllFeatures] = useState(false);

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

  const isComplimentary = Boolean(
    restaurantInfo?.subscription_type === 'ADMIN_GRANTED' ||
    restaurantInfo?.mandate_status === 'admin_granted' ||
    restaurantInfo?.is_complimentary ||
    restaurantInfo?.is_vip ||
    subData?.subscription_type === 'ADMIN_GRANTED' ||
    subData?.mandate_status === 'admin_granted' ||
    subData?.is_complimentary ||
    subData?.is_vip ||
    currentPlanTier === 'vip' ||
    currentPlanTier === 'vip_ultra' ||
    currentPlanTier === 'vip_ultra_plan'
  );

  const currentPlanPrice = isComplimentary
    ? 0
    : Number(
        subData?.plan_price ??
        restaurantInfo?.plan_price ??
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
  const autoRenewEnabled = subData?.auto_renew !== 0 && !subData?.cancel_requested_at;

  const isExplicitLifetime = Boolean(
    subData?.is_lifetime || 
    restaurantInfo?.is_lifetime || 
    String(subData?.access_until).toLowerCase() === 'lifetime'
  );
  const isLifetimeVip = isComplimentary && (isExplicitLifetime || (nextBillingDateObj && !isNaN(nextBillingDateObj.getTime()) && nextBillingDateObj.getFullYear() > 2030));

  const statusConfig = useMemo(() => {
    if (isComplimentary) {
      return { 
        label: isLifetimeVip ? 'VIP (Lifetime Complimentary)' : 'VIP (Complimentary)', 
        bg: '#FAF5FF', 
        color: '#7E22CE', 
        border: '#E9D5FF', 
        icon: Crown, 
        desc: isLifetimeVip 
          ? 'Lifetime complimentary SaaS access granted by platform.' 
          : `Complimentary VIP access granted until ${formattedRenewalDate}.` 
      };
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
  const isUnlimitedPlan = Boolean(
    currentPlanTier?.includes('enterprise') || 
    currentPlanTier?.includes('vip') || 
    currentPlanTier === 'vip_ultra' ||
    resolvedCaps?.is_vip ||
    isComplimentary
  );
  const maxDishes = isUnlimitedPlan ? 9999 : (resolvedCaps?.max_dishes ?? (subData?.permissions?.max_dishes || 9999));
  const maxCategories = isUnlimitedPlan ? 9999 : (resolvedCaps?.max_categories ?? (subData?.permissions?.max_categories || 9999));
  const maxCombos = isUnlimitedPlan ? 9999 : (resolvedCaps?.max_combos ?? (subData?.permissions?.max_combos || 10));
  const maxTables = isUnlimitedPlan ? 9999 : (resolvedCaps?.max_tables ?? (subData?.permissions?.max_tables || 9999));

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

    const openCheckoutModal = (planKey) => {
      if (typeof onUpgrade === 'function') {
        onUpgrade(planKey);
        return true;
      }
      if (typeof onOpenBillingModal === 'function') {
        onOpenBillingModal(planKey);
        return true;
      }
      return false;
    };

    try {
      // 1. If no active mandate on file, open Cashfree checkout modal directly
      if (!isMandateActive) {
        if (openCheckoutModal(targetPlan.key)) return;
      }

      // 2. If mandate exists, call server changePlan endpoint
      const res = await changePlan(targetPlan.key, token);
      if (res && res.success) {
        if (res.reauthorization_required) {
          setActionSuccessMsg(`✓ Plan upgrade to ${targetPlan.name} scheduled! Opening Cashfree to authorize new amount...`);
          await loadBillingData(true);
          if (onRefreshInfo) onRefreshInfo();
          openCheckoutModal(targetPlan.key);
        } else {
          setActionSuccessMsg(`✓ Plan change to ${targetPlan.name} scheduled successfully!`);
          await loadBillingData(true);
          if (onRefreshInfo) onRefreshInfo();
          setTimeout(() => setActionSuccessMsg(''), 5000);
        }
      } else {
        // Fallback to Cashfree checkout modal
        if (!openCheckoutModal(targetPlan.key)) {
          const checkoutRes = await createCashfreeSubscription(targetPlan.key, token, window.location.href);
          if (checkoutRes?.auth_link) {
            window.location.href = checkoutRes.auth_link;
          }
        }
      }
    } catch (err) {
      console.warn('Plan change notice:', err);
      if (!openCheckoutModal(targetPlan.key)) {
        alert(err.message || 'Failed to initiate plan upgrade. Please contact support.');
      }
    } finally {
      setChangingPlanKey(null);
    }
  };

  // Feature capability items list for "Included in your plan"
  const planFeaturesList = useMemo(() => {
    return [
      { name: 'Digital QR Code Menu', enabled: true, benefit: 'Browse items & photos on customer smartphones' },
      { name: 'Direct Digital QR Ordering', enabled: Boolean(resolvedCaps?.direct_ordering_enabled), benefit: 'Customers place live orders directly from tables, rooms, or counters' },
      { name: 'WhatsApp Direct Ordering', enabled: Boolean(resolvedCaps?.whatsapp_ordering_enabled), benefit: 'Receive structured orders directly on WhatsApp' },
      { name: 'Kitchen / Dispatch Display (KDS)', enabled: Boolean(resolvedCaps?.kds_enabled), benefit: 'Live preparation & packing screen with sound alerts' },
      { name: 'Bluetooth Thermal KOT & Receipt Printing', enabled: Boolean(resolvedCaps?.bluetooth_kot_enabled), benefit: 'Print 58mm/80mm tickets and final receipts' },
      ...(isHotel ? [{ name: 'Hotel Amenities & Toiletries Booking', enabled: Boolean(resolvedCaps?.amenities_booking_enabled), benefit: 'Guests can request room amenities, toiletries, and housekeeping' }] : []),
      ...(isCinema ? [
        { name: 'In-Seat Direct Delivery Ordering', enabled: Boolean(resolvedCaps?.cinema_ordering_enabled || resolvedCaps?.seat_runner_dispatch_enabled), benefit: 'Audi, row & seat QR codes for in-seat delivery' },
        { name: 'Interval Rush Mode & Runner Dispatch', enabled: Boolean(resolvedCaps?.interval_rush_mode_enabled), benefit: 'Fast interval ordering and runner delivery queue' }
      ] : []),
      ...(isCinema ? [
        { name: 'Movie Interval Express Rush Mode', enabled: Boolean(resolvedCaps?.interval_rush_mode_enabled), benefit: 'Prioritize fast-prep snacks and drinks during 10-minute intervals' },
        { name: 'In-Seat Runner Dispatch Terminal', enabled: Boolean(resolvedCaps?.seat_runner_dispatch_enabled), benefit: 'Dispatch usher and runner staff directly to auditorium seat rows' }
      ] : []),
      ...(!isHotel && !isCinema ? [{ name: 'Dual Printer Routing', enabled: Boolean(resolvedCaps?.dual_printer_enabled), benefit: 'Route kitchen tickets to kitchen and bills to counter' }] : []),
      { name: 'Sales Analytics & Heatmaps', enabled: true, benefit: 'Daily trends, revenue summaries, and peak hour matrix' },
      { name: 'CSV & Excel Report Export', enabled: Boolean(resolvedCaps?.analytics_export_enabled), benefit: 'Download RFC 4180 CSV & XLSX spreadsheets' },
      { name: '5% GST Tax Invoicing', enabled: Boolean(resolvedCaps?.gst_invoice_enabled), benefit: 'Automatic CGST/SGST tax calculation on orders' },
      { name: 'Google Reviews Smart Redirect', enabled: Boolean(resolvedCaps?.google_reviews_enabled), benefit: 'Direct happy customers to your Google Maps review page' },
      { name: 'AI Smart Review Highlights', enabled: Boolean(resolvedCaps?.ai_review_enabled), benefit: 'AI-generated review sentiments and badges' },
      { name: 'Item Modifiers & Add-ons', enabled: Boolean(resolvedCaps?.modifiers_enabled), benefit: 'Customizable toppings, crusts, and portion sizes' },
      { name: 'Watermark Removal (White-Label)', enabled: Boolean(resolvedCaps?.watermark_removal_enabled), benefit: 'Remove TouchQR branding from customer menu footer' },
      { name: 'GPS Presence Verification', enabled: Boolean(resolvedCaps?.presence_verification_enabled), benefit: 'Verify customer is physically at outlet before ordering' }
    ];
  }, [resolvedCaps, isHotel, isCinema]);

  // Master Plans Catalog dynamically filtered to current tenant's industry
  const masterPlans = useMemo(() => {
    const raw = plansCatalog.length > 0 ? plansCatalog : Object.values(SAAS_PLANS);
    const filtered = raw.filter(p => (p.industry || 'restaurant').toLowerCase() === targetIndustry || p.key.startsWith(targetIndustry));
    return filtered.length > 0 ? filtered : raw.filter(p => ['basic', 'pro', 'enterprise'].includes(p.key));
  }, [plansCatalog, targetIndustry]);

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
          { id: 'overview', label: 'Subscription Overview' },
          { id: 'plans', label: 'All Plans & Upgrade' },
          { id: 'invoices', label: paymentsList.length > 0 ? `Invoices & Receipts (${paymentsList.length})` : 'Invoices & Receipts' }
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* 1. HERO ACTIVE SUBSCRIPTION CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1.5px solid #EAE5DF',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Top Accent Gradient Bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: isComplimentary
                ? 'linear-gradient(90deg, #7E22CE 0%, #D4AF37 100%)'
                : 'linear-gradient(90deg, #064E3B 0%, #10B981 100%)'
            }} />

            {/* Top Row: Plan Name, Badge, Price */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    color: isComplimentary ? '#7E22CE' : (currentPlanTier === 'enterprise' ? '#7E22CE' : (currentPlanTier === 'basic' ? '#0284C7' : '#B45309')),
                    background: isComplimentary ? '#FAF5FF' : (currentPlanTier === 'enterprise' ? '#FAF5FF' : (currentPlanTier === 'basic' ? '#F0F9FF' : '#FEF3C7')),
                    border: `1px solid ${isComplimentary ? '#E9D5FF' : (currentPlanTier === 'enterprise' ? '#E9D5FF' : (currentPlanTier === 'basic' ? '#BAE6FD' : '#FDE68A'))}`,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    {isComplimentary ? '👑 VIP COMPLIMENTARY ACCESS' : (currentPlanTier === 'enterprise' ? '🚀 ENTERPRISE' : currentPlanTier === 'basic' ? '⚡ BASIC STARTER' : '👑 PRO LUXURY')}
                  </span>
                  <div style={{
                    background: statusConfig.bg,
                    color: statusConfig.color,
                    border: `1px solid ${statusConfig.border}`,
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <statusConfig.icon size={13} />
                    <span>● {statusConfig.label}</span>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                  {subData?.plan_name || (currentPlanTier === 'enterprise' ? 'Enterprise VIP Plan' : currentPlanTier === 'basic' ? (isComplimentary ? 'Basic Starter Plan (VIP)' : 'Basic Starter Plan') : (isComplimentary ? 'Pro Luxury Plan (VIP)' : 'Pro Luxury Plan'))}
                </h2>
                <p style={{ fontSize: '0.80rem', color: '#64748B', margin: 0 }}>
                  {isComplimentary
                    ? (isLifetimeVip ? 'Permanent complimentary SaaS access sponsored by TouchQR platform.' : `Complimentary platform access granted until ${formattedRenewalDate}.`)
                    : `${statusConfig.desc}`}
                </p>
              </div>

              {/* Price Display */}
              <div style={{ textAlign: 'right', background: '#F8FAFC', padding: '12px 18px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#064E3B', lineHeight: 1 }}>
                  {isComplimentary ? '₹0' : `₹${formatPriceNumber(currentPlanPrice)}`}
                  {!isComplimentary && <span style={{ fontSize: '0.80rem', fontWeight: 600, color: '#64748B' }}> / month</span>}
                </div>
                <span style={{ fontSize: '0.70rem', color: isComplimentary ? '#7E22CE' : '#64748B', display: 'block', marginTop: '4px', fontWeight: isComplimentary ? 800 : 600 }}>
                  {isComplimentary ? '🛡️ Super Admin Sponsored' : '+ 18% GST (Tax Invoice Included)'}
                </span>
              </div>
            </div>

            {/* Middle Strip: Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              background: '#FAF8F5',
              borderRadius: '12px',
              padding: '14px 16px',
              border: '1px solid #EAE5DF',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isComplimentary ? 'Access Valid Until' : 'Next Renewal / Period'}
                </span>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} color="#064E3B" />
                  <span>{isComplimentary ? (isLifetimeVip ? '👑 Lifetime Access' : formattedRenewalDate) : formattedRenewalDate}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Billing Frequency
                </span>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="#064E3B" />
                  <span>{isComplimentary ? 'Complimentary Access' : 'Monthly Recurring'}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Auto-Renewal Mandate
                </span>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: autoRenewEnabled ? '#059669' : '#DC2626', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={14} />
                  <span>{isComplimentary ? 'N/A (Sponsored)' : (autoRenewEnabled ? 'Active (AutoPay)' : 'Paused (Manual)')}</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#064E3B',
                    color: '#FFFFFF',
                    fontSize: '0.80rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(6, 78, 59, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sparkles size={15} />
                  <span>Upgrade / Change Plan</span>
                </button>

                {autoRenewEnabled && !isComplimentary && (
                  <button
                    type="button"
                    onClick={() => setShowAutoRenewModal(true)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Manage Auto-Renew
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => onNavigate ? onNavigate('support') : window.open('https://wa.me/919876543210', '_blank')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#64748B',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <HelpCircle size={14} color="#064E3B" />
                <span>Billing Help & FAQs</span>
              </button>
            </div>
          </div>

          {/* 2. PLAN CAPACITY & USAGE (CLEAN 4-METRIC STRIP) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #EAE5DF',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#064E3B" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Plan Capacity & Usage
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Active Limits for {currentPlanTier.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {/* Dishes */}
              <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '14px 16px', border: '1px solid #EAE5DF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>🍽️ Menu Dishes</span>
                  <strong style={{ color: '#064E3B' }}>{dishesCount} / {maxDishes >= 9999 ? 'Unlimited' : maxDishes}</strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: maxDishes >= 9999
                      ? (dishesCount > 0 ? `${Math.min(30, Math.max(8, Math.round(dishesCount * 0.5)))}%` : '0%')
                      : `${Math.min(100, Math.round((dishesCount / maxDishes) * 100))}%`,
                    height: '100%',
                    background: maxDishes >= 9999 ? 'linear-gradient(90deg, #10B981, #059669)' : '#064E3B',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>

              {/* Categories */}
              <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '14px 16px', border: '1px solid #EAE5DF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>📂 Categories</span>
                  <strong style={{ color: '#064E3B' }}>{categoriesCount} / {maxCategories >= 9999 ? 'Unlimited' : maxCategories}</strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: maxCategories >= 9999
                      ? (categoriesCount > 0 ? `${Math.min(30, Math.max(8, Math.round(categoriesCount * 0.8)))}%` : '0%')
                      : `${Math.min(100, Math.round((categoriesCount / maxCategories) * 100))}%`,
                    height: '100%',
                    background: maxCategories >= 9999 ? 'linear-gradient(90deg, #10B981, #059669)' : '#064E3B',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>

              {/* Combos */}
              <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '14px 16px', border: '1px solid #EAE5DF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>🍱 Combos & Deals</span>
                  <strong style={{ color: combosCount >= maxCombos && maxCombos < 9999 ? '#DC2626' : '#064E3B' }}>
                    {combosCount} / {maxCombos >= 9999 ? 'Unlimited' : maxCombos}
                  </strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: maxCombos >= 9999
                      ? (combosCount > 0 ? `${Math.min(30, Math.max(8, Math.round(combosCount * 4)))}%` : '0%')
                      : `${Math.min(100, Math.round((combosCount / maxCombos) * 100))}%`,
                    height: '100%',
                    background: combosCount >= maxCombos && maxCombos < 9999 ? '#DC2626' : (maxCombos >= 9999 ? 'linear-gradient(90deg, #10B981, #059669)' : '#064E3B'),
                    borderRadius: '3px'
                  }} />
                </div>
              </div>

              {/* Spaces / Tables */}
              <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '14px 16px', border: '1px solid #EAE5DF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>🪑 {terminology.spacePlural || 'Tables & Counters'}</span>
                  <strong style={{ color: '#064E3B' }}>{tablesCount} / {maxTables >= 9999 ? 'Unlimited' : maxTables}</strong>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: maxTables >= 9999
                      ? (tablesCount > 0 ? `${Math.min(30, Math.max(8, Math.round(tablesCount * 1.5)))}%` : '0%')
                      : `${Math.min(100, Math.round((tablesCount / maxTables) * 100))}%`,
                    height: '100%',
                    background: maxTables >= 9999 ? 'linear-gradient(90deg, #10B981, #059669)' : '#064E3B',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* 3. WHAT'S INCLUDED (COMPACT COLLAPSIBLE ACCORDION) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #EAE5DF',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: showAllFeatures ? '16px' : 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#064E3B" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Included in Your Plan
                </h3>
                <span style={{ fontSize: '0.70rem', color: '#064E3B', background: '#ECFDF5', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                  {planFeaturesList.filter(f => f.enabled).length} Features Active
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                style={{
                  background: '#FAF8F5',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{showAllFeatures ? 'Hide Feature Details ▲' : 'View All Features ▼'}</span>
              </button>
            </div>

            {/* When Collapsed: Quick Highlights Chips */}
            {!showAllFeatures && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                {planFeaturesList.filter(f => f.enabled).slice(0, 5).map((f, i) => (
                  <span key={i} style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#064E3B',
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <Check size={12} strokeWidth={2.5} />
                    <span>{f.name}</span>
                  </span>
                ))}
                <span style={{ fontSize: '0.72rem', color: '#64748B', alignSelf: 'center', paddingLeft: '4px' }}>
                  +{planFeaturesList.filter(f => f.enabled).length - 5} more features enabled
                </span>
              </div>
            )}

            {/* When Expanded: Full Grid */}
            {showAllFeatures && (
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
                      opacity: f.enabled ? 1 : 0.6
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
                      {f.enabled ? <Check size={12} strokeWidth={2.5} /> : <Lock size={11} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: f.enabled ? '#0F172A' : '#64748B' }}>
                        {f.name}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '2px', lineHeight: 1.3 }}>
                        {f.benefit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. RECENT INVOICES & RECEIPTS EMBEDDED DIRECTLY */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #EAE5DF',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#064E3B" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Recent Invoices & Receipts
                </h3>
              </div>
              {paymentsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('invoices')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#064E3B',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>View all ({paymentsList.length})</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>

            {paymentsList.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#FAF8F5', borderRadius: '12px', border: '1px solid #EAE5DF' }}>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                  {isComplimentary
                    ? '🛡️ This account currently has Complimentary VIP access granted by the platform. No invoices or charges are pending.'
                    : 'No payment invoices generated yet. Your receipt will appear here upon completion of your billing cycle.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paymentsList.slice(0, 3).map(pay => {
                  const payDate = parseSafeDate(pay.paid_at || pay.created_at);
                  return (
                    <div
                      key={pay.id}
                      style={{
                        background: '#FAF8F5',
                        borderRadius: '12px',
                        border: '1px solid #EAE5DF',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: '#0F172A' }}>Tax Invoice #INV-{pay.id}</strong>
                          <div style={{ fontSize: '0.70rem', color: '#64748B' }}>
                            {payDate ? payDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'} • ₹{formatPriceNumber(pay.amount)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(pay)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                          color: '#064E3B',
                          fontSize: '0.74rem',
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
              const currentTierPrice = masterPlans.find(p => p.key === currentPlanTier)?.price || Number(restaurantInfo?.plan_price) || Number(subData?.amount) || getPlanDetails(currentPlanTier)?.price || 0;
              const isUpgrade = !isCurrent && Number(plan.price) > Number(currentTierPrice);

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

                    {/* Features checklist (Vertical-Tailored) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {isHotel ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            <Check size={14} color="#059669" strokeWidth={2.5} />
                            <span><strong>{plan.max_rooms === 9999 ? 'Unlimited' : plan.max_rooms}</strong> Guest Rooms & Suites</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            <Check size={14} color="#059669" strokeWidth={2.5} />
                            <span>In-Room QR Directory & Amenities</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            {plan.direct_ordering_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                            <span style={{ color: plan.direct_ordering_enabled ? '#334155' : '#94A3B8' }}>In-Room Guest Food Ordering</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            {plan.direct_ordering_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                            <span style={{ color: plan.direct_ordering_enabled ? '#334155' : '#94A3B8' }}>Room Service & Butler Calls</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            {plan.kds_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                            <span style={{ color: plan.kds_enabled ? '#334155' : '#94A3B8' }}>Kitchen & Pantry KDS Display</span>
                          </div>
                        </>
                      ) : isCinema ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            <Check size={14} color="#059669" strokeWidth={2.5} />
                            <span><strong>{plan.max_screens === 9999 ? 'Unlimited' : plan.max_screens}</strong> Audi Screen{plan.max_screens > 1 ? 's' : ''} · <strong>{plan.max_seats === 9999 ? 'Unlimited' : plan.max_seats}</strong> Seats</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            <Check size={14} color="#059669" strokeWidth={2.5} />
                            <span>Concessions & Canteen QR Menu</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            {plan.direct_ordering_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                            <span style={{ color: plan.direct_ordering_enabled ? '#334155' : '#94A3B8' }}>In-Seat Direct Delivery (Row + Seat QR)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            {plan.direct_ordering_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                            <span style={{ color: plan.direct_ordering_enabled ? '#334155' : '#94A3B8' }}>Interval Rush Fast Checkout</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            {plan.kds_enabled ? <Check size={14} color="#059669" strokeWidth={2.5} /> : <Lock size={13} color="#94A3B8" />}
                            <span style={{ color: plan.kds_enabled ? '#334155' : '#94A3B8' }}>Concessions Live KDS Display</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            <Check size={14} color="#059669" strokeWidth={2.5} />
                            <span><strong>{plan.max_tables === 9999 ? 'Unlimited' : plan.max_tables}</strong> Dining Tables</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#334155' }}>
                            <Check size={14} color="#059669" strokeWidth={2.5} />
                            <span><strong>{plan.max_combos === 9999 ? 'Unlimited' : plan.max_combos}</strong> Combos & Thali Deals</span>
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
                            <span style={{ color: plan.kds_enabled ? '#334155' : '#94A3B8' }}>Kitchen Display Screen (KDS)</span>
                          </div>
                        </>
                      )}
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
                <div>{restaurantInfo?.name || 'Business Partner'}</div>
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
