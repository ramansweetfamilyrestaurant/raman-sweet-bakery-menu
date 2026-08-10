import React from 'react';
import { ArrowRight, CheckCircle2, Play, Sparkles, Smartphone, ShieldCheck, Printer, Bell, Star } from 'lucide-react';

export default function Hero({ trialDays = 17, onStartTrial, onLiveDemo }) {
  return (
    <section className="km-hero-section">
      <div className="km-container">
        <div className="km-hero-grid">
          
          {/* Left Column: Headline & Action */}
          <div className="km-hero-content">
            <div className="km-badge">
              <Sparkles size={14} color="#D4AF37" />
              <span>INDIAN RESTAURANTS & CAFES #1 DIGITAL SAAS</span>
            </div>

            <h1 className="km-title-lg">
              Your Restaurant.<br />
              <span style={{ 
                background: 'linear-gradient(135deg, #0A2315 0%, #10B981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>One Smart Digital System.</span>
            </h1>

            <p className="km-subtitle">
              Digital Menu, QR Ordering, Live Kitchen KOT, Smart Google Reviews, and Restaurant Management — all in one simple platform.
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
                <span>✓</span> Cancel Anytime
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Product Preview Composition */}
          <div className="km-hero-preview">
            <div className="km-mockup-window">
              <div className="km-mockup-header">
                <div className="km-mockup-dots">
                  <div className="km-mockup-dot red" />
                  <div className="km-mockup-dot yellow" />
                  <div className="km-mockup-dot green" />
                </div>
                <span className="km-mockup-title">KhanaMaster Restaurant Operations Hub</span>
              </div>

              <div className="km-mockup-body">
                {/* Admin POS Dashboard Card */}
                <div className="km-preview-card">
                  <div className="km-preview-header">
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94A3B8' }}>LIVE KITCHEN KOT</span>
                    <span className="km-preview-badge">⚡ ACTIVE</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ background: '#0F172A', padding: '10px', borderRadius: '10px', color: '#F59E0B' }}>
                      <Bell size={20} className="pulse" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#FFF' }}>Table #4 • Order #1042</div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Paneer Butter Masala (Full) x1, Naan x3</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.72rem', color: '#CBD5E1' }}>
                      <Printer size={12} style={{ display: 'inline', marginRight: '4px' }} /> Thermal Printed
                    </div>
                    <div style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.72rem', color: '#34D399', fontWeight: 800 }}>
                      KOT Sent to Chef
                    </div>
                  </div>
                </div>

                {/* Customer Smartphone QR Menu Preview */}
                <div className="km-preview-card" style={{ background: '#0F172A', border: '1px solid #D4AF37' }}>
                  <div className="km-preview-header">
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D4AF37' }}>CUSTOMER QR VIEW</span>
                    <Smartphone size={14} color="#D4AF37" />
                  </div>

                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#FFF' }}>Raman Sweet & Restaurant</div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', margin: '2px 0 8px 0' }}>⚡ Scan to Order • Table #4</div>
                    
                    <div style={{ background: '#1E293B', borderRadius: '8px', padding: '8px', textAlign: 'left', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FFF' }}>Butter Paneer Thali</div>
                      <div style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 900 }}>₹240 • 🌟 Bestseller</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.7rem', color: '#F59E0B', fontWeight: 800 }}>
                      <Star size={12} fill="#F59E0B" /> 4.9 Smart Review Prompter Active
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
