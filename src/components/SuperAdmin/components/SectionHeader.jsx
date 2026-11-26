import React from 'react';

export default function SectionHeader({ title, subtitle, icon: Icon, actions }) {
  return (
    <div className="sa-section-header">
      <div className="sa-section-title-group" style={{ minWidth: 0 }}>
        <h2 className="sa-section-title">
          {Icon && <Icon size={20} color="var(--sa-primary)" style={{ flexShrink: 0 }} />}
          {title}
        </h2>
        {subtitle && (
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600, display: 'block' }}>
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div className="sa-section-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
