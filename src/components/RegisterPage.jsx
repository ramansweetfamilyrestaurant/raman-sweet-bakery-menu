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
    const p = params.get('plan') || localStorage.getItem('selected_plan_tier') || sessionStorage.getItem('selected_plan_tier');
    if (p && ['basic', 'pro', 'enterprise'].includes(p.toLowerCase())) {
      setFormData(prev => ({ ...prev, plan_tier: p.toLowerCase() }));
    }
  }, []);

  const [trialDays, setTrialDays] = useState(14);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.default_trial_days) setTrialDays(Math.max(1, parseInt(data.default_trial_days, 10) || 14));
      })
      .catch(() => {});

    fetch('/api/plans')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {});
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApprovalData, setPendingApprovalData] = useState(null);

  const getBasePlanPrice = (tier) => {
    const found = plans.find(p => p.key === tier);
    if (found && found.price) return Number(found.price);
    if (tier === 'basic') return 499;
    if (tier === 'enterprise') return 1999;
    return 999;
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
      // Step 1: Pre-validate credentials & availability before submitting registration
      const valRes = await fetch('/api/register/pre-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          owner_username: formData.owner_username,
          owner_password: formData.owner_password
        })
      });

      const valData = await valRes.json();
      if (!valRes.ok) {
        throw new Error(valData.error || 'Registration validation failed.');
      }

      // Step 2: Proceed with account registration
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

      // Store Auth Tokens & Selected Plan in localStorage for instant billing onboarding
      localStorage.removeItem('pending_subscription_id');
      localStorage.setItem('raman_admin_token', data.token);
      localStorage.setItem('raman_admin_user', data.username || formData.owner_username);
      localStorage.setItem('raman_admin_slug', data.slug);
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('selected_plan_tier', formData.plan_tier || data.plan_tier || 'pro');
      sessionStorage.setItem('selected_plan_tier', formData.plan_tier || data.plan_tier || 'pro');

      if (onRegisterSuccess) {
        onRegisterSuccess(data);
      } else {
        window.location.href = `/${data.slug || ''}/admin`;
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingApprovalData) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #0D1B2A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{
          background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
          padding: '36px 20px', maxWidth: '440px', width: '100%', textAlign: 'center', color: '#FFFFFF',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#DFBA67', marginBottom: '8px' }}>
            Registration Submitted!
          </h2>
          <p style={{ color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
            Your restaurant <strong>'{pendingApprovalData.restaurant?.name}'</strong> has been submitted for Super Admin verification.
          </p>

          <div style={{
            background: 'rgba(223,186,103,0.1)', border: '1px solid rgba(223,186,103,0.3)',
            borderRadius: '16px', padding: '14px', marginBottom: '24px', textAlign: 'left', fontSize: '0.82rem'
          }}>
            <div style={{ color: '#DFBA67', fontWeight: 800, marginBottom: '6px' }}>📋 Registration Details:</div>
            <div style={{ marginBottom: '4px' }}>• <strong>Admin Username:</strong> {pendingApprovalData.username}</div>
            <div style={{ marginBottom: '4px' }}>• <strong>Mobile Number:</strong> {formData.phone}</div>
            <div>• <strong>Status:</strong> <span style={{ color: '#F59E0B', fontWeight: 800 }}>Pending Approval</span></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => {
                const msg = `Hello Super Admin, I registered my restaurant '${pendingApprovalData.restaurant?.name}' (Username: ${pendingApprovalData.username}). Please approve my account.`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #15803D, #22C55E)', color: '#FFFFFF',
                fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.4)'
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
                width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
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
      background: 'radial-gradient(circle at top right, #0A2315 0%, #05140B 60%, #020904 100%)',
      color: '#FFFFFF',
      fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glows */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-10%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(50px)', pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '960px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        alignItems: 'center',
        zIndex: 2
      }}>
        {/* Left Side: SaaS Value Offer */}
        <div style={{ padding: '8px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '50px', padding: '6px 14px', fontSize: '0.76rem', fontWeight: 800,
            color: '#DFBA67', marginBottom: '16px'
          }}>
            <Sparkles size={14} /> {trialDays}-DAY FREE TRIAL • ₹0 TODAY
          </div>

          <h1 style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1.2, marginBottom: '14px', letterSpacing: '-0.5px' }}>
            Launch Your Digital QR Menu in <span style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>60 Seconds</span>
          </h1>

          <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '22px' }}>
            Join hundreds of modern restaurants & cafes automating digital QR table ordering, live KOT alerts, and WhatsApp orders with KhanaMaster.
          </p>

          {/* Feature Highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              'Instant Digital QR Menu & Table Standees',
              'Live Kitchen Order Display (KOT) & Siren Alarms',
              'Dynamic Thali & Combo Deals Builder',
              'Direct WhatsApp Orders & Customer Feedback'
            ].map((feature, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 color="#34D399" size={18} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', color: '#E5E7EB', fontWeight: 600 }}>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Sleek Registration Card */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          padding: '24px 20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 4px 0', textAlign: 'center' }}>
            Create Restaurant Account 🚀
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#9CA3AF', textAlign: 'center', margin: '0 0 20px 0' }}>
            Instant setup • {trialDays}-day unrestricted trial access
          </p>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#FCA5A5', padding: '10px 12px', borderRadius: '12px',
              fontSize: '0.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Restaurant Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
                RESTAURANT / BAKERY NAME *
              </label>
              <div style={{ position: 'relative' }}>
                <Store size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Sweets & Restaurant"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%', padding: '11px 12px 11px 38px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                    color: '#FFFFFF', fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '4px' }}>
                Menu URL: <span style={{ color: '#34D399', fontWeight: 700 }}>khana-master.onrender.com/{liveSlug}</span>
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
                MOBILE / WHATSAPP NUMBER *
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                  style={{
                    width: '100%', padding: '11px 12px 11px 38px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                    color: '#FFFFFF', fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Owner Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
                ADMIN LOGIN USERNAME *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  placeholder="Choose admin username (e.g. royalsweets)"
                  value={formData.owner_username}
                  onChange={e => setFormData({ ...formData, owner_username: e.target.value })}
                  style={{
                    width: '100%', padding: '11px 12px 11px 38px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                    color: '#FFFFFF', fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Password & Confirm Password Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
                  PASSWORD *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="#9CA3AF" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Min 4 chars"
                    value={formData.owner_password}
                    onChange={e => setFormData({ ...formData, owner_password: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 10px 10px 32px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                      color: '#FFFFFF', fontSize: '0.82rem', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#DFBA67', marginBottom: '4px' }}>
                  CONFIRM *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="#9CA3AF" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={formData.confirm_password}
                    onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 10px 10px 32px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)', background: '#1F2937',
                      color: '#FFFFFF', fontSize: '0.82rem', outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Select SaaS Subscription Plan */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                SELECT PLAN TIER *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {(plans.length > 0 ? plans.map(p => ({
                  key: p.key,
                  name: p.key === 'basic' ? 'Basic' : p.key === 'enterprise' ? 'Enterprise' : 'Pro',
                  price: `₹${p.price}/mo`,
                  popular: p.key === 'pro'
                })) : [
                  { key: 'basic', name: 'Basic', price: '₹499/mo' },
                  { key: 'pro', name: 'Pro', price: '₹999/mo', popular: true },
                  { key: 'enterprise', name: 'Enterprise', price: '₹1,999/mo' }
                ]).map((p) => (
                  <div
                    key={p.key}
                    onClick={() => {
                      setFormData({ ...formData, plan_tier: p.key });
                    }}
                    style={{
                      border: formData.plan_tier === p.key ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.15)',
                      background: formData.plan_tier === p.key ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '10px', padding: '8px 4px', cursor: 'pointer', textAlign: 'center',
                      position: 'relative'
                    }}
                  >
                    {p.popular && <span style={{ position: 'absolute', top: '-7px', right: '3px', background: '#DFBA67', color: '#000', fontSize: '0.5rem', fontWeight: 900, padding: '1px 4px', borderRadius: '4px' }}>POPULAR</span>}
                    <div style={{ fontSize: '0.78rem', fontWeight: 900, color: formData.plan_tier === p.key ? '#FFD700' : '#FFF' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34D399' }}>{p.price}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)',
                color: '#0A0A0A',
                fontSize: '0.92rem',
                fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 18px rgba(245,158,11,0.4)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <span>Creating Account... ⏳</span>
              ) : (
                <>
                  <span>🚀 Register & Continue to Free Trial</span>
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
