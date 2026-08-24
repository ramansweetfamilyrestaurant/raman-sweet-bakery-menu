import React from 'react';

export default function SectionHeader({ title, subtitle, icon: Icon, actions }) {
  return (
    <div className="sa-section-header">
      <div>
        <h2 className="sa-section-title">
          {Icon && <Icon size={20} color="var(--sa-primary)" />}
          {title}
        </h2>
        {subtitle && (
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
