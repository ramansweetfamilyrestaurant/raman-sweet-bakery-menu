import React, { useState } from 'react';
import { ArrowRight, Play, Sparkles, Smartphone, Printer, Bell, Star } from 'lucide-react';

export default function Hero({ trialDays = 16, onStartTrial, onLiveDemo }) {
  const [selectedVertical, setSelectedVertical] = useState('dine_in');

  const verticals = {
    dine_in: {
      id: 'dine_in',
      tabLabel: '🍽️ Dine-In',
      badge: 'LIVE KITCHEN KOT',
      spaceLabel: 'Table 4 • Order #1042',
      items: 'Paneer Butter Masala (Full) x1, Garlic Naan x3',
      status: 'KOT Sent to Chef',
      customerTitle: 'Royal Spice Family Dining',
      customerSpace: '⚡ Scan to Order • Table 4',
      featuredItem: 'Butter Paneer Special Thali',
      featuredPrice: '₹280 • 🌟 Chef Special'
    },
    hotel: {
      id: 'hotel',
      tabLabel: '🏨 Hotel Room',
      badge: 'IN-ROOM DINING',
      spaceLabel: 'Room 302 • Order #2081',
      items: 'Club Sandwich x1, Fresh Orange Juice x2',
      status: 'Dispatched to Room 302',
      customerTitle: 'Grand Palace Hotel & Resort',
      customerSpace: '🛎️ In-Room Dining QR • Room 302',
      featuredItem: 'Midnight In-Room Snack Platter',
      featuredPrice: '₹350 • 24x7 Room Service'
    },
    cinema: {
      id: 'cinema',
      tabLabel: '🎬 Cinema Seat',
      badge: 'SEAT CONCESSION',
      spaceLabel: 'Audi 2, Seat E-14 • Order #3054',
      items: 'Cheese Popcorn Tub x1, Cold Coffee x2',
      status: 'Delivering to Seat E-14',
      customerTitle: 'Starview Multiplex Concession',
      customerSpace: '🍿 Seat QR Ordering • Audi 2 / E-14',
      featuredItem: 'Jumbo Popcorn & Nachos Combo',
      featuredPrice: '₹420 • Deliver to Seat'
    },
    counter: {
      id: 'counter',
      tabLabel: '🧁 Bakery / Sweets',
      badge: 'COUNTER TAKEAWAY',
      spaceLabel: 'Takeaway Counter • Token #45',
      items: 'Kaju Katli (500g) x1, Belgian Pastry x2',
      status: 'Ready at Counter',
      customerTitle: 'Royal Sweets & Confectionery',
      customerSpace: '🧾 Scan & Pay • Express Counter',
      featuredItem: 'Assorted Festive Mithai Box (1kg)',
      featuredPrice: '₹680 • 🌟 Fresh Today'
    }
  };

  const activeData = verticals[selectedVertical] || verticals.dine_in;

  return (
    <section className="km-hero-section">
      <div className="km-container">
        <div className="km-hero-grid">
          
          {/* Left Column: Headline & Action */}
          <div className="km-hero-content">
            <div className="km-badge">
              <Sparkles size={14} color="#D4AF37" />
              <span>ALL-IN-ONE SMART QR ORDERING & OPERATIONS PLATFORM</span>
            </div>

            <h1 className="km-title-lg">
              Restaurants, Hotels, Cinemas & Bakeries.<br />
              <span style={{ 
                background: 'linear-gradient(135deg, #0A2315 0%, #10B981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>One Smart QR System.</span>
            </h1>

            <p className="km-subtitle">
              From Dine-in Tables & Hotel Room Service to Cinema Seat Delivery and Bakery Takeaway Counters — empower your customers to scan, order, and pay with zero delays.
            </p>

            <div className="km-hero-ctas">
              <button className="km-btn-primary km-btn-gold" onClick={onStartTrial}>
                Start {trialDays}-Day Free Trial <ArrowRight size={18} />
              </button>

              <button className="km-btn-secondary" onClick={onLiveDemo}>
                <Play size={16} fill="currentColor" /> View Live Demo
              </button>
            </div>

            <div className="km-hero-proof-list">
              <div className="km-hero-proof-item">
                <span>✓</span> No Credit Card Required
              </div>
              <div className="km-hero-proof-item">
                <span>✓</span> Instant 60-Sec Setup
              </div>
              <div className="km-hero-proof-item">
                <span>✓</span> Built for All Business Types
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Multi-Business Product Preview Composition */}
          <div className="km-hero-preview">
            <div className="km-mockup-window">
              <div className="km-mockup-header">
                <div className="km-mockup-dots">
                  <div className="km-mockup-dot red" />
                  <div className="km-mockup-dot yellow" />
                  <div className="km-mockup-dot green" />
                </div>
                <span className="km-mockup-title">TouchQR Multi-Business Operations Hub</span>
              </div>

              {/* Multi-Vertical Interactive Selector Tabs */}
              <div style={{
                display: 'flex',
                background: '#0B1120',
                padding: '6px 8px',
                gap: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                overflowX: 'auto'
              }}>
                {Object.values(verticals).map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVertical(v.id)}
                    style={{
                      background: selectedVertical === v.id ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      border: selectedVertical === v.id ? '1px solid #10B981' : '1px solid transparent',
                      color: selectedVertical === v.id ? '#34D399' : '#94A3B8',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {v.tabLabel}
                  </button>
                ))}
              </div>

              <div className="km-mockup-body">
                {/* Admin POS Operations Dispatch Card */}
                <div className="km-preview-card">
                  <div className="km-preview-header">
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94A3B8' }}>{activeData.badge}</span>
                    <span className="km-preview-badge">⚡ ACTIVE</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ background: '#0F172A', padding: '10px', borderRadius: '10px', color: '#F59E0B' }}>
                      <Bell size={20} className="pulse" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#FFF' }}>{activeData.spaceLabel}</div>
                      <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: '2px' }}>{activeData.items}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', padding: '5px 9px', borderRadius: '6px', fontSize: '0.7rem', color: '#CBD5E1' }}>
                      <Printer size={12} style={{ display: 'inline', marginRight: '4px' }} /> Thermal Printed
                    </div>
                    <div style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '5px 9px', borderRadius: '6px', fontSize: '0.7rem', color: '#34D399', fontWeight: 800 }}>
                      {activeData.status}
                    </div>
                  </div>
                </div>

                {/* Customer Smartphone QR Menu Preview */}
                <div className="km-preview-card" style={{ background: '#0F172A', border: '1px solid #D4AF37' }}>
                  <div className="km-preview-header">
                    <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#D4AF37' }}>CUSTOMER SMART VIEW</span>
                    <Smartphone size={14} color="#D4AF37" />
                  </div>

                  <div style={{ textAlign: 'center', padding: '6px 0' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#FFF' }}>{activeData.customerTitle}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', margin: '2px 0 8px 0' }}>{activeData.customerSpace}</div>
                    
                    <div style={{ background: '#1E293B', borderRadius: '8px', padding: '8px', textAlign: 'left', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#FFF' }}>{activeData.featuredItem}</div>
                      <div style={{ fontSize: '0.68rem', color: '#D4AF37', fontWeight: 900, marginTop: '2px' }}>{activeData.featuredPrice}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.68rem', color: '#F59E0B', fontWeight: 800 }}>
                      <Star size={12} fill="#F59E0B" /> 4.9 Smart Review Prompter
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
