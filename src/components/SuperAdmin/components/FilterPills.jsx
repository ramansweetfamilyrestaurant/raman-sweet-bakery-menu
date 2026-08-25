import React from 'react';

export default function FilterPills({ pills, activeId, onChange }) {
  return (
    <div className="sa-filter-pills-strip">
      {pills.map((p) => {
        const isActive = activeId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`sa-btn sa-btn-sm sa-filter-pill-btn ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              borderRadius: 'var(--sa-radius-full)',
              border: isActive ? '1px solid var(--sa-primary)' : '1px solid var(--sa-border)',
              boxShadow: isActive ? '0 2px 8px rgba(10, 35, 21, 0.15)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>{p.label}</span>
            {p.count !== undefined && (
              <span 
                style={{ 
                  opacity: isActive ? 1 : 0.75, 
                  background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.06)',
                  color: isActive ? '#FFF' : 'var(--sa-text-muted)',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  fontSize: '0.70rem',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '18px',
                  height: '18px',
                  lineHeight: 1
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
