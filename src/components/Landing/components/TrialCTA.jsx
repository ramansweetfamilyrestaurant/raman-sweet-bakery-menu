import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function TrialCTA({ trialDays = 16, onStartTrial }) {
  return (
    <section className="km-container">
      <div className="km-trial-cta-section">
        <div className="km-badge km-badge-dark" style={{ margin: '0 auto 16px auto' }}>
          <Sparkles size={14} color="#F59E0B" />
          <span>ZERO-RISK 17-DAY TRIAL</span>
        </div>

        <h2 className="km-title-lg" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
          Ready to Take Your Restaurant Digital?
        </h2>

        <p className="km-subtitle">
          Start your {trialDays}-day free trial and set up your restaurant digital menu & QR codes in under 60 seconds.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <button 
            className="km-btn-primary km-btn-gold" 
            onClick={onStartTrial}
            style={{ padding: '16px 36px', fontSize: '1.05rem' }}
          >
            Start {trialDays}-Day Free Trial <ArrowRight size={18} />
          </button>
        </div>

        <div style={{ 
          display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', 
          fontSize: '0.84rem', color: '#CBD5E1', fontWeight: 700 
        }}>
          <span>✓ No Credit Card Required</span>
          <span>✓ Instant 60-Sec Setup</span>
          <span>✓ Cancel Anytime</span>
        </div>
      </div>
    </section>
  );
}
