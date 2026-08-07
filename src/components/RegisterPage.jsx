import React, { useState } from 'react';
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Store Auth Token in localStorage
      localStorage.setItem('adminToken', data.token);

      if (onRegisterSuccess) {
        onRegisterSuccess(data);
      } else {
        // Redirect to new tenant admin dashboard
        window.history.pushState({}, '', `/${data.slug}/admin`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                CONTACT / WHATSAPP PHONE NUMBER
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
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

            {/* Plan Badge Indicator */}
            <div style={{
              background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)',
              borderRadius: '12px', padding: '10px 14px', marginTop: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#34D399" />
                <span style={{ fontSize: '0.8rem', color: '#D1D5DB', fontWeight: 700 }}>
                  Includes 👑 <strong style={{ color: '#FFD700' }}>Pro Plan 14-Day Free Trial</strong>
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#34D399' }}>₹0 Today</span>
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
