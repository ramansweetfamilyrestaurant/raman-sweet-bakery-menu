import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import CustomerHeader from './components/CustomerHeader';
import MenuCardItem from './components/MenuCardItem';
import SearchBar from './components/SearchBar';
import CategoryJumpRail from './components/CategoryJumpRail';
import DishCard from './components/DishCard';
import DishModal from './components/DishModal';
import ComboModal from './components/ComboModal';
import RestaurantInfoModal from './components/RestaurantInfoModal';
import BottomDock from './components/BottomDock';
import Footer from './components/Footer';
import DishFormModal from './components/Admin/DishFormModal';
import CategoryFormModal from './components/Admin/CategoryFormModal';
import { fetchRestaurantInfo, fetchCategories, fetchDishes, toggleDishAvailability, deleteDish, createDirectOrder, trackOrderStatus, fetchActiveTableOrder, fetchCombos } from './api/client';
import { LayoutList, Grid, BookOpen, X, Sparkles, ShieldAlert, Phone, Plus, Edit3, Trash2, LogOut, Settings, Crown, CheckCircle, MessageSquare, XCircle } from 'lucide-react';
import ServiceRequestModal from './components/ServiceRequestModal';
import CustomerReviewModal from './components/CustomerReviewModal';
import PresenceVerificationModal from './components/PresenceVerificationModal';
import CategoryImage from './components/CategoryImage';
import { isValidQrTokenFormat, normalizeSpaceType, normalizeSpaceNumber } from './utils/qrSecurity';

// Robust Lazy Loading with automatic retry on new production deploys
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn('Chunk loading failed, checking for updated deploy...', error);
      const isChunkError = error?.message && (
        error.message.includes('dynamically imported module') ||
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('error loading dynamically imported module') ||
        error.message.includes('Importing a module script failed')
      );
      if (isChunkError && !sessionStorage.getItem('retry-chunk-refresh')) {
        sessionStorage.setItem('retry-chunk-refresh', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

const AdminDashboard = lazyWithRetry(() => import('./components/Admin/AdminDashboard'));
const OnboardingSetup = lazyWithRetry(() => import('./components/Admin/OnboardingSetup'));
const LandingPage = lazyWithRetry(() => import('./components/Landing/LandingPage'));
const AdminLogin = lazyWithRetry(() => import('./components/Admin/AdminLogin'));
const SuperAdminLogin = lazyWithRetry(() => import('./components/SuperAdmin/SuperAdminLogin'));
const SuperAdminDashboard = lazyWithRetry(() => import('./components/SuperAdmin/SuperAdminDashboard'));
const RegisterPage = lazyWithRetry(() => import('./components/RegisterPage'));
const SubscriptionBillingPage = lazyWithRetry(() => import('./components/SubscriptionBillingPage'));
const PrivacyPolicy = lazyWithRetry(() => import('./components/Legal/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./components/Legal/TermsOfService'));
const RefundPolicy = lazyWithRetry(() => import('./components/Legal/RefundPolicy'));
const SecurityPolicy = lazyWithRetry(() => import('./components/Legal/SecurityPolicy'));
const ContactSupport = lazyWithRetry(() => import('./components/Legal/ContactSupport'));
const StandaloneKdsPage = lazyWithRetry(() => import('./components/Admin/views/StandaloneKdsPage'));

// Pure URL helper functions declared at module level
export const getSlugFromUrl = () => {
  const path = window.location.pathname;
  if (!path || path === '/' || path === '/admin' || path === '/super-admin' || path === '/superadmin' || path === '/register' || path === '/billing') {
    return '';
  }
  
  if (path.startsWith('/r/')) {
    const parts = path.split('/r/')[1].split('/');
    return parts[0] || '';
  }

  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const parts = cleanPath.split('/');
  const candidate = parts[0];
  
  if (['menu', 'admin', 'superadmin', 'super-admin', 'api', 'uploads', 'assets', 'register', 'billing', 'kitchen', 'privacy', 'terms', 'privacy-policy', 'terms-of-service', 'refund-policy', 'security', 'contact'].includes(candidate.toLowerCase())) {
    return '';
  }
  
  return candidate || '';
};

export const isSlugKitchenPath = (rawPath) => {
  if (!rawPath) return false;
  const cleanPath = String(rawPath).toLowerCase().replace(/\/$/, '');
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length === 2 && parts[1] === 'kitchen') {
    const slugCandidate = parts[0];
    return !['admin', 'superadmin', 'super-admin', 'api', 'uploads', 'assets', 'register', 'billing', 'privacy', 'terms'].includes(slugCandidate);
  }
  if (parts.length === 3 && parts[0] === 'r' && parts[2] === 'kitchen') {
    return true;
  }
  return false;
};

export default function App() {
  // 1. Canonical Scanned QR Identity from URL
  const getSpaceInfoFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = (urlParams.get('tkn') || urlParams.get('token') || urlParams.get('sig') || '').trim();
    let type = '';
    let num = '';

    if (urlParams.get('cinema') || urlParams.get('seat')) {
      type = 'cinema_seat';
      num = (urlParams.get('cinema') || urlParams.get('seat')).trim();
    } else if (urlParams.get('screen') && urlParams.get('row')) {
      type = 'cinema_seat';
      const screen = urlParams.get('screen').trim();
      const row = urlParams.get('row').trim().toUpperCase();
      const seat = (urlParams.get('seatno') || urlParams.get('seat_num') || '1').trim();
      num = `S${screen}-${row}-${seat}`;
    } else if (urlParams.get('cabin')) {
      type = 'cabin';
      num = urlParams.get('cabin').trim();
    } else if (urlParams.get('room')) {
      type = 'room';
      num = urlParams.get('room').trim();
    } else if (urlParams.get('vip')) {
      type = 'vip';
      num = urlParams.get('vip').trim();
    } else if (urlParams.get('table') || urlParams.get('t') || urlParams.get('tableno') || urlParams.get('tbl')) {
      type = 'table';
      num = (urlParams.get('table') || urlParams.get('t') || urlParams.get('tableno') || urlParams.get('tbl')).trim();
    } else {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        const prevPart = parts[parts.length - 2].toLowerCase();
        if (prevPart === 'cinema' || prevPart === 'seat') {
          type = 'cinema_seat';
          num = lastPart;
        } else if (/^\d+$/.test(lastPart)) {
          if (prevPart === 'cabin') { type = 'cabin'; num = lastPart; }
          else if (prevPart === 'room') { type = 'room'; num = lastPart; }
          else if (prevPart === 'vip') { type = 'vip'; num = lastPart; }
          else if (prevPart === 'table' || prevPart === 'tbl' || prevPart === 'r') { type = 'table'; num = lastPart; }
        }
      }
    }

    const isScanned = Boolean(type && num);
    const isValidTokenShape = Boolean(token && isValidQrTokenFormat(token));

    let label = '';
    let badge = '';
    if (isScanned) {
      if (type === 'cinema_seat') {
        const cMatch = String(num).match(/^(?:screen\s*(\d+)[\s\-_•|]+row\s*([a-zA-Z]+)[\s\-_•|]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
        if (cMatch) {
          const sc = cMatch[1] || cMatch[4];
          const rw = (cMatch[2] || cMatch[5]).toUpperCase();
          const st = cMatch[3] || cMatch[6];
          label = `Screen ${sc} • Row ${rw} • Seat ${st}`;
          badge = `🎬 Screen ${sc} • Row ${rw} • Seat ${st}`;
        } else {
          label = `Seat ${num}`;
          badge = `🎬 Seat ${num}`;
        }
      }
      else if (type === 'cabin') { label = `Cabin ${num}`; badge = `🛋️ Cabin ${num}`; }
      else if (type === 'room') { label = `Room ${num}`; badge = `🏨 Room ${num}`; }
      else if (type === 'vip') { label = `VIP ${num}`; badge = `👑 VIP ${num}`; }
      else { label = `Table ${num}`; badge = `🍽️ Table ${num}`; }
    }

    return {
      isScanned,
      type,
      num,
      token,
      isValidTokenShape,
      label,
      badge
    };
  };

  // Menu Data State (Declared at top of component to avoid TDZ access)
  const [info, setInfo] = useState(null);
  const initialSpaceInfo = getSpaceInfoFromUrl();
  const initialTableNum = initialSpaceInfo.num;
  const [currentTableNum, setCurrentTableNum] = useState(initialSpaceInfo.num);
  const [currentSpaceType, setCurrentSpaceType] = useState(initialSpaceInfo.type);
  const [currentTableToken, setCurrentTableToken] = useState(initialSpaceInfo.token);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [autoKillSeconds, setAutoKillSeconds] = useState(null);

  // Validate if the table/space number exists within the restaurant's configured capacity & has valid token shape
  const isSpaceNumberValid = () => {
    if (!currentTableNum) return true;

    // Strict requirement: A scanned space QR MUST have a token with valid shape (8 hex chars)
    if (!initialSpaceInfo.isValidTokenShape) {
      return false;
    }

    if (currentSpaceType === 'cinema_seat' || initialSpaceInfo.type === 'cinema_seat') {
      const cMatch = String(currentTableNum).match(/^(?:screen\s*(\d+)[\s\-_•|]+row\s*([a-zA-Z]+)[\s\-_•|]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
      return Boolean(cMatch || String(currentTableNum).trim().length > 0);
    }

    const num = parseInt(currentTableNum, 10);
    if (isNaN(num) || num <= 0) return false;

    if (!info) return true; // Still loading restaurant info

    const activeType = (currentSpaceType || String(info.table_prefix || 'table')).toLowerCase();
    let maxAllowed = 0;
    if (activeType === 'cabin') {
      maxAllowed = Number(info.total_cabins) || Number(info.total_tables) || 0;
    } else if (activeType === 'room') {
      maxAllowed = Number(info.total_rooms) || Number(info.total_tables) || 0;
    } else if (activeType === 'vip') {
      maxAllowed = Number(info.total_vip) || Number(info.total_tables) || 0;
    } else {
      maxAllowed = Number(info.total_tables) || 0;
    }

    // Capacity check
    if (maxAllowed > 0 && num > maxAllowed) {
      return false;
    }

    return true;
  };

  const isTableValid = isSpaceNumberValid();
  // Effective Table Number (Empty if session expired or scanned QR identity is unverified/invalid/out-of-range)
  const effectiveTableNum = (sessionExpired || !isTableValid) ? '' : currentTableNum;

  const formatCustomerLocation = (raw, overrideSpaceType = null) => {
    const target = raw !== undefined && raw !== null ? String(raw).trim() : String(effectiveTableNum || '').trim();
    if (!target) return '';
    const activeType = (overrideSpaceType || currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
    const isCinema = activeType === 'cinema_seat' || activeType === 'cinema' || target.toLowerCase().includes('screen') || target.toLowerCase().includes('seat');

    const cMatch = target.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                   target.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
    if (cMatch) {
      return `🎬 Screen ${cMatch[1]} • Row ${cMatch[2].toUpperCase()} • Seat ${cMatch[3]}`;
    }
    if (isCinema) {
      if (target.toLowerCase().startsWith('screen')) return `🎬 ${target}`;
      return `🎬 Seat ${target.replace(/^seat\s*#?/i, '')}`;
    }
    if (/^cabin\s*#?\d+/i.test(target) || activeType === 'cabin') {
      return `🛋️ ${target.toLowerCase().startsWith('cabin') ? target : `Cabin ${target}`}`;
    }
    if (/^room\s*#?\d+/i.test(target) || activeType === 'room') {
      return `🏨 ${target.toLowerCase().startsWith('room') ? target : `Room ${target}`}`;
    }
    if (/^vip\s*#?\d+/i.test(target) || activeType === 'vip') {
      return `👑 ${target.toUpperCase()}`;
    }
    if (/^[\p{Extended_Pictographic}\u2000-\u3300]/u.test(target)) {
      return target;
    }
    return `🍽️ Table ${target.replace(/^table\s*#?/i, '')}`;
  };

  const getDynamicSpaceLabel = (raw) => formatCustomerLocation(raw);

  const hasScannedSpace = Boolean(
    currentTableNum &&
    String(currentTableNum).trim() !== '' &&
    initialSpaceInfo.isValidTokenShape &&
    isTableValid &&
    effectiveTableNum
  );

  const isViewOnlyUrl = Boolean(
    new URLSearchParams(window.location.search).get('view') === '1' ||
    new URLSearchParams(window.location.search).get('view_only') === 'true' ||
    new URLSearchParams(window.location.search).get('mode') === 'view'
  );

  // Direct Table Ordering is active ONLY when:
  // 1. Not in view-only URL mode
  // 2. An authenticated Table/Cabin/Room QR code is scanned with valid token (hasScannedSpace)
  // 3. Restaurant has direct_ordering_enabled = 1
  // 4. SaaS Plan permissions allow direct ordering
  const isDirectOrderingActive = Boolean(
    !isViewOnlyUrl &&
    hasScannedSpace &&
    info &&
    (info.direct_ordering_enabled === true || info.direct_ordering_enabled === 1 || info.direct_ordering_enabled === '1') &&
    (info.permissions?.direct_ordering_enabled !== false && info.permissions?.direct_ordering_enabled !== 0 && info.permissions?.direct_ordering_enabled !== 'false')
  );

  // Language State ('en' or 'hi')
  const [lang, setLang] = useState('en');

  const getInitialView = () => {
    const path = (window.location.pathname || '/').toLowerCase().replace(/\/$/, '') || '/';
    const hash = (window.location.hash || '').toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    const hasAuthCodeOrToken = urlParams.get('code') || urlParams.get('token');

    // Prevent any AdminLogin flash during post-registration / Cashfree authorization code exchange
    if (hasAuthCodeOrToken) {
      return 'auth-exchanging';
    }

    if (isSlugKitchenPath(path)) return 'kitchen-kds';
    if (path === '/privacy-policy' || path === '/privacy') return 'privacy-policy';
    if (path === '/terms' || path === '/terms-of-service') return 'terms';
    if (path === '/refund-policy' || path === '/refunds') return 'refund-policy';
    if (path === '/security') return 'security';
    if (path === '/contact' || path === '/support') return 'contact';
    if (path === '/billing') return 'billing';
    if (path === '/register') return 'register';
    if (path === '/super-admin' || path === '/superadmin' || hash === '#super-admin') {
      const t = localStorage.getItem('saas_super_token');
      return (t && t !== 'undefined' && t !== 'null') ? 'super-admin-dashboard' : 'super-admin-login';
    }
    if (path.includes('/admin/setup') || hash === '#setup') {
      const t = localStorage.getItem('touchqr_admin_token');
      return (t && t !== 'undefined' && t !== 'null') ? 'admin-setup' : 'admin-login';
    }
    if (path.includes('/admin') || hash === '#admin') {
      const t = localStorage.getItem('touchqr_admin_token');
      const onb = localStorage.getItem('touchqr_onboarding_completed');
      if (t && t !== 'undefined' && t !== 'null') {
        return (onb === 'false') ? 'admin-setup' : 'admin-dashboard';
      }
      return 'admin-login';
    }
    if (path === '' || path === '/') return 'landing';
    return 'menu';
  };

  // Navigation State
  const [view, setView] = useState(getInitialView); // 'menu', 'admin-login', 'admin-dashboard', 'super-admin-login', 'super-admin-dashboard', 'billing', 'register'
  const [layoutMode, setLayoutMode] = useState('list'); // 'list' or 'grid'

  const getInitialToken = () => {
    const t = localStorage.getItem('touchqr_admin_token');
    return (t && t !== 'undefined' && t !== 'null') ? t : '';
  };
  const getInitialUser = () => {
    const u = localStorage.getItem('touchqr_admin_user');
    return (u && u !== 'undefined' && u !== 'null') ? u : '';
  };
  const getInitialSlug = () => {
    const s = localStorage.getItem('touchqr_admin_slug');
    return (s && s !== 'undefined' && s !== 'null') ? s : '';
  };

  const [adminToken, setAdminToken] = useState(getInitialToken());
  const [adminUsername, setAdminUsername] = useState(getInitialUser());
  const [adminSlug, setAdminSlug] = useState(getInitialSlug());
  const [newlyRegisteredResto, setNewlyRegisteredResto] = useState(null);
  const [showLandingLoginModal, setShowLandingLoginModal] = useState(false);
  const [landingLoginMode, setLandingLoginMode] = useState('login'); // 'login' | 'forgot'
  const [loginSlugInput, setLoginSlugInput] = useState('');
  const [loginPassInput, setLoginPassInput] = useState('');
  const [landingNewPassInput, setLandingNewPassInput] = useState('');
  const [loginErrMessage, setLoginErrMessage] = useState('');
  const [landingSuccessMessage, setLandingSuccessMessage] = useState('');
  const [landingLoginLoading, setLandingLoginLoading] = useState(false);
  const [masterSupportPhone, setMasterSupportPhone] = useState('919876543210');
  const [trialDays, setTrialDays] = useState(null);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const trialText = trialDays ? `${trialDays}` : '';
  const trialLabel = trialDays ? `${trialDays}-Day` : 'Free';
  const trialDaysLabel = trialDays ? `${trialDays} DAYS` : 'FREE';

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) setMasterSupportPhone(data.support_whatsapp);
        if (data && data.default_trial_days) {
          const days = parseInt(data.default_trial_days, 10);
          if (!isNaN(days) && days > 0) {
            setTrialDays(days);
          }
        }
      })
      .catch(console.error);

    // Read single-use authorization code from URL query params (when redirected back from Cashfree/Registration)
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    const slugParam = params.get('slug');

    if (codeParam) {
      // 1. Immediately wipe single-use code from address bar to prevent history/referrer leakage
      const cleanPath = slugParam ? `/${slugParam}/admin` : window.location.pathname;
      window.history.replaceState({}, '', cleanPath);

      // 2. Atomically exchange authorization code for JWT token
      fetch('/api/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeParam })
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.token) {
            handleAdminLoginSuccess(data.token, data.username || 'admin', data.slug || slugParam || '', data.restaurant);
          } else {
            console.warn('Authorization code exchange notice:', data?.error);
            setView('admin-login');
          }
        })
        .catch(err => {
          console.error('Authorization code exchange network error:', err);
          setView('admin-login');
        });
    } else {
      // Backward-compatibility fallback for legacy token links if any
      const tokenParam = params.get('token');
      const userParam = params.get('username');
      if (tokenParam && slugParam) {
        localStorage.setItem('touchqr_admin_token', tokenParam);
        localStorage.setItem('touchqr_admin_user', userParam || 'admin');
        localStorage.setItem('touchqr_admin_slug', slugParam);
        setAdminToken(tokenParam);
        setAdminUsername(userParam || 'admin');
        setAdminSlug(slugParam);
        setView('admin-dashboard');
        window.history.replaceState({}, '', `/${slugParam}/admin`);
      }
    }
  }, []);

  // Master Super Admin Tokens
  const getInitialSuperToken = () => {
    const t = localStorage.getItem('saas_super_token');
    return (t && t !== 'undefined' && t !== 'null') ? t : '';
  };
  const getInitialSuperUser = () => {
    const u = localStorage.getItem('saas_super_user');
    return (u && u !== 'undefined' && u !== 'null') ? u : '';
  };

  const [superToken, setSuperToken] = useState(getInitialSuperToken());
  const [superUsername, setSuperUsername] = useState(getInitialSuperUser());

  // Menu Data State
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modals
  const [selectedDishModal, setSelectedDishModal] = useState(null);
  const [selectedComboModal, setSelectedComboModal] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [publicPlans, setPublicPlans] = useState([]);
  const [serviceToastMsg, setServiceToastMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [restaurantStatus, setRestaurantStatus] = useState('active'); // 'active' | 'not_found' | 'suspended'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('review') === 'true' || params.get('review') === '1') {
      setShowReviewModal(true);
    }

    const currentPath = window.location.pathname.toLowerCase();
    const isPublicPlanRoute = currentPath === '/' || currentPath.includes('/register') || currentPath.includes('/billing') || currentPath.includes('/plan');
    if (isPublicPlanRoute) {
      fetch('/api/plans')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setPublicPlans(data);
          }
        })
        .catch(() => {});
    }
  }, []);

  // In-Context Owner Modals State
  const [ownerDishModalData, setOwnerDishModalData] = useState(null); // null, 'new', or dish object
  const [ownerCatModalData, setOwnerCatModalData] = useState(null); // null, 'new', or cat object

  // WhatsApp Direct Order Cart State & Handlers
  const [cartItems, setCartItems] = useState([]);
  const [combos, setCombos] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  const handleAddToCart = (dish, portionType = 'full', selectedModifiers = []) => {
    const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
    const isHalf = portionType === 'half' && hasHalfPrice;
    
    // Explicit portion label for clear Kitchen KOT receipt printing
    let portionName = '';
    if (hasHalfPrice) {
      portionName = isHalf ? (dish.portion_half_label || 'Half') : (dish.portion_full_label || 'Full');
    } else if (dish.portion && dish.portion.trim() !== '') {
      portionName = dish.portion.trim();
    }

    const basePrice = isHalf ? Math.round(Number(dish.price_half)) : Math.round(Number(dish.price));
    const extraPrice = (selectedModifiers || []).reduce((acc, m) => acc + (Number(m.price) || 0), 0);
    const unitPrice = basePrice + extraPrice;

    // Unique cart key including selected modifiers
    const modKey = (selectedModifiers || []).map(m => m.name).sort().join('_');
    const cartKey = `${dish.id}_${portionName || 'regular'}${modKey ? '_' + modKey : ''}`;

    const existingIndex = cartItems.findIndex(i => i.key === cartKey);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        key: cartKey,
        dish,
        portion: portionName,
        modifiers: selectedModifiers || [],
        price: unitPrice,
        quantity: 1
      }]);
    }
  };

  const handleAddComboToCart = (combo) => {
    let comboItems = [];
    try { comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []); } catch { comboItems = []; }
    const includesText = comboItems.map(i => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.dish_name}${i.portion === 'half' ? ' (H)' : ''}`).join(' + ');
    const cartKey = `combo_${combo.id}`;
    const existingIndex = cartItems.findIndex(i => i.key === cartKey);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        key: cartKey,
        dish: { id: `combo_${combo.id}`, name: combo.name, image: combo.image },
        portion: 'Combo',
        price: Math.round(Number(combo.price)),
        quantity: 1,
        isCombo: true,
        comboIncludes: includesText
      }]);
    }
  };

  const handleRemoveFromCart = (cartKey) => {
    setCartItems(cartItems.filter(i => (i.key || i.dish.id) !== cartKey));
  };

  const handleSendWhatsAppOrder = () => {
    if (!info || cartItems.length === 0) return;
    const rawPhone = info.whatsapp_number || info.phone || '';
    const phone = rawPhone.replace(/[^0-9]/g, '');
    if (!phone) {
      alert('WhatsApp number is not configured for this restaurant yet.');
      return;
    }
    let msg = `👋 Hello *${info.name}*!\nI would like to place an order from ${getDynamicSpaceLabel() || formatCustomerLocation(effectiveTableNum || '1')}:\n\n`;
    let grandTotal = 0;
    const sym = (info?.currency_symbol !== undefined && info?.currency_symbol !== null) ? info.currency_symbol : '₹';
    cartItems.forEach(item => {
      const itemPrice = item.price * item.quantity;
      grandTotal += itemPrice;
      const portionText = item.portion ? ` (${item.portion})` : '';
      const modText = (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0)
        ? `\n   ↳ Add-ons: ${item.modifiers.map(m => `+${m.name} (+${sym}${m.price})`).join(', ')}`
        : '';
      msg += `• ${item.quantity}x *${item.dish.name}${portionText}* - ${sym}${itemPrice}${modText}\n`;
    });
    msg += `\n*Total Amount:* ${sym}${grandTotal}`;
    if (customerNameInput) {
      msg += `\n👤 *Customer Name:* ${customerNameInput}`;
    }
    if (customerPhoneInput) {
      msg += `\n📞 *Customer Phone:* ${customerPhoneInput}`;
    }
    msg += `\n\nThank you!`;
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const [orderTableInput, setOrderTableInput] = useState(initialTableNum || '1');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const isPlacingOrderRef = useRef(false);

  // Table Presence Verification State & Refs
  const [presenceToken, setPresenceToken] = useState(null);
  const presenceTokenRef = useRef(null);
  const [presenceModalOpen, setPresenceModalOpen] = useState(false);
  const [presencePolicy, setPresencePolicy] = useState(null);
  const pendingOrderPayloadRef = useRef(null);

  // Invalidate presence token when physical table or restaurant context changes
  useEffect(() => {
    setPresenceToken(null);
    presenceTokenRef.current = null;
    pendingOrderPayloadRef.current = null;
    setPresenceModalOpen(false);
  }, [currentTableNum, currentSpaceType, currentTableToken, info?.slug]);

  // FIX: Table-specific localStorage key (Only for scanned table QR or active table number)
  const getOrderStorageKey = (tbl) => {
    const t = tbl || effectiveTableNum || orderTableInput;
    return t ? `touchqr_active_order_id_table_${t}` : null;
  };

  const getInitialActiveOrderId = () => {
    if (initialTableNum) {
      return localStorage.getItem(`touchqr_active_order_id_table_${initialTableNum}`) || null;
    }
    return null;
  };

  const [activeOrderId, setActiveOrderId] = useState(getInitialActiveOrderId);
  const [activeOrderTrack, setActiveOrderTrack] = useState(null);

  // 5-Second Persistent Auto-Kill Session Protection after order completion, cancellation, or rejection
  useEffect(() => {
    if (!activeOrderTrack || !['completed', 'cancelled', 'rejected'].includes(activeOrderTrack.status)) {
      setAutoKillSeconds(null);
      return;
    }

    const orderId = activeOrderTrack.id;
    const timeKey = `touchqr_order_completed_time_${orderId}`;
    let completedAt = Number(localStorage.getItem(timeKey));
    if (!completedAt || isNaN(completedAt)) {
      completedAt = Date.now();
      localStorage.setItem(timeKey, String(completedAt));
    }

    const updateCountdown = () => {
      const elapsedSec = Math.floor((Date.now() - completedAt) / 1000);
      const remainingSec = Math.max(0, 5 - elapsedSec);

      if (remainingSec <= 0) {
        // Auto-kill session cleanly after 5 seconds
        const key = getOrderStorageKey(activeOrderTrack.table_number);
        if (key) localStorage.removeItem(key);
        localStorage.removeItem(timeKey);
        setActiveOrderId(null);
        setActiveOrderTrack(null);
        setCurrentTableNum('');
        setSessionExpired(true);
        setAutoKillSeconds(null);
        setCartItems([]);
        setShowCartDrawer(false);
        const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
        const cleanPath = currentSlug ? `/${currentSlug}` : '/';
        window.history.replaceState({}, '', cleanPath);
      } else {
        setAutoKillSeconds(remainingSec);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeOrderTrack?.status, activeOrderTrack?.id]);

  // 3-Minute Inactivity Auto-Kill for Table QR Scanned Customers who haven't placed an order
  useEffect(() => {
    if (!effectiveTableNum || sessionExpired || activeOrderId || (activeOrderTrack && ['pending', 'accepted', 'kitchen', 'preparing', 'served'].includes(activeOrderTrack.status))) {
      return;
    }

    const scanTimeKey = `touchqr_table_scan_time_${effectiveTableNum}`;
    let scanTime = Number(localStorage.getItem(scanTimeKey));
    if (!scanTime || isNaN(scanTime)) {
      scanTime = Date.now();
      localStorage.setItem(scanTimeKey, String(scanTime));
    }

    const checkInactivity = () => {
      const elapsedSec = Math.floor((Date.now() - scanTime) / 1000);
      const remainingSec = Math.max(0, 180 - elapsedSec);

      if (remainingSec <= 0) {
        // 3 minutes inactivity without placing an order -> shift to read-only menu
        localStorage.removeItem(scanTimeKey);
        setCurrentTableNum('');
        setSessionExpired(true);
        setCartItems([]);
        setShowCartDrawer(false);
        const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
        const cleanPath = currentSlug ? `/${currentSlug}` : '/';
        window.history.replaceState({}, '', cleanPath);
      }
    };

    checkInactivity();
    const timer = setInterval(checkInactivity, 1000);
    return () => clearInterval(timer);
  }, [effectiveTableNum, activeOrderId, activeOrderTrack?.status, sessionExpired]);

  // Multi-Device Table-Level Live Sync Effect (Only runs if table QR code scanned OR order active in session)
  useEffect(() => {
    if (!effectiveTableNum && !activeOrderId) {
      setActiveOrderTrack(null);
      return;
    }

    const currentSlug = getSlugFromUrl() || (info && info.slug) || '';

    const checkTableStatus = async () => {
      try {
        if (activeOrderId) {
          try {
            const data = await trackOrderStatus(activeOrderId);
            if (data) {
              setActiveOrderTrack(data);
              return;
            }
          } catch (trackErr) {
            // Order was rejected or purged by admin -> show cancelled state
            if (trackErr?.message?.includes('not found') || trackErr?.status === 404 || String(trackErr).includes('404')) {
              setActiveOrderTrack({
                id: activeOrderId,
                status: 'cancelled',
                table_number: effectiveTableNum
              });
              return;
            }
          }
        }
        // Multi-device table sync ONLY if table QR code was scanned
        if (effectiveTableNum && !sessionExpired) {
          const tableData = await fetchActiveTableOrder(currentSlug, effectiveTableNum);
          if (tableData) {
            setActiveOrderTrack(tableData);
          } else {
            setActiveOrderTrack(null);
          }
        }
      } catch (err) {
        console.error('Failed to sync table order:', err);
      }
    };

    checkTableStatus();
    const interval = setInterval(checkTableStatus, 4000);
    return () => clearInterval(interval);
  }, [activeOrderId, effectiveTableNum, info, sessionExpired]);

  const handleSendDirectOrder = async () => {
    const slug = getSlugFromUrl() || (info && info.slug) || '';
    if (cartItems.length === 0) return;
    if (isPlacingOrderRef.current || placingOrder) return;
    isPlacingOrderRef.current = true;
    setPlacingOrder(true);

    const effectiveQrToken = currentTableToken || initialSpaceInfo.token || (new URLSearchParams(window.location.search).get('tkn') || '').trim();
    const targetTable = effectiveTableNum || currentTableNum || initialSpaceInfo.num || (new URLSearchParams(window.location.search).get('table') || '').trim() || '1';
    const targetSpaceType = currentSpaceType || initialSpaceInfo.type || 'table';

    if (!targetTable || !effectiveQrToken) {
      alert('Invalid or missing Table QR. Please scan the official QR code at your dining table to place an order.');
      setPlacingOrder(false);
      isPlacingOrderRef.current = false;
      return;
    }

    const itemsPayload = cartItems.map(item => ({
      dish_id: item.isCombo ? item.dish.id : item.dish.id,
      name: item.dish.name,
      portion: item.portion || '',
      modifiers: item.modifiers || [],
      price: item.price,
      quantity: item.quantity,
      ...(item.isCombo ? { type: 'combo', includes: item.comboIncludes || '' } : {})
    }));
    const grandTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const orderPayload = {
      slug,
      table_number: targetTable,
      space_type: targetSpaceType,
      table_token: effectiveQrToken,
      customer_name: customerNameInput || 'Dine-In Customer',
      customer_phone: customerPhoneInput || '',
      items: itemsPayload,
      total_amount: grandTotal,
      ...(presenceTokenRef.current ? { presence_token: presenceTokenRef.current } : {})
    };

    try {
      const res = await createDirectOrder(orderPayload);

      if (res && res.order_id) {
        const storageKey = `touchqr_active_order_id_table_${targetTable}`;
        localStorage.setItem(storageKey, String(res.order_id));
        localStorage.removeItem(`touchqr_table_scan_time_${targetTable}`);
        setActiveOrderId(String(res.order_id));
      }

      setOrderSuccessModal(res);
      setCartItems([]);
      setShowCartDrawer(false);
      pendingOrderPayloadRef.current = null;
    } catch (err) {
      const errMsg = String(err.message || '');
      const errCode = err.error || err.code || '';
      console.error('[ORDER SUBMISSION ERROR]', err);

      if (errCode === 'presence_required' || errCode === 'presence_expired') {
        // Save snapshot of order payload for controlled single retry once verified
        pendingOrderPayloadRef.current = {
          slug,
          table_number: targetTable,
          space_type: targetSpaceType,
          table_token: effectiveQrToken,
          customer_name: customerNameInput || 'Dine-In Customer',
          customer_phone: customerPhoneInput || '',
          items: itemsPayload,
          total_amount: grandTotal
        };
        setPresenceToken(null);
        presenceTokenRef.current = null;
        setPresencePolicy(err.data || { mode: 'GPS_WITH_STAFF_FALLBACK', allowed_methods: ['GPS', 'STAFF'] });
        setPresenceModalOpen(true);
        return;
      }

      if (errCode === 'invalid_presence') {
        setPresenceToken(null);
        presenceTokenRef.current = null;
        pendingOrderPayloadRef.current = {
          slug,
          table_number: targetTable,
          space_type: targetSpaceType,
          table_token: effectiveQrToken,
          customer_name: customerNameInput || 'Dine-In Customer',
          customer_phone: customerPhoneInput || '',
          items: itemsPayload,
          total_amount: grandTotal
        };
        setPresenceModalOpen(true);
        return;
      }

      if (errCode === 'invalid_qr' || errMsg.toLowerCase().includes('qr')) {
        alert(errMsg || 'Invalid or unverified Table QR code. Please scan the official QR code at your dining table.');
      } else {
        alert(errMsg || 'Failed to place order. Please try again.');
      }
    } finally {
      setPlacingOrder(false);
      setTimeout(() => {
        isPlacingOrderRef.current = false;
      }, 300);
    }
  };

  // Called when customer table presence is verified (via GPS or Staff)
  const handlePresenceVerified = (verifiedToken, method) => {
    setPresenceToken(verifiedToken);
    presenceTokenRef.current = verifiedToken;
    setPresenceModalOpen(false);

    if (pendingOrderPayloadRef.current) {
      executePendingOrderRetry(verifiedToken);
    }
  };

  // Dedicated single-shot retry with verified presence token
  const executePendingOrderRetry = async (verifiedToken) => {
    const payload = pendingOrderPayloadRef.current;
    if (!payload) return;
    pendingOrderPayloadRef.current = null;

    if (isPlacingOrderRef.current || placingOrder) return;
    isPlacingOrderRef.current = true;
    setPlacingOrder(true);

    try {
      const orderPayloadWithToken = {
        ...payload,
        presence_token: verifiedToken
      };

      const res = await createDirectOrder(orderPayloadWithToken);

      if (res && res.order_id) {
        const storageKey = `touchqr_active_order_id_table_${payload.table_number}`;
        localStorage.setItem(storageKey, String(res.order_id));
        localStorage.removeItem(`touchqr_table_scan_time_${payload.table_number}`);
        setActiveOrderId(String(res.order_id));
      }

      setOrderSuccessModal(res);
      setCartItems([]);
      setShowCartDrawer(false);
    } catch (err) {
      console.error('[PRESENCE RETRY ORDER ERROR]', err);
      const errMsg = String(err.message || '');
      const errCode = err.error || err.code || '';
      if (errCode === 'presence_expired' || errCode === 'invalid_presence') {
        setPresenceToken(null);
        presenceTokenRef.current = null;
        alert('Table presence verification expired. Please verify again to place your order.');
        setPresenceModalOpen(true);
      } else {
        alert(errMsg || 'Failed to place order after verification. Please try again.');
      }
    } finally {
      setPlacingOrder(false);
      setTimeout(() => {
        isPlacingOrderRef.current = false;
      }, 300);
    }
  };

  // Load Menu Data
  const loadMenuData = async (forcedSlug = '', silent = false) => {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/$/, '');
    if (rawPath === '/kitchen') {
      setRestaurantStatus('not_found');
      setLoading(false);
      return;
    }
    const urlSlug = getSlugFromUrl();
    const isRootAdminRoute = rawPath === '/admin' || rawPath === '/super-admin' || rawPath === '/superadmin';
    const isAdminRoute = isRootAdminRoute || rawPath.includes('/admin') || window.location.hash === '#admin';
    const slug = forcedSlug || urlSlug || (isRootAdminRoute ? (localStorage.getItem('touchqr_admin_slug') || '') : '');

    // Skip full menu load for superadmin dashboard or standalone kitchen KDS
    if (view === 'super-admin-dashboard' || isSlugKitchenPath(window.location.pathname)) {
      setLoading(false);
      return;
    }
    // If root system admin route without tenant slug, render admin directly
    if (!slug && isRootAdminRoute) {
      setLoading(false);
      return;
    }

    if (!silent && !info) {
      setLoading(true);
    }
    setRestaurantStatus('active');
    const isSystemNonMenuRoute = ['/', '/register', '/billing', '/super-admin', '/superadmin', '/privacy-policy', '/privacy', '/terms', '/terms-of-service', '/refund-policy', '/refunds', '/security', '/contact', '/support'].includes(rawPath);
    if (!slug && isSystemNonMenuRoute) {
      setLoading(false);
      return;
    }
    const isAdminMode = Boolean(adminToken && isAdminRoute);
    console.log('[PUBLIC TENANT] URL slug:', urlSlug || '(none)');
    console.log('[PUBLIC TENANT] resolved slug:', slug || '(default demo tenant)');
    try {
      let infoData = null;
      let catData = [];
      let dishData = [];
      let comboData = [];

      // Fast single-bundle fetch for public customer view
      if (!isAdminMode && !searchQuery) {
        try {
          const bundleRes = await fetch(`/api/menu-bundle?slug=${encodeURIComponent(slug)}`);
          if (bundleRes.ok) {
            const bundle = await bundleRes.json();
            if (bundle && bundle.info) {
              infoData = bundle.info;
              catData = bundle.categories || [];
              dishData = bundle.dishes || [];
              comboData = bundle.combos || [];
              console.log('[PUBLIC TENANT] resolved restaurant id:', infoData.id);
              console.log('[PUBLIC TENANT] resolved restaurant name:', infoData.name);
            }
          } else {
            console.warn('[MENU] menu-bundle HTTP status:', bundleRes.status);
          }
        } catch (e) {
          console.warn('[MENU] menu-bundle fetch error:', e);
        }
      }

      // Fallback or Admin/Search view: parallel fetch
      if (!infoData) {
        const publicToken = isAdminMode ? adminToken : undefined;
        const [resInfo, resCat, resDish, resCombo] = await Promise.all([
          fetchRestaurantInfo({ token: publicToken, slug }),
          fetchCategories({ slug, adminView: isAdminMode, token: publicToken }),
          fetchDishes({ query: searchQuery, slug, adminView: isAdminMode, token: publicToken }),
          fetchCombos(slug).catch((err) => { console.warn('[MENU] fetchCombos notice:', err); return []; })
        ]);
        if (!infoData) infoData = resInfo;
        if (!catData || catData.length === 0) catData = resCat || [];
        if (!dishData || dishData.length === 0) dishData = resDish || [];
        if (!comboData || comboData.length === 0) comboData = resCombo || [];
      }

      if (!infoData && dishData && dishData.length > 0) {
        infoData = { id: dishData[0]?.restaurant_id || 0, name: 'Digital Restaurant Menu', slug: slug || 'menu' };
      }

      if ((!infoData || infoData.notFound) && (!dishData || dishData.length === 0)) {
        console.warn('[MENU] Restaurant not found for slug:', slug);
        setRestaurantStatus('not_found');
        setLoading(false);
        return;
      }
      if (infoData.suspended) {
        console.warn('[MENU] Restaurant suspended:', infoData.name);
        setRestaurantStatus('suspended');
        setInfo(infoData);
        setLoading(false);
        return;
      }

      console.log('[MENU] resolved restaurant id:', infoData ? infoData.id : 'none');
      console.log('[MENU] API dishes count:', dishData ? dishData.length : 0);
      console.log('[MENU] API categories count:', catData ? catData.length : 0);
      console.log('[MENU] final dishes count:', dishData ? dishData.length : 0);

      setInfo(infoData);
      setCategories(catData);
      setDishes(dishData);
      setCombos(Array.isArray(comboData) ? comboData : []);
      if (infoData && infoData.name && window.location.pathname !== '/' && window.location.pathname !== '/register') {
        document.title = `${infoData.name} - Digital Menu & Ordering`;
      } else if (window.location.pathname === '/') {
        document.title = 'TouchQR - Digital Menu & QR Ordering Platform';
      }
    } catch (err) {
      console.error('Error loading digital menu data:', err);
      const errMsg = String(err.message || '');
      if (errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
        setRestaurantStatus('not_found');
      } else if (errMsg.includes('403') || errMsg.toLowerCase().includes('suspended')) {
        setRestaurantStatus('suspended');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/$/, '');
    const isRootAdminRoute = rawPath === '/admin' || rawPath === '/super-admin' || rawPath === '/superadmin';
    const isNonMenuSystemView = ['landing', 'admin-dashboard', 'admin-login', 'super-admin-dashboard', 'super-admin-login', 'register', 'billing', 'privacy-policy', 'terms', 'refund-policy', 'security', 'contact'].includes(view);
    const slug = getSlugFromUrl();

    if (isNonMenuSystemView || isRootAdminRoute || isSlugKitchenPath(window.location.pathname)) {
      setLoading(false);
      if (view === 'menu' && slug) {
        loadMenuData(slug, true);
      }
    } else {
      loadMenuData();
    }
  }, [searchQuery, adminToken, view]);

  // Dynamic Theme Color Engine Applicator
  useEffect(() => {
    if ((view === 'customer' || view === 'admin' || view === 'menu-preview') && info && info.theme_color) {
      document.documentElement.setAttribute('data-theme', info.theme_color);
    } else {
      document.documentElement.setAttribute('data-theme', 'gold');
    }
  }, [info, view]);

  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Check restaurant mandate / subscription status server-side to gate Admin Dashboard access
  const checkMandateGating = async (tokenToCheck, slugToCheck, retries = 2) => {
    if (!tokenToCheck) return false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch('/api/admin/subscription-status', {
          headers: { Authorization: `Bearer ${tokenToCheck}` }
        });
        if (res.ok) {
          const data = await res.json();
          const isAllowed = data.is_allowed !== undefined ? Boolean(data.is_allowed) : (data.active === true || data.status === 'active' || data.status === 'trialing');
          const billingReq = data.billing_required !== undefined ? Boolean(data.billing_required) : false;
          return isAllowed && !billingReq;
        }
        if (res.status === 401 || res.status === 403) {
          console.warn('Expired token detected in checkMandateGating. Clearing stored credentials.');
          localStorage.removeItem('touchqr_admin_token');
          localStorage.removeItem('touchqr_admin_user');
          localStorage.removeItem('touchqr_admin_slug');
          localStorage.removeItem('adminToken');
          setAdminToken('');
          setAdminUsername('');
          setAdminSlug('');
          return false;
        }
      } catch (e) {
        console.warn(`Attempt ${attempt + 1} failed to verify mandate gating:`, e);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
    // Network retry exhausted: default to allowing access if token exists (don't force to billing on network lag)
    return true;
  };

  // Handle URL route changes (/super-admin, /admin, /, /r/:slug, #super-admin, #admin)
  useEffect(() => {
    const handleRouteCheck = async () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      // If someone types bare /admin without restaurant slug
      if (path === '/admin' || path === '/admin/') {
        let storedSlug = localStorage.getItem('touchqr_admin_slug');
        if (storedSlug && storedSlug !== 'undefined' && storedSlug !== 'null') {
          window.history.replaceState({}, '', `/${storedSlug}/admin`);
        }
      }

      // Route: /super-admin or /superadmin → Super Admin Portal
      const isSuperAdminPath = path.startsWith('/super-admin') || path.startsWith('/superadmin');
      const isSuperAdminHash = hash === '#super-admin' || hash === '#superadmin';
      const isSuperAdmin = isSuperAdminPath || isSuperAdminHash;

      // Route: /register → Registration Page
      const isRegister = path === '/register' || path === '/register/';

      // Route: /:slug/admin → Restaurant Admin
      const isRouteAdmin = (path.includes('/admin') || hash === '#admin') && !isSuperAdmin;

      // Route: / (root) → Landing Page
      const isRootPath = path === '' || path === '/';

      // Route: /billing → Subscription Billing Page
      const isBilling = path === '/billing' || path === '/billing/';

      // Route: /kitchen without slug → 404 Invalid URL
      const isGenericKitchen = path === '/kitchen' || path === '/kitchen/';

      // Route: /:slug/kitchen → Dedicated KDS Screen (slug required)
      const isKitchen = isSlugKitchenPath(path);

      // Legal & Support Routes
      const isPrivacy = path === '/privacy-policy' || path === '/privacy-policy/' || path === '/privacy';
      const isTerms = path === '/terms' || path === '/terms/' || path === '/terms-of-service';
      const isRefund = path === '/refund-policy' || path === '/refund-policy/' || path === '/refunds';
      const isSecurity = path === '/security' || path === '/security/';
      const isContact = path === '/contact' || path === '/contact/' || path === '/support';

      if (isGenericKitchen) {
        setRestaurantStatus('not_found');
      } else if (isKitchen) {
        setView('kitchen-kds');
        document.title = 'Kitchen KDS Display System';
      } else if (isPrivacy) {
        setView('privacy-policy');
        document.title = 'TouchQR - Privacy Policy';
      } else if (isTerms) {
        setView('terms');
        document.title = 'TouchQR - Terms of Service';
      } else if (isRefund) {
        setView('refund-policy');
        document.title = 'TouchQR - Refund & Cancellation Policy';
      } else if (isSecurity) {
        setView('security');
        document.title = 'TouchQR - Security & Data Protection';
      } else if (isContact) {
        setView('contact');
        document.title = 'TouchQR - Contact & Support';
      } else if (isSuperAdmin) {
        if (superToken) {
          setView('super-admin-dashboard');
        } else {
          setView('super-admin-login');
        }
      } else if (isBilling) {
        if (adminToken) {
          setView('billing');
        } else {
          window.history.replaceState({}, '', '/register');
          setView('register');
        }
      } else if (isRegister) {
        setView('register');
      } else if (isRouteAdmin) {
        let storedSlug = localStorage.getItem('touchqr_admin_slug');
        if (storedSlug === 'undefined' || storedSlug === 'null') storedSlug = '';

        const urlSlug = getSlugFromUrl();
        let currentSlug = urlSlug || (info && info.slug);
        if (!currentSlug || currentSlug === 'admin' || currentSlug === 'undefined' || currentSlug === 'null') {
          currentSlug = storedSlug;
        }

        let effectiveSlug = currentSlug || storedSlug;
        if (effectiveSlug === 'undefined' || effectiveSlug === 'null') effectiveSlug = '';

        if (adminToken) {
          if (urlSlug && storedSlug && urlSlug.toLowerCase() !== storedSlug.toLowerCase()) {
            console.warn(`URL slug '${urlSlug}' does not match stored admin token slug '${storedSlug}'. Prompting fresh login for '${urlSlug}'.`);
            localStorage.removeItem('touchqr_admin_token');
            localStorage.removeItem('touchqr_admin_slug');
            localStorage.removeItem('touchqr_onboarding_completed');
            setAdminToken('');
            setAdminSlug('');
            setView('admin-login');
            return;
          }

          const isSetupPath = path.includes('/admin/setup') || hash === '#setup';
          const storedOnboarding = localStorage.getItem('touchqr_onboarding_completed');
          const isOnboardingIncomplete = storedOnboarding === 'false' || (info && (info.onboarding_completed === false || info.onboarding_completed === 0 || info.onboarding_completed === 'false'));

          if (isSetupPath || isOnboardingIncomplete) {
            setView('admin-setup');
            const setupUrl = (effectiveSlug && effectiveSlug !== 'undefined' && effectiveSlug !== 'null') ? `/${effectiveSlug}/admin/setup` : '/admin/setup';
            if (window.location.pathname !== setupUrl) {
              window.history.replaceState({}, '', setupUrl);
            }
          } else {
            setView('admin-dashboard');
            const cleanUrl = (effectiveSlug && effectiveSlug !== 'undefined' && effectiveSlug !== 'null') ? `/${effectiveSlug}/admin` : '/admin';
            if (window.location.pathname !== cleanUrl) {
              window.history.replaceState({}, '', cleanUrl);
            }
          }

          // Fetch fresh tenant info to accurately evaluate onboarding & mandate status
          fetchRestaurantInfo({ token: adminToken, slug: effectiveSlug }).then(freshInfo => {
            if (freshInfo) {
              setInfo(freshInfo);
              const freshOnboardingComplete = (freshInfo.onboarding_completed !== false && freshInfo.onboarding_completed !== 0 && freshInfo.onboarding_completed !== 'false');
              localStorage.setItem('touchqr_onboarding_completed', freshOnboardingComplete ? 'true' : 'false');
              if (!freshOnboardingComplete) {
                setView('admin-setup');
                const setupUrl = (effectiveSlug && effectiveSlug !== 'undefined' && effectiveSlug !== 'null') ? `/${effectiveSlug}/admin/setup` : '/admin/setup';
                if (window.location.pathname !== setupUrl) {
                  window.history.replaceState({}, '', setupUrl);
                }
              }
            }
          }).catch(() => {});

          // Silent Mandate Verification in Background
          checkMandateGating(adminToken, effectiveSlug).then(mandateActive => {
            if (!mandateActive) {
              window.history.replaceState({}, '', '/billing');
              setView('billing');
            }
          }).catch(() => {});
        } else {
          setView('admin-login');
        }
      } else if (isRootPath) {
        setView('landing');
        document.title = 'TouchQR - Digital Menu & QR Ordering Platform';
      } else if (path === '/menu' || path === '/menu/') {
        window.history.replaceState({}, '', '/touchqr-demo');
        loadMenuData('touchqr-demo');
        setView('menu');
      } else {
        setView('menu');
        if (info && info.name) {
          document.title = `${info.name} - Digital Menu & Ordering`;
        }
      }
    };

    handleRouteCheck();
    window.addEventListener('hashchange', handleRouteCheck);
    window.addEventListener('popstate', handleRouteCheck);
    return () => {
      window.removeEventListener('hashchange', handleRouteCheck);
      window.removeEventListener('popstate', handleRouteCheck);
    };
  }, []);

  const handleAdminLoginSuccess = (token, username, slug, initialRestoInfo = null) => {
    // 1. Immediately clear old tenant data state to prevent cross-tenant UI flash
    setDishes([]);
    setCategories([]);
    setCombos([]);

    let currentSlug = slug || '';
    let restoInfo = initialRestoInfo || null;

    if (restoInfo && restoInfo.slug) {
      currentSlug = restoInfo.slug;
    }

    if (!currentSlug) {
      currentSlug = (restoInfo && restoInfo.slug) || slug || '';
    }

    const isOnboardingComplete = restoInfo
      ? (restoInfo.onboarding_completed !== false && restoInfo.onboarding_completed !== 0 && restoInfo.onboarding_completed !== 'false')
      : (localStorage.getItem('touchqr_onboarding_completed') !== 'false');

    const targetUrl = !isOnboardingComplete
      ? ((currentSlug && currentSlug !== 'undefined' && currentSlug !== 'null') ? `/${currentSlug}/admin/setup` : '/admin/setup')
      : ((currentSlug && currentSlug !== 'undefined' && currentSlug !== 'null') ? `/${currentSlug}/admin` : '/admin');

    // 2. SYNCHRONOUSLY update URL & localStorage FIRST so browser path instantly matches new tenant
    if (currentSlug && currentSlug !== 'undefined' && currentSlug !== 'null') {
      localStorage.setItem('touchqr_admin_slug', currentSlug);
    }
    localStorage.setItem('touchqr_admin_token', token);
    localStorage.setItem('touchqr_admin_user', username);
    localStorage.setItem('touchqr_onboarding_completed', isOnboardingComplete ? 'true' : 'false');
    window.history.replaceState({}, '', targetUrl);

    // 3. Update React state & route to OnboardingSetup wizard if onboarding not yet completed
    setAdminToken(token);
    setAdminUsername(username);
    setAdminSlug(currentSlug);
    if (restoInfo) setInfo(restoInfo);

    if (!isOnboardingComplete) {
      setView('admin-setup');
    } else {
      setView('admin-dashboard');
    }

    // 4. Background Mandate Verification (non-blocking)
    checkMandateGating(token, currentSlug).then(mandateActive => {
      if (!mandateActive) {
        setView('billing');
        window.history.replaceState({}, '', '/billing');
      }
    }).catch(() => {});
  };

  const handleAdminLogout = () => {
    const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
    localStorage.removeItem('touchqr_admin_token');
    localStorage.removeItem('touchqr_admin_user');
    localStorage.removeItem('touchqr_admin_slug');
    localStorage.removeItem('touchqr_onboarding_completed');
    setAdminToken('');
    setAdminUsername('');
    setAdminSlug('');
    setView('menu');
    window.history.pushState({}, '', currentSlug ? `/${currentSlug}` : '/');
    loadMenuData(currentSlug);
  };

  const handleSuperAdminLoginSuccess = (token, username) => {
    localStorage.setItem('saas_super_token', token);
    localStorage.setItem('saas_super_user', username);
    setSuperToken(token);
    setSuperUsername(username);
    setView('super-admin-dashboard');
    window.history.pushState({}, '', '/super-admin');
  };

  const handleSuperAdminLogout = () => {
    localStorage.removeItem('saas_super_token');
    localStorage.removeItem('saas_super_user');
    setSuperToken('');
    setSuperUsername('');
    setView('super-admin-login');
    window.history.pushState({}, '', '/super-admin');
  };

  // In-Context Owner Handlers
  const handleSaveInlineDish = async (dishData) => {
    const isEdit = Boolean(ownerDishModalData?.id);
    const url = isEdit ? `/api/admin/dishes/${ownerDishModalData.id}` : '/api/admin/dishes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(dishData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save dish');
    }

    setOwnerDishModalData(null);
    loadMenuData();
  };

  const handleSaveInlineCategory = async (catData) => {
    const isEdit = Boolean(ownerCatModalData?.id);
    const url = isEdit ? `/api/admin/categories/${ownerCatModalData.id}` : '/api/admin/categories';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(catData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save category');
    }

    setOwnerCatModalData(null);
    loadMenuData();
  };

  const handleInlineToggleDish = async (dishId, currentAvailable) => {
    try {
      const nextAvail = !currentAvailable;
      await toggleDishAvailability(dishId, nextAvail, adminToken);
      setDishes(dishes.map(d => d.id === dishId ? { ...d, available: nextAvail } : d));
    } catch (err) {
      alert(err.message || 'Failed to toggle availability');
    }
  };

  const handleInlineDeleteDish = async (dishId, dishName) => {
    if (!window.confirm(`Are you sure you want to delete '${dishName}'?`)) return;
    try {
      await deleteDish(dishId, adminToken);
      setDishes(dishes.filter(d => d.id !== dishId));
    } catch (err) {
      alert(err.message || 'Failed to delete dish');
    }
  };

  // Group dishes by category
  const groupedDishes = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.id] = { category: c, items: [] };
    });

    dishes.forEach(d => {
      if (map[d.category_id]) {
        map[d.category_id].items.push(d);
      } else {
        if (!map['uncategorized']) {
          map['uncategorized'] = { category: { name: 'Special Treats' }, items: [] };
        }
        map['uncategorized'].items.push(d);
      }
    });

    const results = Object.values(map).filter(group => group.items.length > 0);
    
    if (selectedCategory !== 'all') {
      return results.filter(g => String(g.category.id) === String(selectedCategory));
    }
    return results;
  }, [dishes, categories, selectedCategory]);

  const scrollToCategory = (catId) => {
    setSelectedCategory(catId);
    setShowCategoryDrawer(false);
    
    if (catId === 'all') {
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else {
      const element = document.getElementById(`cat-sec-${catId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 180, behavior: 'smooth' });
      }
    }
  };

  const handleRateUsClick = () => {
    if (!Boolean(info?.google_reviews_enabled)) return;

    const isAiReviewEnabled = info?.ai_review_enabled !== false && info?.ai_review_enabled !== 0 && info?.ai_review_enabled !== '0';

    if (isAiReviewEnabled) {
      setShowReviewModal(true);
    } else {
      const targetUrl = (info?.google_review_url && typeof info.google_review_url === 'string' && info.google_review_url.trim())
        ? info.google_review_url.trim()
        : (info?.google_maps_url && typeof info.google_maps_url === 'string' && info.google_maps_url.trim())
          ? info.google_maps_url.trim()
          : `https://www.google.com/search?q=${encodeURIComponent((info?.name || 'Restaurant') + ' ' + (info?.address || ''))}`;
      
      window.open(targetUrl, '_blank');
    }
  };

  const handleLandingAdminLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!loginSlugInput.trim() || !loginPassInput) return;

    setLandingLoginLoading(true);
    setLoginErrMessage('');
    setLandingSuccessMessage('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginSlugInput.trim(),
          password: loginPassInput
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setShowLandingLoginModal(false);
      await handleAdminLoginSuccess(data.token, data.username, data.slug, data.restaurant);
    } catch (err) {
      console.error('Landing login error:', err);
      setLoginErrMessage(err.message);
    } finally {
      setLandingLoginLoading(false);
    }
  };

  const handleLandingPasswordResetSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!loginSlugInput.trim() || !landingNewPassInput) {
      setLoginErrMessage('Please fill in all fields');
      return;
    }
    if (landingNewPassInput.length < 4) {
      setLoginErrMessage('New password must be at least 4 characters long');
      return;
    }
    setLandingLoginLoading(true);
    setLoginErrMessage('');
    setLandingSuccessMessage('');

    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_or_username: loginSlugInput.trim(),
          new_password: landingNewPassInput
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setLandingSuccessMessage(data.message || 'Password reset successfully!');
      setLandingLoginMode('login');
      setLoginPassInput('');
    } catch (err) {
      setLoginErrMessage(err.message);
    } finally {
      setLandingLoginLoading(false);
    }
  };

  // Landing Page View — Public SaaS Home
  if (view === 'landing') {
    return (
      <Suspense fallback={
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#0A2315',
          color: '#DFBA67', fontWeight: 800
        }}>
          <div style={{
            width: '44px', height: '44px', border: '3.5px solid rgba(223,186,103,0.2)',
            borderTopColor: '#DFBA67', borderRadius: '50%', marginBottom: '16px',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '0.92rem' }}>⚡ Loading TouchQR Homepage...</span>
        </div>
      }>
        <LandingPage
          publicPlans={publicPlans}
          trialDays={trialDays}
          showLoginModal={showLandingLoginModal}
          setShowLoginModal={setShowLandingLoginModal}
          loginMode={landingLoginMode}
          setLoginMode={setLandingLoginMode}
          loginSlugInput={loginSlugInput}
          setLoginSlugInput={setLoginSlugInput}
          adminUsernameInput={loginSlugInput}
          setAdminUsernameInput={setLoginSlugInput}
          adminPasswordInput={loginPassInput}
          setAdminPasswordInput={setLoginPassInput}
          newPasswordInput={landingNewPassInput}
          setNewPasswordInput={setLandingNewPassInput}
          loginErrMessage={loginErrMessage}
          setLoginErrMessage={setLoginErrMessage}
          successMessage={landingSuccessMessage}
          setSuccessMessage={setLandingSuccessMessage}
          loginLoading={landingLoginLoading}
          onSubmitLogin={handleLandingAdminLoginSubmit}
          onSubmitResetPassword={handleLandingPasswordResetSubmit}
        />
      </Suspense>
    );
  }

  // Legal & Support Views
  if (view === 'privacy-policy') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2315', fontWeight: 800 }}>Loading Privacy Policy...</div>}>
        <PrivacyPolicy onOpenLogin={() => setShowLandingLoginModal(true)} onStartTrial={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }} />
      </Suspense>
    );
  }

  if (view === 'terms') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2315', fontWeight: 800 }}>Loading Terms of Service...</div>}>
        <TermsOfService onOpenLogin={() => setShowLandingLoginModal(true)} onStartTrial={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }} />
      </Suspense>
    );
  }

  if (view === 'refund-policy') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2315', fontWeight: 800 }}>Loading Refund Policy...</div>}>
        <RefundPolicy onOpenLogin={() => setShowLandingLoginModal(true)} onStartTrial={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }} />
      </Suspense>
    );
  }

  if (view === 'security') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2315', fontWeight: 800 }}>Loading Security Policy...</div>}>
        <SecurityPolicy onOpenLogin={() => setShowLandingLoginModal(true)} onStartTrial={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }} />
      </Suspense>
    );
  }

  if (view === 'contact') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A2315', fontWeight: 800 }}>Loading Contact Support...</div>}>
        <ContactSupport onOpenLogin={() => setShowLandingLoginModal(true)} onStartTrial={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }} />
      </Suspense>
    );
  }

  // Explicit Subscription Status Loading Guard (Requirement 4: Never redirect while subscription state is still loading)
  if (subscriptionLoading && adminToken) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#DFBA67',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{ fontSize: '2.4rem', marginBottom: '14px' }}>🔐</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.2px' }}>
          Verifying Access & Subscription Status...
        </div>
        <div style={{ fontSize: '0.82rem', color: '#9CA3AF', marginTop: '6px' }}>
          Please wait while backend authorization resolves
        </div>
      </div>
    );
  }

  // Register Page View — Self-Service 14-Day Free Trial Registration Wizard
  if (view === 'register') {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DFBA67', fontWeight: 800 }}>
          Loading Registration System...
        </div>
      }>
        <RegisterPage onRegisterSuccess={(res) => {
          setAdminToken(res.token);
          setAdminUsername(res.username || 'Admin');
          setAdminSlug(res.slug);
          setNewlyRegisteredResto(res);
          window.history.pushState({}, '', '/billing');
          setView('billing');
        }} />
      </Suspense>
    );
  }

  // Subscription Billing & Onboarding View
  if (view === 'billing' || view === 'subscription') {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DFBA67', fontWeight: 800 }}>
          💳 Loading Subscription & Billing Page...
        </div>
      }>
        <SubscriptionBillingPage
          restoInfo={newlyRegisteredResto}
          token={adminToken}
          onProceedToDashboard={() => {
            handleAdminLoginSuccess(adminToken, adminUsername, adminSlug);
          }}
        />
      </Suspense>
    );
  }

  // Super Admin Portal Views
  if (view === 'super-admin-login') {
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#0A2315', color: '#DFBA67', minHeight: '100vh', fontWeight: 800 }}>👑 Loading Master Portal...</div>}>
        <SuperAdminLogin
          onLoginSuccess={handleSuperAdminLoginSuccess}
          onCancel={() => {
            setView('landing');
            window.history.pushState({}, '', '/');
          }}
        />
      </Suspense>
    );
  }

  if (view === 'super-admin-dashboard') {
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#0A2315', color: '#DFBA67', minHeight: '100vh', fontWeight: 800 }}>👑 Loading Master Dashboard...</div>}>
        <SuperAdminDashboard
          token={superToken}
          username={superUsername}
          onLogout={handleSuperAdminLogout}
          onImpersonate={(tenantToken, tenantUsername, tenantSlug) => {
            const targetSlug = tenantSlug || (info && info.slug) || '';
            localStorage.setItem('touchqr_admin_token', tenantToken);
            localStorage.setItem('touchqr_admin_user', tenantUsername);
            localStorage.setItem('touchqr_admin_slug', targetSlug);
            setAdminToken(tenantToken);
            setAdminUsername(tenantUsername);
            setAdminSlug(targetSlug);
            setView('admin-dashboard');
            window.history.pushState({}, '', `/${targetSlug}/admin`);
          }}
          onReturnToMenu={(tenantSlug) => {
            const targetSlug = tenantSlug || (info && info.slug) || getSlugFromUrl() || '';
            setView('menu');
            window.history.pushState({}, '', targetSlug ? `/${targetSlug}` : '/');
            loadMenuData(targetSlug, true);
          }}
        />
      </Suspense>
    );
  }

  // Global Initial Loading Screen Guard (Prevents ANY layout/header flashing on customer menu refresh)
  if (loading && view === 'menu') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        color: '#DFBA67', textAlign: 'center', padding: '20px'
      }}>
        <div style={{
          width: '48px', height: '48px',
          border: '4px solid rgba(223,186,103,0.25)',
          borderTopColor: '#FFD700',
          borderRadius: '50%',
          marginBottom: '20px',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFD700', letterSpacing: '0.5px' }}>
          TouchQR Digital Menu
        </div>
        <p style={{ fontSize: '0.84rem', color: '#E2E8F0', marginTop: '6px', fontWeight: 600 }}>
          Verifying restaurant details & loading menu...
        </p>
      </div>
    );
  }

  // Check if requested restaurant is deleted / not found
  if (restaurantStatus === 'not_found') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center'
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

  // Check if requested restaurant is suspended by Super Admin
  if (restaurantStatus === 'suspended') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        color: '#FFFFFF', textAlign: 'center'
      }}>
        <div style={{ fontSize: '4.5rem', marginBottom: '16px' }}>🔒</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFD700', margin: '0 0 8px 0' }}>
          Restaurant Temporarily Offline
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#E2E8F0', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          <strong>{info?.name || 'Yeh restaurant'}</strong> ki digital menu service filhal suspended hai. Kripya restaurant manager se sampark karein.
        </p>
      </div>
    );
  }

  // Dedicated Kitchen Display System (KDS) View Render
  if (view === 'kitchen-kds') {
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#090D16', color: '#F8FAFC', minHeight: '100vh', fontWeight: 800 }}>🍳 Loading Kitchen Display System...</div>}>
        <StandaloneKdsPage slug={getSlugFromUrl() || (info && info.slug) || ''} />
      </Suspense>
    );
  }

  // Dedicated Auth Exchanging Screen (Prevents 1.5s flash of AdminLogin screen after registration / Cashfree redirect)
  if (view === 'auth-exchanging') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A2315',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#DFBA67',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{
          width: '48px', height: '48px',
          border: '4px solid rgba(223,186,103,0.25)',
          borderTopColor: '#FFD700',
          borderRadius: '50%',
          marginBottom: '20px',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFD700', letterSpacing: '0.3px' }}>
          🎉 Welcome to TouchQR!
        </div>
        <p style={{ fontSize: '0.88rem', color: '#E2E8F0', marginTop: '8px', fontWeight: 600, maxWidth: '380px', lineHeight: 1.5 }}>
          Setting up your restaurant security & launching Admin Dashboard...
        </p>
      </div>
    );
  }

  // Restaurant Admin View Render
  if (view === 'admin-login') {
    if (loading) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#0A2315',
          color: '#DFBA67', fontWeight: 800
        }}>
          <div style={{
            width: '44px', height: '44px', border: '3.5px solid rgba(223,186,103,0.2)',
            borderTopColor: '#DFBA67', borderRadius: '50%', marginBottom: '16px',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '0.92rem' }}>🔑 Verifying Restaurant Security...</span>
        </div>
      );
    }
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#0A2315', color: '#FFFFFF', minHeight: '100vh', fontWeight: 800 }}>🔑 Loading Admin Login...</div>}>
        <AdminLogin
          restaurantName={info?.name}
          targetSlug={getSlugFromUrl() || (info && info.slug) || ''}
          onLoginSuccess={handleAdminLoginSuccess}
          onCancel={() => {
            const targetSlug = getSlugFromUrl() || (info && info.slug) || '';
            setView('menu');
            window.history.pushState({}, '', targetSlug ? `/${targetSlug}` : '/');
            loadMenuData(targetSlug);
          }}
        />
      </Suspense>
    );
  }

  if (view === 'admin-setup') {
    const activeAdminSlug = adminSlug || getSlugFromUrl() || (info && info.slug) || localStorage.getItem('touchqr_admin_slug') || '';
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <OnboardingSetup
          token={adminToken}
          restaurantInfo={info}
          setRestaurantInfo={setInfo}
          onComplete={() => {
            localStorage.setItem('touchqr_onboarding_completed', 'true');
            setInfo(prev => prev ? { ...prev, onboarding_completed: true } : { onboarding_completed: true });
            setView('admin-dashboard');
            window.history.pushState({}, '', activeAdminSlug ? `/${activeAdminSlug}/admin` : '/admin');
          }}
        />
      </Suspense>
    );
  }

  if (view === 'admin-dashboard') {
    const activeAdminSlug = adminSlug || (info && info.slug) || getSlugFromUrl() || localStorage.getItem('touchqr_admin_slug') || '';
    return (
      <Suspense fallback={
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#0A2315',
          color: '#DFBA67', fontWeight: 800
        }}>
          <div style={{
            width: '44px', height: '44px', border: '3.5px solid rgba(223,186,103,0.2)',
            borderTopColor: '#DFBA67', borderRadius: '50%', marginBottom: '16px',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '0.92rem' }}>📊 Loading Admin Dashboard...</span>
        </div>
      }>
        <AdminDashboard
          token={adminToken}
          username={adminUsername}
          slug={activeAdminSlug}
          onLogout={handleAdminLogout}
          onReturnToMenu={(tenantSlug) => {
            const targetSlug = tenantSlug || activeAdminSlug || (info && info.slug) || getSlugFromUrl() || '';
            setView('menu');
            window.history.pushState({}, '', targetSlug ? `/${targetSlug}` : '/');
            loadMenuData(targetSlug, true);
          }}
        />
      </Suspense>
    );
  }

  // Handle Suspended Restaurant Subscription Page
  if (info && info.active === false) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A2315',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '420px',
          background: '#FFFFFF',
          color: '#1C1917',
          borderRadius: '24px',
          padding: '36px 24px',
          border: '2px solid #D4AF37',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0A2315', marginBottom: '8px' }}>
            {info.name}
          </h2>
          <div style={{
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 800,
            display: 'inline-block',
            marginBottom: '16px'
          }}>
            SUBSCRIPTION SUSPENDED
          </div>

          <p style={{ fontSize: '0.86rem', color: '#666157', marginBottom: '24px', lineHeight: 1.4 }}>
            The Digital Menu service for this restaurant is currently suspended or past subscription renewal. Please contact restaurant administration.
          </p>

          <a
            href={`tel:${info.phone || ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#0A2315',
              color: '#DFBA67',
              padding: '12px 24px',
              borderRadius: '9999px',
              fontWeight: 800,
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            <Phone size={16} /> Contact Restaurant Management
          </a>
        </div>
      </div>
    );
  }

  // Customer Digital Menu Render (Clean public view — NO admin controls)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Customer Header */}
      <CustomerHeader
        info={info}
        lang={lang}
        tableNum={effectiveTableNum}
        spaceLabel={getDynamicSpaceLabel()}
        onToggleLang={() => setLang(lang === 'en' ? 'hi' : 'en')}
        onOpenInfoModal={() => setShowInfoModal(true)}
        onCallStaff={((info?.business_type === 'cinema_theatre' && info?.service_model === 'seat_service') || currentSpaceType === 'cinema_seat' || currentSpaceType === 'cinema' || String(info?.table_prefix || '').toLowerCase() === 'cinema_seat') ? null : () => setShowServiceModal(true)}
        onOpenReviewModal={handleRateUsClick}
        onOpenAdmin={() => {
          const targetSlug = getSlugFromUrl() || (info && info.slug) || localStorage.getItem('touchqr_admin_slug') || '';
          const targetUrl = (targetSlug && targetSlug !== 'undefined' && targetSlug !== 'null') ? `/${targetSlug}/admin` : '/admin';
          if (adminToken) {
            setView('admin-dashboard');
            window.history.pushState({}, '', targetUrl);
          } else {
            setView('admin-login');
            window.history.pushState({}, '', targetUrl);
          }
        }}
      />

      {/* 🛎️ Live Dine-In Customer Order Tracker Banner */}
      {activeOrderTrack && (info?.direct_ordering_enabled !== false && info?.direct_ordering_enabled !== 0) && (
        <div style={{
          background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
          color: '#FFFFFF',
          padding: '10px 16px',
          borderBottom: '2px solid var(--gold-bright)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>🛎️</span>
            <div>
              <strong style={{ fontSize: '0.86rem', color: 'var(--gold-bright)', display: 'block' }}>
                Order #{activeOrderTrack.id} • {formatCustomerLocation(activeOrderTrack.table_number)}
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#E5E7EB', fontWeight: 700 }}>
                Status: {
                  activeOrderTrack.status === 'completed' ? `Order Completed & Paid 🏁${autoKillSeconds ? ` (Session closes in ${autoKillSeconds >= 60 ? `${Math.floor(autoKillSeconds / 60)}m ${autoKillSeconds % 60}s` : `${autoKillSeconds}s`})` : ''}` :
                  activeOrderTrack.status === 'cancelled' || activeOrderTrack.status === 'rejected' ? `Order Cancelled 🔴${autoKillSeconds ? ` (Session closes in ${autoKillSeconds >= 60 ? `${Math.floor(autoKillSeconds / 60)}m ${autoKillSeconds % 60}s` : `${autoKillSeconds}s`})` : ''}` :
                  activeOrderTrack.status === 'served' ? (
                    (info?.business_type === 'cinema_theatre' || String(activeOrderTrack.table_number).toLowerCase().includes('screen') || String(activeOrderTrack.table_number).toLowerCase().includes('seat'))
                      ? 'Food Served to Seat 🎬 Enjoy your movie!'
                      : (info?.business_type === 'hotel_resort' || String(activeOrderTrack.table_number).toLowerCase().includes('room'))
                        ? 'Food Delivered to Room 🏨 Enjoy your meal!'
                        : 'Food Served to Table 🍽️ Enjoy your meal!'
                  ) :
                  (activeOrderTrack.kitchen_prepared === 1 || activeOrderTrack.kitchen_prepared === '1' || activeOrderTrack.kitchen_prepared === true) ? (
                    (info?.business_type === 'cinema_theatre' || String(activeOrderTrack.table_number).toLowerCase().includes('screen') || String(activeOrderTrack.table_number).toLowerCase().includes('seat'))
                      ? '🎉 Food Prepared! Staff bringing to seat 🎬'
                      : (info?.business_type === 'hotel_resort' || String(activeOrderTrack.table_number).toLowerCase().includes('room'))
                        ? '🎉 Food Prepared! Staff delivering to room 🏨'
                        : '🎉 Food Prepared! Waiter bringing to table 🛎️'
                  ) :
                  (activeOrderTrack.status === 'accepted' || activeOrderTrack.status === 'kitchen' || activeOrderTrack.status === 'preparing') ? 'Order Accepted - Chef Preparing 👨‍🍳' :
                  activeOrderTrack.status === 'pending' ? 'Pending Kitchen Acceptance 🟡' :
                  'Order Received 🟢'
                }
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (activeOrderTrack?.id) {
                localStorage.removeItem(`touchqr_order_completed_time_${activeOrderTrack.id}`);
              }
              localStorage.removeItem(getOrderStorageKey());
              setActiveOrderId(null);
              setActiveOrderTrack(null);
              setCurrentTableNum('');
              setSessionExpired(true);
              setAutoKillSeconds(null);
              setCartItems([]);
              setShowCartDrawer(false);
              const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
              const cleanPath = currentSlug ? `/${currentSlug}` : '/';
              window.history.replaceState({}, '', cleanPath);
            }}
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            End Session
          </button>
        </div>
      )}

      {/* ⌛ Session Expired Toast / Warning Banner */}
      {sessionExpired && (
        <div style={{
          background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
          color: '#FFFFFF',
          padding: '12px 18px',
          borderBottom: '2px solid #F87171',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.84rem',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <span>
              <strong>Session Expired (Read-Only Menu):</strong>{' '}
              {(() => {
                const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(currentTableNum || '').toLowerCase().includes('screen') || String(currentTableNum || '').toLowerCase().includes('seat');
                const isRoom = activeType === 'room' || String(currentTableNum || '').toLowerCase().includes('room');
                if (isCin) return 'Seat session ended. Naya order place karne ke liye seat QR code dubara scan karein!';
                if (isRoom) return 'Room session ended. Naya order place karne ke liye room QR code dubara scan karein!';
                return 'Table session ended. Naya order place karne ke liye table QR code dubara scan karein!';
              })()}
            </span>
          </div>
          <button
            onClick={() => setSessionExpired(false)}
            style={{ background: '#FFFFFF', color: '#991B1B', border: 'none', borderRadius: '9999px', padding: '4px 10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.76rem' }}
          >
            Got it ✖
          </button>
        </div>
      )}

      {/* ⚠️ Invalid Table / Space Warning Banner (When URL has a missing token, fake/unconfigured table number) */}
      {currentTableNum && info && !isTableValid && (
        <div style={{
          background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
          color: '#FFFFFF',
          padding: '12px 18px',
          borderBottom: '2px solid #F87171',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.84rem',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>
              {(() => {
                const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(currentTableNum || '').toLowerCase().includes('screen') || String(currentTableNum || '').toLowerCase().includes('seat');
                const isRoom = activeType === 'room' || String(currentTableNum || '').toLowerCase().includes('room');
                const spaceTitle = isCin ? 'Invalid Seat QR:' : isRoom ? 'Invalid Room QR:' : 'Invalid Table QR:';
                const scanPrompt = isCin
                  ? 'Please scan the official QR code at your cinema seat to order.'
                  : isRoom
                    ? 'Please scan the official QR code in your room to order.'
                    : 'Please scan the official QR code at your dining table to order.';
                const locationDisplay = formatCustomerLocation(currentTableNum);

                return (
                  <>
                    <strong>{spaceTitle}</strong> {!initialSpaceInfo.isValidTokenShape ? `This QR code is incomplete or modified. ${scanPrompt}` : `${locationDisplay} is not registered. ${scanPrompt}`} (Menu in View-Only mode).
                  </>
                );
              })()}
            </span>
          </div>
          <button
            onClick={() => setCurrentTableNum('')}
            style={{ background: '#FFFFFF', color: '#991B1B', border: 'none', borderRadius: '9999px', padding: '4px 10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.76rem' }}
          >
            Got it ✖
          </button>
        </div>
      )}

      {/* Live Search Bar & Quick Micro-Filter Pills */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
        onQuickFilter={(filterVal) => setSearchQuery(filterVal)}
        filtersVisibility={info?.filters_visibility}
        restoType={info?.resto_type}
        foodType={info?.food_type}
        isPureVeg={info?.is_pure_veg}
      />

      {/* Sticky Category Quick Jump Rail */}
      <CategoryJumpRail
        categories={categories}
        lang={lang}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => setSelectedCategory(catId)}
        hasCombos={combos.length > 0 && info?.filters_visibility?.combo !== false}
      />

      {/* Toolbar: View Switcher */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '10px 12px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--primary-emerald)'
          }}>
            {lang === 'hi' ? 'डिजिटल मेन्यू' : 'Digital Menu'}
          </h2>
          <span style={{
            fontSize: '0.75rem',
            background: 'var(--veg-green-bg)',
            color: 'var(--veg-green)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 700
          }}>
            {dishes.length} {lang === 'hi' ? 'व्यंजन' : 'Dishes'}
          </span>
        </div>

        {/* List vs Grid Layout Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          padding: '3px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border-light)'
        }}>
          <button
            onClick={() => setLayoutMode('list')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: layoutMode === 'list' ? 'var(--primary-emerald)' : 'transparent',
              color: layoutMode === 'list' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'var(--transition-fast)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <LayoutList size={14} />
            {lang === 'hi' ? 'सूची' : 'List'}
          </button>

          <button
            onClick={() => setLayoutMode('grid')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: layoutMode === 'grid' ? 'var(--primary-emerald)' : 'transparent',
              color: layoutMode === 'grid' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'var(--transition-fast)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Grid size={14} />
            {lang === 'hi' ? 'ग्रिड' : 'Grid'}
          </button>
        </div>
      </div>

      {/* Main Dishes List Content Area */}
      <main style={{
        flex: 1,
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '12px 12px 80px'
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-muted)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border-light)',
              borderTopColor: 'var(--gold-primary)',
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'spin 0.8s linear infinite'
            }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {lang === 'hi' ? 'डिजिटल मेन्यू लोड हो रहा है...' : 'Loading Digital Menu...'}
            </p>
          </div>
        ) : restaurantStatus === 'not_found' ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#FFFFFF',
            borderRadius: '24px',
            border: '1.5px solid #FEE2E2',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            margin: '20px 0'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '14px' }}>❌</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626', margin: '0 0 8px 0' }}>
              Restaurant Not Found / Deleted
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '420px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
              Yeh restaurant ab platform par active nahi hai ya iska link delete kar diya gaya hai.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '12px 26px',
                borderRadius: '9999px',
                border: 'none',
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#FFD700',
                fontWeight: 900,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(10,35,21,0.25)'
              }}
            >
              🏠 Go to Main Platform
            </button>
          </div>
        ) : restaurantStatus === 'suspended' ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#FFFFFF',
            borderRadius: '24px',
            border: '1.5px solid #FEF3C7',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            margin: '20px 0'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '14px' }}>🔒</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#B45309', margin: '0 0 8px 0' }}>
              Restaurant Temporarily Offline
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '420px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
              <strong>{info?.name || 'Yeh restaurant'}</strong> ki digital menu service filhal suspended hai. Kripya restaurant owner se sampark karein.
            </p>
          </div>
        ) : groupedDishes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '44px 20px',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍽️</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 6px 0' }}>
              {searchQuery ? (lang === 'hi' ? 'कोई व्यंजन नहीं मिला' : 'No dishes found') : (lang === 'hi' ? '✨ मेनू जल्द ही आ रहा है' : '✨ Digital Menu Coming Soon')}
            </p>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              {searchQuery ? (lang === 'hi' ? 'कृपया अपनी खोज शब्द बदलें' : 'Try searching for something else') : (lang === 'hi' ? 'रेस्टोरेंट अपने स्वादिष्ट व्यंजन जोड़ रहा है।' : 'The restaurant is preparing delicious dishes for you!')}
            </p>
          </div>
        ) : (
          <>
          {/* 🛒 COMBO DEALS SECTION - ULTRA SLIM & MOBILE-NATIVE */}
          {combos.length > 0 && !searchQuery && info?.filters_visibility?.combo !== false && (
            <section id="combos-section" style={{ marginBottom: '12px', scrollMarginTop: '110px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '6px', paddingBottom: '2px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '1rem' }}>🍱</span>
                  <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                    {lang === 'hi' ? 'कॉम्बो डील्स & थाली' : 'Combo Deals & Thalis'}
                  </h2>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 800, color: '#B45309',
                    background: '#FEF3C7', padding: '1px 6px', borderRadius: '10px',
                    border: '1px solid #FCD34D'
                  }}>{combos.length}</span>
                </div>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#059669' }}>
                  Swipe 👉
                </span>
              </div>

              {/* Slim Horizontal Scroll List */}
              <div style={{
                display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
                scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', msOverflowStyle: 'none'
              }}>
                {combos.map(combo => {
                  let comboItems = [];
                  try { comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []); } catch { comboItems = []; }
                  const originalTotal = comboItems.reduce((s, i) => s + ((i.original_price || 0) * (i.qty || 1)), 0);
                  const itemsSummaryText = comboItems.map(i => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.dish_name}`).join(' + ');

                  return (
                    <div 
                      key={combo.id}
                      onClick={() => setSelectedComboModal(combo)}
                      style={{
                        minWidth: '220px', maxWidth: '240px', flexShrink: 0, scrollSnapAlign: 'start',
                        background: '#FFFFFF', borderRadius: '12px', padding: '8px 10px',
                        border: '1px solid var(--gold-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                      }}
                    >
                      {/* Compact Image */}
                      <div style={{
                        width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden',
                        background: '#F9FAFB', border: '1px solid var(--gold-border)', flexShrink: 0,
                        position: 'relative'
                      }}>
                        <img 
                          src={combo.image || '/images/default-category.webp'} 
                          alt={combo.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.src = '/images/default-category.webp'; }}
                        />
                      </div>

                      {/* Info & Price */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ 
                          margin: 0, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dark)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                        }}>
                          {combo.name}
                        </h4>
                        <p style={{
                          margin: '2px 0 4px', fontSize: '0.66rem', color: 'var(--text-muted)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {itemsSummaryText || combo.description || 'Special combo deal'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#059669' }}>
                            {(info?.currency_symbol !== undefined && info?.currency_symbol !== null) ? info.currency_symbol : '₹'}{combo.price}
                          </span>
                          {originalTotal > combo.price && (
                            <span style={{ fontSize: '0.68rem', color: '#94A3B8', textDecoration: 'line-through' }}>
                              {(info?.currency_symbol !== undefined && info?.currency_symbol !== null) ? info.currency_symbol : '₹'}{originalTotal}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {groupedDishes.map((group) => (
            <section
              key={group.category.id}
              id={`cat-sec-${group.category.id}`}
              style={{
                marginBottom: '28px',
                scrollMarginTop: '110px'
              }}
            >
              {/* Category Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                borderBottom: '2px solid var(--border-light)',
                paddingBottom: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: 'var(--primary-emerald)',
                    margin: 0
                  }}>
                    {(lang === 'hi' && group.category.name_hi) ? group.category.name_hi : group.category.name}
                  </h3>
                  <span style={{
                    fontSize: '0.72rem',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 700
                  }}>
                    {group.items.length}
                  </span>
                </div>
              </div>

              {/* Dishes Grid/List based on layout switcher */}
              {layoutMode === 'list' ? (
                <div className="dish-list-grid">
                  {group.items.map((dish) => (
                    <MenuCardItem
                      key={dish.id}
                      dish={dish}
                      lang={lang}
                      currencySymbol={info?.currency_symbol !== undefined ? info.currency_symbol : '₹'}
                      filtersVisibility={info?.filters_visibility}
                      onClick={() => setSelectedDishModal(dish)}
                      onAddToCart={isDirectOrderingActive ? handleAddToCart : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '12px'
                }}>
                  {group.items.map((dish) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      lang={lang}
                      currencySymbol={info?.currency_symbol !== undefined ? info.currency_symbol : '₹'}
                      filtersVisibility={info?.filters_visibility}
                      onClick={() => setSelectedDishModal(dish)}
                      onAddToCart={isDirectOrderingActive ? handleAddToCart : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
          </>
        )}
      </main>

      {/* 🛒 Zomato-Style Floating Cart Bar (Appears ONLY when cart has items AND direct ordering is active) */}
      {cartItems.length > 0 && isDirectOrderingActive && (
        <div style={{
          position: 'fixed',
          bottom: '78px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 'calc(100% - 32px)',
          maxWidth: '440px'
        }}>
          {(() => {
            const isAddon = Boolean(activeOrderId && activeOrderTrack && ['pending', 'accepted', 'kitchen', 'preparing', 'served'].includes(activeOrderTrack.status));
            const nextRound = (Number(activeOrderTrack?.current_round) || Number(activeOrderTrack?.round_number) || 1) + 1;
            return (
              <button
                onClick={() => setShowCartDrawer(true)}
                style={{
                  width: '100%',
                  background: isAddon
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  border: '2px solid #FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 30px rgba(16, 185, 129, 0.45)',
                  animation: 'fadeIn 0.25s ease-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#FFFFFF', color: '#059669', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900 }}>
                    {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                  </span>
                  <span>{isAddon ? `+ Add to ${getDynamicSpaceLabel() || 'Table'} (Round ${nextRound})` : (lang === 'hi' ? 'कार्ट देखें' : 'View Cart')}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#FFFFFF' }}>
                    {(() => {
                      const sym = (info?.currency_symbol !== undefined && info?.currency_symbol !== null) ? info.currency_symbol : '₹';
                      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      const isGst = Boolean(info?.gst_enabled);
                      const grandTotal = isGst ? Math.round(subtotal * 1.05 * 100) / 100 : subtotal;
                      return `${sym}${grandTotal.toFixed(2)}`;
                    })()}
                  </span>
                  <span>→</span>
                </div>
              </button>
            );
          })()}
        </div>
      )}

      {/* 🛎️ Service Request Modal & Toast */}
      {showServiceModal && !((info?.business_type === 'cinema_theatre' && info?.service_model === 'seat_service') || currentSpaceType === 'cinema_seat' || currentSpaceType === 'cinema' || String(info?.table_prefix || '').toLowerCase() === 'cinema_seat') && (
        <ServiceRequestModal
          tableNum={getDynamicSpaceLabel() || (effectiveTableNum ? `Table ${effectiveTableNum}` : 'Table 1')}
          slug={getSlugFromUrl() || (info && info.slug)}
          onClose={() => setShowServiceModal(false)}
          onSuccess={(msg) => {
            setServiceToastMsg(msg);
            setTimeout(() => setServiceToastMsg(''), 6000);
          }}
        />
      )}

      {/* 🌟 Smart AI Google Review Booster Modal */}
      {showReviewModal && Boolean(info?.google_reviews_enabled) && (
        <CustomerReviewModal
          info={info}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      {/* 📍 Table Presence Verification Modal */}
      {presenceModalOpen && isDirectOrderingActive && (
        <PresenceVerificationModal
          isOpen={presenceModalOpen}
          onClose={() => {
            setPresenceModalOpen(false);
            pendingOrderPayloadRef.current = null;
          }}
          restaurantInfo={info}
          tableNumber={effectiveTableNum || currentTableNum || '1'}
          spaceType={currentSpaceType || 'table'}
          tableToken={currentTableToken || initialSpaceInfo.token || ''}
          tableLabel={getDynamicSpaceLabel()}
          presencePolicy={presencePolicy}
          onVerified={handlePresenceVerified}
        />
      )}

      {serviceToastMsg && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
          color: '#4ADE80',
          padding: '12px 20px',
          borderRadius: 'var(--radius-pill)',
          border: '1.5px solid #4ADE80',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          zIndex: 10010,
          fontWeight: 800,
          fontSize: '0.86rem',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {serviceToastMsg}
        </div>
      )}

      {/* 🛒 Cart Modal / Bottom Drawer */}
      {showCartDrawer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          {(() => {
            const isAddon = Boolean(activeOrderId && activeOrderTrack && ['pending', 'accepted', 'kitchen', 'preparing', 'served'].includes(activeOrderTrack.status));
            const nextRound = (Number(activeOrderTrack?.current_round) || Number(activeOrderTrack?.round_number) || 1) + 1;
            const sym = (info?.currency_symbol !== undefined && info?.currency_symbol !== null) ? info.currency_symbol : '₹';
            const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const subtotal = cartTotal;
            const isGst = Boolean(info?.gst_enabled);
            const cgst = isGst ? Math.round(subtotal * 0.025 * 100) / 100 : 0;
            const sgst = isGst ? Math.round(subtotal * 0.025 * 100) / 100 : 0;
            const grandTotal = isGst ? Math.round(subtotal * 1.05 * 100) / 100 : subtotal;

            return (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '28px 28px 0 0',
                maxWidth: '520px',
                width: '100%',
                padding: '24px 20px 36px 20px',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary-emerald)', display: 'block' }}>
                      {isAddon ? `🛒 Round ${nextRound} (Add-on Items)` : `🛒 My Order Items (${cartItems.reduce((acc, i) => acc + i.quantity, 0)})`}
                    </strong>
                    {isAddon && (
                      <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 800 }}>
                        Active Session: {getDynamicSpaceLabel() || `Table #${effectiveTableNum || '1'}`}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowCartDrawer(false)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>✕</button>
                </div>

                {isAddon && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '8px 12px', borderRadius: '12px', marginBottom: '12px', fontSize: '0.78rem', color: '#065F46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔄</span>
                    <span>
                      {(() => {
                        const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                        const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(effectiveTableNum).toLowerCase().includes('screen') || String(effectiveTableNum).toLowerCase().includes('seat');
                        const isRoom = activeType === 'room' || String(effectiveTableNum).toLowerCase().includes('room');
                        if (isCin) return <>These new items will be sent as <strong>Round {nextRound} KOT</strong> and merged with your running seat order/bill.</>;
                        if (isRoom) return <>These new items will be sent as <strong>Round {nextRound} KOT</strong> and merged with your running room order/bill.</>;
                        return <>These new items will be sent as <strong>Round {nextRound} KOT</strong> and merged with your running table bill.</>;
                      })()}
                    </span>
                  </div>
                )}

                {cartItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                    <MessageSquare size={40} color="#10B981" style={{ marginBottom: '10px', opacity: 0.6 }} />
                    <p style={{ fontSize: '0.95rem', margin: '0 0 6px 0', fontWeight: 800, color: 'var(--text-dark)' }}>Your order cart is empty.</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>Tap <strong>"+ ADD"</strong> on any dish to add items!</p>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {cartItems.map((item) => (
                      <div key={item.key || item.dish.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)', padding: '12px 14px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                        <div>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item.dish.name}
                            {item.isCombo ? (
                              <span style={{ background: '#D1FAE5', color: '#059669', fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', border: '1px solid #6EE7B7', fontWeight: 900 }}>
                                COMBO
                              </span>
                            ) : item.portion && (
                              <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', border: '1px solid #FCD34D', fontWeight: 900 }}>
                                {item.portion}
                              </span>
                            )}
                          </strong>
                          {item.isCombo && item.comboIncludes && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                              📦 {item.comboIncludes}
                            </span>
                          )}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px', marginBottom: '2px' }}>
                              {item.modifiers.map((m, mIdx) => (
                                <span key={mIdx} style={{ fontSize: '0.68rem', background: '#F1F5F9', color: '#334155', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontWeight: 700 }}>
                                  + {m.name} (+{sym}{m.price})
                                </span>
                              ))}
                            </div>
                          )}
                          <span style={{ fontSize: '0.82rem', color: 'var(--gold-primary)', fontWeight: 800 }}>
                            {sym}{item.price} x {item.quantity} = {sym}{item.price * item.quantity}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => handleAddToCart(item.dish, (item.portion === 'Half' || item.portion === item.dish?.portion_half_label) ? 'half' : 'full', item.modifiers)} style={{ background: 'var(--primary-emerald)', color: '#FFF', border: 'none', width: '28px', height: '28px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{item.quantity}</span>
                          <button onClick={() => handleRemoveFromCart(item.key || item.dish.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', width: '28px', height: '28px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cartItems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                    {!isAddon && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                              {(() => {
                                const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                                const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(effectiveTableNum || '').toLowerCase().includes('screen') || String(effectiveTableNum || '').toLowerCase().includes('seat');
                                const isRoom = activeType === 'room' || String(effectiveTableNum || '').toLowerCase().includes('room');
                                const isCabin = activeType === 'cabin' || String(effectiveTableNum || '').toLowerCase().includes('cabin');
                                const isVip = activeType === 'vip' || String(effectiveTableNum || '').toLowerCase().includes('vip');
                                if (isCin) {
                                  return getDynamicSpaceLabel() ? 'SCANNED SEAT 🔒' : 'SEAT #';
                                }
                                if (isRoom) {
                                  return getDynamicSpaceLabel() ? 'SCANNED ROOM 🔒' : 'ROOM #';
                                }
                                if (isCabin) {
                                  return getDynamicSpaceLabel() ? 'SCANNED CABIN 🔒' : 'CABIN #';
                                }
                                if (isVip) {
                                  return getDynamicSpaceLabel() ? 'SCANNED VIP LOUNGE 🔒' : 'VIP #';
                                }
                                return getDynamicSpaceLabel() ? 'SCANNED TABLE 🔒' : 'TABLE #';
                              })()}
                            </label>
                            <input
                              type="text"
                              value={getDynamicSpaceLabel() || orderTableInput}
                              onChange={(e) => {
                                if (!effectiveTableNum) {
                                  setOrderTableInput(e.target.value);
                                }
                              }}
                              readOnly={Boolean(effectiveTableNum)}
                              placeholder="e.g. 1"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                border: '1.5px solid #CBD5E1',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                background: effectiveTableNum ? '#F1F5F9' : '#FFFFFF',
                                color: effectiveTableNum ? '#0F172A' : '#000000',
                                cursor: effectiveTableNum ? 'not-allowed' : 'text'
                              }}
                            />
                          </div>
                          <div style={{ flex: 1.2 }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>YOUR NAME (OPTIONAL)</label>
                            <input
                              type="text"
                              value={customerNameInput}
                              onChange={(e) => setCustomerNameInput(e.target.value)}
                              placeholder="e.g. Rahul"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem' }}
                            />
                          </div>
                        </div>

                        {/* 📞 Customer Mobile Number Input Field */}
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                            📞 MOBILE NUMBER (OPTIONAL)
                          </label>
                          <input
                            type="tel"
                            maxLength="10"
                            value={customerPhoneInput}
                            onChange={(e) => setCustomerPhoneInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 9876543210"
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 🏷️ Authoritative Bill & GST Summary */}
                    {isGst && (
                      <div style={{
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                          <span>Items Subtotal</span>
                          <span>{sym}{subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                          <span>CGST (2.5%)</span>
                          <span>{sym}{cgst.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                          <span>SGST (2.5%)</span>
                          <span>{sym}{sgst.toFixed(2)}</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 800,
                          color: '#0F172A',
                          borderTop: '1px dashed #CBD5E1',
                          paddingTop: '4px',
                          marginTop: '2px'
                        }}>
                          <span>Grand Total (Inc. 5% GST)</span>
                          <span>{sym}{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {isDirectOrderingActive && (
                      <button
                        onClick={handleSendDirectOrder}
                        disabled={placingOrder}
                        style={{
                          width: '100%',
                          background: isAddon
                            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                            : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          color: '#FFFFFF',
                          padding: '14px 18px',
                          borderRadius: 'var(--radius-pill)',
                          fontWeight: 900,
                          fontSize: '0.96rem',
                          border: 'none',
                          cursor: placingOrder ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 6px 20px rgba(5, 150, 105, 0.45)',
                          opacity: placingOrder ? 0.7 : 1
                        }}
                      >
                        <Sparkles size={18} color="#FDE047" />
                        <span>
                          {placingOrder
                            ? 'Placing Order...'
                            : isAddon
                              ? `⚡ Confirm & Place Round ${nextRound} Order (${sym}${isGst ? grandTotal.toFixed(2) : subtotal})`
                              : `⚡ Confirm & Place Order (${sym}${isGst ? grandTotal.toFixed(2) : subtotal})`}
                        </span>
                      </button>
                    )}

                    {info && info.whatsapp_enabled !== false && (
                      <button
                        onClick={handleSendWhatsAppOrder}
                        style={{
                          width: '100%',
                          background: '#25D366',
                          color: '#FFFFFF',
                          padding: '12px 18px',
                          borderRadius: 'var(--radius-pill)',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)'
                        }}
                      >
                        <MessageSquare size={16} />
                        <span>Order via WhatsApp ({sym}{cartTotal})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* 🎉 Direct Kitchen Order Success Confirmation Modal */}
      {orderSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
            border: '2px solid var(--gold-bright)',
            borderRadius: '24px',
            maxWidth: '420px',
            width: '100%',
            padding: '30px 24px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-gold)',
            color: '#FFFFFF'
          }}>
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #25D366 0%, #10B981 100%)',
              color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '2rem',
              boxShadow: '0 8px 24px rgba(37, 211, 102, 0.5)'
            }}>
              ✓
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--gold-bright)', marginBottom: '8px' }}>
              Order Placed Successfully!
            </h2>

            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', margin: '16px 0', border: '1px solid rgba(255,255,255,0.15)' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#34D399', margin: '0 0 4px 0' }}>
                Order #{orderSuccessModal.order_id} • {formatCustomerLocation(orderSuccessModal.table_number)}
              </p>
              <p style={{ fontSize: '0.82rem', color: '#D1D5DB', margin: 0 }}>
                Status: <strong style={{ color: '#FBBF24' }}>Pending Kitchen Acceptance 🟡</strong>
              </p>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#E5E7EB', lineHeight: 1.5, marginBottom: '20px' }}>
              {(() => {
                const activeSpace = (orderSuccessModal?.space_type || currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                const isCin = activeSpace === 'cinema_seat' || activeSpace === 'cinema' || String(orderSuccessModal.table_number).toLowerCase().includes('screen') || String(orderSuccessModal.table_number).toLowerCase().includes('seat');
                const isRoom = activeSpace === 'room' || String(orderSuccessModal.table_number).toLowerCase().includes('room');
                const isCabin = activeSpace === 'cabin' || String(orderSuccessModal.table_number).toLowerCase().includes('cabin');
                if (isCin) return 'Your order has been sent directly to the kitchen terminal! Our staff will prepare and bring it to your seat shortly.';
                if (isRoom) return 'Your order has been sent directly to the kitchen terminal! Our staff will prepare and deliver it to your room shortly.';
                if (isCabin) return 'Your order has been sent directly to the kitchen terminal! Our staff will prepare and deliver it to your cabin shortly.';
                return 'Your order has been sent directly to the kitchen terminal! Our staff will prepare and serve it to your table shortly.';
              })()}
            </p>

            <button
              onClick={() => setOrderSuccessModal(null)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
                color: '#0A2315',
                padding: '14px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 900,
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-gold)'
              }}
            >
              Great, Thanks!
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Dock */}
      <BottomDock
        categoriesCount={categories.length}
        lang={lang}
        onOpenCategories={() => setShowCategoryDrawer(true)}
        onOpenInfo={() => setShowInfoModal(true)}
        onOpenAdmin={() => {
          const targetSlug = getSlugFromUrl() || (info && info.slug) || localStorage.getItem('touchqr_admin_slug') || '';
          const targetUrl = (targetSlug && targetSlug !== 'undefined' && targetSlug !== 'null') ? `/${targetSlug}/admin` : '/admin';
          if (adminToken) {
            setView('admin-dashboard');
            window.history.pushState({}, '', targetUrl);
          } else {
            setView('admin-login');
            window.history.pushState({}, '', targetUrl);
          }
        }}
      />

      {/* Category Selection Drawer */}
      {showCategoryDrawer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 3000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div
            onClick={() => setShowCategoryDrawer(false)}
            style={{ flex: 1 }}
          />

          <div
            style={{
              background: 'var(--bg-app)',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              padding: '20px 16px 30px',
              maxWidth: '800px',
              width: '100%',
              margin: '0 auto',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '80vh',
              overflowY: 'auto',
              borderTop: '3px solid #D4AF37',
              animation: 'fadeIn 0.25s ease-out'
            }}
          >
            {/* Drawer Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="var(--primary-emerald)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                  {lang === 'hi' ? 'मेन्यू श्रेणी (Menu Categories)' : 'Menu Categories'}
                </h3>
              </div>
              <button onClick={() => setShowCategoryDrawer(false)} style={{ color: 'var(--text-dark)', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Category List Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => scrollToCategory('all')}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'left',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  background: selectedCategory === 'all' ? 'var(--primary-emerald)' : 'var(--bg-secondary)',
                  color: selectedCategory === 'all' ? '#FFFFFF' : 'var(--primary-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span>❖ {lang === 'hi' ? 'सभी श्रेणियां (All Items)' : 'All Categories'}</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({dishes.length})</span>
              </button>

              {categories.map((cat) => {
                const catDisplayName = (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name;
                const itemCount = dishes.filter(d => String(d.category_id) === String(cat.id)).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      background: String(selectedCategory) === String(cat.id) ? 'var(--primary-emerald)' : 'var(--bg-secondary)',
                      color: String(selectedCategory) === String(cat.id) ? '#FFFFFF' : 'var(--text-dark)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CategoryImage
                        image={cat.image}
                        name={cat.name}
                        size={28}
                      />
                      <span>{catDisplayName}</span>
                    </div>

                    <span style={{ fontSize: '0.8rem', opacity: 0.8, background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                      {itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Customer Dish Detail Modal */}
      {selectedDishModal && (
        <DishModal
          dish={selectedDishModal}
          lang={lang}
          currencySymbol={info?.currency_symbol !== undefined ? info.currency_symbol : '₹'}
          onAddToCart={isDirectOrderingActive ? handleAddToCart : undefined}
          onClose={() => setSelectedDishModal(null)}
        />
      )}

      {/* Customer Thali / Combo Detail Modal */}
      {selectedComboModal && (
        <ComboModal
          combo={selectedComboModal}
          onClose={() => setSelectedComboModal(null)}
          onAddToCart={isDirectOrderingActive ? handleAddComboToCart : undefined}
          canOrder={isDirectOrderingActive}
          currencySymbol={info?.currency_symbol !== undefined && info?.currency_symbol !== null ? info.currency_symbol : '₹'}
        />
      )}

      {/* Restaurant Information Modal */}
      {showInfoModal && (
        <RestaurantInfoModal
          info={info}
          lang={lang}
          onClose={() => setShowInfoModal(false)}
          onOpenReviewModal={handleRateUsClick}
        />
      )}

      {/* Owner Dish Edit/Add Form Modal */}
      {ownerDishModalData && (
        <DishFormModal
          dish={ownerDishModalData === 'new' ? null : ownerDishModalData}
          categories={categories}
          token={adminToken}
          modifiersEnabled={info?.modifiers_enabled !== false}
          onSave={handleSaveInlineDish}
          onClose={() => setOwnerDishModalData(null)}
        />
      )}

      {/* Owner Category Edit/Add Form Modal */}
      {ownerCatModalData && (
        <CategoryFormModal
          category={ownerCatModalData === 'new' ? null : ownerCatModalData}
          token={adminToken}
          onSave={handleSaveInlineCategory}
          onClose={() => setOwnerCatModalData(null)}
        />
      )}

      {/* Footer */}
      <Footer
        info={info}
        onOpenReviewModal={handleRateUsClick}
        onOpenAdmin={() => {
          const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
          const storedSlug = localStorage.getItem('touchqr_admin_slug');
          if (adminToken && storedSlug && storedSlug === currentSlug) {
            setView('admin-dashboard');
          } else {
            if (storedSlug !== currentSlug) {
              localStorage.removeItem('touchqr_admin_token');
              localStorage.removeItem('touchqr_admin_user');
              localStorage.removeItem('touchqr_admin_slug');
              setAdminToken('');
              setAdminUsername('');
              setAdminSlug('');
            }
            setView('admin-login');
          }
          window.history.pushState({}, '', `/${currentSlug}/admin`);
        }}
      />
    </div>
  );
}

