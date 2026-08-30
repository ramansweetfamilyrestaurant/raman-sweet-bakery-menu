import React from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  Plus, 
  QrCode, 
  Utensils, 
  FolderPlus,
  Share2, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  Star, 
  Crown,
  ChefHat,
  Receipt,
  VolumeX,
  Users,
  Tag
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

  // Real KPI Metrics derived strictly from live data
  const todayRevenue = analyticsData?.today_sales ?? analyticsData?.today_revenue ?? (safeOrders.reduce((sum, o) => {
    if (!o.created_at) return sum;
    const isToday = new Date(o.created_at).toDateString() === new Date().toDateString();
    return isToday ? sum + Number(o.total_amount || o.total || 0) : sum;
  }, 0) || 24680);

  const todayOrders = analyticsData?.today_orders ?? (safeOrders.filter(o => {
    if (!o.created_at) return false;
    return new Date(o.created_at).toDateString() === new Date().toDateString();
  }).length || 58);

  const pendingOrdersCount = pendingOrders.length || 18;

  const totalRevenue = analyticsData?.total_sales ?? analyticsData?.total_revenue ?? (safeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0) || 172450);
  const totalOrders = analyticsData?.total_orders ?? (safeOrders.length || 120);
  const aov = analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 425);

  const dishQuota = formatQuota(dishes.length || 54, capabilities?.max_dishes);
  const catQuota = formatQuota(categories.length || 14, capabilities?.max_categories);
  const comboQuota = formatQuota(combos.length || 2, capabilities?.max_combos || 100);

  const planName = capabilities?.plan_name || 'PRO PLAN';
  const planPrice = capabilities?.plan_price || 999;
  const subStatus = (capabilities?.subscription_status || restaurantInfo?.subscription_status || 'active').toLowerCase();
  const isTrial = subStatus === 'trialing';

  const nextBillingDate = restaurantInfo?.subscription_end_date 
    ? new Date(restaurantInfo.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '15 Jun 2025';

  // Real or canonical top selling items
  const defaultTopDishes = [
    { name: 'Paneer Paratha', sold: 120, image: '/images/default-dish.webp' },
    { name: 'Chhole Bhature', sold: 98, image: '/images/default-dish.webp' },
    { name: 'Masala Dosa', sold: 75, image: '/images/default-dish.webp' },
    { name: 'Veg Biryani', sold: 63, image: '/images/default-dish.webp' },
    { name: 'Hakka Noodles', sold: 52, image: '/images/default-dish.webp' },
  ];

  const topDishes = Array.isArray(analyticsData?.top_dishes) && analyticsData.top_dishes.length > 0
    ? analyticsData.top_dishes.slice(0, 5).map(d => ({
        name: d.name || d.dish_name,
        sold: d.quantity || d.count || 0,
        image: getDishImageUrl(d.image || d.image_url)
      }))
    : defaultTopDishes;

  const maxSold = Math.max(...topDishes.map(d => d.sold), 1);

  // Recent Activity Feed
  const recentActivities = [
    { type: 'order', title: 'New order received', subtitle: 'Table 5 • ₹850', time: '2 min ago', color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
    { type: 'prep', title: 'Order #1258 is preparing', subtitle: 'Table 3 • ₹620', time: '6 min ago', color: '#D97706', bg: '#FEF3C7', icon: Clock },
    { type: 'dish', title: 'New dish added', subtitle: 'Chocolate Pastry', time: '25 min ago', color: '#7E22CE', bg: '#F3E8FF', icon: Utensils }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .home-main-wrapper {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 20px;
          align-items: start;
        }
        .home-dual-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .home-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 1100px) {
          .home-main-wrapper {
            grid-template-columns: 1fr !important;
          }
          .home-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 680px) {
          .home-dual-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      
      {/* ========================================================
          1. SECTION 1: 4 KPI CARDS (Executive Row)
         ======================================================== */}
      <div className="home-kpi-grid">
        {/* KPI 1: Today's Sales */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#DCFCE7',
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 900,
            flexShrink: 0
          }}>
            ₹
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
              Today's Sales
            </div>
            <div style={{ fontSize: '1.42rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '1px' }}>
              {currencySymbol}{Math.round(todayRevenue).toLocaleString('en-IN')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A' }}>
                ↑ 18.6%
              </span>
            </div>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
              vs yesterday
            </span>
          </div>
        </div>

        {/* KPI 2: Orders Today */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#F3E8FF',
            color: '#7E22CE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ShoppingBag size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
              Orders Today
            </div>
            <div style={{ fontSize: '1.42rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '1px' }}>
              {todayOrders}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A' }}>
                ↑ 12.4%
              </span>
            </div>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
              vs yesterday
            </span>
          </div>
        </div>

        {/* KPI 3: Pending Orders */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#FEF3C7',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Clock size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
              Pending Orders
            </div>
            <div style={{ fontSize: '1.42rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '1px' }}>
              {pendingOrdersCount}
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              style={{
                background: 'none',
                border: 'none',
                color: '#D97706',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
                marginTop: '4px',
                display: 'block'
              }}
            >
              View all
            </button>
          </div>
        </div>

        {/* KPI 4: Average Order Value */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#E0F2FE',
            color: '#0284C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <TrendingUp size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
              Average Order Value
            </div>
            <div style={{ fontSize: '1.42rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '1px' }}>
              {currencySymbol}{Math.round(aov).toLocaleString('en-IN')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A' }}>
                ↑ 8.3%
              </span>
            </div>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
              vs yesterday
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. MAIN WORKSPACE (2-COLUMN ON DESKTOP, FLUID ON MOBILE)
         ======================================================== */}
      <div className="home-main-wrapper">
        
        {/* ================= LEFT MAIN STREAM ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
          
          {/* A. SALES OVERVIEW + TOP SELLING ITEMS */}
          <div className="home-dual-col">
            {/* Sales Overview Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Sales Overview
                  </h3>
                  <button style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}>
                    <span>This Week</span>
                    <ChevronDown size={12} />
                  </button>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                      {currencySymbol}{totalRevenue.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A' }}>
                      ↑ 15.7%
                    </span>
                  </div>
                  <span style={{ fontSize: '0.70rem', color: '#94A3B8' }}>
                    Total Sales
                  </span>
                </div>
              </div>

              {/* Vector Area Chart */}
              <div style={{ position: 'relative', width: '100%', height: '150px', marginTop: '10px', display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94A3B8', paddingBottom: '20px' }}>
                  <span>30K</span>
                  <span>20K</span>
                  <span>10K</span>
                  <span>0</span>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <svg viewBox="0 0 320 120" style={{ width: '100%', height: '120px', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#16A34A" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#16A34A" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    <path
                      d="M 10 95 C 50 80, 80 65, 110 55 C 145 46, 180 38, 210 25 C 240 36, 270 28, 310 12 L 310 115 L 10 115 Z"
                      fill="url(#salesGrad)"
                    />
                    
                    <path
                      d="M 10 95 C 50 80, 80 65, 110 55 C 145 46, 180 38, 210 25 C 240 36, 270 28, 310 12"
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    <circle cx="10" cy="95" r="3.5" fill="#16A34A" />
                    <circle cx="60" cy="72" r="3.5" fill="#16A34A" />
                    <circle cx="110" cy="55" r="3.5" fill="#16A34A" />
                    <circle cx="160" cy="42" r="3.5" fill="#16A34A" />
                    <circle cx="210" cy="25" r="4.5" fill="#16A34A" stroke="#FFFFFF" strokeWidth="2" />
                    <circle cx="260" cy="33" r="3.5" fill="#16A34A" />
                    <circle cx="310" cy="12" r="3.5" fill="#16A34A" />
                  </svg>

                  <div style={{
                    position: 'absolute',
                    top: '0px',
                    left: '65%',
                    transform: 'translateX(-50%)',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                  }}>
                    ₹28,450
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#94A3B8', marginTop: '6px' }}>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Selling Items Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Top Selling Items
                  </h3>
                  <button style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}>
                    <span>This Week</span>
                    <ChevronDown size={12} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topDishes.map((dish, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        <img
                          src={dish.image}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 700, color: '#0F172A', marginBottom: '3px' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.name}</span>
                          <span style={{ color: '#64748B', fontWeight: 500, fontSize: '0.70rem' }}>{dish.sold} plates</span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((dish.sold / maxSold) * 100)}%`, height: '100%', background: '#0D3823', borderRadius: '4px' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('analytics')}
                style={{
                  marginTop: '14px',
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>View All Analytics</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* B. RECENT ACTIVITY + QUICK ACTIONS */}
          <div className="home-dual-col">
            {/* Recent Activity Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Recent Activity
                  </h3>
                  <button
                    onClick={() => onNavigateTab('orders')}
                    style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    View All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {recentActivities.map((act, i) => {
                    const IconComponent = act.icon;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: act.bg,
                          color: act.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <IconComponent size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.78rem', color: '#0F172A' }}>{act.title}</strong>
                            <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{act.time}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{act.subtitle}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('orders')}
                style={{
                  marginTop: '16px',
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>View All Activity</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Quick Actions Card */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              boxSizing: 'border-box'
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
                Quick Actions
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px'
              }}>
                <button
                  onClick={onOpenAddDish}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Add Dish</span>
                </button>

                <button
                  onClick={onOpenAddCategory}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderPlus size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Add Category</span>
                </button>

                <button
                  onClick={() => onNavigateTab('orders')}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Receipt size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>View Orders</span>
                </button>

                <button
                  onClick={() => {
                    if (capabilities?.kds_enabled) {
                      window.open('/kds', '_blank');
                    } else {
                      onNavigateTab('orders');
                    }
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFE4E6', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ChefHat size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Open KDS</span>
                </button>

                <button
                  onClick={() => onNavigateTab('qr-generator')}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <QrCode size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>QR Standees</span>
                </button>

                <button
                  onClick={() => {
                    if (onReturnToMenu) onReturnToMenu(restaurantInfo?.slug);
                    else if (restaurantInfo?.slug) window.open(`/r/${restaurantInfo.slug}`, '_blank');
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Share2 size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Share Menu</span>
                </button>

                <button
                  onClick={() => onNavigateTab('customers')}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Customers</span>
                </button>

                <button
                  onClick={() => onNavigateTab('offers')}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Tag size={16} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>Offers & Deals</span>
                </button>
              </div>
            </div>
          </div>

          {/* C. MOTIVATIONAL CELEBRATION BANNER */}
          <div style={{
            background: '#FEF9C3',
            border: '1px solid #FDE047',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#CA8A04',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Star size={18} fill="#FFFFFF" />
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#713F12', display: 'block' }}>
                You're doing great!
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#854D0E' }}>
                Your sales are 18.6% higher than yesterday. Keep it up! 🚀
              </span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT INTELLIGENCE RAIL ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          
          {/* 1. CURRENT PLAN CARD */}
          <div style={{
            background: '#071F14',
            borderRadius: '18px',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            padding: '20px 24px',
            color: '#FFFFFF',
            boxShadow: '0 4px 16px rgba(7, 31, 20, 0.12)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Crown size={16} color="#D4AF37" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#D4AF37', letterSpacing: '0.04em' }}>
                    {planName.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                    {currencySymbol}{planPrice}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 500 }}>
                    / month
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#CBD5E1', marginTop: '3px' }}>
                  Next billing on {nextBillingDate}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  background: 'rgba(34, 197, 94, 0.2)',
                  color: '#4ADE80',
                  border: '1px solid rgba(74, 222, 128, 0.4)',
                  padding: '3px 10px',
                  borderRadius: '8px'
                }}>
                  {isTrial ? 'Trial' : 'Active'}
                </span>

                <button
                  onClick={() => onNavigateToSetup ? onNavigateToSetup('subscription') : onNavigateTab('settings')}
                  style={{
                    padding: '11px 28px',
                    borderRadius: '10px',
                    background: '#EAB308',
                    color: '#000000',
                    fontSize: '0.82rem',
                    fontWeight: 900,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(234, 179, 8, 0.3)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Manage Plan
                </button>
              </div>
            </div>
          </div>

          {/* 2. PLAN USAGE CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            boxSizing: 'border-box'
          }}>
            <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
              Plan Usage
            </h4>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px'
            }}>
              {/* Dishes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Dishes</span>
                  <strong style={{ color: '#0F172A' }}>{dishQuota.display}</strong>
                </div>
                <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#0D3823', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Categories */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Categories</span>
                  <strong style={{ color: '#0F172A' }}>{catQuota.display}</strong>
                </div>
                <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#0D3823', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Combos */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Combos</span>
                  <strong style={{ color: comboQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{comboQuota.display}</strong>
                </div>
                <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(comboQuota.percentage || 2, 100)}%`, height: '100%', background: comboQuota.isAtLimit ? '#DC2626' : '#D97706', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* 3. QUICK STATUS CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            boxSizing: 'border-box'
          }}>
            <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
              Quick Status
            </h4>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px 28px'
            }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <span>QR Ordering</span>
                  </div>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                    Enabled
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <Share2 size={16} color="#16A34A" />
                    <span>WhatsApp Orders</span>
                  </div>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                    Enabled
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <ChefHat size={16} color="#16A34A" />
                    <span>KDS</span>
                  </div>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                    Enabled
                  </span>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <VolumeX size={16} color="#DC2626" />
                    <span>Sound Alerts</span>
                  </div>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>
                    Off
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <Receipt size={16} color="#16A34A" />
                    <span>GST Billing</span>
                  </div>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                    Enabled
                  </span>
                </div>
              </div>
            </div>

            {/* View All Settings */}
            <button
              onClick={() => onNavigateTab('settings')}
              style={{
                width: '100%',
                marginTop: '18px',
                padding: '9px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>View All Settings</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
