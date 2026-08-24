import React, { useState, useEffect } from 'react';
import { 
  Crown, Sparkles, ExternalLink, Edit3, Trash2, CheckCircle, XCircle, 
  Utensils, MapPin, Phone, UserCheck, ShieldAlert, Key, DollarSign, 
  CreditCard, Activity, Shield, Info, Layers, RefreshCw, AlertTriangle, 
  Calendar, Check, Copy, FileText, ChevronRight, Lock, Eye
} from 'lucide-react';
import Drawer from '../components/Drawer';
import StatusBadge from '../components/StatusBadge';
import '../styles/SuperAdmin.css';

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
      console.warn('Tenant 360 fetch warning, falling back to local props:', err.message);
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
    dishes: { current: resto.dish_count || 0, limit: 500, percentage: 0 },
    categories: { current: 0, limit: 50, percentage: 0 },
    tables: { current: Number(resto.total_tables || 0), limit: 100, percentage: 0 },
    cabins: Number(resto.total_cabins || 0),
    rooms: Number(resto.total_rooms || 0),
    vip_tables: Number(resto.total_vip || 0),
    orders: 0,
    scan_count: resto.scan_count || 0,
    entitlements: {}
  };
  const activity = t360Data?.activity || [];
  const security = t360Data?.security || {
    account_status: resto.active !== false ? 'ACTIVE' : 'SUSPENDED',
    impersonation_allowed: true,
    auto_renew_enabled: sub.auto_renew
  };
  const support = t360Data?.support || {
    notes: "Internal tenant notes: not currently available."
  };

  const isLifetime = sub.is_complimentary || sub.subscription_type === 'ADMIN_GRANTED' || (sub.access_until && new Date(sub.access_until).getFullYear() > 2030);

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
      subtitle={`Tenant ID #${tenant.id} • Slug: /${tenant.slug}`}
      width="680px"
    >
      {/* 🌟 STICKY STATUS & QUICK SUMMARY HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '18px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
              color: '#000000', fontWeight: 900, fontSize: '1.3rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF' }}>{tenant.name}</h3>
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900,
                  background: tenant.active ? '#10B981' : '#EF4444', color: '#FFFFFF'
                }}>
                  {tenant.active ? '🟢 ACTIVE' : '🔴 SUSPENDED'}
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#DFBA67', fontWeight: 700 }}>
                /{tenant.slug}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Current Plan</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#FCD34D' }}>
              👑 {sub.plan_tier.toUpperCase()} {isLifetime ? '(FREE VIP)' : `(₹${sub.plan_price}/mo)`}
            </div>
          </div>
        </div>

        {/* 4 Quick Stat Metric Badges */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '8px', marginTop: '14px', paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 800 }}>SUBSCRIPTION</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: sub.status === 'active' ? '#34D399' : '#FBBF24', textTransform: 'uppercase' }}>
              {sub.status || 'ACTIVE'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 800 }}>AUTO DEBIT</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: sub.auto_renew ? '#34D399' : '#F87171' }}>
              {sub.auto_renew ? '✅ ON' : '❌ OFF'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 800 }}>ACCESS UNTIL</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#60A5FA' }}>
              {isLifetime ? '♾️ Lifetime' : sub.access_until ? new Date(sub.access_until).toLocaleDateString('en-IN') : 'N/A'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 800 }}>TOTAL DISHES</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#A78BFA' }}>
              🍽️ {usage.dishes.current} items
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 TAB NAVIGATION BAR */}
      <div style={{
        display: 'flex', gap: '4px', borderBottom: '1px solid var(--sa-border)',
        marginBottom: '16px', overflowX: 'auto', paddingBottom: '2px'
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'subscription', label: 'Subscription', icon: Crown },
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'usage', label: 'Usage & Limits', icon: Utensils },
          { id: 'activity', label: 'Activity Log', icon: Activity },
          { id: 'security', label: 'Security & Actions', icon: Shield }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 13px', fontWeight: 800, fontSize: '0.8rem',
                border: 'none', background: 'transparent',
                borderBottom: isActive ? '2.5px solid var(--sa-primary)' : '2.5px solid transparent',
                color: isActive ? 'var(--sa-primary)' : 'var(--sa-text-muted)',
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--sa-text-muted)', fontSize: '0.82rem' }}>
          ⚡ Loading complete real-time Tenant 360 profile...
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAB: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Business & Owner Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER FULL NAME</span>
              <strong style={{ color: 'var(--sa-text-main)' }}>{owner.owner_name || tenant.name || 'Not Provided'}</strong>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER USERNAME</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontFamily: 'monospace' }}>{owner.username || 'admin'}</strong>
                <button
                  onClick={() => copyToClipboard(owner.username || 'admin', 'username')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  title="Copy Username"
                >
                  {copiedKey === 'username' ? <Check size={13} color="var(--sa-success)" /> : <Copy size={13} color="var(--sa-text-muted)" />}
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>CONTACT MOBILE</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{owner.phone || 'Not Provided'}</strong>
                {owner.phone && (
                  <a
                    href={`https://wa.me/${owner.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 800, textDecoration: 'none' }}
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER EMAIL</span>
              <strong style={{ color: owner.owner_email ? 'var(--sa-text-main)' : 'var(--sa-text-muted)' }}>
                {owner.owner_email ? `✉️ ${owner.owner_email}` : '✉️ Email not added'}
              </strong>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>BUSINESS TYPE</span>
              <strong style={{ textTransform: 'capitalize' }}>{tenant.business_type || 'Restaurant'}</strong>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>TOTAL QR SCANS</span>
              <strong style={{ color: 'var(--sa-purple)' }}>📲 {tenant.scan_count || 0} Scans</strong>
            </div>
          </div>

          {tenant.address && (
            <div style={{ fontSize: '0.82rem', background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>RESTAURANT ADDRESS</span>
              <span>{tenant.address}</span>
            </div>
          )}

          {/* Quick Actions Panel */}
          <div style={{ background: 'var(--sa-surface-subtle)', padding: '14px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 900, display: 'block', marginBottom: '10px' }}>
              ⚡ QUICK ADMINISTRATIVE ACTIONS
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => onImpersonate(tenant.id, tenant.name)}
                className="sa-btn sa-btn-accent"
                style={{ padding: '8px 12px', fontSize: '0.78rem' }}
              >
                <Crown size={14} /> 1-Click Login (Owner)
              </button>
              <button
                onClick={() => window.open(`/r/${tenant.slug}`, '_blank')}
                className="sa-btn sa-btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.78rem' }}
              >
                <ExternalLink size={14} /> Preview Live Menu
              </button>
            </div>
          </div>

          {/* Internal Notes Display */}
          <div style={{ fontSize: '0.78rem', background: '#F8FAFC', padding: '12px', borderRadius: 'var(--sa-radius-md)', border: '1px dashed #CBD5E1', color: '#64748B' }}>
            <strong>📝 Internal Tenant Notes:</strong> {support.notes}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: SUBSCRIPTION */}
      {/* ========================================================================= */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div style={{ background: 'var(--sa-surface-subtle)', padding: '14px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Current SaaS Plan:</span>
              <strong style={{ color: 'var(--sa-success)' }}>{sub.plan_name || sub.plan_tier.toUpperCase()}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Subscription Amount:</span>
              <strong>{isLifetime ? '₹0 / Complimentary' : `₹${sub.plan_price} / month`}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Subscription Model:</span>
              <strong style={{ color: sub.is_complimentary ? 'var(--sa-purple)' : 'var(--sa-text-main)' }}>
                {sub.is_complimentary ? '🎁 Complimentary VIP' : sub.subscription_type || 'PAID'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Auto-Debit / Mandate:</span>
              <strong style={{ color: sub.auto_renew ? 'var(--sa-success)' : 'var(--sa-danger)' }}>
                {sub.auto_renew ? '✅ Active (ON)' : '❌ Turn Off (Disabled)'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Trial Period:</span>
              <span>
                {sub.trial_start && sub.trial_end ? (
                  `${new Date(sub.trial_start).toLocaleDateString('en-IN')} → ${new Date(sub.trial_end).toLocaleDateString('en-IN')}`
                ) : 'Standard 16 Days'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Current Period:</span>
              <span>
                {sub.current_period_start && sub.current_period_end ? (
                  `${new Date(sub.current_period_start).toLocaleDateString('en-IN')} → ${new Date(sub.current_period_end).toLocaleDateString('en-IN')}`
                ) : sub.access_until ? `Until ${new Date(sub.access_until).toLocaleDateString('en-IN')}` : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Access Expiry Date:</span>
              <strong style={{ color: 'var(--sa-primary)' }}>
                {isLifetime ? '♾️ Lifetime Access' : sub.access_until ? new Date(sub.access_until).toLocaleDateString('en-IN') : 'N/A'}
              </strong>
            </div>
          </div>

          {sub.cancel_requested_at && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '12px', borderRadius: 'var(--sa-radius-md)', fontSize: '0.82rem' }}>
              <strong>⚠️ Auto-Renew Turned Off:</strong> Cancellation requested on {new Date(sub.cancel_requested_at).toLocaleDateString('en-IN')}. Full access continues until {sub.access_until ? new Date(sub.access_until).toLocaleDateString('en-IN') : 'period end'}.
            </div>
          )}

          {sub.scheduled_plan_key && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '12px', borderRadius: 'var(--sa-radius-md)', fontSize: '0.82rem' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 12px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.7rem', color: '#065F46', fontWeight: 800 }}>SUCCESSFUL</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#047857' }}>
                {billing.total_successful_payments} (₹{billing.total_successful_amount})
              </div>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '10px 12px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.7rem', color: '#991B1B', fontWeight: 800 }}>FAILED</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#B91C1C' }}>
                {billing.total_failed_payments} tx
              </div>
            </div>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 12px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.7rem', color: '#1E40AF', fontWeight: 800 }}>LATEST</span>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1D4ED8' }}>
                {billing.latest_payment ? `₹${billing.latest_payment.amount}` : 'None'}
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'success', 'failed', 'recurring'].map(f => (
              <button
                key={f}
                onClick={() => setPaymentFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: '0.74rem', fontWeight: 800,
                  border: paymentFilter === f ? '1px solid var(--sa-primary)' : '1px solid var(--sa-border)',
                  background: paymentFilter === f ? 'var(--sa-primary)' : 'var(--sa-surface)',
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
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sa-text-muted)', fontSize: '0.84rem', background: 'var(--sa-surface-subtle)', borderRadius: '12px' }}>
              No payment transactions yet for this tenant.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--sa-border)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--sa-surface-subtle)', borderBottom: '1px solid var(--sa-border)' }}>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px' }}>Amount</th>
                    <th style={{ padding: '8px 12px' }}>Type</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--sa-border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--sa-text-muted)' }}>
                        {tx.paid_at ? new Date(tx.paid_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 800 }}>
                        ₹{tx.amount} {tx.currency || 'INR'}
                      </td>
                      <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>
                        {tx.payment_type || 'Subscription'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800,
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
          <div style={{ background: 'var(--sa-surface-subtle)', padding: '14px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 900, display: 'block', marginBottom: '12px' }}>
              📊 RESOURCE USAGE VS SAAS PLAN LIMITS
            </span>

            {/* Dishes Bar */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px' }}>
                <span>Dishes Hosted</span>
                <span style={{ color: 'var(--sa-primary)' }}>{usage.dishes.current} / {usage.dishes.limit} ({usage.dishes.percentage}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${usage.dishes.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Categories Bar */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px' }}>
                <span>Menu Categories</span>
                <span style={{ color: 'var(--sa-primary)' }}>{usage.categories.current} / {usage.categories.limit} ({usage.categories.percentage}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${usage.categories.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #3B82F6, #2563EB)', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Tables Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px' }}>
                <span>Tables Managed</span>
                <span style={{ color: 'var(--sa-primary)' }}>{usage.tables.current} / {usage.tables.limit} ({usage.tables.percentage}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${usage.tables.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          {/* Feature Entitlements Matrix */}
          <div style={{ background: 'var(--sa-surface-subtle)', padding: '14px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 900, display: 'block', marginBottom: '10px' }}>
              👑 FEATURE ENTITLEMENTS (AUTHORITATIVE SAAS PLAN)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
              {Object.entries(usage.entitlements || {}).map(([key, enabled]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--sa-border)' }}>
                  {enabled ? <Check size={14} color="#16A34A" /> : <XCircle size={14} color="#DC2626" />}
                  <span style={{ textTransform: 'capitalize', color: enabled ? 'var(--sa-text-main)' : 'var(--sa-text-muted)' }}>
                    {key.replace(/_enabled/g, '').replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB: ACTIVITY & AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'billing', 'security', 'vip', 'tenant'].map(f => (
              <button
                key={f}
                onClick={() => setActivityFilter(f)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800,
                  border: activityFilter === f ? '1px solid var(--sa-primary)' : '1px solid var(--sa-border)',
                  background: activityFilter === f ? 'var(--sa-primary)' : 'var(--sa-surface)',
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
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--sa-text-muted)', fontSize: '0.84rem', background: 'var(--sa-surface-subtle)', borderRadius: '12px' }}>
              No audit activities recorded for this filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredActivity.map(act => (
                <div key={act.id} style={{
                  background: 'var(--sa-surface-subtle)', padding: '10px 12px',
                  borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.8rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--sa-text-main)', fontSize: '0.82rem' }}>
                      {act.action}
                    </strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)' }}>
                      {act.timestamp ? new Date(act.timestamp).toLocaleString('en-IN') : 'N/A'}
                    </span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.78rem', lineHeight: 1.3 }}>
                    {act.details}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.68rem', color: 'var(--sa-text-muted)', textTransform: 'uppercase' }}>
                    Actor: <strong>{act.actor}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB: SECURITY & ACTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ background: 'var(--sa-surface-subtle)', padding: '14px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)', fontSize: '0.82rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 900, display: 'block', marginBottom: '8px' }}>
              🛡️ SECURITY & ACCESS STATUS
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span>Account Status:</span>
              <strong style={{ color: security.account_status === 'ACTIVE' ? 'var(--sa-success)' : 'var(--sa-danger)' }}>
                {security.account_status}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span>Impersonation Support:</span>
              <strong style={{ color: 'var(--sa-success)' }}>Available (Global Super Admin)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Auto-Renew Protection:</span>
              <strong>{security.auto_renew_enabled ? 'Active Mandate' : 'Turned Off'}</strong>
            </div>
          </div>

          {/* Master Actions Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => onImpersonate(tenant.id, tenant.name)}
              className="sa-btn sa-btn-accent"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <Crown size={18} /> 1-Click Log In as Restaurant Owner (Manage Menu)
            </button>

            <button
              onClick={() => { onClose(); onEdit(tenant); }}
              className="sa-btn sa-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <Edit3 size={18} /> Edit Restaurant Details, Owner Email & Credentials
            </button>

            {sub.is_complimentary ? (
              <button
                onClick={() => { onClose(); onRevokeFree(tenant); }}
                className="sa-btn sa-btn-danger"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
              >
                <Sparkles size={18} /> Revoke Complimentary Free Access
              </button>
            ) : (
              <button
                onClick={() => { onClose(); onGrantFree(tenant); }}
                className="sa-btn sa-btn-primary"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
              >
                <Sparkles size={18} /> Grant Complimentary VIP Free Access (₹0)
              </button>
            )}

            <button
              onClick={() => { onClose(); onToggleActive(tenant.id, tenant.active); }}
              className={`sa-btn ${!tenant.active ? 'sa-btn-primary' : 'sa-btn-danger'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              {!tenant.active ? (
                <><CheckCircle size={18} /> 🟢 Unsuspend & Activate Restaurant</>
              ) : (
                <><XCircle size={18} /> 🔴 Suspend Tenant Access</>
              )}
            </button>

            {/* Permanent Delete Guard */}
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                style={{
                  background: 'transparent', border: '1px solid #FCA5A5', color: '#DC2626',
                  padding: '10px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  marginTop: '10px'
                }}
              >
                <Trash2 size={16} /> Delete Restaurant Account
              </button>
            ) : (
              <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '12px', borderRadius: '12px', marginTop: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: '#991B1B', fontWeight: 900, display: 'block', marginBottom: '8px' }}>
                  ⚠️ DANGER: This permanently deletes all dishes, categories, orders & tenant data!
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { onClose(); onDelete(tenant.id, tenant.name); }}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 900, cursor: 'pointer' }}
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
