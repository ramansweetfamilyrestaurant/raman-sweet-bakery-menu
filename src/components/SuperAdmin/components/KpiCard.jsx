import React from 'react';

export default function KpiCard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon, 
  color = '#15803D',
  iconBg = 'rgba(21, 128, 61, 0.12)',
  onClick, 
  badge,
  trend,
  trendType = 'positive', // 'positive', 'negative', 'warning', 'info', 'neutral'
  sparkline = false,
  sparklineColor = '#F59E0B'
}) {
  return (
    <div 
      className="sa-kpi-card" 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="sa-kpi-header">
        {Icon && (
          <div className="sa-kpi-icon-circle" style={{ background: iconBg, color }}>
            <Icon size={16} />
          </div>
        )}
        <div className="sa-kpi-value-box">
          <span className="sa-kpi-value">{value}</span>
        </div>
      </div>

      <div className="sa-kpi-body">
        <div className="sa-kpi-label">{label}</div>
        
        <div className="sa-kpi-footer">
          {subtitle && <span className="sa-kpi-subtitle">{subtitle}</span>}
          
          {trend && (
            <span className={`sa-kpi-trend sa-trend-${trendType}`}>
              {trend}
            </span>
          )}

          {badge && (
            <span className="sa-kpi-badge">
              {badge}
            </span>
          )}
        </div>
      </div>

      {sparkline && (
        <div className="sa-kpi-sparkline-wrap">
          <svg viewBox="0 0 100 24" className="sa-kpi-sparkline" preserveAspectRatio="none">
            <path
              d="M 0 18 Q 20 8, 40 14 T 80 6 T 100 12"
              fill="none"
              stroke={sparklineColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

