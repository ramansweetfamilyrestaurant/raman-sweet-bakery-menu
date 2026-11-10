import React, { useState, useEffect } from 'react';
import { QrCode, Printer, CheckCircle, Sparkles, Utensils, Building2, Film, Bell, Clock, ShieldCheck } from 'lucide-react';

const VERTICAL_DATA = {
  restaurant: {
    id: 'restaurant',
    tabIcon: '🍽️',
    tabLabel: 'Restaurant Table',
    badgeText: 'DINE-IN HARDWARE READY',
    badgeColor: '#D4AF37',
    title: 'Smart QR Standees & Kitchen KOT Printers for Dining Tables',
    description: 'Print luxury acrylic QR standees for your dining tables and auto-cut 0.5-second kitchen order tickets (KOT) directly to Bluetooth & USB thermal printers.',
    features: [
      {
        title: 'Ready-to-Print Acrylic Table PDFs',
        desc: 'Download pre-designed acrylic & wooden QR table standees matching your restaurant colors directly from your dashboard.'
      },
      {
        title: '0.5s ESC/POS Thermal Auto-Cut',
        desc: 'Kitchen KOT tickets print automatically the second a guest places an order, complete with table numbers and chef notes.'
      },
      {
        title: 'Waiter Call & Instant Bill Request',
        desc: 'Guests can call table service, request drinking water, or ask for the bill without shouting across the dining room.'
      }
    ],
    standee: {
      themeClass: 'km-theme-restaurant',
      headerIcon: Utensils,
      badge: 'TABLE 05 STANDEE',
      badgeColor: '#D4AF37',
      brand: 'Royal Spice Restaurant',
      spaceLabel: 'TABLE 05 • DINE-IN',
      actionText: 'SCAN TO ORDER',
      actionBg: '#0A2315',
      actionColor: '#D4AF37',
      note: 'Scan with camera or WhatsApp • No app download'
    },
    receipt: {
      typeBadge: 'THERMAL KOT RECEIPT',
      badgeColor: '#10B981',
      line1: 'KOT 104 • Table 05',
      time: '10:42 AM',
      items: [
        { name: '1x Paneer Butter Masala (Full)', tag: 'HOT' },
        { name: '4x Butter Tandoori Roti', tag: 'CRISP' },
        { name: '1x Sweet Punjabi Lassi', tag: 'CHILLED' }
      ],
      specialNote: '* Note: Less spicy, extra butter on rotis',
      footer: '⚡ 0.5s ESC/POS Auto-Cut • Chef Kitchen Station'
    }
  },
  hotel: {
    id: 'hotel',
    tabIcon: '🏨',
    tabLabel: 'Hotel Guest Room',
    badgeText: 'IN-ROOM DINING & BUTLER READY',
    badgeColor: '#60A5FA',
    title: 'Luxury Bedside QR Tent Cards & Pantry Dispatch for Hotels',
    description: 'Provide 24x7 In-Room Dining, housekeeping requests, and butler calls directly from bedside QR tent cards without tying up front-desk telephone lines.',
    features: [
      {
        title: 'Luxury Bedside QR Tent Cards',
        desc: 'Portrait tent cards designed for bedside nightstands and work desks with unique room numbers auto-assigned.'
      },
      {
        title: '24x7 In-Room Dining & Amenities',
        desc: 'Guests order midnight meals, fresh towels, drinking water, or laundry pickup in 2 taps from their phone.'
      },
      {
        title: 'Kitchen & Pantry KDS Dispatch',
        desc: 'Room service orders dispatch instantly to the pantry team with room number, guest name, and delivery priority.'
      }
    ],
    standee: {
      themeClass: 'km-theme-hotel',
      headerIcon: Building2,
      badge: 'ROOM 302 TENT CARD',
      badgeColor: '#60A5FA',
      brand: 'Grand Palace Hotel & Resort',
      spaceLabel: 'ROOM 302 • DELUXE SUITE',
      actionText: 'IN-ROOM DINING',
      actionBg: '#1E3A8A',
      actionColor: '#93C5FD',
      note: 'In-Room Dining • Housekeeping • Butler'
    },
    receipt: {
      typeBadge: 'PANTRY DISPATCH TICKET',
      badgeColor: '#3B82F6',
      line1: 'ROOM SERVICE #2081 • Room 302',
      time: '11:15 PM',
      items: [
        { name: '2x Club Sandwich & Golden Fries', tag: 'FRESH' },
        { name: '2x Valencia Fresh Orange Juice', tag: 'CHILLED' },
        { name: '1x Warm Chocolate Brownie Sundae', tag: 'HOT' }
      ],
      specialNote: '🛎️ Guest Request: 2 extra towels & ice bucket',
      footer: '⚡ Dispatched to Floor 3 Butler • Room 302 Folio'
    }
  },
  cinema: {
    id: 'cinema',
    tabIcon: '🎬',
    tabLabel: 'Cinema Audi Seat',
    badgeText: 'CONCESSION & SEAT DELIVERY READY',
    badgeColor: '#F59E0B',
    title: 'Seat Armrest QR Stickers & 15-Min Rush Tickets for Multiplexes',
    description: 'Empower moviegoers to scan weatherproof armrest stickers and order popcorn, nachos, and cold drinks delivered directly to their cinema audi seat before intermission ends.',
    features: [
      {
        title: 'Weatherproof Armrest QR Stickers',
        desc: 'Compact, spill-proof peel-and-stick QR labels for cinema armrests with Audi, Row & Seat number encoded.'
      },
      {
        title: 'Beat the 15-Minute Intermission Rush',
        desc: 'Moviegoers order from their seat during the film without waiting in 50-person concession counter queues.'
      },
      {
        title: 'Concession Seat Runner Dispatch',
        desc: 'Concession staff print runner slips or view seat KDS showing exact Audi, Row, and Seat coordinates for rapid delivery.'
      }
    ],
    standee: {
      themeClass: 'km-theme-cinema',
      headerIcon: Film,
      badge: 'AUDI 2 • SEAT E-14',
      badgeColor: '#F59E0B',
      brand: 'Starview Multiplex Concessions',
      spaceLabel: 'AUDI 2 • ROW E • SEAT 14',
      actionText: 'DELIVER TO SEAT',
      actionBg: '#78350F',
      actionColor: '#FCD34D',
      note: 'Direct Seat Delivery • Skip Intermission Queue'
    },
    receipt: {
      typeBadge: 'SEAT RUNNER CONCESSION SLIP',
      badgeColor: '#F59E0B',
      line1: 'CONCESSION #3054 • Audi 2 / E-14',
      time: '08:35 PM',
      items: [
        { name: '1x Jumbo Cheese Popcorn Tub', tag: 'HOT' },
        { name: '2x Chilled Cold Coffee Bottle', tag: 'COLD' },
        { name: '1x Crispy Nachos with Salsa Dip', tag: 'CRISP' }
      ],
      specialNote: '🍿 Seat Rush: Intermission starts in 6 mins',
      footer: '⚡ Audi 2 Concession Runner #04 • Seat Delivery'
    }
  }
};

export default function StandeePreview({ selectedIndustry = 'restaurant', onSelectIndustry }) {
  const [activeVertical, setActiveVertical] = useState(selectedIndustry);

  useEffect(() => {
    if (selectedIndustry && VERTICAL_DATA[selectedIndustry]) {
      setActiveVertical(selectedIndustry);
    }
  }, [selectedIndustry]);

  const handleVerticalChange = (verticalKey) => {
    setActiveVertical(verticalKey);
    if (typeof onSelectIndustry === 'function') {
      onSelectIndustry(verticalKey);
    }
  };

  const current = VERTICAL_DATA[activeVertical] || VERTICAL_DATA.restaurant;
  const StandeeIcon = current.standee.headerIcon;

  return (
    <section id="standee-preview" className="km-standee-section">
      <div className="km-container">
        
        {/* Multi-Vertical Interactive Mode Switcher Tabs */}
        <div className="km-standee-tab-strip">
          <span className="km-standee-tab-strip-label">SELECT BUSINESS HARDWARE:</span>
          <div className="km-standee-tab-group">
            {Object.keys(VERTICAL_DATA).map((key) => {
              const v = VERTICAL_DATA[key];
              const isActive = activeVertical === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`km-standee-tab-btn ${isActive ? 'active' : ''} ${key}`}
                  onClick={() => handleVerticalChange(key)}
                  aria-pressed={isActive}
                >
                  <span className="km-standee-tab-icon">{v.tabIcon}</span>
                  <span className="km-standee-tab-text">{v.tabLabel}</span>
                  {isActive && <span className="km-standee-tab-indicator" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="km-standee-grid">
          {/* Left Text & Value Proposition */}
          <div className="km-standee-info-col">
            <div className="km-badge">
              <Sparkles size={14} color={current.badgeColor} />
              <span>{current.badgeText}</span>
            </div>
            <h2 className="km-title-lg">{current.title}</h2>
            <p className="km-subtitle">
              {current.description}
            </p>

            <div className="km-standee-features">
              {current.features.map((feat, idx) => (
                <div key={idx} className="km-standee-feat-item">
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong>{feat.title}</strong>
                    <span>{feat.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="km-standee-reassurance">
              <ShieldCheck size={16} color="#10B981" />
              <span>Includes 1-Click PDF Generation, QR Vector SVG, & ESC/POS Thermal Driver</span>
            </div>
          </div>

          {/* Right Visual Mockup Cards (Hardware & Standee Pair) */}
          <div className="km-standee-visual-box">
            
            {/* Mockup 1: Branded Acrylic Standee / Tent Card / Armrest Sticker */}
            <div className={`km-standee-card ${current.standee.themeClass}`}>
              <div className="km-standee-header">
                <StandeeIcon size={16} color={current.standee.badgeColor} />
                <span>{current.standee.badge}</span>
              </div>
              <div className="km-standee-qr-box">
                <div className="km-standee-qr-frame">
                  {/* High Precision SVG QR Graphic */}
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0A2315" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <path d="M14 14h3v3h-3z"></path>
                    <path d="M18 18h3v3h-3z"></path>
                    <path d="M14 18h.01"></path>
                    <path d="M18 14h.01"></path>
                  </svg>
                  <div 
                    className="km-standee-qr-badge"
                    style={{ background: current.standee.actionBg, color: current.standee.actionColor }}
                  >
                    {current.standee.actionText}
                  </div>
                </div>

                <div className="km-standee-brand-name">
                  {current.standee.brand}
                </div>

                <div className="km-standee-space-pill">
                  {current.standee.spaceLabel}
                </div>

                <span className="km-standee-subtext">
                  {current.standee.note}
                </span>
              </div>
            </div>

            {/* Mockup 2: Thermal KOT / Pantry Dispatch / Seat Runner Slip */}
            <div className="km-receipt-card">
              <div className="km-receipt-header">
                <Printer size={15} color={current.receipt.badgeColor} />
                <span style={{ color: current.receipt.badgeColor }}>{current.receipt.typeBadge}</span>
              </div>
              <div className="km-receipt-body">
                <div className="km-receipt-line">
                  <strong>{current.receipt.line1}</strong>
                  <span>{current.receipt.time}</span>
                </div>
                <div className="km-receipt-divider" />
                
                {current.receipt.items.map((it, idx) => (
                  <div key={idx} className="km-receipt-item">
                    <span>{it.name}</span>
                    <strong className="km-receipt-tag">{it.tag}</strong>
                  </div>
                ))}

                <div className="km-receipt-note">
                  {current.receipt.specialNote}
                </div>
                <div className="km-receipt-footer">
                  {current.receipt.footer}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
