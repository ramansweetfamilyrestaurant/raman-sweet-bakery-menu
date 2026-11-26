import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export default function SearchBar({
  value = '',
  onChange,
  onClear,
  activeQuickFilter = '',
  onQuickFilter,
  totalResultsCount,
  filtersVisibility,
  businessType,
  restoType,
  foodType,
  isPureVeg: isPureVegProp,
  lang = 'en',
  currencySymbol = '₹'
}) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const cleanFood = String(foodType || '').trim().toLowerCase();
  const cleanResto = String(restoType || '').trim().toLowerCase();
  const isPureVeg = (isPureVegProp === true || isPureVegProp === 1 || isPureVegProp === '1' || isPureVegProp === 'true')
    || ['pure_veg', 'veg', 'vegetarian', 'vegan', 'only_veg'].includes(cleanFood)
    || ['pure_veg', 'veg', 'vegetarian'].includes(cleanResto);

  const vis = {
    must_try: true,
    combo: true,
    special: true,
    under100: true,
    ...filtersVisibility,
    ...(isPureVeg ? { veg: false, nonveg: false, egg: false } : {})
  };

  const allFilters = [
    { id: '', label: lang === 'hi' ? '✨ सभी' : '✨ All', show: true },
    { id: 'combo', label: lang === 'hi' ? '🍱 थाली & कॉम्बो' : '🍱 Combos & Thalis', show: vis.combo !== false },
    { id: 'veg', label: lang === 'hi' ? '🟢 केवल शाकाहारी' : '🟢 Pure Veg', show: !isPureVeg && vis.veg !== false },
    { id: 'nonveg', label: lang === 'hi' ? '🔴 नॉन-वेज' : '🔴 Non-Veg', show: !isPureVeg && vis.nonveg !== false },
    { id: 'egg', label: lang === 'hi' ? '🟡 अंडा' : '🟡 Egg', show: !isPureVeg && vis.egg !== false },
    { id: 'must_try', label: lang === 'hi' ? '⭐ मस्ट ट्राई' : '⭐ Must Try', show: vis.must_try !== false },
    { id: 'special', label: lang === 'hi' ? '✨ स्पेशल' : '✨ Special', show: vis.special !== false },
    { id: 'under100', label: lang === 'hi' ? `⚡ ${currencySymbol}100 से कम` : `⚡ Under ${currencySymbol}100`, show: vis.under100 !== false }
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
    triggerHaptic('light');
    if (filterId === '') {
      onQuickFilter('');
    } else {
      // Toggle off if already active, otherwise activate
      onQuickFilter(activeQuickFilter === filterId ? '' : filterId);
    }
  };

  const handleClearAll = () => {
    triggerHaptic('light');
    if (onClear) onClear();
    if (onQuickFilter) onQuickFilter('');
    setIsFocused(false);
  };

  const getSearchPlaceholder = () => {
    const biz = String(businessType || cleanResto || '').trim().toLowerCase();
    const byType = {
      cafe: lang === 'hi' ? 'कॉफी, स्नैक्स, ड्रिंक्स खोजें...' : 'Search coffee, snacks, drinks...',
      bakery_confectionery: lang === 'hi' ? 'केक, पेस्ट्री, बेकरी आइटम खोजें...' : 'Search cakes, pastries, breads...',
      sweet_shop: lang === 'hi' ? 'मिठाई, नमकीन, गिफ्ट पैक खोजें...' : 'Search sweets, mithai, namkeen...',
      juice_beverage: lang === 'hi' ? 'जूस, शेक, स्मूदी खोजें...' : 'Search juices, shakes, coolers...',
      ice_cream_dessert: lang === 'hi' ? 'आइसक्रीम, डेज़र्ट, शेक खोजें...' : 'Search ice cream, desserts, sundaes...',
      cinema_theatre: lang === 'hi' ? 'पॉपकॉर्न, कॉम्बो, ड्रिंक्स खोजें...' : 'Search popcorn, combos, drinks...',
      lounge: lang === 'hi' ? 'ड्रिंक्स, स्टार्टर्स, मॉकटेल खोजें...' : 'Search drinks, starters, mocktails...',
      pub_bar: lang === 'hi' ? 'ड्रिंक्स, स्टार्टर्स, प्लैटर खोजें...' : 'Search drinks, starters, platters...',
      club: lang === 'hi' ? 'ड्रिंक्स, स्टार्टर्स, बॉटल सर्विस खोजें...' : 'Search drinks, starters, mixes...',
      fast_food_qsr: lang === 'hi' ? 'बर्गर, रोल्स, कॉम्बो खोजें...' : 'Search snacks, combos, drinks...',
      food_truck: lang === 'hi' ? 'स्नैक्स, रोल्स, ड्रिंक्स खोजें...' : 'Search snacks, combos, drinks...'
    };
    if (byType[biz]) return byType[biz];
    return lang === 'hi' ? 'मेनू में आइटम खोजें...' : 'Search menu items...';
  };

  const placeholderText = getSearchPlaceholder();

  return (
    <div 
      ref={containerRef}
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '8px 12px 4px',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      {/* Search Input Box */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        marginBottom: showFilters ? '7px' : '2px',
        transition: 'margin-bottom 0.2s ease'
      }}>
        <Search 
          size={15} 
          color={isFocused ? 'var(--primary-emerald)' : 'var(--text-muted)'} 
          style={{
            position: 'absolute',
            left: '14px',
            pointerEvents: 'none',
            transition: 'color 0.2s ease'
          }}
        />

        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={value}
          onFocus={() => setIsFocused(true)}
          onClick={() => setIsFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              handleClearAll();
              e.currentTarget.blur();
            }
          }}
          onChange={(e) => {
            setIsFocused(true);
            if (onChange) onChange(e.target.value);
          }}
          placeholder={placeholderText}
          style={{
            width: '100%',
            height: '38px',
            padding: '0 38px 0 36px',
            fontSize: '0.84rem',
            boxSizing: 'border-box',
            fontWeight: 500,
            background: 'var(--theme-input-bg, var(--bg-card, #FFFFFF))',
            color: 'var(--text-dark)',
            border: isFocused 
              ? '1px solid var(--theme-primary, var(--primary-emerald))' 
              : '1px solid var(--theme-card-border, rgba(148, 163, 184, 0.3))',
            borderRadius: 'var(--radius-pill)',
            boxShadow: isFocused 
              ? '0 2px 10px rgba(10, 35, 21, 0.08)' 
              : '0 1px 4px rgba(10, 35, 21, 0.04)',
            outline: 'none',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease'
          }}
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              if (onClear) onClear();
              if (inputRef.current) inputRef.current.focus();
            }}
            aria-label="Clear search text"
            style={{
              position: 'absolute',
              right: '7px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Quick Micro-Filter Pills: Unified with CategoryJumpRail aesthetic */}
      {showFilters && filters.length > 1 && (
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '2px',
            paddingRight: '14px',
            maskImage: 'linear-gradient(to right, #000 0%, #000 94%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 94%, transparent 100%)',
            animation: 'fadeIn 0.18s ease-in-out'
          }}
        >
          {filters.map((f, i) => {
            const isSelected = activeQuickFilter === f.id || (f.id === '' && !activeQuickFilter);
            return (
              <button
                key={f.id || i}
                type="button"
                className="tq-pill-smooth"
                onMouseDown={(e) => {
                  // Prevent input blur so filters stay open smoothly
                  e.preventDefault();
                }}
                onClick={() => handleFilterClick(f.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '30px',
                  padding: '0 11px',
                  fontSize: '0.73rem',
                  fontWeight: isSelected ? 800 : 700,
                  flexShrink: 0,
                  borderRadius: 'var(--radius-pill)',
                  background: isSelected ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
                  color: isSelected ? 'var(--theme-nav-active-text, #FFFFFF)' : 'var(--text-dark)',
                  border: isSelected
                    ? '1px solid var(--theme-primary, var(--primary-emerald))'
                    : '1px solid var(--theme-card-border, rgba(148, 163, 184, 0.28))',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 2px 6px rgba(10, 35, 21, 0.14)' : 'none',
                  animation: 'tqCardIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
                  animationDelay: `${Math.min(i * 25, 150)}ms`,
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Slim Single-Line Active Search/Filter Summary without bulky border box */}
      {showFilters && hasActiveSearchOrFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginTop: '4px',
          padding: '2px 4px 0',
          fontSize: '0.72rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          animation: 'fadeIn 0.18s ease-in-out'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
            <span>
              {lang === 'hi' 
                ? `${totalResultsCount !== undefined ? totalResultsCount : ''} परिणाम` 
                : `${totalResultsCount !== undefined ? totalResultsCount : ''} matches`}
            </span>
            {activeFilterLabel && (
              <span style={{
                background: 'var(--theme-badge-bg, var(--bg-secondary))',
                color: 'var(--text-dark)',
                border: '1px solid var(--theme-card-border, rgba(148, 163, 184, 0.3))',
                padding: '0 7px',
                borderRadius: '9999px',
                fontSize: '0.68rem',
                fontWeight: 700
              }}>
                {activeFilterLabel}
              </span>
            )}
            {value && (
              <span style={{ fontStyle: 'italic', color: 'var(--text-dark)', overflowWrap: 'anywhere' }}>
                "{value}"
              </span>
            )}
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClearAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#DC2626',
              fontWeight: 800,
              fontSize: '0.71rem',
              cursor: 'pointer',
              padding: '2px 4px',
              whiteSpace: 'nowrap'
            }}
          >
            {lang === 'hi' ? 'हटाएं ✕' : 'Clear ✕'}
          </button>
        </div>
      )}
    </div>
  );
}
