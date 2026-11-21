import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  ShoppingBag,
  CreditCard,
  QrCode,
  DollarSign,
  ArrowRight,
  RefreshCw,
  X,
  Sparkles,
  ChevronRight,
  User,
  Phone,
  ChefHat,
  UtensilsCrossed,
  Receipt
} from 'lucide-react';
import QRCode from 'qrcode';
import { createAdminPosOrder } from '../../../api/client';
import { buildUpiPaymentUri, calculateBillDetails } from '../../../utils/billingHelper';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function PosBillingView({
  dishes = [],
  categories = [],
  combos = [],
  restaurantInfo = {},
  settingsForm = {},
  token,
  currencySymbol = '₹',
  onPrintBill,
  onPrintKot,
  onOrderCreated,
  onNavigateToOrders
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dietFilter, setDietFilter] = useState('all'); // 'all' | 'veg' | 'nonveg'
  const [cart, setCart] = useState([]); // [{ dish, quantity, selectedVariant: 'full' | 'half' }]
  const [orderType, setOrderType] = useState('takeaway'); // 'takeaway' | 'dine_in'
  const [tableNumber, setTableNumber] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi' | 'card'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null); // { order, token_display }
  const [upiQrDataUrl, setUpiQrDataUrl] = useState(null);

  const searchInputRef = useRef(null);

  // Total tables list
  const totalTables = Math.max(1, Number(settingsForm?.total_tables ?? restaurantInfo?.total_tables ?? 20));
  const tablesList = useMemo(() => Array.from({ length: totalTables }, (_, i) => String(i + 1)), [totalTables]);

  // Keyboard shortcut: Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter dishes
  const filteredDishes = useMemo(() => {
    return (Array.isArray(dishes) ? dishes : []).filter(dish => {
      if (!dish || dish.is_active === 0 || dish.available === 0 || dish.available === false) {
        // Still allow admin to add unavailable items if they want, but prioritize available
      }
      if (selectedCategory !== 'all' && String(dish.category_id) !== String(selectedCategory)) {
        return false;
      }
      if (dietFilter === 'veg' && dish.food_type !== 'veg' && dish.food_type !== 'pure_veg') {
        return false;
      }
      if (dietFilter === 'nonveg' && dish.food_type !== 'non_veg' && dish.food_type !== 'nonveg') {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const nameMatch = (dish.name || '').toLowerCase().includes(q);
        const descMatch = (dish.description || '').toLowerCase().includes(q);
        return nameMatch || descMatch;
      }
      return true;
    });
  }, [dishes, selectedCategory, dietFilter, search]);

  // Cart operations
  const addToCart = (dish, variant = 'full') => {
    setCart(prev => {
      const price = variant === 'half' && dish.price_half ? Number(dish.price_half) : Number(dish.price);
      const existingIdx = prev.findIndex(item => item.dish.id === dish.id && item.selectedVariant === variant);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + 1
        };
        return next;
      }
      return [
        ...prev,
        {
          dish,
          quantity: 1,
          selectedVariant: variant,
          price
        }
      ];
    });
  };

  const updateQuantity = (dishId, variant, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.dish.id === dishId && item.selectedVariant === variant) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (dishId, variant) => {
    setCart(prev => prev.filter(item => !(item.dish.id === dishId && item.selectedVariant === variant)));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setUpiQrDataUrl(null);
  };

  // Cart Totals calculation
  const subtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  }, [cart]);

  const isGstEnabled = Boolean(
    restaurantInfo?.gst_enabled === 1 || 
    restaurantInfo?.gst_enabled === true || 
    restaurantInfo?.gst_enabled === '1' ||
    settingsForm?.gst_enabled === 1 || 
    settingsForm?.gst_enabled === true || 
    settingsForm?.gst_enabled === '1'
  );

  const taxAmount = isGstEnabled ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  // Generate Dynamic UPI QR when payment method is UPI
  useEffect(() => {
    if (paymentMethod !== 'upi' || grandTotal <= 0) {
      setUpiQrDataUrl(null);
      return;
    }

    const upiId = restaurantInfo?.upi_id || settingsForm?.upi_id;
    const payeeName = restaurantInfo?.upi_payee_name || settingsForm?.upi_payee_name || restaurantInfo?.name || settingsForm?.name;
    if (!upiId) return;

    const uri = buildUpiPaymentUri({
      upiId,
      payeeName,
      amount: grandTotal,
      invoiceId: `POS_${Date.now().toString().slice(-4)}`,
      spaceLabel: orderType === 'takeaway' ? 'Counter' : `Table ${tableNumber}`
    });

    if (uri) {
      QRCode.toDataURL(uri, {
        width: 180,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      }).then(url => setUpiQrDataUrl(url)).catch(() => {});
    }
  }, [paymentMethod, grandTotal, restaurantInfo, settingsForm, orderType, tableNumber]);

  // Handle Order Submit (Receive Payment & Print)
  const handleSubmitOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const itemsPayload = cart.map(it => ({
        dish_id: it.dish.id,
        name: it.selectedVariant === 'half' ? `${it.dish.name} (Half)` : it.dish.name,
        price: it.price,
        quantity: it.quantity,
        variant: it.selectedVariant
      }));

      const payload = {
        items: itemsPayload,
        order_type: orderType,
        table_number: orderType === 'takeaway' ? 'Counter' : tableNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_method: paymentMethod
      };

      const result = await createAdminPosOrder(token, payload);
      if (result && result.order) {
        const orderData = result.order;
        setSuccessOrder({
          order: orderData,
          token_display: result.token_display || orderData.token_display
        });

        // Auto Print Bill
        if (onPrintBill) {
          try {
            onPrintBill(orderData, paymentMethod.toUpperCase());
          } catch (pErr) {
            console.warn('Auto print bill notice:', pErr);
          }
        }

        // Auto Print KOT
        if (onPrintKot) {
          try {
            onPrintKot(orderData);
          } catch (kErr) {
            console.warn('Auto print KOT notice:', kErr);
          }
        }

        // Notify parent state
        if (onOrderCreated) {
          onOrderCreated(orderData);
        }

        // Reset cart
        clearCart();
      }
    } catch (err) {
      alert(`Error creating order: ${err.message || 'Please check network and try again'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      width: '100%',
      minHeight: 'calc(100vh - 120px)',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .pos-grid-container {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 18px;
          align-items: start;
        }
        .pos-dishes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        @media (max-width: 1024px) {
          .pos-grid-container {
            grid-template-columns: 1fr 340px;
          }
        }
        @media (max-width: 850px) {
          .pos-grid-container {
            grid-template-columns: 1fr;
          }
          .pos-cart-panel {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 50 !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            border-radius: 20px 20px 0 0 !important;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.15) !important;
          }
        }
        .pos-dish-card {
          transition: all 0.15s ease;
        }
        .pos-dish-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
      `}</style>

      {/* ========================================================
          1. HEADER & CONTROLS
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <Receipt size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Counter Quick POS
              </h1>
              <span style={{
                background: '#ECFDF5',
                color: '#059669',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '8px',
                border: '1px solid #A7F3D0'
              }}>
                ⚡ FAST BILLING
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Direct counter orders, instant takeaway tokens, and thermal printing.
            </p>
          </div>
        </div>

        {/* Quick Order Console Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onNavigateToOrders}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShoppingBag size={15} />
            <span>View Live Orders</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          2. MAIN POS WORKSPACE: DISHES (LEFT) + BILLING (RIGHT)
         ======================================================== */}
      <div className="pos-grid-container">
        
        {/* LEFT COLUMN: FILTERS & DISH GRID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Search & Diet Toggle Bar */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search dishes or sweets... (Press Ctrl+K)"
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.84rem',
                  outline: 'none',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  boxSizing: 'border-box'
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: 0
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Diet Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setDietFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: dietFilter === 'all' ? '#0F172A' : '#E2E8F0',
                  background: dietFilter === 'all' ? '#0F172A' : '#FFFFFF',
                  color: dietFilter === 'all' ? '#FFFFFF' : '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                onClick={() => setDietFilter('veg')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: dietFilter === 'veg' ? '#16A34A' : '#E2E8F0',
                  background: dietFilter === 'veg' ? '#DCFCE7' : '#FFFFFF',
                  color: '#15803D',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🟢 Pure Veg
              </button>
              <button
                onClick={() => setDietFilter('nonveg')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: dietFilter === 'nonveg' ? '#DC2626' : '#E2E8F0',
                  background: dietFilter === 'nonveg' ? '#FEE2E2' : '#FFFFFF',
                  color: '#B91C1C',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔴 Non-Veg
              </button>
            </div>
          </div>

          {/* Category Filter Horizontal Scroll */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px'
          }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: selectedCategory === 'all' ? '#059669' : '#CBD5E1',
                background: selectedCategory === 'all' ? '#059669' : '#FFFFFF',
                color: selectedCategory === 'all' ? '#FFFFFF' : '#334155',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              All Categories ({dishes.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: selectedCategory === cat.id ? '#059669' : '#CBD5E1',
                  background: selectedCategory === cat.id ? '#059669' : '#FFFFFF',
                  color: selectedCategory === cat.id ? '#FFFFFF' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Dishes Grid */}
          <div className="pos-dishes-grid">
            {filteredDishes.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '40px 20px',
                textAlign: 'center',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                color: '#64748B'
              }}>
                <UtensilsCrossed size={32} color="#94A3B8" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.90rem' }}>No matching dishes found</p>
                <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>Try searching another keyword or select All Categories</span>
              </div>
            ) : (
              filteredDishes.map(dish => {
                const fullItemInCart = cart.find(it => it.dish.id === dish.id && it.selectedVariant === 'full');
                const halfItemInCart = cart.find(it => it.dish.id === dish.id && it.selectedVariant === 'half');
                const hasHalfPrice = Boolean(dish.price_half && Number(dish.price_half) > 0);
                const hasImage = Boolean(dish.image);

                return (
                  <div
                    key={dish.id}
                    className="pos-dish-card"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div>
                      {/* Top: Veg indicator + Image/Placeholder */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          border: `1.5px solid ${dish.food_type === 'non_veg' || dish.food_type === 'nonveg' ? '#DC2626' : '#16A34A'}`,
                          padding: '2px'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: dish.food_type === 'non_veg' || dish.food_type === 'nonveg' ? '#DC2626' : '#16A34A'
                          }} />
                        </span>
                        {dish.available === 0 && (
                          <span style={{ fontSize: '0.62rem', background: '#FEE2E2', color: '#B91C1C', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                            Low Stock
                          </span>
                        )}
                      </div>

                      {/* Image Preview if available */}
                      {hasImage && (
                        <div style={{
                          width: '100%',
                          height: '85px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          marginBottom: '8px',
                          background: '#F1F5F9'
                        }}>
                          <img
                            src={resolveImageUrl(dish.image)}
                            alt={dish.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      )}

                      {/* Title */}
                      <strong style={{
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        color: '#0F172A',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.25,
                        marginBottom: '6px'
                      }}>
                        {dish.name}
                      </strong>
                    </div>

                    {/* Price & Action Buttons */}
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                      {hasHalfPrice ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Half Portion Option */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                              Half: <strong>{currencySymbol}{dish.price_half}</strong>
                            </span>
                            {halfItemInCart ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  onClick={() => updateQuantity(dish.id, 'half', -1)}
                                  style={{ width: '22px', height: '22px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Minus size={11} />
                                </button>
                                <span style={{ fontSize: '0.76rem', fontWeight: 800, minWidth: '14px', textAlign: 'center' }}>{halfItemInCart.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(dish.id, 'half', 1)}
                                  style={{ width: '22px', height: '22px', borderRadius: '6px', border: 'none', background: '#059669', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(dish, 'half')}
                                style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                + Half
                              </button>
                            )}
                          </div>

                          {/* Full Portion Option */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                              Full: <strong>{currencySymbol}{dish.price}</strong>
                            </span>
                            {fullItemInCart ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  onClick={() => updateQuantity(dish.id, 'full', -1)}
                                  style={{ width: '22px', height: '22px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Minus size={11} />
                                </button>
                                <span style={{ fontSize: '0.76rem', fontWeight: 800, minWidth: '14px', textAlign: 'center' }}>{fullItemInCart.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(dish.id, 'full', 1)}
                                  style={{ width: '22px', height: '22px', borderRadius: '6px', border: 'none', background: '#059669', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(dish, 'full')}
                                style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #059669', background: '#ECFDF5', color: '#065F46', fontSize: '0.70rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                + Full
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Standard Single Portion */
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A' }}>
                            {currencySymbol}{dish.price}
                          </span>
                          {fullItemInCart ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => updateQuantity(dish.id, 'full', -1)}
                                style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Minus size={13} />
                              </button>
                              <span style={{ fontSize: '0.82rem', fontWeight: 900, minWidth: '16px', textAlign: 'center' }}>{fullItemInCart.quantity}</span>
                              <button
                                onClick={() => updateQuantity(dish.id, 'full', 1)}
                                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: '#059669', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(dish, 'full')}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#059669',
                                color: '#FFFFFF',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Plus size={13} />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN: STICKY BILLING & PAYMENT DRAWER
           ======================================================== */}
        <div className="pos-cart-panel" style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          position: 'sticky',
          top: '20px'
        }}>
          {/* Panel Header & Clear Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={17} color="#059669" />
              <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800 }}>Active Bill / Cart</strong>
              <span style={{
                fontSize: '0.70rem',
                background: '#F1F5F9',
                color: '#475569',
                padding: '2px 7px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {cart.reduce((s, it) => s + it.quantity, 0)} items
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Order Type Toggle: Takeaway vs Dine-In Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#F8FAFC', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <button
              onClick={() => setOrderType('takeaway')}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: orderType === 'takeaway' ? '#059669' : 'transparent',
                color: orderType === 'takeaway' ? '#FFFFFF' : '#64748B',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <span>📦 Takeaway (Token)</span>
            </button>
            <button
              onClick={() => setOrderType('dine_in')}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: orderType === 'dine_in' ? '#059669' : 'transparent',
                color: orderType === 'dine_in' ? '#FFFFFF' : '#64748B',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <span>🍽️ Dine-In</span>
            </button>
          </div>

          {/* If Dine-In selected, Table Selector */}
          {orderType === 'dine_in' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#166534' }}>Select Table:</span>
              <select
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #86EFAC',
                  background: '#FFFFFF',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  color: '#14532D',
                  outline: 'none'
                }}
              >
                {tablesList.map(t => (
                  <option key={t} value={t}>Table {t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Customer Name / Phone Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <User size={13} color="#94A3B8" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Name (Optional)"
                style={{
                  width: '100%',
                  padding: '7px 8px 7px 26px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.76rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Phone size={13} color="#94A3B8" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone (Optional)"
                style={{
                  width: '100%',
                  padding: '7px 8px 7px 26px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.76rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {cart.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8' }}>
                <ShoppingBag size={28} color="#CBD5E1" style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontSize: '0.80rem', fontWeight: 600 }}>Cart is empty</p>
                <span style={{ fontSize: '0.70rem' }}>Tap any item from menu to add</span>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={`${item.dish.id}_${item.selectedVariant}_${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    border: '1px solid #F1F5F9'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '6px' }}>
                    <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.dish.name}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      {item.selectedVariant === 'half' && (
                        <span style={{ fontSize: '0.62rem', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                          Half
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {currencySymbol}{item.price} each
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper & Subtotal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => updateQuantity(item.dish.id, item.selectedVariant, -1)}
                        style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus size={11} />
                      </button>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.dish.id, item.selectedVariant, 1)}
                        style={{ width: '22px', height: '22px', borderRadius: '5px', border: 'none', background: '#059669', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    <strong style={{ fontSize: '0.82rem', color: '#0F172A', minWidth: '55px', textAlign: 'right' }}>
                      {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                    </strong>

                    <button
                      onClick={() => removeFromCart(item.dish.id, item.selectedVariant)}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                      title="Remove Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Financial Breakdown */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '12px',
            padding: '12px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#64748B' }}>
              <span>Items Subtotal:</span>
              <span>{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            {isGstEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#64748B' }}>
                <span>GST (5% CGST+SGST):</span>
                <span>{currencySymbol}{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '6px',
              borderTop: '1.5px dashed #CBD5E1',
              fontSize: '1rem',
              fontWeight: 900,
              color: '#0F172A'
            }}>
              <span>Total Payable:</span>
              <span style={{ color: '#059669' }}>{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Select Upfront Payment Mode:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                onClick={() => setPaymentMethod('cash')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: paymentMethod === 'cash' ? '#059669' : '#CBD5E1',
                  background: paymentMethod === 'cash' ? '#ECFDF5' : '#FFFFFF',
                  color: paymentMethod === 'cash' ? '#065F46' : '#334155',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <DollarSign size={15} />
                <span>💵 Cash</span>
              </button>

              <button
                onClick={() => setPaymentMethod('upi')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: paymentMethod === 'upi' ? '#059669' : '#CBD5E1',
                  background: paymentMethod === 'upi' ? '#ECFDF5' : '#FFFFFF',
                  color: paymentMethod === 'upi' ? '#065F46' : '#334155',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <QrCode size={15} />
                <span>📱 UPI QR</span>
              </button>

              <button
                onClick={() => setPaymentMethod('card')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: paymentMethod === 'card' ? '#059669' : '#CBD5E1',
                  background: paymentMethod === 'card' ? '#ECFDF5' : '#FFFFFF',
                  color: paymentMethod === 'card' ? '#065F46' : '#334155',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <CreditCard size={15} />
                <span>💳 Card</span>
              </button>
            </div>
          </div>

          {/* Dynamic UPI QR Display on screen if UPI selected */}
          {paymentMethod === 'upi' && upiQrDataUrl && (
            <div style={{
              background: '#F0FDF4',
              borderRadius: '12px',
              border: '1px solid #BBF7D0',
              padding: '12px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', display: 'block', marginBottom: '6px' }}>
                Customer can scan with PhonePe / GPay / Paytm:
              </span>
              <img
                src={upiQrDataUrl}
                alt="UPI Payment QR"
                style={{ width: '130px', height: '130px', margin: '0 auto', display: 'block', borderRadius: '8px' }}
              />
              <span style={{ fontSize: '0.70rem', color: '#15803D', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                Amount: {currencySymbol}{grandTotal.toFixed(2)}
              </span>
            </div>
          )}

          {/* Big Green Action Button: Receive Payment & Print Token */}
          <button
            onClick={handleSubmitOrder}
            disabled={cart.length === 0 || isSubmitting}
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: cart.length === 0 || isSubmitting ? '#94A3B8' : 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontSize: '0.92rem',
              fontWeight: 900,
              cursor: cart.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: cart.length === 0 || isSubmitting ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Printing & Creating Token...</span>
              </>
            ) : (
              <>
                <Printer size={18} />
                <span>Pay & Print Token ({currencySymbol}{grandTotal.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================
          3. CELEBRATORY ORDER SUCCESS & TOKEN MODAL
         ======================================================== */}
      {successOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '30px 24px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
              border: '2px solid #86EFAC'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>
              Order Created & Paid!
            </h2>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 16px 0' }}>
              Receipt sent to thermal printer. Kitchen KOT dispatched.
            </p>

            {/* Token Highlight Box */}
            {successOrder.token_display && (
              <div style={{
                background: '#FEF3C7',
                border: '2px dashed #F59E0B',
                borderRadius: '14px',
                padding: '14px',
                marginBottom: '18px'
              }}>
                <span style={{ fontSize: '0.74rem', color: '#92400E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CUSTOMER PICKUP TOKEN
                </span>
                <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#78350F', lineHeight: 1.1, marginTop: '4px' }}>
                  {successOrder.token_display}
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '20px' }}>
              Order <strong>#{successOrder.order.id}</strong> • Total Paid: <strong>{currencySymbol}{successOrder.order.total_amount}</strong> ({successOrder.order.payment_method?.toUpperCase()})
            </div>

            {/* Print and Next Customer Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  if (onPrintBill) onPrintBill(successOrder.order, successOrder.order.payment_method?.toUpperCase());
                }}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={15} />
                <span>Re-Print Customer Bill</span>
              </button>

              <button
                onClick={() => setSuccessOrder(null)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                + Next Customer (Ready)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
