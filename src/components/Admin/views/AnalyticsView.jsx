import React, { useState, useMemo } from 'react';
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
  Utensils
} from 'lucide-react';
import { getDishImageUrl } from '../../../utils/imageHelper';

/**
 * generateSparklinePath
 * Generates a smooth, normalized SVG path from an authoritative chronological numeric series.
 * Safely handles empty arrays, single points, flat/zero periods, and prevents NaN/Infinity coordinates.
 */
const generateSparklinePath = (dataSeries, width = 100, height = 24, paddingY = 2) => {
  if (!Array.isArray(dataSeries) || dataSeries.length === 0) {
    return `M 0,${height / 2} L ${width},${height / 2}`;
  }

  const validNumbers = dataSeries.map(v => 
    (v !== null && v !== undefined && !isNaN(Number(v)) && isFinite(Number(v)) ? Number(v) : 0)
  );

  if (validNumbers.length === 0) {
    return `M 0,${height / 2} L ${width},${height / 2}`;
  }

  const max = Math.max(...validNumbers);
  const min = Math.min(...validNumbers);

  // If all values are 0 or equal or only 1 data point, render clean flat baseline
  if (max === 0 || max === min || validNumbers.length === 1) {
    return `M 0,${height / 2} L ${width},${height / 2}`;
  }

  const usableHeight = height - paddingY * 2;
  const range = Math.max(max - min, 1);

  const points = validNumbers.map((val, idx) => {
    const x = validNumbers.length > 1
      ? (idx / (validNumbers.length - 1)) * width
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
  dishes = []
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [chartHoverIndex, setChartHoverIndex] = useState(null);

  const isExporting = exporting || exportingAll;

  // 1. Authoritative KPI Metrics (Strictly live, zero mock fallbacks)
  const totalSales = Number(analyticsData?.period_sales ?? analyticsData?.total_sales ?? 0);
  const totalOrders = Number(analyticsData?.period_orders ?? analyticsData?.total_orders ?? 0);
  const aov = Number(analyticsData?.period_aov ?? analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0));
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

  const chartPoints = useMemo(() => {
    const chartWidth = 460;
    const chartHeight = 200;
    const paddingX = 25;
    const paddingTop = 25;
    const paddingBottom = 35;
    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    return rawChartData.map((d, idx) => {
      const x = rawChartData.length > 1
        ? paddingX + (idx / (rawChartData.length - 1)) * usableWidth
        : chartWidth / 2;
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
    return `${linePath} L ${lastX},190 L ${firstX},190 Z`;
  }, [linePath, chartPoints]);

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
    return generateSparklinePath(series, 100, 20, 3);
  }, [rawChartData]);

  const aovSparklinePath = useMemo(() => {
    const series = rawChartData.map(d => {
      const s = Number(d.sales || 0);
      const o = Number(d.orders || 0);
      return o > 0 && s > 0 ? Math.round(s / o) : 0;
    });
    return generateSparklinePath(series, 100, 20, 3);
  }, [rawChartData]);

  const activeDishesSparklinePath = useMemo(() => {
    // Historical distinct-dish breakdown per day is not retained; render honest baseline
    return 'M 0,10 L 100,10';
  }, []);

  // 3. Dynamic Top Dishes (Authoritative from backend)
  const topDishesList = useMemo(() => {
    const dishesRaw = Array.isArray(analyticsData?.top_dishes) ? analyticsData.top_dishes : [];
    return dishesRaw.slice(0, 5).map((td, idx) => {
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
  }, [analyticsData?.top_dishes, dishes]);

  // 4. Dynamic Category Breakdown (Direct from backend 100% complete dataset)
  const categoriesList = useMemo(() => {
    const raw = Array.isArray(analyticsData?.category_sales) ? analyticsData.category_sales : [];
    const colors = ['#EA580C', '#0284C7', '#16A34A', '#9333EA', '#D97706', '#E11D48'];
    const emojis = ['🍲', '🧃', '🍟', '🧁', '🫓', '🥗'];

    return raw.map((cat, idx) => ({
      name: cat.name,
      emoji: emojis[idx % emojis.length],
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
      { name: 'UPI / Online', amount: upiAmt, color: '#10B981', percent: totalAmt > 0 ? Math.round((upiAmt / totalAmt) * 100) : 0 },
      { name: 'Cash', amount: cashAmt, color: '#3B82F6', percent: totalAmt > 0 ? Math.round((cashAmt / totalAmt) * 100) : 0 },
      { name: 'Card', amount: cardAmt, color: '#8B5CF6', percent: totalAmt > 0 ? Math.round((cardAmt / totalAmt) * 100) : 0 },
      { name: 'Other', amount: otherAmt, color: '#F59E0B', percent: totalAmt > 0 ? Math.round((otherAmt / totalAmt) * 100) : 0 }
    ];

    // SVG stroke calculations for circumference = 87.96
    const circumference = 87.96;
    let accumulatedOffset = 0;
    const slices = list.map(item => {
      const strokeLen = (item.percent / 100) * circumference;
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '100px'
    }}>
      <style>{`
        .analytics-subtabs-row {
          display: flex;
          align-items: center;
          gap: 20px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 2px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .analytics-subtabs-row::-webkit-scrollbar { display: none; }
        .analytics-top-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .analytics-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .analytics-row-1 {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 16px;
        }
        .analytics-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 1100px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .analytics-row-1 {
            grid-template-columns: 1fr !important;
          }
          .analytics-row-2 {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .analytics-header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. HEADER & GLOBAL CONTROLS
         ======================================================== */}
      <div className="analytics-header-row" style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '2px 0'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.45rem',
            fontWeight: 900,
            color: '#0F172A',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            Analytics Overview
          </h1>
          <p style={{
            fontSize: '0.78rem',
            color: '#64748B',
            margin: '3px 0 0 0',
            fontWeight: 500
          }}>
            Authoritative performance metrics for your business.
          </p>
        </div>

        {/* Right Controls: Interactive Date Filter + Export */}
        <div className="analytics-top-controls">
          {/* Main Date Picker */}
          <div style={{ position: 'relative' }}>
            <select
              value={selectedPeriod}
              onChange={handlePeriodChange}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '7px 28px 7px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none'
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
            <ChevronDown size={12} color="#94A3B8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Export Button */}
          {analyticsExportEnabled && (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '7px 14px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#0F172A',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
              title="Export Sales Report"
            >
              <Download size={13} color="#64748B" />
              <span>{isExporting ? 'Exporting...' : 'Export Report'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. SECONDARY SUBTABS
         ======================================================== */}
      <div className="analytics-subtabs-row">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'sales', label: 'Sales' },
          { id: 'items', label: 'Top Items' },
          { id: 'categories', label: 'Categories' },
          { id: 'payments', label: 'Payment Modes' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2.5px solid #EA580C' : '2.5px solid transparent',
                padding: '8px 4px 10px 4px',
                fontSize: '0.80rem',
                fontWeight: isActive ? 800 : 600,
                color: isActive ? '#EA580C' : '#64748B',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================
          3. TAB CONTENT VIEWS (DYNAMIC CONDITIONAL RENDERING)
         ======================================================== */}

      {/* --------------------------------------------------------
          TAB A: OVERVIEW (EXECUTIVE DASHBOARD)
         -------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <>
          {/* Top 4 Executive KPI Cards */}
          <div className="analytics-kpi-grid">
            {/* Card 1: Total Sales */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Sales ({activeDateRangeLabel})</span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#FFF7ED',
                    color: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.90rem',
                    flexShrink: 0
                  }}>
                    {currencySymbol}
                  </div>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {currencySymbol}{totalSales.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '6px' }}>
                  {growthPercentage !== null ? (
                    growthPercentage > 0 ? (
                      <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>↑ {growthPercentage}%</span>
                    ) : growthPercentage < 0 ? (
                      <span style={{ fontSize: '0.70rem', color: '#DC2626', fontWeight: 800 }}>↓ {Math.abs(growthPercentage)}%</span>
                    ) : (
                      <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>• 0%</span>
                    )
                  ) : (
                    <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>Live</span>
                  )}
                  <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>
                    {growthPercentage !== null ? 'vs previous period' : activeDateRangeLabel}
                  </span>
                </div>
              </div>

              {/* Dynamic Live Sparkline (Orange with Area Glow) */}
              <div style={{ width: '100%', height: '28px', marginTop: 'auto' }}>
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="salesSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {salesSparklineAreaPath && (
                    <path
                      d={salesSparklineAreaPath}
                      fill="url(#salesSparklineGrad)"
                    />
                  )}
                  <path
                    d={salesSparklinePath}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 2: Total Orders */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Orders Count</span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#EFF6FF',
                    color: '#0284C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShoppingBag size={16} />
                  </div>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {totalOrders.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.70rem', color: '#0284C7', fontWeight: 800 }}>Orders</span>
                  <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>in {activeDateRangeLabel}</span>
                </div>
              </div>

              {/* Dynamic Live Sparkline (Blue) */}
              <div style={{ width: '100%', height: '24px', marginTop: '8px' }}>
                <svg viewBox="0 0 100 20" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <path
                    d={ordersSparklinePath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 3: Average Order Value */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Average Order Value</span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#FAF5FF',
                    color: '#9333EA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShoppingCart size={16} />
                  </div>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {currencySymbol}{aov.toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.70rem', color: '#9333EA', fontWeight: 800 }}>AOV</span>
                  <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>per customer order</span>
                </div>
              </div>

              {/* Dynamic Live / Truthful Sparkline (Purple) */}
              <div style={{ width: '100%', height: '24px', marginTop: '8px' }}>
                <svg viewBox="0 0 100 20" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <path
                    d={aovSparklinePath}
                    fill="none"
                    stroke="#C084FC"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 4: Top Selling Items Count */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Active Dishes Sold</span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#F0FDF4',
                    color: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Utensils size={16} />
                  </div>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {Number(analyticsData?.distinct_dishes_count ?? 0).toLocaleString('en-IN')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>{Number(analyticsData?.total_items_sold ?? 0).toLocaleString('en-IN')} items</span>
                  <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>ordered total</span>
                </div>
              </div>

              {/* Truthful Baseline Sparkline (Green) */}
              <div style={{ width: '100%', height: '24px', marginTop: '8px' }}>
                <svg viewBox="0 0 100 20" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <path
                    d={activeDishesSparklinePath}
                    fill="none"
                    stroke="#4ADE80"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Row 1: Sales Trend + Payment Method Donut */}
          <div className="analytics-row-1">
            {/* Sales Trend Chart */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Sales Trend ({activeDateRangeLabel})
                    </h3>
                    <Info size={13} color="#94A3B8" />
                  </div>

                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                    {rawChartData.length} data point{rawChartData.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.40rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                    {currencySymbol}{totalSales.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 800 }}>
                    • Live Data
                  </span>
                </div>
              </div>

              {/* Dynamic SVG Area Line Chart */}
              <div style={{ position: 'relative', width: '100%', height: '220px', marginTop: '10px' }}>
                {activeHoverPoint && (
                  <div style={{
                    position: 'absolute',
                    left: `${(activeHoverPoint.x / 460) * 100}%`,
                    top: `${(activeHoverPoint.y / 200) * 100 - 32}%`,
                    transform: 'translate(-50%, -100%)',
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
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EA580C' }} />
                      <strong style={{ fontSize: '0.74rem', color: '#0F172A' }}>
                        Sales {activeHoverPoint.valueFormatted}
                      </strong>
                    </div>
                  </div>
                )}

                <svg viewBox="0 0 460 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[40, 80, 120, 160].map((yVal, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      y1={yVal}
                      x2="460"
                      y2={yVal}
                      stroke="#F1F5F9"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  ))}

                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#salesGradient)"
                    />
                  )}

                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#EA580C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {chartPoints.map((pt, idx) => (
                    <g key={idx} onMouseEnter={() => setChartHoverIndex(idx)} onClick={() => setChartHoverIndex(idx)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={activeHoverPoint?.date === pt.date ? "5" : "3.5"}
                        fill={activeHoverPoint?.date === pt.date ? "#EA580C" : "#FFFFFF"}
                        stroke="#EA580C"
                        strokeWidth="2"
                      />
                    </g>
                  ))}
                </svg>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 10px' }}>
                  {chartPoints.map((pt, idx) => {
                    const shouldShow = chartPoints.length <= 7 || idx === 0 || idx === chartPoints.length - 1 || idx % Math.ceil(chartPoints.length / 6) === 0;
                    if (!shouldShow) return <span key={idx} />;
                    return (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.64rem',
                          color: activeHoverPoint?.date === pt.date ? '#0F172A' : '#94A3B8',
                          fontWeight: activeHoverPoint?.date === pt.date ? 800 : 500
                        }}
                      >
                        {pt.displayDate || pt.date}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Payment Method Donut */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Sales by Payment Method
                    </h3>
                    <Info size={13} color="#94A3B8" />
                  </div>

                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                    {activeDateRangeLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '14px', flexWrap: 'wrap', margin: '14px 0' }}>
                  <div style={{ position: 'relative', width: '135px', height: '135px', flexShrink: 0 }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4" />
                      {paymentAnalytics.slices.map((slice, idx) => {
                        if (slice.percent <= 0) return null;
                        return (
                          <circle
                            key={idx}
                            cx="18"
                            cy="18"
                            r="14"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="4"
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
                      width: '80%'
                    }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                        {currencySymbol}{paymentAnalytics.totalAmt.toLocaleString('en-IN')}
                      </div>
                      <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>Total Sales</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '130px' }}>
                    {paymentAnalytics.slices.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                          <span style={{ color: '#0F172A', fontWeight: 700 }}>{item.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#64748B', fontWeight: 600 }}>{item.percent}%</span>
                          <strong style={{ color: '#0F172A' }}>{currencySymbol}{item.amount.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Top Selling Items + Sales by Category */}
          <div className="analytics-row-2">
            {/* Top Selling Items */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Top Selling Items
                  </h3>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>
                    {activeDateRangeLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ width: '14px' }}>#</span>
                    <span>ITEM</span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <span>QTY SOLD</span>
                    <span style={{ width: '52px', textAlign: 'right' }}>SALES</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {topDishesList.length > 0 ? (
                    topDishesList.map(item => (
                      <div key={item.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', width: '14px' }}>{item.rank}</span>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', background: '#F8FAFC', flexShrink: 0 }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{item.qty}</span>
                          <strong style={{ fontSize: '0.76rem', color: '#0F172A', width: '52px', textAlign: 'right' }}>
                            {currencySymbol}{item.sales.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
                      No item sales recorded in this period yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sales by Category */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Sales by Category
                  </h3>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>
                    {activeDateRangeLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {categoriesList.length > 0 ? (
                    categoriesList.map((cat, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.84rem' }}>{cat.emoji}</span>
                            <strong style={{ color: '#0F172A' }}>{cat.name}</strong>
                          </div>
                          <div>
                            <strong style={{ color: '#0F172A' }}>{currencySymbol}{cat.amount.toLocaleString('en-IN')}</strong>
                            <span style={{ color: '#64748B', marginLeft: '4px', fontSize: '0.68rem' }}>({cat.percentage}%)</span>
                          </div>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${cat.percentage}%`, maxWidth: '100%', height: '100%', background: cat.color, borderRadius: '4px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.76rem' }}>
                      No category sales recorded in this period yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Wide Insight Banner */}
          <div style={{
            background: '#FFFDF7',
            borderRadius: '18px',
            border: '1px solid #FEF3C7',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0
              }}>
                📈
              </div>
              <div>
                <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#78350F', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Live Analytics Active</span>
                  <span>🎉</span>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#92400E', margin: '2px 0 0 0', fontWeight: 500 }}>
                  Tracking sales across {activeDateRangeLabel}. Showing authoritative orders &amp; settlement totals.
                </p>
              </div>
            </div>

            {analyticsExportEnabled && (
              <button
                onClick={handleExportClick}
                disabled={isExporting}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                {isExporting ? 'Exporting...' : 'Export Complete Report'}
              </button>
            )}
          </div>
        </>
      )}

      {/* --------------------------------------------------------
          TAB B: SALES (FOCUSED REVENUE & TREND VIEW)
         -------------------------------------------------------- */}
      {activeTab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Focused Sales KPI Trio */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Period Revenue</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{totalSales.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                • Active in {activeDateRangeLabel}
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {totalOrders.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Completed &amp; Live Orders
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Average Order Value</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{aov.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#9333EA', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Per Customer Ticket
              </span>
            </div>
          </div>

          {/* Full Width Sales Trend Area Chart */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
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

            {/* SVG Chart */}
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

                {[40, 80, 120, 160].map((yVal, idx) => (
                  <line key={idx} x1="0" y1={yVal} x2="460" y2={yVal} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                ))}

                {areaPath && <path d={areaPath} fill="url(#salesGradientTab)" />}
                {linePath && <path d={linePath} fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" />}

                {chartPoints.map((pt, idx) => (
                  <g key={idx} onMouseEnter={() => setChartHoverIndex(idx)} onClick={() => setChartHoverIndex(idx)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={activeHoverPoint?.date === pt.date ? "5.5" : "3.5"}
                      fill={activeHoverPoint?.date === pt.date ? "#EA580C" : "#FFFFFF"}
                      stroke="#EA580C"
                      strokeWidth="2"
                    />
                  </g>
                ))}
              </svg>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 10px' }}>
                {chartPoints.map((pt, idx) => {
                  const shouldShow = chartPoints.length <= 8 || idx === 0 || idx === chartPoints.length - 1 || idx % Math.ceil(chartPoints.length / 7) === 0;
                  if (!shouldShow) return <span key={idx} />;
                  return (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.66rem',
                        color: activeHoverPoint?.date === pt.date ? '#0F172A' : '#94A3B8',
                        fontWeight: activeHoverPoint?.date === pt.date ? 800 : 500
                      }}
                    >
                      {pt.displayDate || pt.date}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chronological Daily Sales Table */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: '0 0 12px 0' }}>
              Daily Revenue Ledger
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rawChartData.slice().reverse().map((row, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: idx % 2 === 0 ? '#FAF8F5' : '#FFFFFF', borderRadius: '10px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                    {row.displayDate || row.date}
                  </span>
                  <strong style={{ fontSize: '0.84rem', fontWeight: 900, color: Number(row.sales || 0) > 0 ? '#064E3B' : '#94A3B8' }}>
                    {currencySymbol}{Number(row.sales || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
          TAB C: TOP ITEMS (DETAILED DISH RANKINGS)
         -------------------------------------------------------- */}
      {activeTab === 'items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top Items Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Distinct Dishes Sold</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {Number(analyticsData?.distinct_dishes_count ?? 0)}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                In active menu catalog
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Items Ordered</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {Number(analyticsData?.total_items_sold ?? 0).toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Gross quantity fulfilled
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>#1 Best Seller</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#064E3B', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {topDishesList[0]?.name || 'None'}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                {topDishesList[0] ? `${topDishesList[0].qty} sold • ${currencySymbol}${topDishesList[0].sales.toLocaleString('en-IN')}` : 'No sales recorded'}
              </span>
            </div>
          </div>

          {/* Full Width Top Selling Items Table */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Item Popularity &amp; Sales Rankings
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Best performing dishes ranked by customer demand in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topDishesList.length > 0 ? (
                topDishesList.map(item => {
                  const sharePct = totalSales > 0 ? Math.round((item.sales / totalSales) * 100) : 0;
                  return (
                    <div key={item.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF8F5', borderRadius: '12px', border: '1px solid #EAE5DF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: item.rank === 1 ? '#FEF3C7' : '#F1F5F9', color: item.rank === 1 ? '#D97706' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.80rem', flexShrink: 0 }}>
                          #{item.rank}
                        </div>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: '#FFFFFF', flexShrink: 0, border: '1px solid #E2E8F0' }}>
                          <img
                            src={item.img}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.86rem', color: '#0F172A', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </strong>
                          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                            {sharePct}% of total period revenue
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block' }}>QUANTITY</span>
                          <strong style={{ fontSize: '0.86rem', color: '#0F172A' }}>{item.qty} units</strong>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '70px' }}>
                          <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block' }}>REVENUE</span>
                          <strong style={{ fontSize: '0.92rem', color: '#064E3B', fontWeight: 900 }}>
                            {currencySymbol}{item.sales.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                  No item sales recorded in this period yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
          TAB D: CATEGORIES (COMPLETE CATEGORY DISTRIBUTION)
         -------------------------------------------------------- */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Categories Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Active Categories</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {categoriesList.length}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                With order sales in period
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Top Category Share</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#EA580C', marginTop: '4px' }}>
                {categoriesList[0] ? `${categoriesList[0].percentage}%` : '0%'}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                {categoriesList[0]?.name || 'None'}
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Category Revenue Total</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#064E3B', marginTop: '4px' }}>
                {currencySymbol}{categoriesList.reduce((sum, c) => sum + c.amount, 0).toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                100% complete menu dataset
              </span>
            </div>
          </div>

          {/* Full Width Category Breakdown */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Sales by Menu Category
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Aggregated from 100% of order line items in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {categoriesList.length > 0 ? (
                categoriesList.map((cat, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#FAF8F5', padding: '12px 16px', borderRadius: '12px', border: '1px solid #EAE5DF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1rem' }}>{cat.emoji}</span>
                        <strong style={{ color: '#0F172A', fontSize: '0.88rem' }}>{cat.name}</strong>
                      </div>
                      <div>
                        <strong style={{ color: '#064E3B', fontSize: '0.90rem' }}>{currencySymbol}{cat.amount.toLocaleString('en-IN')}</strong>
                        <span style={{ color: '#64748B', marginLeft: '6px', fontSize: '0.74rem', fontWeight: 700 }}>({cat.percentage}%)</span>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${cat.percentage}%`, maxWidth: '100%', height: '100%', background: cat.color, borderRadius: '6px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                  No category sales recorded in this period yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
          TAB E: PAYMENT MODES (FOCUSED PAYMENT BREAKDOWN)
         -------------------------------------------------------- */}
      {activeTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Payment Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Collected Sales</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: '4px' }}>
                {currencySymbol}{paymentAnalytics.totalAmt.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Across all payment modes
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>UPI &amp; Digital Share</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10B981', marginTop: '4px' }}>
                {paymentAnalytics.slices.find(s => s.name.includes('UPI'))?.percent || 0}%
              </div>
              <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Contactless &amp; QR Payments
              </span>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Cash Collections</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3B82F6', marginTop: '4px' }}>
                {currencySymbol}{(paymentAnalytics.slices.find(s => s.name === 'Cash')?.amount || 0).toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 800, display: 'block', marginTop: '4px' }}>
                Physical counter transactions
              </span>
            </div>
          </div>

          {/* Full Width Payment Donut & Detailed Breakdown */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Payment Method Distribution
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Settlement channels used by guests in {activeDateRangeLabel}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '30px', flexWrap: 'wrap', padding: '20px 0' }}>
              {/* Donut Visual */}
              <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4" />
                  {paymentAnalytics.slices.map((slice, idx) => {
                    if (slice.percent <= 0) return null;
                    return (
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="14"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="4"
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
                  width: '80%'
                }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                    {currencySymbol}{paymentAnalytics.totalAmt.toLocaleString('en-IN')}
                  </div>
                  <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 700 }}>Total Collected</span>
                </div>
              </div>

              {/* Detailed Payment Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', flex: 1 }}>
                {paymentAnalytics.slices.map((item, idx) => (
                  <div key={idx} style={{ background: '#FAF8F5', borderRadius: '14px', border: '1px solid #EAE5DF', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }} />
                        <strong style={{ color: '#0F172A', fontSize: '0.84rem' }}>{item.name}</strong>
                      </div>
                      <span style={{ background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.72rem', fontWeight: 800, color: '#475569' }}>
                        {item.percent}%
                      </span>
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                      {currencySymbol}{item.amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
