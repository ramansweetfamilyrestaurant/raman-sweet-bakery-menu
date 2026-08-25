import React from 'react';
import { Layers } from 'lucide-react';
import CategoryImage from './CategoryImage';

export default function CategoryJumpRail({ categories, lang, selectedCategory, onSelectCategory, hasCombos = false }) {
  if (!categories || categories.length === 0) return null;

  const scrollToCategory = (catId) => {
    onSelectCategory(catId);
    const elem = document.getElementById(`cat-sec-${catId}`);
    if (elem) {
      const offset = 120; // Accounts for sticky header height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = elem.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const scrollToCombos = () => {
    onSelectCategory('combos-section');
    const elem = document.getElementById('combos-section');
    if (elem) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = elem.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 90,
      background: 'var(--bg-app)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '8px 0',
      boxShadow: '0 4px 12px rgba(10, 35, 21, 0.05)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '0 12px'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2px',
          alignItems: 'center'
        }}>
          {/* "All" Category Pill */}
          <button
            onClick={() => {
              onSelectCategory('all');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.78rem',
              fontWeight: 800,
              background: selectedCategory === 'all' ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--theme-nav-bg, var(--bg-card, #FFFFFF))',
              color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--primary-emerald)',
              border: selectedCategory === 'all' ? '1.5px solid var(--gold-bright)' : '1px solid var(--theme-card-border, var(--border-light))',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
              transition: 'var(--transition-fast)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Layers size={13} />
            {lang === 'hi' ? 'सभी श्रेणियां' : 'All Items'}
          </button>

          {/* "🍱 COMBOS & THALIS" Dedicated Category Pill */}
          {hasCombos && (
            <button
              onClick={scrollToCombos}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: selectedCategory === 'combos-section' ? 'linear-gradient(135deg, #059669, #10B981)' : 'var(--theme-badge-bg, #FFFBEB)',
                color: selectedCategory === 'combos-section' ? '#FFFFFF' : 'var(--theme-text-primary, #B45309)',
                border: selectedCategory === 'combos-section' ? '1.5px solid #10B981' : '1px solid var(--theme-card-border, #FCD34D)',
                whiteSpace: 'nowrap',
                boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
                transition: 'var(--transition-fast)',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <span>🍱</span>
              <span>{lang === 'hi' ? 'कॉम्बो एवं थाली' : 'Combos & Thalis'}</span>
            </button>
          )}

          {/* Individual Category Pills with Thumbnails */}
          {categories.map((cat) => {
            const isSelected = String(selectedCategory) === String(cat.id);
            const catName = (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name;

            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  background: isSelected ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--theme-nav-bg, var(--bg-card, #FFFFFF))',
                  color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                  border: isSelected ? '1.5px solid var(--gold-bright)' : '1px solid var(--theme-card-border, var(--border-light))',
                  whiteSpace: 'nowrap',
                  boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
                  transition: 'var(--transition-fast)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <CategoryImage
                  image={cat.image}
                  name={cat.name}
                  size={18}
                  isSelected={isSelected}
                />
                <span>{catName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
