import React from 'react';

export default function FilterPills({ pills, activeId, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
      {pills.map((p) => {
        const isActive = activeId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`sa-btn sa-btn-sm ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              borderRadius: 'var(--sa-radius-full)',
              border: isActive ? 'none' : '1px solid var(--sa-border)'
            }}
          >
            {p.label} {p.count !== undefined && <span style={{ opacity: 0.8, marginLeft: '4px' }}>({p.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
