import React, { useState, useRef, useEffect } from 'react';
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
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);

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
    { id: 'combo', label: lang === 'hi' ? '🍱 थाली & कॉम्बो' : '🍱 Combos & Thalis', show: vis.combo !== false },
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

  // Filters show ONLY when user taps/focuses into search, or when a filter/query is actively applied
  const showFilters = isFocused || hasActiveSearchOrFilter;

  // Handle click/tap outside to collapse filters when idle and empty
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (!value?.trim() && !activeQuickFilter) {
          setIsFocused(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [value, activeQuickFilter]);

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
    setIsFocused(false);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '10px 12px 4px',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      {/* Search Input Box */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        marginBottom: showFilters ? '8px' : '4px',
        transition: 'margin-bottom 0.2s ease'
      }}>
        <Search 
          size={16} 
          color={isFocused ? 'var(--primary-emerald)' : 'var(--text-muted)'} 
          style={{
            position: 'absolute',
            left: '14px',
            pointerEvents: 'none',
            transition: 'color 0.2s ease'
          }}
        />

        <input
          type="text"
          value={value}
          onFocus={() => setIsFocused(true)}
          onClick={() => setIsFocused(true)}
          onChange={(e) => {
            setIsFocused(true);
            if (onChange) onChange(e.target.value);
          }}
          placeholder={lang === 'hi' ? 'मिठाई, थाली, डोसा, पिज़्ज़ा, चाय खोजें...' : 'Search sweets, thali, dosa, cakes, chai...'}
          style={{
            width: '100%',
            padding: '9px 36px 9px 36px',
            fontSize: '0.84rem',
            fontWeight: 500,
            background: 'var(--theme-input-bg, var(--bg-card, #FFFFFF))',
            color: 'var(--text-dark)',
            border: isFocused 
              ? '1.5px solid var(--primary-emerald, #059669)' 
              : '1.5px solid var(--theme-card-border, var(--border-light))',
            borderRadius: 'var(--radius-pill)',
            boxShadow: isFocused 
              ? '0 0 0 3px rgba(16, 185, 129, 0.15)' 
              : 'var(--theme-shadow, var(--shadow-sm))',
            outline: 'none',
            transition: 'all 0.2s ease'
          }}
        />

        {value && (
          <button
            onClick={() => {
              if (onClear) onClear();
            }}
            aria-label="Clear search text"
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

      {/* Quick Micro-Filter Pills: Only rendered when user taps on search or when search/filter is active */}
      {showFilters && filters.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {filters.map((f, i) => {
            const isSelected = activeQuickFilter === f.id || (f.id === '' && !activeQuickFilter);
            return (
              <button
                key={f.id || i}
                onMouseDown={(e) => {
                  // Prevent input blur so filters stay open smoothly
                  e.preventDefault();
                }}
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
      {showFilters && hasActiveSearchOrFilter && (
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
          boxShadow: 'var(--shadow-sm)',
          animation: 'fadeIn 0.2s ease-in-out'
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
            onMouseDown={(e) => e.preventDefault()}
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
