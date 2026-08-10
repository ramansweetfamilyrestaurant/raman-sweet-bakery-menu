import React from 'react';
import { Smartphone, Bell, TrendingUp, CheckCircle, Star, Printer, Layers } from 'lucide-react';

export default function ProductShowcase() {
  return (
    <div>
      {/* Showcase Section A: Table Ordering */}
      <section className="km-showcase-section">
        <div className="km-container">
          <div className="km-showcase-grid">
            <div>
              <div className="km-badge">
                <Smartphone size={14} color="#D4AF37" />
                <span>CUSTOMER QR DINE-IN</span>
              </div>
              <h2 className="km-title-lg">Turn Any Table Into a Digital Ordering Point</h2>
              <p className="km-subtitle">
                Eliminate physical menu degradation and ordering delays. Customers scan the table QR code, browse rich dish photos, select half/full portions, and place orders directly from their phone browser.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>0.3-Second Load Speed</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>No app download required. Instant high-speed menu rendering.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Multi-Portion Half & Full Pricing</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Tailored for Indian restaurant menus (Momos, Paneer, Chinese, Dal, Rice).</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--km-text)' }}>Dine-In Cart & Special Instructions</strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Add custom spice levels, less oil instructions, or waiter call requests.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Box A */}
            <div className="km-showcase-box">
              <div style={{ background: '#0F172A', borderRadius: '16px', padding: '20px', color: '#FFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#D4AF37' }}>Table #7 • Dine-In</div>
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

      {/* Showcase Section B: Real Time Kitchen KOT */}
      <section className="km-showcase-section dark">
        <div className="km-container">
          <div className="km-showcase-grid reverse">
            <div>
              <div className="km-badge km-badge-dark">
                <Bell size={14} color="#F59E0B" />
                <span>KITCHEN OPERATIONS</span>
              </div>
              <h2 className="km-title-lg">Run Your Kitchen in Real Time</h2>
              <p className="km-subtitle">
                Never miss an order. When a customer scans and places an order, your kitchen dashboard sounds an audio siren alarm, displays itemized tickets, and auto-prints KOT receipts.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#34D399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#FFF' }}>Instant Kitchen Alarm Siren</strong>
                    <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Loud notification sound alerts kitchen staff immediately on new orders.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#34D399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#FFF' }}>0.5s Thermal KOT & Customer Invoices</strong>
                    <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Supports Bluetooth & USB 2-inch/3-inch thermal receipt printers.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} color="#34D399" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: '#FFF' }}>Dining Hall Table Floor Map</strong>
                    <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Track occupied tables, available tables, and pending service requests in real time.</span>
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
                  <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>Table #3 • Veg Hakka Noodles x2, Veg Manchurian x1</div>
                </div>

                <div style={{ background: '#1E293B', padding: '14px', borderRadius: '12px', borderLeft: '4px solid #10B981', color: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#34D399' }}>✓ KOT Printed & Cooking</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>3 mins ago</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>Table #12 • Special Veg Thali x4</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section C: Revenue & Google Reviews Growth */}
      <section className="km-showcase-section">
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
                    <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Export CSV sales reports and track peak ordering hours.</span>
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
                  "How was your dining experience at Raman Sweet & Restaurant today?"
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
