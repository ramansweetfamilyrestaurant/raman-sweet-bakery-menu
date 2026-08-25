import React, { useState, useEffect } from 'react';
import { 
  Crown, Sparkles, ExternalLink, Edit3, Trash2, CheckCircle, XCircle, 
  Utensils, MapPin, Phone, UserCheck, ShieldAlert, Key, DollarSign, 
  CreditCard, Activity, Shield, Info, Layers, RefreshCw, AlertTriangle, 
  Calendar, Check, Copy, FileText, ChevronRight, Lock, Eye, MessageSquare,
  QrCode, Store, Send, Clock, BarChart3, Radio
} from 'lucide-react';
import Drawer from '../components/Drawer';
import StatusBadge from '../components/StatusBadge';
import { getBusinessCategoryMeta, getBusinessCategoryLabel, getBusinessCategoryEmoji } from '../../../constants/businessCategories';
import '../styles/SuperAdmin.css';

const getRestaurantLogoUrl = (logo) => {
  if (!logo) return '/images/default-logo.webp';
  if (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('/')) {
    return logo;
  }
  return `/api/r2-proxy/superadmin/branding/${logo}`;
};

export default function TenantDetailsView({ 
  resto, 
  isOpen, 
  onClose, 
  onImpersonate, 
  onEdit, 
  onGrantFree, 
  onRevokeFree, 
  onToggleActive, 
  onDelete,
  token 
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [t360Data, setT360Data] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [copiedKey, setCopiedKey] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && resto?.id) {
      fetchTenant360(resto.id);
    } else {
      setT360Data(null);
      setActiveTab('overview');
      setDeleteConfirm(false);
    }
  }, [isOpen, resto?.id]);

  const fetchTenant360 = async (tenantId) => {
    setLoading(true);
    setFetchErr('');
    try {
      const authToken = token || localStorage.getItem('saas_super_token') || localStorage.getItem('touchqr_superadmin_token') || sessionStorage.getItem('saas_super_token');
      const res = await fetch(`/api/superadmin/restaurants/${tenantId}/360`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to load 360 data (Status ${res.status})`);
      }
      const data = await res.json();
      setT360Data(data);
    } catch (err) {
      console.warn('Shop 360 fetch warning, falling back to local props:', err.message);
      setFetchErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!resto) return null;

  // Resolved merged objects (prefer real-time 360 data, fallback to list item)
  const tenant = t360Data?.tenant || resto;
  const owner = t360Data?.owner || {
    owner_name: resto.owner_name,
    phone: resto.phone,
    owner_email: resto.owner_email,
    username: resto.owner_username || 'admin'
  };
  const sub = t360Data?.subscription || {
    plan_tier: resto.plan_tier || 'pro',
    plan_name: `${(resto.plan_tier || 'pro').toUpperCase()} Plan`,
    plan_price: resto.plan_price || 999,
    status: resto.subscription_status || (resto.active !== false ? 'active' : 'expired'),
    subscription_type: resto.subscription_type || 'PAID',
    auto_renew: resto.auto_renew !== 0 && resto.auto_renew !== false,
    access_until: resto.access_until || resto.plan_expires_at,
    is_complimentary: resto.subscription_type === 'ADMIN_GRANTED' || resto.mandate_status === 'admin_granted'
  };
  const billing = t360Data?.billing || {
    total_successful_payments: 0,
    total_successful_amount: 0,
    total_failed_payments: 0,
    transactions: []
  };
  const usage = t360Data?.usage || {
    dishes: { current: resto.dish_count || 0, limit: 500, percentage: Math.min(100, Math.round(((resto.dish_count || 0) / 500) * 100)) },
    categories: { current: resto.category_count || 0, limit: 50, percentage: Math.min(100, Math.round(((resto.category_count || 0) / 50) * 100)) },
    tables: { current: Number(resto.total_tables || 0), limit: 100, percentage: Math.min(100, Math.round((Number(resto.total_tables || 0) / 100) * 100)) },
    cabins: Number(resto.total_cabins || 0),
    rooms: Number(resto.total_rooms || 0),
    vip_tables: Number(resto.total_vip || 0),
    orders: resto.order_count || 0,
    scan_count: resto.scan_count || 0,
    entitlements: {
      online_ordering_enabled: true,
      custom_branding_enabled: true,
      multi_table_management: true,
      kds_live_view: true,
      inventory_alerts: true,
      priority_whatsapp_support: true
    }
  };
  const activity = t360Data?.activity || [];
  const security = t360Data?.security || {
    account_status: resto.active !== false ? 'ACTIVE' : 'SUSPENDED',
    impersonation_allowed: true,
    auto_renew_enabled: sub.auto_renew
  };
  const support = t360Data?.support || {
    notes: "Internal shop operational profile active and healthy."
  };

  const isLifetime = sub.is_complimentary || sub.subscription_type === 'ADMIN_GRANTED' || (sub.access_until && new Date(sub.access_until).getFullYear() > 2030);
  const publicMenuUrl = `${window.location.origin}/${tenant.subdomain || tenant.slug}`;

  // Filtered transactions
  const filteredTransactions = (billing.transactions || []).filter(tx => {
    if (paymentFilter === 'all') return true;
    if (paymentFilter === 'success') return tx.status === 'SUCCESS' || tx.status === 'PAID' || tx.status === 'COMPLETED';
    if (paymentFilter === 'failed') return tx.status === 'FAILED' || tx.status === 'ERROR' || tx.status === 'CANCELLED';
    if (paymentFilter === 'recurring') return tx.payment_type === 'recurring' || tx.payment_type === 'subscription';
    return true;
  });

  // Filtered activity
  const filteredActivity = (activity || []).filter(act => {
    if (activityFilter === 'all') return true;
    const actUpper = (act.action || '').toUpperCase();
    if (activityFilter === 'billing') return actUpper.includes('PAYMENT') || actUpper.includes('RENEW') || actUpper.includes('CANCEL');
    if (activityFilter === 'security') return actUpper.includes('IMPERSONAT') || actUpper.includes('SUSPEND') || actUpper.includes('LOGIN');
    if (activityFilter === 'vip') return actUpper.includes('VIP') || actUpper.includes('FREE');
    if (activityFilter === 'tenant') return actUpper.includes('TENANT') || actUpper.includes('EMAIL') || actUpper.includes('UPDATE');
    return true;
  });

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={tenant.name}
      subtitle={`Shop 360° Profile • ID #${tenant.id} • /${tenant.slug}`}
      width="720px"
    >
      {/* 🌟 1. SIGNATURE LUXURY 360 BRAND HERO HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)',
        color: '#FFFFFF',
        borderRadius: '20px',
        padding: '20px 18px',
        marginBottom: '18px',
        border: '1.5px solid rgba(212, 175, 55, 0.45)',
        boxShadow: '0 8px 24px rgba(10, 35, 21, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle Background Glow */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: '140px', height: '140px', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', position: 'relative', zIndex: 1 }}>
          {/* Left: Shop Identity & Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: '1 1 240px' }}>
            <img
              src={getRestaurantLogoUrl(tenant.logo)}
              alt={tenant.name}
              onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
              style={{
                width: '54px', height: '54px', borderRadius: '14px',
                objectFit: 'cover', background: '#FFFFFF', padding: '2px',
                border: '2px solid #D4AF37', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                flexShrink: 0
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                  {tenant.name}
                </h3>
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900,
                  background: tenant.active !== false ? '#10B981' : '#EF4444', color: '#FFFFFF',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  {tenant.active !== false ? '🟢 ACTIVE' : '🔴 SUSPENDED'}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900,
                  background: 'rgba(212, 175, 55, 0.15)', color: '#DFBA67', border: '1px solid rgba(212, 175, 55, 0.4)',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  {getBusinessCategoryEmoji(tenant.business_category)} {getBusinessCategoryLabel(tenant.business_category).toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.80rem', color: '#DFBA67', fontWeight: 800 }}>
                  /{tenant.slug}
                </span>
                <span style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 600 }}>
                  ID: #{tenant.id}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Impersonate Command */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onImpersonate(tenant.id, tenant.name)}
              className="sa-btn"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
                color: '#0A2315',
                fontWeight: 900,
                fontSize: '0.78rem',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="1-Click Log In as Restaurant Owner"
            >
              <Crown size={14} color="#0A2315" /> 1-Click Login (Owner)
            </button>
            <span style={{ fontSize: '0.68rem', color: '#A7F3D0', fontWeight: 700 }}>
              👑 {sub.plan_tier?.toUpperCase()} PLAN {isLifetime ? '• COMPLIMENTARY' : `• ₹${sub.plan_price}/mo`}
            </span>
          </div>
        </div>

        {/* 4 High-Impact Live Stat Cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px', marginTop: '16px', paddingTop: '14px',
          borderTop: '1px solid rgba(255,255,255,0.12)'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>SUBSCRIPTION STATUS</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: sub.status === 'active' ? '#34D399' : '#FBBF24', textTransform: 'uppercase', marginTop: '2px' }}>
              {sub.status || 'ACTIVE'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>AUTO DEBIT MANDATE</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: sub.auto_renew ? '#34D399' : '#F87171', marginTop: '2px' }}>
              {sub.auto_renew ? '✅ ON (Active)' : '❌ OFF (Disabled)'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>ACCESS UNTIL / EXPIRY</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#60A5FA', marginTop: '2px' }}>
              {isLifetime ? '♾️ Lifetime VIP' : sub.access_until ? new Date(sub.access_until).toLocaleDateString('en-IN') : 'Active'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>QR SCANS & ORDERS</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#F472B6', marginTop: '2px' }}>
              📲 {usage.scan_count || 0} Scans • {usage.orders || 0} Orders
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 2. ENHANCED LUXURY NAVIGATION TAB STRIP */}
      <div 
        className="sa-filter-pills-strip"
        style={{
          display: 'flex', gap: '6px',
          marginBottom: '18px', paddingBottom: '4px',
          borderBottom: '1px solid var(--sa-border)'
        }}
      >
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'subscription', label: 'Subscription', icon: Crown },
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'usage', label: 'Usage & Limits', icon: Utensils },
          { id: 'activity', label: 'Audit Trail', icon: Activity },
          { id: 'security', label: 'Security & Controls', icon: Shield }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="sa-filter-pill-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', fontWeight: 800, fontSize: '0.78rem',
                borderRadius: '10px', border: isActive ? '1.5px solid #D4AF37' : '1px solid var(--sa-border)',
                background: isActive ? '#0A2315' : '#FFFFFF',
                color: isActive ? '#DFBA67' : 'var(--sa-text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 8px rgba(10,35,21,0.15)' : 'none'
              }}
            >
              <Icon size={14} color={isActive ? '#DFBA67' : 'currentColor'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--sa-text-muted)', fontSize: '0.84rem', background: '#F8FAFC', borderRadius: '12px', marginBottom: '14px' }}>
          ⚡ Fetching latest real-time Shop 360 metrics & audit data...
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAB: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Quick Menu URL & QR Preview Strip */}
          <div style={{
            background: '#F8FAFC', padding: '14px', borderRadius: '14px',
            border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <QrCode size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '0.84rem', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Live Customer Menu Link
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {publicMenuUrl}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => copyToClipboard(publicMenuUrl, 'menu_url')}
                className="sa-btn sa-btn-secondary sa-btn-sm"
                style={{ fontSize: '0.74rem', padding: '6px 10px', fontWeight: 800 }}
              >
                {copiedKey === 'menu_url' ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                <span>{copiedKey === 'menu_url' ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <a
                href={`/${tenant.subdomain || tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sa-btn sa-btn-primary sa-btn-sm"
                style={{ fontSize: '0.74rem', padding: '6px 10px', fontWeight: 800, textDecoration: 'none' }}
              >
                <ExternalLink size={13} />
                <span>Open Menu</span>
              </a>
            </div>
          </div>

          {/* Business & Owner Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.84rem' }}>
            {/* Business Category */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>BUSINESS CATEGORY</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '1.2rem' }}>{getBusinessCategoryEmoji(tenant.business_category)}</span>
                <div>
                  <strong style={{ color: 'var(--sa-text-main)', fontSize: '0.88rem', display: 'block' }}>
                    {getBusinessCategoryLabel(tenant.business_category)}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                    {getBusinessCategoryMeta(tenant.business_category).description}
                  </span>
                </div>
              </div>
            </div>

            {/* Owner Name */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER FULL NAME</span>
              <strong style={{ color: 'var(--sa-text-main)', fontSize: '0.90rem' }}>{owner.owner_name || tenant.name || 'Not Provided'}</strong>
            </div>

            {/* Username with Copy */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER USERNAME</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: 'var(--sa-text-main)' }}>{owner.username || 'admin'}</strong>
                <button
                  type="button"
                  onClick={() => copyToClipboard(owner.username || 'admin', 'username')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                  title="Copy Username"
                >
                  {copiedKey === 'username' ? <Check size={14} color="#16A34A" /> : <Copy size={14} color="var(--sa-text-muted)" />}
                </button>
              </div>
            </div>

            {/* Contact Mobile with WhatsApp & Call */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>CONTACT MOBILE</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--sa-text-main)' }}>{owner.phone || 'Not Provided'}</strong>
                {owner.phone && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <a
                      href={`https://wa.me/${owner.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.70rem', color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, textDecoration: 'none' }}
                    >
                      💬 WhatsApp
                    </a>
                    <a
                      href={`tel:${owner.phone}`}
                      style={{ fontSize: '0.70rem', color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, textDecoration: 'none' }}
                    >
                      📞 Call
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Owner Email */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER EMAIL ADDRESS</span>
              <div style={{ marginTop: '2px' }}>
                {owner.owner_email ? (
                  <a href={`mailto:${owner.owner_email}`} style={{ color: 'var(--sa-primary)', fontWeight: 800, fontSize: '0.84rem', textDecoration: 'none' }}>
                    ✉️ {owner.owner_email}
                  </a>
                ) : (
                  <span style={{ color: 'var(--sa-text-muted)', fontSize: '0.82rem' }}>✉️ Email not configured</span>
                )}
              </div>
            </div>

            {/* Business Type */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>BUSINESS / CUISINE TYPE</span>
              <strong style={{ textTransform: 'capitalize', fontSize: '0.88rem', color: 'var(--sa-text-main)', marginTop: '2px', display: 'block' }}>
                🍴 {tenant.business_type || 'Family Restaurant & Bakery'}
              </strong>
            </div>

            {/* Total Tables & Cabins */}
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>FACILITY SPACES</span>
              <strong style={{ color: 'var(--sa-text-main)', fontSize: '0.88rem', marginTop: '2px', display: 'block' }}>
                🪑 {usage.tables.current} Tables • 🚪 {usage.cabins} Cabins • 🏨 {usage.rooms} Rooms
              </strong>
            </div>
          </div>

          {tenant.address && (
            <div style={{ fontSize: '0.84rem', background: 'var(--sa-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block', marginBottom: '2px' }}>PHYSICAL STORE ADDRESS</span>
              <span style={{ color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} color="#EF4444" /> {tenant.address}
              </span>
            </div>
          )}

          {/* Quick Admin Actions Row */}
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '10px' }}>
              ⚡ Quick Administrative Shortcuts
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <button
                type="button"
                onClick={() => onImpersonate(tenant.id, tenant.name)}
                className="sa-btn sa-btn-accent"
                style={{ padding: '10px 14px', fontSize: '0.80rem', fontWeight: 800 }}
              >
                <Crown size={14} /> 1-Click Login (Owner)
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onEdit(tenant); }}
                className="sa-btn sa-btn-secondary"
                style={{ padding: '10px 14px', fontSize: '0.80rem', fontWeight: 800 }}
              >
                <Edit3 size={14} /> Edit Restaurant Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: SUBSCRIPTION */}
      {/* ========================================================================= */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Current SaaS Plan:</span>
              <strong style={{ color: 'var(--sa-primary)', fontSize: '0.94rem' }}>{sub.plan_name || sub.plan_tier?.toUpperCase()}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Monthly Recurring Fee:</span>
              <strong style={{ fontSize: '0.94rem' }}>{isLifetime ? '₹0 / Complimentary' : `₹${sub.plan_price} / month`}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Subscription Type:</span>
              <strong style={{ color: sub.is_complimentary ? '#7E22CE' : 'var(--sa-text-main)' }}>
                {sub.is_complimentary ? '🎁 Complimentary VIP' : sub.subscription_type || 'PAID SAAS'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Auto-Debit Mandate:</span>
              <strong style={{ color: sub.auto_renew ? '#15803D' : '#DC2626' }}>
                {sub.auto_renew ? '✅ Active (Auto-Renew Enabled)' : '❌ Inactive (Auto-Renew Disabled)'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Trial Validity:</span>
              <span style={{ fontWeight: 800 }}>
                {sub.trial_start && sub.trial_end ? (
                  `${new Date(sub.trial_start).toLocaleDateString('en-IN')} → ${new Date(sub.trial_end).toLocaleDateString('en-IN')}`
                ) : 'Standard 16 Days Free Trial'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Access Expiry Date:</span>
              <strong style={{ color: '#2563EB', fontSize: '0.94rem' }}>
                {isLifetime ? '♾️ Lifetime VIP Access' : sub.access_until ? new Date(sub.access_until).toLocaleDateString('en-IN') : 'Active'}
              </strong>
            </div>
          </div>

          {sub.cancel_requested_at && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem' }}>
              <strong>⚠️ Auto-Renew Turned Off:</strong> Cancellation requested on {new Date(sub.cancel_requested_at).toLocaleDateString('en-IN')}. Full access continues until {sub.access_until ? new Date(sub.access_until).toLocaleDateString('en-IN') : 'period end'}.
            </div>
          )}

          {sub.scheduled_plan_key && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem' }}>
              <strong>📋 Scheduled Plan Switch:</strong> Changing to {sub.scheduled_plan_key.toUpperCase()} at next billing boundary.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB: PAYMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '12px', borderRadius: '14px' }}>
              <span style={{ fontSize: '0.68rem', color: '#065F46', fontWeight: 800, textTransform: 'uppercase' }}>SUCCESSFUL REVENUE</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#047857', marginTop: '2px' }}>
                ₹{billing.total_successful_amount} ({billing.total_successful_payments} tx)
              </div>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px', borderRadius: '14px' }}>
              <span style={{ fontSize: '0.68rem', color: '#991B1B', fontWeight: 800, textTransform: 'uppercase' }}>FAILED ATTEMPTS</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#B91C1C', marginTop: '2px' }}>
                {billing.total_failed_payments} transactions
              </div>
            </div>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '12px', borderRadius: '14px' }}>
              <span style={{ fontSize: '0.68rem', color: '#1E40AF', fontWeight: 800, textTransform: 'uppercase' }}>LATEST CHARGE</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1D4ED8', marginTop: '2px' }}>
                {billing.latest_payment ? `₹${billing.latest_payment.amount}` : 'None Recorded'}
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'success', 'failed', 'recurring'].map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setPaymentFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800,
                  border: paymentFilter === f ? '1px solid var(--sa-primary)' : '1px solid var(--sa-border)',
                  background: paymentFilter === f ? 'var(--sa-primary)' : '#FFFFFF',
                  color: paymentFilter === f ? '#FFFFFF' : 'var(--sa-text-muted)',
                  cursor: 'pointer', textTransform: 'capitalize'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Transaction Table */}
          {filteredTransactions.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--sa-text-muted)', fontSize: '0.84rem', background: '#F8FAFC', borderRadius: '14px', border: '1px dashed #CBD5E1' }}>
              No payment transactions matching filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--sa-border)', borderRadius: '14px', background: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--sa-border)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>DATE</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>AMOUNT</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>TYPE</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--sa-text-muted)', whiteSpace: 'nowrap' }}>
                        {tx.paid_at ? new Date(tx.paid_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                        ₹{tx.amount} {tx.currency || 'INR'}
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: '#475569' }}>
                        {tx.payment_type || 'Subscription'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 900,
                          background: (tx.status === 'SUCCESS' || tx.status === 'PAID') ? '#DCFCE7' : '#FEE2E2',
                          color: (tx.status === 'SUCCESS' || tx.status === 'PAID') ? '#15803D' : '#DC2626'
                        }}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: USAGE & LIMITS */}
      {/* ========================================================================= */}
      {activeTab === 'usage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Numeric Usage vs SaaS Plan Limits */}
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '14px' }}>
              📊 Resource Consumption vs Plan Quotas
            </span>

            {/* Dishes Bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Utensils size={14} color="#059669" /> Menu Dishes Hosted
                </span>
                <span style={{ color: 'var(--sa-primary)' }}>{usage.dishes.current} / {usage.dishes.limit} items ({usage.dishes.percentage}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${usage.dishes.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Categories Bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="#2563EB" /> Menu Categories
                </span>
                <span style={{ color: '#2563EB' }}>{usage.categories.current} / {usage.categories.limit} ({usage.categories.percentage}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${usage.categories.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #3B82F6, #2563EB)', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Tables Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Store size={14} color="#D97706" /> Dine-In Tables
                </span>
                <span style={{ color: '#D97706' }}>{usage.tables.current} / {usage.tables.limit} ({usage.tables.percentage}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${usage.tables.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          {/* Feature Entitlements Matrix */}
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '12px' }}>
              👑 Authoritative Plan Feature Matrix
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.80rem' }}>
              {Object.entries(usage.entitlements || {}).map(([key, enabled]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  {enabled ? <CheckCircle size={15} color="#16A34A" /> : <XCircle size={15} color="#DC2626" />}
                  <span style={{ textTransform: 'capitalize', color: enabled ? 'var(--sa-text-main)' : 'var(--sa-text-muted)', fontWeight: 700 }}>
                    {key.replace(/_enabled/g, '').replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB: AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'billing', 'security', 'vip', 'tenant'].map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setActivityFilter(f)}
                style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800,
                  border: activityFilter === f ? '1px solid var(--sa-primary)' : '1px solid var(--sa-border)',
                  background: activityFilter === f ? 'var(--sa-primary)' : '#FFFFFF',
                  color: activityFilter === f ? '#FFFFFF' : 'var(--sa-text-muted)',
                  cursor: 'pointer', textTransform: 'capitalize'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Timeline List */}
          {filteredActivity.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--sa-text-muted)', fontSize: '0.84rem', background: '#F8FAFC', borderRadius: '14px', border: '1px dashed #CBD5E1' }}>
              No audit logs recorded matching this filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredActivity.map(act => (
                <div key={act.id} style={{
                  background: '#FFFFFF', padding: '12px 14px',
                  borderRadius: '12px', border: '1px solid var(--sa-border)', fontSize: '0.82rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <strong style={{ color: 'var(--sa-text-main)', fontSize: '0.84rem' }}>
                      {act.action}
                    </strong>
                    <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                      {act.timestamp ? new Date(act.timestamp).toLocaleString('en-IN') : 'N/A'}
                    </span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.78rem', lineHeight: 1.35 }}>
                    {act.details}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.68rem', color: 'var(--sa-text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>
                    Actor: <span style={{ color: '#2563EB' }}>{act.actor || 'System'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB: SECURITY & CONTROLS */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid var(--sa-border)', fontSize: '0.84rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '10px' }}>
              🛡️ Account Security & Health
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span>Account Status:</span>
              <strong style={{ color: security.account_status === 'ACTIVE' ? '#15803D' : '#DC2626' }}>
                {security.account_status}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span>Impersonation Support:</span>
              <strong style={{ color: '#15803D' }}>Granted (Master Super Admin)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Auto-Renew Mandate:</span>
              <strong>{security.auto_renew_enabled ? 'Active Mandate' : 'Turned Off'}</strong>
            </div>
          </div>

          {/* Master Actions Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onImpersonate(tenant.id, tenant.name)}
              className="sa-btn sa-btn-accent"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '12px' }}
            >
              <Crown size={18} /> 1-Click Log In as Restaurant Owner (Manage Menu)
            </button>

            <button
              type="button"
              onClick={() => { onClose(); onEdit(tenant); }}
              className="sa-btn sa-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '12px' }}
            >
              <Edit3 size={18} /> Edit Restaurant Details, Owner Email & Credentials
            </button>

            {sub.is_complimentary ? (
              <button
                type="button"
                onClick={() => { onClose(); onRevokeFree(tenant); }}
                className="sa-btn sa-btn-danger"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '12px' }}
              >
                <ShieldAlert size={18} /> Revoke Complimentary Free Access (Revert to Paid)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { onClose(); onGrantFree(tenant); }}
                className="sa-btn sa-btn-primary"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '12px' }}
              >
                <Sparkles size={18} /> Grant Complimentary VIP Free Access (₹0)
              </button>
            )}

            <button
              type="button"
              onClick={() => { onClose(); onToggleActive(tenant.id, tenant.active); }}
              className={`sa-btn ${tenant.active === false ? 'sa-btn-primary' : 'sa-btn-danger'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '12px' }}
            >
              {tenant.active === false ? (
                <><CheckCircle size={18} /> 🟢 Unsuspend & Activate Restaurant</>
              ) : (
                <><XCircle size={18} /> 🔴 Suspend Shop Access</>
              )}
            </button>

            {/* Permanent Delete Guard */}
            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
                  padding: '12px 16px', borderRadius: '12px', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginTop: '10px'
                }}
              >
                <Trash2 size={16} /> Delete Restaurant Account
              </button>
            ) : (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '14px', borderRadius: '14px', marginTop: '10px' }}>
                <span style={{ fontSize: '0.82rem', color: '#991B1B', fontWeight: 900, display: 'block', marginBottom: '10px' }}>
                  ⚠️ DANGER: This permanently deletes all dishes, categories, orders & tenant data!
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { onClose(); onDelete(tenant.id, tenant.name); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 900, cursor: 'pointer' }}
                  >
                    Confirm Permanent Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
