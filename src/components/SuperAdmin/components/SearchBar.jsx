import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, onClear, placeholder = 'Search...', width = '100%' }) {
  return (
    <div style={{ position: 'relative', width }}>
      <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="sa-input"
        style={{ paddingLeft: '34px', paddingRight: value ? '32px' : '12px' }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
