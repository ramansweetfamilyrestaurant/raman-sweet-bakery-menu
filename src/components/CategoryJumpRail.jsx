import React, { useRef, useEffect } from 'react';
import { Layers } from 'lucide-react';
import CategoryImage from './CategoryImage';
import { triggerHaptic } from '../utils/haptics';

export default function CategoryJumpRail({ categories, lang, selectedCategory, onSelectCategory, hasCombos = false }) {
  const pillRefs = useRef({});

  useEffect(() => {
    const activeEl = pillRefs.current[String(selectedCategory || 'all')];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedCategory]);

  if (!categories || categories.length === 0) return null;

  const handleSelect = (catId) => {
    triggerHaptic('light');
    onSelectCategory(catId);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const getPillStyle = (isSelected) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '32px',
    padding: '0 12px',
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.78rem',
    fontWeight: isSelected ? 800 : 700,
    background: isSelected
      ? 'var(--theme-nav-active, var(--primary-emerald))'
      : 'var(--theme-nav-bg, var(--bg-card, #FFFFFF))',
    color: isSelected
      ? 'var(--theme-nav-active-text, #FFFFFF)'
      : 'var(--text-dark)',
    border: isSelected
      ? '1px solid var(--theme-primary, var(--primary-emerald))'
      : '1px solid var(--theme-card-border, rgba(148, 163, 184, 0.28))',
    whiteSpace: 'nowrap',
    boxShadow: isSelected ? '0 2px 8px rgba(10, 35, 21, 0.14)' : 'none',
    transition: 'var(--transition-fast)',
    cursor: 'pointer',
    flexShrink: 0
  });

  const pillItems = [
    {
      key: 'all',
      label: lang === 'hi' ? 'सभी श्रेणियां' : 'All Items',
      icon: <Layers size={13} style={{ flexShrink: 0 }} />
    },
    ...(hasCombos ? [{
      key: 'combos-section',
      label: lang === 'hi' ? 'कॉम्बो एवं थाली' : 'Combos & Thalis',
      icon: <span style={{ fontSize: '0.84rem', lineHeight: 1 }}>🍱</span>
    }] : []),
    ...categories.map((cat) => ({
      key: String(cat.id),
      rawId: cat.id,
      label: (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name,
      cat
    }))
  ];

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 90,
      background: 'var(--bg-app)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '6px 0',
      boxShadow: '0 2px 10px rgba(10, 35, 21, 0.04)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '0 12px'
      }}>
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: '7px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '2px',
            paddingRight: '18px',
            maskImage: 'linear-gradient(to right, #000 0%, #000 92%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 92%, transparent 100%)',
            alignItems: 'center'
          }}
        >
          {pillItems.map((item) => {
            const isSelected = String(selectedCategory) === item.key;
            const targetId = item.rawId !== undefined ? item.rawId : item.key;

            return (
              <button
                key={item.key}
                type="button"
                className="tq-pill-smooth"
                ref={(el) => { pillRefs.current[item.key] = el; }}
                onClick={() => handleSelect(targetId)}
                style={getPillStyle(isSelected)}
              >
                {item.cat ? (
                  <CategoryImage
                    image={item.cat.image}
                    name={item.cat.name}
                    size={18}
                    isSelected={isSelected}
                  />
                ) : item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
