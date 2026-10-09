import React from 'react';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

export default function Pricing({ publicPlans = [], trialDays = 16, onSelectPlan }) {
  const [showMoreMap, setShowMoreMap] = React.useState({});

  const toggleShowMore = (key) => {
    setShowMoreMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return val;
    return num.toLocaleString('en-IN');
  };

  // Default fallback plans if publicPlans API array is empty
  const defaultPlans = [
    {
      key: 'basic',
      name: 'Basic Starter Plan',
      price: 499,
      original_price: 999,
      discountTag: '50% OFF',
      badge: '⚡ BASIC',
      description: 'Ideal for small cafes, sweet shops & bakeries starting digital QR menus.',
      features: [
        'Digital QR Menu & Luxury Themes',
        'Unlimited Dishes & Categories',
        'Admin Dashboard & QR Standee Generator',
        '⭐ Smart Google Reviews Collector',
        'Up to 3 Combo Deals',
        'Multi-Language (English + Hindi)',
        'Client Analytics & Daily Insights'
      ],
      popular: false
    },
    {
      key: 'pro',
      name: 'Pro Luxury Plan',
      price: 999,
      original_price: 1999,
      discountTag: '50% OFF',
      badge: '👑 PRO CHOICE',
      description: 'Best for growing dine-in restaurants looking to boost orders and 5-star reviews.',
      features: [
        'Everything in Basic Plan',
        '⭐ Smart AI Google Reviews Booster',
        '📱 WhatsApp Order Confirmations',
        'Up to 10 Combo Deals',
        '🧾 GST Invoice & Tax Management',
        '🖨️ Bluetooth Thermal Printing KOT',
        'Priority 24/7 Phone & WhatsApp Support'
      ],
      popular: true
    },
    {
      key: 'enterprise',
      name: 'Enterprise VIP Plan',
      price: 1999,
      original_price: 3999,
      discountTag: '50% OFF',
      badge: '🚀 ENTERPRISE',
      description: 'Complete restaurant management with live KOT kitchen siren, floor map & thermal printing.',
      features: [
        'Everything in Pro Plan',
        '⚡ Direct Table QR Ordering System',
        '📋 Live Kitchen Siren & KOT Tickets',
        '📺 Live KDS Kitchen Display Screen',
        '🖨️ Dual Thermal Printers (Kitchen + Counter)',
        '🗺️ Hall Floor Table Map & Live Occupancy',
        'Unlimited Combos & Thali Deals',
        'Dedicated VIP 24/7 Account Manager'
      ],
      popular: false
    }
  ];

  const plansToRender = (publicPlans && publicPlans.length > 0) ? publicPlans.map(p => {
    const priceNum = Number(p.price) || 0;
    const origNum = p.original_price ? Number(p.original_price) : (priceNum > 0 ? Math.round(priceNum * 2) - 1 : 0);
    const discountPct = (origNum > priceNum && origNum > 0) ? Math.round(((origNum - priceNum) / origNum) * 100) : 0;
    
    // Build comprehensive, high-value feature list reflecting actual database capabilities
    const featuresList = [];

    // Core catalog & QR features
    featuresList.push('Digital QR Menu & Luxury Themes');
    featuresList.push(
      p.max_dishes && Number(p.max_dishes) < 1000 
        ? `Up to ${p.max_dishes} Dishes Catalog` 
        : 'Unlimited Dishes & Categories'
    );
    featuresList.push('Admin Dashboard & QR Standee Generator');

    // Reviews & AI
    if (p.ai_review_enabled || p.google_reviews_enabled) {
      featuresList.push('⭐ Smart AI Google Reviews Booster');
    }

    // Direct Table Ordering & Kitchen Siren
    if (p.direct_ordering_enabled) {
      featuresList.push('⚡ Direct Table QR KOT Ordering');
      featuresList.push('📋 Live Kitchen Siren & KOT Tickets');
    }

    // KDS
    if (p.kds_enabled) {
      featuresList.push('📺 Live KDS Kitchen Display Screen');
    }

    // Printers
    if (p.dual_printer_enabled) {
      featuresList.push('🖨️ Dual Thermal Printers (Kitchen + Counter)');
    } else if (p.bluetooth_kot_enabled) {
      featuresList.push('🖨️ Thermal Printing (USB/Bluetooth KOT)');
    }

    // WhatsApp
    if (p.whatsapp_enabled) {
      featuresList.push('📱 WhatsApp Order Confirmations');
    }

    // Floor Map
    if (p.direct_ordering_enabled) {
      featuresList.push('🗺️ Dining Hall Table Floor Map');
    }

    // GST
    if (p.gst_invoice_enabled) {
      featuresList.push('🧾 GST Invoice & Tax Management');
    }

    // Multi-Language
    if (p.multi_language_enabled) {
      featuresList.push('🌐 Multi-Language (English + Hindi)');
    }

    // Combos
    featuresList.push(
      p.max_combos && Number(p.max_combos) > 100 
        ? 'Unlimited Thali & Combo Deals' 
        : `Up to ${p.max_combos || 10} Combo Deals`
    );

    // Support
    featuresList.push(
      p.key === 'enterprise' 
        ? 'Dedicated VIP 24/7 Account Manager' 
        : 'Priority Phone & WhatsApp Support'
    );

    const isPopular = p.popular === true || p.popular === 1 || p.popular === '1' || p.key === 'pro';

    return {
      key: p.key,
      name: p.name,
      price: priceNum,
      original_price: origNum > priceNum ? origNum : null,
      discountTag: discountPct > 0 ? `${discountPct}% OFF` : null,
      badge: p.badge || (isPopular ? '👑 PRO CHOICE' : (p.key === 'enterprise' ? '🚀 ENTERPRISE' : '⚡ BASIC')),
      description: p.description || 'Full-featured digital menu & ordering system for your restaurant.',
      features: featuresList,
      popular: isPopular
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
            const visibleFeatures = isExpanded ? plan.features : plan.features.slice(0, 5);
            const hasMore = plan.features.length > 5;

            return (
              <div 
                key={plan.key || `plan-${index}`} 
                className={`km-price-card ${plan.popular ? 'featured' : ''}`}
              >
                {plan.badge && (
                  <div className="km-price-badge">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <h3 className="km-plan-name">{plan.name}</h3>
                  <p className="km-plan-desc">{plan.description}</p>

                  <div className="km-plan-price-wrap">
                    {plan.original_price && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--km-muted)', textDecoration: 'line-through' }}>
                          ₹{formatCurrency(plan.original_price)}
                        </span>
                        {plan.discountTag && (
                          <span style={{ background: '#EF4444', color: '#FFF', fontSize: '0.68rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                            {plan.discountTag}
                          </span>
                        )}
                      </div>
                    )}

                    <span className="km-plan-price">₹{formatCurrency(plan.price)}</span>
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
                      {isExpanded ? 'Hide Extra Features ↑' : `+ ${plan.features.length - 5} More Features ↓`}
                    </button>
                  )}
                </div>

                <button 
                  className={plan.popular ? 'km-btn-primary km-btn-gold' : 'km-btn-primary'}
                  onClick={() => onSelectPlan?.(plan.key)}
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
