import React from 'react';

export default function TrustStats({ trialDays = 17 }) {
  return (
    <section className="km-trust-section">
      <div className="km-container">
        <div className="km-trust-grid">
          <div className="km-trust-item">
            <div className="km-trust-val">10,000+</div>
            <div className="km-trust-lbl">QR Menus Created</div>
          </div>
          <div className="km-trust-item">
            <div className="km-trust-val" style={{ color: '#F59E0B' }}>⭐ 4.9 / 5</div>
            <div className="km-trust-lbl">Customer Rating</div>
          </div>
          <div className="km-trust-item">
            <div className="km-trust-val" style={{ color: '#10B981' }}>0.3 SEC</div>
            <div className="km-trust-lbl">QR Menu Load Speed</div>
          </div>
          <div className="km-trust-item">
            <div className="km-trust-val" style={{ color: '#6366F1' }}>{trialDays} DAYS</div>
            <div className="km-trust-lbl">Zero-Risk Free Trial</div>
          </div>
        </div>
      </div>
    </section>
  );
}
