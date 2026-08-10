import React from 'react';

export default function CategoryStrip() {
  const categories = [
    { icon: '🧁', title: 'Sweet Shops & Bakeries' },
    { icon: '🌶️', title: 'Family Fine Dining' },
    { icon: '🍕', title: 'Cafes & Restro-Bars' },
    { icon: '🍔', title: 'QSR & Fast Food' },
    { icon: '🍛', title: 'Dhabas & Thali Restaurants' },
    { icon: '🏨', title: 'Hotel Room Service' },
    { icon: '🍧', title: 'Ice Cream Parlors' }
  ];

  return (
    <div className="km-category-strip-wrapper">
      <div className="km-container">
        <div className="km-category-header">
          <span>TRUSTED ACROSS ALL FOOD BUSINESS TYPES IN INDIA</span>
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
    </div>
  );
}
