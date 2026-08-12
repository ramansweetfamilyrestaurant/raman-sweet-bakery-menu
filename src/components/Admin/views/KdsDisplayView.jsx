import React, { useState, useEffect } from 'react';
import { Clock, Maximize2, Minimize2, CheckCircle2, Flame, Bell, BellRing, UtensilsCrossed, AlertTriangle } from 'lucide-react';

export default function KdsDisplayView({
  orders = [],
  onUpdateStatus,
  restaurantInfo,
  kdsEnabled = true
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live Clock Updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter ONLY active kitchen tickets (status === 'kitchen', sent_to_kds !== 0, kitchen_prepared !== 1)
  const activeKitchenOrders = (Array.isArray(orders) ? orders : []).filter(
    o => o.status === 'kitchen' &&
         (o.sent_to_kds !== 0 && o.sent_to_kds !== false && o.sent_to_kds !== '0') &&
         (o.kitchen_prepared !== 1 && o.kitchen_prepared !== true && o.kitchen_prepared !== '1')
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Helper to calculate elapsed time in minutes
  const getElapsedMins = (createdAt) => {
    if (!createdAt) return 0;
    const created = new Date(createdAt).getTime();
    if (isNaN(created)) return 0;
    const diffMs = currentTime.getTime() - created;
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  if (!kdsEnabled) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFF', borderRadius: 'var(--adm-radius-lg)', border: '1px solid var(--adm-border)' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid #F59E0B' }}>
          <UtensilsCrossed size={32} color="#B45309" />
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 6px 0' }}>
          🔒 Fullscreen Kitchen Display System (KDS) Locked
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--adm-muted)', maxWidth: '480px', margin: '0 auto 16px auto' }}>
          KDS Screen Mode is disabled on your current plan tier. Upgrade to Pro or Enterprise plan in SuperAdmin to unlock dedicated Kitchen Display Screen for your chefs.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#0F172A', padding: '16px', borderRadius: '16px', color: '#F8FAFC', minHeight: '80vh' }}>
      {/* KDS Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #334155', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#3B82F6', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.4rem' }}>
            🍳
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Kitchen Display System (KDS)
              <span style={{ fontSize: '0.72rem', background: '#22C55E', color: '#052E16', padding: '2px 8px', borderRadius: '20px', fontWeight: 800 }}>
                LIVE CHEF SCREEN
              </span>
            </h2>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>
              Zero-Billing Privacy Mode • Active Running Orders: <strong style={{ color: '#60A5FA' }}>{activeKitchenOrders.length} Tickets</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live Clock */}
          <div style={{ background: '#1E293B', padding: '8px 14px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#F1F5F9' }}>
            <Clock size={16} color="#38BDF8" />
            <span>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: '#334155', border: 'none', color: '#F8FAFC', padding: '8px 14px', borderRadius: '10px',
              fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem'
            }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen KDS'}</span>
          </button>
        </div>
      </div>

      {/* KDS Active Tickets Grid */}
      {activeKitchenOrders.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: '#1E293B', borderRadius: '16px', border: '2px dashed #334155' }}>
          <Flame size={48} color="#64748B" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#94A3B8', margin: '0 0 6px 0' }}>
            Kitchen is Clear! Zero Active Orders
          </h3>
          <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0 }}>
            New QR table orders will sound a loud siren alarm and display big tickets here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {activeKitchenOrders.map(order => {
            const elapsedMins = getElapsedMins(order.created_at);
            const isDelayed = elapsedMins >= 15;
            const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? (() => { try { return JSON.parse(order.items); } catch(e){ return []; } })() : []);
            const hasNotes = Boolean(order.notes || order.special_instructions || order.customer_notes);
            const notesText = order.notes || order.special_instructions || order.customer_notes || '';

            return (
              <div
                key={order.id}
                style={{
                  background: '#1E293B',
                  borderRadius: '16px',
                  border: isDelayed ? '2px solid #EF4444' : '2px solid #3B82F6',
                  boxShadow: isDelayed ? '0 0 20px rgba(239, 68, 68, 0.25)' : '0 4px 14px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  overflow: 'hidden'
                }}
              >
                {/* Card Header */}
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

                {/* Card Content - Items List */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Special Kitchen Notes Callout Box */}
                  {hasNotes && (
                    <div style={{ padding: '10px 12px', background: '#451A03', border: '1px solid #F59E0B', borderRadius: '10px', color: '#FDE68A', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', color: '#F59E0B' }}>KITCHEN INSTRUCTION:</strong>
                        <span>"{notesText}"</span>
                      </div>
                    </div>
                  )}

                  {/* Dishes Items Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px', background: '#0F172A', borderRadius: '10px',
                          border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            background: '#3B82F6', color: '#FFF', width: '32px', height: '32px',
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem', fontWeight: 900
                          }}>
                            ×{item.quantity}
                          </span>
                          <div>
                            <strong style={{ fontSize: '1.05rem', color: '#F8FAFC', display: 'block', fontWeight: 800 }}>
                              {item.name}
                            </strong>
                            {item.portion && (
                              <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 700 }}>
                                Portion: {item.portion}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer - SINGLE COMPLETE BUTTON */}
                <div style={{ padding: '14px 16px', background: '#0F172A', borderTop: '1px solid #334155' }}>
                  <button
                    onClick={() => onUpdateStatus(order.id, 'kitchen', { kitchen_prepared: 1 })}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                      color: '#052E16',
                      border: 'none',
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
                      transition: 'all 0.15s ease'
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
