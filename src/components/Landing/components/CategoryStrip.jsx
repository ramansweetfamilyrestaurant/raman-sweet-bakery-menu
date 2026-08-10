import React from 'react';

export default function CategoryStrip() {
  const categories = [
    { icon: '🧁', title: 'Sweet Shops & Bakeries' },
    { icon: '🌶️', title: 'Family Fine Dining' },
    { icon: '🍕', title: 'Cafes & Restro-Bars' },
    { icon: '🍔', title: 'QSR & Fast Food' },
    { icon: '🍛', title: 'Dhabas & Thalis' },
    { icon: '🏨', title: 'Hotel Room Service' }
  ];

  return (
    <section className="km-category-strip-section">
      <div className="km-container">
        <div className="km-category-header">
          <span>BUILT FOR ALL INDIAN RESTAURANT TYPES</span>
        </div>
        <div className="km-category-grid">
          {categories.map((cat, idx) => (
            <div key={idx} className="km-category-chip">
              <span className="km-category-icon">{cat.icon}</span>
              <span className="km-category-text">{cat.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
