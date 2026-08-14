import React from 'react';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

export default function Pricing({ publicPlans = [], trialDays = 16, onSelectPlan }) {
  const [showMoreMap, setShowMoreMap] = React.useState({});

  const toggleShowMore = (key) => {
    setShowMoreMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Default fallback plans if publicPlans API array is empty
  const defaultPlans = [
    {
      key: 'basic',
      name: 'Basic Starter Plan',
      price: '499',
      original_price: '999',
      badge: '⚡ BASIC',
      description: 'Ideal for small cafes and sweet shops starting digital menu QR codes.',
      features: [
        'Digital QR Menu & Custom Themes',
        'Unlimited Dishes & Categories',
        'Admin Dashboard & QR Generator',
        'Up to 3 Combo Deals',
        'Client-side Analytics'
      ],
      popular: false
    },
    {
      key: 'pro',
      name: 'Pro Luxury Plan',
      price: '999',
      original_price: '1999',
      badge: '👑 PRO CHOICE',
      description: 'Best for growing restaurants looking to boost Google reviews and WhatsApp orders.',
      features: [
        'Everything in Basic Plan',
        '⭐ Smart AI Google Reviews Booster',
        'WhatsApp Order Confirmations',
        'Up to 10 Combo Deals',
        'Priority 24/7 Phone & WhatsApp Support'
      ],
      popular: true
    },
    {
      key: 'enterprise',
      name: 'Enterprise VIP Plan',
      price: '1999',
      original_price: '3999',
      badge: '🚀 ENTERPRISE',
      description: 'Complete restaurant management with live KOT kitchen siren, floor map & thermal printing.',
      features: [
        'Everything in Pro Plan',
        '⚡ Direct Table QR Ordering System',
        '📋 Live Kitchen Siren & KOT Tickets',
        '🖨️ Thermal Printer KOT & Bills (USB/Bluetooth)',
        '🗺️ Hall Floor Table Map & Occupancy Grid',
        'Unlimited Thali & Combo Deals'
      ],
      popular: false
    }
  ];

  const plansToRender = publicPlans.length > 0 ? publicPlans.map(p => {
    const priceNum = Number(p.price) || 0;
    const origNum = p.original_price ? Number(p.original_price) : (priceNum > 0 ? priceNum * 2 - 1 : 0);
    const discountPct = (origNum > priceNum && origNum > 0) ? Math.round(((origNum - priceNum) / origNum) * 100) : 0;
    return {
      key: p.key,
      name: p.name,
      price: p.price,
      original_price: origNum > priceNum ? origNum : null,
      discountTag: discountPct > 0 ? `${discountPct}% OFF` : null,
      badge: p.badge || (p.key === 'pro' ? '👑 RECOMMENDED' : '⚡ SAAS PLAN'),
      description: p.description || 'Full-featured digital menu & ordering system for your restaurant.',
      features: [
        'Digital QR Menu & Themes',
        'Admin Dashboard & QR Generator',
        '⭐ Smart AI Google Reviews',
        ...(p.direct_ordering_enabled ? [
          '⚡ Direct Table QR KOT Ordering',
          '📋 Live Kitchen Siren System',
          '🖨️ Thermal Printing (USB/Bluetooth)',
          '🗺️ Dining Hall Table Floor Map'
        ] : []),
        `Up to ${p.max_combos > 100 ? 'Unlimited' : (p.max_combos || 10)} Combo Deals`
      ],
      popular: p.key === 'pro'
    };
  }) : defaultPlans;

  return (
    <section id="pricing" className="km-pricing-section">
      <div className="km-container">
        <div className="km-section-header">
          <div className="km-badge">
            <Sparkles size={14} color="#D4AF37" />
            <span>TRANSPARENT PRICING</span>
          </div>
          <h2 className="km-title-lg">Simple, Predictable Restaurant Pricing</h2>
          <p className="km-subtitle">
            Every plan includes a <strong>{trialDays}-Day Free Trial</strong>. No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="km-pricing-grid">
          {plansToRender.map((plan, index) => {
            const isExpanded = !!showMoreMap[plan.key];
            const visibleFeatures = isExpanded ? plan.features : plan.features.slice(0, 4);
            const hasMore = plan.features.length > 4;

            return (
              <div 
                key={index} 
                className={`km-price-card ${plan.popular ? 'featured' : ''}`}
              >
                {plan.popular && (
                  <div className="km-price-badge">MOST POPULAR CHOICE</div>
                )}

                <div>
                  <h3 className="km-plan-name">{plan.name}</h3>
                  <p className="km-plan-desc">{plan.description}</p>

                  <div className="km-plan-price-wrap">
                    {plan.original_price && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--km-muted)', textDecoration: 'line-through' }}>
                          ₹{plan.original_price}
                        </span>
                        {plan.discountTag && (
                          <span style={{ background: '#EF4444', color: '#FFF', fontSize: '0.68rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                            {plan.discountTag}
                          </span>
                        )}
                      </div>
                    )}

                    <span className="km-plan-price">₹{plan.price}</span>
                    <span className="km-plan-period">/month</span>
                  </div>

                  <ul className="km-plan-list">
                    {visibleFeatures.map((feat, fIdx) => (
                      <li key={fIdx} className="km-plan-item">
                        <Check size={16} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => toggleShowMore(plan.key)}
                      style={{
                        background: 'none', border: 'none', color: '#38BDF8', fontSize: '0.78rem',
                        fontWeight: 800, cursor: 'pointer', padding: '4px 0 16px 0', display: 'block'
                      }}
                    >
                      {isExpanded ? 'Hide Extra Features ↑' : `+ ${plan.features.length - 4} More Features ↓`}
                    </button>
                  )}
                </div>

                <button 
                  className={plan.popular ? 'km-btn-primary km-btn-gold' : 'km-btn-primary'}
                  onClick={() => onSelectPlan(plan.key)}
                  style={{ width: '100%' }}
                >
                  Start {trialDays}-Day Free Trial <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
