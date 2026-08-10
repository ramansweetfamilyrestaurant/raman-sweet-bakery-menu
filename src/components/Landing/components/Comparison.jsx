import React, { useState } from 'react';
import { Check, X, Crown, Zap, Rocket } from 'lucide-react';

export default function Comparison() {
  const [activeMobileTab, setActiveMobileTab] = useState('pro');

  const comparisonRows = [
    { feature: 'Digital QR Menu & Themes', basic: true, pro: true, enterprise: true },
    { feature: 'Unlimited Dishes & Categories', basic: true, pro: true, enterprise: true },
    { feature: 'Smart AI Google Reviews Booster', basic: false, pro: true, enterprise: true },
    { feature: 'WhatsApp Order Confirmations', basic: false, pro: true, enterprise: true },
    { feature: 'Live Kitchen Siren & KOT Tickets', basic: false, pro: false, enterprise: true },
    { feature: 'Thermal Printer Billing (USB/Bluetooth)', basic: false, pro: false, enterprise: true },
    { feature: 'Dining Hall Floor Map & Grid', basic: false, pro: false, enterprise: true },
    { feature: 'Waiter Call Bell System', basic: false, pro: false, enterprise: true },
    { feature: 'Combo Deals Limit', basic: 'Up to 3', pro: 'Up to 10', enterprise: 'Unlimited' }
  ];

  const planTabs = [
    { key: 'basic', label: 'Basic', price: '₹499', icon: <Zap size={14} />, badge: '⚡ BASIC' },
    { key: 'pro', label: 'Pro', price: '₹999', icon: <Crown size={14} />, badge: '👑 PRO CHOICE', popular: true },
    { key: 'enterprise', label: 'Enterprise', price: '₹1,999', icon: <Rocket size={14} />, badge: '🚀 ENTERPRISE' }
  ];

  const handleSelectPlanCTA = (planKey) => {
    window.history.pushState({}, '', `/register?plan=${planKey}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <section className="km-comparison-section">
      <div className="km-container">
        <div className="km-section-header" style={{ marginBottom: '24px' }}>
          <h2 className="km-title-lg" style={{ fontSize: '1.8rem' }}>Compare Plan Features</h2>
          <p className="km-subtitle" style={{ marginBottom: 0 }}>
            Choose the perfect tier for your restaurant’s operational scale.
          </p>
        </div>

        {/* 📱 Mobile Plan Comparison Tab Selector (< 768px) */}
        <div className="km-mobile-comparison-container">
          <div className="km-mobile-plan-tabs">
            {planTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`km-mobile-tab-btn ${activeMobileTab === tab.key ? 'active' : ''} ${tab.popular ? 'popular' : ''}`}
                onClick={() => setActiveMobileTab(tab.key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
                <div className="km-tab-price">{tab.price}</div>
              </button>
            ))}
          </div>

          {/* Active Mobile Plan Feature Card */}
          {planTabs.filter(t => t.key === activeMobileTab).map((activePlan) => (
            <div key={activePlan.key} className={`km-mobile-comparison-card ${activePlan.popular ? 'featured' : ''}`}>
              <div className="km-mobile-card-header">
                <div>
                  <span className="km-mobile-card-badge">{activePlan.badge}</span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--km-text)', margin: '4px 0 0 0' }}>
                    {activePlan.label} Plan
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--km-green)' }}>{activePlan.price}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--km-muted)' }}>/month</div>
                </div>
              </div>

              <div className="km-mobile-feature-list">
                {comparisonRows.map((row, idx) => {
                  const val = row[activePlan.key];
                  const isIncluded = typeof val === 'boolean' ? val : true;
                  return (
                    <div key={idx} className={`km-mobile-feature-row ${isIncluded ? 'included' : 'excluded'}`}>
                      <div className="km-mobile-feat-name">{row.feature}</div>
                      <div className="km-mobile-feat-status">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <span className="km-status-tag check">✓ Included</span>
                          ) : (
                            <span className="km-status-tag dash">— Not in {activePlan.label}</span>
                          )
                        ) : (
                          <span className="km-status-tag val">{val}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className={activePlan.popular ? 'km-btn-primary km-btn-gold' : 'km-btn-primary'}
                onClick={() => handleSelectPlanCTA(activePlan.key)}
                style={{ width: '100%', marginTop: '16px', height: '48px', fontWeight: 900 }}
              >
                Select {activePlan.label} ({activePlan.price}) →
              </button>
            </div>
          ))}
        </div>

        {/* 💻 Desktop Comparison Table (>= 768px) */}
        <div className="km-desktop-table-wrapper">
          <table className="km-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Feature</th>
                <th style={{ width: '20%', textAlign: 'center' }}>Basic (₹499)</th>
                <th style={{ width: '20%', textAlign: 'center', color: '#D4AF37' }}>Pro (₹999) ★</th>
                <th style={{ width: '20%', textAlign: 'center' }}>Enterprise (₹1,999)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: 'var(--km-text)' }}>{row.feature}</td>
                  
                  <td style={{ textAlign: 'center' }}>
                    {typeof row.basic === 'boolean' ? (
                      row.basic ? <span className="km-table-check">✓</span> : <span style={{ color: '#94A3B8' }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 700, color: 'var(--km-text)' }}>{row.basic}</span>
                    )}
                  </td>

                  <td style={{ textAlign: 'center', background: 'rgba(212,175,55,0.04)' }}>
                    {typeof row.pro === 'boolean' ? (
                      row.pro ? <span className="km-table-check" style={{ color: '#D4AF37' }}>✓</span> : <span style={{ color: '#94A3B8' }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 800, color: 'var(--km-green)' }}>{row.pro}</span>
                    )}
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    {typeof row.enterprise === 'boolean' ? (
                      row.enterprise ? <span className="km-table-check">✓</span> : <span style={{ color: '#94A3B8' }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 800, color: 'var(--km-green)' }}>{row.enterprise}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
