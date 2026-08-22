import React, { useState } from 'react';
import { BarChart2, Download, TrendingUp, TrendingDown, Calendar, DollarSign, Award, Clock, Sparkles, ChevronRight, Filter, CreditCard, ShoppingBag } from 'lucide-react';

export default function AnalyticsView({
  analyticsData,
  onDownloadTodayCSV,
  onDownloadAllCSV,
  onFilterPeriod,
  exportingAll = false,
  analyticsExportEnabled = true,
  currencySymbol = '₹'
}) {
  const [activeFilter, setActiveFilter] = useState('all');

  const todayRevenue = analyticsData?.today_sales ?? analyticsData?.today_revenue ?? 0;
  const todayOrders = analyticsData?.today_orders ?? 0;
  const days7Revenue = analyticsData?.weekly_sales ?? analyticsData?.days_7_revenue ?? 0;
  const days30Revenue = analyticsData?.monthly_sales ?? analyticsData?.days_30_revenue ?? 0;
  const allTimeRevenue = analyticsData?.total_sales ?? analyticsData?.total_revenue ?? 0;
  const totalOrders = analyticsData?.total_orders ?? 0;
  const aov = analyticsData?.average_order_value ?? (totalOrders > 0 ? Math.round(allTimeRevenue / totalOrders) : 0);
  const growthPct = analyticsData?.growth_percentage ?? 0;
  const topDishes = analyticsData?.top_dishes || [];
  const dailyChart = analyticsData?.daily_chart || [];
  const availableMonths = analyticsData?.available_months || [];
  const paymentMethods = analyticsData?.payment_methods || { upi: { count: 0, amount: 0 }, cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 } };

  const totalPaymentAmt = (paymentMethods.upi?.amount || 0) + (paymentMethods.cash?.amount || 0) + (paymentMethods.card?.amount || 0);
  const upiPercent = totalPaymentAmt > 0 ? Math.round(((paymentMethods.upi?.amount || 0) / totalPaymentAmt) * 100) : 0;
  const cashPercent = totalPaymentAmt > 0 ? Math.round(((paymentMethods.cash?.amount || 0) / totalPaymentAmt) * 100) : 0;
  const cardPercent = totalPaymentAmt > 0 ? (100 - upiPercent - cashPercent) : 0;

  const maxDailySales = Math.max(...dailyChart.map(d => Number(d.sales) || 0), 1);
  const maxDishQty = Math.max(...topDishes.map(d => Number(d.quantity ?? d.sales_count ?? 1)), 1);

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setActiveFilter(val);
    if (val.startsWith('month:')) {
      const parts = val.replace('month:', '').split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (onFilterPeriod) onFilterPeriod(year, month);
    } else {
      if (onFilterPeriod) onFilterPeriod(null, null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '90px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* 🚀 Header, Filter Dropdown & Export Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#FFFFFF',
        padding: '16px 18px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ minWidth: '200px', flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Sales Analytics & Lifetime Reports
            </h2>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ● LIVE
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
            Real-time revenue metrics, average ticket size & CSV sales reports
          </span>
        </div>

        {/* Period Selector Dropdown & Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '6px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', flex: '1 1 auto', minWidth: '200px' }}>
            <Calendar size={16} color="#0284C7" />
            <select
              value={activeFilter}
              onChange={handleFilterChange}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none',
                width: '100%'
              }}
            >
              <option value="all">📊 All-Time Overview (Complete History)</option>
              <option value="today">🟢 Today's Realtime (Since Midnight)</option>
              <option value="week">🔵 Last 7 Days (Past Week)</option>
              <option value="month">🟣 Last 30 Days (Past Month)</option>
              {availableMonths.map(m => (
                <option key={m.key} value={`month:${m.key}`}>📅 Monthly: {m.label}</option>
              ))}
            </select>
          </div>

          {analyticsExportEnabled ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
              <button
                onClick={onDownloadTodayCSV}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  minHeight: '40px',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.2s ease',
                  flex: '1 1 auto'
                }}
              >
                <Download size={14} /> 📅 Daily (.csv)
              </button>
              <button
                onClick={onDownloadAllCSV}
                disabled={exportingAll}
                style={{
                  background: '#1E293B',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: exportingAll ? 'not-allowed' : 'pointer',
                  opacity: exportingAll ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  minHeight: '40px',
                  boxShadow: '0 2px 6px rgba(30, 41, 59, 0.2)',
                  transition: 'all 0.2s ease',
                  flex: '1 1 auto'
                }}
              >
                <Download size={14} /> {exportingAll ? 'Generating...' : '📊 All-Time (.csv)'}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '6px 12px', borderRadius: '10px' }}>
              🔒 CSV Export (Pro Feature)
            </span>
          )}
        </div>
      </div>

      {/* 💳 KPI Cards Grid (Compact 2-Columns on Mobile, 4-5 on Desktop) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px'
      }}>
        {/* Today */}
        <div style={{
          background: '#FFFFFF',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10B981' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em' }}>TODAY'S REVENUE</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '2px 7px', borderRadius: '8px' }}>
              {todayOrders} orders
            </span>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Number(todayRevenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', fontWeight: 500 }}>
            Since 12:00 AM Midnight
          </span>
        </div>

        {/* 7 Days */}
        <div style={{
          background: '#FFFFFF',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0284C7' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em' }}>7 DAYS REVENUE</span>
            <TrendingUp size={16} color="#0284C7" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Number(days7Revenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', fontWeight: 500 }}>
            Past 1 week performance
          </span>
        </div>

        {/* 30 Days + Growth % */}
        <div style={{
          background: '#FFFFFF',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366F1' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em' }}>30 DAYS REVENUE</span>
            {growthPct !== 0 && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: growthPct >= 0 ? '#DCFCE7' : '#FEE2E2',
                color: growthPct >= 0 ? '#15803D' : '#B91C1C',
                padding: '2px 6px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                {growthPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`}
              </span>
            )}
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Number(days30Revenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', fontWeight: 500 }}>
            Monthly sales volume
          </span>
        </div>

        {/* Average Order Value (AOV) */}
        <div style={{
          background: '#FFFFFF',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#EC4899' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em' }}>AVG TICKET (AOV)</span>
            <ShoppingBag size={16} color="#EC4899" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#BE185D', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Number(aov).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', fontWeight: 500 }}>
            Average bill per table
          </span>
        </div>

        {/* All-Time Sales */}
        <div style={{
          background: '#FFFFFF',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#D97706' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em' }}>ALL-TIME SALES</span>
            <Award size={16} color="#D97706" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#B45309', letterSpacing: '-0.02em' }}>
            {currencySymbol}{Number(allTimeRevenue).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '6px', fontWeight: 500 }}>
            {totalOrders > 0 ? `${totalOrders} total orders placed` : 'Lifetime restaurant gross'}
          </span>
        </div>
      </div>

      {/* 💳 Payment Methods Split & Collection Breakdown */}
      {totalPaymentAmt > 0 && (
        <div style={{
          background: '#FFFFFF',
          padding: '18px 22px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="#6366F1" />
              <h3 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Payment Method Collection Split
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem', fontWeight: 700 }}>
              <span style={{ color: '#059669' }}>● UPI / Online ({upiPercent}%)</span>
              <span style={{ color: '#D97706' }}>● Cash ({cashPercent}%)</span>
              {cardPercent > 0 && <span style={{ color: '#2563EB' }}>● Card ({cardPercent}%)</span>}
            </div>
          </div>

          <div style={{ width: '100%', height: '10px', background: '#F1F5F9', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${upiPercent}%`, height: '100%', background: '#10B981', transition: 'all 0.3s ease' }} title={`UPI: ${currencySymbol}${paymentMethods.upi?.amount || 0}`} />
            <div style={{ width: `${cashPercent}%`, height: '100%', background: '#F59E0B', transition: 'all 0.3s ease' }} title={`Cash: ${currencySymbol}${paymentMethods.cash?.amount || 0}`} />
            <div style={{ width: `${cardPercent}%`, height: '100%', background: '#3B82F6', transition: 'all 0.3s ease' }} title={`Card: ${currencySymbol}${paymentMethods.card?.amount || 0}`} />
          </div>
        </div>
      )}

      {/* 📊 Visual Sales Trend Chart */}
      {dailyChart.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          padding: '20px 22px',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} color="#0284C7" /> {!activeFilter.startsWith('month:') ? 'Sales Trend' : 'Daily Sales Trend (Selected Month)'}
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Daily Gross (INR)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '6px', paddingTop: '10px', overflowX: 'auto' }}>
            {dailyChart.map((item, idx) => {
              const heightPercent = Math.max(Math.round((Number(item.sales || 0) / maxDailySales) * 100), 8);
              const isToday = item.date === new Date().toISOString().split('T')[0];
              return (
                <div key={idx} style={{ flex: '1 0 28px', minWidth: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: item.sales > 0 ? '#0F172A' : '#CBD5E1' }}>
                    {item.sales > 0 ? `${currencySymbol}${item.sales}` : '0'}
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: '36px',
                    height: `${heightPercent}%`,
                    background: isToday
                      ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
                      : item.sales > 0
                        ? 'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)'
                        : '#F1F5F9',
                    borderRadius: '6px 6px 3px 3px',
                    transition: 'all 0.3s ease'
                  }} />
                  <span style={{ fontSize: '0.68rem', color: isToday ? '#059669' : '#64748B', fontWeight: isToday ? 900 : 600, whiteSpace: 'nowrap' }}>
                    {isToday ? 'Today' : item.displayDate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏆 Top Selling Dishes Leaderboard (True Lifetime Merged) */}
      <div style={{
        background: '#FFFFFF',
        padding: '22px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#D97706" /> All-Time Best Selling Dishes
          </h3>
          <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Lifetime Volume Ranking</span>
        </div>

        {topDishes.length === 0 ? (
          <p style={{ fontSize: '0.84rem', color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>No sales data recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topDishes.slice(0, 6).map((dish, idx) => {
              const qty = Number(dish.quantity ?? dish.sales_count ?? 0);
              const percent = Math.round((qty / maxDishQty) * 100);
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid #F1F5F9',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1rem' }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏅'}
                      </span>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800 }}>
                          {dish.name}
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: '#64748B', marginLeft: '8px', fontWeight: 600 }}>
                          ({qty} {qty === 1 ? 'item' : 'items'} sold)
                        </span>
                      </div>
                    </div>
                    {dish.revenue > 0 && (
                      <strong style={{ fontSize: '0.92rem', color: '#059669', fontWeight: 900 }}>
                        {currencySymbol}{Number(dish.revenue || 0).toLocaleString('en-IN')}
                      </strong>
                    )}
                  </div>

                  {/* Volume bar */}
                  <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${percent}%`,
                      height: '100%',
                      background: idx === 0 ? '#F59E0B' : idx === 1 ? '#0284C7' : '#10B981',
                      borderRadius: '4px'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
