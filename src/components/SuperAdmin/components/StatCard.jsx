import React from 'react';

export default function StatCard({ label, value, subtitle, icon: Icon, color = 'var(--sa-primary)' }) {
  return (
    <div className="sa-stat-card" style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span className="sa-stat-label" style={{ minWidth: 0, overflowWrap: 'break-word' }}>{label}</span>
        {Icon && <Icon size={18} style={{ color, flexShrink: 0 }} />}
      </div>
      <div className="sa-stat-value">{value}</div>
      {subtitle && <div className="sa-stat-subtitle">{subtitle}</div>}
    </div>
  );
}
