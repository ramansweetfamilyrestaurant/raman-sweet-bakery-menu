import React, { useState, useEffect } from 'react';
import { Clock, Maximize2, Minimize2, Flame, Bell, AlertTriangle } from 'lucide-react';

export default function StandaloneKdsPage({ slug = '' }) {
  const [orders, setOrders] = useState([]);
  const [restaurantName, setRestaurantName] = useState('Kitchen Display System');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

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

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1050, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1550, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  const [notFound, setNotFound] = useState(false);

  const fetchOrders = async () => {
    try {
      let targetSlug = slug;
      if (!targetSlug) {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length > 0 && parts[parts.length - 1] === 'kitchen') {
          targetSlug = parts.length > 1 ? parts[0] : '';
        }
      }
      if (!targetSlug) {
        setNotFound(true);
        return;
      }

      const res = await fetch(`/api/kitchen/orders?slug=${encodeURIComponent(targetSlug)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        if (data.restaurant?.name) {
          setRestaurantName(data.restaurant.name);
        }
        const activeOrders = Array.isArray(data.orders) ? data.orders : [];
        if (activeOrders.length > prevCount) {
          playSiren();
        }
        setPrevCount(activeOrders.length);
        setOrders(activeOrders);
      } else if (res.status === 404 || data.error === 'Restaurant not found') {
        setNotFound(true);
      }
    } catch (e) {
      console.warn('Failed to poll kitchen orders:', e);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [slug]);

  const handleMarkPrepared = async (orderId) => {
    try {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      await fetch(`/api/kitchen/orders/${orderId}/complete`, {
        method: 'PATCH'
      });
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

  const parseItems = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  };

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
          404 - Page Not Found
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '13px 30px',
            borderRadius: '9999px',
            border: 'none',
            background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#0A0A0A',
            fontWeight: 900,
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,215,0,0.3)'
          }}
        >
          🏠 Go to TouchQR Homepage
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090D16', color: '#F8FAFC', padding: '16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px', background: '#0F172A', padding: '14px 20px',
        borderRadius: '16px', border: '1px solid #1E293B', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
            <Flame size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F8FAFC', margin: 0, letterSpacing: '0.3px' }}>
              {restaurantName} — KITCHEN KDS
            </h1>
            <span style={{ fontSize: '0.78rem', color: '#38BDF8', fontWeight: 700 }}>
              ⚡ Dedicated Live Chef Screen • {orders.length} Active Kitchen Ticket(s)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#1E293B', color: '#38BDF8', padding: '8px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem', border: '1px solid #334155' }}>
            <Clock size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            {currentTime.toLocaleTimeString('en-IN')}
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              background: '#334155', border: 'none', color: '#F8FAFC', padding: '8px 14px', borderRadius: '10px',
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem'
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Tickets Grid */}
      {orders.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', background: '#0F172A', borderRadius: '20px', border: '2px dashed #1E293B', maxWidth: '600px', margin: '40px auto' }}>
          <Flame size={56} color="#475569" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#94A3B8', margin: '0 0 8px 0' }}>
            Kitchen is Clear! Zero Active Orders
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0 }}>
            New QR table orders will sound a loud siren alarm and display big tickets here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {orders.map(order => {
            const elapsedMins = getElapsedMins(order.created_at);
            const isDelayed = elapsedMins >= 15;
            const items = parseItems(order.items);
            const hasNotes = Boolean(order.notes || order.special_instructions || order.customer_notes);
            const notesText = order.notes || order.special_instructions || order.customer_notes || '';

            return (
              <div
                key={order.id}
                style={{
                  background: '#0F172A',
                  borderRadius: '16px',
                  border: isDelayed ? '2px solid #EF4444' : '2px solid #3B82F6',
                  boxShadow: isDelayed ? '0 0 20px rgba(239, 68, 68, 0.25)' : '0 4px 14px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden'
                }}
              >
                {/* Header */}
                <div style={{ background: isDelayed ? '#7F1D1D' : '#1E3A8A', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '1.3rem', color: '#FFF', fontWeight: 900, display: 'block' }}>
                      TABLE #{order.table_number || 'Takeaway'}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#93C5FD', fontWeight: 700 }}>
                      Order #{order.id} • {order.customer_name || 'Dine-in'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      background: isDelayed ? '#EF4444' : '#2563EB',
                      color: '#FFF', padding: '4px 10px', borderRadius: '8px',
                      fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Clock size={14} />
                      <span>{elapsedMins}m ago</span>
                    </div>
                    {isDelayed && (
                      <span style={{ fontSize: '0.68rem', color: '#FCA5A5', fontWeight: 900, display: 'block', marginTop: '2px' }}>
                        ⚠️ RUSH ORDER
                      </span>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hasNotes && (
                    <div style={{ padding: '10px 12px', background: '#451A03', border: '1px solid #F59E0B', borderRadius: '10px', color: '#FDE68A', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', color: '#F59E0B' }}>KITCHEN INSTRUCTION:</strong>
                        <span>"{notesText}"</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: '#1E293B', padding: '10px 12px', borderRadius: '10px',
                          border: '1px solid #334155'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            background: '#2563EB', color: '#FFF',
                            width: '28px', height: '28px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.95rem', fontWeight: 900
                          }}>
                            {item.quantity}×
                          </span>
                          <div>
                            <strong style={{ fontSize: '1.02rem', color: '#F8FAFC', display: 'block' }}>
                              {item.name}
                            </strong>
                            {item.portion && (
                              <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700 }}>
                                Portion: {item.portion}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action Button */}
                <div style={{ padding: '14px 16px', background: '#0F172A', borderTop: '1px solid #334155' }}>
                  <button
                    onClick={() => handleMarkPrepared(order.id)}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                      color: '#052E16', border: 'none', fontSize: '1.05rem',
                      fontWeight: 900, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
                    }}
                  >
                    <Bell size={22} />
                    <span>🔔 MARK FOOD PREPARED (NOTIFY WAITER)</span>
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
