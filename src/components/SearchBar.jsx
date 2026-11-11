import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({
  value = '',
  onChange,
  onClear,
  activeQuickFilter = '',
  onQuickFilter,
  totalResultsCount,
  filtersVisibility,
  restoType,
  foodType,
  isPureVeg: isPureVegProp,
  lang = 'en'
}) {
  const isPureVeg = typeof isPureVegProp === 'boolean'
    ? isPureVegProp
    : (foodType ? (foodType === 'pure_veg' || foodType === 'vegan') : (restoType === 'pure_veg'));

  const vis = {
    must_try: true,
    combo: true,
    special: true,
    under100: true,
    veg: !isPureVeg,
    nonveg: !isPureVeg,
    egg: !isPureVeg,
    ...filtersVisibility
  };

  const allFilters = [
    { id: '', label: lang === 'hi' ? '✨ सभी' : '✨ All', show: true },
    { id: 'veg', label: lang === 'hi' ? '🟢 केवल शाकाहारी' : '🟢 Pure Veg', show: !isPureVeg && vis.veg !== false },
    { id: 'nonveg', label: lang === 'hi' ? '🔴 नॉन-वेज' : '🔴 Non-Veg', show: !isPureVeg && vis.nonveg !== false },
    { id: 'egg', label: lang === 'hi' ? '🟡 अंडा' : '🟡 Egg', show: !isPureVeg && vis.egg !== false },
    { id: 'must_try', label: lang === 'hi' ? '⭐ मस्ट ट्राई' : '⭐ Must Try', show: vis.must_try !== false },
    { id: 'special', label: lang === 'hi' ? '✨ स्पेशल' : '✨ Special', show: vis.special !== false },
    { id: 'under100', label: lang === 'hi' ? '⚡ ₹100 से कम' : '⚡ Under ₹100', show: vis.under100 !== false }
  ];

  const filters = allFilters.filter(f => f.show);

  // Active filter label for summary chip
  const activeFilterObj = allFilters.find(f => f.id === activeQuickFilter);
  const activeFilterLabel = activeFilterObj ? activeFilterObj.label.replace(/^[^\w\u0900-\u097F]+/, '').trim() : '';
  const hasActiveSearchOrFilter = Boolean((value && String(value).trim()) || activeQuickFilter);

  const handleFilterClick = (filterId) => {
    if (!onQuickFilter) return;
    if (filterId === '') {
      onQuickFilter('');
    } else {
      // Toggle off if already active, otherwise activate
      onQuickFilter(activeQuickFilter === filterId ? '' : filterId);
    }
  };

  const handleClearAll = () => {
    if (onClear) onClear();
    if (onQuickFilter) onQuickFilter('');
  };

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
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={lang === 'hi' ? 'मिठाई, थाली, डोसा, पिज़्ज़ा, चाय खोजें...' : 'Search sweets, thali, dosa, cakes, chai...'}
          style={{
            width: '100%',
            padding: '9px 36px 9px 36px',
            fontSize: '0.84rem',
            fontWeight: 500,
            background: 'var(--theme-input-bg, var(--bg-card, #FFFFFF))',
            color: 'var(--text-dark)',
            border: '1.5px solid var(--theme-card-border, var(--border-light))',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
            outline: 'none',
            transition: 'var(--transition-fast)'
          }}
        />

        {value && (
          <button
            onClick={onClear}
            aria-label="Clear search"
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
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Quick Micro-Filter Pills */}
      {filters.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2px'
        }}>
          {filters.map((f, i) => {
            const isSelected = activeQuickFilter === f.id || (f.id === '' && !activeQuickFilter);
            return (
              <button
                key={f.id || i}
                onClick={() => handleFilterClick(f.id)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  background: isSelected ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
                  color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                  border: isSelected ? '1.5px solid var(--gold-bright)' : '1px solid var(--theme-card-border, var(--border-light))',
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition-fast)',
                  boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Filter & Match Counter Feedback Pill Bar */}
      {hasActiveSearchOrFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '6px',
          padding: '4px 10px',
          fontSize: '0.74rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
          border: '1px solid var(--theme-card-border, var(--border-light))',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>
              {lang === 'hi' 
                ? `${totalResultsCount !== undefined ? totalResultsCount : ''} व्यंजन उपलब्ध` 
                : `${totalResultsCount !== undefined ? totalResultsCount : ''} dishes found`}
            </span>
            {activeFilterLabel && (
              <span style={{
                background: 'var(--theme-nav-active, var(--primary-emerald))',
                color: '#FFFFFF',
                padding: '1px 8px',
                borderRadius: '10px',
                fontSize: '0.68rem',
                fontWeight: 700
              }}>
                {activeFilterLabel}
              </span>
            )}
            {value && (
              <span style={{ fontStyle: 'italic', color: 'var(--text-dark)' }}>
                "{value}"
              </span>
            )}
          </span>
          <button
            onClick={handleClearAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--theme-price-color, var(--primary-emerald))',
              fontWeight: 800,
              fontSize: '0.72rem',
              cursor: 'pointer',
              padding: '2px 4px'
            }}
          >
            {lang === 'hi' ? 'हटाएं ✕' : 'Clear all ✕'}
          </button>
        </div>
      )}
    </div>
  );
}
