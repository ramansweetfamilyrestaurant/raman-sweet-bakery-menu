import React from 'react';

export default function CategoryStrip() {
  const categories = [
    { icon: '🍽️', title: 'Family Fine Dining' },
    { icon: '🏨', title: 'Hotel Room Service' },
    { icon: '🎬', title: 'Cinemas & Multiplexes' },
    { icon: '🧁', title: 'Sweet Shops & Bakeries' },
    { icon: '🍕', title: 'Cafes & Restro-Bars' },
    { icon: '🍔', title: 'QSR & Food Courts' },
    { icon: '🍛', title: 'Dhabas & Cloud Kitchens' },
    { icon: '🛋️', title: 'Private Cabins & Lounges' }
  ];

  return (
    <section className="km-category-strip-section">
      <div className="km-container">
        <div className="km-category-header">
          <span>BUILT FOR EVERY HOSPITALITY & RETAIL BUSINESS</span>
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
