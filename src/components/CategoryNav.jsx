import React from 'react';
import { Sparkles } from 'lucide-react';
import CategoryImage from './CategoryImage';

export default function CategoryNav({ categories, selectedCategory, onSelectCategory, lang }) {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      width: '100%',
      padding: '4px 12px 8px',
    }}>
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingBottom: '4px'
      }}>
        {/* All Categories Pill */}
        <button
          onClick={() => onSelectCategory('all')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.78rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            transition: 'var(--transition-fast)',
            background: selectedCategory === 'all' 
              ? 'var(--theme-nav-active, var(--primary-emerald))' 
              : 'var(--theme-nav-bg, var(--bg-card, #FFFFFF))',
            color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--text-dark)',
            border: selectedCategory === 'all' 
              ? '1.5px solid var(--gold-bright)' 
              : '1px solid var(--theme-card-border, var(--border-light))',
            boxShadow: 'var(--theme-shadow, var(--shadow-sm))'
          }}
        >
          <Sparkles size={13} color={selectedCategory === 'all' ? 'var(--gold-bright, #D4AF37)' : 'var(--primary-emerald)'} />
          {lang === 'hi' ? 'सभी श्रेणियां' : 'All Categories'}
        </button>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat.id);
          const catDisplayName = (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                transition: 'var(--transition-fast)',
                background: isSelected 
                  ? 'var(--theme-nav-active, var(--primary-emerald))' 
                  : 'var(--theme-nav-bg, var(--bg-card, #FFFFFF))',
                color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                border: isSelected 
                  ? '1.5px solid var(--gold-bright)' 
                  : '1px solid var(--theme-card-border, var(--border-light))',
                boxShadow: 'var(--theme-shadow, var(--shadow-sm))'
              }}
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
