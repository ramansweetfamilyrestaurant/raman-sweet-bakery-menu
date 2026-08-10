import React, { useState } from 'react';
import { Store, Bell, Utensils, MapPin, CreditCard, Lock, ChevronRight, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';

export default function SetupView({
  restaurantInfo,
  onSaveProfile,
  onSaveMenuSettings,
  onSaveDevices,
  onSaveLocation,
  onSaveSecurity,
  onOpenBillingModal,
  supportPhone
}) {
  const [openDrawer, setOpenDrawer] = useState(null); // 'profile', 'devices', 'menu', 'location', 'subscription', 'security'

  // Forms state initialized from restaurantInfo
  const [profileForm, setProfileForm] = useState({
    name: restaurantInfo?.name || '',
    phone: restaurantInfo?.phone || '',
    fssai: restaurantInfo?.fssai || '',
    category: restaurantInfo?.category || '',
    tagline: restaurantInfo?.tagline || '',
    opening_hours: restaurantInfo?.opening_hours || '',
    address: restaurantInfo?.address || '',
    google_maps_url: restaurantInfo?.google_maps_url || '',
    google_review_url: restaurantInfo?.google_review_url || ''
  });

  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newUsername: restaurantInfo?.owner_username || 'admin',
    newPassword: ''
  });

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    onSaveProfile(profileForm);
    setOpenDrawer(null);
  };

  const handleSecuritySubmit = (e) => {
    e.preventDefault();
    onSaveSecurity(securityForm);
    setOpenDrawer(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header Title */}
      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--adm-text)', margin: '0 0 2px 0' }}>
          ⚙️ Setup Control Center
        </h2>
        <span style={{ fontSize: '0.76rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
          Manage restaurant profile, device notifications, menu filters, and security.
        </span>
      </div>

      {/* 6 Compact Control Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {/* Card 1: Profile */}
        <div
          onClick={() => setOpenDrawer('profile')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--adm-primary)', color: 'var(--adm-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--adm-text)', display: 'block' }}>🏪 Restaurant Profile</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>Name, logo, address, opening hours, FSSAI</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 2: Devices & Alarm */}
        <div
          onClick={() => setOpenDrawer('devices')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--adm-info-bg)', color: 'var(--adm-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--adm-text)', display: 'block' }}>🔔 Orders & Devices</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>Order audio alarm, push alerts, printer</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 3: Menu Settings */}
        <div
          onClick={() => setOpenDrawer('menu')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--adm-warning-bg)', color: 'var(--adm-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Utensils size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--adm-text)', display: 'block' }}>🍽 Menu Settings</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>Veg/Non-Veg filters, dish badge visibility</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 4: Location & Delivery */}
        <div
          onClick={() => setOpenDrawer('location')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--adm-success-bg)', color: 'var(--adm-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--adm-text)', display: 'block' }}>📍 Location & Delivery</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>GPS coordinates, Google Maps, radius</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 5: Subscription & Billing */}
        <div
          onClick={() => setOpenDrawer('subscription')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--adm-purple-bg)', color: 'var(--adm-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--adm-text)', display: 'block' }}>💳 Subscription & Billing</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>Current plan, billing status, renewals</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 6: Admin Security */}
        <div
          onClick={() => setOpenDrawer('security')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--adm-danger-bg)', color: 'var(--adm-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--adm-text)', display: 'block' }}>🔐 Admin Security</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>Username and password credentials</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>
      </div>

      {/* Drawer 1: Restaurant Profile */}
      <AdminDrawer
        isOpen={openDrawer === 'profile'}
        onClose={() => setOpenDrawer(null)}
        title="🏪 Restaurant Profile"
        subtitle="Public business identity and contact details"
        footer={(
          <button onClick={handleProfileSubmit} className="adm-btn adm-btn-primary" style={{ width: '100%' }}>
            Save Profile Changes
          </button>
        )}
      >
        <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>RESTAURANT NAME:</label>
            <input
              type="text"
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>CONTACT PHONE:</label>
            <input
              type="text"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>FSSAI LICENSE NUMBER:</label>
            <input
              type="text"
              placeholder="e.g. 12345678901234"
              value={profileForm.fssai}
              onChange={(e) => setProfileForm({ ...profileForm, fssai: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>RESTAURANT CATEGORY / CUISINE:</label>
            <input
              type="text"
              placeholder="e.g. Sweets, Bakery, North Indian"
              value={profileForm.category}
              onChange={(e) => setProfileForm({ ...profileForm, category: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>RESTAURANT ADDRESS:</label>
            <textarea
              rows={2}
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>
        </form>
      </AdminDrawer>

      {/* Drawer 5: Subscription & Billing */}
      <AdminDrawer
        isOpen={openDrawer === 'subscription'}
        onClose={() => setOpenDrawer(null)}
        title="💳 Subscription & Billing"
        subtitle="Manage plan tier and Cashfree auto-renew mandate"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div style={{ background: 'var(--adm-surface-subtle)', padding: '14px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--adm-border)' }}>
              <span style={{ color: 'var(--adm-muted)' }}>Current Plan:</span>
              <strong style={{ color: 'var(--adm-success)' }}>{(restaurantInfo?.plan_tier || 'pro').toUpperCase()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--adm-border)' }}>
              <span style={{ color: 'var(--adm-muted)' }}>Subscription Type:</span>
              <strong style={{ color: restaurantInfo?.subscription_type === 'ADMIN_GRANTED' ? 'var(--adm-purple)' : 'var(--adm-text)' }}>
                {restaurantInfo?.subscription_type === 'ADMIN_GRANTED' ? '🎁 COMPLIMENTARY (FREE)' : 'PAID CASHFREE'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--adm-muted)' }}>Access Expiry:</span>
              <strong>
                {restaurantInfo?.subscription_type === 'ADMIN_GRANTED' || (restaurantInfo?.access_until && new Date(restaurantInfo.access_until).getFullYear() > 2030)
                  ? '♾️ Lifetime Access'
                  : restaurantInfo?.access_until ? new Date(restaurantInfo.access_until).toLocaleDateString('en-IN') : 'N/A'
                }
              </strong>
            </div>
          </div>

          <button onClick={() => { setOpenDrawer(null); onOpenBillingModal(); }} className="adm-btn adm-btn-accent" style={{ width: '100%' }}>
            Manage Billing & Plan Options ➔
          </button>
        </div>
      </AdminDrawer>

      {/* Drawer 6: Admin Security */}
      <AdminDrawer
        isOpen={openDrawer === 'security'}
        onClose={() => setOpenDrawer(null)}
        title="🔐 Admin Master Credentials"
        subtitle="Update owner username and login password"
        footer={(
          <button onClick={handleSecuritySubmit} className="adm-btn adm-btn-danger" style={{ width: '100%' }}>
            Update Security Credentials
          </button>
        )}
      >
        <form onSubmit={handleSecuritySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>OWNER USERNAME:</label>
            <input
              type="text"
              required
              value={securityForm.newUsername}
              onChange={(e) => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>NEW PASSWORD (OPTIONAL):</label>
            <input
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={securityForm.newPassword}
              onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>
        </form>
      </AdminDrawer>
    </div>
  );
}
