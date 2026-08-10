import React, { useState } from 'react';
import { Store, Bell, Utensils, MapPin, CreditCard, Lock, ChevronRight, Upload, Volume2, ShieldCheck, Printer } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';

export default function SetupView({
  settingsForm = {},
  setSettingsForm,
  handleSaveSettings,
  credForm = {},
  setCredForm,
  handleChangeCredentials,
  credMsg = {},
  token,
  uploadImage,
  setShowPrinterModal,
  setShowHelpModal,
  onOpenBillingModal,
  supportPhone,
  restaurantInfo,
  onNavigate,
  onOptimizeDatabase
}) {
  const [openDrawer, setOpenDrawer] = useState(null); // 'profile', 'devices', 'menu', 'location', 'subscription', 'security'
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleFormSave = async (e) => {
    if (e) e.preventDefault();
    await handleSaveSettings();
    setSaveSuccessMsg('✅ Settings saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
    setOpenDrawer(null);
  };

  const handleSecuritySave = async (e) => {
    if (e) e.preventDefault();
    await handleChangeCredentials();
    if (credMsg?.type === 'success') {
      setTimeout(() => setOpenDrawer(null), 1500);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadImage(file, token);
      if (url && setSettingsForm) {
        setSettingsForm(prev => ({ ...prev, logo: url }));
      }
    } catch (err) {
      alert('Logo upload failed: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (setSettingsForm) {
          setSettingsForm(prev => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          }));
        }
        setGpsLoading(false);
        alert(`📍 GPS Location Detected!\nLatitude: ${pos.coords.latitude}\nLongitude: ${pos.coords.longitude}`);
      },
      (err) => {
        setGpsLoading(false);
        alert('Could not detect location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const testAlarmSound = () => {
    try {
      const audio = new Audio('/assets/emergency_alarm.mp3');
      audio.play().catch(() => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      });
      alert('🔊 Playing Test Siren Ringtone!');
    } catch (e) {
      alert('Audio alert triggered');
    }
  };

  const requestPushPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        alert(`Push Notifications Permission: ${perm.toUpperCase()}`);
      });
    } else {
      alert('Push notifications not supported on this browser.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            Setup Control Center
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Configure profile, device alarms, GST tax, menu filters, GPS geofence, and security.
          </span>
        </div>

        {saveSuccessMsg && (
          <span style={{ background: 'var(--adm-success-bg)', color: 'var(--adm-success)', padding: '6px 12px', borderRadius: 'var(--adm-radius-full)', fontSize: '0.78rem', fontWeight: 800 }}>
            {saveSuccessMsg}
          </span>
        )}
      </div>

      {/* 9 Control Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* Card 1: Profile */}
        <div
          onClick={() => setOpenDrawer('profile')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-primary)', color: 'var(--adm-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>🏪 Restaurant Profile</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Name, logo, phone, address, FSSAI, Maps</span>
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
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-info-bg)', color: 'var(--adm-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>🔔 Orders & Devices</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Siren audio alert, push alerts, printer</span>
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
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-warning-bg)', color: 'var(--adm-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Utensils size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>🍽 Menu & GST Settings</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>GST tax rate, currency, dish badges</span>
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
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-success-bg)', color: 'var(--adm-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>📍 Location & Geofence</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>GPS coordinates, ordering radius</span>
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
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-purple-bg)', color: 'var(--adm-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>💳 Subscription & Billing</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Current plan, expiry, auto-debit status</span>
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
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-danger-bg)', color: 'var(--adm-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>🔐 Admin Security</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Owner username and password login</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 7: Table QR Standees */}
        <div
          onClick={() => onNavigate && onNavigate('qr-generator')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-warning-bg)', color: 'var(--adm-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Printer size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>📱 QR Standees & Printer</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Print table QR stickers, uniform standees</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 8: Customer Reviews */}
        <div
          onClick={() => onNavigate && onNavigate('review')}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-purple-bg)', color: 'var(--adm-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>⭐ Reviews & Feedback</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Google Review link, customer rating</span>
            </div>
          </div>
          <ChevronRight size={18} color="var(--adm-muted)" />
        </div>

        {/* Card 9: Database Engine Optimization */}
        <div
          onClick={() => onOptimizeDatabase && onOptimizeDatabase()}
          className="adm-card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--adm-success-bg)', color: 'var(--adm-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)', display: 'block' }}>⚡ Optimize Database Engine</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>Purge temporary logs, speed up queries</span>
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
          <button onClick={handleFormSave} className="adm-btn adm-btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
            Save Profile Changes
          </button>
        )}
      >
        <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem' }}>
          {/* Logo Upload Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            {settingsForm.logo ? (
              <img src={settingsForm.logo} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: 'var(--adm-primary)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>LOGO</div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--adm-primary)', display: 'block', marginBottom: '4px' }}>RESTAURANT LOGO:</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ fontSize: '0.78rem' }} />
              {uploadingLogo && <span style={{ fontSize: '0.72rem', color: 'var(--adm-accent)', display: 'block', marginTop: '2px' }}>Uploading image to R2 cloud...</span>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>RESTAURANT NAME:</label>
            <input
              type="text"
              required
              value={settingsForm.name || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>TAGLINE / SLOGAN:</label>
            <input
              type="text"
              placeholder="e.g. Pure Veg Family Restaurant & Bakery"
              value={settingsForm.tagline || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>CONTACT PHONE:</label>
            <input
              type="text"
              value={settingsForm.phone || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>FSSAI LICENSE NUMBER:</label>
            <input
              type="text"
              placeholder="e.g. 12345678901234"
              value={settingsForm.fssai_lic_no || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, fssai_lic_no: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>OPENING HOURS:</label>
            <input
              type="text"
              placeholder="e.g. 10:00 AM - 11:00 PM Daily"
              value={settingsForm.openingHours || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, openingHours: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>GOOGLE MAPS LOCATION LINK:</label>
            <input
              type="url"
              placeholder="https://maps.google.com/..."
              value={settingsForm.google_maps_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_url: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>GOOGLE REVIEW PAGE LINK:</label>
            <input
              type="url"
              placeholder="https://g.page/r/..."
              value={settingsForm.google_review_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>ADDRESS:</label>
            <textarea
              rows={2}
              value={settingsForm.address || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>
        </form>
      </AdminDrawer>

      {/* Drawer 2: Orders & Devices */}
      <AdminDrawer
        isOpen={openDrawer === 'devices'}
        onClose={() => setOpenDrawer(null)}
        title="🔔 Orders & Devices"
        subtitle="Manage live order siren ringtones and thermal printer settings"
        footer={(
          <button onClick={handleFormSave} className="adm-btn adm-btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
            Save Device Settings
          </button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Siren Audio Alert Box */}
          <div style={{ padding: '14px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--adm-primary)' }}>🔊 Live Order Siren Ringtone</strong>
              <input
                type="checkbox"
                checked={settingsForm.order_alarm_enabled !== false}
                onChange={(e) => setSettingsForm({ ...settingsForm, order_alarm_enabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--adm-muted)', margin: '0 0 10px 0' }}>
              Plays a loud Swiggy/Zomato style siren ringtone whenever a new table order arrives.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={testAlarmSound} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ flex: 1 }}>
                <Volume2 size={15} /> Test Siren Sound
              </button>
              <button onClick={requestPushPermission} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ flex: 1 }}>
                🔔 Push Notifications
              </button>
            </div>
          </div>

          {/* Order Retention Period */}
          <div style={{ padding: '14px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-primary)', display: 'block', marginBottom: '4px' }}>ORDER HISTORY RETENTION (DAYS):</label>
            <input
              type="number"
              value={settingsForm.order_retention_days || 7}
              onChange={(e) => setSettingsForm({ ...settingsForm, order_retention_days: parseInt(e.target.value) || 7 })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.88rem' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)', marginTop: '4px', display: 'block' }}>Orders older than this period will be automatically archived.</span>
          </div>

          {/* Printer Setup Box */}
          <div style={{ padding: '14px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--adm-primary)', display: 'block', marginBottom: '4px' }}>🖨️ Thermal Receipt Printer</strong>
            <p style={{ fontSize: '0.76rem', color: 'var(--adm-muted)', margin: '0 0 10px 0' }}>
              Supports 58mm & 80mm ESC/POS Bluetooth and USB thermal printers.
            </p>
            <button onClick={() => { setOpenDrawer(null); setShowPrinterModal(true); }} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ width: '100%' }}>
              <Printer size={15} /> Open Printer Pairing Guide
            </button>
          </div>
        </div>
      </AdminDrawer>

      {/* Drawer 3: Menu Settings */}
      <AdminDrawer
        isOpen={openDrawer === 'menu'}
        onClose={() => setOpenDrawer(null)}
        title="🍽 Menu & GST Settings"
        subtitle="Configure cuisine type, tax rate, and dish badge visibility"
        footer={(
          <button onClick={handleFormSave} className="adm-btn adm-btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
            Save Menu & Tax Settings
          </button>
        )}
      >
        <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>RESTAURANT TYPE:</label>
            <select
              value={settingsForm.resto_type || 'pure_veg'}
              onChange={(e) => setSettingsForm({ ...settingsForm, resto_type: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem', fontWeight: 700 }}
            >
              <option value="pure_veg">🟢 Pure Veg Restaurant</option>
              <option value="veg_nonveg">🔴 Veg & Non-Veg Restaurant</option>
              <option value="bakery">🍰 Bakery & Confectionery</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>CURRENCY SYMBOL:</label>
            <input
              type="text"
              value={settingsForm.currency_symbol || '₹'}
              onChange={(e) => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          {/* GST Configuration */}
          <div style={{ padding: '12px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '0.88rem', color: 'var(--adm-primary)' }}>🏷️ Enable 5% GST Tax Billing</strong>
              <input
                type="checkbox"
                checked={Boolean(settingsForm.gst_enabled)}
                onChange={(e) => setSettingsForm({ ...settingsForm, gst_enabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {settingsForm.gst_enabled && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>GSTIN NUMBER:</label>
                <input
                  type="text"
                  placeholder="e.g. 10AAAAA0000A1Z5"
                  value={settingsForm.gstin_number || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gstin_number: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.86rem' }}
                />
              </div>
            )}
          </div>

          {/* Dish Filter Visibility Toggles */}
          <div style={{ padding: '12px', background: 'var(--adm-surface-subtle)', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
            <strong style={{ fontSize: '0.88rem', color: 'var(--adm-primary)', display: 'block', marginBottom: '10px' }}>👁️ Customer Menu Badge Visibility</strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⭐ Show "Must Try" Badge Filter</span>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.must_try !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, must_try: e.target.checked }
                  })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✨ Show "Today Special" Badge Filter</span>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.special !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, special: e.target.checked }
                  })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🍱 Show "Combos" Navigation Tab</span>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.combo !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, combo: e.target.checked }
                  })}
                />
              </div>
            </div>
          </div>
        </form>
      </AdminDrawer>

      {/* Drawer 4: Location & Delivery */}
      <AdminDrawer
        isOpen={openDrawer === 'location'}
        onClose={() => setOpenDrawer(null)}
        title="📍 Location & GPS Geofence"
        subtitle="Set coordinates to prevent fake orders from outside your restaurant"
        footer={(
          <button onClick={handleFormSave} className="adm-btn adm-btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
            Save Location & Geofence
          </button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <button onClick={handleDetectGps} disabled={gpsLoading} className="adm-btn adm-btn-accent" style={{ width: '100%', padding: '12px', fontWeight: 800 }}>
            <MapPin size={16} /> {gpsLoading ? 'Detecting Location...' : '📍 Auto-Detect Current GPS Coordinates'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>LATITUDE:</label>
              <input
                type="number"
                step="any"
                value={settingsForm.latitude || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, latitude: parseFloat(e.target.value) })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>LONGITUDE:</label>
              <input
                type="number"
                step="any"
                value={settingsForm.longitude || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, longitude: parseFloat(e.target.value) })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>MAX ORDERING DISTANCE RADIUS (METERS):</label>
            <input
              type="number"
              value={settingsForm.max_distance_meters || 100}
              onChange={(e) => setSettingsForm({ ...settingsForm, max_distance_meters: parseInt(e.target.value) || 100 })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)', marginTop: '2px', display: 'block' }}>Default: 100 meters (dining hall boundary)</span>
          </div>
        </div>
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

          <button onClick={() => { setOpenDrawer(null); onOpenBillingModal(); }} className="adm-btn adm-btn-accent" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
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
          <button onClick={handleSecuritySave} className="adm-btn adm-btn-danger" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
            Update Security Credentials
          </button>
        )}
      >
        <form onSubmit={handleSecuritySave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
          {credMsg?.text && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--adm-radius-md)', fontSize: '0.82rem', fontWeight: 800,
              background: credMsg.type === 'error' ? 'var(--adm-danger-bg)' : 'var(--adm-success-bg)',
              color: credMsg.type === 'error' ? 'var(--adm-danger)' : 'var(--adm-success)',
              border: `1px solid ${credMsg.type === 'error' ? 'var(--adm-danger-border)' : 'var(--adm-success-border)'}`
            }}>
              {credMsg.text}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>CURRENT PASSWORD (REQUIRED):</label>
            <input
              type="password"
              required
              value={credForm.currentPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, currentPassword: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>NEW OWNER USERNAME:</label>
            <input
              type="text"
              placeholder="Leave blank to keep unchanged"
              value={credForm.newUsername || ''}
              onChange={(e) => setCredForm({ ...credForm, newUsername: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>NEW PASSWORD:</label>
            <input
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={credForm.newPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>CONFIRM NEW PASSWORD:</label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={credForm.confirmPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, confirmPassword: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>
        </form>
      </AdminDrawer>
    </div>
  );
}
