import React from 'react';
import { Sparkles } from 'lucide-react';

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
              ? 'var(--primary-emerald)' 
              : '#FFFFFF',
            color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--text-dark)',
            border: selectedCategory === 'all' 
              ? '1.5px solid var(--gold-bright)' 
              : '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Sparkles size={13} color={selectedCategory === 'all' ? '#D4AF37' : 'var(--primary-emerald)'} />
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
                  ? 'var(--primary-emerald)' 
                  : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                border: isSelected 
                  ? '1.5px solid var(--gold-bright)' 
                  : '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {cat.image && (
                <img 
                  src={cat.image} 
                  alt={catDisplayName} 
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              )}
              {catDisplayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
