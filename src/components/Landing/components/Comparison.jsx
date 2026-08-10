import React from 'react';

export default function Comparison() {
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

  return (
    <section className="km-comparison-section">
      <div className="km-container">
        <div className="km-section-header" style={{ marginBottom: '36px' }}>
          <h2 className="km-title-lg" style={{ fontSize: '1.8rem' }}>Compare Plan Features</h2>
          <p className="km-subtitle" style={{ marginBottom: 0 }}>
            Choose the perfect tier for your restaurant’s operational scale.
          </p>
        </div>

        <div className="km-table-wrapper">
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
