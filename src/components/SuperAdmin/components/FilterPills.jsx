import React from 'react';

export default function FilterPills({ pills, activeId, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
      {pills.map((p) => {
        const isActive = activeId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`sa-btn sa-btn-sm ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              borderRadius: 'var(--sa-radius-full)',
              border: isActive ? '1px solid var(--sa-primary)' : '1px solid var(--sa-border)',
              boxShadow: isActive ? '0 2px 8px rgba(10, 35, 21, 0.15)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {p.label}
            {p.count !== undefined && (
              <span 
                style={{ 
                  opacity: isActive ? 1 : 0.7, 
                  marginLeft: '6px',
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  fontSize: '0.70rem'
                }}
              >
                {p.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
