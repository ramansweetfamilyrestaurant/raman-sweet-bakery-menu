import React from 'react';
import { Search, X, Sparkles } from 'lucide-react';

export default function SearchBar({ value, onChange, onClear, onQuickFilter }) {
  const filters = [
    { label: 'All', value: '' },
    { label: '⭐ Must Try', value: 'Must Try' },
    { label: '🥛 Desi Ghee', value: 'Ghee' },
    { label: '🍰 Cakes', value: 'Cake' },
    { label: '⚡ Under 100', value: '50' }
  ];

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '12px 14px 4px',
    }}>
      {/* Search Input Box */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        marginBottom: '8px'
      }}>
        <Search 
          size={17} 
          color="var(--text-muted)" 
          style={{
            position: 'absolute',
            left: '14px',
            pointerEvents: 'none'
          }}
        />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search sweets, thali, dosa, cakes, chai..."
          style={{
            width: '100%',
            padding: '10px 38px 10px 38px',
            fontSize: '0.88rem',
            fontWeight: 500,
            background: '#FFFFFF',
            color: 'var(--text-dark)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-sm)',
            outline: 'none',
            transition: 'var(--transition-fast)'
          }}
        />

        {value && (
          <button
            onClick={onClear}
            style={{
              position: 'absolute',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              padding: '4px',
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              border: 'none'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Quick Micro-Filter Pills */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {filters.map((f, i) => (
          <button
            key={i}
            onClick={() => onQuickFilter(f.value)}
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              background: value === f.value ? 'var(--primary-emerald)' : '#FFFFFF',
              color: value === f.value ? '#FFFFFF' : 'var(--text-dark)',
              border: '1px solid var(--border-light)',
              whiteSpace: 'nowrap',
              transition: 'var(--transition-fast)'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
