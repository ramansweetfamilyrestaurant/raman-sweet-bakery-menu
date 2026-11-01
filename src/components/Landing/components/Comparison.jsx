import React, { useState, useEffect } from 'react';
import { Crown, Zap, Rocket, Utensils, Building, Film } from 'lucide-react';

export default function Comparison({ selectedIndustry: propIndustry, setSelectedIndustry: propSetIndustry }) {
  const [internalIndustry, setInternalIndustry] = useState('restaurant');
  const selectedIndustry = propIndustry || internalIndustry;
  const setSelectedIndustry = propSetIndustry || setInternalIndustry;

  const [activeMobileTab, setActiveMobileTab] = useState('pro');

  useEffect(() => {
    if (selectedIndustry === 'hotel') {
      setActiveMobileTab('hotel_pro');
    } else if (selectedIndustry === 'cinema') {
      setActiveMobileTab('cinema_pro');
    } else {
      setActiveMobileTab('pro');
    }
  }, [selectedIndustry]);

  const industryData = {
    restaurant: {
      planTabs: [
        { key: 'basic', label: 'Basic', price: '₹499', icon: <Zap size={14} />, badge: '⚡ BASIC' },
        { key: 'pro', label: 'Pro', price: '₹999', icon: <Crown size={14} />, badge: '👑 PRO CHOICE', popular: true },
        { key: 'enterprise', label: 'Enterprise', price: '₹1,999', icon: <Rocket size={14} />, badge: '🚀 ENTERPRISE' }
      ],
      rows: [
        { feature: 'Dining Tables Capacity', basic: 'Up to 20 Tables', pro: 'Up to 100 Tables', enterprise: 'Unlimited Tables' },
        { feature: 'Digital QR Menus, Catalogs & Luxury Themes', basic: true, pro: true, enterprise: true },
        { feature: 'Menu Items & Categories Limit', basic: 'Up to 50 Items', pro: 'Unlimited', enterprise: 'Unlimited' },
        { feature: 'Smart AI Google Reviews Booster', basic: false, pro: true, enterprise: true },
        { feature: 'WhatsApp Order Confirmations', basic: false, pro: true, enterprise: true },
        { feature: 'Direct Customer Table QR Ordering', basic: false, pro: false, enterprise: true },
        { feature: 'Live Kitchen Siren & KOT Tickets', basic: false, pro: false, enterprise: true },
        { feature: 'Thermal Printer Invoicing', basic: false, pro: 'Single KOT', enterprise: 'Dual KOT (Kitchen+Counter)' },
        { feature: 'Table Floor Map & Occupancy Layout', basic: false, pro: false, enterprise: true },
        { feature: 'Staff Call Bell System', basic: false, pro: false, enterprise: true },
        { feature: '5% GST Invoicing & Tax Management', basic: false, pro: true, enterprise: true },
        { feature: 'Thali & Combo Deals Limit', basic: 'Up to 3', pro: 'Up to 10', enterprise: 'Unlimited' },
        { feature: 'Dedicated VIP 24/7 Account Manager', basic: false, pro: false, enterprise: true }
      ]
    },
    hotel: {
      planTabs: [
        { key: 'hotel_basic', label: 'Hotel Basic', price: '₹999', icon: <Zap size={14} />, badge: '🏨 BASIC' },
        { key: 'hotel_pro', label: 'Hotel Pro', price: '₹1,999', icon: <Crown size={14} />, badge: '👑 MOST POPULAR', popular: true },
        { key: 'hotel_enterprise', label: 'Resort Suite', price: '₹3,499', icon: <Rocket size={14} />, badge: '🏰 RESORT VIP' }
      ],
      rows: [
        { feature: 'Guest Rooms Capacity', basic: 'Up to 20 Rooms', pro: 'Up to 60 Rooms', enterprise: 'Unlimited Rooms & Villas' },
        { feature: 'In-Room Digital QR Directory & Services', basic: true, pro: true, enterprise: true },
        { feature: 'Menu & Amenities Items Limit', basic: 'Up to 50 Items', pro: 'Unlimited', enterprise: 'Unlimited' },
        { feature: 'Direct In-Room Food & Drink Ordering', basic: false, pro: true, enterprise: true },
        { feature: 'Room Service Call & Butler System', basic: false, pro: true, enterprise: true },
        { feature: 'Hotel Room Bill & Folio Invoicing', basic: false, pro: true, enterprise: true },
        { feature: 'TripAdvisor & Google AI Reviews Booster', basic: false, pro: true, enterprise: true },
        { feature: 'Multi-Language International Guests', basic: true, pro: true, enterprise: true },
        { feature: 'Live Kitchen & Service KDS Screen', basic: false, pro: false, enterprise: true },
        { feature: 'Thermal Printer Routing', basic: false, pro: 'Single Room KOT', enterprise: 'Dual (Front Desk + Kitchen)' },
        { feature: 'Multi-Floor & Room Map Layout', basic: false, pro: false, enterprise: true },
        { feature: 'WhatsApp Guest Order Updates', basic: false, pro: true, enterprise: true },
        { feature: 'Dedicated VIP Hospitality Manager', basic: false, pro: false, enterprise: true }
      ]
    },
    cinema: {
      planTabs: [
        { key: 'cinema_basic', label: 'Cinema Basic', price: '₹1,499', icon: <Zap size={14} />, badge: '🎬 BASIC' },
        { key: 'cinema_pro', label: 'Cinema Pro', price: '₹2,999', icon: <Crown size={14} />, badge: '👑 MULTIPLEX CHOICE', popular: true },
        { key: 'cinema_enterprise', label: 'Multiplex Suite', price: '₹4,999', icon: <Rocket size={14} />, badge: '🌟 MULTIPLEX VIP' }
      ],
      rows: [
        { feature: 'Audi Screens & Seats Capacity', basic: '1 Screen (200 Seats)', pro: 'Up to 3 Screens (800 Seats)', enterprise: 'Unlimited Screens & Seats' },
        { feature: 'Concessions & Canteen Digital QR Menu', basic: true, pro: true, enterprise: true },
        { feature: 'Snacks & Popcorn Catalog Limit', basic: 'Up to 30 Items', pro: 'Unlimited', enterprise: 'Unlimited' },
        { feature: 'In-Seat Direct Delivery (Row + Seat QR)', basic: false, pro: true, enterprise: true },
        { feature: 'Live Concessions KDS Display Screen', basic: false, pro: true, enterprise: true },
        { feature: 'Interval Rush Fast Checkout Mode', basic: false, pro: true, enterprise: true },
        { feature: 'Dual Dispatch Printers (Kitchen + Runner)', basic: false, pro: false, enterprise: true },
        { feature: 'Interactive Audi & Row Seat Layout Matrix', basic: false, pro: false, enterprise: true },
        { feature: 'WhatsApp Order Ticket & Seat Updates', basic: false, pro: true, enterprise: true },
        { feature: 'GST F&B Invoicing & Tax Bills', basic: false, pro: true, enterprise: true },
        { feature: 'Popcorn & Beverage Combos', basic: 'Up to 5', pro: 'Up to 20', enterprise: 'Unlimited' },
        { feature: 'Dedicated Multiplex Operations Manager', basic: false, pro: false, enterprise: true }
      ]
    }
  };

  const currentData = industryData[selectedIndustry] || industryData.restaurant;
  const { planTabs, rows: comparisonRows } = currentData;

  const handleSelectPlanCTA = (planKey) => {
    window.history.pushState({}, '', `/register?plan=${planKey}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const getRowValueForTab = (row, tabKey) => {
    if (tabKey === planTabs[0].key) return row.basic;
    if (tabKey === planTabs[1].key) return row.pro;
    return row.enterprise;
  };

  return (
    <section className="km-comparison-section">
      <div className="km-container">
        <div className="km-section-header" style={{ marginBottom: '20px' }}>
          <h2 className="km-title-lg" style={{ fontSize: '1.8rem' }}>Compare Plan Features</h2>
          <p className="km-subtitle" style={{ marginBottom: '16px' }}>
            Choose the perfect tier for your business’s operational scale.
          </p>

          {/* Industry Vertical Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', margin: '0 auto' }}>
            {[
              { id: 'restaurant', label: '🍽️ Restaurant & Cafe', icon: <Utensils size={14} /> },
              { id: 'hotel', label: '🏨 Hotel & Resort', icon: <Building size={14} /> },
              { id: 'cinema', label: '🎬 Cinema & Multiplex', icon: <Film size={14} /> }
            ].map(tab => {
              const isActive = selectedIndustry === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedIndustry(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '24px',
                    border: isActive ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isActive ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    color: isActive ? '#D4AF37' : 'var(--km-muted, #94A3B8)',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
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
                    {activePlan.label}
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--km-green)' }}>{activePlan.price}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--km-muted)' }}>/month</div>
                </div>
              </div>

              <div className="km-mobile-feature-list">
                {comparisonRows.map((row, idx) => {
                  const val = getRowValueForTab(row, activePlan.key);
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
                <th style={{ width: '37%' }}>Feature</th>
                <th style={{ width: '21%', textAlign: 'center' }}>
                  {planTabs[0].label} ({planTabs[0].price})
                </th>
                <th style={{ width: '21%', textAlign: 'center', color: '#D4AF37' }}>
                  {planTabs[1].label} ({planTabs[1].price}) ★
                </th>
                <th style={{ width: '21%', textAlign: 'center' }}>
                  {planTabs[2].label} ({planTabs[2].price})
                </th>
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
