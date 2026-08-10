import React from 'react';

export default function StatCard({ label, value, subtitle, icon: Icon, color = 'var(--sa-primary)' }) {
  return (
    <div className="sa-stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sa-stat-label">{label}</span>
        {Icon && <Icon size={18} style={{ color }} />}
      </div>
      <div className="sa-stat-value">{value}</div>
      {subtitle && <div className="sa-stat-subtitle">{subtitle}</div>}
    </div>
  );
}
