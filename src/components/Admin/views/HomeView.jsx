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
  Layers,
  Sparkles, 
  ArrowRight, 
  Bell, 
  Lock,
  ChevronRight,
  Tv,
  CheckCircle2,
  Calendar,
  Share2,
  ShieldCheck,
  FolderPlus
} from 'lucide-react';
import { formatQuota } from '../../../utils/planCapabilities';
import { getDishImageUrl } from '../../../utils/imageHelper';

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
  onOpenAddCategory,
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

  const nextBillingDate = restaurantInfo?.subscription_end_date 
    ? new Date(restaurantInfo.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Real Top Selling Dishes
  const topDishes = Array.isArray(analyticsData?.top_dishes) && analyticsData.top_dishes.length > 0
    ? analyticsData.top_dishes.slice(0, 5)
    : [];

  // Daily Trends for Sales Overview
  const dailyTrends = Array.isArray(analyticsData?.daily_trends) ? analyticsData.daily_trends : [];
  const maxTrendRevenue = dailyTrends.length > 0 
    ? Math.max(...dailyTrends.map(d => Number(d.total_sales || d.revenue || 0)), 1)
    : 1;

  // Recent Orders (up to 4)
  const recentOrders = safeOrders.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 🌟 1. HERO GREETING & OPERATIONS HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #143D27 100%)',
        borderRadius: '20px',
        padding: '24px 28px',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(10, 35, 21, 0.08)'
      }}>
        {/* Decorative Gold Accent Glow */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.22) 0%, rgba(212, 175, 55, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.70rem', fontWeight: 800, color: '#D4AF37', marginBottom: '8px' }}>
              <span>● LIVE OPERATIONS CONSOLE</span>
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              {greeting}, {businessName}
            </h1>
            <p style={{ fontSize: '0.84rem', color: '#CBD5E1', margin: 0, fontWeight: 500 }}>
              Here is your real-time operational overview and business performance for today.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

      {/* ⚠️ 2. OPERATIONAL ACTION ALERTS (Only shown when actual attention is needed) */}
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
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#78350F', display: 'block' }}>
                    {pendingOrders.length} New Live {pendingOrders.length === 1 ? 'Order' : 'Orders'} Awaiting Kitchen Action
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#92400E' }}>
                    Guests are waiting for order acceptance and preparation.
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
                  <span style={{ fontSize: '0.74rem', color: '#15803D' }}>
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

      {/* 📊 3. EXECUTIVE KPI ROW (4 Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
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
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Orders Today
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
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
            Orders in queue / preparation
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
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
            Average spend per customer bill
          </span>
        </div>
      </div>

      {/* 🚀 4. MAIN CONTENT GRID (LEFT/CENTER + RIGHT INSIGHT RAIL) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        alignItems: 'start'
      }}>
        
        {/* ================= LEFT / CENTER WORKSPACE ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, gridColumn: 'span 2' }}>
          
          {/* A. SALES OVERVIEW CHART / TREND */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: '0 0 2px 0' }}>
                  Sales Overview
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Recent 7-day revenue performance
                </span>
              </div>

              <button
                onClick={() => onNavigateTab('analytics')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>View Full Analytics</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {dailyTrends.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                📊 No sales records recorded yet for this period.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', paddingTop: '10px' }}>
                {dailyTrends.map((t, idx) => {
                  const rev = Number(t.total_sales || t.revenue || 0);
                  const barHeight = Math.max(Math.round((rev / maxTrendRevenue) * 100), 8);
                  const label = t.day || t.date ? new Date(t.date || t.day).toLocaleDateString('en-IN', { weekday: 'narrow' }) : `#${idx+1}`;
                  return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#059669' }}>
                        {rev > 0 ? `${currencySymbol}${rev >= 1000 ? `${(rev/1000).toFixed(1)}k` : rev}` : ''}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '36px',
                          height: `${barHeight}%`,
                          background: rev > 0 ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)' : '#F1F5F9',
                          borderRadius: '6px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Sales: ${currencySymbol}${rev}`}
                      />
                      <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 700 }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* B. TOP SELLING DISHES & RECENT ORDERS SPLIT */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            
            {/* Top Selling Items */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  ⭐ Top Selling Dishes
                </h3>
                <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>By volume</span>
              </div>

              {topDishes.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem' }}>
                  No dish sales data yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topDishes.map((dish, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < topDishes.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#94A3B8', width: '16px' }}>#{i+1}</span>
                        <strong style={{ fontSize: '0.80rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dish.name || dish.dish_name}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, background: '#F1F5F9', color: '#334155', padding: '2px 6px', borderRadius: '6px' }}>
                          {dish.quantity || dish.count || 0} sold
                        </span>
                        {dish.revenue && (
                          <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#059669' }}>
                            {currencySymbol}{Math.round(dish.revenue)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Live Orders */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  🧾 Recent Orders
                </h3>
                <button
                  onClick={() => onNavigateTab('orders')}
                  style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  View All
                </button>
              </div>

              {recentOrders.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem' }}>
                  No orders received yet today.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentOrders.map(order => {
                    const statusColor = order.status === 'completed' ? '#16A34A' : order.status === 'pending' ? '#D97706' : '#2563EB';
                    const statusBg = order.status === 'completed' ? '#DCFCE7' : order.status === 'pending' ? '#FEF3C7' : '#EFF6FF';
                    return (
                      <div key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div>
                          <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>
                            #{order.order_number || order.id} • {order.space_identifier || `Table ${order.table_number || '1'}`}
                          </strong>
                          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                            {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A' }}>
                            {currencySymbol}{Math.round(order.total_amount || order.total || 0)}
                          </span>
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', background: statusBg, color: statusColor }}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* C. QUICK OPERATIONS (2-Column Grid) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A', margin: '0 0 12px 0' }}>
              ⚡ Quick Operations Launcher
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <button
                onClick={onOpenAddDish}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Add Dish</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>New menu item</span>
                </div>
              </button>

              <button
                onClick={onOpenAddCategory}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderPlus size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Add Category</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Organize catalog</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab('orders')}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Live Orders</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Order workspace</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab('qr-generator')}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <QrCode size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>QR Standees</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Print & export</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT INSIGHT RAIL ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '280px' }}>
          
          {/* 1. CURRENT PLAN CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
              CURRENT PLAN
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {capabilities?.plan_name || 'TouchQR SaaS'}
              </h3>
              <span style={{ fontSize: '0.70rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                {isTrial ? '🎁 16-Day Trial' : isAwaitingCharge ? '🟣 Mandate Active' : '🟢 Active'}
              </span>
            </div>

            {nextBillingDate && (
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginBottom: '14px' }}>
                Next renewal: <strong>{nextBillingDate}</strong>
              </div>
            )}

            <button
              onClick={() => onNavigateToSetup ? onNavigateToSetup('subscription') : onNavigateTab('settings')}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: '10px',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: '0.78rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Manage Subscription</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 2. PLAN QUOTA USAGE */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h4 style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0F172A', margin: '0 0 12px 0' }}>
              📊 Catalog Quotas
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Dishes:</span>
                <strong style={{ color: '#0F172A' }}>{dishQuota.display}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Categories:</span>
                <strong style={{ color: '#0F172A' }}>{catQuota.display}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Combos:</span>
                <strong style={{ color: comboQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{comboQuota.display}</strong>
              </div>
            </div>
          </div>

          {/* 3. QUICK FEATURE STATUS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h4 style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0F172A', margin: '0 0 12px 0' }}>
              ⚡ Feature Status
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: '#334155' }}>QR Ordering</span>
                <span style={{ color: capabilities?.direct_ordering_enabled ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                  {capabilities?.direct_ordering_enabled ? '🟢 Enabled' : '🔒 Locked'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: '#334155' }}>WhatsApp Orders</span>
                <span style={{ color: capabilities?.whatsapp_ordering_enabled ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                  {capabilities?.whatsapp_ordering_enabled ? '🟢 Enabled' : '🔒 Locked'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: '#334155' }}>Kitchen KDS</span>
                <span style={{ color: capabilities?.kds_enabled ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                  {capabilities?.kds_enabled ? '🟢 Enabled' : '🔒 Locked'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: '#334155' }}>Thermal KOT</span>
                <span style={{ color: capabilities?.bluetooth_kot_enabled ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                  {capabilities?.bluetooth_kot_enabled ? '🟢 Enabled' : '🔒 Locked'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: '#334155' }}>GST Invoicing</span>
                <span style={{ color: capabilities?.gst_invoice_enabled ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                  {capabilities?.gst_invoice_enabled ? '🟢 Enabled' : '🔒 Locked'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
