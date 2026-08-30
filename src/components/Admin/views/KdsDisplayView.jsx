import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Clock, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  Flame, 
  Bell, 
  BellRing, 
  UtensilsCrossed, 
  AlertTriangle,
  Check,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Layers,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  Tv,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';

export default function KdsDisplayView({
  orders = [],
  onUpdateStatus,
  restaurantInfo = {},
  kdsEnabled = true
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [checkedItemsMap, setCheckedItemsMap] = useState({}); // { `${orderId}_${itemIdx}`: boolean }
  const [showPrepSummary, setShowPrepSummary] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'rush' | 'fresh'
  const [recentlyCompleted, setRecentlyCompleted] = useState([]);
  const [showCompletedDrawer, setShowCompletedDrawer] = useState(false);

  const prevActiveCountRef = useRef(0);

  // Live Clock Updater (1s)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter active running kitchen tickets (sent_to_kds !== 0 and kitchen_prepared !== 1)
  const activeKitchenOrders = useMemo(() => {
    const list = (Array.isArray(orders) ? orders : []).filter(
      o => ['kitchen', 'accepted', 'pending', 'preparing'].includes(o.status) &&
           (o.sent_to_kds !== 0 && o.sent_to_kds !== false && o.sent_to_kds !== '0') &&
           (o.kitchen_prepared !== 1 && o.kitchen_prepared !== true && o.kitchen_prepared !== '1')
    );

    // Sort by creation time (oldest first for FIFO kitchen service)
    return list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });
  }, [orders]);

  // Play audio chime when a new ticket arrives in kitchen
  useEffect(() => {
    if (activeKitchenOrders.length > prevActiveCountRef.current && soundEnabled && prevActiveCountRef.current !== 0) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') ctx.resume();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.2); // E6
          gain.gain.setValueAtTime(0.6, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (e) {
        console.warn('KDS chime notice:', e);
      }
    }
    prevActiveCountRef.current = activeKitchenOrders.length;
  }, [activeKitchenOrders.length, soundEnabled]);

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

  // Safe item parser helper
  const parseItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try { return JSON.parse(items); } catch { return []; }
    }
    return [];
  };

  // Item Checkoff toggle
  const toggleItemCheck = (orderId, idx) => {
    const key = `${orderId}_${idx}`;
    setCheckedItemsMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Mark food prepared and record in recently completed
  const handleMarkPrepared = (order) => {
    if (!order) return;
    setRecentlyCompleted(prev => [
      { ...order, completedAt: new Date() },
      ...prev.slice(0, 9)
    ]);
    if (onUpdateStatus) {
      onUpdateStatus(order.id, 'kitchen', { kitchen_prepared: 1 });
    }
  };

  // Recall / Undo completed food
  const handleRecallOrder = (order) => {
    if (!order) return;
    setRecentlyCompleted(prev => prev.filter(o => o.id !== order.id));
    if (onUpdateStatus) {
      onUpdateStatus(order.id, 'kitchen', { kitchen_prepared: 0 });
    }
  };

  const formatKdsLocation = (raw, spaceType, fallbackPrefix = null) => {
    if (!raw) return 'TAKEAWAY';
    const str = String(raw).trim();

    // Cinema Pattern
    const cMatch = str.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                   str.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
    if (cMatch) {
      return `🎬 SCREEN ${cMatch[1]} • ROW ${cMatch[2].toUpperCase()} • SEAT ${cMatch[3]}`;
    }
    if (str.toLowerCase().startsWith('screen')) {
      return `🎬 ${str.toUpperCase()}`;
    }

    const cleanSpaceType = spaceType ? String(spaceType).trim().toLowerCase() : null;
    if (cleanSpaceType === 'cinema_seat' || cleanSpaceType === 'cinema') return `🎬 SEAT ${str.toUpperCase()}`;
    if (cleanSpaceType === 'room') return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (cleanSpaceType === 'cabin') return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (cleanSpaceType === 'vip') return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (cleanSpaceType === 'table') return `TABLE ${str.replace(/^table\s*#?/i, '')}`;

    if (/^room\s*#?\d+/i.test(str)) return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (/^cabin\s*#?\d+/i.test(str)) return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (/^vip\s*#?\d+/i.test(str)) return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (/^(takeaway|parcel)/i.test(str)) return `📦 ${str.toUpperCase()}`;

    if (fallbackPrefix) {
      const cleanFallback = String(fallbackPrefix).trim().toLowerCase();
      if (cleanFallback === 'room') return `🏨 ROOM ${str}`;
      if (cleanFallback === 'cabin') return `🛋️ CABIN ${str}`;
      if (cleanFallback === 'vip') return `👑 VIP ${str}`;
    }

    return `TABLE ${str}`;
  };

  // Aggregated Chef Prep Matrix (Consolidated quantities across all active tickets)
  const aggregatedPrepItems = useMemo(() => {
    const map = {};
    activeKitchenOrders.forEach(o => {
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
  }, [activeKitchenOrders]);

  // Metrics summary
  const rushCount = activeKitchenOrders.filter(o => getElapsedMins(o.created_at) >= 15).length;
  const totalDishesCount = activeKitchenOrders.reduce((sum, o) => {
    const items = parseItems(o.items);
    return sum + items.reduce((iSum, it) => iSum + Number(it.quantity || it.qty || 1), 0);
  }, 0);

  // Filtered displayed tickets
  const displayedOrders = useMemo(() => {
    if (selectedFilter === 'rush') {
      return activeKitchenOrders.filter(o => getElapsedMins(o.created_at) >= 15);
    }
    if (selectedFilter === 'fresh') {
      return activeKitchenOrders.filter(o => getElapsedMins(o.created_at) < 15);
    }
    return activeKitchenOrders;
  }, [activeKitchenOrders, selectedFilter, currentTime]);

  if (!kdsEnabled) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: '#0B1120',
        borderRadius: '20px',
        border: '1px solid #1E293B',
        color: '#F8FAFC'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          border: '1.5px solid #F59E0B'
        }}>
          <UtensilsCrossed size={32} color="#F59E0B" />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F8FAFC', margin: '0 0 8px 0' }}>
          🔒 Fullscreen Kitchen Display System (KDS) Locked
        </h3>
        <p style={{ fontSize: '0.86rem', color: '#94A3B8', maxWidth: '520px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
          KDS Screen Mode is restricted to Pro and Enterprise subscription tiers. Upgrade your TouchQR plan to unlock dedicated high-contrast Kitchen Displays with live sound alarms for your line chefs.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      background: '#070B14',
      padding: '16px',
      borderRadius: '20px',
      color: '#F8FAFC',
      minHeight: '85vh',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
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

      {/* =========================================================================
          1. KDS TOP CHEF COMMAND BAR
         ========================================================================= */}
      <div style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #0B1120 100%)',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left: Chef Badge + Live Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
          }}>
            🍳
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.24rem', fontWeight: 900, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
                Kitchen Display System (KDS)
              </h2>
              <span style={{
                fontSize: '0.66rem',
                fontWeight: 900,
                background: '#10B981',
                color: '#022C22',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                LIVE PREP SCREEN
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '0.74rem', color: '#94A3B8' }}>
              <span>Active Tickets: <strong style={{ color: '#38BDF8' }}>{activeKitchenOrders.length}</strong></span>
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

        {/* Right: Quick Controls (Sound, Filters, Clock, Fullscreen) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: soundEnabled ? 'rgba(16, 185, 129, 0.15)' : '#1E293B',
              color: soundEnabled ? '#34D399' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={soundEnabled ? 'Chime sound is active' : 'Chime sound muted'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
          </button>

          {/* Prep Summary Toggle */}
          <button
            type="button"
            onClick={() => setShowPrepSummary(!showPrepSummary)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: showPrepSummary ? 'rgba(56, 189, 248, 0.15)' : '#1E293B',
              color: showPrepSummary ? '#38BDF8' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={14} />
            <span>{showPrepSummary ? 'Hide Dish Totals' : 'Dish Totals'}</span>
          </button>

          {/* Recall / History Drawer Toggle */}
          {recentlyCompleted.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(!showCompletedDrawer)}
              style={{
                height: '36px',
                padding: '0 10px',
                borderRadius: '10px',
                border: '1px solid #334155',
                background: '#1E293B',
                color: '#F1F5F9',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={13} color="#F59E0B" />
              <span>Prepared ({recentlyCompleted.length})</span>
            </button>
          )}

          {/* Live Kitchen Clock */}
          <div style={{
            background: '#0F172A',
            padding: '6px 12px',
            borderRadius: '10px',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.84rem',
            fontWeight: 900,
            color: '#F8FAFC'
          }}>
            <Clock size={14} color="#38BDF8" />
            <span>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>

          {/* Fullscreen KDS Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              border: 'none',
              background: '#2563EB',
              color: '#FFFFFF',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. COLLAPSIBLE CHEF PREP SUMMARY MATRIX (Consolidated Multi-Portion Drop)
         ========================================================================= */}
      {showPrepSummary && aggregatedPrepItems.length > 0 && (
        <div style={{
          background: '#0D1526',
          border: '1px solid #1E293B',
          borderRadius: '14px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', color: '#94A3B8', fontSize: '0.70rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Flame size={14} color="#F59E0B" />
            <span>Active Drop Totals:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            {aggregatedPrepItems.map(item => (
              <div
                key={item.name}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  fontSize: '0.74rem',
                  fontWeight: 900
                }}>
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

      {/* =========================================================================
          3. RECENTLY PREPARED / RECALL DRAWER
         ========================================================================= */}
      {showCompletedDrawer && recentlyCompleted.length > 0 && (
        <div style={{
          background: '#0F172A',
          border: '1px solid #334155',
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
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
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  whiteSpace: 'nowrap'
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
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #F59E0B',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#FDE68A',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
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

      {/* =========================================================================
          4. MAIN KDS TICKET GRID
         ========================================================================= */}
      {displayedOrders.length === 0 ? (
        <div style={{
          padding: '80px 20px',
          textAlign: 'center',
          background: '#0B1120',
          borderRadius: '18px',
          border: '2px dashed #1E293B',
          margin: '20px 0'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            <CheckCircle2 size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F1F5F9', margin: '0 0 6px 0' }}>
            Kitchen Queue is Clear!
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '420px', margin: '0 auto' }}>
            Zero pending food preparation tickets. Incoming QR orders will automatically alert and drop tickets here.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '14px'
        }}>
          {displayedOrders.map((order, orderIdx) => {
            const elapsedMins = getElapsedMins(order.created_at);
            const isRush = elapsedMins >= 15;
            const isCritical = elapsedMins >= 25;
            const items = parseItems(order.items);
            const hasNotes = Boolean(order.notes || order.special_instructions || order.customer_notes);
            const notesText = order.notes || order.special_instructions || order.customer_notes || '';

            // Check if all items in ticket are checked off
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
                  overflow: 'hidden',
                  position: 'relative'
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
                    {/* Big Table / Location Header */}
                    <div style={{
                      fontSize: '1.22rem',
                      fontWeight: 900,
                      color: '#FFFFFF',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1
                    }}>
                      {formatKdsLocation(order.table_number, order.space_type, restaurantInfo?.business_type === 'hotel_resort' ? 'room' : restaurantInfo?.table_prefix)}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: isRush ? '#FEF08A' : '#94A3B8', fontWeight: 700 }}>
                      Ticket #{order.id} • {order.customer_name || 'Dine-In Guest'}
                    </span>
                  </div>

                  {/* Urgency Clock Badge */}
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
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
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

                {/* TICKET BODY: ITEMS LIST */}
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Special Kitchen Notes Alert Callout */}
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

                  {/* Dish Items List with Strike-Through Checkoff */}
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
                            border: isChecked ? '1px solid #1E293B' : '1px solid #1E293B',
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
                            {/* Checkbox Icon */}
                            <div style={{
                              color: isChecked ? '#10B981' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>

                            {/* Multiplier Quantity */}
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

                            {/* Item Details */}
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

                {/* TICKET BOTTOM ACTION: MARK READY */}
                <div style={{
                  padding: '12px 14px',
                  background: '#0A101C',
                  borderTop: '1px solid #1E293B'
                }}>
                  <button
                    type="button"
                    onClick={() => handleMarkPrepared(order)}
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
