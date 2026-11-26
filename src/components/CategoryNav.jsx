import React from 'react';
import { Sparkles } from 'lucide-react';
import CategoryImage from './CategoryImage';

export default function CategoryNav({ categories, selectedCategory, onSelectCategory, lang }) {
  const getPillStyle = (isSelected) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '32px',
    padding: '0 12px',
    flexShrink: 0,
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.78rem',
    fontWeight: isSelected ? 800 : 700,
    whiteSpace: 'nowrap',
    transition: 'var(--transition-fast)',
    cursor: 'pointer',
    background: isSelected
      ? 'var(--theme-nav-active, var(--primary-emerald))'
      : 'var(--theme-nav-bg, var(--bg-card, #FFFFFF))',
    color: isSelected ? 'var(--theme-nav-active-text, #FFFFFF)' : 'var(--text-dark)',
    border: isSelected
      ? '1px solid var(--theme-primary, var(--primary-emerald))'
      : '1px solid var(--theme-card-border, rgba(148, 163, 184, 0.28))',
    boxShadow: isSelected ? '0 2px 8px rgba(10, 35, 21, 0.14)' : 'none'
  });

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      width: '100%',
      padding: '4px 12px 8px',
    }}>
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: '7px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '4px'
        }}
      >
        {/* All Categories Pill */}
        <button
          type="button"
          className="tq-pill-smooth"
          onClick={() => onSelectCategory('all')}
          style={getPillStyle(selectedCategory === 'all')}
        >
          <Sparkles size={13} color={selectedCategory === 'all' ? 'var(--theme-nav-active-text, #FFFFFF)' : 'var(--primary-emerald)'} />
          {lang === 'hi' ? 'सभी श्रेणियां' : 'All Categories'}
        </button>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat.id);
          const catDisplayName = (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name;

          return (
            <button
              key={cat.id}
              type="button"
              className="tq-pill-smooth"
              onClick={() => onSelectCategory(cat.id)}
              style={getPillStyle(isSelected)}
            >
              <CategoryImage
                image={cat.image}
                name={cat.name}
                size={18}
                isSelected={isSelected}
              />
              {catDisplayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
