import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Calendar,
  DollarSign,
  ShoppingBag,
  ShoppingCart,
  Users,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Info,
  Layers,
  Utensils,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  Clock,
  Package
} from 'lucide-react';
import { getDishImageUrl } from '../../../utils/imageHelper';

/**
 * generateSparklinePath
 * Generates a smooth, normalized SVG path from an authoritative chronological numeric series.
 * Safely handles empty arrays, sparse series (null values for unavailable dates), single points, flat/zero periods, and prevents NaN/Infinity coordinates.
 */
const generateSparklinePath = (dataSeries, width = 100, height = 24, paddingY = 2) => {
  if (!Array.isArray(dataSeries) || dataSeries.length === 0) {
    return `M 0,${height / 2} L ${width},${height / 2}`;
  }

  // Filter valid non-null numbers and track original index
  const validIndices = [];
  const validNumbers = [];
  dataSeries.forEach((v, idx) => {
    if (v !== null && v !== undefined && !isNaN(Number(v)) && isFinite(Number(v))) {
      validIndices.push(idx);
      validNumbers.push(Number(v));
    }
  });

  if (validNumbers.length === 0) {
    return `M 0,${height / 2} L ${width},${height / 2}`;
  }

  const max = Math.max(...validNumbers);
  const min = Math.min(...validNumbers);

  // If all values are 0 or equal or only 1 valid point, render clean flat baseline
  if (max === 0 || max === min || validNumbers.length <= 1) {
    return `M 0,${height / 2} L ${width},${height / 2}`;
  }

  const usableHeight = height - paddingY * 2;
  const range = Math.max(max - min, 1);
  const totalLength = dataSeries.length;

  const points = validNumbers.map((val, i) => {
    const origIdx = validIndices[i];
    const x = totalLength > 1
      ? (origIdx / (totalLength - 1)) * width
      : width / 2;
    const y = paddingY + usableHeight - ((val - min) / range) * usableHeight;
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10
    };
  });

  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
};

const generateSparklineAreaPath = (linePath, width = 100, height = 24) => {
  if (!linePath || linePath.startsWith('M 0,12 L 100,12') || linePath.startsWith('M 0,10 L 100,10')) {
    return '';
  }
  return `${linePath} L ${width},${height} L 0,${height} Z`;
};

export default function AnalyticsView({
  analyticsData = {},
  onExportReport,
  onDownloadAllCSV,
  onFilterPeriod,
  exporting = false,
  exportingAll = false,
  analyticsExportEnabled = true,
  currencySymbol = '₹',
  categories = [],
  dishes = [],
  orders = [],
  onViewOrders
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [chartHoverIndex, setChartHoverIndex] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  // Periodic visual countdown for auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isExporting = exporting || exportingAll;

  // 1. Authoritative KPI Metrics (Strictly live, zero mock fallbacks)
  const totalSales = Number(analyticsData?.period_sales ?? analyticsData?.total_sales ?? 0);
  const totalOrders = Number(analyticsData?.period_orders ?? analyticsData?.total_orders ?? 0);
  const aov = Number(analyticsData?.period_aov ?? analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0));
  const distinctDishesCount = Number(analyticsData?.distinct_dishes_count ?? 0);
  const totalItemsSold = Number(analyticsData?.total_items_sold ?? 0);
  const growthPercentage = analyticsData?.growth_percentage !== undefined && analyticsData?.growth_percentage !== null
    ? Number(analyticsData.growth_percentage)
    : null;

  const selectedPeriod = analyticsData?.selected_period || 'all';

  // Format date range label
  const activeDateRangeLabel = useMemo(() => {
    if (selectedPeriod === 'today') return 'Today';
    if (selectedPeriod === '7d') return 'Last 7 Days';
    if (selectedPeriod === '30d') return 'Last 30 Days';
    if (selectedPeriod === '6m') return 'Last 6 Months';
    if (selectedPeriod === 'all') return 'All Time';
    if (selectedPeriod.startsWith('month:')) {
      const parts = selectedPeriod.replace('month:', '').split('-');
      if (parts.length === 2) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }
    return 'Selected Period';
  }, [selectedPeriod]);

  const handlePeriodChange = (e) => {
    const val = e.target.value;
    if (!onFilterPeriod) return;
    if (val.startsWith('month:')) {
      const parts = val.replace('month:', '').split('-');
      if (parts.length === 2) {
        onFilterPeriod('month', parseInt(parts[0], 10), parseInt(parts[1], 10));
      }
    } else {
      onFilterPeriod(val, null, null);
    }
  };

  const handleExportClick = () => {
    if (isExporting) return;
    const exportFn = onExportReport || onDownloadAllCSV;
    if (exportFn) exportFn(selectedPeriod, null, null);
  };

  // Compact currency formatter for Y-axis guidance
  const formatCompactCurrency = (val, sym = '₹') => {
    const num = Number(val || 0);
    if (num >= 10000000) return `${sym}${(num / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
    if (num >= 100000) return `${sym}${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
    if (num >= 1000) return `${sym}${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${sym}${num.toLocaleString('en-IN')}`;
  };

  const chartTrendSubtitle = useMemo(() => {
    if (selectedPeriod === 'today') return "Today's Trend";
    if (selectedPeriod === '7d') return '7-Day Trend';
    if (selectedPeriod === '30d') return '30-Day Trend';
    if (selectedPeriod === '6m') return '6-Month Trend';
    if (selectedPeriod === 'all') return 'Lifetime Trend';
    if (selectedPeriod.startsWith('month:')) return 'Monthly Trend';
    return 'Sales Trend';
  }, [selectedPeriod]);

  // 2. Dynamic Daily Sales Chart Data Points (SVG Area & Line)
  const rawChartData = useMemo(() => {
    const list = analyticsData?.daily_chart_data || analyticsData?.daily_chart;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return [{ date: 'Today', displayDate: 'Today', sales: totalSales }];
  }, [analyticsData?.daily_chart_data, analyticsData?.daily_chart, totalSales]);

  const maxSales = useMemo(() => {
    const max = Math.max(...rawChartData.map(d => Number(d.sales || 0)));
    return max > 0 ? max : 100;
  }, [rawChartData]);

  const yAxisTicks = useMemo(() => {
    const top = maxSales;
    const mid2 = Math.round((maxSales * 2) / 3);
    const mid1 = Math.round(maxSales / 3);
    const bot = 0;
    return [
      { label: formatCompactCurrency(top, currencySymbol), y: 14 },
      { label: formatCompactCurrency(mid2, currencySymbol), y: 71 },
      { label: formatCompactCurrency(mid1, currencySymbol), y: 127 },
      { label: formatCompactCurrency(bot, currencySymbol), y: 184 }
    ];
  }, [maxSales, currencySymbol]);

  const chartPoints = useMemo(() => {
    const chartWidth = 460;
    const chartHeight = 210;
    const paddingLeft = 40;
    const paddingRight = 12;
    const paddingTop = 14;
    const paddingBottom = 26;
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    return rawChartData.map((d, idx) => {
      const x = rawChartData.length > 1
        ? paddingLeft + (idx / (rawChartData.length - 1)) * usableWidth
        : paddingLeft + usableWidth / 2;
      const salesVal = Number(d.sales || 0);
      const y = paddingTop + usableHeight - (salesVal / maxSales) * usableHeight;
      return {
        ...d,
        sales: salesVal,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        valueFormatted: `${currencySymbol}${salesVal.toLocaleString('en-IN')}`
      };
    });
  }, [rawChartData, maxSales, currencySymbol]);

  // Build smooth bezier curves
  const linePath = useMemo(() => {
    if (!chartPoints || chartPoints.length === 0) return '';
    if (chartPoints.length === 1) return `M ${chartPoints[0].x},${chartPoints[0].y}`;
    let path = `M ${chartPoints[0].x},${chartPoints[0].y}`;
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const p0 = chartPoints[i === 0 ? 0 : i - 1];
      const p1 = chartPoints[i];
      const p2 = chartPoints[i + 1];
      const p3 = chartPoints[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (chartPoints.length <= 1) return '';
    const lastX = chartPoints[chartPoints.length - 1].x;
    const firstX = chartPoints[0].x;
    return `${linePath} L ${lastX},184 L ${firstX},184 Z`;
  }, [linePath, chartPoints]);

  const visibleXLabels = useMemo(() => {
    if (!chartPoints || chartPoints.length === 0) return [];
    const len = chartPoints.length;
    if (len <= 7) return chartPoints.map((pt, i) => ({ ...pt, origIndex: i }));
    const step = Math.ceil((len - 1) / 5);
    const indices = new Set();
    indices.add(0);
    for (let i = step; i < len - 1; i += step) {
      indices.add(i);
    }
    indices.add(len - 1);
    return Array.from(indices).sort((a, b) => a - b).map(idx => ({
      ...chartPoints[idx],
      origIndex: idx
    }));
  }, [chartPoints]);

  const activeHoverPoint = useMemo(() => {
    if (chartHoverIndex !== null && chartPoints[chartHoverIndex]) {
      return chartPoints[chartHoverIndex];
    }
    return chartPoints[chartPoints.length - 1] || null;
  }, [chartHoverIndex, chartPoints]);

  // Dynamic Live Sparkline Paths for KPI Cards (Strictly Data-Driven)
  const salesSparklinePath = useMemo(() => {
    const series = rawChartData.map(d => Number(d.sales || 0));
    return generateSparklinePath(series, 100, 24, 2);
  }, [rawChartData]);

  const salesSparklineAreaPath = useMemo(() => {
    return generateSparklineAreaPath(salesSparklinePath, 100, 24);
  }, [salesSparklinePath]);

  const ordersSparklinePath = useMemo(() => {
    const series = rawChartData.map(d => (d.orders !== undefined ? Number(d.orders || 0) : 0));
    return generateSparklinePath(series, 100, 24, 2);
  }, [rawChartData]);

  const ordersSparklineAreaPath = useMemo(() => {
    return generateSparklineAreaPath(ordersSparklinePath, 100, 24);
  }, [ordersSparklinePath]);

  const aovSparklinePath = useMemo(() => {
    const series = rawChartData.map(d => {
      const s = Number(d.sales || 0);
      const o = Number(d.orders || 0);
      return o > 0 && s > 0 ? Math.round(s / o) : null;
    });
    return generateSparklinePath(series, 100, 24, 2);
  }, [rawChartData]);

  const aovSparklineAreaPath = useMemo(() => {
    return generateSparklineAreaPath(aovSparklinePath, 100, 24);
  }, [aovSparklinePath]);

  // 3. Dynamic Top Dishes by Revenue (Top Selling Items)
  const topDishesByRevenue = useMemo(() => {
    const raw = Array.isArray(analyticsData?.top_dishes_by_revenue)
      ? analyticsData.top_dishes_by_revenue
      : (Array.isArray(analyticsData?.top_dishes) ? analyticsData.top_dishes : []);
    return [...raw]
      .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
      .slice(0, 5)
      .map((td, idx) => {
        const matched = dishes.find(d => 
          String(d.id) === String(td.dish_id) || 
          (d.name && d.name.toLowerCase() === (td.name || '').toLowerCase())
        );
        return {
          rank: idx + 1,
          name: td.name || 'Dish',
          qty: Number(td.quantity || 0),
          sales: Number(td.revenue || 0),
          img: getDishImageUrl(matched?.image)
        };
      });
  }, [analyticsData?.top_dishes_by_revenue, analyticsData?.top_dishes, dishes]);

  // Top Dishes sorted strictly by Quantity Sold
  const topDishesByQuantity = useMemo(() => {
    const raw = Array.isArray(analyticsData?.top_dishes_by_quantity)
      ? analyticsData.top_dishes_by_quantity
      : (Array.isArray(analyticsData?.top_dishes) ? analyticsData.top_dishes : []);
    return [...raw]
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
      .slice(0, 5)
      .map((td, idx) => {
        const matched = dishes.find(d => 
          String(d.id) === String(td.dish_id) || 
          (d.name && d.name.toLowerCase() === (td.name || '').toLowerCase())
        );
        return {
          rank: idx + 1,
          name: td.name || 'Dish',
          qty: Number(td.quantity || 0),
          sales: Number(td.revenue || 0),
          img: getDishImageUrl(matched?.image)
        };
      });
  }, [analyticsData?.top_dishes_by_quantity, analyticsData?.top_dishes, dishes]);

  // 4. Dynamic Category Breakdown (Direct from backend 100% complete dataset)
  const categoriesList = useMemo(() => {
    const raw = Array.isArray(analyticsData?.category_sales) ? analyticsData.category_sales : [];
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

    return raw.map((cat, idx) => ({
      name: cat.name,
      amount: Number(cat.amount || 0),
      percentage: Number(cat.percentage || 0),
      color: colors[idx % colors.length]
    }));
  }, [analyticsData?.category_sales]);

  // Category Donut Slices
  const categoryDonutSlices = useMemo(() => {
    const circumference = 87.96;
    let accumulatedOffset = 0;
    return categoriesList.map(item => {
      const strokeLen = (item.percentage / 100) * circumference;
      const strokeDasharray = `${strokeLen.toFixed(2)} ${(circumference - strokeLen).toFixed(2)}`;
      const strokeDashoffset = (-accumulatedOffset).toFixed(2);
      accumulatedOffset += strokeLen;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset
      };
    });
  }, [categoriesList]);

  // 5. Dynamic Payment Methods Donut Breakdown
  const paymentAnalytics = useMemo(() => {
    const pmSource = analyticsData?.period_payment_methods || analyticsData?.payment_methods || {};
    const upiAmt = Number(pmSource?.upi?.amount || 0);
    const cashAmt = Number(pmSource?.cash?.amount || 0);
    const cardAmt = Number(pmSource?.card?.amount || 0);
    const otherAmt = Number(pmSource?.other?.amount || 0);
    const totalAmt = upiAmt + cashAmt + cardAmt + otherAmt;

    const list = [
      { name: 'UPI', amount: upiAmt, color: '#10B981', percent: totalAmt > 0 ? ((upiAmt / totalAmt) * 100).toFixed(1) : '0' },
      { name: 'Card', amount: cardAmt, color: '#3B82F6', percent: totalAmt > 0 ? ((cardAmt / totalAmt) * 100).toFixed(1) : '0' },
      { name: 'Cash', amount: cashAmt, color: '#F59E0B', percent: totalAmt > 0 ? ((cashAmt / totalAmt) * 100).toFixed(1) : '0' },
      { name: 'Other', amount: otherAmt, color: '#8B5CF6', percent: totalAmt > 0 ? ((otherAmt / totalAmt) * 100).toFixed(1) : '0' }
    ];

    const circumference = 87.96;
    let accumulatedOffset = 0;
    const slices = list.map(item => {
      const pct = parseFloat(item.percent);
      const strokeLen = (pct / 100) * circumference;
      const strokeDasharray = `${strokeLen.toFixed(2)} ${(circumference - strokeLen).toFixed(2)}`;
      const strokeDashoffset = (-accumulatedOffset).toFixed(2);
      accumulatedOffset += strokeLen;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset
      };
    });

    return { totalAmt, slices };
  }, [analyticsData?.period_payment_methods, analyticsData?.payment_methods]);

  // 6. Recent Live Orders (Authoritative slice from analytics payload or live state)
  const recentOrdersList = useMemo(() => {
    const rawList = Array.isArray(analyticsData?.recent_orders) && analyticsData.recent_orders.length > 0
      ? analyticsData.recent_orders
      : (Array.isArray(orders) ? orders : []);

    if (rawList.length === 0) return [];
    return rawList.slice(0, 5).map(o => {
      let itemsCount = 1;
      try {
        if (typeof o.items === 'string') {
          const parsed = JSON.parse(o.items);
          itemsCount = Array.isArray(parsed) ? parsed.reduce((sum, it) => sum + Number(it.quantity || it.qty || 1), 0) : 1;
        } else if (Array.isArray(o.items)) {
          itemsCount = o.items.reduce((sum, it) => sum + Number(it.quantity || it.qty || 1), 0);
        }
      } catch (e) {}

      const d = o.created_at ? new Date(o.created_at) : new Date();
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

      return {
        id: o.id,
        orderNumber: `#ORD-${String(o.id).padStart(4, '0')}`,
        table: o.table_number ? `T-${String(o.table_number).padStart(2, '0')}` : 'Takeaway',
        dateTime: `${dateStr} ${timeStr}`,
        items: itemsCount,
        amount: Number(o.total_amount || 0),
        payment: String(o.payment_method || 'UPI').toUpperCase(),
        status: o.status || 'completed'
      };
    });
  }, [orders]);

  return (
    <div className="analytics-container">
      <style>{`
        .analytics-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          color: #0F172A;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .analytics-subtabs-row {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid #E2E8F0;
          margin-bottom: 2px;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 1px;
        }
        .analytics-subtabs-row::-webkit-scrollbar {
          display: none;
        }
        .analytics-subtab-btn {
          background: none;
          border: none;
          padding: 9px 16px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #64748B;
          cursor: pointer;
          position: relative;
          white-space: nowrap;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 8px 8px 0 0;
        }
        .analytics-subtab-btn:hover {
          color: #0F172A;
          background: #F8FAFC;
        }
        .analytics-subtab-btn.active {
          color: #EA580C;
          font-weight: 800;
        }
        .analytics-subtab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2.5px;
          background: #EA580C;
          border-radius: 2px 2px 0 0;
        }
        .analytics-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        .analytics-row-1 {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 14px;
        }
        .analytics-row-2 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .analytics-card {
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          padding: 16px 18px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .analytics-card:hover {
          border-color: #CBD5E1;
        }
        .analytics-payment-layout {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        /* Large Screens & Desktop (>1280px) */
        @media (min-width: 1281px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .analytics-row-2 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        /* Medium Desktop & Laptops (1024px - 1280px) */
        @media (max-width: 1280px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
          .analytics-kpi-card:nth-child(4),
          .analytics-kpi-card:nth-child(5) {
            grid-column: span 1;
          }
          .analytics-row-2 {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          .analytics-row-2 > div:nth-child(3) {
            grid-column: span 2;
          }
        }

        /* Tablets (768px - 1024px) */
        @media (max-width: 1024px) {
          .analytics-container {
            padding: 18px;
            gap: 16px;
          }
          .analytics-row-1 {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }

        /* Small Tablets & Large Mobiles (640px - 768px) */
        @media (max-width: 768px) {
          .analytics-container {
            padding: 14px;
            gap: 14px;
          }
          .analytics-header-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .analytics-header-controls {
            flex-wrap: wrap !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .analytics-header-control-item {
            flex: 1 1 auto;
          }
          .analytics-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .analytics-kpi-card:nth-child(5) {
            grid-column: span 2 !important;
          }
          .analytics-row-2 {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .analytics-row-2 > div:nth-child(3) {
            grid-column: span 1 !important;
          }
        }

        /* Mobile Screens (<480px) */
        @media (max-width: 480px) {
          .analytics-container {
            padding: 10px;
            gap: 12px;
          }
          .analytics-card {
            padding: 14px !important;
            border-radius: 14px !important;
          }
          .analytics-kpi-card {
            padding: 12px 10px !important;
          }
          .analytics-kpi-title {
            font-size: 0.68rem !important;
          }
          .analytics-kpi-val {
            font-size: 1.20rem !important;
          }
          .analytics-kpi-icon {
            width: 26px !important;
            height: 26px !important;
          }
          .analytics-payment-layout {
            flex-direction: column !important;
            align-items: center !important;
            gap: 16px !important;
          }
        }

        /* Ultra Small Mobile (<360px) */
        @media (max-width: 360px) {
          .analytics-kpi-grid {
            grid-template-columns: 1fr !important;
          }
          .analytics-kpi-card:nth-child(5) {
            grid-column: span 1 !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. HEADER & TOP CONTROLS
         ======================================================== */}
      <div className="analytics-header-row" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.65rem',
            fontWeight: 900,
            color: '#0F172A',
            letterSpacing: '-0.03em',
            margin: 0
          }}>
            Analytics
          </h1>
          <p style={{
            fontSize: '0.84rem',
            color: '#64748B',
            margin: '3px 0 0 0',
            fontWeight: 500
          }}>
            Track your business performance and insights
          </p>
        </div>

        {/* Header Right Controls */}
        <div className="analytics-header-controls" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {/* Date Range Selector Pill */}
          <div className="analytics-header-control-item" style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '7px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            cursor: 'pointer'
          }}>
            <Calendar size={14} color="#64748B" style={{ marginRight: '8px' }} />
            <select
              value={selectedPeriod}
              onChange={handlePeriodChange}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none',
                paddingRight: '16px'
              }}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="all">All Time</option>
              {Array.isArray(analyticsData?.available_months) && analyticsData.available_months.map(m => (
                <option key={m.key} value={`month:${m.key}`}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={13} color="#94A3B8" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
          </div>

          {/* Auto-Refresh Live Pill */}
          <div className="analytics-header-control-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '7px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#64748B',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <RefreshCw size={12} color="#16A34A" />
            <span>Auto refresh in {String(refreshCountdown).padStart(2, '0')}s</span>
          </div>

          {/* Export Report Button */}
          {analyticsExportEnabled && (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              className="analytics-header-control-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                background: '#EA580C',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: isExporting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <Download size={13} />
              <span>{isExporting ? 'Exporting...' : 'Export Report'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. SUBTABS NAVIGATION BAR
         ======================================================== */}
      <div className="analytics-subtabs-row">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'sales', label: 'Sales' },
          { key: 'top_items', label: 'Top Items' },
          { key: 'categories', label: 'Categories' },
          { key: 'payment_modes', label: 'Payment Modes' }
        ].map(tab => (
          <button
            key={tab.key}
            className={`analytics-subtab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================
          3. MAIN TAB: OVERVIEW (MASTER DASHBOARD)
         ======================================================== */}
      {activeTab === 'overview' && (
        <>
          {/* Top 5 KPI Cards Grid */}
          <div className="analytics-kpi-grid">
            {/* Card 1: Sales */}
            <div className="analytics-card analytics-kpi-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="analytics-kpi-title" style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Sales</span>
                  <div className="analytics-kpi-icon" style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: '#FFF7ED',
                    color: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <TrendingUp size={15} />
                  </div>
                </div>

                <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {activeDateRangeLabel}
                </span>

                <div className="analytics-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {currencySymbol}{totalSales.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                  <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800 }}>Live Data</span>
                </div>
              </div>

              {/* Dynamic Live Sparkline (Orange) */}
              <div style={{ width: '100%', height: '28px', marginTop: 'auto' }}>
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="salesKpiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {salesSparklineAreaPath && (
                    <path d={salesSparklineAreaPath} fill="url(#salesKpiGrad)" />
                  )}
                  <path
                    d={salesSparklinePath}
                    fill="none"
                    stroke="#EA580C"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 2: Orders Count */}
            <div className="analytics-card analytics-kpi-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="analytics-kpi-title" style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Orders Count</span>
                  <div className="analytics-kpi-icon" style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: '#EFF6FF',
                    color: '#0284C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ShoppingBag size={15} />
                  </div>
                </div>

                <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {activeDateRangeLabel}
                </span>

                <div className="analytics-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {totalOrders.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284C7' }} />
                  <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 800 }}>Live Data</span>
                </div>
              </div>

              {/* Dynamic Live Sparkline (Blue) */}
              <div style={{ width: '100%', height: '28px', marginTop: 'auto' }}>
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="ordersKpiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284C7" stopOpacity="0.20" />
                      <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {ordersSparklineAreaPath && (
                    <path d={ordersSparklineAreaPath} fill="url(#ordersKpiGrad)" />
                  )}
                  <path
                    d={ordersSparklinePath}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 3: Average Order Value */}
            <div className="analytics-card analytics-kpi-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="analytics-kpi-title" style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Average Order Value</span>
                  <div className="analytics-kpi-icon" style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: '#FAF5FF',
                    color: '#9333EA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ShoppingCart size={15} />
                  </div>
                </div>

                <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {activeDateRangeLabel}
                </span>

                <div className="analytics-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {currencySymbol}{aov.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#9333EA' }} />
                  <span style={{ fontSize: '0.68rem', color: '#9333EA', fontWeight: 800 }}>Live Data</span>
                </div>
              </div>

              {/* Dynamic Live Sparkline (Purple) */}
              <div style={{ width: '100%', height: '28px', marginTop: 'auto' }}>
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="aovKpiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9333EA" stopOpacity="0.20" />
                      <stop offset="100%" stopColor="#9333EA" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {aovSparklineAreaPath && (
                    <path d={aovSparklineAreaPath} fill="url(#aovKpiGrad)" />
                  )}
                  <path
                    d={aovSparklinePath}
                    fill="none"
                    stroke="#9333EA"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 4: Active Dishes Sold */}
            <div className="analytics-card analytics-kpi-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="analytics-kpi-title" style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Active Dishes Sold</span>
                  <div className="analytics-kpi-icon" style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: '#F0FDF4',
                    color: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Utensils size={15} />
                  </div>
                </div>

                <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {activeDateRangeLabel}
                </span>

                <div className="analytics-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {distinctDishesCount.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                  <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800 }}>Live Data</span>
                </div>
              </div>

              {/* Segmented Catalog Activity Visual (Green) */}
              <div style={{ width: '100%', height: '28px', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const isFilled = distinctDishesCount > 0 && idx < Math.min(distinctDishesCount, 12);
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: '11px',
                        borderRadius: '2.5px',
                        background: isFilled ? '#16A34A' : '#F1F5F9',
                        opacity: isFilled ? 0.85 : 0.6,
                        transition: 'all 0.25s ease'
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Card 5: Total Items Sold */}
            <div className="analytics-card analytics-kpi-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="analytics-kpi-title" style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Items Sold</span>
                  <div className="analytics-kpi-icon" style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: '#FEFCE8',
                    color: '#CA8A04',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Package size={15} />
                  </div>
                </div>

                <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {activeDateRangeLabel}
                </span>

                <div className="analytics-kpi-val" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {totalItemsSold.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#CA8A04' }} />
                  <span style={{ fontSize: '0.68rem', color: '#CA8A04', fontWeight: 800 }}>Live Data</span>
                </div>
              </div>

              {/* Segmented Items Activity Visual (Amber) */}
              <div style={{ width: '100%', height: '28px', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const isFilled = totalItemsSold > 0 && idx < Math.min(Math.ceil(totalItemsSold / 25) || 1, 12);
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: '11px',
                        borderRadius: '2.5px',
                        background: isFilled ? '#CA8A04' : '#F1F5F9',
                        opacity: isFilled ? 0.85 : 0.6,
                        transition: 'all 0.25s ease'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 1: SALES TREND + PAYMENT METHODS
             ======================================================== */}
          <div className="analytics-row-1">
            {/* Sales Trend Chart */}
            <div className="analytics-card" style={{ padding: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Sales Trend ({activeDateRangeLabel})
                    </h3>
                    <Info size={13} color="#94A3B8" />
                  </div>

                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                    {chartTrendSubtitle}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.40rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                      {currencySymbol}{totalSales.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>
                      • Live Data
                    </span>
                  </div>

                  {/* Summary Metric Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '7px', padding: '3px 8px', fontSize: '0.68rem', color: '#C2410C', fontWeight: 700 }}>
                      Peak: {currencySymbol}{Math.max(...rawChartData.map(d => Number(d.sales || 0)), 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '7px', padding: '3px 8px', fontSize: '0.68rem', color: '#475569', fontWeight: 700 }}>
                      {rawChartData.length} {selectedPeriod === 'all' ? 'Months' : 'Days'} Tracked
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic SVG Area Line Chart with Expanded Plotting Area */}
              <div style={{ position: 'relative', width: '100%', height: '240px', marginTop: '4px' }}>
                {activeHoverPoint && (
                  <div style={{
                    position: 'absolute',
                    left: `${(activeHoverPoint.x / 460) * 100}%`,
                    top: activeHoverPoint.y > 45 ? `${(activeHoverPoint.y / 210) * 100 - 12}%` : `${(activeHoverPoint.y / 210) * 100 + 12}%`,
                    transform: activeHoverPoint.y > 45 ? 'translate(-50%, -100%)' : 'translate(-50%, 0%)',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block' }}>
                      {activeHoverPoint.displayDate || activeHoverPoint.date}
                      {activeHoverPoint.isCurrentMonth ? ' · Month to date' : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EA580C' }} />
                      <strong style={{ fontSize: '0.74rem', color: '#0F172A' }}>
                        Sales {activeHoverPoint.valueFormatted}
                        {activeHoverPoint.isCurrentMonth ? ' (to date)' : ''}
                      </strong>
                    </div>
                  </div>
                )}

                <svg viewBox="0 0 460 210" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Dynamic Y-Axis Values & Horizontal Grid Lines */}
                  {yAxisTicks.map((tick, idx) => (
                    <g key={idx}>
                      <line
                        x1="40"
                        y1={tick.y}
                        x2="450"
                        y2={tick.y}
                        stroke="#F1F5F9"
                        strokeWidth="1"
                        strokeDasharray={idx === yAxisTicks.length - 1 ? 'none' : '3 3'}
                      />
                      <text
                        x="34"
                        y={tick.y + 3}
                        textAnchor="end"
                        fill="#94A3B8"
                        fontSize="8.5"
                        fontWeight="600"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}

                  {/* Transparent Area Fill */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#salesGradient)"
                    />
                  )}

                  {/* Data Anchor Pillars & Point Drop-lines */}
                  {chartPoints.map((pt, idx) => {
                    const colH = Math.max(184 - pt.y, 0);
                    const isHovered = activeHoverPoint?.date === pt.date;
                    return (
                      <g key={`col-${idx}`}>
                        <rect
                          x={pt.x - 14}
                          y={pt.y}
                          width="28"
                          height={colH}
                          rx="4"
                          fill="#EA580C"
                          fillOpacity={isHovered ? 0.16 : 0.05}
                          style={{ transition: 'all 0.2s ease' }}
                        />
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={pt.x}
                          y2="184"
                          stroke="#EA580C"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                          strokeOpacity={isHovered ? 0.5 : 0.2}
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 4.5 : 3}
                          fill="#EA580C"
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  })}

                  {/* Smooth Real Data Line */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#EA580C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Highlighted Active Hover Point with Outer Ring Halo */}
                  {activeHoverPoint && (
                    <g pointerEvents="none">
                      <circle
                        cx={activeHoverPoint.x}
                        cy={activeHoverPoint.y}
                        r="7.5"
                        fill="#EA580C"
                        fillOpacity="0.22"
                      />
                      <circle
                        cx={activeHoverPoint.x}
                        cy={activeHoverPoint.y}
                        r="4.5"
                        fill="#EA580C"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    </g>
                  )}

                  {/* Invisible Hit Targets for Hover Interaction */}
                  {chartPoints.map((pt, idx) => (
                    <g key={idx} onMouseEnter={() => setChartHoverIndex(idx)} onClick={() => setChartHoverIndex(idx)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="16"
                        fill="transparent"
                      />
                    </g>
                  ))}

                  {/* Adaptive X-Axis Labels Aligned with Data Points */}
                  {visibleXLabels.map((pt, idx) => (
                    <text
                      key={idx}
                      x={pt.x}
                      y="198"
                      textAnchor="middle"
                      fill={activeHoverPoint?.date === pt.date ? '#0F172A' : '#94A3B8'}
                      fontSize="9"
                      fontWeight={activeHoverPoint?.date === pt.date ? '800' : '500'}
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {pt.displayDate || pt.date}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            {/* Payment Methods Card */}
            <div className="analytics-card" style={{ padding: '20px', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Payment Methods
                  </h3>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>
                    {activeDateRangeLabel}
                  </span>
                </div>

                {/* Interactive Donut & Legend Container */}
                <div style={{ marginTop: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="analytics-payment-layout">
                    {/* SVG Donut */}
                    <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0, margin: '0 auto' }}>
                      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4.5" />
                        {paymentAnalytics.slices.map((slice, idx) => {
                          if (parseFloat(slice.percent) <= 0) return null;
                          return (
                            <circle
                              key={idx}
                              cx="18"
                              cy="18"
                              r="14"
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth="4.5"
                              strokeDasharray={slice.strokeDasharray}
                              strokeDashoffset={slice.strokeDashoffset}
                            />
                          );
                        })}
                      </svg>

                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        width: '85%'
                      }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                          {currencySymbol}{paymentAnalytics.totalAmt.toLocaleString('en-IN')}
                        </div>
                        <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>Total Sales</span>
                      </div>
                    </div>

                    {/* Payment Breakdown Legend with Mini Progress Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      {paymentAnalytics.slices.map((item, idx) => (
                        <div key={idx} style={{ background: '#F8FAFC', padding: '7px 10px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: item.color }} />
                              <span style={{ color: '#0F172A', fontWeight: 700 }}>{item.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#64748B', fontSize: '0.66rem' }}>{currencySymbol}{item.amount.toLocaleString('en-IN')}</span>
                              <strong style={{ color: '#0F172A', fontSize: '0.74rem' }}>{item.percent}%</strong>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${item.percent}%`, height: '100%', background: item.color, borderRadius: '2px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Last updated: Just now</span>
                <RefreshCw size={11} color="#94A3B8" />
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 2: 3-COLUMN DEEP ANALYTICS & RANKING GRID
             ======================================================== */}
          <div className="analytics-row-2">
            {/* 1. Top Selling Items (By Revenue) */}
            <div className="analytics-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Top Selling Items (By Revenue)
                </h3>
                <button
                  onClick={() => setActiveTab('top_items')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  View All
                </button>
              </div>
              <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '14px' }}>
                {activeDateRangeLabel}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {topDishesByRevenue.length > 0 ? (
                  topDishesByRevenue.map(item => (
                    <div key={item.rank} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#F8FAFC',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid #F1F5F9',
                      transition: 'background 0.15s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: item.rank === 1 ? '#FFF7ED' : item.rank === 2 ? '#FEFCE8' : item.rank === 3 ? '#F8FAFC' : '#F1F5F9',
                          color: item.rank === 1 ? '#EA580C' : item.rank === 2 ? '#CA8A04' : '#64748B',
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {item.rank}
                        </span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', background: '#F1F5F9', flexShrink: 0 }}>
                          <img
                            src={item.img}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.76rem', color: '#0F172A', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </strong>
                          <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>{item.qty} items sold</span>
                        </div>
                      </div>
                      <strong style={{ fontSize: '0.76rem', color: '#0F172A', flexShrink: 0 }}>
                        {currencySymbol}{item.sales.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.74rem' }}>
                    No item sales recorded yet.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
                <button
                  onClick={() => setActiveTab('top_items')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>See all items</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 2. Top Categories */}
            <div className="analytics-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Top Categories
                </h3>
                <button
                  onClick={() => setActiveTab('categories')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  View All
                </button>
              </div>
              <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '14px' }}>
                {activeDateRangeLabel}
              </span>

              {/* Rich Categories List with Structured Progress Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {categoriesList.slice(0, 5).map((cat, idx) => (
                  <div key={idx} style={{
                    background: '#F8FAFC',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1px solid #F1F5F9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'background 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                        <strong style={{ color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.name}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ color: '#64748B', fontSize: '0.66rem' }}>{currencySymbol}{cat.amount.toLocaleString('en-IN')}</span>
                        <strong style={{ color: '#0F172A', fontSize: '0.74rem' }}>{cat.percentage}%</strong>
                      </div>
                    </div>

                    {/* Smooth Progress Bar */}
                    <div style={{ width: '100%', height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${cat.percentage}%`, height: '100%', background: cat.color, borderRadius: '2px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))}

                {categoriesList.length === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.74rem' }}>
                    No category sales recorded yet.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
                <button
                  onClick={() => setActiveTab('categories')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>See all categories</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 3. Top Dishes (By Quantity) */}
            <div className="analytics-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Top Dishes (By Quantity)
                </h3>
                <button
                  onClick={() => setActiveTab('top_items')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  View All
                </button>
              </div>
              <span style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '14px' }}>
                {activeDateRangeLabel}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {topDishesByQuantity.length > 0 ? (
                  topDishesByQuantity.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#F8FAFC',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid #F1F5F9',
                      transition: 'background 0.15s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: item.rank === 1 ? '#DCFCE7' : item.rank === 2 ? '#ECFDF5' : '#F1F5F9',
                          color: item.rank === 1 ? '#16A34A' : item.rank === 2 ? '#059669' : '#64748B',
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {item.rank}
                        </span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', background: '#F1F5F9', flexShrink: 0 }}>
                          <img
                            src={item.img}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                          />
                        </div>
                        <strong style={{ fontSize: '0.76rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </strong>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: '#DCFCE7',
                        color: '#16A34A',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        flexShrink: 0
                      }}>
                        {item.qty} sold
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.74rem' }}>
                    No dish activity recorded yet.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
                <button
                  onClick={() => setActiveTab('top_items')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>See all dishes</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 3: RECENT ORDERS TABLE
             ======================================================== */}
          <div className="analytics-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Recent Orders
                </h3>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                  Live incoming &amp; completed orders from customers
                </span>
              </div>

              {onViewOrders && (
                <button
                  onClick={onViewOrders}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  View All
                </button>
              )}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', color: '#94A3B8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Order ID</th>
                    <th style={{ padding: '8px 10px' }}>Table</th>
                    <th style={{ padding: '8px 10px' }}>Date &amp; Time</th>
                    <th style={{ padding: '8px 10px' }}>Items</th>
                    <th style={{ padding: '8px 10px' }}>Amount</th>
                    <th style={{ padding: '8px 10px' }}>Payment</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrdersList.length > 0 ? (
                    recentOrdersList.map(order => (
                      <tr key={order.id} style={{ borderBottom: '1px solid #F8FAFC', fontSize: '0.76rem', color: '#0F172A' }}>
                        <td style={{ padding: '10px', fontWeight: 700 }}>{order.orderNumber}</td>
                        <td style={{ padding: '10px', color: '#64748B', fontWeight: 600 }}>{order.table}</td>
                        <td style={{ padding: '10px', color: '#64748B' }}>{order.dateTime}</td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{order.items}</td>
                        <td style={{ padding: '10px', fontWeight: 800 }}>{currencySymbol}{order.amount.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#64748B' }}>{order.payment}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: order.status === 'completed' || order.status === 'delivered' ? '#DCFCE7' : '#FEF3C7',
                            color: order.status === 'completed' || order.status === 'delivered' ? '#16A34A' : '#D97706',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            textTransform: 'capitalize'
                          }}>
                            {order.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button
                            onClick={onViewOrders}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
                        {totalOrders > 0 ? (
                          <span>
                            No recent orders available in this view.{' '}
                            {onViewOrders && (
                              <button
                                onClick={onViewOrders}
                                style={{ background: 'none', border: 'none', color: '#0284C7', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                              >
                                View complete history in Orders →
                              </button>
                            )}
                          </span>
                        ) : (
                          'No recent orders recorded yet.'
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timezone Footer */}
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 500, marginTop: '6px' }}>
            All times are in India Standard Time (IST)
          </div>
        </>
      )}

      {/* ========================================================
          4. TAB: SALES DRILLDOWN
         ======================================================== */}
      {activeTab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="analytics-card">
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Period Revenue</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{totalSales.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                • Active in {activeDateRangeLabel}
              </span>
            </div>

            <div className="analytics-card">
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {totalOrders.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Completed &amp; Live Orders
              </span>
            </div>

            <div className="analytics-card">
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Average Order Value</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{aov.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#9333EA', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Per Customer Ticket
              </span>
            </div>
          </div>

          {/* Detailed Timeline */}
          <div className="analytics-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Detailed Sales Timeline
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Chronological revenue distribution across {activeDateRangeLabel}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, background: '#F8FAFC', padding: '4px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                {rawChartData.length} Data Points
              </span>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '240px', marginTop: '16px' }}>
              {activeHoverPoint && (
                <div style={{
                  position: 'absolute',
                  left: `${(activeHoverPoint.x / 460) * 100}%`,
                  top: `${(activeHoverPoint.y / 200) * 100 - 32}%`,
                  transform: 'translate(-50%, -100%)',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>
                    {activeHoverPoint.displayDate || activeHoverPoint.date}
                  </span>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A' }}>
                    {activeHoverPoint.valueFormatted}
                  </strong>
                </div>
              )}

              <svg viewBox="0 0 460 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="salesGradientTab" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EA580C" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {yAxisTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line x1="44" y1={tick.y} x2="450" y2={tick.y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="38" y={tick.y + 3} textAnchor="end" fill="#94A3B8" fontSize="8.5" fontWeight="600">{tick.label}</text>
                  </g>
                ))}

                {areaPath && <path d={areaPath} fill="url(#salesGradientTab)" />}
                {linePath && <path d={linePath} fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                {activeHoverPoint && (
                  <g pointerEvents="none">
                    <circle cx={activeHoverPoint.x} cy={activeHoverPoint.y} r="7.5" fill="#EA580C" fillOpacity="0.18" />
                    <circle cx={activeHoverPoint.x} cy={activeHoverPoint.y} r="4.5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="2" />
                  </g>
                )}

                {chartPoints.map((pt, idx) => (
                  <g key={idx} onMouseEnter={() => setChartHoverIndex(idx)} onClick={() => setChartHoverIndex(idx)} style={{ cursor: 'pointer' }}>
                    <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                  </g>
                ))}

                {visibleXLabels.map((pt, idx) => (
                  <text key={idx} x={pt.x} y="186" textAnchor="middle" fill={activeHoverPoint?.date === pt.date ? '#0F172A' : '#94A3B8'} fontSize="9" fontWeight={activeHoverPoint?.date === pt.date ? '800' : '500'}>
                    {pt.displayDate || pt.date}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. TAB: TOP ITEMS DRILLDOWN
         ======================================================== */}
      {activeTab === 'top_items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="analytics-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Dish Sales &amp; Velocity Ranking
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Authoritative ranking of dishes sold in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', color: '#94A3B8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px' }}>Rank</th>
                    <th style={{ padding: '10px' }}>Item</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Quantity Sold</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topDishesList.length > 0 ? (
                    topDishesList.map(item => (
                      <tr key={item.rank} style={{ borderBottom: '1px solid #F8FAFC', fontSize: '0.76rem', color: '#0F172A' }}>
                        <td style={{ padding: '10px', fontWeight: 800, width: '40px' }}>
                          <span style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: item.rank === 1 ? '#FFF7ED' : item.rank === 2 ? '#FEFCE8' : item.rank === 3 ? '#F8FAFC' : '#F1F5F9',
                            color: item.rank === 1 ? '#EA580C' : item.rank === 2 ? '#CA8A04' : '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.68rem',
                            fontWeight: 900
                          }}>
                            {item.rank}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: '#F8FAFC', flexShrink: 0 }}>
                              <img
                                src={item.img}
                                alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                              />
                            </div>
                            <strong style={{ fontSize: '0.80rem' }}>{item.name}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#64748B' }}>
                          {item.qty} units
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, color: '#0F172A' }}>
                          {currencySymbol}{item.sales.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '30px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
                        No items sold in {activeDateRangeLabel}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          6. TAB: CATEGORIES DRILLDOWN
         ======================================================== */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="analytics-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Complete Category Breakdown
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Authoritative revenue distribution across menu categories in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {categoriesList.length > 0 ? (
                categoriesList.map((cat, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#F8FAFC', padding: '14px 16px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.80rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color }} />
                        <strong style={{ color: '#0F172A' }}>{cat.name}</strong>
                      </div>
                      <div>
                        <strong style={{ color: '#0F172A' }}>{currencySymbol}{cat.amount.toLocaleString('en-IN')}</strong>
                        <span style={{ color: '#64748B', marginLeft: '6px', fontSize: '0.72rem' }}>({cat.percentage}%)</span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${cat.percentage}%`, maxWidth: '100%', height: '100%', background: cat.color, borderRadius: '4px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
                  No category sales recorded in {activeDateRangeLabel}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. TAB: PAYMENT MODES DRILLDOWN
         ======================================================== */}
      {activeTab === 'payment_modes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="analytics-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Settlement &amp; Payment Mode Analysis
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Authoritative split across payment types in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              {paymentAnalytics.slices.map((item, idx) => (
                <div key={idx} style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 700 }}>{item.name}</span>
                  </div>
                  <div style={{ fontSize: '1.30rem', fontWeight: 900, color: '#0F172A' }}>
                    {currencySymbol}{item.amount.toLocaleString('en-IN')}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: item.color, fontWeight: 800, marginTop: '2px', display: 'block' }}>
                    {item.percent}% of total sales
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
