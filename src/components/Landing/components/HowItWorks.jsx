import React from 'react';
import { ArrowRight, QrCode, UserCheck, UtensilsCrossed, ChefHat, Store } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Create Your Business Profile',
      desc: 'Sign up in 60 seconds. Choose your venue type: Restaurant, Hotel, Cinema, Bakery, or Cafe, and set up your spaces.'
    },
    {
      num: '02',
      title: 'Customize Your Digital Catalog',
      desc: 'Add categories, items, prices (Full/Half, By Weight, or Combos), and upload mouthwatering photos.'
    },
    {
      num: '03',
      title: 'Place QRs & Start Receiving Orders',
      desc: 'Print QR standees for your tables, rooms, seats, or counters. Customers scan, order, and live alerts ring instantly!'
    }
  ];

  return (
    <section id="how-it-works" className="km-workflow-section">
      <div className="km-container">
        <div className="km-section-header">
          <div className="km-badge">
            <span>🚀 3-STEP SETUP</span>
          </div>
          <h2 className="km-title-lg">How TouchQR Works</h2>
          <p className="km-subtitle">
            Get your business 100% digital and receiving QR orders in under 3 minutes.
          </p>
        </div>

        <div className="km-workflow-grid">
          {steps.map((step, idx) => (
            <div key={idx} className="km-workflow-step">
              <div className="km-step-num">{step.num}</div>
              <div style={{ flex: 1 }}>
                <h3 className="km-step-title">{step.title}</h3>
                <p className="km-step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Compact Visual Flow Diagram */}
        <div style={{
          marginTop: '48px',
          background: 'var(--km-bg)',
          borderRadius: 'var(--km-radius-md)',
          padding: '20px 16px',
          border: '1px solid var(--km-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '0.86rem',
          fontWeight: 800,
          color: 'var(--km-text)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <QrCode size={18} color="#D4AF37" /> 1. QR Code Scan
          </div>
          <ArrowRight size={16} color="#64748B" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={18} color="#10B981" /> 2. Order (Table / Room / Seat / Counter)
          </div>
          <ArrowRight size={16} color="#64748B" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ChefHat size={18} color="#F59E0B" /> 3. Live Alert & Dispatch
          </div>
          <ArrowRight size={16} color="#64748B" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Store size={18} color="#6366F1" /> 4. Served & Invoiced
          </div>
        </div>
      </div>
    </section>
  );
}
