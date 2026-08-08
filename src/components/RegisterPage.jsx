import React, { useState, useEffect } from 'react';
import { Store, User, Lock, Phone, ArrowRight, CheckCircle2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export default function RegisterPage({ onRegisterSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    owner_username: '',
    owner_password: '',
    confirm_password: '',
    plan_tier: 'pro'
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('plan');
    if (p && ['basic', 'pro', 'enterprise'].includes(p.toLowerCase())) {
      setFormData(prev => ({ ...prev, plan_tier: p.toLowerCase() }));
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApprovalData, setPendingApprovalData] = useState(null);
  const [registeredData, setRegisteredData] = useState(null);
  const [couponInput, setCouponInput] = useState('LAUNCH50');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const getBasePlanPrice = (tier) => {
    if (tier === 'basic') return 499;
    if (tier === 'enterprise') return 1999;
    return 999;
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponMsg('');
    try {
      const basePrice = getBasePlanPrice(formData.plan_tier);
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), planPrice: basePrice })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon(data);
        setCouponMsg(data.message || `Coupon '${data.code}' applied successfully! Saved ₹${data.discount}`);
      } else {
        setAppliedCoupon(null);
        setCouponMsg(data.error || 'Invalid or expired coupon code');
      }
    } catch (e) {
      setAppliedCoupon(null);
      setCouponMsg('Failed to validate coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  // Compute live URL slug preview
  const liveSlug = formData.name
    ? formData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
    : 'your-restaurant-slug';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Please enter your Restaurant Name');
      return;
    }
    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit Mobile Number (e.g. 9876543210)');
      return;
    }
    if (!formData.owner_username.trim()) {
      setError('Please enter an Owner Username for logging into Admin Panel');
      return;
    }
    if (!formData.owner_password) {
      setError('Please enter a Password');
      return;
    }
    if (formData.owner_password.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }
    if (formData.owner_password !== formData.confirm_password) {
      setError('Passwords do not match! Please check again.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          owner_username: formData.owner_username,
          owner_password: formData.owner_password,
          plan_tier: formData.plan_tier
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      if (data.pending_approval) {
        setPendingApprovalData(data);
        return;
      }

      // Store Auth Tokens in localStorage for instant automatic login
      localStorage.setItem('raman_admin_token', data.token);
      localStorage.setItem('raman_admin_user', data.username);
      localStorage.setItem('raman_admin_slug', data.slug);
      localStorage.setItem('adminToken', data.token);

      // Trigger interactive permission onboarding screen (solves browser user-gesture security requirement)
      setRegisteredData(data);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (registeredData) {
    return (
      <div style={{
        minHeight: '100vh', background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}>
        <div style={{
          maxWidth: '460px', width: '100%', background: '#111827',
          borderRadius: '24px', padding: '32px 24px', border: '2px solid #38BDF8',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)', textAlign: 'center'
        }}>
          <div style={{
            width: '70px', height: '70px', borderRadius: '50%',
            background: 'rgba(56,189,248,0.15)', color: '#38BDF8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', border: '2px solid #38BDF8'
          }}>
            <Sparkles size={38} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 8px 0' }}>
            🎉 Registration Complete!
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#9CA3AF', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Welcome <strong>{registeredData.name || formData.name}</strong>! Automatic setup complete ho gaya hai. Ab 1-tap me mobile permissions & location enable karein:
          </p>

          <div style={{
            background: '#1F2937', borderRadius: '16px', padding: '16px',
            textAlign: 'left', marginBottom: '24px', border: '1px solid #374151'
          }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38BDF8', marginBottom: '12px' }}>
              ⚡ Tap button below to trigger browser permissions:
            </div>
            <div style={{ fontSize: '0.82rem', color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>📍</span> <strong>GPS Location:</strong> Auto-saves exact restaurant location
            </div>
            <div style={{ fontSize: '0.82rem', color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔔</span> <strong>Order Push Alerts:</strong> Notifies on incoming table orders
            </div>
            <div style={{ fontSize: '0.82rem', color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔊</span> <strong>Kitchen Siren:</strong> Unlocks loud emergency alarm sound
            </div>
          </div>

          <button
            onClick={async () => {
              // Direct user tap gesture -> Browser will pop up native Location & Notification permissions!
              if ('Notification' in window) {
                try { await Notification.requestPermission(); } catch (e) {}
              }

              const proceed = () => {
                if (onRegisterSuccess) {
                  onRegisterSuccess(registeredData);
                } else {
                  window.history.pushState({}, '', `/${registeredData.slug}/admin`);
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              };

              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    console.log('📍 GPS Location captured on onboarding:', lat, lng);
                    try {
                      await fetch('/api/admin/settings', {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${registeredData.token}`
                        },
                        body: JSON.stringify({ latitude: lat, longitude: lng })
                      });
                      console.log('✅ GPS location auto-saved to DB!');
                    } catch (e) {}
                    proceed();
                  },
                  (err) => {
                    console.warn('GPS location skipped:', err);
                    proceed();
                  },
                  { enableHighAccuracy: true, timeout: 8000 }
                );
              } else {
                proceed();
              }
            }}
            style={{
              width: '100%', padding: '15px', borderRadius: '9999px',
              border: 'none', background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              color: '#FFFFFF', fontWeight: 900, fontSize: '0.95rem',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(14,165,233,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            ⚡ Allow Location & Enter Dashboard <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (pendingApprovalData) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #0D1B2A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{
          background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
          padding: '40px 24px', maxWidth: '480px', width: '100%', textAlign: 'center', color: '#FFFFFF',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>⏳</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DFBA67', marginBottom: '10px' }}>
            Registration Submitted!
          </h2>
          <p style={{ color: '#E2E8F0', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Your restaurant <strong>'{pendingApprovalData.restaurant?.name}'</strong> has been submitted for Super Admin verification and approval.
          </p>

          <div style={{
            background: 'rgba(223,186,103,0.1)', border: '1px solid rgba(223,186,103,0.3)',
            borderRadius: '16px', padding: '16px', marginBottom: '28px', textAlign: 'left', fontSize: '0.84rem'
          }}>
            <div style={{ color: '#DFBA67', fontWeight: 800, marginBottom: '6px' }}>📋 Registration Summary:</div>
            <div style={{ marginBottom: '4px' }}>• <strong>Admin Username:</strong> {pendingApprovalData.username}</div>
            <div style={{ marginBottom: '4px' }}>• <strong>Mobile Number:</strong> {formData.phone}</div>
            <div>• <strong>Status:</strong> <span style={{ color: '#F59E0B', fontWeight: 800 }}>Pending Super Admin Approval</span></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => {
                const msg = `Hello Super Admin, I registered my restaurant '${pendingApprovalData.restaurant?.name}' (Username: ${pendingApprovalData.username}). Please approve my account.`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, #15803D, #22C55E)', color: '#FFFFFF',
                fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.4)'
              }}
            >
              💬 Request Quick WhatsApp Approval
            </button>

            <button
              onClick={() => {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              ← Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #06170D 0%, #0A2315 50%, #041009 100%)',
      color: '#FFFFFF',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(60px)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(5,150,105,0.2) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(60px)', pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1000px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '32px',
        alignItems: 'center',
        zIndex: 2
      }}>
        {/* Left Side: SaaS Value Offer */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '50px', padding: '6px 16px', fontSize: '0.8rem', fontWeight: 800,
            color: '#DFBA67', marginBottom: '20px'
          }}>
            <Sparkles size={16} /> 14-DAY FREE TRIAL • NO CREDIT CARD REQUIRED
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.25, marginBottom: '16px' }}>
            Launch Your Digital QR Restaurant Menu in <span style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>60 Seconds</span>
          </h1>

          <p style={{ color: '#9CA3AF', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '28px' }}>
            Join hundreds of modern restaurants, sweets shops, and cafes using Khana-Master to automate digital QR table orders & WhatsApp ordering.
          </p>

          {/* Feature Highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 color="#34D399" size={20} />
              <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: 600 }}>
                Instant Digital QR Menu & Table Standees
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 color="#34D399" size={20} />
              <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: 600 }}>
                Live Kitchen Order Display (KOT) & Sound Chimes
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 color="#34D399" size={20} />
              <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: 600 }}>
                Dynamic Thali & Combo Deals Builder
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 color="#34D399" size={20} />
              <span style={{ fontSize: '0.9rem', color: '#E5E7EB', fontWeight: 600 }}>
                Direct WhatsApp Orders & Customer Reviews
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Registration Form Card */}
        <div style={{
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '28px',
          padding: '36px 28px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0', textAlign: 'center' }}>
            Create Your Restaurant Account 🚀
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#9CA3AF', textAlign: 'center', margin: '0 0 24px 0' }}>
            Get instant access to your Admin Dashboard & Digital Menu
          </p>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#FCA5A5', padding: '12px 14px', borderRadius: '12px',
              fontSize: '0.82rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Restaurant Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                RESTAURANT / BAKERY NAME *
              </label>
              <div style={{ position: 'relative' }}>
                <Store size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Sweets & Restaurant"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                    color: '#FFFFFF', fontSize: '0.9rem', outline: 'none'
                  }}
                />
              </div>

              {/* URL Preview */}
              <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '6px', paddingLeft: '4px' }}>
                Your Menu URL: <span style={{ color: '#34D399', fontWeight: 700 }}>khana-master.onrender.com/{liveSlug}</span>
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                CONTACT / WHATSAPP MOBILE NUMBER *
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                    color: '#FFFFFF', fontSize: '0.9rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Owner Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                ADMIN LOGIN USERNAME *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  placeholder="Choose admin username (e.g. royalsweets_admin)"
                  value={formData.owner_username}
                  onChange={e => setFormData({ ...formData, owner_username: e.target.value })}
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                    color: '#FFFFFF', fontSize: '0.9rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Password & Confirm Password Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                  PASSWORD *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Min 4 chars"
                    value={formData.owner_password}
                    onChange={e => setFormData({ ...formData, owner_password: e.target.value })}
                    style={{
                      width: '100%', padding: '11px 12px 11px 36px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                      color: '#FFFFFF', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                  CONFIRM PASSWORD *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={formData.confirm_password}
                    onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                    style={{
                      width: '100%', padding: '11px 12px 11px 36px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                      color: '#FFFFFF', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Select SaaS Subscription Plan */}
            <div style={{ marginTop: '4px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                SELECT SAAS SUBSCRIPTION PLAN *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { key: 'basic', name: '⚡ Basic', price: '₹499/mo', desc: 'Digital QR Menu' },
                  { key: 'pro', name: '👑 Pro', price: '₹999/mo', desc: 'WhatsApp + Reviews', popular: true },
                  { key: 'enterprise', name: '🚀 Enterprise', price: '₹1,999/mo', desc: 'KOT + Printers' }
                ].map((p) => (
                  <div
                    key={p.key}
                    onClick={() => {
                      setFormData({ ...formData, plan_tier: p.key });
                      setAppliedCoupon(null);
                      setCouponMsg('');
                    }}
                    style={{
                      border: formData.plan_tier === p.key ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.15)',
                      background: formData.plan_tier === p.key ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '12px', padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                      position: 'relative'
                    }}
                  >
                    {p.popular && <span style={{ position: 'absolute', top: '-8px', right: '4px', background: '#DFBA67', color: '#000', fontSize: '0.55rem', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>BEST</span>}
                    <div style={{ fontSize: '0.82rem', fontWeight: 900, color: formData.plan_tier === p.key ? '#FFD700' : '#FFF' }}>{p.name}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34D399', margin: '2px 0' }}>{p.price}</div>
                    <div style={{ fontSize: '0.62rem', color: '#9CA3AF' }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Badge Indicator & Coupon Calculation */}
            <div style={{
              background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)',
              borderRadius: '12px', padding: '10px 14px', marginTop: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#34D399" />
                <span style={{ fontSize: '0.8rem', color: '#D1D5DB', fontWeight: 700 }}>
                  Includes <strong style={{ color: '#FFD700' }}>{formData.plan_tier.toUpperCase()} Plan 14-Day Free Trial</strong>
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#34D399' }}>
                {appliedCoupon ? `Saved ₹${appliedCoupon.discount}!` : '₹0 Today'}
              </span>
            </div>

            {/* 🎟️ Promo / Coupon Code Input Field */}
            <div style={{ marginTop: '2px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
                🎟️ PROMO / COUPON CODE (OPTIONAL):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. LAUNCH50 or FIRST100"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setAppliedCoupon(null);
                    setCouponMsg('');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#1F2937',
                    color: '#FFD700',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: couponLoading || !couponInput.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {couponLoading ? 'Validating...' : 'Apply'}
                </button>
              </div>
              {couponMsg && (
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: appliedCoupon ? '#34D399' : '#EF4444',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {appliedCoupon ? '✅ ' : '❌ '}{couponMsg}
                </div>
              )}
            </div>

            {/* Automated Permission & Terms Agreement */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', fontSize: '0.74rem', color: '#9CA3AF' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked required style={{ accentColor: '#DFBA67', width: '15px', height: '15px' }} />
                <span>Allow 1-Click WhatsApp & Order Notification Permissions</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked required style={{ accentColor: '#DFBA67', width: '15px', height: '15px' }} />
                <span>I agree to KhanaMaster SaaS Terms & 14-Day Free Trial</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)',
                color: '#0A0A0A',
                fontSize: '0.95rem',
                fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <span>Provisioning Your Account... ⏳</span>
              ) : (
                <>
                  <span>🚀 Start 14-Day Free Trial Now</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
