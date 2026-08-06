import React, { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';

export default function CategoryJumpRail({ categories, lang, selectedCategory, onSelectCategory }) {
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
              background: selectedCategory === 'all' ? 'var(--primary-emerald)' : '#FFFFFF',
              color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--primary-emerald)',
              border: selectedCategory === 'all' ? '1.5px solid var(--gold-bright)' : '1px solid var(--border-light)',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-sm)',
              transition: 'var(--transition-fast)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Layers size={13} />
            {lang === 'hi' ? 'सभी श्रेणियां' : 'All Items'}
          </button>

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
                  background: isSelected ? 'var(--primary-emerald)' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                  border: isSelected ? '1.5px solid var(--gold-bright)' : '1px solid var(--border-light)',
                  whiteSpace: 'nowrap',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'var(--transition-fast)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt=""
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: isSelected ? '1px solid #FFFFFF' : 'none'
                    }}
                  />
                ) : null}
                <span>{catName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
