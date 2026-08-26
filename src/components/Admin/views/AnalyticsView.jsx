import React, { useState } from 'react';
import { 
  BarChart2, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Award, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  Filter, 
  CreditCard, 
  ShoppingBag,
  Zap,
  ArrowUpRight
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
  const [activeFilter, setActiveFilter] = useState('all');
  const isExporting = exporting || exportingAll;

  const todayRevenue = analyticsData?.today_sales ?? analyticsData?.today_revenue ?? 0;
  const todayOrders = analyticsData?.today_orders ?? 0;
  const days7Revenue = analyticsData?.weekly_sales ?? analyticsData?.days_7_revenue ?? 0;
  const days30Revenue = analyticsData?.monthly_sales ?? analyticsData?.days_30_revenue ?? 0;
  const allTimeRevenue = analyticsData?.total_sales ?? analyticsData?.total_revenue ?? 0;
  const totalOrders = analyticsData?.total_orders ?? 0;
  const aov = analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(allTimeRevenue / totalOrders) : 0);
  const topDishes = analyticsData?.top_dishes || [];
  const dailyChart = analyticsData?.daily_chart || [];
  const availableMonths = (analyticsData?.available_months || []).filter(m => Number(m.year) >= 2020);
  const paymentMethods = analyticsData?.payment_methods || analyticsData?.period_payment_methods || { upi: { count: 0, amount: 0 }, cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 } };

  const totalPaymentAmt = (paymentMethods.upi?.amount || 0) + (paymentMethods.cash?.amount || 0) + (paymentMethods.card?.amount || 0);
  const upiPercent = totalPaymentAmt > 0 ? Math.round(((paymentMethods.upi?.amount || 0) / totalPaymentAmt) * 100) : 0;
  const cashPercent = totalPaymentAmt > 0 ? Math.round(((paymentMethods.cash?.amount || 0) / totalPaymentAmt) * 100) : 0;
  const cardPercent = totalPaymentAmt > 0 ? (100 - upiPercent - cashPercent) : 0;

  const maxDishQty = Math.max(...topDishes.map(d => Number(d.quantity ?? d.sales_count ?? 1)), 1);

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setActiveFilter(val);
    if (val.startsWith('month:')) {
      const parts = val.replace('month:', '').split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (onFilterPeriod) onFilterPeriod(val, year, month);
    } else {
      if (onFilterPeriod) onFilterPeriod(val, null, null);
    }
  };

  const handleExportClick = () => {
    if (isExporting) return;
    const exportFn = onExportReport || onDownloadAllCSV;
    if (exportFn) {
      if (activeFilter.startsWith('month:')) {
        const parts = activeFilter.replace('month:', '').split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        exportFn(activeFilter, year, month);
      } else {
        exportFn(activeFilter, null, null);
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '100px'
    }}>
      {/* ========================================================
          1. HEADER & PERIOD FILTER + EXPORT ACTION
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Sales Analytics & BI Reports
            </h2>
            <span style={{
              background: '#DCFCE7',
              color: '#16A34A',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '8px'
            }}>
              ● Real-Time
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Business performance metrics, sales trends, and payment breakdowns.
          </p>
        </div>

        {/* Controls: Date Period Selector + Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#F8FAFC',
            padding: '7px 12px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0'
          }}>
            <Calendar size={15} color="#16A34A" />
            <select
              value={activeFilter}
              onChange={handleFilterChange}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">📊 All-Time Lifetime Overview</option>
              <option value="today">🟢 Today's Realtime</option>
              <option value="7d">🔵 Last 7 Days (Week)</option>
              <option value="30d">🟣 Last 30 Days (Month)</option>
              <option value="6m">🗓️ Last 6 Months</option>
              {availableMonths.map(m => (
                <option key={m.key} value={`month:${m.key}`}>📅 Monthly: {m.label}</option>
              ))}
            </select>
          </div>

          {analyticsExportEnabled ? (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              style={{
                background: isExporting ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: isExporting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={15} color="#D4AF37" />
              <span>{isExporting ? 'Preparing Report...' : 'Export CSV'}</span>
            </button>
          ) : (
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#D4AF37',
              background: '#071F14',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(212, 175, 55, 0.3)'
            }}>
              🔒 CSV Export (Pro Plan)
            </span>
          )}
        </div>
      </div>

      {/* ========================================================
          2. KPI SUMMARY METRIC CARDS (4 EXECUTIVE BLOCKS)
         ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        {/* Total / Period Revenue */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Revenue</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {currencySymbol}{Number(allTimeRevenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 700, display: 'block', marginTop: '4px' }}>
            ↑ Verified Sales Revenue
          </span>
        </div>

        {/* Total Orders */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Total Completed Orders</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {totalOrders}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, display: 'block', marginTop: '4px' }}>
            {todayOrders} orders today
          </span>
        </div>

        {/* Average Order Value */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Average Order Value (AOV)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {currencySymbol}{Math.round(aov).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 700, display: 'block', marginTop: '4px' }}>
            Per transaction average
          </span>
        </div>

        {/* Today's Sales */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Today's Sales</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16A34A', letterSpacing: '-0.02em', marginTop: '2px' }}>
            {currencySymbol}{Number(todayRevenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 700, display: 'block', marginTop: '4px' }}>
            ● Active Business Day
          </span>
        </div>
      </div>

      {/* ========================================================
          3. MAIN INSIGHTS: TOP DISHES & PAYMENT BREAKDOWN
         ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {/* Top Selling Items */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
            Top Selling Dishes
          </h3>

          {topDishes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.80rem' }}>
              No item sales recorded for this period yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {topDishes.slice(0, 5).map((dish, i) => {
                const sold = Number(dish.quantity ?? dish.sales_count ?? 0);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      <img
                        src={getDishImageUrl(dish.image || dish.image_url)}
                        alt={dish.name || dish.dish_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.80rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.name || dish.dish_name}</span>
                        <span style={{ color: '#64748B', fontSize: '0.74rem' }}>{sold} orders</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((sold / maxDishQty) * 100)}%`, height: '100%', background: '#0D3823', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Mix Breakdown */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
            Payment Modes Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* UPI / Digital QR */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block' }}>UPI / Digital QR</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{paymentMethods.upi?.count || 0} transactions</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>{currencySymbol}{paymentMethods.upi?.amount || 0}</strong>
                <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 700 }}>{upiPercent}% share</span>
              </div>
            </div>

            {/* Cash at Counter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block' }}>Cash Payments</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{paymentMethods.cash?.count || 0} transactions</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>{currencySymbol}{paymentMethods.cash?.amount || 0}</strong>
                <span style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 700 }}>{cashPercent}% share</span>
              </div>
            </div>

            {/* Card / POS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block' }}>Card / POS</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{paymentMethods.card?.count || 0} transactions</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '0.90rem', color: '#0F172A', display: 'block' }}>{currencySymbol}{paymentMethods.card?.amount || 0}</strong>
                <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 700 }}>{cardPercent}% share</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
