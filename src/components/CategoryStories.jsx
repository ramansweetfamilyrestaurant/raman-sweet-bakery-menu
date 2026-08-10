import React from 'react';
import { resolveImageUrl } from '../utils/imageHelper';

export default function CategoryStories({ categories, selectedCategory, onSelectCategory, lang }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '12px 14px 10px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      background: 'rgba(255, 255, 255, 0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-light)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        display: 'flex',
        gap: '14px',
        alignItems: 'center'
      }}>
        {/* All Categories Story Button */}
        <div 
          onClick={() => onSelectCategory('all')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            padding: '2px',
            background: selectedCategory === 'all' 
              ? 'linear-gradient(135deg, #0A2315 0%, #15803D 100%)' 
              : 'var(--border-light)',
            boxShadow: selectedCategory === 'all' ? '0 0 10px rgba(21, 128, 61, 0.35)' : 'none',
            transition: 'var(--transition-fast)'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: 'var(--primary-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: 800
            }}>
              ❖
            </div>
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: selectedCategory === 'all' ? 'var(--primary-emerald)' : 'var(--text-muted)'
          }}>
            {lang === 'hi' ? 'सभी वर्ग' : 'All Items'}
          </span>
        </div>

        {/* Dynamic Category Story Avatars */}
        {categories.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat.id);
          const displayName = (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name;

          const catImage = resolveImageUrl(cat.image);

          return (
            <div 
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                padding: '2px',
                background: isSelected 
                  ? 'linear-gradient(135deg, #0A2315 0%, #15803D 100%)' 
                  : 'var(--border-light)',
                boxShadow: isSelected ? '0 0 10px rgba(21, 128, 61, 0.35)' : 'none',
                transition: 'var(--transition-fast)'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--bg-secondary)'
                }}>
                  {catImage ? (
                    <img 
                      src={catImage} 
                      alt={displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--header-gradient)',
                      color: 'var(--gold-bright)',
                      fontSize: '1rem',
                      fontWeight: 900
                    }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: isSelected ? 'var(--primary-emerald)' : 'var(--text-muted)',
                maxWidth: '64px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {displayName.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
