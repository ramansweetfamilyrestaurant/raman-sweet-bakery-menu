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
import { playKdsChime } from '../../../utils/soundManager';
import { filterActiveKitchenOrders } from '../../../utils/kdsQueueFilter';
import { getBusinessTerminology } from '../../../utils/businessTaxonomy';

export default function KdsDisplayView({
  orders = [],
  onUpdateStatus,
  restaurantInfo = {},
  kdsEnabled = true
}) {
  const terminology = getBusinessTerminology(restaurantInfo || {});
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

  // Filter active running kitchen tickets using shared pure queue filter
  const activeKitchenOrders = useMemo(() => {
    return filterActiveKitchenOrders(orders);
  }, [orders]);

  // Play audio chime when a new ticket arrives in kitchen
  useEffect(() => {
    if (activeKitchenOrders.length > prevActiveCountRef.current && soundEnabled && prevActiveCountRef.current !== 0) {
      try {
        playKdsChime();
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
    if (cleanSpaceType === 'counter') {
      const num = str.replace(/^counter\s*#?/i, '').trim();
      return num ? `🧾 COUNTER ${num}` : `🧾 COUNTER`;
    }
    if (cleanSpaceType === 'table') return `TABLE ${str.replace(/^table\s*#?/i, '')}`;

    if (/^counter/i.test(str)) {
      const num = str.replace(/^counter\s*#?/i, '').trim();
      return num ? `🧾 COUNTER ${num}` : `🧾 COUNTER`;
    }
    if (/^room\s*#?\d+/i.test(str)) return `🏨 ROOM ${str.replace(/^room\s*#?/i, '')}`;
    if (/^cabin\s*#?\d+/i.test(str)) return `🛋️ CABIN ${str.replace(/^cabin\s*#?/i, '')}`;
    if (/^vip\s*#?\d+/i.test(str)) return `👑 VIP ${str.replace(/^vip\s*#?/i, '')}`;
    if (/^(takeaway|parcel)/i.test(str)) return `📦 ${str.toUpperCase()}`;

    if (fallbackPrefix) {
      const cleanFallback = String(fallbackPrefix).trim().toLowerCase();
      if (cleanFallback === 'counter') return `🧾 COUNTER ${str}`;
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
      background: 'radial-gradient(circle at 50% 0%, #162444 0%, #0F172A 40%, #080D1A 100%)',
      padding: '16px',
      borderRadius: '20px',
      color: '#F8FAFC',
      minHeight: '85vh',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif'
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
          1. TOP COMMAND BAR
         ========================================================================= */}
      <div style={{
        background: '#0F172A',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left: Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <h2 style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: '#F8FAFC',
              margin: 0,
              letterSpacing: '-0.01em',
              textTransform: 'capitalize'
            }}>
              {restaurantInfo?.name || 'Kitchen Display'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.75rem', color: '#64748B' }}>
              <span>Kitchen</span>
              <span>•</span>
              <span style={{ color: activeKitchenOrders.length > 0 ? '#38BDF8' : '#94A3B8' }}>
                {activeKitchenOrders.length} active {activeKitchenOrders.length === 1 ? 'order' : 'orders'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Pop-out Standalone Tablet Display */}
          {(restaurantInfo?.slug || (typeof window !== 'undefined' && localStorage.getItem('touchqr_admin_slug'))) && (
            <button
              type="button"
              onClick={() => {
                const s = restaurantInfo?.slug || localStorage.getItem('touchqr_admin_slug') || '';
                window.open(s ? `/${s}/kitchen` : '/kitchen', '_blank');
              }}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#1E293B',
                color: '#E2E8F0',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Open full screen kitchen display on a separate tablet"
            >
              <ExternalLink size={13} color="#38BDF8" />
              <span>Tablet view</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1E293B',
              color: soundEnabled ? '#E2E8F0' : '#64748B',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{soundEnabled ? 'Sound on' : 'Muted'}</span>
          </button>

          {/* Prep Summary Toggle */}
          {aggregatedPrepItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPrepSummary(!showPrepSummary)}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: showPrepSummary ? 'rgba(56, 189, 248, 0.1)' : '#1E293B',
                color: showPrepSummary ? '#38BDF8' : '#94A3B8',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layers size={13} />
              <span>Summary</span>
            </button>
          )}

          {/* Recall / History Drawer Toggle */}
          {recentlyCompleted.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(!showCompletedDrawer)}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#1E293B',
                color: '#E2E8F0',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={12} color="#F59E0B" />
              <span>Recall ({recentlyCompleted.length})</span>
            </button>
          )}

          {/* Live Kitchen Clock */}
          <div style={{
            height: '32px',
            background: '#1E293B',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid #334155',
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: '#94A3B8',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>

          {/* Fullscreen KDS Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              height: '32px',
              width: '32px',
              padding: 0,
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1E293B',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. SUMMARY BAR
         ========================================================================= */}
      {showPrepSummary && aggregatedPrepItems.length > 0 && (
        <div style={{
          background: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Summary:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            {aggregatedPrepItems.map(item => (
              <div
                key={item.name}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontSize: '0.75rem'
                }}
              >
                <span style={{ color: '#38BDF8', fontWeight: 600 }}>{item.count}×</span>
                <span style={{ color: '#E2E8F0', fontWeight: 400 }}>{item.name}</span>
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
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94A3B8' }}>
              Recently Completed
            </span>
            <button
              type="button"
              onClick={() => setShowCompletedDrawer(false)}
              style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {recentlyCompleted.map(ord => (
              <div
                key={ord.id}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#F8FAFC', fontWeight: 500 }}>
                  {formatKdsLocation(ord.table_number, ord.space_type)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRecallOrder(ord)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '5px',
                    border: '1px solid #334155',
                    background: 'transparent',
                    color: '#FCD34D',
                    fontSize: '0.70rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Undo
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          textAlign: 'center',
          padding: '40px 20px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            color: '#64748B'
          }}>
            <UtensilsCrossed size={22} strokeWidth={1.5} />
          </div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#F1F5F9',
            margin: '0 0 6px 0',
            letterSpacing: '-0.01em'
          }}>
            No active orders
          </h3>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 400,
            color: '#64748B',
            margin: 0,
            maxWidth: '320px',
            lineHeight: 1.5
          }}>
            New orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '12px'
        }}>
          {displayedOrders.map((order, orderIdx) => {
            const elapsedMins = getElapsedMins(order.created_at);
            const isRush = elapsedMins >= 15;
            const isCritical = elapsedMins >= 25;
            const items = parseItems(order.items);
            const rawNotes = order.notes || order.special_instructions || order.customer_notes;
            const hasNotes = typeof rawNotes === 'string' && rawNotes.trim().length > 0;
            const notesText = hasNotes ? rawNotes.trim() : '';
            const roundNum = Number(order.round_number);
            const isMultiRound = !isNaN(roundNum) && Number.isInteger(roundNum) && roundNum > 1;

            return (
              <div
                key={order.id}
                className={isRush ? 'kds-card-rush-glow' : ''}
                style={{
                  background: '#131B2E',
                  borderRadius: '14px',
                  border: isCritical ? '1px solid #EF4444' : isRush ? '1px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden'
                }}
              >
                {/* TICKET TOP HEADER */}
                <div style={{
                  background: isCritical ? 'rgba(239, 68, 68, 0.15)' : (isRush ? 'rgba(245, 158, 11, 0.15)' : '#1E293B'),
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#FFFFFF',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.2
                      }}>
                        {formatKdsLocation(order.table_number, order.space_type, restaurantInfo?.business_type === 'hotel_resort' ? 'room' : restaurantInfo?.table_prefix)}
                      </div>
                      {isMultiRound && (
                        <span style={{
                          background: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          color: '#C4B5FD',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 500
                        }}>
                          Round {roundNum}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 400 }}>
                      #{order.id} • {order.customer_name || 'Dine-in'}
                    </span>
                  </div>

                  {/* Urgency Clock Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      background: isCritical ? 'rgba(239, 68, 68, 0.2)' : (isRush ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)'),
                      border: isCritical ? '1px solid rgba(239, 68, 68, 0.4)' : (isRush ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'),
                      color: isCritical ? '#FCA5A5' : (isRush ? '#FCD34D' : '#E2E8F0'),
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={12} />
                      <span>{elapsedMins}m</span>
                    </div>
                  </div>
                </div>

                {/* TICKET BODY: ITEMS LIST */}
                <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hasNotes && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      color: '#FCD34D',
                      fontSize: '0.75rem',
                      fontWeight: 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ color: '#F59E0B', fontWeight: 600 }}>Note:</span>
                      <span style={{ color: '#F1F5F9' }}>"{notesText}"</span>
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
                            background: isChecked ? 'rgba(30, 41, 59, 0.4)' : '#1E293B',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            opacity: isChecked ? 0.5 : 1,
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <div style={{
                              color: isChecked ? '#10B981' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>

                            <span style={{
                              color: isChecked ? '#64748B' : '#38BDF8',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              flexShrink: 0
                            }}>
                              {item.quantity || item.qty || 1}×
                            </span>

                            <div style={{ minWidth: 0 }}>
                              <span style={{
                                fontSize: '0.8125rem',
                                color: isChecked ? '#64748B' : '#F1F5F9',
                                fontWeight: 500,
                                textDecoration: isChecked ? 'line-through' : 'none',
                                display: 'block',
                                lineHeight: 1.3
                              }}>
                                {item.name || item.dish_name}
                              </span>

                              {(item.includes || item.comboIncludes) && (
                                <div style={{
                                  fontSize: '0.6875rem',
                                  color: '#34D399',
                                  marginTop: '2px',
                                  lineHeight: 1.2
                                }}>
                                  Includes: {item.includes || item.comboIncludes}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {item.portion && (
                                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '4px' }}>
                                    {item.portion}
                                  </span>
                                )}

                                {mods.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    style={{
                                      fontSize: '0.6875rem',
                                      color: '#FCD34D',
                                      background: 'rgba(245, 158, 11, 0.1)',
                                      padding: '1px 5px',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    + {m.name}
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
                  padding: '10px 14px',
                  background: '#0F172A',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <button
                    type="button"
                    onClick={() => handleMarkPrepared(order)}
                    className="kds-action-btn"
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Mark Ready</span>
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
