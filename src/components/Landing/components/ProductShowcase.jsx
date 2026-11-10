import React, { useState, useEffect } from 'react';
import { Smartphone, Bell, TrendingUp, CheckCircle, Star, Building2, Film, Utensils, Clock, Check } from 'lucide-react';

export default function ProductShowcase({ selectedIndustry = 'restaurant', onSelectIndustry }) {
  const [activeTab, setActiveTab] = useState('qr');
  const [serviceSubMode, setServiceSubMode] = useState('hotel');

  useEffect(() => {
    if (selectedIndustry === 'hotel') {
      setActiveTab('hotel_cinema');
      setServiceSubMode('hotel');
    } else if (selectedIndustry === 'cinema') {
      setActiveTab('hotel_cinema');
      setServiceSubMode('cinema');
    } else if (selectedIndustry === 'restaurant') {
      setActiveTab('qr');
    }
  }, [selectedIndustry]);

  return (
    <div id="showcase" className="km-showcase-wrapper">
      {/* Showcase Mobile & Desktop Tab Switcher */}
      <div className="km-showcase-tabs-container">
        <button
          type="button"
          className={`km-showcase-tab ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          <Smartphone size={16} />
          <span>Dine-In & Counter</span>
        </button>

        <button
          type="button"
          className={`km-showcase-tab ${activeTab === 'hotel_cinema' ? 'active' : ''}`}
          onClick={() => setActiveTab('hotel_cinema')}
        >
          <Building2 size={16} />
          <span>Hotels & Cinemas</span>
        </button>

        <button
          type="button"
          className={`km-showcase-tab ${activeTab === 'kot' ? 'active' : ''}`}
          onClick={() => setActiveTab('kot')}
        >
          <Bell size={16} />
          <span>Live Dispatch</span>
        </button>

        <button
          type="button"
          className={`km-showcase-tab ${activeTab === 'growth' ? 'active' : ''}`}
          onClick={() => setActiveTab('growth')}
        >
          <TrendingUp size={16} />
          <span>Growth & Reviews</span>
        </button>
      </div>

      {/* Showcase Section A: Table & Counter Ordering */}
      <section className={`km-showcase-section ${activeTab === 'qr' ? 'tab-active' : 'tab-hidden-mobile'}`}>
        <div className="km-container">
          <div className="km-showcase-grid">
            <div>
              <div className="km-badge">
                <Smartphone size={14} color="#D4AF37" />
                <span>CUSTOMER QR ORDERING</span>
              </div>
              <h2 className="km-title-lg">Turn Any Table or Counter Into a Digital Point of Sale</h2>
              <p className="km-subtitle">
                Eliminate physical menu degradation and ordering delays. Customers scan the QR code on tables or counters, browse rich item photos, select half/full or weight portions, and order directly from their phone browser.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>0.3-Second Load Speed</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>No app download required. Instant high-speed catalog rendering.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Flexible Pricing (Portion & Weight)</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Full/Half portions for restaurants, or 250g/500g/1kg for sweet shops and bakeries.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Dine-In Cart & Special Instructions</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Add custom preparation notes, special instructions, or staff assistance requests.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Box A */}
            <div className="km-showcase-box">
              <div style={{ background: '#0F172A', borderRadius: '16px', padding: '20px', color: '#FFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#D4AF37' }}>Table 7 • Dine-In</div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Customer Order Cart</div>
                  </div>
                  <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34D399', fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '50px' }}>
                    READY TO PLACE
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                    <span>Kadhai Paneer (Full) x1</span>
                    <strong style={{ color: '#D4AF37' }}>₹280</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                    <span>Butter Naan x4</span>
                    <strong style={{ color: '#D4AF37' }}>₹160</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Total Amount</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFF' }}>₹440</div>
                  </div>
                  <button className="km-btn-gold" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
                    Place Order Now →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section A2: Hotel Room Service & Cinema Seat Ordering */}
      <section className={`km-showcase-section ${activeTab === 'hotel_cinema' ? 'tab-active' : 'tab-hidden-mobile'}`} style={{ background: '#F8FAFC' }}>
        <div className="km-container">
          <div className="km-showcase-grid reverse">
            <div>
              <div className="km-badge">
                <Building2 size={14} color="#3B82F6" />
                <span>HOTELS, RESORTS & CINEMAS</span>
              </div>
              <h2 className="km-title-lg">Room Service & Seat Concessions Made Frictionless</h2>
              <p className="km-subtitle">
                Hotel guests scan room QR standees for 24x7 In-Room Dining without dialing reception. Moviegoers scan seat QRs for hot snacks delivered directly to their cinema audi seat before intermission ends.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Hotel In-Room Dining & Amenities</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Each room receives a custom branded QR linked directly to their room number for dining & housekeeping.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Cinema Screen & Audi Seat Delivery</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Orders automatically encode Audi number, Row, and Seat number for rapid runner delivery.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Zero Phone Calls & Digital Billing</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Eliminate front-desk telephone bottlenecks with room folio charge or instant UPI payment.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Box A2: Interactive Hotel & Cinema Preview */}
            <div className="km-showcase-box">
              <div style={{ background: '#0F172A', borderRadius: '16px', padding: '20px', color: '#FFF', border: '1px solid rgba(255,255,255,0.08)' }}>
                
                {/* Sub-toggle: Hotel vs Cinema */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.06)', padding: '4px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setServiceSubMode('hotel')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: 'none',
                      background: serviceSubMode === 'hotel' ? '#2563EB' : 'transparent',
                      color: serviceSubMode === 'hotel' ? '#FFF' : '#94A3B8',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Building2 size={14} />
                    <span>Hotel Room 408</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceSubMode('cinema')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: 'none',
                      background: serviceSubMode === 'cinema' ? '#D97706' : 'transparent',
                      color: serviceSubMode === 'cinema' ? '#FFF' : '#94A3B8',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Film size={14} />
                    <span>Cinema Audi 3 • D-12</span>
                  </button>
                </div>

                {serviceSubMode === 'hotel' ? (
                  /* Hotel Room Service Mockup */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#60A5FA' }}>Room 408 • Grand Luxury Suite</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>24x7 In-Room Dining & Butler Call</div>
                      </div>
                      <span style={{ background: 'rgba(96,165,250,0.2)', color: '#60A5FA', fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '50px' }}>
                        DISPATCHED
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                        <span>Grilled Chicken Club Sandwich x2</span>
                        <strong style={{ color: '#60A5FA' }}>₹520</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                        <span>Fresh Watermelon Juice x2</span>
                        <strong style={{ color: '#60A5FA' }}>₹240</strong>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.78rem', color: '#93C5FD', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bell size={15} style={{ flexShrink: 0 }} />
                      <span><strong>Butler Request:</strong> 2 extra bath towels & morning call at 7:30 AM</span>
                    </div>
                  </div>
                ) : (
                  /* Cinema Seat Concession Mockup */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#F59E0B' }}>Audi 3 • Row D • Seat 12</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Concession Seat Delivery Express</div>
                      </div>
                      <span style={{ background: 'rgba(245,158,11,0.2)', color: '#FCD34D', fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '50px' }}>
                        RUNNER ON THE WAY
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                        <span>Jumbo Caramel Popcorn Tub x1</span>
                        <strong style={{ color: '#F59E0B' }}>₹290</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                        <span>Chilled Iced Americano x2</span>
                        <strong style={{ color: '#F59E0B' }}>₹220</strong>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.78rem', color: '#FDE68A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={15} style={{ flexShrink: 0 }} />
                      <span><strong>Intermission Rush Timer:</strong> 08:42 Remaining • Delivered to Seat D-12</span>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section B: Real Time Kitchen KOT & Multi-Industry Dispatch */}
      <section className={`km-showcase-section dark ${activeTab === 'kot' ? 'tab-active' : 'tab-hidden-mobile'}`}>
        <div className="km-container">
          <div className="km-showcase-grid reverse">
            <div>
              <div className="km-badge km-badge-dark">
                <Bell size={14} color="#F59E0B" />
                <span>KITCHEN & DISPATCH OPERATIONS</span>
              </div>
              <h2 className="km-title-lg">Run Kitchens, Pantries & Runners in Real Time</h2>
              <p className="km-subtitle">
                Never miss an order. When a customer or guest scans and places an order, your staff dashboard sounds an audio siren alarm, displays itemized tickets, and auto-prints KOT receipts.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#34D399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#FFF' }}>Instant Siren Sound Alert</strong>
                    <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Loud notification sound alerts kitchen or dispatch staff immediately on new orders.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#34D399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#FFF' }}>0.5s Thermal KOT & Customer Invoices</strong>
                    <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Supports Bluetooth & USB 2-inch/3-inch thermal receipt printers for kitchens and billing counters.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#34D399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#FFF' }}>Live Floor Map, Rooms & Audi Matrix</strong>
                    <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Track dining tables, occupied hotel rooms, or cinema seats and pending service requests in real time.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Box B */}
            <div className="km-showcase-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#1E293B', padding: '14px', borderRadius: '12px', borderLeft: '4px solid #F59E0B', color: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#F59E0B' }}>🛎️ NEW ORDER SIREN ringing...</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Just now</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>Table 3 • Veg Hakka Noodles x2, Veg Manchurian x1</div>
                </div>

                <div style={{ background: '#1E293B', padding: '14px', borderRadius: '12px', borderLeft: '4px solid #3B82F6', color: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#60A5FA' }}>🏨 Hotel Pantry Dispatch</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>1 min ago</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>Room 302 • Club Sandwich x2, Fresh Orange Juice x2 • Priority</div>
                </div>

                <div style={{ background: '#1E293B', padding: '14px', borderRadius: '12px', borderLeft: '4px solid #10B981', color: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#34D399' }}>✓ KOT Printed & Cooking</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>3 mins ago</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>Table 12 • Special Veg Thali x4</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section C: Revenue & Google Reviews Growth */}
      <section className={`km-showcase-section ${activeTab === 'growth' ? 'tab-active' : 'tab-hidden-mobile'}`}>
        <div className="km-container">
          <div className="km-showcase-grid">
            <div>
              <div className="km-badge">
                <TrendingUp size={14} color="#D4AF37" />
                <span>GROWTH & REVENUE</span>
              </div>
              <h2 className="km-title-lg">Grow Your Restaurant Revenue & Google Rating</h2>
              <p className="km-subtitle">
                Automate customer engagement, collect 5-star Google Maps reviews, analyze top-selling menu items, and send order updates via WhatsApp.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Smart AI Google Reviews Booster</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Prompt satisfied customers to leave 5-star Google Map reviews automatically.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Daily & Monthly Sales Analytics</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Export CSV sales reports and track peak ordering hours across tables, rooms, and screens.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Box C */}
            <div className="km-showcase-box">
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Star size={20} fill="#F59E0B" color="#F59E0B" />
                  <strong style={{ fontSize: '1rem', color: '#0F172A' }}>Smart Google Review Prompter</strong>
                </div>

                <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '16px' }}>
                  "How was your dining experience at Royal Spice Family Restaurant today?"
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} style={{ fontSize: '1.5rem', color: '#F59E0B', cursor: 'pointer' }}>★</span>
                  ))}
                </div>

                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px', fontSize: '0.78rem', color: '#065F46', textAlign: 'center', fontWeight: 700 }}>
                  🎉 5-Star Rating Detected! Customer redirected to your Google Maps review page.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
