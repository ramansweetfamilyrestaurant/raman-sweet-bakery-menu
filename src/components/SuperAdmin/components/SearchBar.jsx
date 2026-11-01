import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  width = '100%',
  style = {},
  className = '',
  disabled = false,
  autoFocus = false,
  ariaLabel = 'Search'
}) {
  return (
    <div style={{ position: 'relative', width, ...style }} className={className}>
      <Search
        size={15}
        style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--sa-text-muted, #64748B)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className="sa-input sa-search-input-field"
        style={{
          paddingLeft: '38px',
          paddingRight: value ? '34px' : '14px',
          height: '40px',
          borderRadius: 'var(--sa-radius-full, 9999px)',
          background: 'var(--sa-surface-subtle, #F8FAFC)',
          border: '1px solid var(--sa-border, #E2E8F0)',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--sa-text-main, #0F172A)',
          boxSizing: 'border-box',
          width: '100%',
          outline: 'none',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: '11px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.06)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--sa-text-muted, #64748B)',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'all 0.15s ease',
            zIndex: 2
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.12)';
            e.currentTarget.style.color = 'var(--sa-text-main, #0F172A)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
            e.currentTarget.style.color = 'var(--sa-text-muted, #64748B)';
          }}
          title="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
