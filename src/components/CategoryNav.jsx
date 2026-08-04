import React from 'react';
import { Utensils, Sparkles } from 'lucide-react';

export default function CategoryNav({ categories, selectedCategory, onSelectCategory }) {
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(251, 249, 244, 0.94)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--gold-border)',
      padding: '12px 0',
      boxShadow: '0 4px 20px rgba(9, 31, 19, 0.05)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '0 20px'
      }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {/* All Categories Pill */}
          <button
            onClick={() => onSelectCategory('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.86rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              transition: 'var(--transition-fast)',
              background: selectedCategory === 'all' 
                ? 'linear-gradient(135deg, #091F13 0%, #143A24 100%)' 
                : '#FFFFFF',
              color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--text-dark)',
              border: selectedCategory === 'all' 
                ? '1.5px solid var(--gold-bright)' 
                : '1px solid var(--gold-border)',
              boxShadow: selectedCategory === 'all' ? 'var(--shadow-gold)' : 'var(--shadow-sm)'
            }}
          >
            <Sparkles size={15} color={selectedCategory === 'all' ? 'var(--gold-bright)' : 'var(--gold-primary)'} />
            All Categories
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const isSelected = String(selectedCategory) === String(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition-fast)',
                  background: isSelected 
                    ? 'linear-gradient(135deg, #091F13 0%, #143A24 100%)' 
                    : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                  border: isSelected 
                    ? '1.5px solid var(--gold-bright)' 
                    : '1px solid var(--gold-border)',
                  boxShadow: isSelected ? 'var(--shadow-gold)' : 'var(--shadow-sm)'
                }}
              >
                {cat.image && (
                  <img 
                    src={cat.image} 
                    alt={cat.name} 
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: isSelected ? '1px solid var(--gold-bright)' : '1px solid var(--gold-border)'
                    }}
                  />
                )}
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
