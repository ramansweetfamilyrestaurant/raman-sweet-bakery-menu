import React from 'react';
import { Store, CheckCircle, DollarSign, ArrowRight } from 'lucide-react';
import StatCard from '../components/StatCard';

export default function OverviewView({ restaurants, pendingRegistrations = [], onSelectTenant, onNavigate }) {
  const totalTenants = restaurants.length;
  const activeCount = restaurants.filter(r => r.active !== false && r.active !== 0 && r.active !== '0').length;

  const estimatedRevenue = restaurants.reduce((sum, r) => {
    if (r.active !== false && r.subscription_type !== 'ADMIN_GRANTED' && r.mandate_status !== 'admin_granted') {
      return sum + (parseFloat(r.plan_price) || 999);
    }
    return sum;
  }, 0);

  const paymentFailures = restaurants.filter(r => r.subscription_status === 'payment_failed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Simple Greeting Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        borderRadius: 'var(--sa-radius-lg)',
        padding: '20px 24px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        border: '1px solid rgba(212, 175, 55, 0.3)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '0 0 4px 0' }}>
            Welcome back, Super Admin 👑
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#A7F3D0', margin: 0 }}>
            Your TouchQR SaaS platform overview.
          </p>
        </div>
        <button onClick={() => onNavigate('tenants')} className="sa-btn sa-btn-accent sa-btn-sm">
          Manage Restaurants →
        </button>
      </div>

      {/* 3 Clean Stat Cards */}
      <div className="sa-stats-grid">
        <StatCard label="TOTAL RESTAURANTS" value={totalTenants} subtitle="All clients" icon={Store} color="var(--sa-primary)" />
        <StatCard label="ACTIVE" value={activeCount} subtitle="Paying & active" icon={CheckCircle} color="var(--sa-success)" />
        <StatCard label="MONTHLY REVENUE" value={`₹${estimatedRevenue.toLocaleString()}`} subtitle="Recurring (MRR)" icon={DollarSign} color="var(--sa-accent)" />
      </div>

      {/* Simple Attention Section */}
      <div className="sa-table-container" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: '0 0 14px 0', color: 'var(--sa-text-main)' }}>
          Needs Attention
        </h3>

        {pendingRegistrations.length === 0 && paymentFailures.length === 0 ? (
          <div style={{ padding: '16px 0', color: 'var(--sa-success)', fontWeight: 700, fontSize: '0.9rem' }}>
            ✅ All good! No issues right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingRegistrations.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 'var(--sa-radius-md)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  🔔 {pendingRegistrations.length} pending registration(s)
                </span>
                <button onClick={() => onNavigate('tenants')} className="sa-btn sa-btn-secondary sa-btn-sm">
                  View →
                </button>
              </div>
            )}

            {paymentFailures.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 'var(--sa-radius-md)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  ⚠️ {paymentFailures.length} payment failure(s)
                </span>
                <button onClick={() => onNavigate('tenants')} className="sa-btn sa-btn-secondary sa-btn-sm">
                  View →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
