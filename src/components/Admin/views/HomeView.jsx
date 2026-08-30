import React, { useState, useMemo } from 'react';
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
  Volume2, 
  VolumeX, 
  Users, 
  Tag, 
  AlertCircle, 
  Bell, 
  Sparkles,
  Lock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatQuota } from '../../../utils/planCapabilities';
import { getDishImageUrl } from '../../../utils/imageHelper';

const safeParseItems = (items) => {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try { return JSON.parse(items); } catch { return []; }
  }
  return [];
};

const getLocalDateStr = (dVal) => {
  if (!dVal) return '';
  const d = new Date(dVal);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

const getRelativeTime = (dateVal) => {
  if (!dateVal) return 'Just now';
  const timeMs = new Date(dateVal).getTime();
  if (isNaN(timeMs)) return 'Just now';
  const diffMs = Date.now() - timeMs;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatLocation = (raw, spaceType) => {
  if (!raw) return 'Takeaway';
  const str = String(raw).trim();
  const cMatch = str.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                 str.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
  if (cMatch) return `Screen ${cMatch[1]} Row ${cMatch[2].toUpperCase()} Seat ${cMatch[3]}`;
  if (spaceType === 'room' || /^room/i.test(str)) return `Room ${str.replace(/^room\s*#?/i, '')}`;
  if (spaceType === 'cabin' || /^cabin/i.test(str)) return `Cabin ${str.replace(/^cabin\s*#?/i, '')}`;
  if (spaceType === 'vip' || /^vip/i.test(str)) return `VIP ${str.replace(/^vip\s*#?/i, '')}`;
  if (/^(takeaway|parcel)/i.test(str)) return 'Takeaway';
  if (/^table/i.test(str)) return str;
  return `Table ${str}`;
};

export default function HomeView({
  restaurantInfo = {},
  analyticsData = {},
  orders = [],
  serviceRequests = [],
  dishes = [],
  categories = [],
  combos = [],
  totalTablesCount = 0,
  settingsForm = {},
  isAudioReady = true,
  subscriptionStatus = null,
  capabilities = {},
  onNavigateTab,
  onOpenAddDish,
  onOpenAddCategory,
  onReturnToMenu,
  onNavigateToSetup,
  currencySymbol = '₹'
}) {
  const [hoveredPointIdx, setHoveredPointIdx] = useState(null);

  // 1. Sanitize Orders & Service Requests
  const safeOrders = useMemo(() => {
    return (Array.isArray(orders) ? orders : []).filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
  }, [orders]);

  const safeServiceReqs = useMemo(() => {
    return Array.isArray(serviceRequests) ? serviceRequests : [];
  }, [serviceRequests]);

  // 2. Date Boundaries (Asia/Kolkata IST)
  const now = new Date();
  const todayStr = getLocalDateStr(now);

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yesterdayDate);

  // 3. Today & Yesterday Orders Aggregation
  const todayOrdersList = useMemo(() => {
    return safeOrders.filter(o => o.created_at && getLocalDateStr(o.created_at) === todayStr);
  }, [safeOrders, todayStr]);

  const yesterdayOrdersList = useMemo(() => {
    return safeOrders.filter(o => o.created_at && getLocalDateStr(o.created_at) === yesterdayStr);
  }, [safeOrders, yesterdayStr]);

  // 4. Live KPI Metrics (Strictly Authoritative)
  const todayRevenue = analyticsData?.today_sales !== undefined && analyticsData?.today_sales !== null
    ? Number(analyticsData.today_sales)
    : (analyticsData?.today_revenue !== undefined && analyticsData?.today_revenue !== null
        ? Number(analyticsData.today_revenue)
        : todayOrdersList.reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0));

  const yesterdayRevenue = analyticsData?.yesterday_sales !== undefined && analyticsData?.yesterday_sales !== null
    ? Number(analyticsData.yesterday_sales)
    : yesterdayOrdersList.reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

  const todayOrdersCount = analyticsData?.today_orders !== undefined && analyticsData?.today_orders !== null
    ? Number(analyticsData.today_orders)
    : todayOrdersList.length;

  const yesterdayOrdersCount = yesterdayOrdersList.length;

  // Real Mathematical Growth
  const salesGrowthVsYesterday = yesterdayRevenue > 0
    ? parseFloat((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1))
    : null;

  const ordersGrowthVsYesterday = yesterdayOrdersCount > 0
    ? parseFloat((((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100).toFixed(1))
    : null;

  // 5. Pending Orders Count (Strictly matching OrdersView logic)
  const pendingOrders = useMemo(() => {
    return safeOrders.filter(o => o.status === 'pending' || o.status === 'ordered');
  }, [safeOrders]);
  const pendingOrdersCount = pendingOrders.length;

  // 6. Total Sales & Average Order Value (AOV)
  const totalRevenue = analyticsData?.total_sales !== undefined && analyticsData?.total_sales !== null
    ? Number(analyticsData.total_sales)
    : safeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  const totalOrdersCount = analyticsData?.total_orders !== undefined && analyticsData?.total_orders !== null
    ? Number(analyticsData.total_orders)
    : safeOrders.length;

  const aov = analyticsData?.average_order_value !== undefined && analyticsData?.average_order_value !== null
    ? Number(analyticsData.average_order_value)
    : (totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0);

  // 7. Plan Quotas (Real Count vs Plan Limits)
  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, capabilities?.max_dishes);
  const catQuota = formatQuota(safeCategories.length, capabilities?.max_categories);
  const comboQuota = formatQuota(safeCombos.length, capabilities?.max_combos);

  // 8. Canonical Plan Details
  const planName = capabilities?.plan_name || (restaurantInfo?.plan_name ? restaurantInfo.plan_name.toUpperCase() : 'ENTERPRISE PLAN');
  const planPrice = capabilities?.plan_price !== undefined ? capabilities.plan_price : (restaurantInfo?.plan_price || 1999);
  const subStatus = (subscriptionStatus?.status || capabilities?.subscription_status || restaurantInfo?.subscription_status || 'active').toLowerCase();
  const isTrial = subStatus === 'trialing';

  const nextBillingDate = restaurantInfo?.subscription_end_date 
    ? new Date(restaurantInfo.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (subscriptionStatus?.current_period_end ? new Date(subscriptionStatus.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ongoing Auto-Renew');

  // 9. Top Selling Items (100% Real Analytics/Order Data, Zero Mock Fallback)
  const topDishes = useMemo(() => {
    if (Array.isArray(analyticsData?.top_dishes) && analyticsData.top_dishes.length > 0) {
      return analyticsData.top_dishes.slice(0, 5).map(d => ({
        name: d.name || d.dish_name || 'Dish',
        sold: Number(d.quantity || d.count || 0),
        image: getDishImageUrl(d.image || d.image_url)
      }));
    }

    // Live aggregation from safeOrders if analytics not yet summarized
    const dishMap = {};
    safeOrders.forEach(o => {
      const items = safeParseItems(o.items);
      items.forEach(it => {
        const name = it.name || it.dish_name || 'Item';
        const qty = Number(it.quantity || it.qty || 1);
        const img = it.image || it.image_url || null;
        if (!dishMap[name]) dishMap[name] = { name, sold: 0, image: getDishImageUrl(img) };
        dishMap[name].sold += qty;
      });
    });

    return Object.values(dishMap).sort((a, b) => b.sold - a.sold).slice(0, 5);
  }, [analyticsData?.top_dishes, safeOrders]);

  const maxSold = topDishes.length > 0 ? Math.max(...topDishes.map(d => d.sold), 1) : 1;

  // 10. Recent Activity Feed (Live from Real Orders & Service Requests)
  const recentActivities = useMemo(() => {
    const activities = [];

    safeOrders.slice(0, 6).forEach(o => {
      const items = safeParseItems(o.items);
      const isPending = o.status === 'pending' || o.status === 'ordered';
      const isKitchen = ['kitchen', 'preparing', 'accepted'].includes(o.status);
      const isDone = ['ready', 'served', 'completed'].includes(o.status);

      let title = `Order #${o.id}`;
      let color = '#7E22CE';
      let bg = '#F3E8FF';
      let IconComponent = ShoppingBag;

      if (isPending) {
        title = `New order received (#${o.id})`;
        color = '#D97706';
        bg = '#FEF3C7';
        IconComponent = Clock;
      } else if (isKitchen) {
        title = `Order #${o.id} is cooking`;
        color = '#0284C7';
        bg = '#E0F2FE';
        IconComponent = ChefHat;
      } else if (isDone) {
        title = `Order #${o.id} served`;
        color = '#16A34A';
        bg = '#DCFCE7';
        IconComponent = CheckCircle2;
      }

      const loc = formatLocation(o.table_number || o.delivery_location, o.space_type);
      const sub = `${loc} • ${currencySymbol}${o.total_amount || 0}${items.length > 0 ? ` (${items.length} ${items.length === 1 ? 'item' : 'items'})` : ''}`;

      activities.push({
        id: `order_${o.id}`,
        title,
        subtitle: sub,
        time: getRelativeTime(o.created_at),
        timestamp: o.created_at ? new Date(o.created_at).getTime() : 0,
        color,
        bg,
        icon: IconComponent
      });
    });

    safeServiceReqs.slice(0, 3).forEach(r => {
      const loc = formatLocation(r.table_number || '1', r.space_type);
      activities.push({
        id: `req_${r.id}`,
        title: r.request_type === 'presence_verification' ? 'GPS Presence Verified' : 'Waiter Service Call',
        subtitle: `${loc} • ${r.message || 'Assistance requested'}`,
        time: getRelativeTime(r.created_at),
        timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
        color: '#EA580C',
        bg: '#FFEDD5',
        icon: Bell
      });
    });

    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  }, [safeOrders, safeServiceReqs, currencySymbol]);

  // 11. Dynamic 7-Day Sales Trend & SVG Path Generation
  const dailyChartPoints = useMemo(() => {
    if (Array.isArray(analyticsData?.daily_chart) && analyticsData.daily_chart.length >= 7) {
      return analyticsData.daily_chart.slice(-7);
    }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getLocalDateStr(d);
      const dLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const daySales = safeOrders
        .filter(o => o.created_at && getLocalDateStr(o.created_at) === dStr)
        .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);
      days.push({
        date: dStr,
        displayDate: dLabel,
        sales: daySales
      });
    }
    return days;
  }, [analyticsData?.daily_chart, safeOrders]);

  const weeklySalesTotal = useMemo(() => {
    return dailyChartPoints.reduce((sum, p) => sum + Number(p.sales || 0), 0);
  }, [dailyChartPoints]);

  const maxChartSales = useMemo(() => {
    const m = Math.max(...dailyChartPoints.map(p => Number(p.sales || 0)), 0);
    return m > 0 ? m : 1000;
  }, [dailyChartPoints]);

  // Compute SVG Points for 320x120 viewport
  const chartCoordinates = useMemo(() => {
    const width = 300;
    const height = 100;
    const paddingX = 10;
    const paddingY = 10;
    const count = dailyChartPoints.length;
    const step = count > 1 ? (width - paddingX * 2) / (count - 1) : 0;

    return dailyChartPoints.map((point, idx) => {
      const x = paddingX + idx * step;
      const normalized = point.sales / maxChartSales;
      const y = (height + paddingY) - (normalized * (height - 10));
      return { x, y: Math.max(10, Math.min(105, y)), ...point };
    });
  }, [dailyChartPoints, maxChartSales]);

  const svgAreaPath = useMemo(() => {
    if (chartCoordinates.length === 0) return '';
    const first = chartCoordinates[0];
    const last = chartCoordinates[chartCoordinates.length - 1];
    let path = `M ${first.x} ${first.y}`;
    for (let i = 1; i < chartCoordinates.length; i++) {
      const p = chartCoordinates[i];
      const prev = chartCoordinates[i - 1];
      const midX = (prev.x + p.x) / 2;
      path += ` C ${midX} ${prev.y}, ${midX} ${p.y}, ${p.x} ${p.y}`;
    }
    path += ` L ${last.x} 115 L ${first.x} 115 Z`;
    return path;
  }, [chartCoordinates]);

  const svgLinePath = useMemo(() => {
    if (chartCoordinates.length === 0) return '';
    const first = chartCoordinates[0];
    let path = `M ${first.x} ${first.y}`;
    for (let i = 1; i < chartCoordinates.length; i++) {
      const p = chartCoordinates[i];
      const prev = chartCoordinates[i - 1];
      const midX = (prev.x + p.x) / 2;
      path += ` C ${midX} ${prev.y}, ${midX} ${p.y}, ${p.x} ${p.y}`;
    }
    return path;
  }, [chartCoordinates]);

  // Active Tooltip Point
  const activeTooltipPoint = hoveredPointIdx !== null 
    ? chartCoordinates[hoveredPointIdx] 
    : chartCoordinates[chartCoordinates.length - 1];

  // 12. Feature Status & Capabilities Check
  const isQrOrderingLive = Boolean(capabilities?.direct_ordering_enabled && settingsForm?.direct_ordering_enabled !== false);
  const isWhatsappLive = Boolean(capabilities?.whatsapp_ordering_enabled && settingsForm?.whatsapp_ordering_enabled !== false);
  const isKdsLive = Boolean(capabilities?.kds_enabled && settingsForm?.kds_screen_enabled !== false && restaurantInfo?.kds_screen_enabled !== false);
  const isSoundAlertsOn = Boolean(isAudioReady && settingsForm?.sound_enabled !== false);
  const isGstEnabled = Boolean(capabilities?.gst_invoice_enabled && settingsForm?.gst_enabled);

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
          grid-template-columns: minmax(0, 1fr) 310px;
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
          .home-kpi-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
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
            {currencySymbol}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
              Today's Sales
            </div>
            <div style={{ fontSize: '1.42rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '1px' }}>
              {currencySymbol}{Math.round(todayRevenue).toLocaleString('en-IN')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              {salesGrowthVsYesterday !== null ? (
                <span style={{ 
                  fontSize: '0.70rem', 
                  fontWeight: 700, 
                  color: salesGrowthVsYesterday >= 0 ? '#16A34A' : '#DC2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  {salesGrowthVsYesterday >= 0 ? '↑' : '↓'} {Math.abs(salesGrowthVsYesterday)}%
                </span>
              ) : (
                <span style={{ fontSize: '0.70rem', fontWeight: 600, color: '#94A3B8' }}>
                  {todayRevenue > 0 ? 'Live today' : 'No sales yesterday'}
                </span>
              )}
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
              {todayOrdersCount}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              {ordersGrowthVsYesterday !== null ? (
                <span style={{ 
                  fontSize: '0.70rem', 
                  fontWeight: 700, 
                  color: ordersGrowthVsYesterday >= 0 ? '#16A34A' : '#DC2626' 
                }}>
                  {ordersGrowthVsYesterday >= 0 ? '↑' : '↓'} {Math.abs(ordersGrowthVsYesterday)}%
                </span>
              ) : (
                <span style={{ fontSize: '0.70rem', fontWeight: 600, color: '#94A3B8' }}>
                  {todayOrdersCount > 0 ? `${todayOrdersCount} today` : '—'}
                </span>
              )}
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
            background: pendingOrdersCount > 0 ? '#FEF3C7' : '#F1F5F9',
            color: pendingOrdersCount > 0 ? '#D97706' : '#64748B',
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
            <div style={{ fontSize: '1.42rem', fontWeight: 900, color: pendingOrdersCount > 0 ? '#D97706' : '#0F172A', letterSpacing: '-0.02em', marginTop: '1px' }}>
              {pendingOrdersCount}
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              style={{
                background: 'none',
                border: 'none',
                color: pendingOrdersCount > 0 ? '#D97706' : '#059669',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
                marginTop: '4px',
                display: 'block'
              }}
            >
              {pendingOrdersCount > 0 ? 'Accept orders →' : 'View all orders →'}
            </button>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
              {pendingOrdersCount > 0 ? 'Requires action' : 'Live queue clear'}
            </span>
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
              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#0284C7' }}>
                {totalOrdersCount} total orders
              </span>
            </div>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
              Lifetime AOV
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
                  <button 
                    onClick={() => onNavigateTab('analytics')}
                    style={{
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
                    }}
                  >
                    <span>7 Days Trend</span>
                    <ChevronDown size={12} />
                  </button>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                      {currencySymbol}{weeklySalesTotal.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A' }}>
                      7-Day Revenue
                    </span>
                  </div>
                  <span style={{ fontSize: '0.70rem', color: '#94A3B8' }}>
                    Real-time aggregated daily sales
                  </span>
                </div>
              </div>

              {/* Dynamic Vector Area Chart */}
              <div style={{ position: 'relative', width: '100%', height: '150px', marginTop: '10px', display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94A3B8', paddingBottom: '20px' }}>
                  <span>{currencySymbol}{maxChartSales >= 1000 ? `${Math.round(maxChartSales / 1000)}k` : maxChartSales}</span>
                  <span>{currencySymbol}{maxChartSales >= 2000 ? `${Math.round((maxChartSales * 0.66) / 1000)}k` : Math.round(maxChartSales * 0.66)}</span>
                  <span>{currencySymbol}{maxChartSales >= 2000 ? `${Math.round((maxChartSales * 0.33) / 1000)}k` : Math.round(maxChartSales * 0.33)}</span>
                  <span>0</span>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <svg viewBox="0 0 320 120" style={{ width: '100%', height: '120px', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="salesGradReal" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#16A34A" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#16A34A" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Area fill */}
                    {svgAreaPath && (
                      <path
                        d={svgAreaPath}
                        fill="url(#salesGradReal)"
                      />
                    )}
                    
                    {/* Polyline */}
                    {svgLinePath && (
                      <path
                        d={svgLinePath}
                        fill="none"
                        stroke="#16A34A"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Circles for points */}
                    {chartCoordinates.map((pt, idx) => {
                      const isHovered = hoveredPointIdx === idx || (hoveredPointIdx === null && idx === chartCoordinates.length - 1);
                      return (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 4.5 : 3.5}
                          fill="#16A34A"
                          stroke="#FFFFFF"
                          strokeWidth={isHovered ? 2 : 1}
                          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                          onMouseEnter={() => setHoveredPointIdx(idx)}
                          onMouseLeave={() => setHoveredPointIdx(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Dynamic Tooltip */}
                  {activeTooltipPoint && (
                    <div style={{
                      position: 'absolute',
                      top: '0px',
                      left: `${Math.max(15, Math.min(85, (activeTooltipPoint.x / 320) * 100))}%`,
                      transform: 'translateX(-50%)',
                      background: '#0F172A',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap'
                    }}>
                      {activeTooltipPoint.displayDate}: {currencySymbol}{Number(activeTooltipPoint.sales || 0).toLocaleString('en-IN')}
                    </div>
                  )}

                  {/* X-Axis Days Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#94A3B8', marginTop: '6px' }}>
                    {dailyChartPoints.map((pt, idx) => (
                      <span 
                        key={idx}
                        style={{ 
                          fontWeight: (hoveredPointIdx === idx || (hoveredPointIdx === null && idx === dailyChartPoints.length - 1)) ? 800 : 500,
                          color: (hoveredPointIdx === idx || (hoveredPointIdx === null && idx === dailyChartPoints.length - 1)) ? '#0F172A' : '#94A3B8',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={() => setHoveredPointIdx(idx)}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                      >
                        {pt.displayDate}
                      </span>
                    ))}
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
                  <button 
                    onClick={() => onNavigateTab('analytics')}
                    style={{
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
                    }}
                  >
                    <span>All Time</span>
                    <ChevronDown size={12} />
                  </button>
                </div>

                {topDishes.length > 0 ? (
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
                            <span style={{ color: '#64748B', fontWeight: 500, fontSize: '0.70rem' }}>{dish.sold} {dish.sold === 1 ? 'order' : 'orders'}</span>
                          </div>
                          <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round((dish.sold / maxSold) * 100)}%`, height: '100%', background: '#0D3823', borderRadius: '4px' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px dashed #CBD5E1'
                  }}>
                    <Utensils size={28} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
                    <strong style={{ fontSize: '0.82rem', color: '#475569', display: 'block' }}>
                      No dish sales recorded yet
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      Top-selling item rankings will appear here as guests place orders.
                    </span>
                  </div>
                )}
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
                <span>View Full Analytics</span>
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

                {recentActivities.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {recentActivities.map((act) => {
                      const IconComponent = act.icon;
                      return (
                        <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
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
                ) : (
                  <div style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px dashed #CBD5E1'
                  }}>
                    <Clock size={28} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
                    <strong style={{ fontSize: '0.82rem', color: '#475569', display: 'block' }}>
                      No recent activity
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      Live customer orders and service calls will stream here automatically.
                    </span>
                  </div>
                )}
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
                <span>View Orders Screen</span>
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

          {/* C. MOTIVATIONAL BANNER */}
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
                {todayRevenue > 0 ? "You're doing great!" : "Business Command Center Ready"}
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#854D0E' }}>
                {todayRevenue > 0 
                  ? `You have recorded ${todayOrdersCount} ${todayOrdersCount === 1 ? 'order' : 'orders'} worth ${currencySymbol}${Math.round(todayRevenue).toLocaleString('en-IN')} today! 🚀`
                  : "Your digital QR menu and live order workflow are connected and ready for customers."}
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
                    {currencySymbol}{planPrice.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 500 }}>
                    / month
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: '#CBD5E1', marginTop: '3px' }}>
                  Next billing: {nextBillingDate}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  background: subStatus === 'trialing' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: subStatus === 'trialing' ? '#FBBF24' : '#4ADE80',
                  border: `1px solid ${subStatus === 'trialing' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(74, 222, 128, 0.4)'}`,
                  padding: '3px 10px',
                  borderRadius: '8px',
                  textTransform: 'capitalize'
                }}>
                  {subStatus === 'trialing' ? 'Trial' : (subStatus === 'active' ? 'Active' : subStatus)}
                </span>

                <button
                  onClick={() => onNavigateTab ? onNavigateTab('billing') : (onNavigateToSetup ? onNavigateToSetup('subscription') : onNavigateTab('settings'))}
                  style={{
                    padding: '10px 24px',
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
                  <strong style={{ color: dishQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{dishQuota.display}</strong>
                </div>
                <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${dishQuota.isUnlimited ? 100 : Math.min(100, Math.round((dishQuota.count / (dishQuota.limit || 1)) * 100))}%`, 
                    height: '100%', 
                    background: dishQuota.isAtLimit ? '#DC2626' : '#0D3823', 
                    borderRadius: '4px' 
                  }} />
                </div>
              </div>

              {/* Categories */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Categories</span>
                  <strong style={{ color: catQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{catQuota.display}</strong>
                </div>
                <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${catQuota.isUnlimited ? 100 : Math.min(100, Math.round((catQuota.count / (catQuota.limit || 1)) * 100))}%`, 
                    height: '100%', 
                    background: catQuota.isAtLimit ? '#DC2626' : '#0D3823', 
                    borderRadius: '4px' 
                  }} />
                </div>
              </div>

              {/* Combos */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Combos</span>
                  <strong style={{ color: comboQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{comboQuota.display}</strong>
                </div>
                <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${comboQuota.isUnlimited ? 100 : Math.min(100, Math.round((comboQuota.count / (comboQuota.limit || 1)) * 100))}%`, 
                    height: '100%', 
                    background: comboQuota.isAtLimit ? '#DC2626' : '#D97706', 
                    borderRadius: '4px' 
                  }} />
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
                {/* QR Ordering */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <CheckCircle2 size={16} color={isQrOrderingLive ? "#16A34A" : "#94A3B8"} />
                    <span>QR Ordering</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.70rem', 
                    fontWeight: 700, 
                    color: isQrOrderingLive ? '#16A34A' : '#64748B', 
                    background: isQrOrderingLive ? '#DCFCE7' : '#F1F5F9', 
                    padding: '2px 8px', 
                    borderRadius: '6px' 
                  }}>
                    {isQrOrderingLive ? 'Enabled' : (capabilities?.direct_ordering_enabled ? 'Off' : 'Locked')}
                  </span>
                </div>

                {/* WhatsApp Orders */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <Share2 size={16} color={isWhatsappLive ? "#16A34A" : "#94A3B8"} />
                    <span>WhatsApp Orders</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.70rem', 
                    fontWeight: 700, 
                    color: isWhatsappLive ? '#16A34A' : '#64748B', 
                    background: isWhatsappLive ? '#DCFCE7' : '#F1F5F9', 
                    padding: '2px 8px', 
                    borderRadius: '6px' 
                  }}>
                    {isWhatsappLive ? 'Enabled' : (capabilities?.whatsapp_ordering_enabled ? 'Off' : 'Locked')}
                  </span>
                </div>

                {/* KDS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <ChefHat size={16} color={isKdsLive ? "#16A34A" : (capabilities?.kds_enabled ? "#64748B" : "#F59E0B")} />
                    <span>KDS</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.70rem', 
                    fontWeight: 700, 
                    color: isKdsLive ? '#16A34A' : (capabilities?.kds_enabled ? '#64748B' : '#D97706'), 
                    background: isKdsLive ? '#DCFCE7' : (capabilities?.kds_enabled ? '#F1F5F9' : '#FEF3C7'), 
                    padding: '2px 8px', 
                    borderRadius: '6px' 
                  }}>
                    {isKdsLive ? 'Enabled' : (capabilities?.kds_enabled ? 'Off' : 'Locked')}
                  </span>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Sound Alerts */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    {isSoundAlertsOn ? (
                      <Volume2 size={16} color="#16A34A" />
                    ) : (
                      <VolumeX size={16} color="#DC2626" />
                    )}
                    <span>Sound Alerts</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.70rem', 
                    fontWeight: 700, 
                    color: isSoundAlertsOn ? '#16A34A' : '#DC2626', 
                    background: isSoundAlertsOn ? '#DCFCE7' : '#FEE2E2', 
                    padding: '2px 8px', 
                    borderRadius: '6px' 
                  }}>
                    {isSoundAlertsOn ? 'On' : 'Off'}
                  </span>
                </div>

                {/* GST Billing */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 600 }}>
                    <Receipt size={16} color={isGstEnabled ? "#16A34A" : "#64748B"} />
                    <span>GST Billing</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.70rem', 
                    fontWeight: 700, 
                    color: isGstEnabled ? '#16A34A' : '#64748B', 
                    background: isGstEnabled ? '#DCFCE7' : '#F1F5F9', 
                    padding: '2px 8px', 
                    borderRadius: '6px' 
                  }}>
                    {isGstEnabled ? 'Enabled' : (capabilities?.gst_invoice_enabled ? 'Off' : 'Locked')}
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
