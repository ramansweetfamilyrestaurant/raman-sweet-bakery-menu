import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Clock, 
  Maximize2, 
  Minimize2, 
  Flame, 
  Bell, 
  BellRing,
  AlertTriangle, 
  Lock, 
  KeyRound, 
  CheckCircle, 
  Delete, 
  LogOut,
  RotateCcw,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';

export default function StandaloneKdsPage({ slug = '' }) {
  const [orders, setOrders] = useState([]);
  const [restaurantName, setRestaurantName] = useState('Kitchen Display System');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [kdsDisabled, setKdsDisabled] = useState(false);
  const [needsPinUnlock, setNeedsPinUnlock] = useState(false);
  const [pinUnconfigured, setPinUnconfigured] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [restaurantMeta, setRestaurantMeta] = useState(null);
  const [checkedItemsMap, setCheckedItemsMap] = useState({});
  const [showPrepSummary, setShowPrepSummary] = useState(true);
  const [recentlyCompleted, setRecentlyCompleted] = useState([]);
  const [showCompletedDrawer, setShowCompletedDrawer] = useState(false);

  const knownOrderIdsRef = useRef(null);

  const resolveCurrentSlug = () => {
    if (slug) return slug;
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[parts.length - 1] === 'kitchen') {
      return parts[parts.length - 2];
    } else if (parts.length > 0 && parts[0] !== 'kitchen') {
      return parts[0];
    }
    const searchSlug = new URLSearchParams(window.location.search).get('slug');
    if (searchSlug) return searchSlug;
    return localStorage.getItem('touchqr_admin_slug') || localStorage.getItem('touchqr_last_slug') || '';
  };

  const getStoredKdsToken = (targetSlug) => {
    if (!targetSlug) return '';
    return localStorage.getItem(`touchqr_kds_token_${targetSlug}`) || '';
  };

  const setStoredKdsToken = (targetSlug, token) => {
    if (!targetSlug) return;
    localStorage.setItem(`touchqr_kds_token_${targetSlug}`, token);
  };

  const clearStoredKdsToken = (targetSlug) => {
    if (!targetSlug) return;
    localStorage.removeItem(`touchqr_kds_token_${targetSlug}`);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const playSiren = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const pulses = [
        { freq1: 1050, freq2: 1650, start: 0.0 },
        { freq1: 1350, freq2: 1850, start: 0.30 },
        { freq1: 1050, freq2: 1650, start: 0.60 },
        { freq1: 1450, freq2: 2050, start: 0.90 },
        { freq1: 1250, freq2: 1750, start: 1.20 },
        { freq1: 1550, freq2: 2150, start: 1.50 },
        { freq1: 1350, freq2: 1850, start: 1.80 },
        { freq1: 1650, freq2: 2250, start: 2.10 }
      ];

      pulses.forEach(p => {
        const t = ctx.currentTime + p.start;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(p.freq1, t);
        osc1.frequency.linearRampToValueAtTime(p.freq2, t + 0.14);
        gain1.gain.setValueAtTime(1.0, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(t);
        osc1.stop(t + 0.28);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(p.freq2, t + 0.10);
        osc2.frequency.linearRampToValueAtTime(p.freq1, t + 0.24);
        gain2.gain.setValueAtTime(0.9, t + 0.10);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t + 0.10);
        osc2.stop(t + 0.28);
      });
      if ('vibrate' in navigator) {
        navigator.vibrate([400, 200, 400, 200, 600]);
      }
    } catch (e) {
      console.warn('Standalone KDS Siren error:', e);
    }
  };

  const playSirenFor8Seconds = () => {
    try {
      const startTime = Date.now();
      playSiren();
      const sirenTimer = setInterval(() => {
        if (Date.now() - startTime >= 8000) {
          clearInterval(sirenTimer);
        } else {
          playSiren();
        }
      }, 2400);
    } catch (e) {
      console.warn('8-second Siren error:', e);
    }
  };

  const unlockAudio = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
      }
      playSiren();
    } catch (e) {}
    setAudioUnlocked(true);
  };

  const fetchOrders = async () => {
    const targetSlug = resolveCurrentSlug();
    if (!targetSlug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const token = getStoredKdsToken(targetSlug);
    if (!token) {
      setNeedsPinUnlock(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/kitchen/orders?slug=${encodeURIComponent(targetSlug)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'KDS_DISABLED') {
          setKdsDisabled(true);
          setLoading(false);
          return;
        }
        if (errData.error === 'KDS_NOT_CONFIGURED') {
          setPinUnconfigured(true);
          setLoading(false);
          return;
        }
        clearStoredKdsToken(targetSlug);
        setNeedsPinUnlock(true);
        if (errData.message) {
          setPinError(errData.message);
        }
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setNeedsPinUnlock(false);
        setPinUnconfigured(false);
        if (data.restaurant?.name) {
          setRestaurantName(data.restaurant.name);
        }
        const activeOrders = Array.isArray(data.orders) ? data.orders : [];
        const currentIds = new Set(activeOrders.map(o => String(o.id)));

        if (knownOrderIdsRef.current !== null) {
          let hasNewOrder = false;
          for (const id of currentIds) {
            if (!knownOrderIdsRef.current.has(id)) {
              hasNewOrder = true;
              break;
            }
          }
          if (hasNewOrder) {
            playSirenFor8Seconds();
          }
        }
        knownOrderIdsRef.current = currentIds;
        setOrders(activeOrders);
      }
    } catch (e) {
      console.warn('Failed to poll kitchen orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [slug]);

  const handleVerifyPin = async (e) => {
    if (e) e.preventDefault();
    const cleanPin = pinInput.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setPinError('Please enter a valid 4-digit numeric PIN');
      return;
    }

    const targetSlug = resolveCurrentSlug();
    if (!targetSlug) return;

    setPinSubmitting(true);
    setPinError('');
    try {
      const res = await fetch('/api/kitchen/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: targetSlug, pin: cleanPin })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setStoredKdsToken(targetSlug, data.token);
        setNeedsPinUnlock(false);
        setPinInput('');
        setPinError('');
        if (data.restaurant?.name) {
          setRestaurantName(data.restaurant.name);
        }
        fetchOrders();
      } else {
        if (data.error === 'KDS_NOT_CONFIGURED') {
          setPinUnconfigured(true);
        } else if (data.error === 'KDS_DISABLED') {
          setKdsDisabled(true);
        } else {
          setPinError(data.message || 'Incorrect 4-digit Kitchen PIN');
        }
      }
    } catch (err) {
      setPinError('Connection error. Please check your network and try again.');
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleKeypadPress = (val) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + val;
      setPinInput(newPin);
      setPinError('');
      if (newPin.length === 4) {
        setTimeout(() => {
          const cleanPin = newPin.trim();
          const targetSlug = resolveCurrentSlug();
          if (!targetSlug || !/^\d{4}$/.test(cleanPin)) return;
          setPinSubmitting(true);
          fetch('/api/kitchen/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: targetSlug, pin: cleanPin })
          })
            .then(r => r.json().then(data => ({ ok: r.ok, data })))
            .then(({ ok, data }) => {
              if (ok && data.success && data.token) {
                setStoredKdsToken(targetSlug, data.token);
                setNeedsPinUnlock(false);
                setPinInput('');
                setPinError('');
                if (data.restaurant?.name) setRestaurantName(data.restaurant.name);
                fetchOrders();
              } else {
                if (data.error === 'KDS_NOT_CONFIGURED') {
                  setPinUnconfigured(true);
                } else if (data.error === 'KDS_DISABLED') {
                  setKdsDisabled(true);
                } else {
                  setPinError(data.message || 'Incorrect 4-digit Kitchen PIN');
                  setPinInput('');
                }
              }
            })
            .catch(() => {
              setPinError('Connection error. Please try again.');
            })
            .finally(() => setPinSubmitting(false));
        }, 100);
      }
    }
  };

  const handleKeypadDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
    setPinError('');
  };

  const handleKeypadClear = () => {
    setPinInput('');
    setPinError('');
  };

  const handleLockScreen = () => {
    const targetSlug = resolveCurrentSlug();
    clearStoredKdsToken(targetSlug);
    setNeedsPinUnlock(true);
    setOrders([]);
  };

  const handleMarkPrepared = async (orderId) => {
    const targetSlug = resolveCurrentSlug();
    const token = getStoredKdsToken(targetSlug);
    try {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      const res = await fetch(`/api/kitchen/orders/${orderId}/complete?slug=${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.status === 401 || res.status === 403) {
        clearStoredKdsToken(targetSlug);
        setNeedsPinUnlock(true);
      }
      fetchOrders();
    } catch (e) {
      alert('Failed to mark order prepared');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const getElapsedMins = (createdAt) => {
    if (!createdAt) return 0;
    const orderTime = new Date(createdAt).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - orderTime) / 60000));
  };

  const safeParseItems = (rawItems) => {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'string') {
      try {
        const parsed = JSON.parse(rawItems);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const parseItems = safeParseItems;

  useEffect(() => {
    const targetSlug = resolveCurrentSlug();
    if (targetSlug) {
      fetch(`/api/info?slug=${encodeURIComponent(targetSlug)}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.name) {
            setRestaurantName(d.name);
            setRestaurantMeta(d);
          }
        })
        .catch(() => {});
    }
  }, [slug]);

  const formatKdsLocation = (raw, spaceType, fallbackPrefix = null) => {
    if (!raw) return 'TAKEAWAY';
    const str = String(raw).trim();

    const cMatch = str.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                   str.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
    if (cMatch) {
      return `🎬 SCREEN ${cMatch[1]} • ROW ${cMatch[2].toUpperCase()} • SEAT ${cMatch[3]}`;
    }
    if (str.toLowerCase().startsWith('screen')) {
      return `🎬 ${str.toUpperCase()}`;
    }

    const cleanSpaceType = spaceType ? String(spaceType).trim().toLowerCase() : null;

    if (cleanSpaceType === 'cinema_seat' || cleanSpaceType === 'cinema') {
      return `🎬 SEAT ${str.toUpperCase()}`;
    }
    if (cleanSpaceType === 'room') return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (cleanSpaceType === 'cabin') return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (cleanSpaceType === 'vip') return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (cleanSpaceType === 'table') {
      const numOnly = str.replace(/^table\s*#?/i, '');
      return `TABLE ${numOnly}`;
    }

    if (/^room\s*#?\d+/i.test(str)) return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (/^cabin\s*#?\d+/i.test(str)) return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (/^vip\s*#?\d+/i.test(str)) return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (/^(takeaway|parcel)/i.test(str) || /^[\p{Extended_Pictographic}\u2000-\u3300]/u.test(str)) {
      return str.toUpperCase();
    }

    if (fallbackPrefix) {
      const cleanFallback = String(fallbackPrefix).trim().toLowerCase();
      if (cleanFallback === 'room') return `🏨 ROOM ${str}`;
      if (cleanFallback === 'cabin') return `🛋️ CABIN ${str}`;
      if (cleanFallback === 'vip') return `👑 VIP ${str}`;
      if (cleanFallback === 'cinema_seat' || cleanFallback === 'cinema') return `🎬 SEAT ${str.toUpperCase()}`;
    }

    return `TABLE ${str}`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <Flame size={48} color="#38BDF8" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F8FAFC', margin: '0 0 8px 0' }}>
          🍳 Connecting to Kitchen Display System...
        </h2>
        <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
          Verifying restaurant authorization & security permissions
        </span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          fontSize: '4.5rem', marginBottom: '16px', filter: 'drop-shadow(0 4px 16px rgba(239,68,68,0.3))'
        }}>❌</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F87171', margin: '0 0 8px 0' }}>
          404 - Restaurant Not Found
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          The kitchen screen you are trying to access does not exist. Please check the URL slug.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '13px 30px', borderRadius: '9999px', border: 'none',
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#0A0A0A', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,215,0,0.3)'
          }}
        >
          🏠 Go to TouchQR Homepage
        </button>
      </div>
    );
  }

  if (kdsDisabled) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: '#FEF3C7', color: '#B45309',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid #F59E0B'
        }}>
          <Flame size={38} color="#D97706" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FCD34D', margin: '0 0 8px 0' }}>
          🔒 Kitchen KDS Display Screen Locked
        </h1>
        <p style={{ fontSize: '0.94rem', color: '#94A3B8', maxWidth: '480px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          Dedicated Kitchen Display System (KDS) is locked for this restaurant under its current SaaS subscription plan tier. Please upgrade to Pro or Enterprise plan to unlock KDS.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '13px 30px', borderRadius: '9999px', border: 'none',
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#0A0A0A', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,215,0,0.3)'
          }}
        >
          🏠 Return to Homepage
        </button>
      </div>
    );
  }

  if (pinUnconfigured) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', background: '#FEE2E2', color: '#DC2626',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid #EF4444'
        }}>
          <Lock size={38} color="#DC2626" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#F87171', margin: '0 0 8px 0' }}>
          🔒 KDS Screen PIN Not Configured
        </h1>
        <p style={{ fontSize: '0.94rem', color: '#94A3B8', maxWidth: '480px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          The restaurant administrator has not set up a 4-digit Kitchen Display PIN yet. Please log into the Admin Dashboard and configure your KDS PIN under <strong>Setup → Security</strong> to activate this kitchen display screen.
        </p>
        <button
          onClick={() => { window.location.href = `/${resolveCurrentSlug()}/admin`; }}
          style={{
            padding: '13px 30px', borderRadius: '9999px', border: 'none',
            background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
            color: '#FFFFFF', fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(56,189,248,0.3)'
          }}
        >
          🔐 Go to Restaurant Admin Login
        </button>
      </div>
    );
  }

  if (needsPinUnlock) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
        background: 'linear-gradient(135deg, #090D16 0%, #111827 100%)',
        color: '#FFFFFF', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          background: '#0F172A', border: '1px solid #1E293B', borderRadius: '24px',
          padding: '32px 24px', maxWidth: '380px', width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)', textAlign: 'center'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px auto', boxShadow: '0 8px 24px rgba(56,189,248,0.3)'
          }}>
            <Lock size={28} color="#FFFFFF" />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#F8FAFC', margin: '0 0 4px 0' }}>
            {restaurantName}
          </h2>
          <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '20px' }}>
            🍳 Kitchen Display System (KDS) Screen Locked
          </span>

          {pinError && (
            <div style={{
              background: '#450A0A', border: '1px solid #EF4444', color: '#FCA5A5',
              padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800,
              marginBottom: '18px', textAlign: 'center'
            }}>
              ⚠️ {pinError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '24px' }}>
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                style={{
                  width: '52px', height: '56px', borderRadius: '14px',
                  background: '#1E293B', border: pinInput.length === idx ? '2px solid #38BDF8' : '1px solid #334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem', fontWeight: 900, color: '#F8FAFC',
                  boxShadow: pinInput.length === idx ? '0 0 12px rgba(56,189,248,0.3)' : 'none'
                }}
              >
                {pinInput[idx] ? '●' : ''}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                disabled={pinSubmitting}
                onClick={() => {
                  if (key === 'C') handleKeypadClear();
                  else if (key === '⌫') handleKeypadDelete();
                  else handleKeypadPress(key);
                }}
                style={{
                  padding: '16px 0', borderRadius: '14px', border: '1px solid #334155',
                  background: key === 'C' || key === '⌫' ? '#1E293B' : '#1E293B',
                  color: key === 'C' ? '#F87171' : key === '⌫' ? '#FBBF24' : '#F8FAFC',
                  fontSize: '1.25rem', fontWeight: 900, cursor: 'pointer',
                  transition: 'background 0.1s', userSelect: 'none'
                }}
              >
                {key}
              </button>
            ))}
          </div>

          <button
            onClick={handleVerifyPin}
            disabled={pinSubmitting || pinInput.length !== 4}
            style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: pinInput.length === 4
                ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                : '#334155',
              color: '#FFFFFF', fontWeight: 900, fontSize: '0.95rem',
              cursor: pinInput.length === 4 && !pinSubmitting ? 'pointer' : 'not-allowed',
              opacity: pinSubmitting ? 0.7 : 1,
              boxShadow: pinInput.length === 4 ? '0 4px 16px rgba(34,197,94,0.3)' : 'none'
            }}
          >
            {pinSubmitting ? '⏳ Verifying...' : '🔓 UNLOCK KITCHEN DISPLAY'}
          </button>

          <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '16px' }}>
            🔒 Authenticated & Scoped to {restaurantName}
          </span>
        </div>
      </div>
    );
  }

  const toggleItemCheck = (orderId, idx) => {
    const key = `${orderId}_${idx}`;
    setCheckedItemsMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleRecallOrder = async (order) => {
    if (!order) return;
    setRecentlyCompleted(prev => prev.filter(o => o.id !== order.id));
    setOrders(prev => [order, ...prev]);
    const targetSlug = resolveCurrentSlug();
    const token = getStoredKdsToken(targetSlug);
    try {
      await fetch(`/api/kitchen/orders/${order.id}/recall?slug=${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchOrders();
    } catch (e) {
      console.warn('Recall error:', e);
    }
  };

  const aggregatedPrepItems = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const items = parseItems(o.items);
      items.forEach(it => {
        const name = it.name || it.dish_name || 'Item';
        const qty = Number(it.quantity || it.qty || 1);
        const portion = it.portion ? ` (${it.portion})` : '';
        const key = `${name}${portion}`;
        map[key] = (map[key] || 0) + qty;
      });
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [orders]);

  const rushCount = orders.filter(o => getElapsedMins(o.created_at) >= 15).length;
  const totalDishesCount = orders.reduce((sum, o) => {
    const items = parseItems(o.items);
    return sum + items.reduce((iSum, it) => iSum + Number(it.quantity || it.qty || 1), 0);
  }, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#070B14', color: '#F8FAFC', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <style>{`
        .kds-card-rush-glow {
          box-shadow: 0 0 25px rgba(239, 68, 68, 0.35) !important;
          animation: kdsRushPulse 2s infinite ease-in-out;
        }
        @keyframes kdsRushPulse {
          0%, 100% { border-color: #EF4444; }
          50% { border-color: #F87171; box-shadow: 0 0 35px rgba(239, 68, 68, 0.55); }
        }
        .kds-item-row {
          transition: all 0.15s ease;
        }
        .kds-item-row:hover {
          background: #1E293B !important;
        }
        .kds-action-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }
      `}</style>

      {!audioUnlocked && (
        <div
          onClick={unlockAudio}
          style={{
            background: 'linear-gradient(90deg, #EA580C 0%, #DC2626 100%)',
            color: '#FFFFFF',
            padding: '14px 20px',
            borderRadius: '14px',
            marginBottom: '16px',
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '0.98rem',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(234, 88, 12, 0.4)',
            border: '2px solid #FDE047'
          }}
        >
          🔊 TAP HERE TO UNLOCK KITCHEN EMERGENCY ALARM SOUND & FULL LOUD SIREN
        </div>
      )}

      {/* TOP COMMAND HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px', background: 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)',
        padding: '14px 20px', borderRadius: '16px', border: '1px solid #1E293B', marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
          }}>
            🍳
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em' }}>
                {restaurantName} — KDS
              </h1>
              <span style={{ fontSize: '0.66rem', fontWeight: 900, background: '#10B981', color: '#022C22', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                LIVE CHEF SCREEN
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '0.74rem', color: '#94A3B8' }}>
              <span>Active Tickets: <strong style={{ color: '#38BDF8' }}>{orders.length}</strong></span>
              <span>•</span>
              <span>Total Dishes: <strong style={{ color: '#FCD34D' }}>{totalDishesCount} qty</strong></span>
              {rushCount > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: '#F87171', fontWeight: 800 }}>⚠️ {rushCount} RUSH (&gt;15m)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowPrepSummary(!showPrepSummary)}
            style={{
              height: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid #334155',
              background: showPrepSummary ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
              color: showPrepSummary ? '#38BDF8' : '#94A3B8', fontSize: '0.74rem', fontWeight: 800,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Layers size={14} />
            <span>{showPrepSummary ? 'Hide Totals' : 'Dish Totals'}</span>
          </button>

          {recentlyCompleted.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(!showCompletedDrawer)}
              style={{
                height: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid #334155',
                background: '#1E293B', color: '#F1F5F9', fontSize: '0.74rem', fontWeight: 800,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RotateCcw size={13} color="#F59E0B" />
              <span>Recall ({recentlyCompleted.length})</span>
            </button>
          )}

          <div style={{ background: '#0F172A', color: '#38BDF8', padding: '6px 12px', borderRadius: '10px', fontWeight: 900, fontSize: '0.84rem', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            <span>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              height: '36px', background: '#2563EB', border: 'none', color: '#F8FAFC', padding: '0 12px', borderRadius: '10px',
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem'
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={handleLockScreen}
            title="Lock Kitchen Display Screen"
            style={{
              height: '36px', background: '#450A0A', border: '1px solid #991B1B', color: '#FCA5A5', padding: '0 12px', borderRadius: '10px',
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem'
            }}
          >
            <Lock size={14} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* CHEF PREP SUMMARY MATRIX */}
      {showPrepSummary && aggregatedPrepItems.length > 0 && (
        <div style={{
          background: '#0D1526', border: '1px solid #1E293B', borderRadius: '14px',
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', color: '#94A3B8', fontSize: '0.70rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <Flame size={14} color="#F59E0B" />
            <span>Active Drop Totals:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            {aggregatedPrepItems.map(item => (
              <div
                key={item.name}
                style={{
                  background: '#1E293B', border: '1px solid #334155', borderRadius: '8px',
                  padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                }}
              >
                <span style={{ background: '#2563EB', color: '#FFFFFF', padding: '1px 6px', borderRadius: '5px', fontSize: '0.74rem', fontWeight: 900 }}>
                  {item.count}×
                </span>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F1F5F9' }}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECALL DRAWER */}
      {showCompletedDrawer && recentlyCompleted.length > 0 && (
        <div style={{
          background: '#0F172A', border: '1px solid #334155', borderRadius: '14px',
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#34D399', textTransform: 'uppercase' }}>
              ✓ Recently Prepared Orders (Click Undo to restore to active queue)
            </span>
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(false)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              Close ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {recentlyCompleted.map(ord => (
              <div
                key={ord.id}
                style={{
                  background: '#1E293B', border: '1px solid #334155', borderRadius: '10px',
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap'
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#F8FAFC' }}>
                    {formatKdsLocation(ord.table_number, ord.space_type)}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block' }}>
                    Order #{ord.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRecallOrder(ord)}
                  style={{
                    padding: '4px 8px', borderRadius: '6px', border: '1px solid #F59E0B',
                    background: 'rgba(245, 158, 11, 0.15)', color: '#FDE68A', fontSize: '0.70rem',
                    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <RotateCcw size={11} />
                  <span>Undo</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TICKETS GRID */}
      {orders.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', background: '#0B1120', borderRadius: '20px', border: '2px dashed #1E293B', maxWidth: '600px', margin: '40px auto' }}>
          <Flame size={56} color="#475569" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#94A3B8', margin: '0 0 8px 0' }}>
            Kitchen is Clear! Zero Active Orders
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
            New QR table orders will sound a loud siren alarm and display big tickets here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '14px' }}>
          {orders.map(order => {
            const elapsedMins = getElapsedMins(order.created_at);
            const isRush = elapsedMins >= 15;
            const isCritical = elapsedMins >= 25;
            const items = parseItems(order.items);
            const hasNotes = Boolean(order.notes || order.special_instructions || order.customer_notes);
            const notesText = order.notes || order.special_instructions || order.customer_notes || '';
            const allItemsChecked = items.length > 0 && items.every((_, idx) => checkedItemsMap[`${order.id}_${idx}`]);

            return (
              <div
                key={order.id}
                className={isRush ? 'kds-card-rush-glow' : ''}
                style={{
                  background: '#0E1626',
                  borderRadius: '16px',
                  border: isCritical ? '2px solid #EF4444' : isRush ? '2px solid #F59E0B' : '1.5px solid #1E293B',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden'
                }}
              >
                {/* TICKET TOP HEADER */}
                <div style={{
                  background: isCritical ? 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)' : (isRush ? 'linear-gradient(135deg, #78350F 0%, #92400E 100%)' : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'),
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '1.22rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {formatKdsLocation(order.table_number, order.space_type, restaurantMeta?.business_type === 'hotel_resort' ? 'room' : restaurantMeta?.table_prefix)}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: isRush ? '#FEF08A' : '#94A3B8', fontWeight: 700 }}>
                      Ticket #{order.id} • {order.customer_name || 'Dine-in'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      background: isCritical ? '#DC2626' : (isRush ? '#D97706' : '#2563EB'),
                      color: '#FFFFFF',
                      padding: '4px 9px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={13} />
                      <span>{elapsedMins}m ago</span>
                    </div>
                    {isRush && (
                      <span style={{ fontSize: '0.65rem', color: isCritical ? '#FCA5A5' : '#FDE68A', fontWeight: 900, display: 'block', marginTop: '2px' }}>
                        {isCritical ? '🚨 CRITICAL DELAY' : '⚠️ RUSH TICKET'}
                      </span>
                    )}
                  </div>
                </div>

                {/* TICKET BODY */}
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hasNotes && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1.5px solid #F59E0B',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      color: '#FDE68A',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <span style={{ fontSize: '0.66rem', color: '#FBBF24', textTransform: 'uppercase', display: 'block', letterSpacing: '0.04em' }}>
                          CHEF INSTRUCTION:
                        </span>
                        <span style={{ color: '#FFFFFF', fontWeight: 800 }}>"{notesText}"</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {items.map((item, idx) => {
                      const isChecked = Boolean(checkedItemsMap[`${order.id}_${idx}`]);
                      const rawMods = item.modifiers;
                      let mods = [];
                      if (Array.isArray(rawMods)) mods = rawMods;
                      else if (typeof rawMods === 'string') {
                        try { const p = JSON.parse(rawMods); if (Array.isArray(p)) mods = p; } catch {}
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemCheck(order.id, idx)}
                          className="kds-item-row"
                          style={{
                            background: isChecked ? 'rgba(30, 41, 59, 0.5)' : '#131D31',
                            border: '1px solid #1E293B',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            opacity: isChecked ? 0.6 : 1,
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              color: isChecked ? '#10B981' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>

                            <span style={{
                              background: isChecked ? '#334155' : '#2563EB',
                              color: '#FFFFFF',
                              minWidth: '28px',
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '7px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.90rem',
                              fontWeight: 900,
                              flexShrink: 0
                            }}>
                              ×{item.quantity || item.qty || 1}
                            </span>

                            <div style={{ minWidth: 0 }}>
                              <strong style={{
                                fontSize: '0.92rem',
                                color: isChecked ? '#94A3B8' : '#F8FAFC',
                                fontWeight: 800,
                                textDecoration: isChecked ? 'line-through' : 'none',
                                display: 'block',
                                lineHeight: 1.2
                              }}>
                                {item.name || item.dish_name}
                              </strong>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {item.portion && (
                                  <span style={{ fontSize: '0.68rem', color: '#93C5FD', fontWeight: 700, background: 'rgba(59, 130, 246, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                                    {item.portion}
                                  </span>
                                )}

                                {mods.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    style={{
                                      fontSize: '0.66rem',
                                      color: '#FEF08A',
                                      background: 'rgba(202, 138, 4, 0.2)',
                                      border: '1px solid #CA8A04',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: 800
                                    }}
                                  >
                                    ➕ {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TICKET FOOTER: READY BUTTON */}
                <div style={{ padding: '12px 14px', background: '#0A101C', borderTop: '1px solid #1E293B' }}>
                  <button
                    onClick={() => {
                      setRecentlyCompleted(prev => [{ ...order, completedAt: new Date() }, ...prev.slice(0, 9)]);
                      handleMarkPrepared(order.id);
                    }}
                    className="kds-action-btn"
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: 'none',
                      background: allItemsChecked 
                        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
                        : 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                      color: '#FFFFFF',
                      fontSize: '0.86rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <BellRing size={17} />
                    <span>🔔 READY • NOTIFY WAITER</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
