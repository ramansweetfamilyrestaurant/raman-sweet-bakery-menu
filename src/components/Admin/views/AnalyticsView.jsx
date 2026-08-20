import React from 'react';
import { BarChart2, Download, TrendingUp, DollarSign, Award } from 'lucide-react';

export default function AnalyticsView({ analyticsData, onDownloadCSV, analyticsExportEnabled = true, currencySymbol = '₹' }) {
  const todayRevenue = analyticsData?.today_sales ?? analyticsData?.today_revenue ?? 0;
  const days7Revenue = analyticsData?.weekly_sales ?? analyticsData?.days_7_revenue ?? 0;
  const days30Revenue = analyticsData?.monthly_sales ?? analyticsData?.days_30_revenue ?? 0;
  const allTimeRevenue = analyticsData?.total_sales ?? analyticsData?.total_revenue ?? 0;
  const topDishes = analyticsData?.top_dishes || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            Sales Analytics & Reports
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Real-time revenue metrics & CSV sales export
          </span>
        </div>

        {analyticsExportEnabled ? (
          <button onClick={onDownloadCSV} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ fontWeight: 800 }}>
            <Download size={14} /> Export CSV Sales Report
          </button>
        ) : (
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
            🔒 CSV Export (Pro Feature)
          </span>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div className="adm-card" style={{ padding: '14px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase' }}>TODAY REVENUE</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--adm-success)', margin: '2px 0' }}>{currencySymbol}{todayRevenue.toLocaleString()}</div>
        </div>

        <div className="adm-card" style={{ padding: '14px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase' }}>7 DAYS REVENUE</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '2px 0' }}>{currencySymbol}{days7Revenue.toLocaleString()}</div>
        </div>

        <div className="adm-card" style={{ padding: '14px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase' }}>30 DAYS REVENUE</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '2px 0' }}>{currencySymbol}{days30Revenue.toLocaleString()}</div>
        </div>

        <div className="adm-card" style={{ padding: '14px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase' }}>ALL-TIME SALES</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--adm-accent)', margin: '2px 0' }}>{currencySymbol}{allTimeRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Top Selling Dishes List */}
      <div className="adm-card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={18} color="var(--adm-accent)" /> Top 5 Best Selling Dishes
        </h3>

        {topDishes.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', margin: 0 }}>No sales data recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topDishes.slice(0, 5).map((dish, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', fontSize: '0.84rem' }}>
                <div>
                  <strong>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏅'} {dish.name}</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)', marginLeft: '8px' }}>({dish.quantity ?? dish.sales_count ?? dish.count ?? 0} sold)</span>
                </div>
                <strong style={{ color: 'var(--adm-success)' }}>{currencySymbol}{dish.revenue || 0}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
