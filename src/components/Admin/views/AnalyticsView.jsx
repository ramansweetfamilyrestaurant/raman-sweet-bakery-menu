import React, { useState } from 'react';
import {
  Download,
  Calendar,
  DollarSign,
  ShoppingBag,
  ShoppingCart,
  Users,
  SlidersHorizontal,
  ArrowUpRight,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { getDishImageUrl } from '../../../utils/imageHelper';

export default function AnalyticsView({
  analyticsData,
  onExportReport,
  onDownloadAllCSV,
  onFilterPeriod,
  exporting = false,
  exportingAll = false,
  analyticsExportEnabled = true,
  currencySymbol = '₹'
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeframe, setTimeframe] = useState('daily');
  const [activeDateRange, setActiveDateRange] = useState('24 May - 31 May 2025');
  const [compareDateRange, setCompareDateRange] = useState('17 May - 23 May');
  const [chartHoverIndex, setChartHoverIndex] = useState(3); // 27 May by default

  const isExporting = exporting || exportingAll;

  // Dynamic / Fallback data resolution
  const totalSales = analyticsData?.total_sales ?? analyticsData?.total_revenue ?? 125000;
  const totalOrders = analyticsData?.total_orders ?? 320;
  const aov = analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(totalSales / totalOrders) : 390);
  const repeatCustomersPercent = analyticsData?.repeat_customers_percent ?? 98;

  const handleExportClick = () => {
    if (isExporting) return;
    const exportFn = onExportReport || onDownloadAllCSV;
    if (exportFn) exportFn('all', null, null);
  };

  // 7-day Sales Trend data points for the SVG Chart
  const salesTrend = [
    { label: '24 May', amount: 12000, valueFormatted: '₹12,000', x: 20, y: 155 },
    { label: '25 May', amount: 16500, valueFormatted: '₹16,500', x: 80, y: 130 },
    { label: '26 May', amount: 14000, valueFormatted: '₹14,000', x: 140, y: 145 },
    { label: '27 May', amount: 18750, valueFormatted: '₹18,750', x: 200, y: 110 },
    { label: '28 May', amount: 15200, valueFormatted: '₹15,200', x: 260, y: 138 },
    { label: '29 May', amount: 17800, valueFormatted: '₹17,800', x: 320, y: 120 },
    { label: '30 May', amount: 16000, valueFormatted: '₹16,000', x: 380, y: 132 },
    { label: '31 May', amount: 24750, valueFormatted: '₹24,750', x: 440, y: 75 }
  ];

  // Dynamic Top Dishes or master curated fallbacks
  const topDishesList = [
    { rank: 1, name: 'Paneer Paratha', qty: 120, sales: 18000, img: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=120&q=80' },
    { rank: 2, name: 'Chhole Bhature', qty: 98, sales: 14700, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=120&q=80' },
    { rank: 3, name: 'Veg Biryani', qty: 76, sales: 11400, img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=120&q=80' },
    { rank: 4, name: 'Masala Chai', qty: 150, sales: 7500, img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=120&q=80' },
    { rank: 5, name: 'Aloo Paratha', qty: 62, sales: 4960, img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=120&q=80' }
  ];

  // Categories Breakdown
  const categoriesList = [
    { name: 'Main Course', emoji: '🍲', percentage: 42, amount: 52500, color: '#EA580C' },
    { name: 'Beverages', emoji: '🧃', percentage: 20, amount: 25000, color: '#EA580C' },
    { name: 'Snacks', emoji: '🍟', percentage: 18, amount: 22000, color: '#EA580C' },
    { name: 'Desserts', emoji: '🧁', percentage: 12, amount: 15000, color: '#EA580C' },
    { name: 'Breads', emoji: '🫓', percentage: 8, amount: 10500, color: '#EA580C' }
  ];

  // Heatmap Days & Time Matrix (24h in 7 intervals)
  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapTimes = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM', '12 AM'];
  const heatmapData = [
    [0.05, 0.02, 0.20, 0.65, 0.35, 0.85, 0.40],
    [0.02, 0.01, 0.25, 0.70, 0.40, 0.90, 0.45],
    [0.04, 0.02, 0.22, 0.68, 0.38, 0.88, 0.50],
    [0.03, 0.01, 0.30, 0.75, 0.45, 0.92, 0.55],
    [0.06, 0.02, 0.35, 0.80, 0.55, 0.98, 0.75],
    [0.10, 0.05, 0.45, 0.95, 0.70, 1.00, 0.85],
    [0.08, 0.04, 0.40, 0.90, 0.65, 0.95, 0.70]
  ];

  const getHeatmapColor = (val) => {
    if (val < 0.1) return '#FFF9F5';
    if (val < 0.3) return '#FFEDE1';
    if (val < 0.5) return '#FED7AA';
    if (val < 0.75) return '#FB923C';
    if (val < 0.9) return '#F97316';
    return '#EA580C';
  };

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
          grid-template-columns: 1fr 1fr 1.15fr;
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
          .analytics-customize-btn {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. HEADER & GLOBAL CONTROLS (DESKTOP & MOBILE COMPATIBLE)
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
            Track performance and grow your restaurant business.
          </p>
        </div>

        {/* Right Controls: Date Filter + Compare + Export + Customize */}
        <div className="analytics-top-controls">
          {/* Main Date Picker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '7px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            fontSize: '0.76rem',
            fontWeight: 700,
            color: '#0F172A',
            cursor: 'pointer'
          }}>
            <Calendar size={14} color="#64748B" />
            <span>{activeDateRange}</span>
            <ChevronDown size={12} color="#94A3B8" />
          </div>

          {/* Compare Date Selector (Desktop) */}
          <div className="desktop-only-header" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '7px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            fontSize: '0.74rem',
            color: '#64748B',
            cursor: 'pointer'
          }}>
            <span>Compare: <strong style={{ color: '#0F172A' }}>{compareDateRange}</strong></span>
            <ChevronDown size={12} color="#94A3B8" />
          </div>

          {/* Export Button */}
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
          >
            <Download size={13} color="#64748B" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>

          {/* Customize Dashboard Button */}
          <button
            className="analytics-customize-btn"
            onClick={() => alert('Customize Dashboard Widgets')}
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
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            <Settings size={13} color="#64748B" />
            <span>Customize Dashboard</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          2. SECONDARY SUBTABS (Overview | Sales | Orders | Items | ...)
         ======================================================== */}
      <div className="analytics-subtabs-row">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'sales', label: 'Sales' },
          { id: 'orders', label: 'Orders' },
          { id: 'items', label: 'Items' },
          { id: 'customers', label: 'Customers' },
          { id: 'staff', label: 'Staff' },
          { id: 'reports', label: 'Reports' }
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
          3. TOP 4 EXECUTIVE KPI CARDS WITH LUXURY SPARKLINES
         ======================================================== */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Sales</span>
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
                fontSize: '0.90rem'
              }}>
                ₹
              </div>
            </div>

            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {currencySymbol}{Number(totalSales).toLocaleString('en-IN')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>↑ 12.5%</span>
              <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>vs 17 May – 23 May</span>
            </div>
          </div>

          {/* SVG Sparkline (Orange) */}
          <div style={{ width: '100%', height: '32px', marginTop: '8px' }}>
            <svg viewBox="0 0 100 24" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d="M 0,20 Q 20,22 35,14 T 65,10 T 85,16 T 100,6"
                fill="none"
                stroke="#F97316"
                strokeWidth="2"
                strokeLinecap="round"
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
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Orders</span>
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
              {totalOrders}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>↑ 8.7%</span>
              <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>vs 17 May – 23 May</span>
            </div>
          </div>

          {/* SVG Sparkline (Blue) */}
          <div style={{ width: '100%', height: '32px', marginTop: '8px' }}>
            <svg viewBox="0 0 100 24" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d="M 0,18 Q 15,22 30,12 T 60,16 T 80,8 T 100,10"
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
              {currencySymbol}{aov}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>↑ 6.3%</span>
              <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>vs 17 May – 23 May</span>
            </div>
          </div>

          {/* SVG Sparkline (Purple) */}
          <div style={{ width: '100%', height: '32px', marginTop: '8px' }}>
            <svg viewBox="0 0 100 24" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d="M 0,22 Q 25,10 45,18 T 75,8 T 100,12"
                fill="none"
                stroke="#C084FC"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Repeat Customers */}
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
              <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Repeat Customers</span>
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
                <Users size={16} />
              </div>
            </div>

            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {repeatCustomersPercent}%
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800 }}>↑ 15.2%</span>
              <span style={{ fontSize: '0.62rem', color: '#94A3B8' }}>vs 17 May – 23 May</span>
            </div>
          </div>

          {/* SVG Sparkline (Green) */}
          <div style={{ width: '100%', height: '32px', marginTop: '8px' }}>
            <svg viewBox="0 0 100 24" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d="M 0,20 Q 20,24 40,16 T 70,12 T 90,8 T 100,6"
                fill="none"
                stroke="#4ADE80"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. ANALYTICS ROW 1: SALES OVERVIEW + SALES BY PAYMENT METHOD
         ======================================================== */}
      <div className="analytics-row-1">
        
        {/* Left Large Card: Sales Overview (Area Line Chart) */}
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
                  Sales Overview
                </h3>
                <Info size={13} color="#94A3B8" />
              </div>

              {/* Period Dropdown (Daily / Weekly / Monthly) */}
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="daily">Daily ▾</option>
                <option value="weekly">Weekly ▾</option>
                <option value="monthly">Monthly ▾</option>
              </select>
            </div>

            {/* Main Total + Green Growth Indicator */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.40rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                {currencySymbol}{Number(totalSales).toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 800 }}>
                ↑ 12.5% <span style={{ color: '#94A3B8', fontWeight: 500 }}>vs previous 7 days</span>
              </span>
            </div>
          </div>

          {/* Elegant SVG Area Line Chart */}
          <div style={{ position: 'relative', width: '100%', height: '220px', marginTop: '10px' }}>
            {/* Hover Tooltip Box on Selected Node */}
            <div style={{
              position: 'absolute',
              left: `${(salesTrend[chartHoverIndex].x / 460) * 100}%`,
              top: `${(salesTrend[chartHoverIndex].y / 200) * 100 - 32}%`,
              transform: 'translate(-50%, -100%)',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '6px 10px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
              pointerEvents: 'none',
              zIndex: 10,
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block' }}>{salesTrend[chartHoverIndex].label} 2025</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EA580C' }} />
                <strong style={{ fontSize: '0.74rem', color: '#0F172A' }}>Sales {salesTrend[chartHoverIndex].valueFormatted}</strong>
              </div>
            </div>

            {/* SVG Chart with Y-Grid Lines */}
            <svg viewBox="0 0 460 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#EA580C" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
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

              {/* Area Gradient Fill */}
              <path
                d="M 20,155 C 50,140 65,135 80,130 C 110,120 125,150 140,145 C 170,135 185,115 200,110 C 230,100 245,142 260,138 C 290,130 305,122 320,120 C 350,118 365,135 380,132 C 410,125 425,85 440,75 L 440,195 L 20,195 Z"
                fill="url(#salesGradient)"
              />

              {/* Main Line */}
              <path
                d="M 20,155 C 50,140 65,135 80,130 C 110,120 125,150 140,145 C 170,135 185,115 200,110 C 230,100 245,142 260,138 C 290,130 305,122 320,120 C 350,118 365,135 380,132 C 410,125 425,85 440,75"
                fill="none"
                stroke="#EA580C"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Data points (dots) */}
              {salesTrend.map((pt, idx) => (
                <g key={idx} onClick={() => setChartHoverIndex(idx)} style={{ cursor: 'pointer' }}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={chartHoverIndex === idx ? "5" : "3.5"}
                    fill={chartHoverIndex === idx ? "#EA580C" : "#FFFFFF"}
                    stroke="#EA580C"
                    strokeWidth="2"
                  />
                </g>
              ))}
            </svg>

            {/* X-Axis Date Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 10px' }}>
              {salesTrend.map((pt, idx) => (
                <span key={idx} style={{ fontSize: '0.64rem', color: chartHoverIndex === idx ? '#0F172A' : '#94A3B8', fontWeight: chartHoverIndex === idx ? 800 : 500 }}>
                  {pt.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Large Card: Sales by Payment Method (Donut Chart) */}
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

              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                This Week ▾
              </span>
            </div>

            {/* Donut Chart & Legend Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '14px', flexWrap: 'wrap', margin: '14px 0' }}>
              {/* Donut SVG */}
              <div style={{ position: 'relative', width: '135px', height: '135px', flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  {/* Background Track */}
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F1F5F9" strokeWidth="4" />
                  {/* UPI (65%) */}
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#10B981" strokeWidth="4" strokeDasharray="57 31" strokeDashoffset="0" />
                  {/* Cash (20%) */}
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#3B82F6" strokeWidth="4" strokeDasharray="17.5 70.5" strokeDashoffset="-57" />
                  {/* Card (10%) */}
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#8B5CF6" strokeWidth="4" strokeDasharray="8.8 79.2" strokeDashoffset="-74.5" />
                  {/* Other (5%) */}
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#F59E0B" strokeWidth="4" strokeDasharray="4.4 83.6" strokeDashoffset="-83.3" />
                </svg>

                {/* Center Content */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  width: '80%'
                }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                    ₹1,25,000
                  </div>
                  <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>Total Sales</span>
                </div>
              </div>

              {/* Legend List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '130px' }}>
                {[
                  { name: 'UPI', percent: '65%', amount: '₹81,250', color: '#10B981' },
                  { name: 'Cash', percent: '20%', amount: '₹25,000', color: '#3B82F6' },
                  { name: 'Card', percent: '10%', amount: '₹12,500', color: '#8B5CF6' },
                  { name: 'Other', percent: '5%', amount: '₹6,250', color: '#F59E0B' }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                      <span style={{ color: '#0F172A', fontWeight: 700 }}>{item.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>{item.percent}</span>
                      <strong style={{ color: '#0F172A' }}>{item.amount}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          5. ANALYTICS ROW 2: TOP SELLING + CATEGORIES + PEAK HOURS
         ======================================================== */}
      <div className="analytics-row-2">
        
        {/* Card 1: Top Selling Items */}
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
              <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 700 }}>
                This Week ▾
              </span>
            </div>

            {/* Table / List Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ width: '14px' }}>#</span>
                <span>ITEM</span>
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                <span>QTY SOLD</span>
                <span style={{ width: '48px', textAlign: 'right' }}>SALES</span>
              </div>
            </div>

            {/* Ranked Dishes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {topDishesList.map(item => (
                <div key={item.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', width: '14px' }}>{item.rank}</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', background: '#F8FAFC', flexShrink: 0 }}>
                      <img src={item.img} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }} />
                    </div>
                    <strong style={{ fontSize: '0.76rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{item.qty}</span>
                    <strong style={{ fontSize: '0.76rem', color: '#0F172A', width: '52px', textAlign: 'right' }}>₹{item.sales.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', paddingTop: '12px', borderTop: '1px solid #F1F5F9', marginTop: '10px' }}>
            <button
              onClick={() => { if (onFilterPeriod) onFilterPeriod('dishes', null, null); }}
              style={{ background: 'none', border: 'none', color: '#0F172A', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View All Items</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Card 2: Sales by Category */}
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
              <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 700 }}>
                This Week ▾
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {categoriesList.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.84rem' }}>{cat.emoji}</span>
                      <strong style={{ color: '#0F172A' }}>{cat.name}</strong>
                    </div>
                    <div>
                      <strong style={{ color: '#0F172A' }}>₹{cat.amount.toLocaleString('en-IN')}</strong>
                      <span style={{ color: '#64748B', marginLeft: '4px', fontSize: '0.68rem' }}>({cat.percentage}%)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${cat.percentage * 2}%`, maxWidth: '100%', height: '100%', background: '#EA580C', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', paddingTop: '12px', borderTop: '1px solid #F1F5F9', marginTop: '10px' }}>
            <button
              onClick={() => { if (onFilterPeriod) onFilterPeriod('categories', null, null); }}
              style={{ background: 'none', border: 'none', color: '#0F172A', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View All Categories</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Card 3: Peak Hours Heatmap */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Peak Hours
                </h3>
                <span style={{ fontSize: '0.66rem', color: '#64748B' }}>Orders Count</span>
              </div>
              <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 700 }}>
                This Week ▾
              </span>
            </div>

            {/* Time Columns Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: '4px', fontSize: '0.56rem', color: '#94A3B8', fontWeight: 700, textAlign: 'center', marginBottom: '4px' }}>
              <span />
              {heatmapTimes.map((t, idx) => (
                <span key={idx} style={{ whiteSpace: 'nowrap' }}>{t}</span>
              ))}
            </div>

            {/* Heatmap Grid Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {heatmapDays.map((day, dIdx) => (
                <div key={day} style={{ display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>{day}</span>
                  {heatmapData[dIdx].map((val, hIdx) => (
                    <div
                      key={hIdx}
                      style={{
                        height: '16px',
                        borderRadius: '3px',
                        background: getHeatmapColor(val),
                        border: '1px solid rgba(0,0,0,0.02)'
                      }}
                      title={`${day} ${heatmapTimes[hIdx]}: Peak Intensity ${Math.round(val * 100)}%`}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Legend: Low to High */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '10px', fontSize: '0.60rem', color: '#64748B' }}>
              <span>Low</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[0.05, 0.25, 0.5, 0.75, 0.95].map((v, i) => (
                  <span key={i} style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: getHeatmapColor(v) }} />
                ))}
              </div>
              <span>High</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', paddingTop: '10px', borderTop: '1px solid #F1F5F9', marginTop: '8px' }}>
            <button
              onClick={() => alert('Detailed Heatmap Report')}
              style={{ background: 'none', border: 'none', color: '#0F172A', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View Full Report</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          6. BOTTOM WIDE LUXURY INSIGHT BANNER
         ======================================================== */}
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
              <span>Great Job!</span>
              <span>🎉</span>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#92400E', margin: '2px 0 0 0', fontWeight: 500 }}>
              Your sales are 12.5% higher than the previous 7 days. Keep up the excellent work!
            </p>
          </div>
        </div>

        <button
          onClick={handleExportClick}
          style={{
            padding: '9px 18px',
            borderRadius: '10px',
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #E2E8F0',
            fontSize: '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}
        >
          View Detailed Report
        </button>
      </div>
    </div>
  );
}
