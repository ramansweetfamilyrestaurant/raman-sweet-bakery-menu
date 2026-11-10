import React from 'react';

export default function CategoryStrip({ selectedIndustry = 'restaurant', onSelectIndustry }) {
  const categories = [
    { icon: '🍽️', title: 'Family Fine Dining', industry: 'restaurant' },
    { icon: '🏨', title: 'Hotel Room Service', industry: 'hotel' },
    { icon: '🎬', title: 'Cinemas & Multiplexes', industry: 'cinema' },
    { icon: '🧁', title: 'Sweet Shops & Bakeries', industry: 'restaurant' },
    { icon: '🍕', title: 'Cafes & Restro-Bars', industry: 'restaurant' },
    { icon: '🍔', title: 'QSR & Food Courts', industry: 'restaurant' },
    { icon: '🍛', title: 'Dhabas & Cloud Kitchens', industry: 'restaurant' },
    { icon: '🛋️', title: 'Private Cabins & Lounges', industry: 'restaurant' }
  ];

  const handleCategoryClick = (cat) => {
    if (typeof onSelectIndustry === 'function' && cat.industry) {
      onSelectIndustry(cat.industry);
    }
    const target = document.getElementById('standee-preview') || document.getElementById('pricing');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="km-category-strip-section">
      <div className="km-container">
        <div className="km-category-header">
          <span>BUILT FOR EVERY HOSPITALITY & RETAIL BUSINESS</span>
        </div>
        <div className="km-category-grid">
          {categories.map((cat, idx) => {
            const isMatch = (cat.industry === selectedIndustry) && (
              (cat.industry === 'hotel' && cat.title.includes('Hotel')) ||
              (cat.industry === 'cinema' && cat.title.includes('Cinema')) ||
              (cat.industry === 'restaurant' && cat.title.includes('Fine Dining'))
            );

            return (
              <button
                key={idx}
                type="button"
                className={`km-category-chip ${isMatch ? 'active' : ''}`}
                onClick={() => handleCategoryClick(cat)}
                title={`Explore TouchQR for ${cat.title}`}
              >
                <span className="km-category-icon">{cat.icon}</span>
                <span className="km-category-text">{cat.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
