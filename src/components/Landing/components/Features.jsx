import React from 'react';
import { Smartphone, MessageSquare, Flame, Star, Printer, BarChart3, Grid, ShieldCheck } from 'lucide-react';

export default function Features() {
  const featureList = [
    {
      icon: <Smartphone size={24} />,
      title: 'Digital QR Menu',
      desc: 'Instant 0.3s smartphone menu loading with rich images, half/full pricing, categories, and luxury themes. No app download needed.'
    },
    {
      icon: <MessageSquare size={24} />,
      title: 'WhatsApp Ordering',
      desc: 'Send automated order confirmations and receipts directly to your customer’s WhatsApp for seamless customer retention.'
    },
    {
      icon: <Flame size={24} />,
      title: 'Live Kitchen KOT & Siren',
      desc: 'Table QR orders trigger an instant loud audio siren alarm and KOT ticket in your kitchen dashboard with zero delay.'
    },
    {
      icon: <Star size={24} />,
      title: 'Smart Google Reviews',
      desc: 'Automatically guide 4 and 5-star customer ratings to your Google Maps business page, boosting your local search ranking.'
    },
    {
      icon: <Printer size={24} />,
      title: 'Thermal Printing',
      desc: 'Connect 2-inch and 3-inch Bluetooth or USB thermal printers from your mobile phone or PC for instant KOTs and GST invoices.'
    },
    {
      icon: <BarChart3 size={24} />,
      title: 'Restaurant Analytics',
      desc: 'Track daily sales revenue, top-selling dishes, peak dining hours, and customer order history from your phone.'
    }
  ];

  return (
    <section id="features" className="km-features-section">
      <div className="km-container">
        <div className="km-section-header">
          <div className="km-badge">
            <span>⚡ POWERFUL FEATURES</span>
          </div>
          <h2 className="km-title-lg">Everything Your Restaurant Needs to Go Digital</h2>
          <p className="km-subtitle">
            One simple platform for your menu, table orders, kitchen notifications, and revenue growth.
          </p>
        </div>

        <div className="km-features-grid">
          {featureList.map((item, index) => (
            <div key={index} className="km-feature-card">
              <div className="km-feature-icon">
                {item.icon}
              </div>
              <h3 className="km-feature-title">{item.title}</h3>
              <p className="km-feature-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
