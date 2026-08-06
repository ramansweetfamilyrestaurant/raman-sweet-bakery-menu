import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, onClear, onQuickFilter, showFilterBar = true }) {
  const filters = [
    { label: '✨ All', value: '' },
    { label: '⭐ Must Try', value: 'Must Try' },
    { label: '🍱 Combo', value: 'Combo' },
    { label: '✨ Special', value: 'Special' },
    { label: '⚡ Under 100', value: 'under100' }
  ];

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      width: '100%',
      padding: '10px 12px 4px',
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
          size={16} 
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
            padding: '9px 36px 9px 36px',
            fontSize: '0.84rem',
            fontWeight: 500,
            background: '#FFFFFF',
            color: 'var(--text-dark)',
            border: '1.5px solid var(--border-light)',
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
              right: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
      {showFilterBar !== false && (
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2px'
        }}>
        {filters.map((f, i) => {
          const isSelected = value === f.value || (f.value === '' && !value);
          return (
            <button
              key={i}
              onClick={() => onQuickFilter(value === f.value ? '' : f.value)}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 11px',
                borderRadius: 'var(--radius-pill)',
                background: isSelected ? 'var(--primary-emerald)' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                border: isSelected ? '1.5px solid var(--gold-bright)' : '1px solid var(--border-light)',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-fast)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
