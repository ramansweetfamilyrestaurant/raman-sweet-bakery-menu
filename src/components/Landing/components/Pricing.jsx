import React from 'react';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

export default function Pricing({ publicPlans = [], trialDays = 16, selectedIndustry: propIndustry, setSelectedIndustry: propSetIndustry, onSelectPlan }) {
  const [localIndustry, setLocalIndustry] = React.useState('restaurant'); // 'restaurant' | 'hotel' | 'cinema'
  const selectedIndustry = propIndustry || localIndustry;
  const setSelectedIndustry = propSetIndustry || setLocalIndustry;
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
    // Restaurant / Cafe
    {
      key: 'basic',
      industry: 'restaurant',
      name: 'Basic Starter Plan',
      price: 499,
      original_price: 999,
      discountTag: '50% OFF',
      badge: '⚡ BASIC',
      description: 'Ideal for small cafes, sweet shops & bakeries starting digital QR menus.',
      features: [
        'Digital QR Menu & Luxury Themes',
        'Capacity: Up to 20 Dining Tables',
        'Admin Dashboard & QR Standee Generator',
        '⭐ Smart Google Reviews Collector',
        'Up to 3 Combo Deals',
        'Multi-Language (English + Hindi)'
      ],
      popular: false
    },
    {
      key: 'pro',
      industry: 'restaurant',
      name: 'Pro Luxury Plan',
      price: 999,
      original_price: 1999,
      discountTag: '50% OFF',
      badge: '👑 PRO CHOICE',
      description: 'Best for growing restaurants, cafes & diners looking to boost orders.',
      features: [
        'Everything in Basic Plan',
        'Capacity: Up to 100 Dining Tables',
        '⭐ Smart AI Google Reviews Booster',
        '📱 WhatsApp Order Confirmations',
        '🧾 5% GST Invoicing & Tax Bills',
        '🖨️ Thermal Printing KOT (USB/Bluetooth)'
      ],
      popular: true
    },
    {
      key: 'enterprise',
      industry: 'restaurant',
      name: 'Enterprise VIP Plan',
      price: 1999,
      original_price: 3999,
      discountTag: '50% OFF',
      badge: '🚀 ENTERPRISE',
      description: 'Multi-outlet restaurant operations with live kitchen display, direct table QR ordering & sirens.',
      features: [
        'Everything in Pro Plan',
        'Capacity: Unlimited Dining Tables',
        '⚡ Direct Customer Table QR Ordering',
        '📺 Live Kitchen Display Screen (KDS)',
        '🖨️ Dual Thermal Printers (Kitchen + Counter)',
        '🗺️ Live Interactive Table Floor Layout'
      ],
      popular: false
    },
    // Hotel & Resort
    {
      key: 'hotel_basic',
      industry: 'hotel',
      name: 'Hotel Basic (Room Directory)',
      price: 999,
      original_price: 1999,
      discountTag: '50% OFF',
      badge: '🏨 BASIC',
      description: 'In-Room digital menu viewing & hotel amenity service showcase.',
      features: [
        'In-Room Digital QR Menu & Directory',
        'Capacity: Up to 20 Guest Rooms',
        'Hotel Amenities & Room Service Info',
        'Multi-Language Guest Support',
        '⭐ TripAdvisor / Google Reviews Booster'
      ],
      popular: false
    },
    {
      key: 'hotel_pro',
      industry: 'hotel',
      name: 'Hotel Pro (In-Room QR Dining)',
      price: 1999,
      original_price: 3499,
      discountTag: '43% OFF',
      badge: '👑 MOST POPULAR',
      description: 'Direct in-room guest ordering with room billing & kitchen dispatch.',
      features: [
        'Everything in Hotel Basic',
        'Capacity: Up to 60 Guest Rooms',
        '⚡ Direct In-Room Guest Food Ordering',
        '🛎️ Room Service Call & Butler Requests',
        '🧾 GST Hotel Room Bill Invoicing',
        '🖨️ Kitchen & Service Thermal Printing'
      ],
      popular: true
    },
    {
      key: 'hotel_enterprise',
      industry: 'hotel',
      name: 'Hotel Enterprise (Resort & Multiplex)',
      price: 3499,
      original_price: 6999,
      discountTag: '50% OFF',
      badge: '🏰 RESORT SUITE',
      description: 'Full luxury hotel, resort, poolside & multi-restaurant suite.',
      features: [
        'Everything in Hotel Pro',
        'Capacity: Unlimited Guest Rooms & Villas',
        '🗺️ Multi-Building & Floor Layout Map',
        '📺 Kitchen Display System (KDS)',
        '🖨️ Multi-Department Printer Routing',
        'Dedicated 24/7 VIP Hospitality Manager'
      ],
      popular: false
    },
    // Cinema & Multiplex
    {
      key: 'cinema_basic',
      industry: 'cinema',
      name: 'Cinema Basic (Digital Canteen)',
      price: 1499,
      original_price: 2499,
      discountTag: '40% OFF',
      badge: '🎬 BASIC',
      description: 'Fast digital concessions counter QR menu for theatres.',
      features: [
        'Concessions & Canteen QR Menu',
        'Capacity: 1 Audi Screen · Up to 200 Seats',
        'Snacks, Popcorn & Beverages Showcase',
        'Fast Counter Pickup QR Code',
        'Daily Concessions Sales Reports'
      ],
      popular: false
    },
    {
      key: 'cinema_pro',
      industry: 'cinema',
      name: 'Cinema Pro (In-Seat Ordering)',
      price: 2999,
      original_price: 4999,
      discountTag: '40% OFF',
      badge: '👑 MULTIPLEX CHOICE',
      description: 'Direct in-seat delivery ordering with audi & row seat mapping.',
      features: [
        'Everything in Cinema Basic',
        'Capacity: Up to 3 Audi Screens · 800 Seats',
        '⚡ In-Seat Direct Delivery Ordering (Row + Seat QR)',
        '📺 Live Kitchen / Concessions KDS Display',
        '🖨️ Rapid Thermal KOT Receipt Printing',
        'Interval / Intermission Rush Management'
      ],
      popular: true
    },
    {
      key: 'cinema_enterprise',
      industry: 'cinema',
      name: 'Cinema Enterprise (Multiplex Chain)',
      price: 4999,
      original_price: 8999,
      discountTag: '44% OFF',
      badge: '🌟 MULTIPLEX SUITE',
      description: 'Unlimited auditoriums, concession stands, and VIP recliner dining.',
      features: [
        'Everything in Cinema Pro',
        'Capacity: Unlimited Screens & Seats',
        '🗺️ Interactive Audi & Seat Layout Matrix',
        '⚡ VIP Luxury Lounge & Recliner Service',
        '🖨️ Multi-Counter Dispatch Printer Network',
        '24/7 Dedicated Cinema Operations Support'
      ],
      popular: false
    }
  ];

  const rawCatalog = (publicPlans && publicPlans.length > 0) ? publicPlans : defaultPlans;
  const filteredCatalog = rawCatalog.filter(p => {
    const ind = (p.industry || 'restaurant').toLowerCase();
    const key = (p.key || '').toLowerCase();
    return ind === selectedIndustry || key.startsWith(selectedIndustry);
  });
  const fallbackVerticalPlans = defaultPlans.filter(p => (p.industry || 'restaurant') === selectedIndustry || p.key.startsWith(selectedIndustry));
  const plansForDisplay = filteredCatalog.length > 0 ? filteredCatalog : (fallbackVerticalPlans.length > 0 ? fallbackVerticalPlans : defaultPlans.filter(p => ['basic', 'pro', 'enterprise'].includes(p.key)));

  const plansToRender = plansForDisplay.map(p => {
    const priceNum = Number(p.price) || 0;
    const origNum = p.original_price ? Number(p.original_price) : (priceNum > 0 ? Math.round(priceNum * 2) - 1 : 0);
    const discountPct = (origNum > priceNum && origNum > 0) ? Math.round(((origNum - priceNum) / origNum) * 100) : 0;
    
    const ind = (p.industry || selectedIndustry || 'restaurant').toLowerCase();
    const isHotel = ind === 'hotel' || (p.key && p.key.startsWith('hotel_'));
    const isCinema = ind === 'cinema' || (p.key && p.key.startsWith('cinema_'));
    const isRestaurant = !isHotel && !isCinema;

    const isPopular = p.popular === true || p.popular === 1 || p.popular === '1' || 
      p.key === 'pro' || p.key === 'hotel_pro' || p.key === 'cinema_pro';

    // If explicit features array is provided on the plan (from database or default), use it
    let featuresList = [];
    if (Array.isArray(p.features) && p.features.length > 0) {
      featuresList = [...p.features];
    } else {
      // Build comprehensive, vertical-tailored feature list reflecting actual database capabilities
      if (isHotel) {
        if (p.max_rooms && Number(p.max_rooms) < 999) {
          featuresList.push(`🏨 Capacity: Up to ${p.max_rooms} Guest Rooms`);
        } else {
          featuresList.push('🏨 Capacity: Unlimited Guest Rooms & Suites');
        }
        featuresList.push('In-Room Digital QR Directory & Room Service Menu');
        featuresList.push(
          p.max_dishes && Number(p.max_dishes) < 1000 
            ? `Up to ${p.max_dishes} Menu & Amenity Items` 
            : 'Unlimited Menu Items & Amenities Catalog'
        );
        if (p.direct_ordering_enabled) {
          featuresList.push('⚡ In-Room Guest QR Ordering & Room Delivery');
          featuresList.push('🛎️ Room Service Call & Butler Notification');
          featuresList.push('🗺️ Room, Suite & Floor Layout Manager');
        }
        if (p.ai_review_enabled || p.google_reviews_enabled) {
          featuresList.push('⭐ TripAdvisor & Google Reviews AI Booster');
        }
        if (p.kds_enabled) {
          featuresList.push('📺 Kitchen & Room Service Live KDS Screen');
        }
        if (p.dual_printer_enabled) {
          featuresList.push('🖨️ Dual Routing Printers (Kitchen + Front Desk)');
        } else if (p.bluetooth_kot_enabled) {
          featuresList.push('🖨️ Thermal Printing (USB/Bluetooth Room KOT)');
        }
        if (p.whatsapp_enabled) {
          featuresList.push('📱 WhatsApp Guest Room Order Confirmations');
        }
        if (p.multi_language_enabled) {
          featuresList.push('🌐 Multi-Language International Guest Support');
        }
        if (p.gst_invoice_enabled) {
          featuresList.push('🧾 Hotel Room Bill GST & Tax Folio Invoicing');
        }
        featuresList.push(
          p.key === 'hotel_enterprise' || p.key?.includes('enterprise')
            ? 'Dedicated VIP 24/7 Hospitality Account Manager' 
            : 'Priority Phone & WhatsApp Support'
        );
      } else if (isCinema) {
        if (p.max_screens && Number(p.max_screens) < 99) {
          featuresList.push(`🎬 Capacity: ${p.max_screens} Audi Screen${Number(p.max_screens) > 1 ? 's' : ''} · Up to ${p.max_seats || '800'} Seats`);
        } else {
          featuresList.push('🎬 Capacity: Unlimited Screens & Multiplex Auditoriums');
        }
        featuresList.push('Concessions, Popcorn & Canteen Digital QR Menu');
        featuresList.push(
          p.max_dishes && Number(p.max_dishes) < 1000 
            ? `Up to ${p.max_dishes} F&B Items Catalog` 
            : 'Unlimited Concessions Items Catalog'
        );
        if (p.direct_ordering_enabled) {
          featuresList.push('⚡ In-Seat Direct Delivery (Audi, Row & Seat QR)');
          featuresList.push('🍿 Interval & Intermission Rush Fast Dispatch');
          featuresList.push('🗺️ Interactive Audi & Row Seat Layout Matrix');
        }
        if (p.kds_enabled) {
          featuresList.push('📺 Live Concessions KDS Display Screen');
        }
        if (p.dual_printer_enabled) {
          featuresList.push('🖨️ Dual Fast Dispatch Printers (Kitchen + Runner)');
        } else if (p.bluetooth_kot_enabled) {
          featuresList.push('🖨️ Rapid Thermal KOT Receipt Printing');
        }
        if (p.whatsapp_enabled) {
          featuresList.push('📱 WhatsApp Order Ticket & Seat Updates');
        }
        if (p.gst_invoice_enabled) {
          featuresList.push('🧾 GST F&B Invoicing & Tax Bills');
        }
        featuresList.push(
          `🍿 Popcorn & Beverage Combos (${p.max_combos && Number(p.max_combos) > 50 ? 'Unlimited' : `Up to ${p.max_combos || 10}`})`
        );
        featuresList.push(
          p.key === 'cinema_enterprise' || p.key?.includes('enterprise')
            ? 'Dedicated VIP 24/7 Multiplex Operations Support' 
            : 'Priority Phone & WhatsApp Support'
        );
      } else {
        if (p.max_tables && Number(p.max_tables) < 999) {
          featuresList.push(`🍽️ Capacity: Up to ${p.max_tables} Dine-In Tables`);
        } else {
          featuresList.push('🍽️ Capacity: Unlimited Dining Tables');
        }
        featuresList.push('Digital QR Menus, Catalogs & Luxury Themes');
        featuresList.push(
          p.max_dishes && Number(p.max_dishes) < 1000 
            ? `Up to ${p.max_dishes} Items Catalog` 
            : 'Unlimited Items & Categories'
        );
        featuresList.push('Admin Dashboard & QR Standee Generator');
        if (p.ai_review_enabled || p.google_reviews_enabled) {
          featuresList.push('⭐ Smart AI Google Reviews Booster');
        }
        if (p.direct_ordering_enabled) {
          featuresList.push('⚡ Direct Customer Table QR Ordering');
          featuresList.push('📋 Live Dispatch Siren & Order Tickets');
          featuresList.push('🗺️ Live Interactive Table Floor Layout');
        }
        if (p.kds_enabled) {
          featuresList.push('📺 Live Kitchen Display Screen (KDS)');
        }
        if (p.dual_printer_enabled) {
          featuresList.push('🖨️ Dual Thermal Printers (Kitchen + Counter)');
        } else if (p.bluetooth_kot_enabled) {
          featuresList.push('🖨️ Thermal Printing (USB/Bluetooth KOT)');
        }
        if (p.whatsapp_enabled) {
          featuresList.push('📱 WhatsApp Order Confirmations');
        }
        if (p.gst_invoice_enabled) {
          featuresList.push('🧾 GST Invoice & Tax Management');
        }
        if (p.multi_language_enabled) {
          featuresList.push('🌐 Multi-Language (English + Hindi)');
        }
        featuresList.push(
          p.max_combos && Number(p.max_combos) > 100 
            ? 'Unlimited Thali & Combo Deals' 
            : `Up to ${p.max_combos || 10} Combo Deals`
        );
        featuresList.push(
          p.key === 'enterprise' || p.key?.includes('enterprise')
            ? 'Dedicated VIP 24/7 Account Manager' 
            : 'Priority Phone & WhatsApp Support'
        );
      }
    }

    let defaultBadge = '⚡ BASIC';
    if (isPopular) {
      defaultBadge = isHotel ? '👑 MOST POPULAR' : (isCinema ? '👑 MULTIPLEX CHOICE' : '👑 PRO CHOICE');
    } else if (p.key?.includes('enterprise')) {
      defaultBadge = isHotel ? '🏰 RESORT SUITE' : (isCinema ? '🌟 MULTIPLEX SUITE' : '🚀 ENTERPRISE');
    } else {
      defaultBadge = isHotel ? '🏨 BASIC STARTER' : (isCinema ? '🎬 BASIC STARTER' : '⚡ BASIC');
    }

    let defaultDesc = 'Full-featured digital QR menu & instant ordering system.';
    if (isHotel) {
      defaultDesc = p.key?.includes('enterprise')
        ? 'Full luxury hotel, resort, poolside & multi-restaurant suite.'
        : (isPopular ? 'Direct in-room guest ordering with room billing & kitchen dispatch.' : 'In-Room digital menu viewing & hotel amenity service showcase.');
    } else if (isCinema) {
      defaultDesc = p.key?.includes('enterprise')
        ? 'Unlimited auditoriums, concession stands, and VIP recliner dining.'
        : (isPopular ? 'Direct in-seat delivery ordering with audi & row seat mapping.' : 'Fast digital concessions counter QR menu for theatres.');
    } else {
      defaultDesc = p.key?.includes('enterprise')
        ? 'Multi-outlet restaurant operations with live kitchen display, direct table QR ordering & sirens.'
        : (isPopular ? 'Best for growing restaurants, cafes & diners looking to boost orders.' : 'Ideal for small cafes, sweet shops & bakeries starting digital QR menus.');
    }

    return {
      key: p.key,
      name: p.name,
      price: priceNum,
      original_price: origNum > priceNum ? origNum : null,
      discountTag: discountPct > 0 ? `${discountPct}% OFF` : null,
      badge: p.badge || defaultBadge,
      description: p.description || defaultDesc,
      features: featuresList,
      popular: isPopular
    };
  });

  return (
    <section id="pricing" className="km-pricing-section">
      <div className="km-container">
        <div className="km-section-header">
          <div className="km-badge">
            <Sparkles size={14} color="#D4AF37" />
            <span>TRANSPARENT PRICING</span>
          </div>
          <h2 className="km-title-lg">Simple, Industry-Tailored Pricing</h2>
          <p className="km-subtitle">
            Every plan includes a <strong>{trialDays}-Day Free Trial</strong>. No credit card required. Cancel anytime.
          </p>

          {/* Industry Vertical Selector Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
            {[
              { id: 'restaurant', label: '🍽️ Restaurants & Cafes', desc: 'Dine-In, Bakeries & QSR' },
              { id: 'hotel', label: '🏨 Hotels & Resorts', desc: 'In-Room Guest QR Dining' },
              { id: 'cinema', label: '🎬 Cinemas & Theatres', desc: 'In-Seat Multiplex Ordering' }
            ].map(tab => {
              const isTabActive = selectedIndustry === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedIndustry(tab.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 22px',
                    borderRadius: '16px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    border: isTabActive ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.12)',
                    background: isTabActive ? 'rgba(212, 175, 55, 0.16)' : 'rgba(255,255,255,0.04)',
                    color: isTabActive ? '#FFD700' : '#E2E8F0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isTabActive ? '0 4px 16px rgba(212, 175, 55, 0.2)' : 'none'
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{ fontSize: '0.70rem', color: isTabActive ? '#DFBA67' : '#94A3B8', fontWeight: 600, marginTop: '2px' }}>
                    {tab.desc}
                  </span>
                </button>
              );
            })}
          </div>
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
