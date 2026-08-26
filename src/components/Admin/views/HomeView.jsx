import React from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  DollarSign, 
  Plus, 
  ExternalLink, 
  QrCode, 
  Utensils, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Bell, 
  Lock,
  ChevronRight,
  Layers
} from 'lucide-react';
import { formatQuota } from '../../../utils/planCapabilities';

export default function HomeView({
  restaurantInfo = {},
  analyticsData = {},
  orders = [],
  serviceRequests = [],
  dishes = [],
  categories = [],
  combos = [],
  capabilities = {},
  onNavigateTab,
  onOpenAddDish,
  onReturnToMenu,
  onNavigateToSetup,
  currencySymbol = '₹'
}) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const pendingOrders = safeOrders.filter(o => o.status === 'pending' || o.status === 'ordered');
  const activeServiceRequests = (Array.isArray(serviceRequests) ? serviceRequests : []).filter(r => r.status !== 'resolved');

  // Real KPI Metrics derived strictly from live data
  const todayRevenue = analyticsData?.today_sales ?? analyticsData?.today_revenue ?? 0;
  const todayOrders = analyticsData?.today_orders ?? safeOrders.filter(o => {
    if (!o.created_at) return false;
    const orderDate = new Date(o.created_at).toDateString();
    return orderDate === new Date().toDateString();
  }).length;
  const totalRevenue = analyticsData?.total_sales ?? analyticsData?.total_revenue ?? 0;
  const totalOrders = analyticsData?.total_orders ?? safeOrders.length;
  const aov = analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0);

  // Time-based greeting
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const businessName = restaurantInfo?.name || 'Business Admin';

  const dishQuota = formatQuota(dishes.length, capabilities?.max_dishes);
  const catQuota = formatQuota(categories.length, capabilities?.max_categories);
  const comboQuota = formatQuota(combos.length, capabilities?.max_combos);

  const subStatus = (capabilities?.subscription_status || restaurantInfo?.subscription_status || 'active').toLowerCase();
  const isTrial = subStatus === 'trialing';
  const isAwaitingCharge = subStatus === 'awaiting_charge' || subStatus === 'bank_approval_pending';
  const isExpired = subStatus === 'expired' || subStatus === 'payment_failed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 🌟 1. HERO GREETING & REALTIME STATUS */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #123824 100%)',
        borderRadius: '20px',
        padding: '28px 24px',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(10, 35, 21, 0.12)'
      }}>
        {/* Subtle decorative gold glow */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, rgba(212, 175, 55, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, color: '#D4AF37', marginBottom: '8px' }}>
              <span>● LIVE OPERATIONS CONSOLE</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              {greeting}, {businessName}
            </h1>
            <p style={{ fontSize: '0.84rem', color: '#CBD5E1', margin: 0, fontWeight: 500 }}>
              Here is your real-time operational overview and business performance for today.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (onReturnToMenu) onReturnToMenu(restaurantInfo?.slug);
                else if (restaurantInfo?.slug) window.open(`/r/${restaurantInfo.slug}`, '_blank');
              }}
              style={{
                height: '42px',
                padding: '0 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(6px)'
              }}
            >
              <ExternalLink size={15} />
              <span>Public Menu</span>
            </button>

            <button
              onClick={onOpenAddDish}
              style={{
                height: '42px',
                padding: '0 18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
                border: 'none',
                color: '#0A2315',
                fontSize: '0.84rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
              }}
            >
              <Plus size={16} />
              <span>Add Dish</span>
            </button>
          </div>
        </div>
      </div>

      {/* ⚠️ 2. OPERATIONAL ACTION ALERTS (Only shown when real attention is needed) */}
      {(pendingOrders.length > 0 || activeServiceRequests.length > 0 || isExpired || isAwaitingCharge) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendingOrders.length > 0 && (
            <div style={{
              background: '#FFFBEB',
              border: '1.5px solid #FDE68A',
              borderRadius: '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#78350F', display: 'block' }}>
                    {pendingOrders.length} New Live {pendingOrders.length === 1 ? 'Order' : 'Orders'} Awaiting Kitchen Action
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#92400E' }}>
                    Customers are waiting for order acceptance and preparation.
                  </span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('orders')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>View Orders</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {activeServiceRequests.length > 0 && (
            <div style={{
              background: '#F0FDF4',
              border: '1.5px solid #BBF7D0',
              borderRadius: '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bell size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#14532D', display: 'block' }}>
                    {activeServiceRequests.length} Active Waiter Service {activeServiceRequests.length === 1 ? 'Call' : 'Calls'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#15803D' }}>
                    Guests requested staff assistance at their table / room.
                  </span>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('orders')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Respond Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* 📊 3. REALTIME EXECUTIVE METRICS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Metric 1: Today's Revenue */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Sales
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Math.round(todayRevenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
            Real-time gross revenue since midnight
          </span>
        </div>

        {/* Metric 2: Today's Orders */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Orders
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {todayOrders}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
            Total tickets received today
          </span>
        </div>

        {/* Metric 3: Pending Tickets */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: pendingOrders.length > 0 ? '1.5px solid #FCD34D' : '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending In Kitchen
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: pendingOrders.length > 0 ? '#D97706' : '#0F172A', letterSpacing: '-0.02em' }}>
            {pendingOrders.length}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
            Orders currently in queue / prep
          </span>
        </div>

        {/* Metric 4: Average Order Value */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avg. Order Value (AOV)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Math.round(aov).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
            Lifetime average spend per ticket
          </span>
        </div>
      </div>

      {/* 🚀 4. QUICK LAUNCH OPERATIONS SHORTCUTS */}
      <div>
        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '4px' }}>
          ⚡ QUICK OPERATIONS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div
            onClick={() => onNavigateTab('orders')}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>Live Orders</strong>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>View tickets & KDS</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('dishes')}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Utensils size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>Menu Items</strong>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>{dishQuota.count} items active</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('qr-generator')}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <QrCode size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>QR Standees</strong>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Table & space QRs</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('analytics')}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>Analytics</strong>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Revenue insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* 👑 5. CURRENT SAAS PLAN & OPERATIONAL CAPABILITIES */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        padding: '22px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px' }}>
              CURRENT SUBSCRIPTION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {capabilities?.plan_name || 'TouchQR SaaS Plan'}
              </h3>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                {isTrial ? '🎁 16-Day Trial' : isAwaitingCharge ? '🟣 Mandate Authorized' : '🟢 Active'}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigateToSetup ? onNavigateToSetup('subscription') : onNavigateTab('settings')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              color: '#0F172A',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Manage Subscription</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Feature Grid Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: '#334155', fontWeight: 600 }}>
            <span style={{ color: '#16A34A' }}>✓</span> Digital Luxury QR Menu
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: capabilities?.direct_ordering_enabled ? '#334155' : '#94A3B8', fontWeight: 600 }}>
            <span style={{ color: capabilities?.direct_ordering_enabled ? '#16A34A' : '#94A3B8' }}>
              {capabilities?.direct_ordering_enabled ? '✓' : '🔒'}
            </span>
            Direct Table QR Ordering
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: capabilities?.whatsapp_ordering_enabled ? '#334155' : '#94A3B8', fontWeight: 600 }}>
            <span style={{ color: capabilities?.whatsapp_ordering_enabled ? '#16A34A' : '#94A3B8' }}>
              {capabilities?.whatsapp_ordering_enabled ? '✓' : '🔒'}
            </span>
            WhatsApp Direct Ordering
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: capabilities?.kds_enabled ? '#334155' : '#94A3B8', fontWeight: 600 }}>
            <span style={{ color: capabilities?.kds_enabled ? '#16A34A' : '#94A3B8' }}>
              {capabilities?.kds_enabled ? '✓' : '🔒'}
            </span>
            Kitchen Display System (KDS)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: capabilities?.bluetooth_kot_enabled ? '#334155' : '#94A3B8', fontWeight: 600 }}>
            <span style={{ color: capabilities?.bluetooth_kot_enabled ? '#16A34A' : '#94A3B8' }}>
              {capabilities?.bluetooth_kot_enabled ? '✓' : '🔒'}
            </span>
            Bluetooth Thermal KOT Print
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', color: capabilities?.gst_invoice_enabled ? '#334155' : '#94A3B8', fontWeight: 600 }}>
            <span style={{ color: capabilities?.gst_invoice_enabled ? '#16A34A' : '#94A3B8' }}>
              {capabilities?.gst_invoice_enabled ? '✓' : '🔒'}
            </span>
            5% GST Tax Billing
          </div>
        </div>
      </div>
    </div>
  );
}
