import React from 'react';

export default function KpiCard({ label, value, subtitle, icon: Icon, color = 'var(--sa-primary)', onClick, badge }) {
  return (
    <div 
      className="sa-stat-card" 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sa-stat-label">{label}</span>
        {Icon && (
          <div className="sa-stat-icon-wrap">
            <Icon size={18} style={{ color }} />
          </div>
        )}
      </div>
      <div className="sa-stat-value">{value}</div>
      {(subtitle || badge) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
          {subtitle && <span className="sa-stat-subtitle">{subtitle}</span>}
          {badge && (
            <span style={{ 
              fontSize: '0.70rem', 
              fontWeight: 800, 
              background: 'rgba(212, 175, 55, 0.12)', 
              color: 'var(--sa-accent-hover, #B48F27)', 
              padding: '2px 8px', 
              borderRadius: 'var(--sa-radius-full)' 
            }}>
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
