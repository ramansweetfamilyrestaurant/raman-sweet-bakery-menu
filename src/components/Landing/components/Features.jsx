import React, { useState } from 'react';
import { Smartphone, MessageSquare, Flame, Star, Printer, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

export default function Features() {
  const [showAllMobile, setShowAllMobile] = useState(false);

  const featureList = [
    {
      icon: <Smartphone size={24} />,
      title: 'Smart QR Catalogs & Menus',
      desc: 'Instant 0.3s smartphone loading with rich images, half/full or weight-based pricing (250g/500g/1kg), categories, and luxury themes. No app download needed.'
    },
    {
      icon: <MessageSquare size={24} />,
      title: 'Multi-Space Ordering',
      desc: 'Native QR ordering configured for Dining Tables, Hotel Rooms, Cinema Audi Seats, Private Cabins, or Takeaway Counters.'
    },
    {
      icon: <Flame size={24} />,
      title: 'Live Dispatch & Siren Alarms',
      desc: 'Incoming orders trigger an instant loud audio siren alarm and visual ticket in your kitchen or service dispatch screen with zero delay.'
    },
    {
      icon: <Star size={24} />,
      title: 'Smart Google Reviews',
      desc: 'Automatically guide 4 and 5-star customer ratings to your Google Maps business page, boosting your local search ranking.'
    },
    {
      icon: <Printer size={24} />,
      title: 'Thermal Printing & KOT',
      desc: 'Connect 2-inch and 3-inch Bluetooth or USB thermal printers from your mobile or PC for instant order tickets and GST tax invoices.'
    },
    {
      icon: <BarChart3 size={24} />,
      title: 'Business Sales Analytics',
      desc: 'Track daily sales revenue, top-selling items, peak ordering hours, and customer order history from any device.'
    }
  ];

  return (
    <section id="features" className="km-features-section">
      <div className="km-container">
        <div className="km-section-header">
          <div className="km-badge">
            <span>⚡ POWERFUL FEATURES</span>
          </div>
          <h2 className="km-title-lg">Everything Your Business Needs to Go 100% Digital</h2>
          <p className="km-subtitle">
            From dining tables and hotel room service to cinema seats and takeaway counters — one unified operations platform.
          </p>
        </div>

        <div className={`km-features-grid ${showAllMobile ? 'expanded-mobile' : 'collapsed-mobile'}`}>
          {featureList.map((item, index) => (
            <div key={index} className={`km-feature-card ${index >= 4 ? 'mobile-hidden-card' : ''}`}>
              <div className="km-feature-icon">
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="km-feature-title">{item.title}</h3>
                <p className="km-feature-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="km-features-toggle-wrap">
          <button 
            className="km-btn-secondary km-features-toggle-btn"
            onClick={() => setShowAllMobile(!showAllMobile)}
          >
            {showAllMobile ? (
              <>Show Less Features <ChevronUp size={16} /></>
            ) : (
              <>View All Features ({featureList.length}) <ChevronDown size={16} /></>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
