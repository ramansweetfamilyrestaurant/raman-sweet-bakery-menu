import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCategories, fetchDishes, toggleDishAvailability, toggleCategoryActive, reorderCategories, deleteDish, deleteCategory, fetchRestaurantInfo, updateDishPrice, fetchAnnouncements, fetchAdminOrders, updateOrderStatus, uploadImage, fetchServiceRequests, resolveServiceRequest, approvePresenceRequest, rejectPresenceRequest, fetchAdminAnalytics, exportAdminAnalyticsCSV, exportAdminAnalyticsXLSX, fetchAdminCombos, createCombo, updateCombo, deleteCombo, toggleComboAvailability, optimizeDatabase, updateTenantSettings } from '../../api/client';
import { getPlanDetails } from '../../config/plans';
import { generateQrToken } from '../../utils/qrSecurity';
import { getSpaceConfig } from '../../utils/businessTaxonomy';
import { resolveTenantCapabilities } from '../../utils/planCapabilities';
import { soundManager, unlockNotificationSound, playPresenceAlert, playWaiterAlert, subscribeAudioState } from '../../utils/soundManager';
import { getCurrencySymbol, formatPriceNumber } from '../../utils/currencyHelper';
import DishFormModal from './DishFormModal';
import CategoryFormModal from './CategoryFormModal';
import ComboFormModal from './ComboFormModal';
import { Plus, Edit, Trash2, Eye, EyeOff, LogOut, ArrowLeft, Layers, Utensils, QrCode, Printer, Settings, Star, CheckCircle, Lock, ExternalLink, Megaphone, MessageSquare, Palette, Sparkles, Clock, CheckCircle2, XCircle, Upload, X, BarChart2, TrendingUp, Download, Award, MapPin, RefreshCw, CreditCard } from 'lucide-react';

import PaymentModal from '../PaymentModal';

import './styles/Admin.css';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import AdminBottomNavigation from './components/AdminBottomNavigation';
import AdminDesktopNavigation from './components/AdminDesktopNavigation';
import OrdersView from './views/OrdersView';
import HomeView from './views/HomeView';
import AnalyticsView from './views/AnalyticsView';
import MenuView from './views/MenuView';
import SetupView from './views/SetupView';
import QrGeneratorView from './views/QrGeneratorView';
import ReviewView from './views/ReviewView';
import NotificationView from './views/NotificationView';
import SupportView from './views/SupportView';
import OffersView from './views/OffersView';
import CustomersView from './views/CustomersView';
import BillingView from './views/BillingView';

export default function AdminDashboard({
  token,
  username,
  slug: propSlug = '',
  isImpersonating: propIsImpersonating = false,
  impersonatedRestoName: propImpersonatedRestoName = '',
  onExitImpersonation,
  onLogout,
  onReturnToMenu
}) {
  const isImpersonating = propIsImpersonating || localStorage.getItem('touchqr_superadmin_impersonating') === 'true';
  const impersonatedRestoName = propImpersonatedRestoName || localStorage.getItem('touchqr_impersonated_resto_name') || '';

  const handleExitImpersonation = () => {
    if (onExitImpersonation) {
      onExitImpersonation();
    } else {
      localStorage.removeItem('touchqr_superadmin_impersonating');
      localStorage.removeItem('touchqr_impersonated_resto_name');
      localStorage.removeItem('touchqr_impersonated_resto_id');
      localStorage.removeItem('touchqr_admin_token');
      localStorage.removeItem('touchqr_admin_user');
      localStorage.removeItem('touchqr_admin_slug');
      window.location.href = '/superadmin';
    }
  };

  const getInitialAdminState = (key, fallback) => {
    try {
      const currentSlug = propSlug || localStorage.getItem('touchqr_admin_slug') || '';
      if (!currentSlug) return fallback;
      const saved = localStorage.getItem(`admin_cache_${currentSlug}_${key}`);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'orders', 'dishes', 'analytics', 'settings'
  const [initialSetupDrawer, setInitialSetupDrawer] = useState(null);
  const [categories, setCategories] = useState(() => getInitialAdminState('categories', []));
  const [dishes, setDishes] = useState(() => getInitialAdminState('dishes', []));
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });

  // QR Code Generator State
  const [tableNumber, setTableNumber] = useState('1');
  const [qrGenerated, setQrGenerated] = useState(false);

  // Live Orders (KOT) & Analytics State
  const [orders, setOrders] = useState(() => getInitialAdminState('orders', []));
  const [serviceRequests, setServiceRequests] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [billOrderModal, setBillOrderModal] = useState(null);
  const [acceptRoutingModal, setAcceptRoutingModal] = useState(null); // { order, show: true }
  const [kotFilter, setKotFilter] = useState('all');
  const [prevPendingCount, setPrevPendingCount] = useState(0);
  const [restaurantInfo, setRestaurantInfo] = useState(() => getInitialAdminState('info', null));

  const [combos, setCombos] = useState(() => getInitialAdminState('combos', []));
  const [comboModalData, setComboModalData] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [masterSupportPhone, setMasterSupportPhone] = useState('919876543210');
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [billingModal, setBillingModal] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  // Settings Accordion Folders State
  const [openSettingsSections, setOpenSettingsSections] = useState({
    profile: true,
    permissions: false,
    billing: false,
    security: false
  });

  const toggleSettingsSection = (sectionKey) => {
    setOpenSettingsSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) {
          setMasterSupportPhone(data.support_whatsapp);
        }
      })
      .catch(() => {});
  }, []);

  const getDaysRemaining = (expiryStr) => {
    if (!expiryStr) return null;
    const expiry = new Date(expiryStr);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioBannerDismissed, setAudioBannerDismissed] = useState(false);
  const [hasSoundSetupCompleted, setHasSoundSetupCompleted] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('touchqr_admin_sound_setup_v1') === 'enabled';
    } catch (e) {
      return false;
    }
  });

  const daysLeft = getDaysRemaining(restaurantInfo?.plan_expires_at);
  const isExpired = (daysLeft !== null && daysLeft <= 0) || (restaurantInfo?.active === false || restaurantInfo?.active === 0);

  useEffect(() => {
    // 🔔 1. Auto-Prompt Browser Push Notification Permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setPermissionsGranted(true);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setPermissionsGranted(true);
          }
        }).catch(e => console.warn('Auto Notification permission error:', e));
      }
    }

    // 🔊 2. Subscribe to central audio service readiness state
    const unsubscribeAudio = subscribeAudioState((ready) => {
      setIsAudioReady(ready);
    });

    // 🔊 3. Unlock notification audio on first user gesture
    const handleUserGestureUnlock = () => {
      unlockNotificationSound().then((success) => {
        if (success) {
          setIsAudioReady(true);
          setHasSoundSetupCompleted(true);
          try {
            localStorage.setItem('touchqr_admin_sound_setup_v1', 'enabled');
          } catch (e) {}
        }
      });
    };

    const gestureEvents = ['click', 'pointerdown', 'touchstart', 'keydown', 'mousedown'];
    gestureEvents.forEach(evt => window.addEventListener(evt, handleUserGestureUnlock, { passive: true }));

    return () => {
      unsubscribeAudio();
      gestureEvents.forEach(evt => window.removeEventListener(evt, handleUserGestureUnlock));
    };
  }, [token]);

  const handleEnableSound = () => {
    unlockNotificationSound().then((success) => {
      if (success) {
        setIsAudioReady(true);
        setAudioBannerDismissed(true);
        setHasSoundSetupCompleted(true);
        try {
          localStorage.setItem('touchqr_admin_sound_setup_v1', 'enabled');
        } catch (e) {}
        setToastMessage('🔊 Alert Sounds Unlocked & Active!');
        setTimeout(() => setToastMessage(''), 3000);
      } else {
        setToastMessage('⚠️ Sound could not be enabled. Tap Enable to try again.');
        setTimeout(() => setToastMessage(''), 4000);
      }
    });
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const requestAudioPermission = () => {
    try {
      handleEnableSound();
      playKitchenChime();
    } catch (e) {
      console.warn('Audio test error:', e);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          setToastMessage('🔔 Push Notifications Granted! You will receive live order popups.');
        } else {
          setToastMessage('⚠️ Notifications Blocked. Please allow notifications in browser permissions.');
        }
      } else {
        setToastMessage('⚠️ Push notifications not supported on this browser.');
      }
      setTimeout(() => setToastMessage(''), 4000);
    } catch (e) {
      console.warn('Notification error:', e);
    }
  };

  const pendingLoopRef = useRef(null);
  const activeAudioCtxRef = useRef(null);
  const pendingUpdatesRef = useRef(new Map());

  const stopPendingAlarm = () => {
    if (pendingLoopRef.current) {
      clearInterval(pendingLoopRef.current);
      pendingLoopRef.current = null;
    }
    if (activeAudioCtxRef.current) {
      try {
        activeAudioCtxRef.current.close();
      } catch (e) {}
      activeAudioCtxRef.current = null;
    }
  };

  const playKitchenChime = () => {
    try {
      stopPendingAlarm();
      const ctx = soundManager.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // 🚨 Super Loud Zomato/Swiggy Style 8-Cycle Emergency Order Siren Ringtone 🚨
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

        // Piercing Siren Tone 1 (Sawtooth)
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

        // High Alarm Resonance Tone 2 (Square)
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
      console.warn('Loud Kitchen Alarm error:', e);
    }
  };

  useEffect(() => {
    const hasPendingOrders = Array.isArray(orders) && orders.some(o => {
      const st = String(o.status || '').toLowerCase();
      return st === 'pending' || st === 'placed' || st === 'new';
    });

    if (hasPendingOrders) {
      if (!pendingLoopRef.current) {
        playKitchenChime();
        pendingLoopRef.current = setInterval(() => {
          playKitchenChime();
        }, 2500);
      }
    } else {
      stopPendingAlarm();
    }
    return () => {
      stopPendingAlarm();
    };
  }, [orders]);

  const triggerPresenceVerificationNotification = (tableLabel, requestId) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`🛡️ ${tableLabel}: PRESENCE VERIFICATION!`, {
          body: `Customer is requesting table presence verification to place order (Request P-${requestId}). Click to approve.`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `presence-${requestId}`,
          requireInteraction: true,
          vibrate: [400, 150, 400, 150, 400]
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([400, 150, 400, 150, 400]);
      }
    } catch (e) {
      console.warn('[NOTIFICATION_SOUND] Background notification error:', e);
    }
  };

  const triggerBackgroundNotification = (count) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('🛎️ NEW LIVE ORDER RECEIVED!', {
          body: `You have ${count} active pending/kitchen order(s)! Click to view order details & print KOT.`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'new-order',
          requireInteraction: true, // Keeps notification active on screen until clicked
          vibrate: [300, 100, 300, 100, 300]
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    } catch (e) {
      console.warn('Background notification error:', e);
    }
  };

  const triggerFoodPreparedNotification = (tblNum) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('🍳 FOOD PREPARED IN KITCHEN!', {
          body: `🛎️ ${tblNum} Food is Prepared in Kitchen! Ready to serve to customer.`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'food-prepared',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 400]
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    } catch (e) {
      console.warn('Food prepared notification error:', e);
    }
  };

  const prevServiceReqIdsRef = useRef(new Set());
  const isInitialServiceReqFetchRef = useRef(true);

  const loadOrders = async () => {
    if (!token) return;
    try {
      const [data, reqsData] = await Promise.all([
        fetchAdminOrders(token).catch((err) => {
          if (err && (err.isUnauthorized || err.status === 401 || err.message?.includes('401'))) {
            if (onLogout) onLogout();
          }
          return [];
        }),
        fetchServiceRequests(token).catch((err) => {
          if (err && (err.isUnauthorized || err.status === 401 || err.message?.includes('401'))) {
            if (onLogout) onLogout();
          }
          return [];
        })
      ]);
      const safeData = (Array.isArray(data) ? data : []).filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
      const safeReqs = Array.isArray(reqsData) ? reqsData : [];

      // 🛎️ Dedicated Waiter Call / Service Request Alert Trigger
      const newServiceCalls = safeReqs.filter(r => !prevServiceReqIdsRef.current.has(String(r.id)));
      if (newServiceCalls.length > 0 && !isInitialServiceReqFetchRef.current) {
        const presenceCalls = newServiceCalls.filter(r => r.request_type === 'presence_verification');
        const waiterCalls = newServiceCalls.filter(r => r.request_type !== 'presence_verification');

        if (presenceCalls.length > 0) {
          const latestCall = presenceCalls[0];
          const rawTbl = String(latestCall.table_number || '1');
          const formattedTbl = (rawTbl.toLowerCase().includes('table') || rawTbl.toLowerCase().includes('cabin') || rawTbl.toLowerCase().includes('room') || rawTbl.toLowerCase().includes('vip'))
            ? rawTbl 
            : `Table ${rawTbl}`;
          console.log('[SOUND_DEBUG] presence_request_detected', { id: latestCall.id, table: formattedTbl });
          playPresenceAlert();
          triggerPresenceVerificationNotification(formattedTbl, latestCall.id);
          setToastMessage(`🛡️ ${formattedTbl}: Table Presence Verification Requested!`);
        } else if (waiterCalls.length > 0) {
          const latestCall = waiterCalls[0];
          const rawTbl = String(latestCall.table_number || '1');
          const formattedTbl = (rawTbl.toLowerCase().includes('table') || rawTbl.toLowerCase().includes('cabin') || rawTbl.toLowerCase().includes('room') || rawTbl.toLowerCase().includes('vip'))
            ? rawTbl 
            : `Table ${rawTbl}`;
          console.log('[SOUND_DEBUG] waiter_request_detected', { id: latestCall.id, type: latestCall.request_type, table: formattedTbl });
          playWaiterAlert();
          setToastMessage(`🛎️ ${formattedTbl} Calling Waiter: "${latestCall.request_type}"!`);
        }
        setTimeout(() => setToastMessage(''), 7000);
      }
      isInitialServiceReqFetchRef.current = false;
      prevServiceReqIdsRef.current = new Set(safeReqs.map(r => String(r.id)));

      // Total active live orders (pending + kitchen + accepted)
      const activeOrderCount = safeData.filter(o => ['pending', 'kitchen', 'accepted', 'preparing'].includes(o.status)).length;
      if (activeOrderCount > prevPendingCount) {
        playKitchenChime();
        triggerBackgroundNotification(activeOrderCount);
      }
      setPrevPendingCount(activeOrderCount);

      // Merge safeData with pendingUpdatesRef so optimistic state is never overwritten during background polling
      const mergedOrders = safeData.map(backendOrd => {
        const override = pendingUpdatesRef.current.get(String(backendOrd.id));
        if (override) {
          return { ...backendOrd, ...override };
        }
        return backendOrd;
      });

      // 🛎️ Cross-device/Cross-tab detection: check if any order newly became kitchen_prepared === 1
      setOrders(prevOrders => {
        if (Array.isArray(prevOrders) && prevOrders.length > 0) {
          const newlyPrepared = mergedOrders.find(newOrd => {
            const newIsPrep = newOrd.kitchen_prepared === 1 || newOrd.kitchen_prepared === true || newOrd.kitchen_prepared === '1';
            const oldOrd = prevOrders.find(o => String(o.id) === String(newOrd.id));
            const oldIsPrep = oldOrd && (oldOrd.kitchen_prepared === 1 || oldOrd.kitchen_prepared === true || oldOrd.kitchen_prepared === '1');
            return newIsPrep && !oldIsPrep;
          });

          if (newlyPrepared) {
            playWaiterAlert();
            const tblNum = newlyPrepared.table_number ? `Table ${newlyPrepared.table_number}` : `Order ${newlyPrepared.id}`;
            triggerFoodPreparedNotification(tblNum);
            setToastMessage(`🛎️ ${tblNum} Food is PREPARED in Kitchen! Ready to Serve.`);
            setTimeout(() => setToastMessage(''), 7000);
          }
        }
        return mergedOrders;
      });
      try {
        localStorage.setItem('admin_cache_orders', JSON.stringify(mergedOrders));
      } catch (e) {}
      setServiceRequests(safeReqs);
    } catch (err) {
      console.error('Failed to load orders & requests:', err);
    }
  };

  // Centralized RFC 4180 safe CSV escaping
  const escapeCSVCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const generateAndDownloadCSV = (orderList, titlePrefix = 'Sales_Report') => {
    try {
      if (!orderList || orderList.length === 0) {
        alert('No sales data available to export');
        return;
      }

      const getDateParts = (dateStr) => {
        if (!dateStr) return { date: 'N/A', time: 'N/A' };
        const str = String(dateStr).trim();
        let d = new Date(str);
        if (isNaN(d.getTime())) {
          d = new Date(str.replace(' ', 'T'));
        }
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          let hours = d.getHours();
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          hours = hours ? hours : 12;
          const formattedHours = String(hours).padStart(2, '0');
          return { date: `${day}-${month}-${year}`, time: `${formattedHours}:${minutes} ${ampm}` };
        }
        const parts = str.split(' ');
        if (parts.length >= 2) return { date: parts[0], time: parts[1] };
        return { date: str, time: 'N/A' };
      };

      const headers = [
        'Order ID',
        'Date',
        'Time',
        'Table Number',
        'Customer Name',
        'Customer Phone',
        'Items Count',
        'Items List',
        'Status',
        'Amount (INR)'
      ];

      const rows = orderList.map(order => {
        const { date, time } = getDateParts(order.created_at);
        const parsedItems = safeParseItems(order.items);
        const itemsListStr = parsedItems.map(i => {
          const cleanName = (i.name || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
          return `${cleanName || i.name} (x${i.quantity || 1})`;
        }).join(', ');

        return [
          `#${order.id}`,
          date,
          time,
          String(order.table_number || '1'),
          order.customer_name || 'Dine-In Guest',
          order.customer_phone ? String(order.customer_phone) : 'N/A',
          parsedItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0),
          itemsListStr,
          (order.status || 'COMPLETED').toUpperCase(),
          Number(order.total_amount) || 0
        ];
      });

      // Construct RFC 4180 CSV with UTF-8 BOM (\uFEFF) for seamless Microsoft Excel & multi-language support
      const csvContent = '\uFEFF' + [
        headers.map(escapeCSVCell).join(','),
        ...rows.map(row => row.map(escapeCSVCell).join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const fileName = `${titlePrefix}_${new Date().toISOString().substring(0, 10)}.csv`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[CSV EXPORT ERROR]', err);
      alert('Failed to generate CSV sales report. Please try again.');
    }
  };

  // 📅 Export Today's / Daily Sales (Since 12:00 AM Midnight Today)
  const handleDownloadTodaySalesReport = async () => {
    setExportingAll(true);
    try {
      const blob = await exportAdminAnalyticsCSV(token, 'today');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      link.download = `Daily_Sales_Report_${todayISO}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to export daily sales report');
    } finally {
      setExportingAll(false);
    }
  };

  // 📊 Unified 1-Click Professional Sales Report Export (Step 3.16C)
  const [exportingReport, setExportingReport] = useState(false);
  const handleExportSalesReport = async (period = 'all', year = null, month = null) => {
    if (exportingReport) return;
    setExportingReport(true);
    try {
      const { blob, filename } = await exportAdminAnalyticsXLSX(token, period, year, month);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'Sales_Report.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err.status === 403 || err.feature === 'analytics_export_enabled') {
        alert('Sales Report Export is not enabled on your current subscription plan tier.');
      } else {
        alert('Unable to generate sales report. Please try again.');
      }
    } finally {
      setExportingReport(false);
    }
  };

  // 📊 Backward compatibility fallback handlers
  const [exportingAll, setExportingAll] = useState(false);
  const handleDownloadAllSalesReport = async (period = 'all', year = null, month = null) => {
    return handleExportSalesReport(period, year, month);
  };

  const handleResolveServiceRequest = async (id) => {
    try {
      await resolveServiceRequest(id, token);
      setServiceRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to resolve request');
    }
  };

  const handleApprovePresenceRequest = async (id) => {
    try {
      const res = await approvePresenceRequest(id, token);
      setServiceRequests(prev => prev.filter(r => r.id !== id));
      setToastMessage(res.message || '✓ Table presence approved successfully');
      setTimeout(() => setToastMessage(''), 4000);
      return res;
    } catch (err) {
      alert(err.message || 'Failed to approve presence verification');
      throw err;
    }
  };

  const handleRejectPresenceRequest = async (id, reason) => {
    try {
      const res = await rejectPresenceRequest(id, token, reason);
      setServiceRequests(prev => prev.filter(r => r.id !== id));
      setToastMessage(res.message || 'Presence verification rejected');
      setTimeout(() => setToastMessage(''), 4000);
      return res;
    } catch (err) {
      alert(err.message || 'Failed to reject presence verification');
      throw err;
    }
  };

  const parseDateRobust = (dateStr) => {
    if (!dateStr) return new Date();
    let str = String(dateStr).trim();
    if (!str.includes('Z') && !str.includes('+') && !str.includes('T')) {
      str = str.replace(' ', 'T') + 'Z';
    } else if (!str.includes('Z') && !str.includes('+')) {
      str = str + 'Z';
    }
    let d = new Date(str);
    if (isNaN(d.getTime())) d = new Date(dateStr);
    return d;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return { timeStr: '', agoStr: '' };
    try {
      let d = parseDateRobust(dateStr);
      const now = new Date();
      const diffMins = Math.floor((now - d) / 60000);
      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      if (diffMins < 1) return { timeStr, agoStr: 'Just now' };
      let agoStr = 'Just now';
      if (diffMins >= 1 && diffMins < 60) agoStr = `${diffMins}m ago`;
      else if (diffMins >= 60) {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        agoStr = `${hrs}h ${mins}m ago`;
      }
      return { timeStr, agoStr };
    } catch (e) {}
    return { timeStr: String(dateStr), agoStr: '' };
  };

  const formatDateTimeString = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = parseDateRobust(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return String(dateStr);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus, extraParams = {}) => {
    const key = String(orderId);
    pendingUpdatesRef.current.set(key, { status: newStatus, ...extraParams });

    // ⚡ Optimistic UI update (0ms lag, zero flickering)
    if (newStatus === 'accepted' || newStatus === 'kitchen' || newStatus === 'preparing') {
      stopPendingAlarm();
    }
    if (newStatus === 'rejected' || newStatus === 'cancelled') {
      setOrders(prev => prev.filter(o => String(o.id) !== key));
    } else {
      setOrders(prev => prev.map(o => String(o.id) === key ? { ...o, status: newStatus, ...extraParams } : o));
    }

    try {
      await updateOrderStatus(orderId, newStatus, token, extraParams);
      setTimeout(() => {
        pendingUpdatesRef.current.delete(key);
      }, 3000);

      if (extraParams.kitchen_prepared === 1 || extraParams.kitchen_prepared === '1' || extraParams.kitchen_prepared === true) {
        if (!extraParams.silent) {
          try {
            playWaiterAlert();
          } catch (soundErr) {
            console.warn('[SOUND] Kitchen prepared notification sound failed:', soundErr);
          }
        }
        const targetOrder = orders.find(o => String(o.id) === key);
        const tblNum = targetOrder?.table_number ? `Table ${targetOrder.table_number}` : `Order ${orderId}`;
        setToastMessage(`🛎️ ${tblNum} Food is PREPARED in Kitchen! Ready to Serve.`);
        setTimeout(() => setToastMessage(''), 5000);
      } else if (newStatus === 'served' || newStatus === 'completed') {
        if (!extraParams.silent) {
          try {
            playWaiterAlert();
          } catch (soundErr) {
            console.warn('[SOUND] Order completion notification sound failed:', soundErr);
          }
        }
        const targetOrder = orders.find(o => String(o.id) === key);
        const tblNum = targetOrder?.table_number ? `Table ${targetOrder.table_number}` : `Order ${orderId}`;
        const msg = newStatus === 'served' ? `📦 ${tblNum} Marked SERVED at Counter` : `💳 ${tblNum} Served & Bill Completed!`;
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
      }
    } catch (err) {
      pendingUpdatesRef.current.delete(key);
      alert(err.message || 'Failed to update order status');
      loadOrders(); // rollback on failure
    }
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

  const safeParseModifiers = (rawModifiers) => {
    if (!rawModifiers) return [];
    if (Array.isArray(rawModifiers)) return rawModifiers;
    if (typeof rawModifiers === 'string') {
      try {
        const parsed = JSON.parse(rawModifiers);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // ⚡ RawBT Direct Thermal Printer ESC/POS Generator
  const generateRawBTText = (order, type = 'kot', restoInfo = {}, isReprint = false) => {
    let text = '';
    const orderItems = safeParseItems(order.items);
    const currency = getCurrencySymbol(restoInfo?.currency_symbol);

    if (type === 'kot') {
      text += "================================" + "\n";
      text += "       *** KITCHEN KOT ***      " + "\n";
      if (isReprint) {
        text += "      *** [ REPRINT ] ***       \n";
      }
      text += "================================" + "\n";
      text += `KOT No: ${order.id}\n`;
      text += `Time: ${new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN')}\n`;
      text += `Waiter/Guest: ${order.customer_name || 'Dine-In'}\n`;
      text += "--------------------------------" + "\n";
      text += "QTY  ITEM NAME\n";
      text += "--------------------------------" + "\n";
      orderItems.forEach(i => {
        const name = (i.name + (i.portion ? ` (${i.portion})` : '')).substring(0, 26);
        const qty = String(i.quantity).padEnd(4);
        text += `${qty} ${name}\n`;
        const mods = safeParseModifiers(i.modifiers);
        if (mods.length > 0) {
          text += `    ↳ + ${mods.map(m => m.name).join(', ')}\n`;
        }
      });
      text += "--------------------------------" + "\n";
      text += `TOTAL BILL: ${currency}${formatPriceNumber(order.total_amount)}\n`;
      text += "================================" + "\n";
      text += "  *** READY FOR KITCHEN ***\n\n\n";
    } else {
      const isGst = Boolean(restoInfo?.gst_enabled);
      const gstin = restoInfo?.gstin_number || '';
      const fssai = restoInfo?.fssai_lic_no || '';

      text += "================================" + "\n";
      text += `   ${(restoInfo?.name || 'RESTAURANT').toUpperCase()}\n`;
      if (restoInfo?.address) text += `   ${restoInfo.address}\n`;
      if (restoInfo?.phone) text += `   Ph: ${restoInfo.phone}\n`;
      if (fssai) text += `   FSSAI Lic: ${fssai}\n`;
      if (gstin) text += `   GSTIN: ${gstin}\n`;
      text += `   --- ${isGst ? 'TAX INVOICE' : 'FINAL BILL'} ---\n`;
      if (isReprint) {
        text += "      *** [ REPRINT ] ***       \n";
      }
      text += "================================" + "\n";
      text += `Bill No: INV-${order.id}\n`;
      text += `Date: ${new Date(order.created_at || Date.now()).toLocaleString('en-IN')}\n`;
      text += `Customer: ${order.customer_name || 'Dine-In Guest'}\n`;
      text += "--------------------------------" + "\n";
      text += "QTY  ITEM NAME            AMOUNT" + "\n";
      text += "--------------------------------" + "\n";
      let subtotal = 0;
      orderItems.forEach(i => {
        const itemLineTotal = Number(i.price) * Number(i.quantity);
        subtotal += itemLineTotal;
        const name = (i.name + (i.portion ? ` (${i.portion})` : '')).padEnd(20).substring(0, 20);
        const qty = String(i.quantity).padEnd(4);
        const amt = `${currency}${formatPriceNumber(itemLineTotal)}`.padStart(7);
        text += `${qty}${name}${amt}\n`;
        const mods = safeParseModifiers(i.modifiers);
        if (mods.length > 0) {
          text += `    ↳ + ${mods.map(m => m.name).join(', ')}\n`;
        }
      });
      text += "--------------------------------" + "\n";
      if (isGst) {
        const cgst = Math.round(subtotal * 0.025 * 100) / 100;
        const sgst = Math.round(subtotal * 0.025 * 100) / 100;
        const grandTotal = Math.round((subtotal + cgst + sgst) * 100) / 100;
        text += `Subtotal:      ${(currency + formatPriceNumber(subtotal)).padStart(17)}\n`;
        text += `CGST (2.5%):   ${(currency + formatPriceNumber(cgst)).padStart(17)}\n`;
        text += `SGST (2.5%):   ${(currency + formatPriceNumber(sgst)).padStart(17)}\n`;
        text += "--------------------------------\n";
        text += `Grand Total:   ${(currency + formatPriceNumber(grandTotal)).padStart(17)}\n`;
      } else {
        text += `Grand Total:   ${(currency + formatPriceNumber(subtotal)).padStart(17)}\n`;
      }
      text += "================================" + "\n";
      text += "   Thank you! Visit Again 🙏\n\n\n";
    }
    return text;
  };

  // 🖨️ Silent Thermal Printer Engine (Zero-Popup Hidden Iframe / RawBT Printer)
  const silentIframePrint = (htmlContent, order = null, type = 'kot', isReprint = false) => {
    return new Promise((resolve, reject) => {
      try {
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid && order) {
          try {
            const rawText = generateRawBTText(order, type, restaurantInfo, isReprint);
            const b64Data = btoa(unescape(encodeURIComponent(rawText)));
            window.location.href = `intent:base64,${b64Data}#Intent;scheme=rawbt;package=ru.a2o.rawbtprinter;end;`;
            resolve(true);
            return;
          } catch (e) {
            console.warn('RawBT intent fallback to iframe print:', e);
          }
        }

        let iframe = document.getElementById('khana-silent-printer-frame');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'khana-silent-printer-frame';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0px';
          iframe.style.height = '0px';
          iframe.style.border = '0';
          iframe.style.visibility = 'hidden';
          document.body.appendChild(iframe);
        }

        const iframeDoc = iframe.contentWindow || iframe.contentDocument;
        const targetDoc = iframeDoc.document || iframeDoc;

        targetDoc.open();
        targetDoc.write(htmlContent);
        targetDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve(true);
          } catch (err) {
            reject(err);
          }
        }, 250);
      } catch (err) {
        reject(err);
      }
    });
  };

  const [printingOrderId, setPrintingOrderId] = useState(null);
  const [printingType, setPrintingType] = useState(null);
  const [printToast, setPrintToast] = useState(null);
  const [printedOrdersMap, setPrintedOrdersMap] = useState({}); // { orderId_type: count }

  const showPrintToast = (type, message, order = null, printType = null, paymentMode = 'CASH') => {
    setPrintToast({ type, message, order, printType, paymentMode });
    if (type === 'success') {
      setTimeout(() => {
        setPrintToast(prev => (prev?.message === message ? null : prev));
      }, 3500);
    }
  };

  const getKOTHTML = (order, isReprint = false, paperWidth = '80mm') => {
    let totalQty = 0;
    let itemsHtml = '';
    const parsedItems = safeParseItems(order.items);
    const selectedWidth = (paperWidth || settingsForm.printer_paper_width) === '58mm' ? '58mm' : '80mm';
    const bodyWidth = selectedWidth === '58mm' ? '48mm' : '72mm';

    parsedItems.forEach(i => {
      const q = Number(i.quantity) || 1;
      totalQty += q;
      const portionText = i.portion ? ` [${i.portion}]` : '';
      const mods = safeParseModifiers(i.modifiers);
      const modText = mods.length > 0
        ? `<div style="font-size:12px;color:#222;font-weight:600;padding-left:28px;margin-top:2px;">👉 ${mods.map(m => m.name).join(', ')}</div>`
        : '';
      const comboText = (i.includes || i.comboIncludes)
        ? `<div style="font-size:11px;color:#444;font-style:italic;padding-left:28px;margin-top:2px;">📦 ${i.includes || i.comboIncludes}</div>`
        : '';

      itemsHtml += `
        <tr style="border-bottom:1px solid #000;">
          <td style="padding:8px 0;vertical-align:top;">
            <div style="display:flex;align-items:flex-start;">
              <span style="font-size:18px;font-weight:900;min-width:32px;display:inline-block;">${q}x</span>
              <div>
                <span style="font-size:15px;font-weight:900;letter-spacing:-0.2px;">${i.name}${portionText}</span>
                ${comboText}
                ${modText}
              </div>
            </div>
          </td>
        </tr>
      `;
    });

    const isRoundAddon = Number(order.round_number) > 1;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>KOT ${order.id}</title>
          <style>
            @page { margin: 0; size: ${selectedWidth} auto; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              width: ${bodyWidth};
              margin: 0 auto;
              padding: 10px;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .reprint-banner {
              background: #000;
              color: #FFF;
              text-align: center;
              font-weight: 900;
              font-size: 13px;
              padding: 4px 0;
              margin-bottom: 8px;
              letter-spacing: 1px;
              border-radius: 4px;
            }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
            .header h2 { margin: 0; font-size: 19px; font-weight: 900; letter-spacing: 0.5px; }
            .table-badge {
              border: 2px solid #000;
              padding: 4px 10px;
              font-size: 18px;
              font-weight: 900;
              display: inline-block;
              margin: 6px 0 4px 0;
            }
            .round-badge {
              background: #000;
              color: #FFF;
              padding: 4px 10px;
              font-size: 13px;
              font-weight: 900;
              display: block;
              margin: 4px auto 0 auto;
              border-radius: 4px;
              border: 1px solid #000;
            }
            .meta { border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; font-size: 12px; line-height: 1.5; }
            table { width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 8px; }
            .total-qty { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; font-weight: 900; font-size: 15px; display: flex; justify-content: space-between; margin-top: 4px; }
            .footer { text-align: center; font-size: 11px; margin-top: 10px; font-weight: bold; border-top: 1px dashed #000; padding-top: 6px; }
          </style>
        </head>
        <body>
          ${isReprint ? `<div class="reprint-banner">*** [ REPRINT ] ***</div>` : ''}
          <div class="header">
            <h2>KITCHEN ORDER TICKET</h2>
            <div class="table-badge">KOT ${order.id}</div>
            ${isRoundAddon
              ? `<div class="round-badge">🔄 ROUND ${order.round_number} (ADD-ON ORDER)</div>`
              : `<div style="font-weight:900;font-size:12px;margin-top:2px;">ROUND 1 (NEW ORDER)</div>`
            }
          </div>

          <div class="meta">
            <div><strong>Date & Time:</strong> ${formatDateTimeString(order.created_at)}</div>
            <div><strong>Customer:</strong> ${order.customer_name || 'Dine-In Guest'}</div>
          </div>

          <table>
            <thead>
              <tr style="border-bottom:2px solid #000;text-align:left;font-size:13px;">
                <th style="padding-bottom:4px;">ITEMS TO COOK</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-qty">
            <span>TOTAL ITEMS IN THIS KOT:</span>
            <span>${totalQty}</span>
          </div>

          <div class="footer">
            *** COOK ONLY THE ITEMS LISTED IN THIS KOT ***
          </div>
        </body>
      </html>
    `;
  };

  const getBillHTML = (order, paymentMode = 'CASH', isReprint = false, paperWidth = '80mm') => {
    const isGst = restaurantInfo?.gst_enabled;
    const gstin = restaurantInfo?.gstin_number || '';
    const fssai = restaurantInfo?.fssai_lic_no || '';
    const currency = (restaurantInfo?.currency_symbol !== undefined && restaurantInfo?.currency_symbol !== null) ? restaurantInfo.currency_symbol : '₹';
    const selectedWidth = (paperWidth || settingsForm.printer_paper_width) === '58mm' ? '58mm' : '80mm';
    const bodyWidth = selectedWidth === '58mm' ? '48mm' : '72mm';

    // Consolidate ONLY orders belonging to this exact dining session
    let sessionOrders = [];
    if (order.session_id) {
      sessionOrders = (Array.isArray(orders) ? orders : []).filter(o => 
        o.session_id === order.session_id &&
        o.status !== 'rejected' && o.status !== 'cancelled'
      );
    } else if (order.parent_order_id) {
      sessionOrders = (Array.isArray(orders) ? orders : []).filter(o => 
        (o.id === order.parent_order_id || o.parent_order_id === order.parent_order_id || o.id === order.id) &&
        o.status !== 'rejected' && o.status !== 'cancelled'
      );
    } else {
      // Standalone single order (or parent order without session_id)
      sessionOrders = (Array.isArray(orders) ? orders : []).filter(o => 
        (o.id === order.id || o.parent_order_id === order.id) &&
        o.status !== 'rejected' && o.status !== 'cancelled'
      );
    }

    if (sessionOrders.length === 0) {
      if (order.status !== 'rejected' && order.status !== 'cancelled') {
        sessionOrders = [order];
      } else {
        sessionOrders = [];
      }
    }
    sessionOrders.sort((a, b) => (Number(a.round_number) || Number(a.id)) - (Number(b.round_number) || Number(b.id)));

    const targetOrders = sessionOrders;
    const totalRoundsCount = targetOrders.length;

    let subtotal = 0;
    let itemsHtml = '';

    targetOrders.forEach((ord, oIdx) => {
      const parsed = safeParseItems(ord.items);
      if (totalRoundsCount > 1) {
        itemsHtml += `
          <tr style="background:#F1F5F9;">
            <td colspan="2" style="padding:4px 6px;font-weight:900;font-size:11px;color:#334155;border-top:1px solid #CBD5E1;">
              ROUND ${ord.round_number || (oIdx + 1)} • KOT ${ord.id}
            </td>
          </tr>
        `;
      }
      parsed.forEach(i => {
        const portionText = i.portion ? ` (${i.portion})` : '';
        const mods = safeParseModifiers(i.modifiers);
        const modText = mods.length > 0
          ? `<div style="font-size:11px;color:#555;font-weight:normal;padding-left:6px;margin-top:2px;">+ ${mods.map(m => `${m.name} (+${currency}${m.price})`).join(', ')}</div>`
          : '';
        const lineTotal = Number(i.price) * Number(i.quantity);
        subtotal += lineTotal;
        itemsHtml += `
          <tr>
            <td style="padding:4px 0;font-weight:bold;font-size:13px;border-bottom:1px dashed #DDD;">
              ${i.quantity}x ${i.name}${portionText}
              ${modText}
            </td>
            <td style="text-align:right;font-weight:bold;font-size:13px;border-bottom:1px dashed #DDD;vertical-align:top;">${currency}${lineTotal}</td>
          </tr>
        `;
      });
    });

    let cgst = 0;
    let sgst = 0;
    let grandTotal = subtotal;

    if (isGst) {
      cgst = Math.round(subtotal * 0.025 * 100) / 100;
      sgst = Math.round(subtotal * 0.025 * 100) / 100;
      grandTotal = Math.round((subtotal + cgst + sgst) * 100) / 100;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Customer Bill ${order.id}</title>
          <style>
            @page { margin: 0; size: ${selectedWidth} auto; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; width: ${bodyWidth}; margin: 0 auto; padding: 10px; color: #000; }
            .reprint-banner {
              background: #000;
              color: #FFF;
              text-align: center;
              font-weight: 900;
              font-size: 13px;
              padding: 4px 0;
              margin-bottom: 8px;
              letter-spacing: 1px;
              border-radius: 4px;
            }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
            .header h2 { margin: 0; font-size: 18px; font-weight: 900; }
            .header p { margin: 2px 0; font-size: 11px; }
            .meta { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px; font-size: 12px; line-height: 1.4; }
            table { width: 100%; font-size: 12px; border-collapse: collapse; margin-bottom: 8px; }
            .totals { border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 8px; }
            .grand-total { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; font-weight: 900; font-size: 16px; display: flex; justify-content: space-between; margin-top: 4px; }
            .footer { text-align: center; font-size: 11px; margin-top: 10px; }
            .badge { display: inline-block; padding: 2px 6px; background: #000; color: #fff; font-size: 11px; font-weight: bold; border-radius: 4px; }
          </style>
        </head>
        <body>
          ${isReprint ? `<div class="reprint-banner">*** [ REPRINT ] ***</div>` : ''}
          <div class="header">
            <h2>${restaurantInfo?.name || 'Restaurant'}</h2>
            ${restaurantInfo?.address ? `<p>${restaurantInfo.address}</p>` : ''}
            ${restaurantInfo?.phone ? `<p>Tel: ${restaurantInfo.phone}</p>` : ''}
            ${gstin ? `<p style="font-weight:bold;">GSTIN: ${gstin}</p>` : ''}
            ${fssai ? `<p>FSSAI: ${fssai}</p>` : ''}
          </div>

          <div class="meta">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong>INVOICE ${order.id}</strong>
              <span class="badge">${paymentMode}</span>
            </div>
            <div><strong>Date:</strong> ${formatDateTimeString(order.created_at)}</div>
            <div><strong>Guest:</strong> ${order.customer_name || 'Dine-In Customer'}</div>
            ${totalRoundsCount > 1 ? `<div style="font-weight:bold;color:#0F766E;">Consolidated Bill: ${totalRoundsCount} Rounds</div>` : ''}
          </div>

          <table>
            <thead>
              <tr style="border-bottom:1px solid #000;text-align:left;font-size:11px;">
                <th>ITEM</th>
                <th style="text-align:right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span>Subtotal:</span>
              <span>${currency}${subtotal}</span>
            </div>
            ${isGst ? `
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#333;">
                <span>CGST @ 2.5%:</span>
                <span>${currency}${cgst}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#333;">
                <span>SGST @ 2.5%:</span>
                <span>${currency}${sgst}</span>
              </div>
            ` : ''}
            <div class="grand-total">
              <span>GRAND TOTAL:</span>
              <span>${currency}${grandTotal}</span>
            </div>
          </div>

          <div class="footer">
            <p style="margin:0;font-weight:bold;">Thank you for dining with us!</p>
            <p style="margin:2px 0 0 0;">Please Visit Again 🙏</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleDirectBluetoothPrint = (order, printType = 'kot') => {
    if (printType === 'kot') {
      handlePrintKOT(order);
    } else {
      setBillOrderModal(order);
    }
  };

  const handlePrintKOT = async (order) => {
    if (!order || (printingOrderId === order.id && printingType === 'kot')) return;
    setPrintingOrderId(order.id);
    setPrintingType('kot');

    const printKey = `${order.id}_kot`;
    const isReprint = Boolean(printedOrdersMap[printKey]);

    try {
      const isDual = (settingsForm.printer_mode === 'dual' && (restaurantInfo?.dual_printer_enabled === 1 || restaurantInfo?.permissions?.dual_printer_enabled));
      const printerRole = isDual ? 'kitchen' : 'single';
      const paperWidth = settingsForm.printer_paper_width || '80mm';

      // Log print attempt to server
      try {
        await fetch('/api/admin/print/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            order_id: order.id,
            session_id: order.session_id || null,
            round_number: order.round_number || 1,
            print_type: 'kot',
            printer_role: printerRole,
            status: 'printed'
          })
        });
      } catch (logErr) {
        console.warn('Notice logging print job:', logErr);
      }

      const htmlContent = getKOTHTML(order, isReprint, paperWidth);
      await silentIframePrint(htmlContent, order, 'kot', isReprint);
      setPrintedOrdersMap(prev => ({ ...prev, [printKey]: (prev[printKey] || 0) + 1 }));
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('success', isReprint ? '✓ KOT re-printed' : '✓ KOT printed', order, 'kot');
    } catch (err) {
      console.error('KOT printing error:', err);
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('error', '⚠ Printer unavailable', order, 'kot');
    }
  };

  const handlePrintCustomerBill = async (order, paymentMode = 'CASH') => {
    if (!order || (printingOrderId === order.id && printingType === 'bill')) return;
    setPrintingOrderId(order.id);
    setPrintingType('bill');

    const printKey = `${order.id}_bill`;
    const isReprint = Boolean(printedOrdersMap[printKey]);

    try {
      const isDual = (settingsForm.printer_mode === 'dual' && (restaurantInfo?.dual_printer_enabled === 1 || restaurantInfo?.permissions?.dual_printer_enabled));
      const printerRole = isDual ? 'billing' : 'single';
      const paperWidth = settingsForm.printer_paper_width || '80mm';

      // Log print attempt to server
      try {
        await fetch('/api/admin/print/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            order_id: order.id,
            session_id: order.session_id || null,
            round_number: order.round_number || 1,
            print_type: 'bill',
            printer_role: printerRole,
            status: 'printed'
          })
        });
      } catch (logErr) {
        console.warn('Notice logging print job:', logErr);
      }

      const htmlContent = getBillHTML(order, paymentMode, isReprint, paperWidth);
      await silentIframePrint(htmlContent, order, 'bill', isReprint);
      setPrintedOrdersMap(prev => ({ ...prev, [printKey]: (prev[printKey] || 0) + 1 }));
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('success', isReprint ? '✓ Bill re-printed' : '✓ Bill printed', order, 'bill', paymentMode);
    } catch (err) {
      console.error('Bill printing error:', err);
      setPrintingOrderId(null);
      setPrintingType(null);
      showPrintToast('error', '⚠ Printer unavailable', order, 'bill', paymentMode);
    }
  };

  const handlePreviewPrint = (order, type = 'kot', paymentMode = 'CASH') => {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) {
      alert('Please allow popups to open the print preview.');
      return;
    }
    const isReprint = Boolean(printedOrdersMap[`${order.id}_${type}`]);
    const htmlContent = type === 'kot' ? getKOTHTML(order, isReprint) : getBillHTML(order, paymentMode, isReprint);
    printWindow.document.write(`
      ${htmlContent}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 2000);
    return () => clearInterval(interval);
  }, [token]);

  const [analyticsFilterState, setAnalyticsFilterState] = useState({ period: 'all', year: null, month: null });
  const analyticsFetchRef = useRef(false);

  useEffect(() => {
    let interval = null;
    if (activeTab === 'analytics' && token) {
      const fetchAnalyticsNow = async () => {
        if (analyticsFetchRef.current) return;
        analyticsFetchRef.current = true;
        try {
          const data = await fetchAdminAnalytics(token, analyticsFilterState.period, analyticsFilterState.year, analyticsFilterState.month);
          if (data) setAnalyticsData(data);
        } catch (err) {
          console.warn('Analytics polling notice:', err);
        } finally {
          analyticsFetchRef.current = false;
        }
      };

      fetchAnalyticsNow();
      interval = setInterval(fetchAnalyticsNow, 10000); // 10s auto-refresh when tab is active
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, token, analyticsFilterState]);

  const handleFilterAnalytics = async (period = 'all', year = null, month = null) => {
    setAnalyticsFilterState({ period, year, month });
    if (!token) return;
    try {
      const data = await fetchAdminAnalytics(token, period, year, month);
      if (data) setAnalyticsData(data);
    } catch (err) {
      console.warn('Filter analytics error:', err);
    }
  };

  // Settings State
  const [settingsForm, setSettingsForm] = useState(() => {
    const infoData = getInitialAdminState('info', null);
    const defaultVis = { must_try: true, combo: true, special: true, under100: true };
    if (infoData) {
      return {
        id: infoData.id,
        name: infoData.name || '',
        slug: infoData.slug || '',
        tagline: infoData.tagline || '',
        logo: infoData.logo || '',
        phone: infoData.phone || '',
        address: infoData.address || '',
        openingHours: infoData.openingHours || '',
        google_review_url: infoData.google_review_url || '',
        google_maps_url: infoData.google_maps_url || '',
        currency_symbol: (infoData.currency_symbol !== null && infoData.currency_symbol !== undefined) ? infoData.currency_symbol : '₹',
        fssai_lic_no: infoData.fssai_lic_no || '',
        resto_type: infoData.resto_type || 'pure_veg',
        business_type: infoData.business_type !== undefined ? infoData.business_type : null,
        food_type: infoData.food_type !== undefined ? infoData.food_type : null,
        service_model: infoData.service_model || 'dine_in',
        latitude: infoData.latitude !== undefined && infoData.latitude !== null ? infoData.latitude : 26.6500,
        longitude: infoData.longitude !== undefined && infoData.longitude !== null ? infoData.longitude : 84.9167,
        max_distance_meters: infoData.max_distance_meters || 100,
        gst_enabled: infoData.gst_enabled !== undefined ? infoData.gst_enabled : false,
        gstin_number: infoData.gstin_number || '',
        total_tables: infoData.total_tables !== undefined && infoData.total_tables !== null ? Number(infoData.total_tables) : 0,
        total_cabins: infoData.total_cabins !== undefined && infoData.total_cabins !== null ? Number(infoData.total_cabins) : 0,
        total_rooms: infoData.total_rooms !== undefined && infoData.total_rooms !== null ? Number(infoData.total_rooms) : 0,
        total_vip: infoData.total_vip !== undefined && infoData.total_vip !== null ? Number(infoData.total_vip) : 0,
        table_prefix: infoData.table_prefix || 'table',
        order_retention_days: infoData.order_retention_days || 7,
        custom_domain: infoData.custom_domain || '',
        watermark_removal_enabled: infoData.watermark_removal_enabled === 1 || infoData.watermark_removal_enabled === true || infoData.watermark_removal_enabled === '1',
        custom_domain_enabled: infoData.custom_domain_enabled === 1 || infoData.custom_domain_enabled === true || infoData.custom_domain_enabled === '1',
        analytics_export_enabled: infoData.analytics_export_enabled === 1 || infoData.analytics_export_enabled === true || infoData.analytics_export_enabled === '1',
        gst_invoice_enabled: infoData.gst_invoice_enabled === 1 || infoData.gst_invoice_enabled === true || infoData.gst_invoice_enabled === '1',
        ai_review_enabled: infoData.ai_review_enabled === 1 || infoData.ai_review_enabled === true || infoData.ai_review_enabled === '1',
        bluetooth_kot_enabled: infoData.bluetooth_kot_enabled === 1 || infoData.bluetooth_kot_enabled === true || infoData.bluetooth_kot_enabled === '1',
        kds_enabled: (infoData.kds_enabled ?? infoData.permissions?.kds_enabled) === 1 || (infoData.kds_enabled ?? infoData.permissions?.kds_enabled) === true || (infoData.kds_enabled ?? infoData.permissions?.kds_enabled) === '1',
        kds_screen_enabled: infoData.kds_screen_enabled !== undefined ? infoData.kds_screen_enabled : 1,
        dual_printer_enabled: (infoData.dual_printer_enabled ?? infoData.permissions?.dual_printer_enabled) === 1 || (infoData.dual_printer_enabled ?? infoData.permissions?.dual_printer_enabled) === true || (infoData.dual_printer_enabled ?? infoData.permissions?.dual_printer_enabled) === '1',
        theme_color: infoData.theme_color || 'gold',
        filters_visibility: { ...defaultVis, ...infoData.filters_visibility }
      };
    }
    return {
      name: '',
      tagline: '',
      phone: '',
      address: '',
      openingHours: '',
      google_review_url: '',
      google_maps_url: '',
      currency_symbol: '₹',
      fssai_lic_no: '',
      resto_type: 'pure_veg',
      theme_color: 'gold',
      custom_domain: '',
      total_tables: 0,
      total_cabins: 0,
      total_rooms: 0,
      total_vip: 0,
      table_prefix: 'table',
      watermark_removal_enabled: false,
      custom_domain_enabled: false,
      analytics_export_enabled: false,
      gst_invoice_enabled: false,
      ai_review_enabled: false,
      bluetooth_kot_enabled: false,
      kds_enabled: false,
      kds_screen_enabled: 0,
      dual_printer_enabled: false,
      latitude: 26.6500,
      longitude: 84.9167,
      max_distance_meters: 100,
      gst_enabled: false,
      gstin_number: '',
      order_retention_days: 7,
      filters_visibility: defaultVis
    };
  });
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg, duration = 2500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    if (duration > 0) {
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage('');
      }, duration);
    }
  };

  const getSpaceField = (prefix) => {
    const t = String(prefix || settingsForm.table_prefix || 'table').toLowerCase();
    if (t === 'cabin') return 'total_cabins';
    if (t === 'room') return 'total_rooms';
    if (t === 'vip') return 'total_vip';
    return 'total_tables';
  };

  // Credential Change State
  const [credForm, setCredForm] = useState({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' });
  const [credMsg, setCredMsg] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  // Modals
  const [dishModalData, setDishModalData] = useState(null); // null (closed), 'new', or dish object
  const [catModalData, setCatModalData] = useState(null);
  const [comboLimitModalInfo, setComboLimitModalInfo] = useState(null);

  const handleOpenCreateCombo = () => {
    const currentCount = (combos || []).length;
    const planKey = (settingsForm.plan_tier || (info && info.plan_tier) || 'pro').toLowerCase();
    const maxCombos = (restaurantInfo?.max_combos !== undefined && restaurantInfo?.max_combos !== null) 
      ? Number(restaurantInfo.max_combos) 
      : ((info?.max_combos !== undefined && info?.max_combos !== null) 
          ? Number(info.max_combos) 
          : (planInfo?.max_combos !== undefined ? planInfo.max_combos : (planKey === 'basic' ? 3 : planKey === 'pro' ? 10 : 9999)));

    if (currentCount >= maxCombos) {
      setComboLimitModalInfo({
        currentCount,
        maxCombos,
        planTier: planKey.toUpperCase()
      });
      return;
    }
    setComboModalData('new');
  };

  const handleAddTable = async (customCount = null, targetPrefix = null) => {
    const prefix = targetPrefix || settingsForm.table_prefix || 'table';
    const field = getSpaceField(prefix);
    const spaceInfo = getSpaceConfig(prefix);
    const currentCount = Number(settingsForm[field]) || 0;
    const newCount = customCount !== null ? Math.max(0, Number(customCount)) : (currentCount + 1);
    const updatedForm = { ...settingsForm, [field]: newCount, table_prefix: prefix };
    setSettingsForm(updatedForm);
    setRestaurantInfo(prev => prev ? ({ ...prev, [field]: newCount, table_prefix: prefix }) : prev);
    setTableNumber(String(Math.max(1, newCount)));
    showToast(`✅ Total ${spaceInfo.plural}: ${newCount}`, 2000);

    const currentSlug = propSlug || localStorage.getItem('touchqr_admin_slug') || (restaurantInfo && restaurantInfo.slug) || '';
    if (currentSlug) {
      localStorage.setItem(`touchqr_table_prefix_${currentSlug}`, prefix);
      const cached = localStorage.getItem(`admin_cache_${currentSlug}_info`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          parsed[field] = newCount;
          parsed.table_prefix = prefix;
          localStorage.setItem(`admin_cache_${currentSlug}_info`, JSON.stringify(parsed));
        } catch {}
      }
    }

    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedForm)
      });
    } catch (err) {
      console.error('Failed to add space unit:', err);
    }
  };

  const handleDeleteTable = async (tableNumToDelete = null, targetPrefix = null) => {
    const prefix = targetPrefix || settingsForm.table_prefix || 'table';
    const field = getSpaceField(prefix);
    const spaceInfo = getSpaceConfig(prefix);
    const currentCount = Number(settingsForm[field]) || 0;
    if (currentCount <= 0) {
      showToast(`⚠️ No ${spaceInfo.plural.toLowerCase()} to remove!`, 2000);
      return;
    }
    const targetNum = (tableNumToDelete !== null && tableNumToDelete !== undefined) ? tableNumToDelete : currentCount;

    const newCount = Math.max(0, currentCount - 1);
    const updatedForm = { ...settingsForm, [field]: newCount, table_prefix: prefix };
    setSettingsForm(updatedForm);
    setRestaurantInfo(prev => prev ? ({ ...prev, [field]: newCount, table_prefix: prefix }) : prev);
    setTableNumber(String(Math.max(1, Math.min(Number(tableNumber || 1), newCount))));
    showToast(`🗑️ ${spaceInfo.singular} ${targetNum} removed. Total: ${newCount}`, 2000);

    const currentSlug = propSlug || localStorage.getItem('touchqr_admin_slug') || (restaurantInfo && restaurantInfo.slug) || '';
    if (currentSlug) {
      localStorage.setItem(`touchqr_table_prefix_${currentSlug}`, prefix);
      const cached = localStorage.getItem(`admin_cache_${currentSlug}_info`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          parsed[field] = newCount;
          parsed.table_prefix = prefix;
          localStorage.setItem(`admin_cache_${currentSlug}_info`, JSON.stringify(parsed));
        } catch {}
      }
    }

    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedForm)
      });
    } catch (err) {
      console.error('Failed to delete space unit:', err);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent && dishes.length === 0) {
      setLoading(true);
    }
    try {
      const currentSlug = propSlug || localStorage.getItem('touchqr_admin_slug') || (restaurantInfo && restaurantInfo.slug) || '';
      let [catData, dishData, infoData, comboData, subStatusData, analyticsResp] = await Promise.all([
        fetchCategories({ adminView: true, token, slug: currentSlug }).catch(() => []),
        fetchDishes({ adminView: true, token, slug: currentSlug }).catch(() => []),
        fetchRestaurantInfo({ token, slug: currentSlug }).catch((err) => { console.warn('[MENU] fetchRestaurantInfo notice:', err); return null; }),
        fetchAdminCombos(token).catch(() => []),
        fetch('/api/admin/subscription-status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetchAdminAnalytics(token, 'all').catch(() => null)
      ]);

      const safeCats = Array.isArray(catData) ? catData : [];
      const safeDishes = Array.isArray(dishData) ? dishData : [];
      const safeCombos = Array.isArray(comboData) ? comboData : [];

      console.log('[MENU] requested slug:', currentSlug || '(authenticated tenant)');
      console.log('[MENU] resolved restaurant id:', infoData ? infoData.id : 'none');
      console.log('[MENU] API dishes count:', safeDishes.length);
      console.log('[MENU] API categories count:', safeCats.length);
      console.log('[MENU] final dishes count:', safeDishes.length);

      setCategories(safeCats);
      setDishes(safeDishes);
      if (infoData) {
        setRestaurantInfo(infoData);
      }
      setCombos(safeCombos);

      if (currentSlug) {
        if (safeCats.length > 0) localStorage.setItem(`admin_cache_${currentSlug}_categories`, JSON.stringify(safeCats));
        if (safeDishes.length > 0) localStorage.setItem(`admin_cache_${currentSlug}_dishes`, JSON.stringify(safeDishes));
        if (infoData) localStorage.setItem(`admin_cache_${currentSlug}_info`, JSON.stringify(infoData));
        if (safeCombos.length > 0) localStorage.setItem(`admin_cache_${currentSlug}_combos`, JSON.stringify(safeCombos));
      }

      if (subStatusData) setSubscriptionStatus(subStatusData);
      if (analyticsResp) setAnalyticsData(analyticsResp);
      if (infoData) {
        const defaultVis = { must_try: true, combo: true, special: true, under100: true };
        setSettingsForm({
          id: infoData.id,
          name: infoData.name || '',
          slug: infoData.slug || '',
          logo: infoData.logo || '',
          phone: infoData.phone || '',
          address: infoData.address || '',
          openingHours: infoData.openingHours || '',
          google_review_url: infoData.google_review_url || '',
          google_maps_url: infoData.google_maps_url || '',
          currency_symbol: (infoData.currency_symbol !== null && infoData.currency_symbol !== undefined) ? infoData.currency_symbol : '₹',
          fssai_lic_no: infoData.fssai_lic_no || '',
          resto_type: infoData.resto_type || 'pure_veg',
          business_type: infoData.business_type !== undefined ? infoData.business_type : null,
          food_type: infoData.food_type !== undefined ? infoData.food_type : null,
          service_model: infoData.service_model || 'dine_in',
          latitude: infoData.latitude !== undefined && infoData.latitude !== null ? infoData.latitude : 26.6500,
          longitude: infoData.longitude !== undefined && infoData.longitude !== null ? infoData.longitude : 84.9167,
          max_distance_meters: infoData.max_distance_meters || 100,
          gst_enabled: infoData.gst_enabled !== undefined ? infoData.gst_enabled : false,
          gstin_number: infoData.gstin_number || '',
          total_tables: infoData.total_tables !== undefined && infoData.total_tables !== null ? Number(infoData.total_tables) : 0,
          total_cabins: infoData.total_cabins !== undefined && infoData.total_cabins !== null ? Number(infoData.total_cabins) : 0,
          total_rooms: infoData.total_rooms !== undefined && infoData.total_rooms !== null ? Number(infoData.total_rooms) : 0,
          total_vip: infoData.total_vip !== undefined && infoData.total_vip !== null ? Number(infoData.total_vip) : 0,
          table_prefix: (currentSlug && localStorage.getItem(`touchqr_table_prefix_${currentSlug}`)) || infoData.table_prefix || 'table',
          order_retention_days: infoData.order_retention_days || 7,
          custom_domain: infoData.custom_domain || '',
          watermark_removal_enabled: infoData.watermark_removal_enabled === 1 || infoData.watermark_removal_enabled === true || infoData.watermark_removal_enabled === '1',
          custom_domain_enabled: infoData.custom_domain_enabled === 1 || infoData.custom_domain_enabled === true || infoData.custom_domain_enabled === '1',
          analytics_export_enabled: infoData.analytics_export_enabled === 1 || infoData.analytics_export_enabled === true || infoData.analytics_export_enabled === '1',
          gst_invoice_enabled: infoData.gst_invoice_enabled === 1 || infoData.gst_invoice_enabled === true || infoData.gst_invoice_enabled === '1',
          ai_review_enabled: infoData.ai_review_enabled === 1 || infoData.ai_review_enabled === true || infoData.ai_review_enabled === '1',
          bluetooth_kot_enabled: infoData.bluetooth_kot_enabled === 1 || infoData.bluetooth_kot_enabled === true || infoData.bluetooth_kot_enabled === '1',
          kds_enabled: (infoData.kds_enabled ?? infoData.permissions?.kds_enabled) === 1 || (infoData.kds_enabled ?? infoData.permissions?.kds_enabled) === true || (infoData.kds_enabled ?? infoData.permissions?.kds_enabled) === '1',
          kds_screen_enabled: infoData.kds_screen_enabled !== undefined ? infoData.kds_screen_enabled : 1,
          dual_printer_enabled: (infoData.dual_printer_enabled ?? infoData.permissions?.dual_printer_enabled) === 1 || (infoData.dual_printer_enabled ?? infoData.permissions?.dual_printer_enabled) === true || (infoData.dual_printer_enabled ?? infoData.permissions?.dual_printer_enabled) === '1',
          theme_color: infoData.theme_color || 'gold',
          filters_visibility: { ...defaultVis, ...infoData.filters_visibility }
        });
      }
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync active luxury brand theme with document attribute
  useEffect(() => {
    const currentTheme = settingsForm?.theme_color || restaurantInfo?.theme_color || 'gold';
    if (currentTheme) {
      document.documentElement.setAttribute('data-theme', currentTheme);
    }
  }, [settingsForm?.theme_color, restaurantInfo?.theme_color]);

  useEffect(() => {
    if (!token) {
      if (onLogout) onLogout();
      return;
    }
    loadData();
    fetchAnnouncements().then(data => {
      if (Array.isArray(data)) setAnnouncements(data);
    }).catch(() => {});
  }, [token]);

  const handleToggleDish = async (id, nextAvailable) => {
    try {
      const dish = dishes.find(d => String(d.id) === String(id));
      const currentAvail = dish ? (dish.available !== false && dish.available !== 0 && dish.is_available !== false) : true;
      const isNext = typeof nextAvailable === 'boolean' ? nextAvailable : !currentAvail;
      
      // Optimistic state update
      setDishes(prev => prev.map(d => String(d.id) === String(id) ? { ...d, available: isNext, is_available: isNext } : d));
      
      await toggleDishAvailability(id, isNext, token);
    } catch (err) {
      console.error('Failed to update dish availability:', err);
      alert('Failed to update dish availability: ' + (err.message || ''));
      loadData(true);
    }
  };

  const handleToggleBadge = async (dish, targetBadge) => {
    const isTarget = (dish.badge || '').toLowerCase().includes(targetBadge.toLowerCase()) || 
                     (targetBadge.toLowerCase().includes('must try') && Boolean(dish.must_try));
    const newBadge = isTarget ? '' : targetBadge;
    const newMustTry = targetBadge.toLowerCase().includes('must try') ? (!isTarget ? 1 : 0) : (dish.must_try ? 1 : 0);
    
    try {
      // Optimistic state update
      setDishes(prev => prev.map(d => String(d.id) === String(dish.id) ? { ...d, badge: newBadge, must_try: newMustTry } : d));
      
      const res = await fetch(`/api/admin/dishes/${dish.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...dish,
          badge: newBadge,
          must_try: newMustTry
        })
      });
      if (!res.ok) throw new Error('Failed to update badge');
    } catch (err) {
      console.error('Badge toggle error:', err);
      alert(`Failed to update ${targetBadge} badge`);
      loadData(true);
    }
  };

  const handleDeleteDish = async (id) => {
    try {
      await deleteDish(id, token);
      setDishes(prev => prev.filter(d => String(d.id) !== String(id)));
    } catch (err) {
      alert('Failed to delete dish');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(id, token);
      loadData();
    } catch (err) {
      alert('Failed to delete category: ' + (err.message || ''));
    }
  };

  const isCatActive = (activeVal) => {
    return activeVal === true || activeVal === 1 || activeVal === '1' || activeVal === 'true' || activeVal === undefined;
  };

  const handleToggleCategory = async (catId, nextActive) => {
    try {
      const cat = categories.find(c => String(c.id) === String(catId));
      const currentActive = cat ? isCatActive(cat.active) : true;
      const isNext = typeof nextActive === 'boolean' ? nextActive : !currentActive;
      
      // Optimistic update
      setCategories(prev => prev.map(c => String(c.id) === String(catId) ? { ...c, active: isNext, is_active: isNext } : c));
      
      await toggleCategoryActive(catId, isNext, token);
    } catch (err) {
      alert(err.message || 'Failed to update category status');
      loadData(true);
    }
  };

  const handleReorderCategories = async (newOrderedCategories) => {
    try {
      // Optimistic update
      setCategories(newOrderedCategories);
      
      const payload = newOrderedCategories.map((cat, index) => ({
        id: cat.id,
        sort_order: index
      }));
      
      await reorderCategories(payload, token);
    } catch (err) {
      console.error('Failed to reorder categories:', err);
      alert('Failed to save category order: ' + (err.message || ''));
      loadData(true);
    }
  };

  const handleDeleteCombo = async (id) => {
    try {
      await deleteCombo(id, token);
      setCombos(prev => prev.filter(c => String(c.id) !== String(id)));
    } catch (err) {
      alert('Failed to delete combo: ' + (err.message || ''));
    }
  };

  const handleToggleComboAvailability = async (id, nextAvailable) => {
    try {
      const combo = combos.find(c => String(c.id) === String(id));
      const currentAvail = combo ? (combo.available !== false && combo.available !== 0 && combo.is_available !== false) : true;
      const isNext = typeof nextAvailable === 'boolean' ? nextAvailable : !currentAvail;
      
      // Optimistic update
      setCombos(prev => prev.map(c => String(c.id) === String(id) ? { ...c, available: isNext ? 1 : 0, is_available: isNext } : c));
      
      await toggleComboAvailability(id, isNext, token);
    } catch (err) {
      alert('Failed to update combo availability: ' + (err.message || ''));
      loadData(true);
    }
  };

  const ensureTableCreated = async (numStr) => {
    const num = parseInt(numStr, 10);
    if (isNaN(num) || num <= 0) return;
    const currentCount = (settingsForm.total_tables !== undefined && settingsForm.total_tables !== null) ? Number(settingsForm.total_tables) : 0;
    if (num > currentCount) {
      const updatedForm = { ...settingsForm, total_tables: num };
      setSettingsForm(updatedForm);
      setToastMessage(`✨ Table ${num} automatically created!`);

      try {
        await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedForm)
        });
        loadData();
      } catch (err) {
        console.error('Failed to auto-create table:', err);
      }
    }
  };

  const handleUpdateSpaceType = async (newType) => {
    const currentSlug = propSlug || localStorage.getItem('touchqr_admin_slug') || (restaurantInfo && restaurantInfo.slug) || '';
    if (currentSlug) {
      localStorage.setItem(`touchqr_table_prefix_${currentSlug}`, newType);
      const cached = localStorage.getItem(`admin_cache_${currentSlug}_info`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          parsed.table_prefix = newType;
          localStorage.setItem(`admin_cache_${currentSlug}_info`, JSON.stringify(parsed));
        } catch {}
      }
    }

    const updatedForm = { ...settingsForm, table_prefix: newType };
    setSettingsForm(updatedForm);
    setRestaurantInfo(prev => prev ? ({ ...prev, table_prefix: newType }) : prev);
    const spaceInfo = getSpaceConfig(newType);
    showToast(`✅ Switched to ${spaceInfo.singular}!`, 2000);

    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedForm)
      });
    } catch (err) {
      console.error('Failed to update space type:', err);
    }
  };

  const handlePrintQR = (overrideNum, targetPrefix = null) => {
    const activeTableNum = overrideNum || tableNumber || '1';
    const prefix = targetPrefix || settingsForm.table_prefix || restaurantInfo?.table_prefix || 'table';
    const isCinema = prefix === 'cinema_seat' || prefix === 'cinema';

    if (!isCinema && prefix === 'table') {
      ensureTableCreated(activeTableNum);
    }

    const spaceConfig = getSpaceConfig(prefix);
    const paramName = isCinema ? 'cinema' : (prefix === 'cabin' ? 'cabin' : prefix === 'room' ? 'room' : prefix === 'vip' ? 'vip' : 'table');
    const liveOrigin = window.location.origin;
    const activeSlug = settingsForm.slug || restaurantInfo?.slug || '';
    const secretKey = settingsForm.qr_secret || restaurantInfo?.qr_secret || `${restaurantInfo?.id || 1}_${activeSlug}_tq`;
    const qrSig = generateQrToken(activeSlug, isCinema ? 'cinema_seat' : paramName, activeTableNum, secretKey);
    const targetUrl = isCinema
      ? `${liveOrigin}/${activeSlug}?cinema=${encodeURIComponent(activeTableNum)}&tkn=${qrSig}`
      : `${liveOrigin}/${activeSlug}?${paramName}=${activeTableNum}&tkn=${qrSig}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
    const currentName = settingsForm.name || 'Digital Menu';
    const currentTagline = settingsForm.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu');

    let badgeText = `${spaceConfig.badge} ${activeTableNum}`;
    if (isCinema) {
      const match = String(activeTableNum).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i);
      if (match) {
        badgeText = `🎬 SCREEN ${match[1]} • ROW ${match[2].toUpperCase()} • SEAT ${match[3]}`;
      } else {
        badgeText = `🎬 CINEMA SEAT ${activeTableNum}`;
      }
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Please allow popups for this site to print the QR Standee.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${currentName} - ${spaceConfig.singular} ${activeTableNum} QR Standee</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
            body {
              margin: 0;
              padding: 40px 20px;
              background-color: #F8FAFC;
              font-family: 'Plus Jakarta Sans', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .standee-card {
              width: 380px;
              background: #FFFFFF;
              border-radius: 24px;
              border: 3px solid #D4AF37;
              box-shadow: 0 20px 40px rgba(10,35,21,0.15);
              padding: 32px 24px;
              text-align: center;
              box-sizing: border-box;
              position: relative;
            }
            .table-badge {
              display: inline-block;
              background: #0A2315;
              color: #DFBA67;
              font-size: 0.85rem;
              font-weight: 800;
              padding: 6px 18px;
              border-radius: 20px;
              letter-spacing: 1px;
              margin-bottom: 16px;
            }
            .logo-title {
              font-family: 'Playfair Display', serif;
              font-size: 1.6rem;
              font-weight: 900;
              color: #0A2315;
              margin: 0 0 6px 0;
            }
            .subtitle {
              font-size: 0.78rem;
              font-weight: 700;
              color: #16A34A;
              margin-bottom: 20px;
            }
            .qr-box {
              background: #FFFFFF;
              padding: 16px;
              border-radius: 18px;
              border: 1px solid #E2E8F0;
              display: inline-block;
              margin-bottom: 20px;
            }
            .qr-box img {
              width: 220px;
              height: 220px;
              display: block;
            }
            .instruction-en {
              font-size: 0.95rem;
              font-weight: 800;
              color: #0A2315;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .instruction-hi {
              font-size: 0.85rem;
              font-weight: 600;
              color: #64748B;
              margin-bottom: 16px;
            }
            .footer-info {
              font-size: 0.72rem;
              color: #94A3B8;
              border-top: 1px solid #F1F5F9;
              padding-top: 12px;
            }
            @media print {
              body { padding: 0; background: none; }
              .standee-card { box-shadow: none; border-color: #000; }
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="table-badge">${badgeText}</div>
            <h1 class="logo-title">${currentName}</h1>
            <div class="subtitle">${currentTagline}</div>
            <div class="qr-box">
              <img src="${qrImgUrl}" alt="${spaceConfig.singular} ${activeTableNum} QR Code" />
            </div>
            <div class="instruction-en">${isCinema ? '📱 SCAN FOR IN-SEAT FOOD ORDERING' : '📱 SCAN FOR DIGITAL MENU & ORDER'}</div>
            <div class="instruction-hi">${isCinema ? 'स्कैन करें और सीट पर खाना मंगाएं' : 'स्कैन करें और डिजिटल मेन्यू देखें'}</div>
            <div class="footer-info">
              ${settingsForm.address || ''}${settingsForm.phone ? ' • Phone: ' + settingsForm.phone : ''}
              ${!settingsForm.watermark_removal_enabled ? '<div style="margin-top: 4px; font-size: 0.65rem; color: #15803D; font-weight: 800;">⚡ Powered by TouchQR</div>' : ''}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintAllQRs = (targetPrefix = null, cinemaSeatsList = null) => {
    const prefix = targetPrefix || settingsForm.table_prefix || restaurantInfo?.table_prefix || 'table';
    const isCinema = prefix === 'cinema_seat' || prefix === 'cinema';

    const liveOrigin = window.location.origin;
    const currentName = settingsForm.name || 'Digital Menu';
    const currentTagline = settingsForm.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu');
    const activeSlug = settingsForm.slug || restaurantInfo?.slug || '';
    const secretKey = settingsForm.qr_secret || restaurantInfo?.qr_secret || `${restaurantInfo?.id || 1}_${activeSlug}_tq`;

    if (isCinema) {
      const activeSeats = Array.isArray(cinemaSeatsList) ? cinemaSeatsList.filter(s => s.active !== false) : [];
      if (activeSeats.length === 0) {
        alert('No configured active cinema seats found to print! Please configure cinema seats first.');
        return;
      }

      const printWindow = window.open('', '_blank', 'width=950,height=900');
      if (!printWindow) {
        alert('Please allow popups for this site to print all Cinema Seats QR Standees.');
        return;
      }

      let cardsHtml = '';
      for (const seat of activeSeats) {
        const sNum = seat.screen_number || '1';
        const rLabel = seat.row_label || 'A';
        const stNum = seat.seat_number || '1';
        const seatCode = `S${sNum}-${rLabel}-${stNum}`;
        const qrSig = generateQrToken(activeSlug, 'cinema_seat', seatCode, secretKey);
        const targetUrl = `${liveOrigin}/${activeSlug}?cinema=${encodeURIComponent(seatCode)}&tkn=${qrSig}`;
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

        cardsHtml += `
          <div class="standee-card">
            <div class="table-badge">🎬 SCREEN ${sNum} • ROW ${rLabel} • SEAT ${stNum}</div>
            <h2 class="logo-title">${currentName}</h2>
            <div class="subtitle">${currentTagline}</div>
            <div class="qr-box">
              <img src="${qrImgUrl}" alt="Cinema Seat ${seatCode} QR Code" />
            </div>
            <div class="instruction-en">📱 SCAN FOR IN-SEAT FOOD ORDERING</div>
            <div class="instruction-hi">स्कैन करें और सीट पर खाना मंगाएं</div>
            <div class="footer-info">
              ${settingsForm.address || ''}${settingsForm.phone ? ' • Phone: ' + settingsForm.phone : ''}
              ${!settingsForm.watermark_removal_enabled ? '<div style="margin-top: 4px; font-size: 0.65rem; color: #15803D; font-weight: 800;">⚡ Powered by TouchQR</div>' : ''}
            </div>
          </div>
        `;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>All Cinema Seats QR Standees - ${currentName}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
              body {
                margin: 0;
                padding: 30px;
                background-color: #FFFFFF;
                font-family: 'Plus Jakarta Sans', sans-serif;
                display: flex;
                flex-wrap: wrap;
                gap: 24px;
                justify-content: center;
              }
              .standee-card {
                width: 320px;
                padding: 28px 20px;
                border: 3px double #C5A059;
                border-radius: 20px;
                background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%);
                text-align: center;
                box-shadow: 0 6px 20px rgba(10, 35, 21, 0.08);
                page-break-inside: avoid;
                margin-bottom: 20px;
              }
              .table-badge {
                display: inline-block;
                background: #0A2315;
                color: #DFBA67;
                padding: 5px 18px;
                border-radius: 9999px;
                font-size: 0.85rem;
                font-weight: 800;
                border: 1px solid #DFBA67;
                letter-spacing: 0.5px;
                margin-bottom: 12px;
              }
              .logo-title {
                font-family: 'Playfair Display', serif;
                font-size: 1.35rem;
                font-weight: 900;
                color: #0A2315;
                margin: 0 0 4px 0;
              }
              .subtitle {
                font-size: 0.76rem;
                font-weight: 700;
                color: #15803D;
                margin-bottom: 16px;
              }
              .qr-box {
                background: #FFFFFF;
                padding: 14px;
                border-radius: 16px;
                border: 1px solid #E5E7EB;
                display: inline-block;
                margin-bottom: 14px;
              }
              .qr-box img {
                width: 170px;
                height: 170px;
                display: block;
              }
              .instruction-en {
                font-size: 0.85rem;
                font-weight: 800;
                color: #0A2315;
                margin-bottom: 2px;
              }
              .instruction-hi {
                font-size: 0.78rem;
                color: #64748B;
                font-weight: 600;
                margin-bottom: 10px;
              }
              .footer-info {
                font-size: 0.68rem;
                color: #64748B;
                border-top: 1px solid #E2E8F0;
                padding-top: 8px;
                margin-top: 4px;
              }
              @media print {
                body { padding: 0; background: none; }
                .standee-card { box-shadow: none; margin-bottom: 0; }
              }
            </style>
          </head>
          <body>
            ${cardsHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    const field = getSpaceField(prefix);
    const spaceConfig = getSpaceConfig(prefix);
    const paramName = prefix === 'cabin' ? 'cabin' : prefix === 'room' ? 'room' : prefix === 'vip' ? 'vip' : 'table';
    const totalCount = Number(settingsForm[field]) || 0;
    if (totalCount === 0) {
      alert(`No ${spaceConfig.plural.toLowerCase()} added yet! Click "+ Add ${spaceConfig.singular}" to create QR standees.`);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=900');
    if (!printWindow) {
      alert(`Please allow popups for this site to print all ${spaceConfig.plural} QR Standees.`);
      return;
    }

    let cardsHtml = '';
    for (let tNum = 1; tNum <= totalCount; tNum++) {
      const qrSig = generateQrToken(activeSlug, paramName, tNum, secretKey);
      const targetUrl = `${liveOrigin}/${activeSlug}?${paramName}=${tNum}&tkn=${qrSig}`;
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
      cardsHtml += `
        <div class="standee-card">
          <div class="table-badge">${spaceConfig.badge} ${tNum}</div>
          <h2 class="logo-title">${currentName}</h2>
          <div class="subtitle">${currentTagline}</div>
          <div class="qr-box">
            <img src="${qrImgUrl}" alt="${spaceConfig.singular} ${tNum} QR Code" />
          </div>
          <div class="instruction-en">📱 SCAN FOR DIGITAL MENU & ORDER</div>
          <div class="instruction-hi">स्कैन करें और डिजिटल मेन्यू देखें</div>
          <div class="footer-info">
            ${settingsForm.address || ''}${settingsForm.phone ? ' • Phone: ' + settingsForm.phone : ''}
            ${!settingsForm.watermark_removal_enabled ? '<div style="margin-top: 4px; font-size: 0.65rem; color: #15803D; font-weight: 800;">⚡ Powered by TouchQR</div>' : ''}
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>All ${spaceConfig.plural} QR Standees - ${currentName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
            body {
              margin: 0;
              padding: 30px;
              background-color: #FFFFFF;
              font-family: 'Plus Jakarta Sans', sans-serif;
              display: flex;
              flex-wrap: wrap;
              gap: 24px;
              justify-content: center;
            }
            .standee-card {
              width: 320px;
              padding: 28px 20px;
              border: 3px double #C5A059;
              border-radius: 20px;
              background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%);
              text-align: center;
              box-shadow: 0 6px 20px rgba(10, 35, 21, 0.08);
              page-break-inside: avoid;
              margin-bottom: 20px;
            }
            .table-badge {
              display: inline-block;
              background: #0A2315;
              color: #DFBA67;
              padding: 5px 18px;
              border-radius: 9999px;
              font-size: 0.95rem;
              font-weight: 800;
              border: 1.5px solid #C5A059;
              letter-spacing: 1px;
              margin-bottom: 12px;
            }
            .logo-title {
              font-family: 'Playfair Display', serif;
              font-size: 1.25rem;
              font-weight: 900;
              color: #0A2315;
              margin: 0 0 4px 0;
            }
            .subtitle {
              font-size: 0.75rem;
              font-weight: 800;
              color: #15803D;
              margin-bottom: 14px;
            }
            .qr-box {
              background: #FFFFFF;
              padding: 12px;
              border-radius: 14px;
              border: 1px solid #E5E7EB;
              display: inline-block;
              margin-bottom: 12px;
            }
            .qr-box img {
              width: 180px;
              height: 180px;
              display: block;
            }
            .instruction-en { font-size: 0.82rem; font-weight: 800; color: #0A2315; margin-bottom: 2px; }
            .instruction-hi { font-size: 0.78rem; font-weight: 700; color: #666157; margin-bottom: 12px; }
            .footer-info { font-size: 0.7rem; font-weight: 700; color: #B88E3E; border-top: 1px dashed rgba(197, 160, 89, 0.4); padding-top: 10px; }
            @media print {
              body { padding: 0; background: none; }
              .standee-card { box-shadow: none; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveDish = async (dishData) => {
    const isEdit = Boolean(dishModalData?.id);
    const url = isEdit ? `/api/admin/dishes/${dishModalData.id}` : '/api/admin/dishes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dishData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save dish');
    }

    setDishModalData(null);
    loadData();
  };

  const handleSaveCategory = async (catData) => {
    const isEdit = Boolean(catModalData?.id);
    const url = isEdit ? `/api/admin/categories/${catModalData.id}` : '/api/admin/categories';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(catData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save category');
    }

    setCatModalData(null);
    loadData();
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to update restaurant settings');
      }

      setSettingsSavedMsg(true);
      if (settingsForm.theme_color) {
        document.documentElement.setAttribute('data-theme', settingsForm.theme_color);
      }
      await loadData();
      setTimeout(() => setSettingsSavedMsg(false), 3000);
      return { success: true };
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  const handleChangeCredentials = async () => {
    setCredMsg({ text: '', type: '' });

    if (!credForm.currentPassword) {
      setCredMsg({ text: 'Current password is required', type: 'error' });
      return;
    }
    if (!credForm.newUsername && !credForm.newPassword) {
      setCredMsg({ text: 'Enter a new username or new password', type: 'error' });
      return;
    }
    if (credForm.newPassword && credForm.newPassword !== credForm.confirmPassword) {
      setCredMsg({ text: 'New passwords do not match', type: 'error' });
      return;
    }
    if (credForm.newPassword && credForm.newPassword.length < 4) {
      setCredMsg({ text: 'Password must be at least 4 characters', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: credForm.currentPassword,
          newUsername: credForm.newUsername || undefined,
          newPassword: credForm.newPassword || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setCredMsg({ text: data.error || 'Failed to update', type: 'error' });
        return;
      }

      // Update token in localStorage if returned
      if (data.token) {
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_username', data.username);
      }

      setCredMsg({ text: '✅ Credentials updated! Use new login next time.', type: 'success' });
      setCredForm({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setCredMsg({ text: 'Network error, please try again', type: 'error' });
    }
  };
  const handleQuickPriceSave = async (dishId, newPrice, newPriceHalf) => {
    try {
      const pFull = Number(newPrice !== undefined ? newPrice : quickPriceVal.price);
      const rawHalf = newPriceHalf !== undefined ? newPriceHalf : quickPriceVal.price_half;
      const pHalf = (rawHalf !== undefined && rawHalf !== null && rawHalf !== '') ? Number(rawHalf) : null;
      await updateDishPrice(dishId, pFull, pHalf, token);
      setDishes(dishes.map(d => d.id === dishId ? { ...d, price: pFull, price_half: pHalf } : d));
      setEditingPriceId(null);
    } catch (err) {
      alert('Failed to update price: ' + (err.message || ''));
    }
  };

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const filteredDishes = safeDishes.filter(d => {
    if (!d) return false;
    const nameStr = (d.name || '').toLowerCase();
    const searchStr = (search || '').toLowerCase();
    const matchesSearch = nameStr.includes(searchStr) || 
      (d.name_hi && String(d.name_hi).toLowerCase().includes(searchStr));
    const matchesCategory = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
    return matchesSearch && matchesCategory;
  });

  // Compute Live Table Grid (1 to total_tables)
  const totalTablesCount = Number(settingsForm.total_tables) || 0;
  const tableGrid = [];

  for (let tNum = 1; tNum <= totalTablesCount; tNum++) {
    const activeOrder = orders.find(o => String(o.table_number) === String(tNum) && o.status !== 'completed' && o.status !== 'cancelled');
    const serviceRequest = serviceRequests.find(sr => String(sr.table_number) === String(tNum));

    let status = 'available';
    if (serviceRequest) {
      status = 'service_needed';
    } else if (activeOrder) {
      status = 'occupied';
    }

    tableGrid.push({
      tableNumber: tNum,
      status,
      activeOrder,
      serviceRequest
    });
  }

  const availableTablesCount = tableGrid.filter(t => t.status === 'available').length;
  const occupiedTablesCount = tableGrid.filter(t => t.status === 'occupied').length;
  const serviceNeededCount = tableGrid.filter(t => t.status === 'service_needed').length;

  const tenantCaps = resolveTenantCapabilities(restaurantInfo, settingsForm);
  const isAnalyticsEnabled = true;
  const isDirectOrderingEnabled = tenantCaps.direct_ordering_enabled;

  return (
    <div className="adm-app-shell-root" style={{ minHeight: '100vh', background: '#F8FAFC', margin: 0, padding: 0 }}>
      <style>{`
        @media (max-width: 900px) {
          .adm-app-shell-root { padding-bottom: 70px !important; }
          .adm-desktop-sidebar { display: none !important; }
          .admin-desktop-nav { display: none !important; }
          .admin-mobile-nav { display: flex !important; }
        }
        @media (min-width: 901px) {
          .adm-app-shell-root { padding-bottom: 0 !important; }
          .adm-desktop-sidebar { display: block !important; }
          .admin-desktop-nav { display: none !important; }
          .admin-mobile-nav { display: none !important; }
        }
      `}</style>


      {/* 📢 Global System Announcement Banner */}
      {announcements.length > 0 && !dismissedNotice && (
        <div style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          color: '#E0E7FF',
          padding: '10px 16px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderBottom: '1px solid #6366F1'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={16} color="#FBBF24" />
            <span><strong>Platform Notice:</strong> {announcements[0].message}</span>
          </div>
          <button
            onClick={() => setDismissedNotice(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '50%',
              transition: 'all 0.2s ease'
            }}
            title="Dismiss Notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 🔔 1. First-Time Full Width Sound Onboarding Banner */}
      {!isAudioReady && !hasSoundSetupCompleted && !audioBannerDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          padding: '10px 16px',
          borderBottom: '2px solid #F59E0B',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '240px' }}>
            <span style={{ fontSize: '1.4rem' }}>🔔</span>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#FBBF24', display: 'block' }}>
                Enable Alert Sounds
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 600 }}>
                Enable sound alerts for orders, kitchen and waiter notifications.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleEnableSound}
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: '#FFFFFF',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '9999px',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔔 Enable
            </button>
            <button
              onClick={() => setAudioBannerDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '4px 8px'
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 🔔 2. Compact Post-Refresh Status Strip (Non-blocking below header) */}
      {!isAudioReady && hasSoundSetupCompleted && !audioBannerDismissed && (
        <div style={{
          background: '#FFFBEB',
          borderBottom: '1px solid #FDE68A',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.78rem',
          color: '#92400E',
          fontWeight: 600,
          boxSizing: 'border-box'
        }}>
          <span>🔔 Order sound off</span>
          <button
            onClick={handleEnableSound}
            style={{
              background: '#D97706',
              border: 'none',
              color: '#FFFFFF',
              padding: '3px 10px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            Enable Sound
          </button>
          <button
            onClick={() => setAudioBannerDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#B45309',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '0 2px'
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ⏳ Trial Expiry Warning Banner (3 Days Remaining) */}
      {daysLeft !== null && daysLeft <= 3 && daysLeft > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
          borderBottom: '2px solid #F59E0B',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          color: '#78350F'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              Your 14-Day Free Pro Trial expires in <strong style={{ color: '#B45309', fontSize: '0.88rem' }}>{daysLeft} day{daysLeft > 1 ? 's' : ''}</strong>! Renew now to prevent menu interruption.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowPaymentModal(true)}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF', padding: '6px 14px', borderRadius: '10px',
                border: 'none', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.4)', whiteSpace: 'nowrap'
              }}
            >
              💳 Pay & Renew Instant
            </button>
            <a
              href={`https://wa.me/${(masterSupportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Super Admin, I want to renew/upgrade my restaurant subscription plan for '${restaurantInfo?.name || 'my restaurant'}'.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#B45309', color: '#FFFFFF', padding: '6px 14px', borderRadius: '10px',
                textDecoration: 'none', fontWeight: 900, fontSize: '0.78rem', boxShadow: '0 2px 8px rgba(180,83,9,0.3)', whiteSpace: 'nowrap'
              }}
            >
              💬 WhatsApp Support
            </a>
          </div>
        </div>
      )}

      {/* 🔒 SUBSCRIPTION EXPIRED / TRIAL LOCKED OVERLAY */}
      {isExpired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(10, 15, 25, 0.96)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
            padding: '36px 24px', maxWidth: '500px', width: '100%', textAlign: 'center', color: '#FFFFFF',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>🔒</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DFBA67', margin: '0 0 8px 0' }}>
              Subscription Plan Expired!
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              The 14-day free trial or subscription plan for <strong>'{restaurantInfo?.name || 'your restaurant'}'</strong> has ended.
              Renew your plan to reactivate your Digital Menu & QR Orders.
            </p>

            {/* Plan Upgrade Options */}
            <div style={{
              background: 'rgba(223,186,103,0.08)', border: '1px solid rgba(223,186,103,0.25)',
              borderRadius: '16px', padding: '16px', marginBottom: '24px', textAlign: 'left'
            }}>
              <div style={{ color: '#DFBA67', fontWeight: 800, fontSize: '0.85rem', marginBottom: '10px' }}>
                💳 Select Renewal Plan & Contact Super Admin:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                  <span>⚡ <strong>Basic Plan:</strong> Digital Menu & QR</span>
                  <strong style={{ color: '#DFBA67' }}>₹499/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                  <span>👑 <strong>Pro Plan:</strong> WhatsApp + Reviews</span>
                  <strong style={{ color: '#DFBA67' }}>₹999/mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🚀 <strong>Enterprise Plan:</strong> KOT + Table Orders</span>
                  <strong style={{ color: '#DFBA67' }}>₹1,999/mo</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setShowPaymentModal(true)}
                style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF',
                  fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 16px rgba(16,185,129,0.4)'
                }}
              >
                💳 Pay & Reactivate Instant (UPI / Gateway)
              </button>

              <a
                href={`https://wa.me/${(masterSupportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Super Admin, my restaurant subscription for '${restaurantInfo?.name || username}' has expired. Please renew my plan.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #15803D, #22C55E)', color: '#FFFFFF',
                  fontWeight: 800, fontSize: '0.86rem', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                💬 Contact Super Admin on WhatsApp
              </a>

              <button
                onClick={onLogout}
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer'
                }}
              >
                ← Exit / Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Super Admin Impersonation Safety Banner */}
      {isImpersonating && (
        <div
          data-testid="impersonation-safety-banner"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 999999,
            background: 'linear-gradient(90deg, #78350F 0%, #92400E 100%)',
            color: '#FEF3C7',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            borderBottom: '3px solid #F59E0B'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>You are impersonating:</span>
                <span style={{ color: '#FDE68A', textDecoration: 'underline', fontWeight: 900 }}>
                  {impersonatedRestoName || restaurantInfo?.name || 'Restaurant Tenant'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#FCD34D', fontWeight: 600 }}>
                Super Admin access is active for this tenant.
              </div>
            </div>
          </div>
          <button
            onClick={handleExitImpersonation}
            style={{
              background: '#F59E0B',
              color: '#1E293B',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontWeight: 900,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            ↩️ Exit Impersonation
          </button>
        </div>
      )}

      {/* Complete Responsive Dashboard Shell */}
      <div className="adm-dashboard-shell" style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
        {/* Desktop Left Sidebar */}
        <div className="adm-desktop-sidebar">
          <AdminSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            restaurantInfo={restaurantInfo}
            username={username}
            pendingOrdersCount={orders.filter(o => o.status === 'pending' || o.status === 'ordered').length}
            onLogout={onLogout}
            onOpenHelp={() => setActiveTab('support')}
            onReturnToMenu={onReturnToMenu}
            capabilities={tenantCaps}
          />
        </div>

        {/* Right Main Dashboard Area */}
        <div className="adm-dashboard-container" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <AdminHeader
          restaurantInfo={restaurantInfo}
          username={username}
          onLogout={onLogout}
          onReturnToMenu={onReturnToMenu}
          onOpenHelp={() => setActiveTab('support')}
          supportPhone={masterSupportPhone}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingOrdersCount={orders.filter(o => o.status === 'pending' || o.status === 'ordered').length}
          analyticsEnabled={isAnalyticsEnabled}
          ordersEnabled={isDirectOrderingEnabled}
        />

        <main className="adm-main-canvas">
          <div className="adm-content-body">
            {/* HOME VIEW (Business Command Center) */}
            {activeTab === 'home' && (
              <HomeView
                restaurantInfo={restaurantInfo}
                analyticsData={analyticsData}
                orders={orders}
                serviceRequests={serviceRequests}
                dishes={safeDishes}
                categories={safeCategories}
                combos={combos}
                totalTablesCount={totalTablesCount}
                settingsForm={settingsForm}
                isAudioReady={isAudioReady}
                subscriptionStatus={subscriptionStatus}
                capabilities={tenantCaps}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenAddDish={() => setDishModalData('new')}
                onOpenAddCategory={() => setCatModalData('new')}
                onReturnToMenu={onReturnToMenu}
                onNavigateToSetup={(drawer = null) => {
                  setInitialSetupDrawer(drawer);
                  setActiveTab('settings');
                }}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
              />
            )}

            {/* ORDERS VIEW */}
            {['orders', 'floor-map', 'service-requests'].includes(activeTab) && (
              <OrdersView
                orders={orders}
                activeSubTab={activeTab}
                setActiveSubTab={setActiveTab}
                kotFilter={kotFilter}
                setKotFilter={setKotFilter}
                onUpdateStatus={handleUpdateStatus}
                onOpenAcceptRouting={(order) => {
                  const isKdsEnabled = settingsForm.kds_screen_enabled !== 0 && settingsForm.kds_screen_enabled !== false && restaurantInfo?.kds_screen_enabled !== 0 && restaurantInfo?.kds_screen_enabled !== false;
                  if (!isKdsEnabled) {
                    handleUpdateStatus(order.id, 'accepted', { sent_to_kds: 0 });
                  } else {
                    setAcceptRoutingModal(order);
                  }
                }}
                onOpenBillModal={setBillOrderModal}
                onPrintBill={(order) => handlePrintCustomerBill(order, 'CASH')}
                serviceRequests={serviceRequests}
                onResolveServiceRequest={handleResolveServiceRequest}
                onApprovePresenceRequest={handleApprovePresenceRequest}
                onRejectPresenceRequest={handleRejectPresenceRequest}
                restaurantInfo={restaurantInfo}
                onPrintQR={handlePrintQR}
                onDirectPrint={handleDirectBluetoothPrint}
                onPreviewPrint={handlePreviewPrint}
                printingOrderId={printingOrderId}
                printingType={printingType}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
                capabilities={tenantCaps}
                settingsForm={settingsForm}
                token={token}
                onNavigateToSetup={(drawer = null) => {
                  setInitialSetupDrawer(drawer);
                  setActiveTab('settings');
                }}
                ordersEnabled={isDirectOrderingEnabled}
              />
            )}

            {/* ANALYTICS VIEW */}
            {activeTab === 'analytics' && (
              <AnalyticsView
                analyticsData={analyticsData}
                onExportReport={handleExportSalesReport}
                onDownloadAllCSV={handleDownloadAllSalesReport}
                onFilterPeriod={handleFilterAnalytics}
                exporting={exportingReport}
                exportingAll={exportingReport}
                analyticsExportEnabled={tenantCaps.analytics_export_enabled}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
              />
            )}

            {/* MENU VIEW */}
            {['dishes', 'categories', 'combos'].includes(activeTab) && (
              <MenuView
                dishes={safeDishes}
                categories={safeCategories}
                combos={combos}
                activeSubTab={activeTab}
                setActiveSubTab={setActiveTab}
                search={search}
                setSearch={setSearch}
                selectedCatFilter={selectedCatFilter}
                setSelectedCatFilter={setSelectedCatFilter}
                onToggleAvailability={handleToggleDish}
                onOpenAddDish={() => setDishModalData('new')}
                onOpenEditDish={(dish) => setDishModalData(dish)}
                onDeleteDish={handleDeleteDish}
                onUpdateQuickPrice={handleQuickPriceSave}
                onToggleCategoryActive={handleToggleCategory}
                onReorderCategories={handleReorderCategories}
                onDeleteCategory={handleDeleteCategory}
                onOpenAddCategory={() => setCatModalData('new')}
                onOpenEditCategory={(cat) => setCatModalData(cat)}
                onOpenAddCombo={() => setComboModalData('new')}
                onOpenEditCombo={(combo) => setComboModalData(combo)}
                onDeleteCombo={handleDeleteCombo}
                onToggleComboAvailability={handleToggleComboAvailability}
                onToggleBadge={handleToggleBadge}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
                maxDishes={tenantCaps.max_dishes}
                maxCategories={tenantCaps.max_categories}
                maxCombos={tenantCaps.max_combos}
                onUpgrade={() => {
                  setActiveTab('billing');
                }}
              />
            )}

            {/* QR GENERATOR VIEW */}
            {activeTab === 'qr-generator' && (
              <QrGeneratorView
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                totalTablesCount={totalTablesCount}
                onAddTable={(count, prefix) => handleAddTable(count, prefix)}
                onDeleteTable={(num, prefix) => handleDeleteTable(num, prefix)}
                onPrintQR={handlePrintQR}
                onPrintAllQRs={handlePrintAllQRs}
                settingsForm={settingsForm}
                token={token}
                restaurantInfo={restaurantInfo}
                capabilities={tenantCaps}
                onReturnToMenu={onReturnToMenu}
                onBackToSetup={(drawer = null) => {
                  setInitialSetupDrawer(drawer);
                  setActiveTab('settings');
                }}
                onUpgrade={() => {
                  setActiveTab('billing');
                }}
                onUpdateSpaceType={handleUpdateSpaceType}
              />
            )}

            {/* OFFERS & PROMOTIONS VIEW */}
            {activeTab === 'offers' && (
              <OffersView
                restaurantInfo={restaurantInfo}
                settingsForm={settingsForm}
                dishes={dishes}
                combos={combos}
                categories={categories}
                token={token}
                capabilities={tenantCaps}
                onUpgrade={() => {
                  setActiveTab('billing');
                }}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {/* CUSTOMERS & GUEST INSIGHTS VIEW */}
            {activeTab === 'customers' && (
              <CustomersView
                restaurantInfo={restaurantInfo}
                settingsForm={settingsForm}
                orders={orders}
                token={token}
                capabilities={tenantCaps}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
                onUpgrade={() => {
                  setActiveTab('billing');
                }}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {/* BILLING & SUBSCRIPTION VIEW (FULL-PAGE WORKSPACE) */}
            {(activeTab === 'billing' || activeTab === 'subscription') && (
              <BillingView
                restaurantInfo={restaurantInfo}
                settingsForm={settingsForm}
                dishes={safeDishes}
                categories={safeCategories}
                combos={combos}
                totalTablesCount={totalTablesCount}
                token={token}
                capabilities={tenantCaps}
                currencySymbol={settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}
                onUpgrade={(planKey) => {
                  setActiveTab('billing');
                }}
                onNavigate={(tab) => setActiveTab(tab)}
                onRefreshInfo={() => loadData(true)}
              />
            )}

            {/* REVIEWS & FEEDBACK VIEW */}
            {activeTab === 'review' && (
              <ReviewView
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                handleSaveSettings={handleSaveSettings}
                token={token}
                restaurantInfo={restaurantInfo}
                capabilities={tenantCaps}
                onUpgrade={() => {
                  setActiveTab('billing');
                }}
                onBackToSetup={(drawer = null) => {
                  setInitialSetupDrawer(drawer);
                  setActiveTab('settings');
                }}
              />
            )}

            {/* NOTIFICATIONS & ALERTS CENTER VIEW */}
            {activeTab === 'notifications' && (
              <NotificationView
                orders={orders}
                serviceRequests={serviceRequests}
                dishes={safeDishes}
                restaurantInfo={restaurantInfo}
                settingsForm={settingsForm}
                capabilities={tenantCaps}
                token={token}
                onNavigate={(tab, drawer = null) => {
                  if (drawer) setInitialSetupDrawer(drawer);
                  setActiveTab(tab);
                }}
                onBackToDashboard={() => setActiveTab('home')}
                onUpdateOrderStatus={handleUpdateStatus}
                onResolveServiceRequest={handleResolveServiceRequest}
              />
            )}

            {/* HELP & SUPPORT CENTER VIEW */}
            {activeTab === 'support' && (
              <SupportView
                restaurantInfo={restaurantInfo}
                settingsForm={settingsForm}
                capabilities={tenantCaps}
                token={token}
                onNavigate={(tab, drawer = null) => {
                  if (drawer) setInitialSetupDrawer(drawer);
                  setActiveTab(tab);
                }}
                onBackToDashboard={() => setActiveTab('home')}
                onBackToSettings={() => setActiveTab('settings')}
              />
            )}

            {/* SETUP VIEW */}
            {activeTab === 'settings' && (
              <SetupView
                initialDrawer={initialSetupDrawer}
                restaurantInfo={restaurantInfo}
                capabilities={tenantCaps}
                onUpgrade={() => {
                  setActiveTab('billing');
                }}
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                handleSaveSettings={handleSaveSettings}
                credForm={credForm}
                setCredForm={setCredForm}
                handleChangeCredentials={handleChangeCredentials}
                credMsg={credMsg}
                token={token}
                uploadImage={uploadImage}
                setShowPrinterModal={setShowPrinterModal}
                setShowHelpModal={setShowHelpModal}
                onOpenBillingModal={() => setShowPaymentModal(true)}
                onRefreshInfo={loadData}
                supportPhone={masterSupportPhone}
                onOptimizeDatabase={async () => {
                  try {
                    await optimizeDatabase(token, 90);
                    alert('⚡ Database optimized successfully!');
                  } catch (e) {
                    alert('Optimization failed: ' + (e.message || 'Server error'));
                  }
                }}
                onNavigate={(tab) => {
                  setInitialSetupDrawer(null);
                  setActiveTab(tab);
                }}
              />
            )}
          </div>
        </main>

        <AdminBottomNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingOrdersCount={orders.filter(o => o.status === 'pending').length}
          analyticsEnabled={isAnalyticsEnabled}
          ordersEnabled={isDirectOrderingEnabled}
        />
      </div>
      </div>

      {/* Dish & Category Form Modals */}
      {dishModalData && (
        <DishFormModal
          dish={dishModalData === 'new' ? null : dishModalData}
          categories={categories}
          token={token}
          modifiersEnabled={
            subscriptionStatus?.matrix_permissions?.modifiers_enabled !== undefined
              ? Boolean(subscriptionStatus.matrix_permissions.modifiers_enabled)
              : (restaurantInfo?.modifiers_enabled !== undefined ? Boolean(restaurantInfo.modifiers_enabled) : true)
          }
          currencySymbol={restaurantInfo?.currency_symbol || settingsForm?.currency_symbol || '₹'}
          onSave={handleSaveDish}
          onClose={() => setDishModalData(null)}
        />
      )}

      {catModalData && (
        <CategoryFormModal
          category={catModalData === 'new' ? null : catModalData}
          token={token}
          onSave={handleSaveCategory}
          onClose={() => setCatModalData(null)}
        />
      )}

      {comboModalData && (
        <ComboFormModal
          combo={comboModalData === 'new' ? null : comboModalData}
          dishes={dishes}
          token={token}
          onSave={async (data) => {
            if (comboModalData === 'new') {
              await createCombo(data, token);
            } else {
              await updateCombo(comboModalData.id, data, token);
            }
            const updated = await fetchAdminCombos(token).catch(() => []);
            setCombos(Array.isArray(updated) ? updated : []);
            setComboModalData(null);
          }}
          onClose={() => setComboModalData(null)}
        />
      )}

      {/* 🔒 SaaS Plan Combo Limit Exceeded Modal */}
      {comboLimitModalInfo && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10050,
          background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }} onClick={() => setComboLimitModalInfo(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111827', border: '2px solid #F59E0B', borderRadius: '24px',
            padding: '32px 24px', maxWidth: '440px', width: '100%',
            color: '#FFFFFF', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🔒</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#F59E0B', margin: '0 0 8px 0' }}>
              Combo Limit Reached!
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Your <strong style={{ color: '#FFD700' }}>{comboLimitModalInfo.planTier}</strong> plan allows a maximum of <strong style={{ color: '#FFFFFF' }}>{comboLimitModalInfo.maxCombos} combos</strong>. You currently have {comboLimitModalInfo.currentCount} active combos.
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '14px',
              border: '1px solid rgba(255,215,0,0.2)', marginBottom: '20px', textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FFD700', marginBottom: '6px' }}>👑 Upgrade your SaaS Plan to unlock:</div>
              <div style={{ fontSize: '0.78rem', color: '#D1D5DB', lineHeight: 1.5 }}>
                • <strong>Pro Plan:</strong> Up to 10 Combos & Thalis<br/>
                • <strong>Enterprise Plan:</strong> Unlimited Combos & Direct Table Ordering
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setComboLimitModalInfo(null)} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent', color: '#CCCCCC', fontWeight: 700, cursor: 'pointer'
              }}>Close</button>
              <button onClick={() => {
                alert('Please contact SaaS Master Super Admin to upgrade your subscription plan!');
                setComboLimitModalInfo(null);
              }} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #FFD700, #F59E0B)', color: '#0A0A0A',
                fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,0.4)'
              }}>🚀 Upgrade Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* 🍳 Accept Order & Kitchen KDS Routing Modal */}
      {acceptRoutingModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 10025,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.15rem', color: 'var(--adm-primary)' }}>
                🍳 Accept Order & KDS Routing
              </strong>
              <button
                onClick={() => setAcceptRoutingModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--adm-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--adm-surface-subtle)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--adm-border)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--adm-primary)' }}>
                Table {acceptRoutingModal.table_number || 'Takeaway'} • Order {acceptRoutingModal.id}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--adm-muted)', marginTop: '2px' }}>
                Customer: {acceptRoutingModal.customer_name || 'Dine-In Guest'} • Total: {settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'}{acceptRoutingModal.total_amount}
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--adm-text)', margin: 0, fontWeight: 700 }}>
              Where would you like to route this order for preparation?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={async () => {
                  const targetId = acceptRoutingModal.id;
                  setAcceptRoutingModal(null);
                  await handleUpdateStatus(targetId, 'kitchen', { sent_to_kds: 1 });
                }}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                  color: '#38BDF8',
                  border: '1px solid #38BDF8',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>🍳</span>
                <div>
                  <strong style={{ display: 'block', color: '#F8FAFC' }}>Send to Kitchen KDS Screen</strong>
                  <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600 }}>Hot food, freshly cooked dishes for Chef Display</span>
                </div>
              </button>

              <button
                onClick={async () => {
                  const targetId = acceptRoutingModal.id;
                  setAcceptRoutingModal(null);
                  await handleUpdateStatus(targetId, 'kitchen', { sent_to_kds: 0 });
                }}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--adm-surface-subtle)',
                  color: 'var(--adm-primary)',
                  border: '1px solid var(--adm-border)',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>📦</span>
                <div>
                  <strong style={{ display: 'block' }}>Counter / Direct Fulfillment</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--adm-muted)', fontWeight: 600 }}>Ready sweets, bakery, packaged items (Skips Kitchen KDS)</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧾 Select Payment Mode Modal before Printing Bill */}
      {billOrderModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          zIndex: 10020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '380px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0A2315', marginBottom: '4px' }}>
              🧾 Print Final Customer Bill
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#6B7280', display: 'block', marginBottom: '16px' }}>
              Order {billOrderModal.id} • Total: {(restaurantInfo?.currency_symbol !== undefined && restaurantInfo?.currency_symbol !== null ? restaurantInfo.currency_symbol : (settingsForm.currency_symbol !== undefined && settingsForm.currency_symbol !== null ? settingsForm.currency_symbol : '₹'))}{billOrderModal.total_amount}
            </span>

            <p style={{ fontSize: '0.84rem', fontWeight: 800, color: '#374151', marginBottom: '12px' }}>
              Select Payment Method for Receipt:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[
                { id: 'CASH', label: '💵 CASH PAYMENT', bg: '#10B981', color: '#FFFFFF' },
                { id: 'UPI / QR', label: '📱 UPI / GPAY / PAYTM', bg: '#2563EB', color: '#FFFFFF' },
                { id: 'CARD', label: '💳 CREDIT / DEBIT CARD', bg: '#7C3AED', color: '#FFFFFF' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    const orderToPrint = billOrderModal;
                    setBillOrderModal(null);
                    handlePrintCustomerBill(orderToPrint, m.id);
                  }}
                  style={{
                    background: m.bg,
                    color: m.color,
                    border: 'none',
                    padding: '12px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setBillOrderModal(null)}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 📖 Interactive System Help & Video Guide Modal */}
      {showHelpModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
            padding: '24px', maxWidth: '640px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', color: '#FFFFFF', boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowHelpModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.12)', border: 'none',
                color: '#FFFFFF', borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #1F2937', paddingBottom: '14px' }}>
              <span style={{ fontSize: '2rem' }}>📖</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#DFBA67' }}>
                  TouchQR Owner Guide & Help Center
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                  Learn how to manage your digital menu, QR standees, & live orders
                </span>
              </div>
            </div>

            {/* Quick 5 Step System Visual Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Guide 1: Categories & Dishes */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  📁 1. How to Add Categories & Dishes (व्यंजन कैसे जोड़ें)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Click <strong>Menu Tab ➔ Category Manager ➔ "+ Add Category"</strong> (e.g. Starters, Sweets, Beverages).</li>
                  <li>Click <strong>"+ Add New Dish"</strong>: Enter dish name, Full/Half price, upload photo URL, and set veg/non-veg badge.</li>
                  <li>Toggle availability switches anytime to show or hide items live on customer smartphones.</li>
                </ul>
              </div>

              {/* Guide 2: Thali & Combo Deals */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  🍱 2. Thali & Combo Builder (थाली और कॉम्बो कैसे बनाएं)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Go to <strong>Menu Tab ➔ Combo Deals ➔ "+ Add Combo Deal"</strong>.</li>
                  <li>Enter Combo Title (e.g. Executive Thali), set discounted price, and select included dishes (e.g. Paneer + 2 Roti + Rice).</li>
                </ul>
              </div>

              {/* Guide 3: Table QR Generator & Printing */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  🖨️ 3. Table QR Generator & Printing (क्यूआर कोड स्टीकर)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Go to <strong>Setup Tab ➔ QR Generator</strong>.</li>
                  <li>Click <strong>"+ Add New Table"</strong> to add tables (Table 1, Table 2, Table 3...).</li>
                  <li>Click <strong>"🖨️ Print All Table QRs (Uniform)"</strong> to print identical gold-framed standee stickers for all tables in 1-click!</li>
                </ul>
              </div>

              {/* Guide 4: Live Kitchen Orders & Siren */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  🔔 4. Live Kitchen Siren & KOT Management (लाइव ऑर्डर सायरन)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>When a customer scans QR on Table 4 and orders, your phone/laptop will ring a loud Swiggy/Zomato style <strong>Emergency Siren Ringtone 🔊</strong>.</li>
                  <li>Click <strong>"Accept Order" ➔ "Chef Preparing" ➔ "Served to Table" ➔ "Complete & Paid"</strong>.</li>
                  <li>Click <strong>"🖨️ Print Thermal Receipt KOT"</strong> for kitchen printing.</li>
                </ul>
              </div>

              {/* Guide 5: GPS Location & Settings */}
              <div style={{ background: '#1F2937', borderRadius: '16px', padding: '16px', border: '1px solid #374151' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#FFD700', marginBottom: '6px' }}>
                  📍 5. GPS Geo-Fencing & Profile Settings (सुरक्षा और प्रोफाइल)
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#D1D5DB', lineHeight: 1.6 }}>
                  <li>Go to <strong>Setup Tab ➔ Settings</strong> to update Logo, Phone Number, FSSAI License, & Currency.</li>
                  <li>Click <strong>"Enable Location"</strong> to auto-save GPS coordinates so customers outside your restaurant hall cannot place fake orders.</li>
                </ul>
              </div>

            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              style={{
                width: '100%', marginTop: '20px', padding: '13px', borderRadius: '9999px',
                border: 'none', background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                color: '#0A0A0A', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(255,215,0,0.3)'
              }}
            >
              ✅ Got it! Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* 🖨️ Custom Bluetooth Thermal Printer Setup Modal */}
      {showPrinterModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #0EA5E9', borderRadius: '24px',
            padding: '24px', maxWidth: '540px', width: '100%', color: '#FFFFFF',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)', position: 'relative'
          }}>
            <button
              onClick={() => setShowPrinterModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.12)', border: 'none',
                color: '#FFFFFF', borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #1F2937', paddingBottom: '14px' }}>
              <span style={{ fontSize: '2rem' }}>🖨️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#38BDF8' }}>
                  Thermal Printer Setup & Pairing Guide
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                  58mm (2-inch) & 80mm (3-inch) ESC/POS Thermal Printers
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem', color: '#E2E8F0' }}>
              <div style={{ background: '#1F2937', padding: '12px 14px', borderRadius: '12px', border: '1px solid #38BDF8' }}>
                <strong style={{ color: '#38BDF8', display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>💻 Counter Laptop / PC Setup:</strong>
                For zero-dialog instant printing on Windows/macOS/Linux: Launch Chrome with <code>--kiosk-printing</code> flag pointing to your restaurant admin URL.
              </div>

              <div style={{ background: '#1F2937', padding: '12px 14px', borderRadius: '12px', border: '1px solid #DFBA67' }}>
                <strong style={{ color: '#DFBA67', display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>📱 Android Phone / Tablet Setup:</strong>
                Supports native browser print or 1-tap direct RawBT ESC/POS printing (Install <em>RawBT Print Service</em> from Play Store).
              </div>

              <div style={{ background: '#1F2937', padding: '12px 14px', borderRadius: '12px', border: '1px solid #374151' }}>
                <strong style={{ color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>📶 Bluetooth Thermal Pairing:</strong>
                Turn on thermal printer, pair via Bluetooth settings to <code>POS-58</code> or <code>POS-80</code> (PIN: <code>0000</code> or <code>1234</code>).
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
              {(() => {
                const isDual = (settingsForm.printer_mode === 'dual' && (restaurantInfo?.dual_printer_enabled === 1 || restaurantInfo?.permissions?.dual_printer_enabled));
                const sampleKOT = { id: 999, table_number: '1', customer_name: 'Sample Guest', total_amount: 280, items: [{ name: 'Paneer Butter Masala', quantity: 1, price: 220 }, { name: 'Butter Naan', quantity: 2, price: 30 }] };
                const sampleBill = { id: 999, table_number: '1', customer_name: 'Sample Guest', total_amount: 280, items: [{ name: 'Paneer Butter Masala', quantity: 1, price: 220 }, { name: 'Butter Naan', quantity: 2, price: 30 }] };

                return isDual ? (
                  <>
                    <button
                      onClick={() => {
                        setShowPrinterModal(false);
                        handleDirectBluetoothPrint(sampleKOT, 'kot');
                      }}
                      style={{
                        flex: 1, minWidth: '140px', padding: '10px 14px', borderRadius: '9999px', border: 'none',
                        background: '#F59E0B', color: '#000', fontWeight: 900, fontSize: '0.80rem', cursor: 'pointer'
                      }}
                    >
                      🍳 Test Kitchen KOT
                    </button>
                    <button
                      onClick={() => {
                        setShowPrinterModal(false);
                        handleDirectBluetoothPrint(sampleBill, 'bill');
                      }}
                      style={{
                        flex: 1, minWidth: '140px', padding: '10px 14px', borderRadius: '9999px', border: 'none',
                        background: '#0284C7', color: '#FFF', fontWeight: 900, fontSize: '0.80rem', cursor: 'pointer'
                      }}
                    >
                      🧾 Test Counter Bill
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowPrinterModal(false);
                        handleDirectBluetoothPrint(sampleKOT, 'kot');
                      }}
                      style={{
                        flex: 1, minWidth: '140px', padding: '10px 14px', borderRadius: '9999px', border: 'none',
                        background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
                        color: '#FFFFFF', fontWeight: 900, fontSize: '0.80rem', cursor: 'pointer'
                      }}
                    >
                      ⚡ Test KOT Receipt
                    </button>
                    <button
                      onClick={() => {
                        setShowPrinterModal(false);
                        handleDirectBluetoothPrint(sampleBill, 'bill');
                      }}
                      style={{
                        flex: 1, minWidth: '140px', padding: '10px 14px', borderRadius: '9999px', border: 'none',
                        background: '#10B981', color: '#FFFFFF', fontWeight: 900, fontSize: '0.80rem', cursor: 'pointer'
                      }}
                    >
                      🧾 Test Customer Bill
                    </button>
                  </>
                );
              })()}
              <button
                onClick={() => setShowPrinterModal(false)}
                style={{
                  padding: '10px 18px', borderRadius: '9999px', border: '1px solid #374151',
                  background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 Payment Checkout Modal */}
      {showPaymentModal && (
        <PaymentModal
          restoInfo={restaurantInfo}
          planTier={restaurantInfo?.plan_tier || 'pro'}
          planPrice={restaurantInfo?.plan_price || (restaurantInfo?.plan_tier === 'enterprise' ? 1999 : restaurantInfo?.plan_tier === 'basic' ? 499 : 999)}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setToastMessage('🎉 Cashfree Subscription Authorized! Mandate registered for automatic billing after trial.');
            setTimeout(() => setToastMessage(''), 4000);
            fetchRestaurantInfo().then(data => {
              if (data) setRestaurantInfo(data);
            });
          }}
        />
      )}

      {/* 🔔 Floating Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 12000, background: '#0A2315', color: '#DFBA67', border: '2px solid #DFBA67',
          padding: '12px 24px', borderRadius: '9999px', fontWeight: 900, fontSize: '0.88rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {toastMessage}
        </div>
      )}

      {/* 🖨️ Thermal Printer Toast Notification */}
      {printToast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 12000,
          background: printToast.type === 'success' ? '#0A2315' : '#7F1D1D',
          color: '#FFFFFF',
          padding: '10px 18px',
          borderRadius: '9999px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.85rem',
          fontWeight: 800,
          border: `1.5px solid ${printToast.type === 'success' ? '#22C55E' : '#EF4444'}`,
          maxWidth: '90vw'
        }}>
          <span>{printToast.message}</span>
          {printToast.type === 'error' && printToast.order && (
            <button
              onClick={() => {
                setPrintToast(null);
                if (printToast.printType === 'kot') {
                  handlePrintKOT(printToast.order);
                } else {
                  handlePrintCustomerBill(printToast.order, printToast.paymentMode);
                }
              }}
              style={{
                background: '#EF4444',
                color: '#FFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              🔄 Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

