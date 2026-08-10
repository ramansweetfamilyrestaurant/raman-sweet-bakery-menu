import React from 'react';
import { ArrowRight, QrCode, UserCheck, UtensilsCrossed, ChefHat, Store } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Create Your Restaurant',
      desc: 'Sign up in 60 seconds. Set your restaurant name, logo, address, and total table count.'
    },
    {
      num: '02',
      title: 'Customize Your Digital Menu',
      desc: 'Add categories, dishes, prices, half/full options, and upload mouthwatering photos.'
    },
    {
      num: '03',
      title: 'Start Receiving Orders',
      desc: 'Print your table QR codes. Customers scan, order, and KOT rings live in your kitchen!'
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
            Get your restaurant digital and receiving table orders in under 3 minutes.
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
            <QrCode size={18} color="#D4AF37" /> QR Menu Scan
          </div>
          <ArrowRight size={16} color="#64748B" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={18} color="#10B981" /> Customer Order
          </div>
          <ArrowRight size={16} color="#64748B" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ChefHat size={18} color="#F59E0B" /> Kitchen KOT Siren
          </div>
          <ArrowRight size={16} color="#64748B" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Store size={18} color="#6366F1" /> Served & Printed
          </div>
        </div>
      </div>
    </section>
  );
}
