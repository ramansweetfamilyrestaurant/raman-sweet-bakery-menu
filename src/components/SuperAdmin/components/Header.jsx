import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Megaphone, 
  LogOut, 
  MessageSquare, 
  CreditCard, 
  Calendar, 
  UserCheck, 
  CheckCircle2, 
  ChevronRight, 
  X 
} from 'lucide-react';

export default function Header({ 
  username, 
  activeView, 
  onToggleMobileMenu,
  onOpenBroadcast,
  onLogout,
  logoUrl,
  alerts = { tickets: 0, failed: 0, expiring: 0, pending: 0, total: 0 },
  onNavigate = () => {}
}) {
  const [logoErr, setLogoErr] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  let cachedLogo = '';
  try { cachedLogo = localStorage.getItem('touchqr_platform_logo_url') || ''; } catch {}
  const effectiveLogo = logoUrl || cachedLogo || '/api/r2-proxy/superadmin/branding/logo.webp';
  const resolvedLogoUrl = effectiveLogo ? (effectiveLogo.startsWith('http') || effectiveLogo.startsWith('/') ? effectiveLogo : `/${effectiveLogo}`) : '';

  const shortTitles = {
    overview: 'Overview',
    tenants: 'Shops',
    billing: 'Billing',
    plans: 'Plans',
    operations: 'Operations',
    activity: 'Activity',
    settings: 'Settings',
    communication: 'Broadcast',
    tickets: 'Support Tickets'
  };

  const currentTitle = shortTitles[activeView] || 'Dashboard';
  const totalAlerts = Number(alerts?.total || 0);

  // Close notification popover on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
      }
    };

    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotifOpen]);

  return (
    <header className="sa-header">
      {/* LEFT: Unified Luxury TouchQR Brand Lockup */}
      <div className="sa-header-left">
        <div className="sa-header-brand-lockup">
          {/* Logo Badge with Gold Accent */}
          <div className="sa-header-logo-badge">
            {resolvedLogoUrl && !logoErr ? (
              <img
                src={resolvedLogoUrl}
                alt="TouchQR"
                onError={() => setLogoErr(true)}
                className="sa-header-logo-img"
              />
            ) : (
              <div className="sa-header-logo-fallback">
                👑
              </div>
            )}
          </div>

          {/* Typography / Titles */}
          <div className="sa-header-brand-info">
            <div className="sa-header-brand-title">
              Touch<span className="sa-gold-text">QR</span>
            </div>
            <div className="sa-header-brand-subtitle sa-desktop-only">
              {currentTitle}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: System Status, Broadcast, Live Notification Center & Profile */}
      <div className="sa-header-right">
        {/* All Systems Operational Badge (Desktop/Tablet Only) */}
        <div className="sa-ssl-badge sa-desktop-only-ssl" title="Neon DB, Cashfree & APIs Operational">
          <span className="sa-live-dot active" />
          <span className="sa-ssl-text" style={{ color: '#15803D' }}>All Systems Operational</span>
        </div>

        {/* Broadcast Button (Desktop/Tablet Only) */}
        {onOpenBroadcast && (
          <button
            type="button"
            onClick={onOpenBroadcast}
            className="sa-quick-broadcast-btn sa-desktop-only"
            title="Broadcast announcement to shop owners"
          >
            <Megaphone size={13} />
            <span className="sa-header-btn-label">Broadcast</span>
          </button>
        )}

        {/* 🔔 LIVE NOTIFICATION CENTER WITH BADGE & POPOVER */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen(prev => !prev)}
            aria-label="Platform Notifications"
            title={totalAlerts > 0 ? `${totalAlerts} Attention Items • Click to inspect` : 'All Systems Clear • 0 Unread Alerts'}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: isNotifOpen ? '1.5px solid #D4AF37' : '1px solid var(--sa-border, #E2E8F0)',
              background: isNotifOpen ? 'rgba(212, 175, 55, 0.14)' : 'var(--sa-surface-subtle, #F8FAFC)',
              color: totalAlerts > 0 ? '#1E293B' : 'var(--sa-text-muted, #64748B)',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isNotifOpen ? '0 0 0 3px rgba(212, 175, 55, 0.20)' : 'none',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <Bell size={17} />
            {totalAlerts > 0 && (
              <span style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                borderRadius: '9999px',
                background: '#DC2626',
                color: '#FFFFFF',
                fontSize: '0.64rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(220,38,38,0.45)',
                border: '1.5px solid #FFFFFF',
                lineHeight: 1
              }}>
                {totalAlerts > 99 ? '99+' : totalAlerts}
              </span>
            )}
          </button>

          {/* Interactive Popover Dropdown */}
          {isNotifOpen && (
            <>
              {/* Mobile Blurred Backdrop */}
              <div 
                className="sa-notif-backdrop" 
                onClick={() => setIsNotifOpen(false)}
                aria-hidden="true"
              />
              <div className="sa-notif-dropdown">
                {/* Dropdown Header */}
                <div style={{
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0
                }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Platform Alerts</span>
                      {totalAlerts > 0 ? (
                        <span style={{
                          background: '#EF4444',
                          color: '#FFFFFF',
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          padding: '1px 7px',
                          borderRadius: '9999px'
                        }}>
                          {totalAlerts}
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.25)',
                          border: '1px solid #10B981',
                          color: '#6EE7B7',
                          fontSize: '0.60rem',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '9999px'
                        }}>
                          ALL CLEAR
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#A7F3D0', fontWeight: 600, marginTop: '2px' }}>
                      {totalAlerts > 0 ? 'Items requiring Super Admin review' : 'No pending tickets or overdue issues'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen(false)}
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title="Close alerts"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Alert Items List */}
                <div style={{
                  padding: '10px',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {totalAlerts === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: '#DCFCE7',
                        color: '#15803D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px'
                      }}>
                        <CheckCircle2 size={26} />
                      </div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--sa-text-main, #0F172A)' }}>
                        All Clear!
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted, #64748B)', marginTop: '2px' }}>
                        Zero open tickets, failed payments or pending actions.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* 1. Support Tickets */}
                      {Number(alerts?.tickets || 0) > 0 && (
                        <div
                          onClick={() => { setIsNotifOpen(false); onNavigate('tickets'); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '11px 12px',
                            borderRadius: '12px',
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            cursor: 'pointer',
                            minHeight: '44px',
                            WebkitTapHighlightColor: 'transparent'
                          }}
                          title="Open Support Ticket Desk"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: '#FEE2E2',
                              color: '#DC2626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <MessageSquare size={17} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991B1B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {alerts.tickets} Support {alerts.tickets === 1 ? 'Ticket' : 'Tickets'}
                              </div>
                              <div style={{ fontSize: '0.70rem', color: '#B91C1C' }}>
                                Awaiting operator reply
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '6px' }}>
                            Respond <ChevronRight size={14} />
                          </span>
                        </div>
                      )}

                      {/* 2. Payment Failed */}
                      {Number(alerts?.failed || 0) > 0 && (
                        <div
                          onClick={() => { setIsNotifOpen(false); onNavigate('tenants', 'failed'); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '11px 12px',
                            borderRadius: '12px',
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            cursor: 'pointer',
                            minHeight: '44px',
                            WebkitTapHighlightColor: 'transparent'
                          }}
                          title="Review failed subscriptions in directory"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: '#FEF3C7',
                              color: '#B45309',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <CreditCard size={17} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {alerts.failed} Payment {alerts.failed === 1 ? 'Failure' : 'Failures'}
                              </div>
                              <div style={{ fontSize: '0.70rem', color: '#B45309' }}>
                                Past due subscriptions
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#B45309', display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '6px' }}>
                            Review <ChevronRight size={14} />
                          </span>
                        </div>
                      )}

                      {/* 3. Expiring in 7 Days */}
                      {Number(alerts?.expiring || 0) > 0 && (
                        <div
                          onClick={() => { setIsNotifOpen(false); onNavigate('tenants', 'expiring'); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '11px 12px',
                            borderRadius: '12px',
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            cursor: 'pointer',
                            minHeight: '44px',
                            WebkitTapHighlightColor: 'transparent'
                          }}
                          title="View shops expiring within 7 days"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: '#DBEAFE',
                              color: '#2563EB',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Calendar size={17} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E40AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {alerts.expiring} Expiring in 7 Days
                              </div>
                              <div style={{ fontSize: '0.70rem', color: '#3B82F6' }}>
                                Trials / plans ending soon
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#2563EB', display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '6px' }}>
                            Inspect <ChevronRight size={14} />
                          </span>
                        </div>
                      )}

                      {/* 4. Suspended / Pending Approvals */}
                      {Number(alerts?.pending || 0) > 0 && (
                        <div
                          onClick={() => { setIsNotifOpen(false); onNavigate('tenants', 'suspended'); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '11px 12px',
                            borderRadius: '12px',
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            cursor: 'pointer',
                            minHeight: '44px',
                            WebkitTapHighlightColor: 'transparent'
                          }}
                          title="View suspended or pending accounts"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: '#DCFCE7',
                              color: '#16A34A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <UserCheck size={17} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {alerts.pending} Pending / Suspended
                              </div>
                              <div style={{ fontSize: '0.70rem', color: '#15803D' }}>
                                Requires account review
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#16A34A', display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '6px' }}>
                            View <ChevronRight size={14} />
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Dropdown Footer */}
                <div style={{
                  padding: '11px 14px',
                  background: 'var(--sa-surface-subtle, #F8FAFC)',
                  borderTop: '1px solid var(--sa-border, #E2E8F0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0
                }}>
                  <span
                    onClick={() => { setIsNotifOpen(false); onNavigate('overview'); }}
                    style={{ fontSize: '0.74rem', color: '#0A2315', fontWeight: 800, cursor: 'pointer', padding: '4px 0' }}
                  >
                    Overview Hub ➔
                  </span>
                  <span
                    onClick={() => { setIsNotifOpen(false); onNavigate('activity'); }}
                    style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted, #64748B)', fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}
                  >
                    Audit Activity
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Avatar & Quick Logout */}
        <div className="sa-header-profile">
          <div className="sa-profile-avatar" title={`Logged in as ${username || 'Super Admin'}`}>
            {username ? username.charAt(0).toUpperCase() : 'S'}
          </div>
          <div className="sa-desktop-only" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span className="sa-profile-name" style={{ fontSize: '0.78rem', fontWeight: 800 }}>
              {username || 'Super Admin'}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              superadmin
            </span>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="sa-header-logout-btn"
              title="Logout from Super Admin"
              style={{ marginLeft: '2px' }}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
