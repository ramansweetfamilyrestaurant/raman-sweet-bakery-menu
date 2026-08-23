import React, { useState } from 'react';
import { Store, Bell, Utensils, MapPin, CreditCard, Lock, ChevronRight, Upload, Volume2, ShieldCheck, Printer, Map } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';
import LocationPickerModal from '../../Common/LocationPickerModal';
import {
  BUSINESS_TYPES,
  FOOD_TYPES,
  SERVICE_MODELS,
  BUSINESS_TYPE_METADATA,
  FOOD_TYPE_METADATA,
  SERVICE_MODEL_METADATA,
  resolveBusinessProfile
} from '../../../utils/businessTaxonomy';

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
  const [showMapModal, setShowMapModal] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  const handleFormSave = async (e) => {
    if (e) e.preventDefault();
    if (savingForm) return;
    setSavingForm(true);
    try {
      await handleSaveSettings();
      setSaveSuccessMsg('✅ Settings saved successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
      setOpenDrawer(null);
    } catch (err) {
      // Alert already triggered by handleSaveSettings
    } finally {
      setSavingForm(false);
    }
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
      const url = await uploadImage(file, token, 'logos');
      if (url && setSettingsForm) {
        setSettingsForm(prev => ({ ...prev, logo: url }));
      }
    } catch (err) {
      alert('Logo upload failed: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const [gpsSuccessMsg, setGpsSuccessMsg] = useState('');
  const [gpsErrorState, setGpsErrorState] = useState(null); // { title, msg, isDenied }

  const handleDetectGps = async () => {
    setGpsSuccessMsg('');
    setGpsErrorState(null);

    // Step 1: Check if geolocation API exists
    if (!navigator.geolocation) {
      setGpsErrorState({
        title: '❌ GPS Not Supported',
        msg: 'Unable to detect location. Browser does not support geolocation.',
        isDenied: false
      });
      return;
    }

    // Step 2: Check secure context (HTTPS required for geolocation)
    if (window.isSecureContext === false) {
      setGpsErrorState({
        title: '🔒 HTTPS Required',
        msg: 'HTTPS is required for browser location detection. Please access via https:// URL.',
        isDenied: false
      });
      return;
    }

    // Step 3: Check permission status if Permissions API available
    if (navigator.permissions) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permStatus.state === 'denied') {
          setGpsErrorState({
            title: '🔒 Location permission is blocked',
            msg: 'Allow Location access for this site in your browser settings.',
            isDenied: true
          });
          return;
        }
      } catch (e) {
        // Permissions API not fully supported, continue to getCurrentPosition
      }
    }

    // Step 4: High-Accuracy REAL GPS Location Request (maximumAge: 0, enableHighAccuracy: true)
    setGpsLoading(true);

    let bestReading = null;
    let samplesCount = 0;
    let watchId = null;

    const finalizeLocation = (position) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      setGpsLoading(false);

      if (!position || !position.coords) {
        setGpsErrorState({
          title: '❌ Location Error',
          msg: 'Unable to detect your location. Please try again.',
          isDenied: false
        });
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 999;

      // Debug Log
      console.log('[LOCATION DEBUG]', {
        lat,
        lng,
        accuracy: `${Math.round(accuracy)}m`,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: new Date(position.timestamp).toISOString()
      });

      // Validate Coordinate Boundaries (-90 <= lat <= 90, -180 <= lng <= 180)
      if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180 || isNaN(lat) || isNaN(lng)) {
        setGpsErrorState({
          title: '❌ Invalid Coordinates',
          msg: 'Detected coordinates are invalid. Please try again.',
          isDenied: false
        });
        return;
      }

      // Preserve full float precision in state
      if (setSettingsForm) {
        setSettingsForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          location_initialized: true
        }));
      }

      if (accuracy <= 50) {
        setGpsSuccessMsg(`✓ GPS Location captured (Accuracy: ±${Math.round(accuracy)}m)`);
      } else {
        setGpsSuccessMsg(`✓ Location detected (Accuracy: ±${Math.round(accuracy)}m). Fine-tune pin on map if needed.`);
      }

      setTimeout(() => setGpsSuccessMsg(''), 7000);
    };

    const handleGpsError = (err) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      setGpsLoading(false);

      if (bestReading) {
        // Use best reading collected so far if available
        finalizeLocation(bestReading);
        return;
      }

      if (err.code === 1) {
        // PERMISSION_DENIED
        setGpsErrorState({
          title: '🔒 Location permission is blocked',
          msg: 'Allow Location access for this site in your browser settings.',
          isDenied: true
        });
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE
        setGpsErrorState({
          title: '📍 Location is turned off',
          msg: 'Please turn on Location/GPS on your device and try again.',
          isDenied: false
        });
      } else if (err.code === 3) {
        // TIMEOUT
        setGpsErrorState({
          title: '⏱️ Location Timeout',
          msg: 'Unable to get an accurate location right now. Make sure Location is ON and move to an open area.',
          isDenied: false
        });
      } else {
        setGpsErrorState({
          title: '❌ Location Error',
          msg: 'Unable to detect your location. Please try again.',
          isDenied: false
        });
      }
    };

    // Primary High Accuracy Attempt
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestReading = pos;
        if (pos.coords.accuracy <= 50) {
          finalizeLocation(pos);
        } else {
          // If initial reading accuracy > 50m, sample for up to 4 seconds to pick the best reading
          const startTime = Date.now();
          watchId = navigator.geolocation.watchPosition(
            (watchPos) => {
              samplesCount++;
              if (!bestReading || watchPos.coords.accuracy < bestReading.coords.accuracy) {
                bestReading = watchPos;
              }
              if (watchPos.coords.accuracy <= 50 || (Date.now() - startTime) >= 4000) {
                finalizeLocation(bestReading);
              }
            },
            () => {
              finalizeLocation(bestReading);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );

          // Force finalize after 4 seconds max if watchPosition stays open
          setTimeout(() => {
            if (watchId !== null) {
              finalizeLocation(bestReading);
            }
          }, 4500);
        }
      },
      handleGpsError,
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A', margin: '0 0 2px 0', letterSpacing: '-0.02em' }}>
            ⚙️ Setup & Configuration
          </h2>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
            Configure restaurant profile, sound alerts, menu settings, GPS geofence, and security
          </span>
        </div>

        {saveSuccessMsg && (
          <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '6px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>
            {saveSuccessMsg}
          </span>
        )}
      </div>

      {/* Grouped Section Control Center */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* OPERATIONS GROUP */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
            🚀 OPERATIONS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            <div
              onClick={() => setOpenDrawer('devices')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bell size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Orders & Devices</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Siren audio alert, push alerts, thermal printer</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>

            <div
              onClick={() => setOpenDrawer('menu')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Utensils size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Menu & GST</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>5% GST tax billing, currency symbol, badge visibility</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>

            <div
              onClick={() => setOpenDrawer('location')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Location & GPS Geofence</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Configure on-premise customer presence verification and geofence settings</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* BUSINESS GROUP */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
            🏢 BUSINESS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            <div
              onClick={() => setOpenDrawer('profile')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#0F172A', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Store size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Restaurant Profile</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Name, logo, phone, address, FSSAI, Maps</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>

            <div
              onClick={() => setOpenDrawer('subscription')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CreditCard size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Subscription & Billing</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Current plan, auto-renew status</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* SECURITY GROUP */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
            🔒 SECURITY
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            <div
              onClick={() => setOpenDrawer('security')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Admin Security</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Owner username and master login password</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* ADVANCED GROUP */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
            ⚡ ADVANCED
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            <div
              onClick={() => onNavigate && onNavigate('qr-generator')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Printer size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>QR Standees & Table Stickers</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Generate & print table QR standees & stickers</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>

            <div
              onClick={() => onNavigate && onNavigate('review')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Reviews & AI Auto-Reply</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Google review link & instant AI review assistant</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>

            <div
              onClick={() => onOptimizeDatabase && onOptimizeDatabase()}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Upload size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Database Tools</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>Purge temporary logs & optimize database engine</span>
                </div>
              </div>
              <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Drawer 1: Restaurant Profile */}
      <AdminDrawer
        isOpen={openDrawer === 'profile'}
        onClose={() => setOpenDrawer(null)}
        title="🏪 Restaurant Profile"
        subtitle="Public business identity and contact details"
        footer={(
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Profile Changes
          </button>
        )}
      >
        <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem' }}>
          {/* Logo Upload Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            {settingsForm.logo ? (
              <img src={settingsForm.logo} alt="Logo" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #CBD5E1' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: '#0F172A', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem' }}>LOGO</div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Restaurant Logo:
              </label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ fontSize: '0.78rem' }} />
              {uploadingLogo && <span style={{ fontSize: '0.72rem', color: '#059669', display: 'block', marginTop: '4px', fontWeight: 700 }}>Uploading logo image...</span>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Restaurant Name:
            </label>
            <input
              type="text"
              required
              value={settingsForm.name || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tagline / Slogan:
            </label>
            <input
              type="text"
              placeholder="e.g. Pure Veg Family Restaurant & Bakery"
              value={settingsForm.tagline || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Customer Menu Luxury Theme:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {[
                { key: 'gold', name: 'Gold & Forest Green', color: '#0A2315', accent: '#D4AF37', desc: 'Taj/Oberoi Luxury' },
                { key: 'emerald', name: 'Emerald Mint', color: '#064E3B', accent: '#34D399', desc: 'Fresh & Eco Style' },
                { key: 'crimson', name: 'Crimson Ruby', color: '#881337', accent: '#FB7185', desc: 'Royal Fine-Dine' },
                { key: 'navy', name: 'Midnight Navy', color: '#0F172A', accent: '#60A5FA', desc: 'Sleek Modern Bistro' },
              ].map(t => {
                const isSelected = (settingsForm.theme_color || 'gold') === t.key;
                return (
                  <div
                    key={t.key}
                    onClick={() => setSettingsForm({ ...settingsForm, theme_color: t.key })}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #059669' : '1px solid #E2E8F0',
                      background: isSelected ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(5, 150, 105, 0.15)' : 'none'
                    }}
                  >
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.color, border: `2px solid ${t.accent}`, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? '#059669' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contact Phone:
            </label>
            <input
              type="text"
              value={settingsForm.phone || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              FSSAI License Number:
            </label>
            <input
              type="text"
              placeholder="e.g. 12345678901234"
              value={settingsForm.fssai_lic_no || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, fssai_lic_no: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Opening Hours:
            </label>
            <input
              type="text"
              placeholder="e.g. 10:00 AM - 11:00 PM Daily"
              value={settingsForm.openingHours || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, openingHours: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Google Maps Location Link:
            </label>
            <input
              type="url"
              placeholder="https://maps.google.com/..."
              value={settingsForm.google_maps_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_url: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Google Review Page Link:
            </label>
            <input
              type="url"
              placeholder="https://g.page/r/..."
              value={settingsForm.google_review_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Address:
            </label>
            <textarea
              rows={2}
              value={settingsForm.address || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🌐 Custom Menu Domain (CNAME):
              <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', fontWeight: 800 }}>
                ENABLED
              </span>
            </label>
            <input
              type="text"
              placeholder="e.g. menu.yourrestaurant.com"
              value={settingsForm.custom_domain || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, custom_domain: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px' }}>
              Point CNAME record in GoDaddy to: <strong style={{ color: '#059669' }}>cname.vercel-dns.com</strong>
            </div>
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
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Device Settings
          </button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: Siren Audio Alert Box */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  🔊
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Live Order Siren Ringtone</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Swiggy/Zomato style order alert sound</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settingsForm.order_alarm_enabled !== false}
                onChange={(e) => setSettingsForm({ ...settingsForm, order_alarm_enabled: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#059669' }}
              />
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.45, paddingLeft: '46px' }}>
              Plays a loud ringing alarm automatically whenever a new customer table order arrives.
            </p>
            <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
              <button
                type="button"
                onClick={testAlarmSound}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: '#FFFBEB',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Volume2 size={15} /> Test Siren Sound
              </button>
              <button
                type="button"
                onClick={requestPushPermission}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                🔔 Push Notifications
              </button>
            </div>
          </div>

          {/* Card 2: Kitchen Display System (KDS) Screen Toggle */}
          {(() => {
            const isKdsPlanAllowed = Boolean(
              settingsForm?.kds_enabled === 1 ||
              settingsForm?.kds_enabled === true ||
              settingsForm?.kds_enabled === '1' ||
              restaurantInfo?.kds_enabled === 1 ||
              restaurantInfo?.kds_enabled === true ||
              restaurantInfo?.kds_enabled === '1' ||
              restaurantInfo?.permissions?.kds_enabled === true
            );

            return (
              <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      🍳
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Kitchen Display System (KDS)</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Dedicated kitchen tablet screen for chef prep</span>
                    </div>
                  </div>
                  {isKdsPlanAllowed ? (
                    <input
                      type="checkbox"
                      checked={settingsForm.kds_screen_enabled !== false && settingsForm.kds_screen_enabled !== 0}
                      onChange={(e) => setSettingsForm({ ...settingsForm, kds_screen_enabled: e.target.checked ? 1 : 0 })}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#059669' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '3px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      🔒 Enterprise Feature
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0, lineHeight: 1.45, paddingLeft: '46px' }}>
                  {isKdsPlanAllowed 
                    ? 'Enables the fullscreen Kitchen Display Screen tab for chef order preparation and instant completed alerts.' 
                    : 'Kitchen Display screen access is restricted to the Enterprise Plan tier. Contact SuperAdmin to upgrade.'}
                </p>
              </div>
            );
          })()}

          {/* Card 3: Printer Setup Box */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  🖨️
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Thermal Receipt Printer & Routing</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>58mm / 80mm ESC/POS, Bluetooth, USB & RawBT</span>
                </div>
              </div>
              {(() => {
                const isDualAllowed = Boolean(
                  settingsForm?.dual_printer_enabled === 1 ||
                  settingsForm?.dual_printer_enabled === true ||
                  settingsForm?.dual_printer_enabled === '1'
                );
                return (
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.70rem',
                    fontWeight: 900,
                    background: isDualAllowed ? '#DCFCE7' : '#F1F5F9',
                    color: isDualAllowed ? '#15803D' : '#64748B',
                    border: `1px solid ${isDualAllowed ? '#86EFAC' : '#CBD5E1'}`
                  }}>
                    {isDualAllowed ? '⚡ DUAL PRINTER READY (VIP ULTRA)' : '🔒 SINGLE PRINTER MODE'}
                  </span>
                );
              })()}
            </div>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0', lineHeight: 1.45, paddingLeft: '46px' }}>
              Configure Kitchen Order Ticket (KOT) and Counter Customer Bill thermal printing.
            </p>

            <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(() => {
                const isDualAllowed = Boolean(
                  settingsForm?.dual_printer_enabled === 1 ||
                  settingsForm?.dual_printer_enabled === true ||
                  settingsForm?.dual_printer_enabled === '1'
                );

                return (
                  <>
                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Printer Routing Mode:
                      </label>

                      <select
                        value={isDualAllowed ? (settingsForm.printer_mode || 'single') : 'single'}
                        onChange={(e) => {
                          if (!isDualAllowed) return;
                          setSettingsForm({ ...settingsForm, printer_mode: e.target.value });
                        }}
                        disabled={!isDualAllowed}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box' }}
                      >
                        <option value="single">🟢 Single Printer (Same Printer for KOT & Customer Bill)</option>
                        {isDualAllowed && (
                          <option value="dual">⚡ Dual Separate Printers (Kitchen KOT + Counter Bill)</option>
                        )}
                      </select>
                    </div>

                    {/* Single Mode Card */}
                    {(!isDualAllowed || settingsForm.printer_mode !== 'dual') && (
                      <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <strong style={{ fontSize: '0.84rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🖨️ Main Receipt Printer (KOT & Billing)
                        </strong>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '3px' }}>
                              PAPER WIDTH:
                            </label>
                            <select
                              value={settingsForm.printer_paper_width || '80mm'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, printer_paper_width: e.target.value })}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                            >
                              <option value="80mm">80mm (Standard 3-Inch)</option>
                              <option value="58mm">58mm (Compact 2-Inch)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '3px' }}>
                              CONNECTION:
                            </label>
                            <select
                              value={settingsForm.connection_type || 'browser_dialog'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, connection_type: e.target.value })}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                            >
                              <option value="browser_dialog">Default OS / Browser Dialog</option>
                              <option value="rawbt">Android RawBT Direct App</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={settingsForm.auto_print_kot === 1 || settingsForm.auto_print_kot === true}
                              onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_kot: e.target.checked ? 1 : 0 })}
                            />
                            <span>Auto-prompt KOT print on new live orders</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={settingsForm.auto_print_bill === 1 || settingsForm.auto_print_bill === true}
                              onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_bill: e.target.checked ? 1 : 0 })}
                            />
                            <span>Auto-prompt Bill print on table settlement</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Dual Mode Cards */}
                    {isDualAllowed && settingsForm.printer_mode === 'dual' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Kitchen Printer Card */}
                        <div style={{ padding: '14px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.86rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🍳 KITCHEN PRINTER (KOT Receipts Only)
                            </strong>
                            <span style={{ fontSize: '0.70rem', background: '#F59E0B', color: '#FFF', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>KITCHEN</span>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#78350F', display: 'block', marginBottom: '2px' }}>
                              PRINTER NAME / TARGET:
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Kitchen_Thermal_KOT or 192.168.1.200"
                              value={settingsForm.kot_printer_target || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, kot_printer_target: e.target.value })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '0.84rem', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#78350F', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={settingsForm.auto_print_kot === 1 || settingsForm.auto_print_kot === true}
                                onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_kot: e.target.checked ? 1 : 0 })}
                              />
                              <span>Auto-print KOT on new round</span>
                            </label>
                          </div>
                        </div>

                        {/* Counter Billing Printer Card */}
                        <div style={{ padding: '14px', background: '#E0F2FE', borderRadius: '12px', border: '1px solid #BAE6FD', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.86rem', color: '#0369A1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🧾 COUNTER BILLING PRINTER (Customer Invoices Only)
                            </strong>
                            <span style={{ fontSize: '0.70rem', background: '#0284C7', color: '#FFF', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>COUNTER</span>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#075985', display: 'block', marginBottom: '2px' }}>
                              PRINTER NAME / TARGET:
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Counter_Bill_Thermal or 192.168.1.201"
                              value={settingsForm.bill_printer_target || ''}
                              onChange={(e) => setSettingsForm({ ...settingsForm, bill_printer_target: e.target.value })}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '0.84rem', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#075985', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={settingsForm.auto_print_bill === 1 || settingsForm.auto_print_bill === true}
                                onChange={(e) => setSettingsForm({ ...settingsForm, auto_print_bill: e.target.checked ? 1 : 0 })}
                              />
                              <span>Auto-print Bill on settlement</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <button
                onClick={() => { setOpenDrawer(null); setShowPrinterModal(true); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  fontWeight: 800,
                  fontSize: '0.80rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={15} /> Open Printer Pairing Guide & Test Suite
              </button>
            </div>
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
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Menu & Tax Settings
          </button>
        )}
      >
        <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: Business Profile */}
          {(() => {
            const resolvedProfile = resolveBusinessProfile(settingsForm);
            const currentBusinessType = settingsForm.business_type || resolvedProfile.business_type;
            const currentFoodType = settingsForm.food_type || resolvedProfile.food_type;
            const currentServiceModel = settingsForm.service_model || resolvedProfile.service_model;

            const isLegacyBiz = settingsForm.business_type == null;
            const isLegacyFood = settingsForm.food_type == null;
            const isLegacyService = settingsForm.service_model == null;

            return (
              <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    🏢
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Business Profile</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Configure business venue type, customer dietary profile, and service model</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '46px' }}>
                  {/* Control A: Business Type */}
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label htmlFor="admin-business-type" style={{ fontSize: '0.80rem', fontWeight: 800, color: '#1E293B' }}>
                        Business Type
                      </label>
                      {isLegacyBiz && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '2px 6px', borderRadius: '8px' }}>
                          Using legacy setting
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Select the type of business or venue that operates this TouchQR account.
                    </span>
                    <select
                      id="admin-business-type"
                      value={currentBusinessType || 'restaurant'}
                      onChange={(e) => {
                        const newBiz = e.target.value;
                        const safeResto = (currentFoodType === 'pure_veg' ? 'pure_veg' : currentFoodType === 'veg_nonveg' ? 'veg_nonveg' : (newBiz === 'bakery_confectionery' ? 'bakery' : 'pure_veg'));
                        setSettingsForm({
                          ...settingsForm,
                          business_type: newBiz,
                          resto_type: safeResto
                        });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 700, background: '#FFFFFF', color: '#0F172A' }}
                    >
                      {BUSINESS_TYPES.map(type => (
                        <option key={type} value={type}>
                          {BUSINESS_TYPE_METADATA[type]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[type]?.label || type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Control B: Food Type */}
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label htmlFor="admin-food-type" style={{ fontSize: '0.80rem', fontWeight: 800, color: '#1E293B' }}>
                        Food Type
                      </label>
                      {isLegacyFood && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '2px 6px', borderRadius: '8px' }}>
                          Using legacy setting
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Tell customers what dietary profile applies to this menu.
                    </span>
                    <select
                      id="admin-food-type"
                      value={currentFoodType || 'pure_veg'}
                      onChange={(e) => {
                        const newFood = e.target.value;
                        const safeResto = (newFood === 'pure_veg' ? 'pure_veg' : newFood === 'veg_nonveg' ? 'veg_nonveg' : (currentBusinessType === 'bakery_confectionery' ? 'bakery' : 'pure_veg'));
                        setSettingsForm({
                          ...settingsForm,
                          food_type: newFood,
                          resto_type: safeResto
                        });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 700, background: '#FFFFFF', color: '#0F172A' }}
                    >
                      {FOOD_TYPES.map(type => (
                        <option key={type} value={type}>
                          {FOOD_TYPE_METADATA[type]?.icon || '🥗'} {FOOD_TYPE_METADATA[type]?.label || type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Control C: Service Model */}
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label htmlFor="admin-service-model" style={{ fontSize: '0.80rem', fontWeight: 800, color: '#1E293B' }}>
                        Service Model
                      </label>
                      {isLegacyService && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '2px 6px', borderRadius: '8px' }}>
                          Using legacy setting
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      How orders are fulfilled and served to customers.
                    </span>
                    <select
                      id="admin-service-model"
                      value={currentServiceModel || 'dine_in_table'}
                      onChange={(e) => {
                        setSettingsForm({
                          ...settingsForm,
                          service_model: e.target.value
                        });
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 700, background: '#FFFFFF', color: '#0F172A' }}
                    >
                      {SERVICE_MODELS.map(model => (
                        <option key={model} value={model}>
                          {SERVICE_MODEL_METADATA[model]?.icon || '🛎️'} {SERVICE_MODEL_METADATA[model]?.label || model}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preview Box */}
                  <div style={{ padding: '10px 12px', background: '#F1F5F9', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      ✨ Business Profile Preview
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {BUSINESS_TYPE_METADATA[currentBusinessType]?.icon || '🍽️'} Business: {BUSINESS_TYPE_METADATA[currentBusinessType]?.label?.replace(/\s*\(.*\)/, '') || currentBusinessType}
                      </span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {FOOD_TYPE_METADATA[currentFoodType]?.icon || '🟢'} Food: {FOOD_TYPE_METADATA[currentFoodType]?.label || currentFoodType}
                      </span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {SERVICE_MODEL_METADATA[currentServiceModel]?.icon || '🪑'} Service: {SERVICE_MODEL_METADATA[currentServiceModel]?.label || currentServiceModel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card 2: Currency Symbol */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                🪙
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Currency & Pricing Symbol</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Shown on customer QR menu and printed receipts</span>
              </div>
            </div>
            <div style={{ paddingLeft: '46px' }}>
              <select
                value={settingsForm.currency_symbol != null ? settingsForm.currency_symbol : '₹'}
                onChange={(e) => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF' }}
              >
                <option value="₹">₹ — Indian Rupee (INR)</option>
                <option value="$">$ — US Dollar (USD)</option>
                <option value="€">€ — Euro (EUR)</option>
                <option value="£">£ — British Pound (GBP)</option>
                <option value="د.إ">د.إ — UAE Dirham (AED)</option>
                <option value="﷼">﷼ — Saudi Riyal (SAR)</option>
              </select>
            </div>
          </div>

          {/* Card 3: GST Configuration */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: settingsForm.gst_enabled ? '10px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  🏷️
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>5% GST Tax Billing & Invoicing</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Adds 5% GST tax automatically on customer orders</span>
                </div>
              </div>

              {(settingsForm.gst_invoice_enabled !== false && settingsForm.gst_invoice_enabled !== 0) ? (
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.gst_enabled)}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gst_enabled: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#059669' }}
                />
              ) : (
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '3px 10px', borderRadius: '20px' }}>
                  🔒 Pro Feature
                </span>
              )}
            </div>

            {settingsForm.gst_enabled && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9', paddingLeft: '46px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  GSTIN Number:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10AAAAA0000A1Z5"
                  value={settingsForm.gstin_number || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, gstin_number: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px', display: 'block' }}>Printed on all customer receipt printouts and tax reports.</span>
              </div>
            )}
          </div>

          {/* Card 4: Dish Filter Visibility Toggles */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                👁️
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Customer Menu Badges & Filters</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Toggle badge visibility pills in the customer QR menu</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '46px' }}>
              {/* Filter 1 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1E293B', display: 'block' }}>⭐ "Must Try" Badge Filter</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Highlights chef special recommended items</span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.must_try !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, must_try: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </div>

              {/* Filter 2 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1E293B', display: 'block' }}>✨ "Today Special" Badge Filter</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Highlights daily limited-time special dishes</span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.special !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, special: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </div>

              {/* Filter 3 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1E293B', display: 'block' }}>🍱 "Combos" Navigation Tab</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Displays dedicated combos category tab</span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.filters_visibility?.combo !== false}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    filters_visibility: { ...settingsForm.filters_visibility, combo: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </form>
      </AdminDrawer>

      {/* Drawer 4: Location & GPS Geofence */}
      <AdminDrawer
        isOpen={openDrawer === 'location'}
        onClose={() => setOpenDrawer(null)}
        title="📍 Location & GPS Geofence"
        subtitle="Set coordinates to prevent fake orders from outside your restaurant"
        footer={(
          <button
            onClick={handleFormSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            Save Location & Geofence
          </button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: GPS Capture & Map Tool */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFE4E6', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                📍
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>GPS Coordinate Pinpoint</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Auto-detect or pin your exact restaurant entrance</span>
              </div>
            </div>

            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.45, paddingLeft: '46px' }}>
              Customers must be physically present inside this radius to place live table orders.
            </p>

            {/* Informational Presence Verification Mode Banner */}
            <div style={{ margin: '0 0 14px 46px', padding: '10px 14px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#166534" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 700 }}>
                Table Presence Verification: <strong>GPS + Staff Fallback</strong> (Active automatically with Direct QR Ordering)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={gpsLoading}
                style={{
                  flex: '1 1 140px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <MapPin size={15} />
                {gpsLoading ? 'Detecting GPS...' : gpsSuccessMsg ? '✓ GPS Captured' : '🎯 Auto Detect GPS'}
              </button>

              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                style={{
                  flex: '1 1 140px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Map size={15} />
                🗺️ Interactive Map
              </button>
            </div>

            {gpsSuccessMsg && (
              <div style={{ marginTop: '12px', marginLeft: '46px', background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: '10px', fontSize: '0.80rem', fontWeight: 800, border: '1px solid #86EFAC' }}>
                {gpsSuccessMsg}
              </div>
            )}

            {gpsErrorState && (
              <div style={{ marginTop: '12px', marginLeft: '46px', background: '#FEF2F2', color: '#DC2626', padding: '12px 14px', borderRadius: '10px', fontSize: '0.80rem', fontWeight: 700, border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '0.86rem' }}>{gpsErrorState.title}</strong>
                <div style={{ lineHeight: 1.4 }}>{gpsErrorState.msg}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    style={{ padding: '6px 12px', borderRadius: '8px', background: '#DC2626', color: '#FFF', border: 'none', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer' }}
                  >
                    Try Again
                  </button>
                  {gpsErrorState.isDenied && (
                    <button
                      type="button"
                      onClick={() => alert('📱 How to Allow Location Access:\n\n1. Tap the 🔒 lock or ⓘ info icon in your browser address bar\n2. Tap "Site Settings" or "Permissions"\n3. Change "Location" from Blocked to Allow\n4. Refresh the page and click Detect Current Location again.')}
                      style={{ padding: '6px 12px', borderRadius: '8px', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer' }}
                    >
                      How to Allow
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Current GPS Coordinates */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                🌐
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Entrance Coordinates</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Sub-meter precision latitude and longitude</span>
              </div>
            </div>

            <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Latitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 26.0602"
                    value={settingsForm.latitude || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, latitude: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Longitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 85.1634"
                    value={settingsForm.longitude || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, longitude: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.88rem', fontWeight: 700, boxSizing: 'border-box', background: '#FFFFFF' }}
                  />
                </div>
              </div>

              {settingsForm.latitude && settingsForm.longitude && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <a
                    href={`https://www.google.com/maps?q=${settingsForm.latitude},${settingsForm.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.74rem', color: '#0284C7', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Verify on Google Maps ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Geofence Ordering Radius */}
          <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                🎯
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>Max Ordering Distance Boundary</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Geofence restriction radius in meters</span>
              </div>
            </div>

            <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="20"
                  max="5000"
                  value={settingsForm.max_distance_meters || 100}
                  onChange={(e) => setSettingsForm({ ...settingsForm, max_distance_meters: parseInt(e.target.value) || 100 })}
                  style={{ width: '100%', padding: '10px 80px 10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box' }}
                />
                <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>
                  meters
                </span>
              </div>

              {/* Quick Preset Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { label: '50m (Dining Hall)', val: 50 },
                  { label: '100m (Standard)', val: 100 },
                  { label: '250m (Premises)', val: 250 },
                  { label: '500m (Zone)', val: 500 },
                ].map(p => {
                  const isActive = (settingsForm.max_distance_meters || 100) === p.val;
                  return (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, max_distance_meters: p.val })}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: isActive ? '1.5px solid #059669' : '1px solid #E2E8F0',
                        background: isActive ? '#DCFCE7' : '#F8FAFC',
                        color: isActive ? '#15803D' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <LocationPickerModal
            isOpen={showMapModal}
            onClose={() => setShowMapModal(false)}
            initialLat={Number(settingsForm.latitude) || 26.6500}
            initialLng={Number(settingsForm.longitude) || 86.5800}
            initialRadius={Number(settingsForm.max_distance_meters) || 100}
            initialAddress={settingsForm.address || ''}
            onSave={(loc) => {
              setSettingsForm(prev => ({
                ...prev,
                latitude: loc.latitude,
                longitude: loc.longitude,
                max_distance_meters: loc.max_distance_meters,
                location_initialized: true
              }));
              setGpsSuccessMsg(`✓ Location & Geofence updated via interactive map!`);
              setTimeout(() => setGpsSuccessMsg(''), 5000);
            }}
          />
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
          <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Current Plan:</span>
              <strong style={{ color: '#059669', fontWeight: 900 }}>{(restaurantInfo?.plan_tier || 'pro').toUpperCase()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Subscription Type:</span>
              <strong style={{ color: restaurantInfo?.subscription_type === 'ADMIN_GRANTED' ? '#7E22CE' : '#0F172A', fontWeight: 800 }}>
                {restaurantInfo?.subscription_type === 'ADMIN_GRANTED' ? '🎁 COMPLIMENTARY (FREE)' : 'PAID CASHFREE'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Access Expiry:</span>
              <strong style={{ color: '#0F172A', fontWeight: 800 }}>
                {restaurantInfo?.subscription_type === 'ADMIN_GRANTED' || (restaurantInfo?.access_until && new Date(restaurantInfo.access_until).getFullYear() > 2030)
                  ? '♾️ Lifetime Access'
                  : restaurantInfo?.access_until ? new Date(restaurantInfo.access_until).toLocaleDateString('en-IN') : 'N/A'
                }
              </strong>
            </div>
          </div>

          <button
            onClick={() => { setOpenDrawer(null); onOpenBillingModal(); }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: '#0F172A',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
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
          <button
            onClick={handleSecuritySave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: '#DC2626',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.90rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
            }}
          >
            Update Security Credentials
          </button>
        )}
      >
        <form onSubmit={handleSecuritySave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
          {credMsg?.text && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800,
              background: credMsg.type === 'error' ? '#FEE2E2' : '#DCFCE7',
              color: credMsg.type === 'error' ? '#DC2626' : '#15803D',
              border: `1px solid ${credMsg.type === 'error' ? '#FECACA' : '#86EFAC'}`
            }}>
              {credMsg.text}
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Password (Required):
            </label>
            <input
              type="password"
              required
              value={credForm.currentPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, currentPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New Owner Username:
            </label>
            <input
              type="text"
              placeholder="Leave blank to keep unchanged"
              value={credForm.newUsername || ''}
              onChange={(e) => setCredForm({ ...credForm, newUsername: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New Password:
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={credForm.newPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Confirm New Password:
            </label>
            <input
              type="password"
              placeholder="Re-enter new password"
              value={credForm.confirmPassword || ''}
              onChange={(e) => setCredForm({ ...credForm, confirmPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
        </form>
      </AdminDrawer>
    </div>
  );
}
