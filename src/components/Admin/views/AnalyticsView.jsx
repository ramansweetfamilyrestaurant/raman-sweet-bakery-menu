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
import { getBusinessTerminology } from '../../../utils/businessTaxonomy';

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

const formatAnalyticsPeriodLabel = (period) => {
  if (period === 'today') return 'Today';
  if (period === '7d') return 'Last 7 Days';
  if (period === '30d') return 'Last 30 Days';
  if (period === '6m') return 'Last 6 Months';
  if (period === 'all') return 'All Time';
  if (typeof period === 'string' && period.startsWith('month:')) {
    const parts = period.replace('month:', '').split('-');
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (y && m >= 1 && m <= 12) {
        const d = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
      }
    }
  }
  return 'Selected Period';
};

export default function AnalyticsView({
  analyticsData = {},
  selectedFilterPeriod = null,
  syncStatus = 'idle',
  syncError = null,
  onRetrySync = null,
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
  restaurantInfo = {},
  onViewOrders
}) {
  const terminology = getBusinessTerminology(restaurantInfo || {});
  const itemPlural = terminology.itemPlural || 'Items';
  const itemSingular = terminology.itemSingular || 'Item';
  const isHotel = terminology.serviceModel === 'hotel';
  const isCinema = terminology.serviceModel === 'cinema';
  const spaceSingular = isHotel ? 'Room' : isCinema ? 'Seat' : (terminology.spaceSingular || 'Table');
  const spacePlural = isHotel ? 'Rooms' : isCinema ? 'Seats' : (terminology.spacePlural || 'Tables');

  const todayScans = Number(analyticsData?.today_scans ?? 0);
  const yesterdayScans = Number(analyticsData?.yesterday_scans ?? 0);
  const weeklyScans = Number(analyticsData?.weekly_scans ?? 0);
  const totalScans = Number(analyticsData?.total_scans ?? restaurantInfo?.scan_count ?? 0);
  const peakScanHour = analyticsData?.peak_scan_hour || null;
  const hourlyScansToday = Array.isArray(analyticsData?.hourly_scans_today) ? analyticsData.hourly_scans_today : [];
  const topTablesScannedToday = Array.isArray(analyticsData?.top_tables_scanned_today) ? analyticsData.top_tables_scanned_today : [];

  const [activeTab, setActiveTab] = useState('overview');
  const [chartHoverIndex, setChartHoverIndex] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(10);

  const payloadPeriod = analyticsData?.selected_period || 'all';
  const requestedPeriod = selectedFilterPeriod || payloadPeriod;
  const isPeriodSyncing = syncStatus === 'loading' && requestedPeriod !== payloadPeriod;
  const isPeriodSyncError = syncStatus === 'error';
  const lastUpdatedTimeLabel = useMemo(() => {
    if (!analyticsData?.last_updated) return null;
    try {
      return new Date(analyticsData.last_updated).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
    } catch (e) {
      return null;
    }
  }, [analyticsData?.last_updated]);

  // Sync visual countdown with 10s backend poll interval (paused while actively refreshing or errored)
  useEffect(() => {
    setRefreshCountdown(10);
  }, [analyticsData?.last_updated, payloadPeriod, syncStatus]);

  useEffect(() => {
    if (syncStatus !== 'idle' || !analyticsData?.last_updated) return undefined;
    const timer = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? 10 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [syncStatus, analyticsData?.last_updated]);

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

  // Format date range label strictly for the currently rendered payload period (IST-safe UTC midpoint)
  const activeDateRangeLabel = useMemo(() => formatAnalyticsPeriodLabel(payloadPeriod), [payloadPeriod]);
  const requestedDateRangeLabel = useMemo(() => formatAnalyticsPeriodLabel(requestedPeriod), [requestedPeriod]);

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
    if (!exportFn) return;
    if (requestedPeriod.startsWith('month:')) {
      const parts = requestedPeriod.replace('month:', '').split('-');
      if (parts.length === 2) {
        exportFn('month', parseInt(parts[0], 10), parseInt(parts[1], 10));
        return;
      }
    }
    exportFn(requestedPeriod, null, null);
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
    if (payloadPeriod === 'today') return "Today's Trend";
    if (payloadPeriod === '7d') return '7-Day Trend';
    if (payloadPeriod === '30d') return '30-Day Trend';
    if (payloadPeriod === '6m') return '6-Month Trend';
    if (payloadPeriod === 'all') return 'Lifetime Trend';
    if (payloadPeriod.startsWith('month:')) return 'Monthly Trend';
    return 'Sales Trend';
  }, [payloadPeriod]);

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
      { label: formatCompactCurrency(top, currencySymbol), y: 10 },
      { label: formatCompactCurrency(mid2, currencySymbol), y: 60 },
      { label: formatCompactCurrency(mid1, currencySymbol), y: 110 },
      { label: formatCompactCurrency(bot, currencySymbol), y: 160 }
    ];
  }, [maxSales, currencySymbol]);

  const chartPoints = useMemo(() => {
    const chartWidth = 740;
    const chartHeight = 170;
    const paddingLeft = 8;
    const paddingRight = 8;
    const paddingTop = 10;
    const paddingBottom = 10;
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    return rawChartData.map((d, idx) => {
      const x = rawChartData.length > 1
        ? paddingLeft + (idx / (rawChartData.length - 1)) * usableWidth
        : paddingLeft + usableWidth / 2;
      const salesVal = Number(d.sales || 0);
      const y = paddingTop + usableHeight - (salesVal / maxSales) * usableHeight;
      const roundedX = Math.round(x * 10) / 10;
      const roundedY = Math.round(y * 10) / 10;
      return {
        ...d,
        sales: salesVal,
        x: roundedX,
        y: roundedY,
        xPercent: (roundedX / chartWidth) * 100,
        yPercent: (roundedY / chartHeight) * 100,
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
    return `${linePath} L ${lastX},160 L ${firstX},160 Z`;
  }, [linePath, chartPoints]);

  const visibleXLabels = useMemo(() => {
    if (!chartPoints || chartPoints.length === 0) return [];
    const len = chartPoints.length;
    if (len <= 5) return chartPoints.map((pt, i) => ({ ...pt, origIndex: i }));
    const step = Math.ceil((len - 1) / 4);
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

  useEffect(() => {
    setChartHoverIndex(null);
  }, [payloadPeriod, rawChartData.length]);

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

  // Top Dishes sorted strictly by Quantity Sold (Top 5 for overview)
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

  // Full Top Dishes List for Dishes drilldown tab
  const topDishesList = useMemo(() => {
    const raw = Array.isArray(analyticsData?.top_dishes_by_quantity)
      ? analyticsData.top_dishes_by_quantity
      : (Array.isArray(analyticsData?.top_dishes) ? analyticsData.top_dishes : []);
    return [...raw]
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
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
    const formatOrderSpace = (order) => {
      const raw = order.table_number ? String(order.table_number).trim() : '';
      if (!raw) return 'Takeaway';
      let inferredType = '';
      if (!order.space_type) {
        if (raw.toUpperCase() === 'COUNTER') inferredType = 'counter';
        else if (/^table\b/i.test(raw)) inferredType = 'table';
        else if (/^room\b/i.test(raw)) inferredType = 'room';
        else if (/^cabin\b/i.test(raw)) inferredType = 'cabin';
        else if (/^vip\b/i.test(raw)) inferredType = 'vip';
        else if (/^(?:screen\s*\d+|s?\d+[\-_:][a-zA-Z]+[\-_:]\d+|seat\b)/i.test(raw)) inferredType = 'cinema_seat';
      }
      const sType = String(order.space_type || inferredType || (isHotel ? 'room' : isCinema ? 'cinema_seat' : 'table')).toLowerCase();
      if (sType === 'counter' || raw.toUpperCase() === 'COUNTER') return 'Counter';
      if (sType === 'room') return `Room ${raw.replace(/^room\s*#?/i, '').trim() || raw}`;
      if (sType === 'cinema_seat' || sType === 'cinema') return `Seat ${raw.replace(/^seat\s*#?/i, '').trim() || raw}`;
      if (sType === 'cabin') return `Cabin ${raw.replace(/^cabin\s*#?/i, '').trim() || raw}`;
      if (sType === 'vip') return `VIP ${raw.replace(/^vip\s*#?/i, '').trim() || raw}`;
      if (sType === 'table') {
        const cleanTbl = raw.replace(/^table\s*#?/i, '').trim() || raw;
        return /^\d+$/.test(cleanTbl) ? `T-${cleanTbl.padStart(2, '0')}` : raw;
      }
      return /^\d+$/.test(raw) ? `T-${raw.padStart(2, '0')}` : raw;
    };

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
        table: formatOrderSpace(o),
        dateTime: `${dateStr} ${timeStr}`,
        items: itemsCount,
        amount: Number(o.total_amount || 0),
        payment: String(o.payment_method || 'UPI').toUpperCase(),
        status: o.status || 'completed'
      };
    });
  }, [analyticsData?.recent_orders, orders, isHotel, isCinema]);

  const renderSalesChart = (gradientId, showBars = false) => {
    const barWidth = Math.max(4, Math.min(28, Math.floor((680 / Math.max(chartPoints.length, 1)) * 0.55)));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '6px', width: '100%', minWidth: 0 }}>
          {/* Crisp HTML Y-Axis (never squashed on mobile) */}
          <div style={{
            width: '42px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            textAlign: 'right',
            padding: '4px 0',
            fontSize: '0.64rem',
            fontWeight: 600,
            color: '#94A3B8',
            lineHeight: 1
          }}>
            {yAxisTicks.map((tick, idx) => (
              <span key={idx}>{tick.label}</span>
            ))}
          </div>

          {/* Interactive Plot Stage */}
          <div className="analytics-chart-stage" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            {activeHoverPoint && (() => {
              const hoverPercent = activeHoverPoint.xPercent;
              let xTransform = '-50%';
              if (hoverPercent > 74) {
                xTransform = '-96%';
              } else if (hoverPercent < 26) {
                xTransform = '-4%';
              }
              const yTransform = activeHoverPoint.y > 42 ? '-105%' : '10%';
              const topPercent = `${activeHoverPoint.yPercent}%`;

              return (
                <div style={{
                  position: 'absolute',
                  left: `${hoverPercent}%`,
                  top: topPercent,
                  transform: `translate(${xTransform}, ${yTransform})`,
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '5px 9px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>
                    {activeHoverPoint.displayDate || activeHoverPoint.date}
                    {activeHoverPoint.isCurrentMonth ? ' · MTD' : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '1px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EA580C' }} />
                    <strong style={{ fontSize: '0.72rem', color: '#0F172A' }}>
                      {activeHoverPoint.valueFormatted}
                    </strong>
                  </div>
                </div>
              );
            })()}

            <svg viewBox="0 0 740 170" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity={showBars ? '0.18' : '0.26'} />
                  <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {yAxisTicks.map((tick, idx) => (
                <line
                  key={idx}
                  x1="0"
                  y1={tick.y}
                  x2="740"
                  y2={tick.y}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={idx === yAxisTicks.length - 1 ? 'none' : '3 3'}
                />
              ))}

              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

              {showBars && chartPoints.map((pt, idx) => {
                const colH = Math.max(160 - pt.y, 0);
                const isHovered = activeHoverPoint?.date === pt.date;
                return (
                  <g key={`col-${idx}`}>
                    <rect
                      x={pt.x - barWidth / 2}
                      y={pt.y}
                      width={barWidth}
                      height={colH}
                      fill="#EA580C"
                      fillOpacity={isHovered ? 0.16 : 0.05}
                    />
                    <line
                      x1={pt.x}
                      y1={pt.y}
                      x2={pt.x}
                      y2="160"
                      stroke="#EA580C"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray="2 2"
                      strokeOpacity={isHovered ? 0.5 : 0.2}
                    />
                  </g>
                );
              })}

              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            {/* Non-overlapping plot-level hit strips (preserve independent selection per sample) */}
            {chartPoints.map((pt, idx) => {
              const prevMid = idx === 0 ? 0 : (chartPoints[idx - 1].xPercent + pt.xPercent) / 2;
              const nextMid = idx === chartPoints.length - 1 ? 100 : (pt.xPercent + chartPoints[idx + 1].xPercent) / 2;
              return (
                <button
                  key={`hit-${idx}`}
                  type="button"
                  aria-label={`${pt.displayDate || pt.date}: ${pt.valueFormatted}`}
                  onMouseEnter={() => setChartHoverIndex(idx)}
                  onFocus={() => setChartHoverIndex(idx)}
                  onClick={() => setChartHoverIndex(idx)}
                  style={{
                    position: 'absolute',
                    left: `${prevMid}%`,
                    width: `${Math.max(nextMid - prevMid, 0)}%`,
                    top: 0,
                    bottom: 0,
                    padding: 0,
                    margin: 0,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 4
                  }}
                />
              );
            })}

            {/* Visible circular point markers (decoupled from hit regions so markers never block nearby points) */}
            {chartPoints.map((pt, idx) => {
              const isHovered = activeHoverPoint?.date === pt.date;
              return (
                <span
                  key={`pt-${idx}`}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: `${pt.xPercent}%`,
                    top: `${pt.yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isHovered ? '16px' : '8px',
                    height: isHovered ? '16px' : '8px',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: isHovered ? 6 : 3
                  }}
                >
                  {isHovered && (
                    <span style={{
                      position: 'absolute',
                      width: '15px',
                      height: '15px',
                      borderRadius: '50%',
                      background: 'rgba(234, 88, 12, 0.22)'
                    }} />
                  )}
                  <span style={{
                    width: isHovered ? '9px' : '6px',
                    height: isHovered ? '9px' : '6px',
                    borderRadius: '50%',
                    background: '#EA580C',
                    border: '1.5px solid #FFFFFF',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                    display: 'block'
                  }} />
                </span>
              );
            })}
          </div>
        </div>

        {/* Crisp HTML X-Axis Date Labels positioned strictly at each sample's xPercent */}
        <div style={{
          position: 'relative',
          marginLeft: '48px',
          height: '18px',
          minWidth: 0
        }}>
          {visibleXLabels.map((pt, idx) => {
            const isActive = activeHoverPoint?.date === pt.date;
            const isFirst = idx === 0 && visibleXLabels.length > 1 && pt.xPercent < 15;
            const isLast = idx === visibleXLabels.length - 1 && visibleXLabels.length > 1 && pt.xPercent > 85;
            const xAlignTransform = isFirst ? 'translateX(0%)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)';
            const textAlign = isFirst ? 'left' : isLast ? 'right' : 'center';
            return (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${pt.xPercent}%`,
                  top: 0,
                  transform: xAlignTransform,
                  textAlign,
                  fontSize: '0.64rem',
                  color: isActive ? '#0F172A' : '#94A3B8',
                  fontWeight: isActive ? 800 : 600,
                  whiteSpace: 'nowrap',
                  lineHeight: '18px',
                  pointerEvents: 'none'
                }}
              >
                {pt.displayDate || pt.date}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

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
          min-width: 0;
          overflow-x: hidden;
          box-sizing: border-box;
        }
        .analytics-header-title {
          font-size: 1.65rem;
          font-weight: 900;
          color: #0F172A;
          letter-spacing: -0.03em;
          margin: 0;
          line-height: 1.15;
        }
        .analytics-header-subtitle {
          font-size: 0.84rem;
          color: #64748B;
          margin: 3px 0 0 0;
          font-weight: 500;
        }
        .analytics-period-box {
          position: relative;
          display: flex;
          align-items: center;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 0 12px;
          height: 38px;
          min-height: 38px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          cursor: pointer;
          box-sizing: border-box;
          min-width: 0;
        }
        .analytics-period-select {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: none;
          font-size: 0.80rem !important;
          font-weight: 700;
          color: #0F172A;
          cursor: pointer;
          outline: none;
          padding: 0 20px 0 0;
          width: 100%;
          min-width: 0;
          height: 100%;
          min-height: 0 !important;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .analytics-refresh-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 0 12px;
          height: 38px;
          min-height: 38px;
          font-size: 0.75rem;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          white-space: nowrap;
          box-sizing: border-box;
        }
        .analytics-export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 14px;
          height: 38px;
          min-height: 38px;
          border-radius: 10px;
          background: #EA580C;
          color: #FFFFFF;
          border: none;
          font-size: 0.78rem;
          font-weight: 800;
          box-shadow: 0 2px 4px rgba(234, 88, 12, 0.2);
          transition: all 0.2s ease;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .analytics-sync-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 10px;
          padding: 0 10px;
          height: 38px;
          min-height: 38px;
          font-size: 0.73rem;
          font-weight: 700;
          box-sizing: border-box;
        }
        .analytics-subtabs-row {
          display: flex;
          align-items: center;
          gap: 4px;
          border-bottom: 1px solid #E2E8F0;
          margin-bottom: 2px;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .analytics-subtabs-row::-webkit-scrollbar {
          display: none;
        }
        .analytics-subtab-btn {
          background: none;
          border: none;
          padding: 9px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #64748B;
          cursor: pointer;
          position: relative;
          white-space: nowrap;
          flex-shrink: 0;
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
          bottom: 0;
          left: 8px;
          right: 8px;
          height: 2.5px;
          background: #EA580C;
          border-radius: 2px 2px 0 0;
        }
        .analytics-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        .analytics-kpi-card {
          min-width: 0;
        }
        .analytics-kpi-val {
          word-break: break-word;
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
        .analytics-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .analytics-heatmap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
          gap: 8px;
        }
        .analytics-drilldown-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .analytics-pm-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }
        .analytics-chart-stage {
          height: 195px;
        }
        .analytics-desktop-table {
          display: block;
          overflow-x: auto;
          width: 100%;
        }
        .analytics-mobile-list {
          display: none;
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
          min-width: 0;
          box-sizing: border-box;
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
            padding: 16px;
            gap: 14px;
          }
          .analytics-row-1 {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }

        /* Small Tablets & Large Mobiles (<= 768px) */
        @media (max-width: 768px) {
          .analytics-container {
            padding: 4px 2px;
            gap: 12px;
          }
          .analytics-header-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .analytics-header-controls {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            width: 100% !important;
            gap: 8px !important;
            align-items: stretch !important;
          }
          .analytics-period-box,
          .analytics-refresh-pill,
          .analytics-export-btn,
          .analytics-sync-badge {
            height: 40px !important;
            min-height: 40px !important;
          }
          .analytics-period-select {
            font-size: 0.85rem !important;
            min-height: 0 !important;
            height: 100% !important;
          }
          .analytics-sync-badge,
          .analytics-export-btn {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
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
          .analytics-telemetry-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }

        /* Mobile Screens (<= 640px) */
        @media (max-width: 640px) {
          .analytics-header-title {
            font-size: 1.38rem !important;
          }
          .analytics-header-subtitle {
            font-size: 0.78rem !important;
          }
          .analytics-chart-stage {
            height: 155px !important;
          }
          .analytics-desktop-table {
            display: none !important;
          }
          .analytics-mobile-list {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .analytics-drilldown-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .analytics-drilldown-kpi-grid > div:nth-child(3) {
            grid-column: span 2 !important;
          }
          .analytics-pm-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .analytics-heatmap-grid {
            grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)) !important;
            gap: 6px !important;
          }
        }

        /* Mobile Screens (<480px) */
        @media (max-width: 480px) {
          .analytics-container {
            padding: 2px 0;
            gap: 10px;
          }
          .analytics-subtab-btn {
            padding: 8px 11px !important;
            font-size: 0.78rem !important;
          }
          .analytics-card {
            padding: 14px !important;
            border-radius: 14px !important;
          }
          .analytics-kpi-card {
            padding: 12px 11px !important;
          }
          .analytics-kpi-title {
            font-size: 0.70rem !important;
          }
          .analytics-kpi-val {
            font-size: clamp(1.06rem, 4.4vw, 1.24rem) !important;
          }
          .analytics-kpi-icon {
            width: 26px !important;
            height: 26px !important;
          }
          .analytics-payment-layout {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
        }

        /* Ultra Small Mobile (<330px) */
        @media (max-width: 330px) {
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
        <div style={{ minWidth: 0 }}>
          <h1 className="analytics-header-title">
            Analytics
          </h1>
          <p className="analytics-header-subtitle">
            Track your business performance and insights
          </p>
        </div>

        {/* Header Right Controls */}
        <div className="analytics-header-controls" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          {/* Date Range Selector Pill */}
          <div className="analytics-header-control-item analytics-period-box">
            <Calendar size={14} color="#64748B" style={{ marginRight: '8px', flexShrink: 0 }} />
            <select
              className="analytics-period-select"
              value={requestedPeriod}
              onChange={handlePeriodChange}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="all">All Time</option>
              {Array.isArray(analyticsData?.available_months) && analyticsData.available_months.map(m => (
                <option key={m.key} value={`month:${m.key}`}>{m.label}</option>
              ))}
              {requestedPeriod.startsWith('month:') &&
                !(Array.isArray(analyticsData?.available_months) && analyticsData.available_months.some(m => `month:${m.key}` === requestedPeriod)) && (
                  <option value={requestedPeriod}>{requestedDateRangeLabel}</option>
                )}
            </select>
            <ChevronDown size={13} color="#94A3B8" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
          </div>

          {isPeriodSyncing && (
            <div className="analytics-sync-badge" style={{
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              color: '#C2410C'
            }}>
              <span>Updating to {requestedDateRangeLabel}…</span>
            </div>
          )}

          {isPeriodSyncError && (
            <div
              className="analytics-sync-badge"
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                gap: '8px'
              }}
              title={syncError || 'Analytics sync failed'}
            >
              <span>Sync failed ({requestedDateRangeLabel})</span>
              {typeof onRetrySync === 'function' && (
                <button
                  type="button"
                  onClick={onRetrySync}
                  style={{
                    border: '1px solid #FCA5A5',
                    background: '#FFFFFF',
                    color: '#B91C1C',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Auto-Refresh Live Pill */}
          <div className="analytics-header-control-item analytics-refresh-pill" style={{
            color: syncStatus === 'error' ? '#B91C1C' : '#64748B'
          }}>
            <RefreshCw size={12} color={syncStatus === 'error' ? '#DC2626' : '#16A34A'} style={{ flexShrink: 0 }} />
            <span>
              {syncStatus === 'loading'
                ? 'Refreshing…'
                : (syncStatus === 'error' || !lastUpdatedTimeLabel)
                  ? (lastUpdatedTimeLabel ? `Last synced ${lastUpdatedTimeLabel}` : 'Sync unavailable')
                  : `Auto refresh in ${String(refreshCountdown).padStart(2, '0')}s`}
            </span>
          </div>

          {/* Export Report Button */}
          {analyticsExportEnabled && (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              className="analytics-header-control-item analytics-export-btn"
              style={{
                cursor: isExporting ? 'not-allowed' : 'pointer'
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
                  <span className="analytics-kpi-title" style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Active {itemPlural} Sold</span>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Sales Trend ({activeDateRangeLabel})
                    </h3>
                    <Info size={13} color="#94A3B8" style={{ flexShrink: 0 }} />
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
                      {rawChartData.length} {payloadPeriod === 'all' ? 'Months' : 'Days'} Tracked
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic SVG Area Line Chart with Crisp HTML Axes */}
              <div style={{ width: '100%', marginTop: '4px' }}>
                {renderSalesChart('salesGradient', true)}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, width: '100%', minWidth: 0 }}>
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

            {/* 3. Top Items (By Quantity) */}
            <div className="analytics-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Top {itemPlural} (By Quantity)
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
                    No {itemSingular.toLowerCase()} sales recorded yet.
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
                  <span>See all {itemPlural.toLowerCase()}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================
              ROW 2.5: QR SCAN TELEMETRY & TRAFFIC PATTERNS
             ======================================================== */}
          <div className="analytics-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#FAF5FF',
                  color: '#7E22CE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem'
                }}>
                  📲
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    QR Scan Telemetry &amp; Traffic Patterns
                  </h3>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                    Real-time QR menu scans, hourly visitor flow &amp; top active {spacePlural.toLowerCase()}
                  </span>
                </div>
              </div>

              {/* Status pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                  <span>{todayScans} Scanned Today</span>
                </div>
                {yesterdayScans > 0 && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                    {yesterdayScans} Yesterday
                  </div>
                )}
                {peakScanHour && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#C2410C', fontWeight: 700 }}>
                    🔥 Peak: {peakScanHour}
                  </div>
                )}
                <div style={{ background: '#FAF5FF', border: '1px solid #F3E8FF', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#7E22CE', fontWeight: 700 }}>
                  🎯 {analyticsData?.scan_conversion_rate_today ?? 0}% Scan-to-Order
                </div>
                {analyticsData?.standee_health ? (
                  <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#1D4ED8', fontWeight: 700 }}>
                    🛡️ {analyticsData.standee_health.health_score ?? 0}% Standee Health
                  </div>
                ) : analyticsData?.heatmap_unavailable ? (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', color: '#B91C1C', fontWeight: 700 }}>
                    🛡️ Standee Health: Unavailable
                  </div>
                ) : null}
              </div>
            </div>

            {/* Sub-grid: 24h Hourly Curve + Top Locations */}
            <div className="analytics-telemetry-grid">
              {/* Hourly Activity Bar Chart */}
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                    Today's Hourly Scan Curve (IST)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                    00:00 - 23:59
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100px', paddingTop: '10px', width: '100%', minWidth: 0 }}>
                  {hourlyScansToday.map((slot) => {
                    const maxVal = Math.max(...hourlyScansToday.map(s => s.count), 1);
                    const barHeight = slot.count > 0 ? Math.max(12, Math.round((slot.count / maxVal) * 80)) : 4;
                    const isPeak = slot.count === maxVal && maxVal > 0;
                    return (
                      <div
                        key={slot.hour}
                        title={`${slot.label}: ${slot.count} scans`}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${barHeight}px`,
                            background: isPeak ? '#7E22CE' : slot.count > 0 ? '#A855F7' : '#E2E8F0',
                            borderRadius: '3px 3px 0 0',
                            transition: 'all 0.2s'
                          }}
                        />
                        {slot.hour % 6 === 0 && (
                          <span style={{ fontSize: '0.56rem', color: '#94A3B8', fontWeight: 600 }}>
                            {slot.hour === 0 ? '12A' : slot.hour === 6 ? '6A' : slot.hour === 12 ? '12P' : '6P'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Scanned Locations Breakdown */}
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                    Top Scanned {spacePlural} Today
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
                    {topTablesScannedToday.length} Active Today
                  </span>
                </div>

                {topTablesScannedToday.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {topTablesScannedToday.slice(0, 5).map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '6px',
                          background: '#FFFFFF',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #F1F5F9',
                          minWidth: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
                            {entry.space_type === 'room' ? '🏨' : entry.space_type === 'cinema_seat' ? '🎬' : entry.space_type === 'counter' ? '⚡' : entry.space_type === 'cabin' ? '🛋️' : entry.space_type === 'vip' ? '👑' : '🍽️'}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.label || (entry.table ? `${entry.table}` : 'Direct Link')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#7E22CE' }}>
                            {entry.count} scans
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#CBD5E1' }}>•</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>
                            {entry.orders_today ?? 0} orders ({entry.conversion_rate ?? 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.74rem', margin: 'auto' }}>
                    No physical {spacePlural.toLowerCase()} scanned yet today.
                  </div>
                )}
              </div>
            </div>

            {/* Visual Space Heatmap Grid (Suggestion 2) */}
            {Array.isArray(analyticsData?.space_heatmap) && analyticsData.space_heatmap.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B' }}>
                      Physical {spacePlural} Scan Heatmap &amp; Standee Health
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                      ({analyticsData.standee_health?.active_spaces ?? 0} active, {analyticsData.standee_health?.dormant_spaces ?? 0} dormant)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.68rem', color: '#64748B' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7E22CE' }} /> Hot (5+)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A' }} /> Active (1-4)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#CBD5E1' }} /> 0 Scans
                    </span>
                  </div>
                </div>

                <div className="analytics-heatmap-grid">
                  {analyticsData.space_heatmap.map((space) => {
                    const isHot = space.status === 'hot';
                    const isActive = space.status === 'active';
                    return (
                      <div
                        key={space.space_number}
                        title={`${space.label}: ${space.scans_today} scans, ${space.orders_today} orders (${space.conversion_rate}% conv)`}
                        style={{
                          background: isHot ? '#FAF5FF' : isActive ? '#F0FDF4' : '#F8FAFC',
                          border: isHot ? '1.5px solid #D8B4FE' : isActive ? '1.5px solid #86EFAC' : '1px dashed #CBD5E1',
                          borderRadius: '8px',
                          padding: '6px 8px',
                          textAlign: 'center',
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: isHot ? '#6B21A8' : isActive ? '#15803D' : '#64748B' }}>
                          {space.space_number}
                        </div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isHot ? '#7E22CE' : isActive ? '#16A34A' : '#94A3B8' }}>
                          {space.scans_today > 0 ? `${space.scans_today} scans` : '0 scans'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

            {/* Desktop Table */}
            <div className="analytics-desktop-table">
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
                          {(() => {
                            const st = String(order.status || '').toLowerCase();
                            const isDone = st === 'completed' || st === 'delivered' || st === 'served';
                            const isInProgress = st === 'accepted' || st === 'kitchen' || st === 'preparing' || st === 'ready';
                            return (
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isDone ? '#DCFCE7' : isInProgress ? '#EFF6FF' : '#FEF3C7',
                                color: isDone ? '#16A34A' : isInProgress ? '#1D4ED8' : '#D97706',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                textTransform: 'capitalize'
                              }}>
                                {order.status}
                              </span>
                            );
                          })()}
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

            {/* Mobile Stacked Cards (Zero horizontal table scrolling on phone) */}
            <div className="analytics-mobile-list">
              {recentOrdersList.length > 0 ? (
                recentOrdersList.map(order => {
                  const st = String(order.status || '').toLowerCase();
                  const isDone = st === 'completed' || st === 'delivered' || st === 'served';
                  const isInProgress = st === 'accepted' || st === 'kitchen' || st === 'preparing' || st === 'ready';
                  return (
                    <div
                      key={order.id}
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #F1F5F9',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <strong style={{ fontSize: '0.78rem', color: '#0F172A' }}>{order.orderNumber}</strong>
                          <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#475569', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '6px' }}>
                            {order.table}
                          </span>
                        </div>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: isDone ? '#DCFCE7' : isInProgress ? '#EFF6FF' : '#FEF3C7',
                          color: isDone ? '#16A34A' : isInProgress ? '#1D4ED8' : '#D97706',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          textTransform: 'capitalize',
                          flexShrink: 0
                        }}>
                          {order.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.72rem' }}>
                          <span style={{ color: '#475569', fontWeight: 600 }}>
                            {order.items} items • {order.payment}
                          </span>
                          <strong style={{ fontSize: '0.84rem', color: '#0F172A', flexShrink: 0 }}>
                            {currencySymbol}{order.amount.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.3 }}>
                          {order.dateTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
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
                </div>
              )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="analytics-drilldown-kpi-grid">
            <div className="analytics-card">
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Period Revenue</span>
              <div className="analytics-kpi-val" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{totalSales.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                • Active in {activeDateRangeLabel}
              </span>
            </div>

            <div className="analytics-card">
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Orders</span>
              <div className="analytics-kpi-val" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {totalOrders.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Completed &amp; Live Orders
              </span>
            </div>

            <div className="analytics-card">
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Average Order Value</span>
              <div className="analytics-kpi-val" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{aov.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#9333EA', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Per Customer Ticket
              </span>
            </div>
          </div>

          {/* Detailed Timeline */}
          <div className="analytics-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
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

            <div style={{ width: '100%', marginTop: '8px' }}>
              {renderSalesChart('salesGradientTab', false)}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. TAB: TOP ITEMS DRILLDOWN
         ======================================================== */}
      {activeTab === 'top_items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="analytics-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  {itemSingular} Sales &amp; Velocity Ranking
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Authoritative ranking of {itemPlural.toLowerCase()} sold in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div className="analytics-desktop-table">
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

            {/* Mobile Top Items Cards */}
            <div className="analytics-mobile-list">
              {topDishesList.length > 0 ? (
                topDishesList.map(item => (
                  <div
                    key={item.rank}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      background: '#F8FAFC',
                      border: '1px solid #F1F5F9',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      minWidth: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: item.rank === 1 ? '#FFF7ED' : item.rank === 2 ? '#FEFCE8' : '#F1F5F9',
                        color: item.rank === 1 ? '#EA580C' : item.rank === 2 ? '#CA8A04' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        flexShrink: 0
                      }}>
                        {item.rank}
                      </span>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden', background: '#FFFFFF', flexShrink: 0 }}>
                        <img
                          src={item.img}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </strong>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{item.qty} units sold</span>
                      </div>
                    </div>
                    <strong style={{ fontSize: '0.82rem', color: '#0F172A', flexShrink: 0 }}>
                      {currencySymbol}{item.sales.toLocaleString('en-IN')}
                    </strong>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
                  No items sold in {activeDateRangeLabel}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          6. TAB: CATEGORIES DRILLDOWN
         ======================================================== */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="analytics-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Complete Category Breakdown
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Authoritative revenue distribution across menu categories in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categoriesList.length > 0 ? (
                categoriesList.map((cat, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #F1F5F9', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.80rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                        <strong style={{ color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</strong>
                      </div>
                      <div style={{ flexShrink: 0 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="analytics-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Settlement &amp; Payment Mode Analysis
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Authoritative split across payment types in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div className="analytics-pm-grid">
              {paymentAnalytics.slices.map((item, idx) => (
                <div key={idx} style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #F1F5F9', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 700 }}>{item.name}</span>
                  </div>
                  <div className="analytics-kpi-val" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A' }}>
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
