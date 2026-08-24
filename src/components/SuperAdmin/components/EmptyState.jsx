import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      background: 'var(--sa-surface)',
      borderRadius: 'var(--sa-radius-lg)',
      border: '1px dashed var(--sa-border-strong)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      {Icon && (
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--sa-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sa-text-muted)' }}>
          <Icon size={24} />
        </div>
      )}
      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>{title}</h3>
      {description && <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--sa-text-muted)', maxWidth: '400px' }}>{description}</p>}
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  );
}
