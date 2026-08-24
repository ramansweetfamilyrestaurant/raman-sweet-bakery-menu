import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, onClear, placeholder = 'Search...', width = '100%' }) {
  return (
    <div style={{ position: 'relative', width }}>
      <Search size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="sa-input"
        style={{ 
          paddingLeft: '38px', 
          paddingRight: value ? '34px' : '14px',
          height: '40px',
          borderRadius: 'var(--sa-radius-full)',
          background: 'var(--sa-surface-subtle)',
          border: '1px solid var(--sa-border)',
          fontSize: '0.82rem',
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{ 
            position: 'absolute', 
            right: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            background: 'rgba(0,0,0,0.06)', 
            border: 'none', 
            cursor: 'pointer', 
            color: 'var(--sa-text-muted)',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0
          }}
          title="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
