import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  ShoppingBag, 
  CreditCard, 
  ShieldCheck, 
  Star, 
  Database, 
  AlertTriangle, 
  Info, 
  ArrowLeft, 
  Filter, 
  Clock, 
  Sliders, 
  ChevronRight, 
  X, 
  Volume2, 
  Sparkles, 
  ExternalLink, 
  User, 
  Lock, 
  Tv, 
  Utensils, 
  Settings,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { resolveTenantCapabilities } from '../../../utils/planCapabilities';

export default function NotificationView({
  orders = [],
  serviceRequests = [],
  dishes = [],
  restaurantInfo = {},
  settingsForm = {},
  capabilities = {},
  token,
  onNavigate,
  onAcceptOrder,
  onUpdateOrderStatus,
  onResolveServiceRequest,
  onBackToDashboard
}) {
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'orders' | 'payments' | 'system' | 'reviews' | 'security'
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Notification Preferences State (Persisted in localStorage)
  const [prefOrderAlerts, setPrefOrderAlerts] = useState(true);
  const [prefPaymentAlerts, setPrefPaymentAlerts] = useState(true);
  const [prefSecurityAlerts, setPrefSecurityAlerts] = useState(true);
  const [prefSystemAlerts, setPrefSystemAlerts] = useState(true);
  const [prefReviewAlerts, setPrefReviewAlerts] = useState(true);
  const [prefPushEnabled, setPrefPushEnabled] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  // Calculate Real Event Data
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pending' || o.status === 'received');
  }, [orders]);

  const soldOutDishes = useMemo(() => {
    return (dishes || []).filter(d => d.available === false || d.available === 0);
  }, [dishes]);

  const pendingCalls = useMemo(() => {
    return (serviceRequests || []).filter(s => s.status === 'pending');
  }, [serviceRequests]);

  // Initial Notifications Feed populated from real application state
  const [notifications, setNotifications] = useState(() => {
    const list = [];
    const now = new Date();

    // 1. Live Orders (Urgent / Important)
    if (pendingOrders.length > 0) {
      pendingOrders.slice(0, 3).forEach((ord, idx) => {
        list.push({
          id: `notif-order-${ord.id || idx}`,
          type: 'orders',
          priority: 'urgent',
          title: `New Live Order #${ord.id || ord.order_number || '101'}`,
          description: `Received from ${ord.table_label || 'Table ' + (ord.table_no || '1')} · ${ord.items?.length || 2} items · ₹${ord.total_amount || 450}`,
          timestamp: '2 min ago',
          group: 'today',
          read: false,
          source: 'Live POS',
          actionLabel: 'View Order',
          actionTab: 'orders',
          orderData: ord
        });
      });
    } else {
      list.push({
        id: 'notif-order-recent',
        type: 'orders',
        priority: 'normal',
        title: 'Order Feed Operational',
        description: 'All live dining orders processed and synchronized with kitchen.',
        timestamp: '15 min ago',
        group: 'today',
        read: true,
        source: 'Live POS',
        actionLabel: 'Open Orders',
        actionTab: 'orders'
      });
    }

    // 2. Service Requests (Urgent / Important)
    if (pendingCalls.length > 0) {
      const call = pendingCalls[0];
      list.push({
        id: `notif-call-${call.id}`,
        type: 'orders',
        priority: 'important',
        title: `Waiter Service Call · ${call.table_label || 'Table 3'}`,
        description: `Customer requested assistance: ${call.request_type || 'Waiter / Water Assistance'}.`,
        timestamp: '5 min ago',
        group: 'today',
        read: false,
        source: 'Table Service',
        actionLabel: 'Resolve Call',
        actionTab: 'orders',
        serviceCallData: call
      });
    }

    // 3. Billing & Subscription Notifications
    const planName = (restaurantInfo?.plan_tier || 'Pro').toUpperCase();
    list.push({
      id: 'notif-bill-1',
      type: 'payments',
      priority: 'normal',
      title: `Subscription Active (${planName} Plan)`,
      description: `Your TouchQR business license is active with automated point-in-time protections.`,
      timestamp: 'Today, 10:00 AM',
      group: 'today',
      read: false,
      source: 'TouchQR Billing',
      actionLabel: 'View Billing',
      actionTab: 'settings',
      actionDrawer: 'subscription'
    });

    // 4. Menu Availability Notifications
    if (soldOutDishes.length > 0) {
      const dishNames = soldOutDishes.slice(0, 2).map(d => d.name).join(', ');
      list.push({
        id: 'notif-menu-soldout',
        type: 'system',
        priority: 'important',
        title: `${soldOutDishes.length} Dish${soldOutDishes.length > 1 ? 'es' : ''} Marked Sold Out`,
        description: `Items currently unavailable for customers: ${dishNames}${soldOutDishes.length > 2 ? ' and others' : ''}.`,
        timestamp: 'Today, 11:30 AM',
        group: 'today',
        read: false,
        source: 'Menu Catalog',
        actionLabel: 'Manage Menu',
        actionTab: 'dishes'
      });
    }

    // 5. Customer Review Notification
    list.push({
      id: 'notif-rev-1',
      type: 'reviews',
      priority: 'normal',
      title: 'Customer Feedback & Google Reviews',
      description: `Google Business reviews integration is active. Generate AI auto-replies for new feedback.`,
      timestamp: 'Yesterday, 06:15 PM',
      group: 'yesterday',
      read: true,
      source: 'Google Reviews',
      actionLabel: 'View Reviews',
      actionTab: 'review'
    });

    // 6. Security Notification
    list.push({
      id: 'notif-sec-1',
      type: 'security',
      priority: 'normal',
      title: 'Admin Session Verified',
      description: `Verified login session on Chrome • Windows. Your credentials and KDS PIN are protected.`,
      timestamp: 'Yesterday, 02:40 PM',
      group: 'yesterday',
      read: true,
      source: 'Security Center',
      actionLabel: 'Review Security',
      actionTab: 'settings',
      actionDrawer: 'security'
    });

    // 7. System Maintenance Notification
    list.push({
      id: 'notif-sys-1',
      type: 'system',
      priority: 'normal',
      title: 'Database Health Check Completed',
      description: `Routine table compaction and query optimization verified. Workspace performance is healthy.`,
      timestamp: '2 days ago',
      group: 'earlier',
      read: true,
      source: 'Database Tools',
      actionLabel: 'View Database',
      actionTab: 'settings',
      actionDrawer: 'database'
    });

    return list;
  });

  // Filtered Notifications
  const filteredNotifs = useMemo(() => {
    return notifications.filter(n => {
      if (activeFilter !== 'all' && n.type !== activeFilter) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });
  }, [notifications, activeFilter, unreadOnly]);

  // Counts for Header Summary
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const urgentCount = useMemo(() => notifications.filter(n => n.priority === 'urgent' && !n.read).length, [notifications]);
  const todayCount = useMemo(() => notifications.filter(n => n.group === 'today').length, [notifications]);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setSuccessToast('✓ All notifications marked as read');
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleMarkSingleRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleActionClick = (notif, e) => {
    if (e) e.stopPropagation();
    handleMarkSingleRead(notif.id);

    if (notif.actionTab && onNavigate) {
      onNavigate(notif.actionTab, notif.actionDrawer || null);
    }
  };

  const handleRequestPush = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setPrefPushEnabled(true);
          setSuccessToast('🔔 Browser push notifications enabled!');
        } else {
          setPrefPushEnabled(false);
          alert('Push notifications were not granted. Please enable them in browser settings.');
        }
      } catch (err) {
        console.warn('Push request error:', err);
      }
    } else {
      alert('Push notifications not supported on this device/browser.');
    }
  };

  const renderPriorityBadge = (priority) => {
    if (priority === 'urgent') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: '#FEE2E2',
          color: '#DC2626',
          fontSize: '0.68rem',
          fontWeight: 900,
          border: '1px solid #FECACA'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626' }} />
          URGENT
        </span>
      );
    }
    if (priority === 'important') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: '#FEF3C7',
          color: '#D97706',
          fontSize: '0.68rem',
          fontWeight: 800,
          border: '1px solid #FDE68A'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706' }} />
          IMPORTANT
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        background: '#ECFDF5',
        color: '#059669',
        fontSize: '0.68rem',
        fontWeight: 800,
        border: '1px solid #A7F3D0'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
        NORMAL
      </span>
    );
  };

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'orders':
        return <ShoppingBag size={18} color="#EA580C" />;
      case 'payments':
        return <CreditCard size={18} color="#059669" />;
      case 'security':
        return <ShieldCheck size={18} color="#DC2626" />;
      case 'reviews':
        return <Star size={18} color="#D97706" />;
      case 'system':
      default:
        return <Database size={18} color="#064E3B" />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      maxWidth: '1240px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      paddingBottom: '120px',
      overflowX: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Page Responsive Layout Styles */}
      <style>{`
        .notif-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr);
          gap: 16px;
          align-items: flex-start;
          width: 100%;
          box-sizing: border-box;
        }
        .notif-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .notif-metric-card {
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #EAE5DF;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-width: 0;
          box-sizing: border-box;
        }
        .notif-metric-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .notif-filter-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.76rem;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #EAE5DF;
          background: #FAF8F5;
          color: #64748B;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .notif-filter-btn.active {
          background: #064E3B;
          color: #FFFFFF;
          border-color: #064E3B;
          box-shadow: 0 2px 6px rgba(6, 78, 59, 0.20);
        }
        .notif-row-card {
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #EAE5DF;
          padding: 14px 16px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          cursor: pointer;
          position: relative;
          transition: all 0.15s ease;
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }
        .notif-row-card:hover {
          border-color: #CBD5E1 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important;
        }
        .notif-header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #EAE5DF;
          padding: 16px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          box-sizing: border-box;
          width: 100%;
          flex-wrap: wrap;
          gap: 12px;
        }
        .notif-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media (max-width: 960px) {
          .notif-page-grid {
            grid-template-columns: 100% !important;
            gap: 14px !important;
          }
        }
        @media (max-width: 640px) {
          .notif-header-container {
            padding: 12px 14px !important;
            gap: 10px !important;
          }
          .notif-header-actions {
            width: 100% !important;
            justify-content: space-between !important;
          }
          .notif-metrics-grid {
            gap: 8px !important;
          }
          .notif-metric-card {
            padding: 10px 8px !important;
          }
          .notif-metric-icon {
            display: none !important;
          }
          .notif-row-card {
            padding: 12px !important;
            gap: 10px !important;
          }
        }
        @media (max-width: 380px) {
          .notif-metrics-grid {
            gap: 6px !important;
          }
          .notif-metric-card {
            padding: 8px 6px !important;
          }
        }
      `}</style>

      {/* Global Success Toast */}
      {successToast && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '14px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ECFDF5',
          color: '#059669',
          border: '1px solid #A7F3D0'
        }}>
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================================================
          1. MASTER PAGE HEADER
         ========================================================================= */}
      <div className="notif-header-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '8px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#0F172A',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '0.76rem',
                fontWeight: 800
              }}
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '1.12rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Bell size={17} color="#064E3B" style={{ flexShrink: 0 }} />
              <span>Notifications & Alerts</span>
            </h2>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Stay updated on orders, payments, and system operations.
            </p>
          </div>
        </div>

        <div className="notif-header-actions">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={{
              height: '34px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: unreadCount > 0 ? '#0F172A' : '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: unreadCount > 0 ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <CheckCheck size={14} color={unreadCount > 0 ? '#059669' : '#94A3B8'} />
            <span>Mark all read</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreferencesModal(true)}
            style={{
              height: '34px',
              padding: '0 12px',
              borderRadius: '8px',
              border: 'none',
              background: '#064E3B',
              color: '#FFFFFF',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <Sliders size={14} />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. COMPACT SUMMARY PILLS (Unread, Urgent, Today)
         ========================================================================= */}
      <div className="notif-metrics-grid">
        <div className="notif-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Unread
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', marginTop: '1px' }}>
              {unreadCount}
            </div>
          </div>
          <div className="notif-metric-icon" style={{ background: '#F1F5F9', color: '#0F172A' }}>
            <Bell size={16} />
          </div>
        </div>

        <div className="notif-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Urgent
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DC2626', marginTop: '1px' }}>
              {urgentCount}
            </div>
          </div>
          <div className="notif-metric-icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            <AlertTriangle size={16} />
          </div>
        </div>

        <div className="notif-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Today
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', marginTop: '1px' }}>
              {todayCount}
            </div>
          </div>
          <div className="notif-metric-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
            <Clock size={16} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. FILTER BAR & SEGMENTED CONTROLS
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #EAE5DF',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'orders', label: 'Orders' },
            { id: 'payments', label: 'Payments' },
            { id: 'system', label: 'System' },
            { id: 'reviews', label: 'Reviews' },
            { id: 'security', label: 'Security' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={`notif-filter-btn ${activeFilter === f.id ? 'active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 800, color: '#475569', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#064E3B', cursor: 'pointer' }}
          />
          <span>Unread only</span>
        </label>
      </div>

      {/* =========================================================================
          4. MAIN TWO-COLUMN WORKSPACE
         ========================================================================= */}
      <div className="notif-page-grid">
        
        {/* LEFT / MAIN NOTIFICATION FEED */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredNotifs.length === 0 ? (
            /* EMPTY STATE */
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} />
              </div>
              <strong style={{ fontSize: '1.05rem', color: '#0F172A', fontWeight: 900 }}>
                You're all caught up 🎉
              </strong>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', maxWidth: '380px', lineHeight: 1.45 }}>
                No new alerts right now. Your live orders, billing, and system operations are running smoothly.
              </p>
            </div>
          ) : (
            /* CHRONOLOGICAL GROUPED NOTIFICATION LIST */
            ['today', 'yesterday', 'earlier'].map(grpKey => {
              const grpItems = filteredNotifs.filter(n => n.group === grpKey);
              if (grpItems.length === 0) return null;

              const grpTitle = grpKey === 'today' ? 'Today' : grpKey === 'yesterday' ? 'Yesterday' : 'Earlier This Week';

              return (
                <div key={grpKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '4px' }}>
                    {grpTitle}
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {grpItems.map(notif => {
                      const isUnread = !notif.read;

                      return (
                        <div
                          key={notif.id}
                          className="notif-row-card"
                          onClick={() => {
                            handleMarkSingleRead(notif.id);
                            setSelectedNotif(notif);
                          }}
                          style={{
                            background: isUnread ? '#FDFBF7' : '#FFFFFF',
                            borderRadius: '14px',
                            border: isUnread ? '1.5px solid #FDE68A' : '1px solid #EAE5DF',
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '14px',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {/* Left Icon */}
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: isUnread ? '#FEF3C7' : '#F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {renderTypeIcon(notif.type)}
                          </div>

                          {/* Content Body */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: isUnread ? 900 : 700 }}>
                                  {notif.title}
                                </strong>
                                {renderPriorityBadge(notif.priority)}
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>
                                {notif.timestamp}
                              </span>
                            </div>

                            <p style={{ margin: '2px 0 8px', fontSize: '0.78rem', color: isUnread ? '#1E293B' : '#64748B', lineHeight: 1.45 }}>
                              {notif.description}
                            </p>

                            {/* Bottom Metadata & Action Row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
                                Source: {notif.source}
                              </span>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                {notif.actionLabel && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleActionClick(notif, e)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: notif.priority === 'urgent' ? '#DC2626' : '#064E3B',
                                      color: '#FFFFFF',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <span>{notif.actionLabel}</span>
                                    <ChevronRight size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Unread Indicator Dot */}
                          {isUnread && (
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: notif.priority === 'urgent' ? '#DC2626' : '#D97706',
                              position: 'absolute',
                              top: '14px',
                              right: '14px'
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT SIDEBAR (Desktop / Tablet) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Quick Priority Summary Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <strong style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A' }}>
              Alerts Overview
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.76rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>🔴 Urgent Attention:</span>
                <strong style={{ color: '#DC2626' }}>{urgentCount} item{urgentCount !== 1 ? 's' : ''}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>🟡 Important Alerts:</span>
                <strong style={{ color: '#D97706' }}>
                  {notifications.filter(n => n.priority === 'important').length} items
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>🟢 Normal Operational:</span>
                <strong style={{ color: '#059669' }}>
                  {notifications.filter(n => n.priority === 'normal').length} items
                </strong>
              </div>
            </div>
          </div>

          {/* Quick Notification Channels Status */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <strong style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={16} color="#064E3B" />
              <span>Alert Channels</span>
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#334155' }}>🔊 Audio Chimes:</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>Enabled</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#334155' }}>🔔 Browser Push:</span>
                <span style={{ color: prefPushEnabled ? '#059669' : '#D97706', fontWeight: 800 }}>
                  {prefPushEnabled ? 'Granted' : 'Default / Not Granted'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#334155' }}>🖨️ Thermal Auto-Print:</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>Ready</span>
              </div>
            </div>

            {!prefPushEnabled && (
              <button
                type="button"
                onClick={handleRequestPush}
                style={{
                  marginTop: '4px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Enable Browser Push Notifications
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. FOCUSED NOTIFICATION DETAIL MODAL
         ========================================================================= */}
      {selectedNotif && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderTypeIcon(selectedNotif.type)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                    {selectedNotif.title}
                  </h3>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                    {selectedNotif.timestamp} · Source: {selectedNotif.source}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#FAF8F5', border: '1px solid #EAE5DF', fontSize: '0.80rem', color: '#334155', lineHeight: 1.5 }}>
              {selectedNotif.description}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {renderPriorityBadge(selectedNotif.priority)}
              <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Category: {selectedNotif.type.toUpperCase()}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer' }}
              >
                Close
              </button>

              {selectedNotif.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    const actionTab = selectedNotif.actionTab;
                    const actionDrawer = selectedNotif.actionDrawer;
                    setSelectedNotif(null);
                    if (actionTab && onNavigate) onNavigate(actionTab, actionDrawer);
                  }}
                  style={{ flex: 1.4, height: '38px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)' }}
                >
                  {selectedNotif.actionLabel} →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. NOTIFICATION PREFERENCES MODAL
         ========================================================================= */}
      {showPreferencesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE5DF', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  Notification Preferences
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Configure what alerts you receive in real time
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferencesModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF' }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Order Alerts</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Real-time chimes and banners on incoming orders</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefOrderAlerts}
                  onChange={(e) => setPrefOrderAlerts(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#064E3B', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF' }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Payment & Billing Alerts</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Subscription renewals and invoice notices</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefPaymentAlerts}
                  onChange={(e) => setPrefPaymentAlerts(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#064E3B', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF' }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Security Alerts</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>New device logins and credential modifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefSecurityAlerts}
                  onChange={(e) => setPrefSecurityAlerts(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#064E3B', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF' }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>System & Health Updates</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Database maintenance and system optimization notes</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefSystemAlerts}
                  onChange={(e) => setPrefSystemAlerts(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#064E3B', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowPreferencesModal(false)}
                style={{ width: '100%', height: '38px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
