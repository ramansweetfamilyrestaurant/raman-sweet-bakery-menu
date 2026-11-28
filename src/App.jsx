import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
const EMPTY_CART_SLICE = [];
const useIsomorphicLayoutEffect = (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.requestAnimationFrame === 'function') ? useLayoutEffect : useEffect;
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
import { fetchRestaurantInfo, fetchCategories, fetchDishes, toggleDishAvailability, deleteDish, createDirectOrder, trackOrderStatus, fetchActiveTableOrder, subscribeOrderLiveStream, fetchCombos } from './api/client';
import { LayoutList, Grid, BookOpen, X, Sparkles, ShieldAlert, Phone, Plus, Edit3, Trash2, LogOut, Settings, Crown, CheckCircle, MessageSquare, XCircle } from 'lucide-react';
import ServiceRequestModal from './components/ServiceRequestModal';
import CustomerReviewModal from './components/CustomerReviewModal';
import BillCompletedModal from './components/BillCompletedModal';
import PresenceVerificationModal from './components/PresenceVerificationModal';
import CategoryImage from './components/CategoryImage';
import { resolveImageUrl, getDishImageUrl, getComboImageUrl } from './utils/imageHelper';
import { isValidQrTokenFormat, normalizeSpaceType, normalizeSpaceNumber } from './utils/qrSecurity';
import { resolveTheme, DEFAULT_THEME } from './constants/themes';
import { getCurrencySymbol, formatPriceNumber, formatPrice } from './utils/currencyHelper';
import { getValidDishModifiers } from './utils/billingHelper';
import { roundOfferCurrency } from './utils/offerPricing';
import { triggerHaptic } from './utils/haptics';
import { triggerFlyToCart } from './utils/flyToCart';
import {
  isFlagEnabled,
  isCustomDomainHost,
  parseCustomerSpaceFromLocation,
  isCustomerSpaceValid,
  buildScopedStorageKey
} from './utils/customerHelpers';
import { clearBrowserCachesSafe, tryReserveChunkReload } from './utils/chunkRecovery';

// Robust Lazy Loading with automatic retry on new production deploys
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      const mod = await componentImport();
      if (!mod || !mod.default) {
        throw new Error('Chunk module resolved without default export (stale deploy)');
      }
      return mod;
    } catch (error) {
      console.warn('Chunk loading failed, reloading for updated deploy...', error);
      await clearBrowserCachesSafe();
      if (tryReserveChunkReload() && typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        try {
          window.location.reload();
          return await new Promise((_, reject) => setTimeout(() => reject(error), 3500));
        } catch { }
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
  if (cleanPath === '/kitchen' || cleanPath === 'kitchen') {
    return true;
  }
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
    const { type, num, token } = parseCustomerSpaceFromLocation(window.location.search, window.location.pathname);

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
      else if (type === 'counter') { label = 'Billing Counter'; badge = '⚡ Billing Counter'; }
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

  // Master dietary profile resolution for Pure Veg compliance
  const resolvedFoodType = String(info?.food_type || info?.resto_type || '').trim().toLowerCase();
  const isPureVegResto = info?.is_pure_veg === true ||
    info?.is_pure_veg === 1 ||
    info?.is_pure_veg === '1' ||
    info?.is_pure_veg === 'true' ||
    ['pure_veg', 'veg', 'vegetarian', 'vegan', 'only_veg'].includes(resolvedFoodType) ||
    ['bakery_confectionery', 'sweet_shop'].includes(String(info?.business_type || '').toLowerCase());
  const initialSpaceInfo = getSpaceInfoFromUrl();
  const initialTableNum = initialSpaceInfo.num;
  const [currentTableNum, setCurrentTableNum] = useState(initialSpaceInfo.num);
  const [currentSpaceType, setCurrentSpaceType] = useState(initialSpaceInfo.type);
  const [currentTableToken, setCurrentTableToken] = useState(initialSpaceInfo.token);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isPostBillViewOnly, setIsPostBillViewOnly] = useState(false);
  const [autoKillSeconds, setAutoKillSeconds] = useState(null);
  const [billCompletedModal, setBillCompletedModal] = useState(null);
  const [showRunningOrderModal, setShowRunningOrderModal] = useState(false);
  const [lastCompletedBill, setLastCompletedBill] = useState(null);
  const [completedSpaceSnapshot, setCompletedSpaceSnapshot] = useState(null);
  const handledSettledOrderIdsRef = useRef(new Set());
  const lastActiveTableOrderIdRef = useRef(null);

  const buildViewOnlyUrl = () => {
    const pathSlug = getSlugFromUrl();
    if (pathSlug) return `/${pathSlug}?view=1`;
    return isCustomDomainHost(typeof window !== 'undefined' ? window.location.hostname : '') ? '/?view=1' : ((window.location.pathname || '/') + '?view=1');
  };

  // Validate if the table/space number exists within the restaurant's configured capacity & has valid token shape
  const isSpaceNumberValid = () => {
    const tokenShapeOk = currentTableToken
      ? isValidQrTokenFormat(currentTableToken)
      : initialSpaceInfo.isValidTokenShape;
    return isCustomerSpaceValid({
      currentTableNum,
      currentSpaceType: currentSpaceType || initialSpaceInfo.type,
      hasValidTokenShape: tokenShapeOk,
      info
    });
  };

  const isViewOnlyUrl = Boolean(
    new URLSearchParams(window.location.search).get('view') === '1' ||
    new URLSearchParams(window.location.search).get('view_only') === 'true' ||
    new URLSearchParams(window.location.search).get('mode') === 'view'
  );

  const isTableValid = isSpaceNumberValid();
  // Effective Table Number (Empty if session expired or scanned QR identity is unverified/invalid/out-of-range)
  const effectiveTableNum = (sessionExpired || isPostBillViewOnly || isViewOnlyUrl || !isTableValid) ? '' : currentTableNum;

  const formatCustomerLocation = (raw, overrideSpaceType = null) => {
    const target = raw !== undefined && raw !== null ? String(raw).trim() : String(effectiveTableNum || '').trim();
    if (!target) return '';
    const activeType = (overrideSpaceType || currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
    const isCinema = activeType === 'cinema_seat' || activeType === 'cinema' || target.toLowerCase().includes('screen') || target.toLowerCase().includes('seat');

    if (activeType === 'counter' || target.toLowerCase().includes('counter')) {
      return '🧾 Counter Order';
    }

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

  const getDynamicSpaceLabel = (raw, overrideSpaceType = null) => formatCustomerLocation(raw, overrideSpaceType);

  const hasScannedSpace = Boolean(
    currentTableNum &&
    String(currentTableNum).trim() !== '' &&
    (currentTableToken ? isValidQrTokenFormat(currentTableToken) : initialSpaceInfo.isValidTokenShape) &&
    isTableValid &&
    effectiveTableNum
  );

  // Check if Scanned Space is Paused / Inactive by Admin
  const isCurrentSpacePaused = useMemo(() => {
    if (!info?.inactive_spaces) return false;
    const targetType = currentSpaceType || initialSpaceInfo.type || 'table';
    const targetNum = effectiveTableNum || currentTableNum || initialSpaceInfo.num || '';
    if (!targetNum) return false;
    const key = `${targetType}:${targetNum}`.toLowerCase();
    const inactiveList = String(info.inactive_spaces).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return inactiveList.includes(key);
  }, [info?.inactive_spaces, currentSpaceType, initialSpaceInfo, effectiveTableNum, currentTableNum]);

  // Direct Table Ordering is active ONLY when:
  // 1. Not in view-only URL mode
  // 2. An authenticated Table/Cabin/Room QR code is scanned with valid token (hasScannedSpace)
  // 3. Restaurant has direct_ordering_enabled = 1
  // 4. SaaS Plan permissions allow direct ordering
  // 5. Scanned space is NOT paused by admin (!isCurrentSpacePaused)
  const isDirectOrderingActive = Boolean(
    !isViewOnlyUrl &&
    !isPostBillViewOnly &&
    !isCurrentSpacePaused &&
    hasScannedSpace &&
    info &&
    isFlagEnabled(info.direct_ordering_enabled, false) &&
    isFlagEnabled(info.permissions?.direct_ordering_enabled, true)
  );

  const isCinemaVenue = Boolean(
    info?.business_type === 'cinema_theatre' ||
    info?.service_model === 'cinema' ||
    info?.service_model === 'seat_service' ||
    currentSpaceType === 'cinema_seat' ||
    currentSpaceType === 'cinema' ||
    initialSpaceInfo?.type === 'cinema_seat' ||
    String(currentTableNum || '').toLowerCase().includes('screen') ||
    String(currentTableNum || '').toLowerCase().includes('seat')
  );

  const isHotelVenue = Boolean(
    info?.business_type === 'hotel_resort' ||
    info?.service_model === 'hotel' ||
    info?.service_model === 'in_room_dining' ||
    currentSpaceType === 'room' ||
    initialSpaceInfo?.type === 'room' ||
    String(currentTableNum || '').toLowerCase().includes('room')
  );

  const isCounterSpace = Boolean(
    currentSpaceType === 'counter' ||
    initialSpaceInfo?.type === 'counter' ||
    String(currentTableNum || '').trim().toUpperCase() === 'COUNTER'
  );

  // Language State ('en' or 'hi')
  const [lang, setLang] = useState('en');

  // Network Connectivity State (Online / Offline detection)
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    if (path === '' || path === '/') {
      return isCustomDomainHost(window.location.hostname) ? 'menu' : 'landing';
    }
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
  const adminTokenRef = useRef(adminToken);
  adminTokenRef.current = adminToken;
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
  const [isImpersonating, setIsImpersonating] = useState(() => {
    return localStorage.getItem('touchqr_superadmin_impersonating') === 'true';
  });
  const [impersonatedRestoName, setImpersonatedRestoName] = useState(() => {
    return localStorage.getItem('touchqr_impersonated_resto_name') || '';
  });

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

  const handleExitImpersonation = () => {
    const restoId = localStorage.getItem('touchqr_impersonated_resto_id');
    const currentSuperToken = superToken || localStorage.getItem('touchqr_super_token');
    if (restoId && currentSuperToken) {
      fetch(`/api/superadmin/restaurants/${restoId}/exit-impersonation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentSuperToken}` }
      }).catch(() => { });
    }
    localStorage.removeItem('touchqr_superadmin_impersonating');
    localStorage.removeItem('touchqr_impersonated_resto_name');
    localStorage.removeItem('touchqr_impersonated_resto_id');
    localStorage.removeItem('touchqr_admin_token');
    localStorage.removeItem('touchqr_admin_user');
    localStorage.removeItem('touchqr_admin_slug');
    setIsImpersonating(false);
    setImpersonatedRestoName('');
    setAdminToken('');
    setAdminUsername('');
    setAdminSlug('');
    setView('super-admin-dashboard');
    window.history.pushState({}, '', '/superadmin');
  };

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

  // Menu Data State
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Reset dietary filter if switching to pure veg restaurant
  useEffect(() => {
    if (isPureVegResto && (activeQuickFilter === 'nonveg' || activeQuickFilter === 'egg')) {
      setActiveQuickFilter('');
    }
  }, [isPureVegResto, activeQuickFilter]);

  // Modals
  const [selectedDishModal, setSelectedDishModal] = useState(null);
  const [selectedDishInitialPortion, setSelectedDishInitialPortion] = useState(null);
  const [selectedDishModalMode, setSelectedDishModalMode] = useState('detail');
  const openDishCustomizationModal = useCallback((dish, initialPortion = null, modalMode = 'detail') => {
    setSelectedDishInitialPortion(initialPortion || null);
    setSelectedDishModalMode(modalMode === 'addon' ? 'addon' : 'detail');
    setSelectedDishModal(dish);
  }, []);
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
        .catch(() => { });
    }
  }, []);

  // In-Context Owner Modals State
  const [ownerDishModalData, setOwnerDishModalData] = useState(null); // null, 'new', or dish object
  const [ownerCatModalData, setOwnerCatModalData] = useState(null); // null, 'new', or cat object

  // WhatsApp Direct Order Cart State & Handlers
  const [cartItems, setCartItems] = useState([]);
  const [combos, setCombos] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  const handleAddToCart = useCallback((dish, portionType = 'full', selectedModifiers = [], quantity = 1, sourceEl = null) => {
    if (!dish || !isFlagEnabled(dish.available, true)) return;
    triggerHaptic('success');
    if (sourceEl) {
      triggerFlyToCart({ sourceEl, imageSrc: getDishImageUrl(dish.image) });
    }
    const addQty = Math.min(99, Math.max(1, parseInt(quantity, 10) || 1));
    const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
    const isHalf = portionType === 'half' && hasHalfPrice;

    // Explicit portion label for clear Kitchen KOT receipt printing
    let portionName = '';
    if (hasHalfPrice) {
      portionName = isHalf ? (dish.portion_half_label || 'Half') : (dish.portion_full_label || 'Full');
    } else if (dish.portion && dish.portion.trim() !== '') {
      portionName = dish.portion.trim();
    }

    const regularBasePrice = roundOfferCurrency(isHalf ? (Number(dish.price_half) || 0) : (Number(dish.price) || 0));
    let effectiveBasePrice = regularBasePrice;
    if ((dish.offer_price !== undefined && dish.offer_price !== null && dish.offer_price !== '') && Number(dish.offer_price) < Number(dish.price) && !isHalf) {
      effectiveBasePrice = roundOfferCurrency(Number(dish.offer_price) || 0);
    }

    const normalizedMods = Array.isArray(selectedModifiers) ? selectedModifiers : [];
    const extraPrice = normalizedMods.reduce((acc, m) => acc + (Number(m.price) || 0), 0);
    const unitPrice = roundOfferCurrency(effectiveBasePrice + extraPrice);
    const regularUnitPrice = roundOfferCurrency(regularBasePrice + extraPrice);
    const discountAmount = Math.max(0, roundOfferCurrency(regularUnitPrice - unitPrice));

    // Unique cart key including selected modifiers
    const modKey = normalizedMods.map(m => m.name).sort().join('_');
    const cartKey = `${dish.id}_${portionName || 'regular'}${modKey ? '_' + modKey : ''}`;

    setCartItems(prev => {
      const existingIndex = prev.findIndex(i => (i.key || i.dish?.id) === cartKey);
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: Math.min(99, (Number(item.quantity) || 0) + addQty) }
            : item
        );
      }
      return [...prev, {
        key: cartKey,
        dish,
        portion: portionName,
        portion_type: isHalf ? 'half' : 'full',
        modifiers: normalizedMods,
        price: unitPrice,
        regular_price: regularUnitPrice,
        discount_amount: discountAmount,
        offer_id: dish.offer_id || null,
        quantity: addQty
      }];
    });
  }, []);

  const handleAddComboToCart = (combo, sourceEl = null) => {
    triggerHaptic('success');
    if (sourceEl) {
      triggerFlyToCart({ sourceEl, imageSrc: getComboImageUrl(combo.image), fallbackSrc: '/images/default-combo.webp?v=3' });
    }
    let comboItems = [];
    try { comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []); } catch { comboItems = []; }
    const includesText = comboItems.map(i => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.dish_name}${i.portion === 'half' ? ' (H)' : ''}`).join(' + ');
    const cartKey = `combo_${combo.id}`;
    const regularPrice = roundOfferCurrency(Number(combo.price) || 0);
    const effectivePrice = (combo.offer_price !== undefined && combo.offer_price !== null && combo.offer_price !== '' && Number(combo.offer_price) < Number(combo.price))
      ? roundOfferCurrency(Number(combo.offer_price) || 0)
      : regularPrice;
    const discountAmount = Math.max(0, roundOfferCurrency(regularPrice - effectivePrice));

    setCartItems(prev => {
      const existingIndex = prev.findIndex(i => (i.key || i.dish?.id) === cartKey);
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: Math.min(99, (Number(item.quantity) || 0) + 1) }
            : item
        );
      }
      return [...prev, {
        key: cartKey,
        dish: { id: `combo_${combo.id}`, name: combo.name, image: combo.image },
        portion: 'Combo',
        price: effectivePrice,
        regular_price: regularPrice,
        discount_amount: discountAmount,
        offer_id: combo.offer_id || null,
        quantity: 1,
        isCombo: true,
        comboIncludes: includesText
      }];
    });
  };

  const handleRemoveFromCart = (cartKey) => {
    triggerHaptic('light');
    setCartItems(prev => prev.filter(i => (i.key || i.dish?.id) !== cartKey));
  };

  const handleUpdateCartQuantity = useCallback((cartKey, delta) => {
    triggerHaptic('light');
    setCartItems(prev => prev.reduce((acc, item) => {
      if ((item.key || item.dish?.id) !== cartKey) {
        acc.push(item);
        return acc;
      }
      const nextQty = (Number(item.quantity) || 0) + delta;
      if (nextQty > 0) {
        acc.push({ ...item, quantity: Math.min(99, nextQty) });
      }
      return acc;
    }, []));
  }, []);

  const cartItemsByDishId = useMemo(() => {
    const map = new Map();
    for (const item of cartItems) {
      if (item.isCombo || (Array.isArray(item.modifiers) && item.modifiers.length > 0)) continue;
      const did = String(item.dish?.id || '');
      if (!did) continue;
      const arr = map.get(did);
      if (arr) arr.push(item);
      else map.set(did, [item]);
    }
    return map;
  }, [cartItems]);

  const handleClearCart = () => {
    triggerHaptic('light');
    setCartItems([]);
    setOrderNotesInput('');
  };

  const [orderTableInput, setOrderTableInput] = useState(initialTableNum || '1');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [orderNotesInput, setOrderNotesInput] = useState('');
  const [orderTypeChoice, setOrderTypeChoice] = useState(() => (currentSpaceType === 'counter' ? 'takeaway' : 'dine_in'));

  useEffect(() => {
    if (isCinemaVenue || isHotelVenue) {
      setOrderTypeChoice('dine_in');
    } else if (isCounterSpace) {
      setOrderTypeChoice('takeaway');
    }
  }, [isCinemaVenue, isHotelVenue, isCounterSpace]);
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const isPlacingOrderRef = useRef(false);

  // Lock background scroll & close bottom drawers / confirmation modal on Escape
  useEffect(() => {
    if (!showCategoryDrawer && !showCartDrawer && !orderSuccessModal && !showRunningOrderModal) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setShowCategoryDrawer(false);
        setShowCartDrawer(false);
        setOrderSuccessModal(null);
        setShowRunningOrderModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [showCategoryDrawer, showCartDrawer, orderSuccessModal, showRunningOrderModal]);

  const handleSendWhatsAppOrder = () => {
    if (!info || cartItems.length === 0) return;
    const rawPhone = info.whatsapp_number || info.phone || '';
    const phone = rawPhone.replace(/[^0-9]/g, '');
    if (!phone) {
      alert('WhatsApp number is not configured for this business yet.');
      return;
    }
    const locationText = getDynamicSpaceLabel() || (effectiveTableNum ? formatCustomerLocation(effectiveTableNum) : '');
    let msg = locationText
      ? `👋 Hello *${info.name}*!\nI would like to place an order from ${locationText}:\n\n`
      : `👋 Hello *${info.name}*!\nI would like to place an order:\n\n`;
    let grandTotal = 0;
    const sym = getCurrencySymbol(info?.currency_symbol);
    cartItems.forEach(item => {
      const itemPrice = item.price * item.quantity;
      grandTotal += itemPrice;
      const portionText = item.portion ? ` (${item.portion})` : '';
      const modText = (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0)
        ? `\n   ↳ Add-ons: ${item.modifiers.map(m => `+${m.name} (+${sym}${m.price})`).join(', ')}`
        : '';
      const comboText = (item.isCombo && item.comboIncludes)
        ? `\n   ↳ Included: ${item.comboIncludes}`
        : '';
      msg += `• ${item.quantity}x *${item.dish.name}${portionText}* - ${sym}${formatPriceNumber(itemPrice)}${comboText}${modText}\n`;
    });
    const isGst = isFlagEnabled(info?.gst_enabled, false);
    if (isGst) {
      const cgst = Math.round(grandTotal * 0.025 * 100) / 100;
      const sgst = Math.round(grandTotal * 0.025 * 100) / 100;
      const finalWithGst = Math.round((grandTotal + cgst + sgst) * 100) / 100;
      msg += `\n*Subtotal:* ${sym}${formatPriceNumber(grandTotal)}`;
      msg += `\n*GST (5%):* ${sym}${formatPriceNumber(cgst + sgst)}`;
      msg += `\n*Grand Total:* ${sym}${formatPriceNumber(finalWithGst)}`;
    } else {
      msg += `\n*Total Amount:* ${sym}${formatPriceNumber(grandTotal)}`;
    }
    if (customerNameInput) {
      msg += `\n👤 *Customer Name:* ${customerNameInput}`;
    }
    if (customerPhoneInput) {
      msg += `\n📞 *Customer Phone:* ${customerPhoneInput}`;
    }
    const cleanWaNotes = String(orderNotesInput || '').trim().slice(0, 240);
    if (cleanWaNotes) {
      msg += `\n📝 *Cooking Note:* ${cleanWaNotes}`;
    }
    msg += `\n\nThank you!`;
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  useEffect(() => {
    if (currentSpaceType === 'counter') {
      setOrderTypeChoice('takeaway');
    }
  }, [currentSpaceType]);

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

  const getActiveStorageTenantSlug = () => {
    return getSlugFromUrl() || (info && info.slug) || '';
  };

  // FIX: Tenant + space scoped localStorage key (waits for resolved tenant slug)
  const getOrderStorageKey = (tbl, sType) => {
    const t = tbl || effectiveTableNum || orderTableInput;
    const tenantSlug = getActiveStorageTenantSlug();
    if (!t || !tenantSlug) return null;
    return buildScopedStorageKey('touchqr_active_order_id', {
      slug: tenantSlug,
      spaceType: sType || currentSpaceType || initialSpaceInfo.type || 'table',
      tableNumber: t
    });
  };

  const getInitialActiveOrderId = () => {
    const initialSlug = getSlugFromUrl();
    if (initialTableNum && initialSlug) {
      const key = buildScopedStorageKey('touchqr_active_order_id', {
        slug: initialSlug,
        spaceType: initialSpaceInfo.type || 'table',
        tableNumber: initialTableNum
      });
      return (key && localStorage.getItem(key)) || null;
    }
    return null;
  };

  const [activeOrderId, setActiveOrderId] = useState(getInitialActiveOrderId);
  const [activeOrderTrack, setActiveOrderTrack] = useState(null);
  const trackingExpiredRef = useRef(false);
  const restoredTenantOrderRef = useRef(getSlugFromUrl() || '');
  const restoredCompletedBillSlugRef = useRef('');
  const completedBillMetaRef = useRef(null);
  const [restoredOrderSlug, setRestoredOrderSlug] = useState(() => getSlugFromUrl() || '');
  const COMPLETED_BILL_TTL_MS = 2 * 60 * 60 * 1000;

  const getCompletedBillStorageKey = (tenantSlugVal) => {
    const cleanSlug = String(tenantSlugVal || getActiveStorageTenantSlug() || '').trim().toLowerCase();
    return cleanSlug ? `touchqr_last_completed_bill_${cleanSlug}` : null;
  };

  const getCompletedBillIdentity = (bill) => {
    if (!bill || typeof bill !== 'object' || Array.isArray(bill)) return '';
    return String(bill.id || bill.bill_summary?.order_id || bill.order_id || '').trim();
  };

  const getCompletedBillStorages = () => ([
    typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    typeof localStorage !== 'undefined' ? localStorage : null
  ].filter(Boolean));

  const parseCompletedBillSlot = (rawStr) => {
    if (rawStr === null || rawStr === undefined) {
      return { present: false, hasValidShape: false, parsed: null, savedAtMs: NaN };
    }
    try {
      const parsed = JSON.parse(rawStr);
      const hasValidShape = Boolean(
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        parsed.bill &&
        typeof parsed.bill === 'object' &&
        !Array.isArray(parsed.bill)
      );
      const savedAtMs = hasValidShape ? Number(parsed.savedAt) : NaN;
      return { present: true, hasValidShape, parsed, savedAtMs };
    } catch {
      return { present: true, hasValidShape: false, parsed: null, savedAtMs: NaN };
    }
  };

  const persistLastCompletedBill = (tenantSlugVal, billPayload, reuseSnapshot = null, savedAtOverride = null, matchMeta = null) => {
    const resolvedSlug = String(tenantSlugVal || getActiveStorageTenantSlug() || '').trim().toLowerCase();
    const key = getCompletedBillStorageKey(resolvedSlug);
    if (!billPayload) {
      completedBillMetaRef.current = null;
      if (!key) return;
      for (const store of getCompletedBillStorages()) {
        try {
          if (!matchMeta) {
            store.removeItem(key);
            continue;
          }
          const raw = store.getItem(key);
          const slot = parseCompletedBillSlot(raw);
          if (!slot.present) continue;
          const matchesExpiredReceipt = Boolean(
            slot.hasValidShape &&
            getCompletedBillIdentity(slot.parsed.bill) === String(matchMeta.orderId || '') &&
            Number(slot.savedAtMs) === Number(matchMeta.savedAt)
          );
          if (!slot.hasValidShape || matchesExpiredReceipt) {
            store.removeItem(key);
          }
        } catch (e) { }
      }
      return;
    }

    const savedAtMs = Number(savedAtOverride) || Date.now();
    completedBillMetaRef.current = {
      tenantSlug: resolvedSlug,
      savedAt: savedAtMs,
      orderId: getCompletedBillIdentity(billPayload)
    };
    if (!key) return;
    try {
      const record = JSON.stringify({
        bill: billPayload,
        reuseSnapshot: reuseSnapshot || null,
        savedAt: savedAtMs
      });
      for (const store of getCompletedBillStorages()) {
        store.setItem(key, record);
      }
    } catch (e) { }
  };

  const readStoredCompletedBillRecord = (tenantSlugVal, { pruneInvalidOrExpired = false } = {}) => {
    const cleanSlug = String(tenantSlugVal || getActiveStorageTenantSlug() || '').trim().toLowerCase();
    const compKey = getCompletedBillStorageKey(cleanSlug);
    if (!compKey) return { compKey: null, tenantSlug: '', parsed: null, savedAtMs: NaN };

    let chosen = null;
    for (const store of getCompletedBillStorages()) {
      try {
        const slot = parseCompletedBillSlot(store.getItem(compKey));
        if (!slot.present) continue;
        const ageMs = Number.isFinite(slot.savedAtMs) && slot.savedAtMs > 0 ? (Date.now() - slot.savedAtMs) : NaN;
        const isRecent = Boolean(slot.hasValidShape && Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= COMPLETED_BILL_TTL_MS);
        if (!slot.hasValidShape || (pruneInvalidOrExpired && !isRecent)) {
          store.removeItem(compKey);
          continue;
        }
        if (!chosen && (!pruneInvalidOrExpired || isRecent)) {
          chosen = slot;
        }
      } catch (e) {
        try { store.removeItem(compKey); } catch { }
      }
    }

    return {
      compKey,
      tenantSlug: cleanSlug,
      parsed: chosen?.parsed || null,
      savedAtMs: chosen ? chosen.savedAtMs : NaN
    };
  };

  // Restore saved order & recent completed receipt once tenant slug resolves (path-slug & custom-domain URLs)
  useEffect(() => {
    const tenantSlug = getActiveStorageTenantSlug();
    if (!tenantSlug || sessionExpired) return;
    let restoredActiveOrder = activeOrderId;
    if (restoredTenantOrderRef.current !== tenantSlug) {
      restoredTenantOrderRef.current = tenantSlug;
      if (initialTableNum && !activeOrderId) {
        const key = buildScopedStorageKey('touchqr_active_order_id', {
          slug: tenantSlug,
          spaceType: initialSpaceInfo.type || 'table',
          tableNumber: initialTableNum
        });
        const savedOrderId = key ? localStorage.getItem(key) : null;
        if (savedOrderId) {
          restoredActiveOrder = savedOrderId;
          setActiveOrderId(savedOrderId);
        }
      }
    }
    if (restoredCompletedBillSlugRef.current !== tenantSlug) {
      restoredCompletedBillSlugRef.current = tenantSlug;
      if (!restoredActiveOrder && !lastCompletedBill) {
        const { tenantSlug: ownerSlug, parsed: parsedCompleted, savedAtMs } = readStoredCompletedBillRecord(tenantSlug, { pruneInvalidOrExpired: true });
        if (parsedCompleted?.bill) {
          completedBillMetaRef.current = {
            tenantSlug: ownerSlug,
            savedAt: savedAtMs,
            orderId: getCompletedBillIdentity(parsedCompleted.bill)
          };
          setLastCompletedBill(parsedCompleted.bill);
          if (parsedCompleted.reuseSnapshot) {
            setCompletedSpaceSnapshot(parsedCompleted.reuseSnapshot);
          } else if (isViewOnlyUrl) {
            setIsPostBillViewOnly(true);
          }
        }
      }
    }
    if (restoredOrderSlug !== tenantSlug) {
      setRestoredOrderSlug(tenantSlug);
    }
  }, [info?.slug, sessionExpired]);

  // Live auto-expiry for in-memory completed e-bill (covers open/suspended mobile tabs past 2h without refresh)
  useEffect(() => {
    const activeBill = lastCompletedBill || billCompletedModal;
    if (!activeBill) return;

    let isEffectActive = true;
    let expiryTimer = null;

    const resolveActiveBillMeta = () => {
      const currentMeta = completedBillMetaRef.current;
      const activeBillOrderId = getCompletedBillIdentity(activeBill);
      if (
        currentMeta &&
        Number.isFinite(currentMeta.savedAt) &&
        currentMeta.savedAt > 0 &&
        (!activeBillOrderId || !currentMeta.orderId || currentMeta.orderId === activeBillOrderId)
      ) {
        return currentMeta;
      }
      const fallbackSlug = String(currentMeta?.tenantSlug || getActiveStorageTenantSlug() || '').trim().toLowerCase();
      const { parsed, savedAtMs } = readStoredCompletedBillRecord(fallbackSlug);
      const resolvedMeta = {
        tenantSlug: fallbackSlug,
        savedAt: Number.isFinite(savedAtMs) && savedAtMs > 0 ? savedAtMs : Date.now(),
        orderId: activeBillOrderId || getCompletedBillIdentity(parsed?.bill)
      };
      completedBillMetaRef.current = resolvedMeta;
      return resolvedMeta;
    };

    const scheduleNextExpiry = (delayMs) => {
      if (!isEffectActive) return;
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => {
        if (isEffectActive) expireCompletedBillIfDue();
      }, Math.min(Math.max(1000, delayMs), 2147483647));
    };

    const expireCompletedBillIfDue = () => {
      if (!isEffectActive) return true;
      const meta = resolveActiveBillMeta();
      const elapsed = Date.now() - meta.savedAt;
      if (Number.isFinite(elapsed) && elapsed >= COMPLETED_BILL_TTL_MS) {
        completedBillMetaRef.current = null;
        setLastCompletedBill(null);
        setBillCompletedModal(null);
        setCompletedSpaceSnapshot(null);
        setIsPostBillViewOnly(false);
        persistLastCompletedBill(meta.tenantSlug, null, null, null, {
          orderId: meta.orderId,
          savedAt: meta.savedAt
        });
        return true;
      }
      const nextRemainingMs = Number.isFinite(elapsed)
        ? (COMPLETED_BILL_TTL_MS - elapsed + 50)
        : COMPLETED_BILL_TTL_MS;
      scheduleNextExpiry(nextRemainingMs);
      return false;
    };

    if (expireCompletedBillIfDue()) return;

    const handleWakeupExpiry = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        expireCompletedBillIfDue();
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', handleWakeupExpiry);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleWakeupExpiry);
    }

    return () => {
      isEffectActive = false;
      if (expiryTimer) clearTimeout(expiryTimer);
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('focus', handleWakeupExpiry);
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', handleWakeupExpiry);
      }
    };
  }, [lastCompletedBill, billCompletedModal, info?.slug]);

  useEffect(() => {
    trackingExpiredRef.current = false;
  }, [activeOrderId]);

  // Post-Bill Receipt Trigger (completed/settled) vs 5-Second Auto-Kill (cancelled/rejected)
  useEffect(() => {
    if (!activeOrderTrack) {
      setAutoKillSeconds(null);
      return;
    }

    const trackStatus = String(activeOrderTrack.status || '').toLowerCase();
    const isCancelledOrRejected = trackStatus === 'cancelled' || trackStatus === 'rejected';
    const isBillSettled = !isCancelledOrRejected && Boolean(
      trackStatus === 'completed' ||
      activeOrderTrack.is_settled === 1 ||
      activeOrderTrack.is_settled === '1' ||
      activeOrderTrack.is_settled === true
    );

    if (isBillSettled) {
      const orderIdKey = String(activeOrderTrack.id || '');
      if (orderIdKey && handledSettledOrderIdsRef.current.has(orderIdKey)) {
        return;
      }
      if (orderIdKey) {
        handledSettledOrderIdsRef.current.add(orderIdKey);
        localStorage.removeItem(`touchqr_order_completed_time_${orderIdKey}`);
        try {
          sessionStorage.removeItem(`tq_track_${orderIdKey}`);
          localStorage.removeItem(`tq_track_${orderIdKey}`);
          sessionStorage.removeItem(`tq_obs_${orderIdKey}`);
          localStorage.removeItem(`tq_obs_${orderIdKey}`);
          sessionStorage.removeItem('tq_active_tracking_token');
          sessionStorage.removeItem('tq_active_observer_token');
        } catch (e) { }
      }
      lastActiveTableOrderIdRef.current = null;

      const resolvedType = activeOrderTrack.space_type || currentSpaceType || initialSpaceInfo.type || 'table';
      const canReuseForOrderAgain = Boolean(
        resolvedType === 'counter' ||
        resolvedType === 'room' ||
        resolvedType === 'cinema_seat' ||
        resolvedType === 'cinema' ||
        isCounterSpace ||
        isHotelVenue ||
        isCinemaVenue
      );
      const tokenForReuse = currentTableToken || initialSpaceInfo.token || '';
      const numForReuse = currentTableNum || activeOrderTrack.table_number || '';
      const reuseSnapshot = (canReuseForOrderAgain && numForReuse && tokenForReuse)
        ? {
          num: numForReuse,
          type: resolvedType,
          token: tokenForReuse
        }
        : null;
      setCompletedSpaceSnapshot(reuseSnapshot);

      const billPayload = {
        ...activeOrderTrack,
        spaceLabelSnapshot: getDynamicSpaceLabel(activeOrderTrack.table_number, resolvedType) || getDynamicSpaceLabel()
      };
      setLastCompletedBill(billPayload);
      setBillCompletedModal(billPayload);
      setOrderSuccessModal(null);
      setShowRunningOrderModal(false);
      persistLastCompletedBill(getActiveStorageTenantSlug(), billPayload, reuseSnapshot);

      // Silently clean active table lock & cart so next guest stays isolated, and lock Dine-In page into View-Only mode
      const key = getOrderStorageKey(activeOrderTrack.table_number, resolvedType);
      if (key) localStorage.removeItem(key);
      const tenantSlug = getActiveStorageTenantSlug();
      if (tenantSlug && numForReuse) {
        const scanKey = buildScopedStorageKey('touchqr_table_scan_time', {
          slug: tenantSlug,
          spaceType: resolvedType,
          tableNumber: numForReuse
        });
        if (scanKey) localStorage.removeItem(scanKey);
        const obsKey = buildScopedStorageKey('touchqr_observer_token', {
          slug: tenantSlug,
          spaceType: resolvedType,
          tableNumber: numForReuse
        });
        if (obsKey) localStorage.removeItem(obsKey);
        const lastObsKey = buildScopedStorageKey('touchqr_last_observed_order_id', {
          slug: tenantSlug,
          spaceType: resolvedType,
          tableNumber: numForReuse
        });
        if (lastObsKey) {
          localStorage.removeItem(lastObsKey);
          try { sessionStorage.removeItem(lastObsKey); } catch (e) { }
        }
      }
      setActiveOrderId(null);
      setActiveOrderTrack(null);
      setCurrentTableNum('');
      setCurrentTableToken('');
      setSessionExpired(false);
      setIsPostBillViewOnly(!canReuseForOrderAgain);
      setAutoKillSeconds(null);
      setCartItems([]);
      setShowCartDrawer(false);
      const pathSlug = getSlugFromUrl();
      const targetUrl = !canReuseForOrderAgain
        ? buildViewOnlyUrl()
        : (pathSlug ? `/${pathSlug}` : (window.location.pathname || '/'));
      window.history.replaceState({}, '', targetUrl);
      return;
    }

    if (!isCancelledOrRejected) {
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
        // Auto-kill session cleanly after 5 seconds for cancelled/rejected orders
        const key = getOrderStorageKey(activeOrderTrack.table_number, activeOrderTrack.space_type || currentSpaceType);
        if (key) localStorage.removeItem(key);
        localStorage.removeItem(timeKey);
        setActiveOrderId(null);
        setActiveOrderTrack(null);
        setCurrentTableNum('');
        setSessionExpired(true);
        setAutoKillSeconds(null);
        setCartItems([]);
        setShowCartDrawer(false);
        setShowRunningOrderModal(false);
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
  }, [activeOrderTrack?.status, activeOrderTrack?.is_settled, activeOrderTrack?.id]);

  // 3-Minute Inactivity Auto-Kill for Table QR Scanned Customers who haven't placed an order
  useEffect(() => {
    const tenantSlug = getActiveStorageTenantSlug();
    const isOrderRestorationComplete = Boolean(
      tenantSlug &&
      restoredTenantOrderRef.current === tenantSlug &&
      restoredOrderSlug === tenantSlug
    );
    if (!isOrderRestorationComplete || !effectiveTableNum || sessionExpired || isPostBillViewOnly || isViewOnlyUrl || activeOrderId || lastActiveTableOrderIdRef.current || (activeOrderTrack && ['pending', 'ordered', 'accepted', 'kitchen', 'preparing', 'ready', 'served'].includes(String(activeOrderTrack.status || '').toLowerCase()))) {
      return;
    }

    const activeOrderKey = getOrderStorageKey(effectiveTableNum, currentSpaceType || initialSpaceInfo.type);
    if (activeOrderKey && localStorage.getItem(activeOrderKey)) {
      return;
    }

    const scanTimeKey = buildScopedStorageKey('touchqr_table_scan_time', {
      slug: tenantSlug,
      spaceType: currentSpaceType || initialSpaceInfo.type || 'table',
      tableNumber: effectiveTableNum
    });
    if (!scanTimeKey) return;
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
        setShowRunningOrderModal(false);
        const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
        const cleanPath = currentSlug ? `/${currentSlug}` : '/';
        window.history.replaceState({}, '', cleanPath);
      }
    };

    checkInactivity();
    const timer = setInterval(checkInactivity, 1000);
    return () => clearInterval(timer);
  }, [info?.slug, restoredOrderSlug, effectiveTableNum, activeOrderId, activeOrderTrack?.status, sessionExpired]);

  // Multi-Device Table-Level Live Sync Effect (Only runs if table QR code scanned OR order active in session)
  useEffect(() => {
    if (!effectiveTableNum && !activeOrderId) {
      setActiveOrderTrack(null);
      return;
    }

    let isCurrentEffect = true;
    const currentSlug = getSlugFromUrl() || (info && info.slug) || '';

    const readStoredObserverToken = (orderKeyId, spaceType) => {
      try {
        const storageSlug = currentSlug || getActiveStorageTenantSlug();
        const scopedObsKey = storageSlug
          ? buildScopedStorageKey('touchqr_observer_token', {
            slug: storageSlug,
            spaceType: spaceType || 'table',
            tableNumber: effectiveTableNum
          })
          : null;
        return (
          (orderKeyId && typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`tq_obs_${orderKeyId}`)) ||
          (orderKeyId && typeof localStorage !== 'undefined' && localStorage.getItem(`tq_obs_${orderKeyId}`)) ||
          (scopedObsKey && typeof localStorage !== 'undefined' && localStorage.getItem(scopedObsKey)) ||
          (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('tq_active_observer_token')) ||
          ''
        );
      } catch (e) {
        return '';
      }
    };

    const getObservedOrderStorageKey = (spaceType) => {
      const storageSlug = currentSlug || getActiveStorageTenantSlug();
      if (!storageSlug || !effectiveTableNum) return null;
      return buildScopedStorageKey('touchqr_last_observed_order_id', {
        slug: storageSlug,
        spaceType: spaceType || 'table',
        tableNumber: effectiveTableNum
      });
    };

    const readStoredObservedOrderId = (spaceType) => {
      try {
        const obsOrderKey = getObservedOrderStorageKey(spaceType);
        if (!obsOrderKey) return '';
        return (
          (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(obsOrderKey)) ||
          (typeof localStorage !== 'undefined' && localStorage.getItem(obsOrderKey)) ||
          ''
        );
      } catch (e) {
        return '';
      }
    };

    const persistStoredObservedOrderId = (orderIdVal, spaceType) => {
      if (!orderIdVal) return;
      try {
        const obsOrderKey = getObservedOrderStorageKey(spaceType);
        if (!obsOrderKey) return;
        const cleanVal = String(orderIdVal);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(obsOrderKey, cleanVal);
        if (typeof localStorage !== 'undefined') localStorage.setItem(obsOrderKey, cleanVal);
      } catch (e) { }
    };

    const persistStoredObserverToken = (tok, orderIds = [], spaceType) => {
      if (!tok) return;
      try {
        orderIds.filter(Boolean).forEach((oid) => {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(`tq_obs_${oid}`, tok);
          if (typeof localStorage !== 'undefined') localStorage.setItem(`tq_obs_${oid}`, tok);
        });
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('tq_active_observer_token', tok);
        const storageSlug = currentSlug || getActiveStorageTenantSlug();
        const scopedObsKey = storageSlug
          ? buildScopedStorageKey('touchqr_observer_token', {
            slug: storageSlug,
            spaceType: spaceType || 'table',
            tableNumber: effectiveTableNum
          })
          : null;
        if (scopedObsKey && typeof localStorage !== 'undefined') {
          localStorage.setItem(scopedObsKey, tok);
        }
      } catch (e) { }
    };

    const checkTableStatus = async () => {
      try {
        if (!isCurrentEffect) {
          return;
        }
        if (trackingExpiredRef.current) {
          return;
        }
        let trackRequestFailed = false;
        if (activeOrderId) {
          let trackingToken = '';
          let trackObserverToken = '';
          try {
            trackingToken = typeof sessionStorage !== 'undefined'
              ? (sessionStorage.getItem(`tq_track_${activeOrderId}`) || localStorage.getItem(`tq_track_${activeOrderId}`) || sessionStorage.getItem('tq_active_tracking_token') || '')
              : '';
            trackObserverToken = readStoredObserverToken(activeOrderId, currentSpaceType || initialSpaceInfo.type || 'table');
            const data = await trackOrderStatus(activeOrderId, currentSlug, trackingToken, trackObserverToken);
            if (!isCurrentEffect) return;
            if (data) {
              const dStatus = String(data.status || '').toLowerCase();
              const isDTerminal = Boolean(
                data.is_settled === 1 ||
                data.is_settled === '1' ||
                data.is_settled === true ||
                ['completed', 'cancelled', 'rejected', 'expired'].includes(dStatus)
              );
              if (!isDTerminal) {
                lastActiveTableOrderIdRef.current = String(data.id || activeOrderId);
              }
              setActiveOrderTrack(data);
              return;
            }
          } catch (trackErr) {
            if (!isCurrentEffect) return;
            // Order tracking expired (410) -> clean up stored token, halt polling, and preserve order status
            if (trackErr?.status === 410 || trackErr?.message?.includes('expired') || trackErr?.error === 'tracking_expired') {
              try {
                sessionStorage.removeItem(`tq_track_${activeOrderId}`);
                localStorage.removeItem(`tq_track_${activeOrderId}`);
                if (sessionStorage.getItem('tq_active_tracking_token') === trackingToken) {
                  sessionStorage.removeItem('tq_active_tracking_token');
                }
              } catch (e) { }
              trackingExpiredRef.current = true;
              setActiveOrderTrack(prev => {
                if (prev) {
                  return { ...prev, tracking_expired: true };
                }
                return { id: activeOrderId, status: 'expired', tracking_expired: true };
              });
              return;
            }
            // Order was rejected or purged by admin -> show cancelled state
            if (trackErr?.message?.includes('not found') || trackErr?.status === 404 || String(trackErr).includes('404')) {
              setActiveOrderTrack({
                id: activeOrderId,
                status: 'cancelled',
                table_number: effectiveTableNum
              });
              return;
            }
            if (!trackErr?.status || trackErr.status >= 500 || trackErr.isTimeout) {
              trackRequestFailed = true;
            }
          }
        }
        if (!isCurrentEffect) return;
        // Multi-device table sync ONLY if table QR code was scanned
        if (effectiveTableNum && !sessionExpired && !isPostBillViewOnly && !isViewOnlyUrl) {
          const effectiveQrToken = currentTableToken || initialSpaceInfo.token || (new URLSearchParams(window.location.search).get('tkn') || '').trim();
          const targetSpaceType = currentSpaceType || initialSpaceInfo.type || 'table';
          const prevTrackedId = lastActiveTableOrderIdRef.current || activeOrderId || readStoredObservedOrderId(targetSpaceType) || '';
          const observerToken = readStoredObserverToken(prevTrackedId, targetSpaceType);
          let trackingToken = '';
          try {
            if (prevTrackedId) {
              trackingToken =
                (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`tq_track_${prevTrackedId}`) : '') ||
                (typeof localStorage !== 'undefined' ? localStorage.getItem(`tq_track_${prevTrackedId}`) : '') ||
                (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tq_active_tracking_token') : '') ||
                '';
            }
          } catch (e) { }
          if (effectiveQrToken) {
            const tableData = await fetchActiveTableOrder(
              currentSlug,
              effectiveTableNum,
              effectiveQrToken,
              targetSpaceType,
              prevTrackedId,
              { observerToken, trackingToken }
            );
            if (!isCurrentEffect) return;
            if (tableData) {
              if (tableData.session_observer_token) {
                persistStoredObserverToken(
                  tableData.session_observer_token,
                  [tableData.id, tableData.latest_order_id],
                  targetSpaceType
                );
              }
              const tdStatus = String(tableData.status || '').toLowerCase();
              const isTdTerminal = Boolean(
                tableData.is_settled === 1 ||
                tableData.is_settled === '1' ||
                tableData.is_settled === true ||
                ['completed', 'cancelled', 'rejected'].includes(tdStatus)
              );
              if (!isTdTerminal) {
                const observedId = String(tableData.latest_order_id || tableData.id);
                lastActiveTableOrderIdRef.current = observedId;
                persistStoredObservedOrderId(observedId, targetSpaceType);
              }
              setActiveOrderTrack(tableData);
            } else {
              // If activeOrderId tracking suffered a transient network/5xx/auth error, do not immediately expire the live session into a red alert banner
              if (activeOrderId && trackRequestFailed) {
                return;
              }
              // Only force View-Only lock when THIS session actually had a live tracked order that ended; otherwise just clear ancient stale localStorage ID
              if (lastActiveTableOrderIdRef.current && !isCounterSpace && !isHotelVenue && !isCinemaVenue && targetSpaceType !== 'counter' && targetSpaceType !== 'room' && targetSpaceType !== 'cinema_seat' && targetSpaceType !== 'cinema') {
                if (prevTrackedId && (trackingToken || observerToken)) {
                  try {
                    const recoveredOrder = await trackOrderStatus(prevTrackedId, currentSlug, trackingToken, observerToken);
                    if (!isCurrentEffect) return;
                    if (recoveredOrder) {
                      setActiveOrderTrack(recoveredOrder);
                      return;
                    }
                  } catch (e) { }
                }
                lastActiveTableOrderIdRef.current = null;
                const staleKey = getOrderStorageKey(effectiveTableNum, targetSpaceType);
                if (staleKey) localStorage.removeItem(staleKey);
                const obsOrderKey = getObservedOrderStorageKey(targetSpaceType);
                if (obsOrderKey) {
                  try { localStorage.removeItem(obsOrderKey); sessionStorage.removeItem(obsOrderKey); } catch (e) { }
                }
                const storageSlug = currentSlug || getActiveStorageTenantSlug();
                const scopedObsKey = storageSlug
                  ? buildScopedStorageKey('touchqr_observer_token', {
                    slug: storageSlug,
                    spaceType: targetSpaceType || 'table',
                    tableNumber: effectiveTableNum
                  })
                  : null;
                if (scopedObsKey) {
                  try { localStorage.removeItem(scopedObsKey); } catch (e) { }
                }
                try {
                  localStorage.removeItem(`tq_track_${prevTrackedId}`);
                  sessionStorage.removeItem(`tq_track_${prevTrackedId}`);
                  localStorage.removeItem(`tq_obs_${prevTrackedId}`);
                  sessionStorage.removeItem(`tq_obs_${prevTrackedId}`);
                } catch (e) { }
                setActiveOrderId(null);
                setActiveOrderTrack(null);
                setCurrentTableNum('');
                setCurrentTableToken('');
                setSessionExpired(false);
                setIsPostBillViewOnly(true);
                setCartItems([]);
                setShowCartDrawer(false);
                window.history.replaceState({}, '', buildViewOnlyUrl());
                return;
              }
              if (activeOrderId && prevTrackedId) {
                const staleKey = getOrderStorageKey(effectiveTableNum, targetSpaceType);
                if (staleKey) localStorage.removeItem(staleKey);
                setActiveOrderId(null);
              }
              const staleObsOrderKey = getObservedOrderStorageKey(targetSpaceType);
              if (staleObsOrderKey) {
                try { localStorage.removeItem(staleObsOrderKey); sessionStorage.removeItem(staleObsOrderKey); } catch (e) { }
              }
              lastActiveTableOrderIdRef.current = null;
              setActiveOrderTrack(null);
            }
          }
        }
      } catch (err) {
        if (!isCurrentEffect) return;
        console.error('Failed to sync table order:', err);
      }
    };

    let isChecking = false;
    let syncQueued = false;
    const runStatusSync = async () => {
      if (!isCurrentEffect) return;
      if (isChecking) {
        syncQueued = true;
        return;
      }
      isChecking = true;
      try {
        await checkTableStatus();
      } finally {
        isChecking = false;
        if (syncQueued && isCurrentEffect) {
          syncQueued = false;
          runStatusSync();
        }
      }
    };

    runStatusSync();

    // Fast active-session polling (1s when tab visible) + instant wakeup on SSE push, same-browser BroadcastChannel, and focus
    const interval = setInterval(() => {
      if (!isCurrentEffect) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      runStatusSync();
    }, 1000);

    let bcChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bcChannel = new BroadcastChannel('touchqr_live_orders');
        bcChannel.onmessage = () => {
          if (isCurrentEffect) runStatusSync();
        };
      }
    } catch { }

    const handleWakeup = () => {
      if (!isCurrentEffect) return;
      if (typeof document === 'undefined' || !document.hidden) {
        runStatusSync();
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', handleWakeup);
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleWakeup);
    }

    // Real-time SSE push stream for cross-device instant updates on Express/persistent hosts
    let streamAbort = null;
    let streamReconnectTimer = null;
    const startLiveStream = async () => {
      if (!isCurrentEffect || trackingExpiredRef.current || sessionExpired || isPostBillViewOnly || isViewOnlyUrl) return;
      if (!currentSlug || typeof AbortController === 'undefined') return;

      const streamQrToken = currentTableToken || initialSpaceInfo.token || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tkn') || '').trim() : '');
      const streamSpaceType = currentSpaceType || initialSpaceInfo.type || 'table';
      const trackedKey = activeOrderId || lastActiveTableOrderIdRef.current || '';
      let streamTrackingTok = '';
      try {
        if (trackedKey) {
          streamTrackingTok =
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`tq_track_${trackedKey}`) : '') ||
            (typeof localStorage !== 'undefined' ? localStorage.getItem(`tq_track_${trackedKey}`) : '') ||
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tq_active_tracking_token') : '') ||
            '';
        }
      } catch { }
      const streamObserverTok = readStoredObserverToken(trackedKey, streamSpaceType);
      const canAuthOrder = Boolean(activeOrderId && (streamTrackingTok || streamObserverTok));
      const canAuthTable = Boolean(effectiveTableNum && streamQrToken && streamSpaceType !== 'counter');
      if (!canAuthOrder && !canAuthTable) return;

      streamAbort = new AbortController();
      const result = await subscribeOrderLiveStream({
        slug: currentSlug,
        orderId: canAuthOrder ? activeOrderId : '',
        tableNumber: effectiveTableNum || '',
        spaceType: streamSpaceType,
        tableToken: streamQrToken,
        trackingToken: streamTrackingTok,
        observerToken: streamObserverTok,
        signal: streamAbort.signal,
        onEvent: () => {
          if (isCurrentEffect) runStatusSync();
        }
      });

      if (!isCurrentEffect || result?.aborted) return;
      // Only reconnect cleanly if persistent SSE closed naturally (stop if serverless poll-mode or permanent 4xx)
      if (result?.mode === 'poll' || result?.status === 403 || result?.status === 404 || result?.status === 400) return;
      streamReconnectTimer = setTimeout(() => {
        if (isCurrentEffect) startLiveStream();
      }, 4000);
    };
    startLiveStream();

    return () => {
      isCurrentEffect = false;
      clearInterval(interval);
      if (streamReconnectTimer) clearTimeout(streamReconnectTimer);
      if (streamAbort) {
        try { streamAbort.abort(); } catch { }
      }
      if (bcChannel) {
        try { bcChannel.close(); } catch { }
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('focus', handleWakeup);
      }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', handleWakeup);
      }
    };
  }, [activeOrderId, effectiveTableNum, info, sessionExpired, isPostBillViewOnly]);

  const subtractSubmittedItems = (prevCart, submittedItems) => {
    if (!Array.isArray(prevCart) || prevCart.length === 0) return [];
    const remainingToSubtract = new Map();
    (submittedItems || []).forEach(si => {
      const key = `${si.dish_id}::${si.portion || ''}::${JSON.stringify(si.modifiers || [])}`;
      remainingToSubtract.set(key, (remainingToSubtract.get(key) || 0) + (Number(si.quantity) || 0));
    });
    return prevCart.reduce((acc, item) => {
      const key = `${item.dish?.id}::${item.portion || ''}::${JSON.stringify(item.modifiers || [])}`;
      const subQty = remainingToSubtract.get(key) || 0;
      if (subQty <= 0) {
        acc.push(item);
      } else {
        const itemQty = Number(item.quantity) || 0;
        const used = Math.min(itemQty, subQty);
        remainingToSubtract.set(key, subQty - used);
        const left = itemQty - used;
        if (left > 0) acc.push({ ...item, quantity: left });
      }
      return acc;
    }, []);
  };

  const buildOptimisticOrderTrack = (prev, res, orderItems, fallbackMeta) => {
    const nextRoundItems = Array.isArray(orderItems) ? orderItems : [];
    const primaryId = res.primary_order_id || res.order_id;
    if (res.is_addon && prev && String(prev.id) === String(primaryId)) {
      const prevItems = Array.isArray(prev.items) ? prev.items : [];
      const prevRounds = Array.isArray(prev.session_summary?.rounds)
        ? prev.session_summary.rounds
        : (Array.isArray(prev.rounds) ? prev.rounds : [{
          id: prev.id,
          round_number: Number(prev.round_number) || 1,
          status: prev.status,
          kitchen_prepared: Number(prev.kitchen_prepared) || 0,
          items: prevItems,
          subtotal_amount: prev.subtotal_amount || 0,
          tax_amount: prev.tax_amount || 0,
          grand_total_amount: prev.grand_total_amount || prev.total_amount || 0
        }]);
      if (prevRounds.some(r => String(r?.id) === String(res.order_id))) {
        return prev;
      }
      const newRoundEntry = {
        id: res.order_id,
        round_number: res.round_number || (prevRounds.length + 1),
        status: res.status || 'pending',
        kitchen_prepared: 0,
        items: nextRoundItems,
        notes: res.notes || '',
        subtotal_amount: res.subtotal_amount || 0,
        tax_amount: res.tax_amount || 0,
        grand_total_amount: res.grand_total_amount || res.total_amount || 0
      };
      const mergedRounds = [...prevRounds, newRoundEntry];
      const mergedGrand = (Number(prev.grand_total_amount ?? prev.total_amount ?? 0) || 0) + (Number(res.grand_total_amount ?? res.total_amount ?? 0) || 0);
      const mergedSub = (Number(prev.subtotal_amount || 0) || 0) + (Number(res.subtotal_amount || 0) || 0);
      const mergedTax = (Number(prev.tax_amount || 0) || 0) + (Number(res.tax_amount || 0) || 0);
      const mergedItems = [...prevItems, ...nextRoundItems];
      return {
        ...prev,
        latest_order_id: res.order_id,
        status: res.status || 'pending',
        kitchen_prepared: 0,
        round_number: res.round_number || mergedRounds.length,
        items: mergedItems,
        total_amount: mergedGrand,
        subtotal_amount: mergedSub,
        tax_amount: mergedTax,
        grand_total_amount: mergedGrand,
        rounds: mergedRounds,
        ...(prev.session_summary ? {
          session_summary: {
            ...prev.session_summary,
            round_count: mergedRounds.length,
            rounds: mergedRounds,
            items: mergedItems,
            subtotal_amount: mergedSub,
            tax_amount: mergedTax,
            grand_total_amount: mergedGrand
          }
        } : {})
      };
    }
    return {
      id: primaryId,
      latest_order_id: res.order_id,
      session_id: res.session_id || null,
      table_number: res.table_number || fallbackMeta.tableNumber,
      space_type: fallbackMeta.spaceType,
      status: res.status || 'pending',
      kitchen_prepared: 0,
      round_number: res.round_number || 1,
      order_type: res.order_type || fallbackMeta.orderType,
      token_number: res.token_number || null,
      token_display: res.token_display || null,
      total_amount: res.total_amount,
      subtotal_amount: res.subtotal_amount,
      tax_amount: res.tax_amount,
      grand_total_amount: res.grand_total_amount,
      notes: res.notes || '',
      items: nextRoundItems
    };
  };

  const handleSendDirectOrder = async () => {
    const slug = getSlugFromUrl() || (info && info.slug) || '';
    if (cartItems.length === 0) return;
    if (isPlacingOrderRef.current || placingOrder) return;
    isPlacingOrderRef.current = true;
    setOrderConfirmed(false);
    setPlacingOrder(true);

    const targetSpaceType = currentSpaceType || initialSpaceInfo.type || 'table';
    const effectiveQrToken = currentTableToken || initialSpaceInfo.token || (new URLSearchParams(window.location.search).get('tkn') || '').trim();
    const targetTable = targetSpaceType === 'counter'
      ? 'COUNTER'
      : (effectiveTableNum || currentTableNum || initialSpaceInfo.num || (new URLSearchParams(window.location.search).get('table') || '').trim() || '1');

    if (!targetTable || !effectiveQrToken) {
      const spaceAlertName = targetSpaceType === 'room' ? 'room' : targetSpaceType === 'cinema_seat' ? 'seat' : targetSpaceType === 'counter' ? 'counter' : 'table';
      alert(`Invalid or missing QR. Please scan the official QR code at your ${spaceAlertName} to place an order.`);
      setPlacingOrder(false);
      isPlacingOrderRef.current = false;
      return;
    }

    if (targetSpaceType === 'counter') {
      const isCounterEnabled = !info || (
        info.counter_ordering_enabled === true ||
        info.counter_ordering_enabled === 1 ||
        info.counter_ordering_enabled === '1' ||
        Boolean(initialSpaceInfo.isValidTokenShape && info.resto_type !== 'cinema' && info.business_type !== 'cinema_theatre')
      );
      if (!isCounterEnabled) {
        alert('Counter ordering is currently not enabled for this business.');
        setPlacingOrder(false);
        isPlacingOrderRef.current = false;
        return;
      }
    }

    const itemsPayload = cartItems.map(item => ({
      dish_id: item.isCombo ? item.dish.id : item.dish.id,
      name: item.dish.name,
      portion: item.portion || '',
      portion_type: item.portion_type || (String(item.portion || '').toLowerCase().includes('half') ? 'half' : 'full'),
      modifiers: item.modifiers || [],
      price: item.price,
      quantity: item.quantity,
      ...(item.isCombo ? { type: 'combo', includes: item.comboIncludes || '' } : {})
    }));
    const grandTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const attemptIdempKey = `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const effectiveOrderType = (isCinemaVenue || isHotelVenue) ? 'dine_in' : (isCounterSpace ? 'takeaway' : orderTypeChoice);
    const trimmedNotes = String(orderNotesInput || '').trim().slice(0, 240);

    const orderPayload = {
      slug,
      table_number: targetTable,
      space_type: targetSpaceType,
      order_type: effectiveOrderType,
      table_token: effectiveQrToken,
      customer_name: customerNameInput || (targetSpaceType === 'room' ? 'Room Guest' : (targetSpaceType === 'cinema_seat' || targetSpaceType === 'cinema') ? 'Seat Guest' : targetSpaceType === 'counter' ? 'Counter Customer' : 'Guest'),
      customer_phone: customerPhoneInput || '',
      items: itemsPayload,
      total_amount: grandTotal,
      idempotency_key: attemptIdempKey,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      ...(presenceTokenRef.current ? { presence_token: presenceTokenRef.current } : {})
    };

    // Instant 0ms pre-flight trigger: open PresenceVerificationModal immediately without waiting
    // for a wasted POST /api/orders 403 round-trip when presenceToken is not yet obtained.
    if (!presenceTokenRef.current && info && isDirectOrderingActive) {
      pendingOrderPayloadRef.current = {
        slug,
        table_number: targetTable,
        space_type: targetSpaceType,
        order_type: effectiveOrderType,
        table_token: effectiveQrToken,
        customer_name: customerNameInput || (targetSpaceType === 'room' ? 'Room Guest' : (targetSpaceType === 'cinema_seat' || targetSpaceType === 'cinema') ? 'Seat Guest' : targetSpaceType === 'counter' ? 'Counter Customer' : 'Guest'),
        customer_phone: customerPhoneInput || '',
        items: itemsPayload,
        total_amount: grandTotal,
        idempotency_key: attemptIdempKey,
        ...(trimmedNotes ? { notes: trimmedNotes } : {})
      };
      const isLocInit = isFlagEnabled(info?.location_initialized, false);
      const hasCoords = info?.latitude != null && info?.longitude != null &&
        !Number.isNaN(Number(info.latitude)) && !Number.isNaN(Number(info.longitude)) &&
        Number(info.latitude) !== 0 && Number(info.longitude) !== 0;
      const hasConfiguredGps = Boolean(isLocInit && (hasCoords || info?.latitude === undefined || info?.longitude === undefined));
      setPresencePolicy({
        mode: hasConfiguredGps ? 'GPS_WITH_STAFF_FALLBACK' : 'QR_ONLY',
        allowed_methods: hasConfiguredGps ? ['GPS', 'STAFF'] : ['QR', 'STAFF', 'GPS'],
        staff_fallback_allowed: true,
        staff_timeout_seconds: Number(info?.staff_verification_timeout_seconds) || 120
      });
      setPresenceModalOpen(true);
      setOrderConfirmed(false);
      setPlacingOrder(false);
      isPlacingOrderRef.current = false;
      return;
    }

    try {
      const minAnimDelay = new Promise(resolve => setTimeout(resolve, 2150));
      const res = await createDirectOrder(orderPayload);

      if (res && res.order_id) {
        if (res.tracking_token) {
          try {
            sessionStorage.setItem(`tq_track_${res.order_id}`, res.tracking_token);
            localStorage.setItem(`tq_track_${res.order_id}`, res.tracking_token);
            sessionStorage.setItem('tq_active_tracking_token', res.tracking_token);
          } catch (e) { }
        }
        if (res.session_observer_token) {
          try {
            sessionStorage.setItem(`tq_obs_${res.order_id}`, res.session_observer_token);
            localStorage.setItem(`tq_obs_${res.order_id}`, res.session_observer_token);
            if (res.primary_order_id) {
              sessionStorage.setItem(`tq_obs_${res.primary_order_id}`, res.session_observer_token);
              localStorage.setItem(`tq_obs_${res.primary_order_id}`, res.session_observer_token);
            }
            sessionStorage.setItem('tq_active_observer_token', res.session_observer_token);
          } catch (e) { }
        }
        const storageSlug = slug || getActiveStorageTenantSlug();
        if (storageSlug) {
          const storageKey = buildScopedStorageKey('touchqr_active_order_id', {
            slug: storageSlug,
            spaceType: targetSpaceType,
            tableNumber: targetTable
          });
          if (storageKey) localStorage.setItem(storageKey, String(res.order_id));
          persistPlacedOrderObserverKeys(storageSlug, targetSpaceType, targetTable, res.order_id, res.session_observer_token);
          const scanKey = buildScopedStorageKey('touchqr_table_scan_time', {
            slug: storageSlug,
            spaceType: targetSpaceType,
            tableNumber: targetTable
          });
          if (scanKey) localStorage.removeItem(scanKey);
        }
        lastActiveTableOrderIdRef.current = String(res.order_id);
        setActiveOrderId(String(res.order_id));
        setActiveOrderTrack(prev => buildOptimisticOrderTrack(prev, res, itemsPayload, {
          tableNumber: targetTable,
          spaceType: targetSpaceType,
          orderType: effectiveOrderType
        }));
      }

      setOrderConfirmed(true);
      setLastCompletedBill(null);
      setBillCompletedModal(null);
      setCompletedSpaceSnapshot(null);
      setIsPostBillViewOnly(false);
      persistLastCompletedBill(slug || getActiveStorageTenantSlug(), null);
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('touchqr_live_orders');
          bc.postMessage({ type: 'order_created', slug: slug || (info && info.slug) || '', order_id: res.order_id, ts: Date.now() });
          bc.close();
        }
      } catch { }
      pendingOrderPayloadRef.current = null;
      await minAnimDelay;
      if (res?.order_id && lastActiveTableOrderIdRef.current !== String(res.order_id)) {
        return;
      }
      setOrderSuccessModal(res);
      setCartItems(prev => subtractSubmittedItems(prev, itemsPayload));
      setOrderNotesInput('');
      setShowCartDrawer(false);
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
          order_type: effectiveOrderType,
          table_token: effectiveQrToken,
          customer_name: customerNameInput || (targetSpaceType === 'room' ? 'Room Guest' : (targetSpaceType === 'cinema_seat' || targetSpaceType === 'cinema') ? 'Seat Guest' : targetSpaceType === 'counter' ? 'Counter Customer' : 'Guest'),
          customer_phone: customerPhoneInput || '',
          items: itemsPayload,
          total_amount: grandTotal,
          idempotency_key: attemptIdempKey,
          ...(trimmedNotes ? { notes: trimmedNotes } : {})
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
          order_type: effectiveOrderType,
          table_token: effectiveQrToken,
          customer_name: customerNameInput || (targetSpaceType === 'room' ? 'Room Guest' : (targetSpaceType === 'cinema_seat' || targetSpaceType === 'cinema') ? 'Seat Guest' : targetSpaceType === 'counter' ? 'Counter Customer' : 'Guest'),
          customer_phone: customerPhoneInput || '',
          items: itemsPayload,
          total_amount: grandTotal,
          idempotency_key: attemptIdempKey,
          ...(trimmedNotes ? { notes: trimmedNotes } : {})
        };
        setPresenceModalOpen(true);
        return;
      }

      if (errCode === 'invalid_qr' || errMsg.toLowerCase().includes('qr')) {
        const spaceAlertName = targetSpaceType === 'room' ? 'room' : targetSpaceType === 'cinema_seat' ? 'seat' : targetSpaceType === 'counter' ? 'counter' : 'table';
        alert(errMsg || `Invalid or unverified QR code. Please scan the official QR code at your ${spaceAlertName}.`);
      } else {
        alert(errMsg || 'Failed to place order. Please try again.');
      }
    } finally {
      setOrderConfirmed(false);
      setPlacingOrder(false);
      setTimeout(() => {
        isPlacingOrderRef.current = false;
      }, 300);
    }
  };

  const persistPlacedOrderObserverKeys = (tenantSlugVal, spaceTypeVal, tableNumVal, orderIdVal, observerTok) => {
    if (!tenantSlugVal || !orderIdVal || spaceTypeVal === 'counter') return;
    const obsOrderKey = buildScopedStorageKey('touchqr_last_observed_order_id', {
      slug: tenantSlugVal,
      spaceType: spaceTypeVal,
      tableNumber: tableNumVal
    });
    if (obsOrderKey) {
      try {
        localStorage.setItem(obsOrderKey, String(orderIdVal));
        sessionStorage.setItem(obsOrderKey, String(orderIdVal));
      } catch (e) { }
    }
    if (observerTok) {
      const scopedObsKey = buildScopedStorageKey('touchqr_observer_token', {
        slug: tenantSlugVal,
        spaceType: spaceTypeVal,
        tableNumber: tableNumVal
      });
      if (scopedObsKey) {
        try { localStorage.setItem(scopedObsKey, observerTok); } catch (e) { }
      }
    }
  };

  // Dedicated single-shot retry with verified presence token
  const executePendingOrderRetry = async (verifiedToken) => {
    const payload = pendingOrderPayloadRef.current;
    if (!payload) return;
    pendingOrderPayloadRef.current = null;

    if (isPlacingOrderRef.current || placingOrder) return;
    isPlacingOrderRef.current = true;
    setOrderConfirmed(false);
    setPlacingOrder(true);

    try {
      const orderPayloadWithToken = {
        ...payload,
        presence_token: verifiedToken
      };

      const minAnimDelay = new Promise(resolve => setTimeout(resolve, 2150));
      const res = await createDirectOrder(orderPayloadWithToken);

      if (res && res.order_id) {
        if (res.tracking_token) {
          try {
            sessionStorage.setItem(`tq_track_${res.order_id}`, res.tracking_token);
            localStorage.setItem(`tq_track_${res.order_id}`, res.tracking_token);
            sessionStorage.setItem('tq_active_tracking_token', res.tracking_token);
          } catch (e) { }
        }
        if (res.session_observer_token) {
          try {
            sessionStorage.setItem(`tq_obs_${res.order_id}`, res.session_observer_token);
            localStorage.setItem(`tq_obs_${res.order_id}`, res.session_observer_token);
            if (res.primary_order_id) {
              sessionStorage.setItem(`tq_obs_${res.primary_order_id}`, res.session_observer_token);
              localStorage.setItem(`tq_obs_${res.primary_order_id}`, res.session_observer_token);
            }
            sessionStorage.setItem('tq_active_observer_token', res.session_observer_token);
          } catch (e) { }
        }
        const retrySlug = payload.slug || getActiveStorageTenantSlug();
        const retrySpaceType = payload.space_type || currentSpaceType || 'table';
        if (retrySlug) {
          const storageKey = buildScopedStorageKey('touchqr_active_order_id', {
            slug: retrySlug,
            spaceType: retrySpaceType,
            tableNumber: payload.table_number
          });
          if (storageKey) localStorage.setItem(storageKey, String(res.order_id));
          persistPlacedOrderObserverKeys(retrySlug, retrySpaceType, payload.table_number, res.order_id, res.session_observer_token);
          const scanKey = buildScopedStorageKey('touchqr_table_scan_time', {
            slug: retrySlug,
            spaceType: retrySpaceType,
            tableNumber: payload.table_number
          });
          if (scanKey) localStorage.removeItem(scanKey);
        }
        lastActiveTableOrderIdRef.current = String(res.order_id);
        setActiveOrderId(String(res.order_id));
        setActiveOrderTrack(prev => buildOptimisticOrderTrack(prev, res, payload.items, {
          tableNumber: payload.table_number,
          spaceType: retrySpaceType,
          orderType: payload.order_type
        }));
      }

      setOrderConfirmed(true);
      setLastCompletedBill(null);
      setBillCompletedModal(null);
      setCompletedSpaceSnapshot(null);
      setIsPostBillViewOnly(false);
      persistLastCompletedBill(payload?.slug || getActiveStorageTenantSlug(), null);
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('touchqr_live_orders');
          bc.postMessage({ type: 'order_created', slug: payload?.slug || (info && info.slug) || '', order_id: res.order_id, ts: Date.now() });
          bc.close();
        }
      } catch { }
      await minAnimDelay;
      if (res?.order_id && lastActiveTableOrderIdRef.current !== String(res.order_id)) {
        return;
      }
      setOrderSuccessModal(res);
      setCartItems(prev => subtractSubmittedItems(prev, payload.items));
      setOrderNotesInput('');
      setShowCartDrawer(false);
    } catch (err) {
      console.error('[PRESENCE RETRY ORDER ERROR]', err);
      const errMsg = String(err.message || '');
      const errCode = err.error || err.code || '';
      if (errCode === 'presence_expired' || errCode === 'invalid_presence') {
        setPresenceToken(null);
        presenceTokenRef.current = null;
        pendingOrderPayloadRef.current = null;
        alert(errMsg || 'Table presence verification expired or was invalid. Please tap Send Order to verify again.');
      } else {
        alert(errMsg || 'Failed to place order after verification. Please try again.');
      }
    } finally {
      setOrderConfirmed(false);
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

  // Load Menu Data
  const loadMenuData = async (forcedSlug = '', silent = false) => {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/$/, '');
    if (rawPath === '/kitchen' || isSlugKitchenPath(window.location.pathname)) {
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
    const isCustomDomainMenu = !slug && (rawPath === '' || rawPath === '/') && isCustomDomainHost(typeof window !== 'undefined' ? window.location.hostname : '');
    const isSystemNonMenuRoute = ['/', '/register', '/billing', '/super-admin', '/superadmin', '/privacy-policy', '/privacy', '/terms', '/terms-of-service', '/refund-policy', '/refunds', '/security', '/contact', '/support'].includes(rawPath);
    if (!slug && isSystemNonMenuRoute && !isCustomDomainMenu) {
      setLoading(false);
      return;
    }
    const isAdminMode = Boolean(adminToken && isAdminRoute);
    if (!slug && !isAdminMode && !isCustomDomainMenu) {
      setRestaurantStatus('not_found');
      setLoading(false);
      return;
    }
    console.log('[PUBLIC TENANT] URL slug:', urlSlug || '(none)');
    console.log('[PUBLIC TENANT] resolved slug:', slug || '(none)');
    try {
      let infoData = null;
      let catData = [];
      let dishData = [];
      let comboData = [];

      // Check session scan deduplication for customer view (avoids inflating scans on reload/search)
      let isNewScanSession = false;
      let spaceTypeParam = '';
      let tableNumParam = '';
      if (!isAdminMode) {
        const spaceInfo = getSpaceInfoFromUrl();
        if (spaceInfo?.type) spaceTypeParam = spaceInfo.type;
        if (spaceInfo?.num) tableNumParam = spaceInfo.num;
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            const spaceKey = spaceInfo?.type && spaceInfo?.num ? `${spaceInfo.type}_${spaceInfo.num}` : 'main';
            const tenantKey = slug || (typeof window !== 'undefined' ? window.location.hostname : 'host') || 'host';
            const sessionKey = `touchqr_scan_${tenantKey}_${spaceKey}`;
            if (!sessionStorage.getItem(sessionKey)) {
              isNewScanSession = true;
              sessionStorage.setItem(sessionKey, String(Date.now()));
            }
          } catch (e) {
            isNewScanSession = true;
          }
        }
      }

      // Fast single-bundle fetch for public customer view
      if (!isAdminMode) {
        try {
          const scanParam = isNewScanSession ? '1' : '0';
          const spaceQuery = spaceTypeParam ? `&space_type=${encodeURIComponent(spaceTypeParam)}&table_num=${encodeURIComponent(tableNumParam)}` : '';
          const slugQuery = slug ? `slug=${encodeURIComponent(slug)}&` : '';
          const bundleRes = await fetch(`/api/menu-bundle?${slugQuery}scan=${scanParam}${spaceQuery}`);
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
          fetchRestaurantInfo({
            token: publicToken,
            slug,
            scan: isNewScanSession ? '1' : '0',
            space_type: spaceTypeParam,
            table_num: tableNumParam
          }),
          fetchCategories({ slug, adminView: isAdminMode, token: publicToken }),
          fetchDishes({ query: searchQuery, slug, adminView: isAdminMode, token: publicToken }),
          fetchCombos(slug).catch((err) => { console.warn('[MENU] fetchCombos notice:', err); return []; })
        ]);
        if (!infoData) infoData = resInfo;
        if (!catData || catData.length === 0) catData = resCat || [];
        if (!dishData || dishData.length === 0) dishData = resDish || [];
        if (!comboData || comboData.length === 0) comboData = resCombo || [];
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
        // Apply restaurant theme synchronously BEFORE React renders/paints infoData to prevent 1-frame theme flash (FOUC)
        if (infoData?.theme_color && typeof document !== 'undefined') {
          const preResolved = resolveTheme(infoData.theme_color);
          document.documentElement.setAttribute('data-theme', preResolved.key);
          try {
            const slugKey = String(infoData.slug || slug || '').trim().toLowerCase();
            if (slugKey) localStorage.setItem(`touchqr_theme_${slugKey}`, preResolved.key);
            if (typeof window !== 'undefined' && isCustomDomainHost(window.location.hostname)) {
              localStorage.setItem(`touchqr_theme_${window.location.hostname.toLowerCase()}`, preResolved.key);
            }
          } catch { }
        }

        setInfo(infoData);
        setLoading(false);
        return;
      }

      console.log('[MENU] resolved restaurant id:', infoData ? infoData.id : 'none');
      console.log('[MENU] API dishes count:', dishData ? dishData.length : 0);
      console.log('[MENU] API categories count:', catData ? catData.length : 0);
      console.log('[MENU] final dishes count:', dishData ? dishData.length : 0);

      // Apply restaurant theme synchronously BEFORE React renders/paints infoData to prevent 1-frame theme flash (FOUC)
      if (infoData?.theme_color && typeof document !== 'undefined') {
        const preResolved = resolveTheme(infoData.theme_color);
        document.documentElement.setAttribute('data-theme', preResolved.key);
        try {
          const slugKey = String(infoData.slug || slug || '').trim().toLowerCase();
          if (slugKey) localStorage.setItem(`touchqr_theme_${slugKey}`, preResolved.key);
          if (typeof window !== 'undefined' && isCustomDomainHost(window.location.hostname)) {
            localStorage.setItem(`touchqr_theme_${window.location.hostname.toLowerCase()}`, preResolved.key);
          }
        } catch { }
      }

      setInfo(infoData);
      setCategories(catData);
      setDishes(dishData);
      setCombos(Array.isArray(comboData) ? comboData : []);
      const isCustomDomainRoot = window.location.pathname === '/' && isCustomDomainHost(window.location.hostname);
      if (infoData && infoData.name && ((window.location.pathname !== '/' && window.location.pathname !== '/register') || isCustomDomainRoot)) {
        document.title = `${infoData.name} - Digital Menu & Ordering`;
      } else if (window.location.pathname === '/' && !isCustomDomainRoot) {
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
  }, [adminToken, view]);

  // Dynamic Theme Color Engine Applicator (runs synchronously before paint to prevent theme flash)
  useIsomorphicLayoutEffect(() => {
    if (['menu', 'customer', 'admin', 'admin-dashboard', 'admin-setup', 'menu-preview'].includes(view)) {
      let rawTheme = info?.theme_color;
      if (!rawTheme) {
        try {
          const slugHint = getSlugFromUrl()
            || (view.startsWith('admin') ? localStorage.getItem('touchqr_admin_slug') : '')
            || (typeof window !== 'undefined' ? window.location.hostname : '')
            || '';
          const cacheKey = String(slugHint || '').trim().toLowerCase();
          if (cacheKey) rawTheme = localStorage.getItem(`touchqr_theme_${cacheKey}`) || '';
        } catch { }
      }
      const resolved = resolveTheme(rawTheme);
      document.documentElement.setAttribute('data-theme', resolved.key);
      if (info?.theme_color) {
        try {
          const slugKey = String(info?.slug || getSlugFromUrl() || '').trim().toLowerCase();
          if (slugKey) localStorage.setItem(`touchqr_theme_${slugKey}`, resolved.key);
          if (typeof window !== 'undefined' && isCustomDomainHost(window.location.hostname)) {
            localStorage.setItem(`touchqr_theme_${window.location.hostname.toLowerCase()}`, resolved.key);
          }
        } catch { }
      }
    } else if (!['super-admin-dashboard', 'super-admin-login'].includes(view)) {
      document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
    }
  }, [info?.theme_color, info?.slug, view]);

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
          const isTrial = data.status === 'trialing' || data.is_trial === true;
          const isAllowed = data.is_allowed !== undefined ? Boolean(data.is_allowed) : (data.active === true || data.status === 'active' || isTrial);
          const billingReq = data.billing_required !== undefined ? Boolean(data.billing_required) : false;
          return isAllowed && (!billingReq || isTrial);
        }
        if (res.status === 401) {
          console.warn('Unauthorized token in checkMandateGating. Clearing stored credentials.');
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
      const searchSuffix = window.location.search || '';
      const safeStoredToken = (t) => (t && t !== 'undefined' && t !== 'null') ? t : '';
      const liveAdminToken = safeStoredToken(localStorage.getItem('touchqr_admin_token')) || adminToken;
      const liveSuperToken = safeStoredToken(localStorage.getItem('saas_super_token')) || superToken;

      if (path === '/admin' || path === '/admin/') {
        let storedSlug = localStorage.getItem('touchqr_admin_slug');
        if (storedSlug && storedSlug !== 'undefined' && storedSlug !== 'null') {
          window.history.replaceState({}, '', `/${storedSlug}/admin${searchSuffix}`);
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

      if (isGenericKitchen || isKitchen) {
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
        if (liveSuperToken) {
          setView('super-admin-dashboard');
        } else {
          setView('super-admin-login');
        }
      } else if (isBilling) {
        if (liveAdminToken) {
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

        if (liveAdminToken) {
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
              window.history.replaceState({}, '', `${setupUrl}${searchSuffix}`);
            }
          } else {
            setView('admin-dashboard');
            const cleanUrl = (effectiveSlug && effectiveSlug !== 'undefined' && effectiveSlug !== 'null') ? `/${effectiveSlug}/admin` : '/admin';
            if (window.location.pathname !== cleanUrl) {
              window.history.replaceState({}, '', `${cleanUrl}${searchSuffix}`);
            }
          }

          // Fetch fresh tenant info to accurately evaluate onboarding & mandate status
          fetchRestaurantInfo({ token: liveAdminToken, slug: effectiveSlug }).then(freshInfo => {
            if (freshInfo) {
              setInfo(freshInfo);
              const freshOnboardingComplete = (freshInfo.onboarding_completed !== false && freshInfo.onboarding_completed !== 0 && freshInfo.onboarding_completed !== 'false');
              localStorage.setItem('touchqr_onboarding_completed', freshOnboardingComplete ? 'true' : 'false');
              if (!freshOnboardingComplete) {
                setView('admin-setup');
                const setupUrl = (effectiveSlug && effectiveSlug !== 'undefined' && effectiveSlug !== 'null') ? `/${effectiveSlug}/admin/setup` : '/admin/setup';
                if (window.location.pathname !== setupUrl) {
                  window.history.replaceState({}, '', `${setupUrl}${window.location.search || ''}`);
                }
              }
            }
          }).catch(() => { });

          // Silent Mandate Verification in Background
          checkMandateGating(liveAdminToken, effectiveSlug).then(mandateActive => {
            if (!mandateActive) {
              window.history.replaceState({}, '', '/billing');
              setView('billing');
            }
          }).catch(() => { });
        } else {
          const currentUrlParams = new URLSearchParams(window.location.search);
          if (currentUrlParams.get('code') || currentUrlParams.get('token') || view === 'auth-exchanging') {
            return;
          }
          setView('admin-login');
        }
      } else if (isRootPath) {
        if (isCustomDomainHost(window.location.hostname)) {
          setView('menu');
          if (info && info.name) {
            document.title = `${info.name} - Digital Menu & Ordering`;
          }
        } else {
          setView('landing');
          document.title = 'TouchQR - Digital Menu & QR Ordering Platform';
        }
      } else if (path === '/menu' || path === '/menu/') {
        setRestaurantStatus('not_found');
        setLoading(false);
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

  function handleAdminLoginSuccess(token, username, slug, initialRestoInfo = null) {
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
    }).catch(() => { });
  };

  const handleAdminLogout = (expectedToken = null) => {
    if (typeof expectedToken === 'string' && expectedToken && expectedToken !== adminTokenRef.current) {
      return;
    }
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

  // In-Context Owner Modals State
  const saveInlineCatalogEntity = async ({ url, isEdit, payload, fallbackError }) => {
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });

    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || fallbackError);
    }

    return data;
  };

  // In-Context Owner Handlers
  const handleSaveInlineDish = async (dishData) => {
    const isEdit = Boolean(ownerDishModalData?.id);
    const url = isEdit ? `/api/admin/dishes/${ownerDishModalData.id}` : '/api/admin/dishes';

    await saveInlineCatalogEntity({
      url,
      isEdit,
      payload: dishData,
      fallbackError: 'Failed to save dish'
    });

    await loadMenuData(info?.slug || '', true);
    setOwnerDishModalData(null);
  };

  const handleSaveInlineCategory = async (catData) => {
    const isEdit = Boolean(ownerCatModalData?.id);
    const url = isEdit ? `/api/admin/categories/${ownerCatModalData.id}` : '/api/admin/categories';

    await saveInlineCatalogEntity({
      url,
      isEdit,
      payload: catData,
      fallbackError: 'Failed to save category'
    });

    await loadMenuData(info?.slug || '', true);
    setOwnerCatModalData(null);
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

  // Filter combos matching search query or active filter
  const filteredCombos = useMemo(() => {
    let list = Array.isArray(combos) ? combos : [];
    if (list.length === 0) return [];

    // Filter by quick filter
    if (activeQuickFilter) {
      if (activeQuickFilter === 'combo') {
        // Show all available combos
      } else if (activeQuickFilter === 'under100') {
        list = list.filter(c => {
          const hasOffer = c.offer_price !== undefined && c.offer_price !== null && c.offer_price !== '';
          const p = hasOffer ? Number(c.offer_price) : Number(c.price || 0);
          return (hasOffer ? p >= 0 : p > 0) && p <= 100;
        });
      } else if (activeQuickFilter === 'must_try') {
        list = list.filter(c => String(c.badge || '').toLowerCase().includes('must'));
      } else if (activeQuickFilter === 'special') {
        list = list.filter(c => {
          const basePrice = Number(c.regular_price ?? c.price ?? 0);
          const hasOffer = c.offer_price !== undefined && c.offer_price !== null && c.offer_price !== '' && Number(c.offer_price) >= 0 && Number(c.offer_price) < basePrice;
          return String(c.badge || '').toLowerCase().includes('special') || hasOffer;
        });
      } else if (activeQuickFilter === 'veg') {
        list = list.filter(c => {
          if (isPureVegResto) return true;
          const text = `${c.name || ''} ${c.description || ''}`.toLowerCase();
          return !text.includes('chicken') && !text.includes('mutton') && !text.includes('fish') && !text.includes('egg');
        });
      } else if (activeQuickFilter === 'nonveg') {
        list = list.filter(c => {
          if (isPureVegResto) return false;
          const text = `${c.name || ''} ${c.description || ''}`.toLowerCase();
          return text.includes('chicken') || text.includes('mutton') || text.includes('fish') || text.includes('egg');
        });
      } else if (activeQuickFilter === 'egg') {
        list = list.filter(c => {
          const text = `${c.name || ''} ${c.description || ''}`.toLowerCase();
          return text.includes('egg') || text.includes('अंडा');
        });
      }
    }

    // Filter by search query
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter(c => {
        let itemsStr = '';
        try {
          const parsed = typeof c.items === 'string' ? JSON.parse(c.items) : (c.items || []);
          itemsStr = parsed.map(i => i.dish_name || '').join(' ');
        } catch { }
        const haystack = `${c.name || ''} ${c.description || ''} ${c.badge || ''} ${itemsStr} thali combo thalis combos कॉम्बो थाली स्पेशल`.toLowerCase();
        return tokens.every(token => haystack.includes(token));
      });
    }

    return list;
  }, [combos, activeQuickFilter, searchQuery, info, isPureVegResto]);

  // Group dishes by category with in-memory multi-field tokenized search & quick filters
  const { groupedDishes, totalMatchingDishesCount } = useMemo(() => {
    let list = Array.isArray(dishes) ? dishes : [];

    // 1. Quick Filter (Dietary / Badge / Price)
    if (activeQuickFilter) {
      if (activeQuickFilter === 'combo') {
        list = [];
      } else {
        list = list.filter(d => {
          if (!d) return false;
          if (activeQuickFilter === 'veg') {
            return d.type === 'veg' || !d.type || d.type === '';
          }
          if (activeQuickFilter === 'nonveg') {
            if (isPureVegResto) return false;
            return d.type === 'nonveg';
          }
          if (activeQuickFilter === 'egg') {
            if (isPureVegResto) return false;
            return d.type === 'egg';
          }
          if (activeQuickFilter === 'must_try') {
            const badge = String(d.badge || '').toLowerCase();
            return Boolean(d.must_try || d.is_must_try || badge.includes('must'));
          }
          if (activeQuickFilter === 'special') {
            const badge = String(d.badge || '').toLowerCase();
            const basePrice = Number(d.regular_price ?? d.price ?? d.portion_full_price ?? 0);
            const hasValidOfferPrice = d.offer_price !== undefined && d.offer_price !== null && d.offer_price !== '' && Number(d.offer_price) >= 0 && Number(d.offer_price) < basePrice;
            const hasOffer = Boolean(d.offer_badge || (d.offer && d.offer.offer_badge) || hasValidOfferPrice);
            return Boolean(d.special || d.is_special || badge.includes('special') || hasOffer);
          }
          if (activeQuickFilter === 'under100') {
            const hasOffer = d.offer_price !== undefined && d.offer_price !== null && d.offer_price !== '';
            const effectivePrice = hasOffer
              ? Number(d.offer_price)
              : (Number(d.price) > 0 ? Number(d.price) : Number(d.portion_full_price) || 0);
            return (hasOffer ? effectivePrice >= 0 : effectivePrice > 0) && effectivePrice <= 100;
          }
          return true;
        });
      }
    }

    // Category dictionary for lookup
    const catMap = {};
    (categories || []).forEach(c => {
      if (c && c.id) catMap[c.id] = c;
    });

    // 2. Tokenized Multi-Field Search Matching
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter(d => {
        if (!d) return false;
        const cat = catMap[d.category_id];
        const catName = String(cat?.name || '').toLowerCase();
        const catNameHi = String(cat?.name_hi || '').toLowerCase();
        const name = String(d.name || '').toLowerCase();
        const nameHi = String(d.name_hi || '').toLowerCase();
        const desc = String(d.description || '').toLowerCase();
        const badge = String(d.badge || '').toLowerCase();

        // Combined searchable text for this dish
        const haystack = `${name} ${nameHi} ${desc} ${badge} ${catName} ${catNameHi}`;

        // Every typed word/token must match somewhere in the dish or its category
        return tokens.every(token => haystack.includes(token));
      });
    }

    // 3. Group by category
    const map = {};
    (categories || []).forEach(c => {
      if (c && c.id) {
        map[c.id] = { category: c, items: [] };
      }
    });

    list.forEach(d => {
      if (d && map[d.category_id]) {
        map[d.category_id].items.push(d);
      } else if (d) {
        if (!map['uncategorized']) {
          map['uncategorized'] = { category: { id: 'uncategorized', name: 'Special Treats' }, items: [] };
        }
        map['uncategorized'].items.push(d);
      }
    });

    let results = Object.values(map).filter(group => group.items.length > 0);

    // 4. Apply selectedCategory filter only when NOT in active search/filter
    if (selectedCategory !== 'all' && !q && !activeQuickFilter) {
      if (selectedCategory === 'combos-section') {
        results = [];
      } else {
        results = results.filter(g => String(g.category?.id) === String(selectedCategory));
      }
    }

    const visibleDishesCount = results.reduce((sum, g) => sum + g.items.length, 0)
      + ((q || activeQuickFilter || selectedCategory === 'combos-section') ? filteredCombos.length : 0);

    return { groupedDishes: results, totalMatchingDishesCount: visibleDishesCount };
  }, [dishes, categories, searchQuery, activeQuickFilter, selectedCategory, filteredCombos, isPureVegResto]);

  // Categories that contain at least one dish (auto-hides blank categories for customers)
  const populatedCategories = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    const dishCatIds = new Set(
      (dishes || [])
        .map(d => d && d.category_id !== null && d.category_id !== undefined ? String(d.category_id) : null)
        .filter(Boolean)
    );
    return categories.filter(c => c && c.id && dishCatIds.has(String(c.id)));
  }, [categories, dishes]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val && String(val).trim() && selectedCategory !== 'all') {
      setSelectedCategory('all');
    }
  };

  const handleQuickFilterChange = (filterId) => {
    setActiveQuickFilter(filterId);
    if (filterId && selectedCategory !== 'all') {
      setSelectedCategory('all');
    }
  };

  const handleClearAllSearchAndFilters = () => {
    setSearchQuery('');
    setActiveQuickFilter('');
    setSelectedCategory('all');
  };

  const specialOfferItems = useMemo(() => {
    const offerDishes = (dishes || []).filter(d => {
      if (!isFlagEnabled(d.available, true)) return false;
      const basePrice = Number(d.regular_price ?? d.price ?? d.portion_full_price ?? 0);
      return d.offer_price !== undefined && d.offer_price !== null && d.offer_price !== '' && Number(d.offer_price) < basePrice;
    });
    const offerCombos = (combos || []).filter(c => {
      if (!isFlagEnabled(c.available, true)) return false;
      const basePrice = Number(c.regular_price ?? c.price ?? 0);
      return c.offer_price !== undefined && c.offer_price !== null && c.offer_price !== '' && Number(c.offer_price) < basePrice;
    });
    return [...offerDishes.map(d => ({ ...d, _type: 'dish' })), ...offerCombos.map(c => ({ ...c, _type: 'combo' }))];
  }, [dishes, combos]);

  const parsedCombosMetaMap = useMemo(() => {
    const map = new Map();
    for (const c of (combos || [])) {
      if (!c) continue;
      let comboItems = [];
      try { comboItems = typeof c.items === 'string' ? JSON.parse(c.items) : (c.items || []); } catch { comboItems = []; }
      const originalTotal = comboItems.reduce((s, i) => s + ((i.original_price || 0) * (i.qty || 1)), 0);
      const itemsSummaryText = comboItems.map(i => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.dish_name}`).join(' + ');
      map.set(c.id, { comboItems, originalTotal, itemsSummaryText });
    }
    return map;
  }, [combos]);

  const scrollToCategory = useCallback((catId) => {
    triggerHaptic('light');
    if (searchQuery) setSearchQuery('');
    if (activeQuickFilter) setActiveQuickFilter('');
    setSelectedCategory(catId);
    setShowCategoryDrawer(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [searchQuery, activeQuickFilter]);

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
          : `https://www.google.com/search?q=${encodeURIComponent((info?.name || 'TouchQR Store') + ' ' + (info?.address || ''))}`;

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
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to reset password');

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

  // Register Page View — Self-Service Free Trial Registration Wizard
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
          handleAdminLoginSuccess(res.token, res.username || 'Admin', res.slug, res.restaurant || res);
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
          onImpersonate={(tenantToken, tenantUsername, tenantSlug, tenantName, tenantId) => {
            const targetSlug = tenantSlug || (info && info.slug) || '';
            const targetName = tenantName || targetSlug;
            localStorage.setItem('touchqr_admin_token', tenantToken);
            localStorage.setItem('touchqr_admin_user', tenantUsername);
            localStorage.setItem('touchqr_admin_slug', targetSlug);
            localStorage.setItem('touchqr_superadmin_impersonating', 'true');
            localStorage.setItem('touchqr_impersonated_resto_name', targetName);
            if (tenantId) localStorage.setItem('touchqr_impersonated_resto_id', String(tenantId));

            setAdminToken(tenantToken);
            setAdminUsername(tenantUsername);
            setAdminSlug(targetSlug);
            setIsImpersonating(true);
            setImpersonatedRestoName(targetName);
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

  const renderMenuSkeletonCards = (neutral = false) => (
    <div aria-label="Loading Digital Menu" style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
        <div className="tq-skeleton" style={{ height: '16px', width: '132px', borderRadius: '6px' }} />
        <div className="tq-skeleton" style={{ height: '14px', width: '48px', borderRadius: '9999px' }} />
      </div>
      <div className="dish-list-grid">
        {[0, 1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            style={{
              background: neutral ? '#FFFFFF' : 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
              borderRadius: 'var(--radius-md, 14px)',
              border: '1px solid rgba(148, 163, 184, 0.24)',
              boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="tq-skeleton" style={{ width: '12px', height: '12px', borderRadius: '2px', flexShrink: 0 }} />
                <div className="tq-skeleton" style={{ height: '14px', width: idx % 2 === 0 ? '64%' : '54%' }} />
              </div>
              <div className="tq-skeleton" style={{ height: '10px', width: '88%' }} />
              <div className="tq-skeleton" style={{ height: '10px', width: '62%' }} />
              {idx % 2 === 0 && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                  <div className="tq-skeleton" style={{ width: '42px', height: '18px', borderRadius: '9999px' }} />
                  <div className="tq-skeleton" style={{ width: '42px', height: '18px', borderRadius: '9999px' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div className="tq-skeleton" style={{ height: '16px', width: '36px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div className="tq-skeleton" style={{ width: '62px', height: '62px', borderRadius: '10px' }} />
                <div className="tq-skeleton" style={{ width: '52px', height: '22px', borderRadius: '9999px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Global Initial Loading Skeleton Guard (Pure neutral skeleton to avoid theme/color flashing before business theme loads)
  if (loading && view === 'menu' && !info) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Neutral Header Skeleton matching CustomerHeader.jsx proportions */}
        <header style={{
          background: '#FFFFFF',
          padding: 'max(9px, env(safe-area-inset-top, 0px)) 14px 10px',
          borderBottom: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
            <div className="tq-skeleton" style={{ width: '74px', height: '22px', borderRadius: '9999px' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <div className="tq-skeleton" style={{ width: '68px', height: '22px', borderRadius: '9999px' }} />
              <div className="tq-skeleton" style={{ width: '64px', height: '22px', borderRadius: '9999px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="tq-skeleton" style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="tq-skeleton" style={{ width: '52%', height: '16px' }} />
              <div className="tq-skeleton" style={{ width: '38%', height: '10px' }} />
            </div>
          </div>
        </header>

        {/* Search Bar Skeleton */}
        <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '10px 12px 4px' }}>
          <div className="tq-skeleton" style={{ height: '40px', width: '100%', borderRadius: '9999px' }} />
        </div>

        {/* Category Jump Rail Skeleton */}
        <div style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '6px 0'
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', padding: '0 12px', display: 'flex', gap: '7px', overflow: 'hidden' }}>
            {[64, 88, 78, 92, 72].map((w, i) => (
              <div key={i} className="tq-skeleton" style={{ height: '28px', width: `${w}px`, borderRadius: '9999px', flexShrink: 0 }} />
            ))}
          </div>
        </div>

        {/* Toolbar + Main Dish Card Skeletons */}
        <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', padding: '6px 12px 96px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '2px' }}>
            <div className="tq-skeleton" style={{ width: '64px', height: '16px' }} />
            <div className="tq-skeleton" style={{ width: '108px', height: '26px', borderRadius: '9999px' }} />
          </div>
          {renderMenuSkeletonCards(true)}
        </div>

        {/* Neutral Slim Bottom Dock Placeholder */}
        <div style={{
          position: 'fixed',
          bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 28px)',
          maxWidth: '440px',
          background: '#FFFFFF',
          borderRadius: '9999px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
          padding: '7px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div className="tq-skeleton" style={{ width: '58px', height: '24px', borderRadius: '9999px' }} />
          <div className="tq-skeleton" style={{ width: '88px', height: '30px', borderRadius: '9999px' }} />
          <div className="tq-skeleton" style={{ width: '58px', height: '24px', borderRadius: '9999px' }} />
        </div>
      </div>
    );
  }

  // Check if requested restaurant is deleted / not found
  if (restaurantStatus === 'not_found') {
    const isDemoSlug = getSlugFromUrl() === 'touchqr-demo';
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 20px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF', textAlign: 'center'
      }}>
        <div style={{
          fontSize: '4.5rem', marginBottom: '16px', filter: 'drop-shadow(0 4px 16px rgba(239,68,68,0.3))'
        }}>{isDemoSlug ? '🍽️' : '❌'}</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isDemoSlug ? '#E2E8F0' : '#F87171', margin: '0 0 8px 0' }}>
          {isDemoSlug ? 'Live Demo Unavailable' : '404 - Page Not Found'}
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          {isDemoSlug
            ? 'The interactive demo preview is not provisioned in this environment. You can explore TouchQR features from the homepage or start a free trial.'
            : 'The page you are looking for does not exist or has been moved.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
          {isDemoSlug && (
            <button
              onClick={() => { window.location.href = '/register'; }}
              style={{
                padding: '13px 30px',
                borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              ⚡ Start Free Trial
            </button>
          )}
        </div>
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
          Outlet Temporarily Offline
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#E2E8F0', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          <strong>{info?.name || 'Yeh business'}</strong> ki digital menu service filhal suspended hai. Kripya business administration se sampark karein.
        </p>
      </div>
    );
  }

  // Dedicated Kitchen Display System (KDS) View Render
  if (view === 'kitchen-kds') {
    return (
      <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', background: '#090D16', color: '#F8FAFC', minHeight: '100dvh', boxSizing: 'border-box', fontWeight: 800 }}>🍳 Loading Kitchen Display System...</div>}>
        <StandaloneKdsPage slug={getSlugFromUrl() || new URLSearchParams(window.location.search).get('slug') || ''} />
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
          Setting up your portal security & launching Admin Dashboard...
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
          <span style={{ fontSize: '0.92rem' }}>🔑 Verifying Portal Security...</span>
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
          isImpersonating={isImpersonating}
          impersonatedRestoName={impersonatedRestoName}
          onExitImpersonation={handleExitImpersonation}
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
        background: 'var(--header-gradient, #0A2315)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '420px',
          background: 'var(--theme-modal-bg, #FFFFFF)',
          color: 'var(--text-dark, #1C1917)',
          borderRadius: '24px',
          padding: '36px 24px',
          border: '2px solid var(--gold-bright, #D4AF37)',
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

          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-emerald, #0A2315)', marginBottom: '8px' }}>
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

          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted, #666157)', marginBottom: '24px', lineHeight: 1.4 }}>
            The Digital Menu service for this business is currently suspended or past subscription renewal. Please contact business administration.
          </p>

          <a
            href={`tel:${info.phone || ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--theme-btn-gradient, #0A2315)',
              color: 'var(--theme-btn-text, #DFBA67)',
              padding: '12px 24px',
              borderRadius: '9999px',
              fontWeight: 800,
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            <Phone size={16} /> Contact Business Management
          </a>
        </div>
      </div>
    );
  }

  // Customer Digital Menu Render (Clean public view — NO admin controls)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* 📶 Offline / Network Status Banner */}
      {!isOnline && (
        <div style={{
          background: 'linear-gradient(135deg, #334155 0%, #1E293B 100%)',
          color: '#F8FAFC',
          padding: '8px 14px',
          borderBottom: '1.5px solid #64748B',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.76rem',
          fontWeight: 800,
          position: 'sticky',
          top: 0,
          zIndex: 4000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
        }}>
          <span>📶</span>
          <span>{lang === 'hi' ? 'ऑफ़लाइन मोड • सहेजा गया मेनू प्रदर्शित हो रहा है' : 'Offline Mode • Showing saved digital menu'}</span>
        </div>
      )}

      {/* Customer Header */}
      <CustomerHeader
        info={info}
        lang={lang}
        tableNum={effectiveTableNum}
        spaceLabel={getDynamicSpaceLabel()}
        onToggleLang={() => {
          triggerHaptic('light');
          setLang(lang === 'en' ? 'hi' : 'en');
        }}
        onOpenInfoModal={() => {
          triggerHaptic('light');
          setShowInfoModal(true);
        }}
        onCallStaff={(info?.business_type === 'cinema_theatre' || info?.service_model === 'cinema' || info?.service_model === 'seat_service' || currentSpaceType === 'cinema_seat' || currentSpaceType === 'cinema' || String(info?.table_prefix || '').toLowerCase() === 'cinema_seat') ? null : () => setShowServiceModal(true)}
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

      {/* Inactive / Paused Space Customer Banner */}
      {isCurrentSpacePaused && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: '14px',
          padding: '10px 14px',
          maxWidth: '776px',
          width: 'calc(100% - 24px)',
          margin: '10px auto 2px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#92400E',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.14)',
          animation: 'tqCardIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⏸️</span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: '0.86rem', color: '#92400E', overflowWrap: 'break-word' }}>
              {lang === 'hi'
                ? `${getDynamicSpaceLabel() || 'यह स्थान'} अस्थायी रूप से रोका गया है`
                : `${getDynamicSpaceLabel() || 'This space'} is temporarily paused`}
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#B45309', display: 'block', marginTop: '2px', lineHeight: 1.35 }}>
              {lang === 'hi'
                ? 'इस स्थान के लिए डिजिटल ऑर्डरिंग अभी बंद है। कृपया स्टाफ से संपर्क करें।'
                : 'Digital ordering is offline for this space. Please contact staff for assistance.'}
            </span>
          </div>
        </div>
      )}

      {/* Live Customer Order Tracker Banner */}
      {activeOrderTrack && (info?.direct_ordering_enabled !== false && info?.direct_ordering_enabled !== 0) && (() => {
        const statusRaw = String(activeOrderTrack.status || '').toLowerCase();
        const trackRoundsArr = Array.isArray(activeOrderTrack.session_summary?.rounds)
          ? activeOrderTrack.session_summary.rounds
          : (Array.isArray(activeOrderTrack.rounds) ? activeOrderTrack.rounds : []);
        const getRoundStatusMeta = (rObj, idx = 0) => {
          const roundNum = rObj?.round_number || (idx + 1);
          const raw = String(rObj?.status || 'pending').toLowerCase();
          const rDone = raw === 'completed';
          const rCancelled = raw === 'cancelled' || raw === 'rejected';
          const rServed = raw === 'served';
          const rPrepared = !rDone && !rCancelled && !rServed && (
            raw === 'ready' ||
            rObj?.kitchen_prepared === 1 ||
            rObj?.kitchen_prepared === '1' ||
            rObj?.kitchen_prepared === true
          );
          const rPreparing = !rDone && !rCancelled && !rServed && !rPrepared && (
            raw === 'accepted' || raw === 'kitchen' || raw === 'preparing'
          );
          const shortLabel = rDone
            ? (lang === 'hi' ? 'पूर्ण' : 'Completed')
            : rCancelled
              ? (lang === 'hi' ? 'रद्द' : 'Cancelled')
              : rServed
                ? (lang === 'hi' ? 'सर्व ✓' : 'Served ✓')
                : rPrepared
                  ? (lang === 'hi' ? 'तैयार 🛎️' : 'Ready 🛎️')
                  : rPreparing
                    ? (lang === 'hi' ? 'बन रहा है 👨‍🍳' : 'Preparing 👨‍🍳')
                    : (lang === 'hi' ? 'प्रतीक्षा 🟡' : 'Pending 🟡');
          const modalBg = rCancelled ? '#FEF2F2' : (rDone || rServed) ? '#ECFDF5' : rPrepared ? '#DCFCE7' : rPreparing ? '#EFF6FF' : '#FFFBEB';
          const modalColor = rCancelled ? '#B91C1C' : (rDone || rServed) ? '#047857' : rPrepared ? '#15803D' : rPreparing ? '#1D4ED8' : '#B45309';
          const modalBorder = rCancelled ? '#FECACA' : (rDone || rServed) ? '#A7F3D0' : rPrepared ? '#86EFAC' : rPreparing ? '#BFDBFE' : '#FDE68A';
          const pillBg = rCancelled ? 'rgba(248, 113, 113, 0.22)' : (rDone || rServed || rPrepared) ? 'rgba(74, 222, 128, 0.22)' : rPreparing ? 'rgba(56, 189, 248, 0.22)' : 'rgba(251, 191, 36, 0.22)';
          const pillBorder = rCancelled ? 'rgba(248, 113, 113, 0.45)' : (rDone || rServed || rPrepared) ? 'rgba(74, 222, 128, 0.45)' : rPreparing ? 'rgba(56, 189, 248, 0.45)' : 'rgba(251, 191, 36, 0.45)';
          return { roundNum, raw, rDone, rCancelled, rServed, rPrepared, rPreparing, shortLabel, modalBg, modalColor, modalBorder, pillBg, pillBorder };
        };
        const roundMetas = trackRoundsArr.map((r, i) => getRoundStatusMeta(r, i));
        const latestRoundObj = trackRoundsArr.length > 0 ? trackRoundsArr[trackRoundsArr.length - 1] : null;
        const effectiveStatusRaw = String((latestRoundObj?.status || statusRaw || '')).toLowerCase();
        const hasRoundPrepared = trackRoundsArr.some(r =>
          (r.kitchen_prepared === 1 || r.kitchen_prepared === '1' || r.kitchen_prepared === true) &&
          !['served', 'completed', 'cancelled', 'rejected'].includes(String(r.status || '').toLowerCase())
        );
        const isCompleted = statusRaw === 'completed' || (effectiveStatusRaw === 'completed' && trackRoundsArr.length > 0 && trackRoundsArr.every(r => String(r.status || '').toLowerCase() === 'completed'));
        const isCancelled = statusRaw === 'cancelled' || statusRaw === 'rejected';
        const isServed = trackRoundsArr.length > 0
          ? (roundMetas.some(m => m.rServed) && roundMetas.every(m => m.rServed || m.rDone || m.rCancelled))
          : (effectiveStatusRaw === 'served');
        const isPrepared = trackRoundsArr.length > 0
          ? Boolean(
            effectiveStatusRaw === 'ready' ||
            latestRoundObj?.kitchen_prepared === 1 ||
            latestRoundObj?.kitchen_prepared === '1' ||
            latestRoundObj?.kitchen_prepared === true ||
            hasRoundPrepared
          )
          : Boolean(
            activeOrderTrack.kitchen_prepared === 1 ||
            activeOrderTrack.kitchen_prepared === '1' ||
            activeOrderTrack.kitchen_prepared === true ||
            statusRaw === 'ready'
          );
        const isPreparing = trackRoundsArr.length > 0
          ? (!isServed && !isPrepared && (effectiveStatusRaw === 'accepted' || effectiveStatusRaw === 'kitchen' || effectiveStatusRaw === 'preparing' || roundMetas.some(m => m.rPreparing)))
          : (effectiveStatusRaw === 'accepted' || effectiveStatusRaw === 'kitchen' || effectiveStatusRaw === 'preparing');
        const isActiveCooking = trackRoundsArr.length > 0
          ? (!isCompleted && !isCancelled && roundMetas.some(m => !m.rDone && !m.rCancelled && !m.rServed))
          : (!isCompleted && !isCancelled && !isServed);

        const bizType = String(info?.business_type || '').toLowerCase();
        const spaceStr = String(activeOrderTrack.table_number || '').toLowerCase();
        const isCinema = bizType === 'cinema_theatre' || spaceStr.includes('screen') || spaceStr.includes('seat');
        const isRoom = bizType === 'hotel_resort' || spaceStr.includes('room');
        const isCounter = spaceStr.includes('counter') || ['bakery_confectionery', 'sweet_shop', 'fast_food_qsr', 'cloud_kitchen', 'food_truck'].includes(bizType);

        const stepIdx = isCancelled ? -1 : (isCompleted || isServed) ? 3 : isPrepared ? 2 : isPreparing ? 1 : 0;
        const dotColor = isCancelled ? '#F87171' : (isCompleted || isServed || isPrepared) ? '#4ADE80' : isPreparing ? '#38BDF8' : '#FBBF24';
        const timerText = autoKillSeconds
          ? ` (${lang === 'hi' ? 'बंद होगा' : 'Closes in'} ${autoKillSeconds >= 60 ? `${Math.floor(autoKillSeconds / 60)}m ${autoKillSeconds % 60}s` : `${autoKillSeconds}s`})`
          : '';

        const rejectReasonText = (isCancelled && activeOrderTrack.rejection_reason)
          ? String(activeOrderTrack.rejection_reason).trim()
          : '';
        const readyRoundNums = roundMetas.filter(m => m.rPrepared).map(m => m.roundNum);
        const pendingOrPrepRounds = roundMetas.filter(m => !m.rPrepared && !m.rServed && !m.rDone && !m.rCancelled);
        const hasMixedReadyAndCooking = roundMetas.length > 1 && readyRoundNums.length > 0 && pendingOrPrepRounds.length > 0;
        const statusLabel = isCompleted
          ? (lang === 'hi' ? `ऑर्डर पूर्ण और भुगतान सफल 🏁${timerText}` : `Order Completed & Paid 🏁${timerText}`)
          : isCancelled
            ? (lang === 'hi'
              ? `ऑर्डर रद्द किया गया 🔴${rejectReasonText ? ` — ${rejectReasonText}` : ''}${timerText}`
              : `Order Cancelled 🔴${rejectReasonText ? ` — ${rejectReasonText}` : ''}${timerText}`)
            : hasMixedReadyAndCooking
              ? (lang === 'hi'
                ? `राउंड ${readyRoundNums.join(', ')} तैयार 🛎️ • राउंड ${pendingOrPrepRounds.map(m => m.roundNum).join(', ')} ${pendingOrPrepRounds.some(m => m.rPreparing) ? 'बन रहा है 👨‍🍳' : 'प्रतीक्षा में 🟡'}`
                : `Round ${readyRoundNums.join(', ')} Ready 🛎️ • Round ${pendingOrPrepRounds.map(m => m.roundNum).join(', ')} ${pendingOrPrepRounds.some(m => m.rPreparing) ? 'Preparing 👨‍🍳' : 'Pending 🟡'}`)
              : isServed
                ? (isCinema ? (lang === 'hi' ? 'सीट पर ऑर्डर सर्व किया गया 🎬' : 'Delivered to Seat 🎬 Enjoy!')
                  : isRoom ? (lang === 'hi' ? 'रूम में ऑर्डर डिलीवर हो गया 🏨' : 'Delivered to Room 🏨 Enjoy!')
                    : isCounter ? (lang === 'hi' ? 'काउंटर पर ऑर्डर दिया गया 🧾' : 'Handed Over at Counter 🧾')
                      : (lang === 'hi' ? 'टेबल पर ऑर्डर सर्व हो गया 🍽️' : 'Served to Table 🍽️ Enjoy!'))
                : isPrepared
                  ? (isCinema ? (lang === 'hi' ? 'ऑर्डर तैयार है! सीट पर आ रहा है 🎬' : 'Order Ready! Staff bringing to seat 🎬')
                    : isRoom ? (lang === 'hi' ? 'ऑर्डर तैयार है! रूम में आ रहा है 🏨' : 'Order Ready! Delivering to room 🏨')
                      : isCounter ? (lang === 'hi' ? 'ऑर्डर तैयार है! काउंटर से लें ⚡' : 'Order Ready! Pickup at counter ⚡')
                        : (lang === 'hi' ? 'ऑर्डर तैयार है! टेबल पर आ रहा है 🛎️' : 'Order Ready! Staff bringing to table 🛎️'))
                  : isPreparing
                    ? (lang === 'hi' ? 'ऑर्डर स्वीकार — तैयार हो रहा है 👨‍🍳' : 'Accepted — Preparing Now 👨‍🍳')
                    : effectiveStatusRaw === 'pending'
                      ? (lang === 'hi' ? 'स्वीकृति की प्रतीक्षा में 🟡' : 'Pending Acceptance 🟡')
                      : (lang === 'hi' ? 'ऑर्डर प्राप्त हुआ 🟢' : 'Order Received 🟢');

        const handleEndTrackingSession = () => {
          if (isActiveCooking) {
            const msg = lang === 'hi'
              ? 'आपका ऑर्डर अभी चल रहा है। क्या आप वाकई लाइव ट्रैकिंग बंद करना चाहते हैं?'
              : 'Your order is still active. Are you sure you want to end live tracking?';
            if (!window.confirm(msg)) return;
          }
          triggerHaptic('light');
          if (activeOrderTrack?.id) {
            localStorage.removeItem(`touchqr_order_completed_time_${activeOrderTrack.id}`);
          }
          const scopedKey = getOrderStorageKey(activeOrderTrack?.table_number, activeOrderTrack?.space_type || currentSpaceType);
          if (scopedKey) localStorage.removeItem(scopedKey);
          setActiveOrderId(null);
          setActiveOrderTrack(null);
          setCurrentTableNum('');
          setSessionExpired(true);
          setAutoKillSeconds(null);
          setCartItems([]);
          setShowCartDrawer(false);
          setShowRunningOrderModal(false);
          const currentSlug = getSlugFromUrl() || (info && info.slug) || '';
          const cleanPath = currentSlug ? `/${currentSlug}` : '/';
          window.history.replaceState({}, '', cleanPath);
        };

        const consolidatedSummary = activeOrderTrack.session_summary || activeOrderTrack.bill_summary || (Array.isArray(activeOrderTrack.rounds) ? activeOrderTrack : null);
        const trackRounds = Array.isArray(consolidatedSummary?.rounds) && consolidatedSummary.rounds.length > 1
          ? consolidatedSummary.rounds
          : [];
        let trackParsedItems = [];
        try {
          const rawSummaryItems = consolidatedSummary?.items || activeOrderTrack.items;
          trackParsedItems = typeof rawSummaryItems === 'string'
            ? JSON.parse(rawSummaryItems)
            : (Array.isArray(rawSummaryItems) ? rawSummaryItems : []);
        } catch {
          trackParsedItems = [];
        }
        const trackCurrency = info?.currency_symbol || '₹';
        const trackSubtotal = Number(consolidatedSummary?.subtotal_amount ?? activeOrderTrack.subtotal_amount ?? 0);
        const trackTax = Number(consolidatedSummary?.tax_amount ?? activeOrderTrack.tax_amount ?? 0);
        const trackGrandTotal = Number(consolidatedSummary?.grand_total_amount ?? activeOrderTrack.grand_total_amount ?? activeOrderTrack.total_amount ?? 0);
        const trackNotes = activeOrderTrack.notes ? String(activeOrderTrack.notes).trim() : '';

        const renderTrackItemRow = (it, idx, showDivider, compact = false) => {
          const qty = Number(it.quantity) || 1;
          const name = it.name || it.dish_name || 'Item';
          const portion = it.portion && it.portion !== 'Regular' ? ` (${it.portion})` : '';
          const mods = Array.isArray(it.modifiers) && it.modifiers.length > 0
            ? ` + ${it.modifiers.map(m => m.name || m).join(', ')}`
            : '';
          const linePrice = Number(it.price || 0) * qty;
          return (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '10px',
              ...(compact
                ? { paddingTop: '4px', borderTop: showDivider ? '1px dashed #E2E8F0' : 'none' }
                : { paddingBottom: '8px', borderBottom: showDivider ? '1px dashed #E2E8F0' : 'none' })
            }}>
              <div style={{ fontSize: compact ? '0.82rem' : '0.84rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.35 }}>
                <span style={{ color: '#047857', fontWeight: 900 }}>{qty}×</span> {name}{portion}
                {mods && <div style={{ fontSize: compact ? '0.72rem' : '0.74rem', color: '#64748B', fontWeight: 600 }}>{mods}</div>}
              </div>
              <div style={{ fontSize: compact ? '0.82rem' : '0.84rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>
                {trackCurrency}{Math.round(linePrice).toLocaleString('en-IN')}
              </div>
            </div>
          );
        };

        return (
          <>
            <div style={{
              background: 'var(--header-gradient, linear-gradient(135deg, #0A2315 0%, #143A24 100%))',
              color: '#FFFFFF',
              padding: '9px 14px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
              animation: 'tqCardIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              <div style={{
                maxWidth: '800px',
                margin: '0 auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: '1 1 200px' }}>
                  <span
                    className={(!isCompleted && !isCancelled) ? 'tq-live-beacon' : undefined}
                    style={{
                      '--beacon-color': dotColor,
                      position: 'relative',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: dotColor,
                      boxShadow: `0 0 0 3px rgba(255,255,255,0.14)`,
                      flexShrink: 0
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ fontSize: '0.84rem', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>
                        {(activeOrderTrack.token_display || activeOrderTrack.token_number)
                          ? `${lang === 'hi' ? 'टोकन' : 'Token'} ${activeOrderTrack.token_display || `TK-${String(activeOrderTrack.token_number).padStart(2, '0')}`}`
                          : formatCustomerLocation(activeOrderTrack.table_number)}
                      </span>
                      {activeOrderTrack.round_number && Number(activeOrderTrack.round_number) > 1 && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.16)', padding: '1px 7px', borderRadius: '9999px', fontWeight: 800 }}>
                          {lang === 'hi' ? `राउंड ${activeOrderTrack.round_number}` : `Round ${activeOrderTrack.round_number}`}
                        </span>
                      )}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.88)', fontWeight: 700, display: 'block', overflowWrap: 'break-word', marginTop: '1px' }}>
                      {statusLabel}
                    </span>
                    {roundMetas.length > 1 && !isCompleted && !isCancelled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                        {roundMetas.map((rm, rmIdx) => (
                          <span
                            key={`banner-round-${rm.roundNum}-${rmIdx}`}
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              color: '#FFFFFF',
                              background: rm.pillBg,
                              border: `1px solid ${rm.pillBorder}`,
                              padding: '1px 7px',
                              borderRadius: '9999px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {`R${rm.roundNum}: ${rm.shortLabel}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="tq-tap"
                    onClick={() => { triggerHaptic('light'); setShowRunningOrderModal(true); }}
                    style={{
                      background: '#FFFFFF',
                      color: '#0F172A',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.74rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.16)'
                    }}
                  >
                    🧾 {lang === 'hi' ? 'मेरा ऑर्डर' : 'View Order'}
                  </button>
                  <button
                    type="button"
                    className="tq-tap"
                    onClick={handleEndTrackingSession}
                    aria-label={isActiveCooking ? (lang === 'hi' ? 'सेशन बंद करें' : 'End Session') : (lang === 'hi' ? 'हटाएं' : 'Dismiss')}
                    title={isActiveCooking ? (lang === 'hi' ? 'लाइव ट्रैकिंग बंद करें' : 'End Live Tracking') : (lang === 'hi' ? 'हटाएं' : 'Dismiss')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.14)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.28)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '9999px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {stepIdx >= 0 && (
                <div style={{ maxWidth: '800px', margin: '8px auto 0', display: 'flex', gap: '5px' }} aria-label="Order progress">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '9999px',
                        background: step <= stepIdx ? dotColor : 'rgba(255, 255, 255, 0.2)',
                        animation: (step === stepIdx && !isCompleted && !isCancelled) ? 'tqProgressPulse 1.6s ease-in-out infinite' : undefined,
                        transition: 'background 0.25s ease'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {showRunningOrderModal && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={lang === 'hi' ? 'आपका ऑर्डर विवरण' : 'Running Order Summary'}
                onClick={(e) => { if (e.target === e.currentTarget) setShowRunningOrderModal(false); }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.72)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  zIndex: 10040,
                  animation: 'sheetBackdropFade 0.18s ease-out'
                }}
              >
                <div
                  style={{
                    background: '#FFFFFF',
                    color: '#0F172A',
                    borderRadius: '22px',
                    width: '100%',
                    maxWidth: '430px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                    animation: 'tqPopIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                  <div style={{
                    padding: '16px 18px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                        🧾 {lang === 'hi' ? 'आपका ऑर्डर विवरण' : 'Running Order Summary'}
                      </h3>
                      <div style={{ fontSize: '0.76rem', color: '#475569', fontWeight: 700, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>
                          {(activeOrderTrack.token_display || activeOrderTrack.token_number)
                            ? `${lang === 'hi' ? 'टोकन' : 'Token'} ${activeOrderTrack.token_display || `TK-${String(activeOrderTrack.token_number).padStart(2, '0')}`}`
                            : formatCustomerLocation(activeOrderTrack.table_number)}
                        </span>
                        {activeOrderTrack.round_number && Number(activeOrderTrack.round_number) > 1 && (
                          <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '1px 7px', borderRadius: '9999px', fontSize: '0.70rem', fontWeight: 800 }}>
                            {lang === 'hi' ? `राउंड ${activeOrderTrack.round_number}` : `Round ${activeOrderTrack.round_number}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRunningOrderModal(false)}
                      aria-label={lang === 'hi' ? 'बंद करें' : 'Close'}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9999px',
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        color: '#334155',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: isCancelled ? '#FEF2F2' : '#F0FDF4',
                      border: `1px solid ${isCancelled ? '#FECACA' : '#BBF7D0'}`,
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      color: isCancelled ? '#991B1B' : '#14532D'
                    }}>
                      {statusLabel}
                    </div>

                    {trackNotes && (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        fontSize: '0.78rem',
                        color: '#92400E',
                        fontWeight: 700
                      }}>
                        📝 {lang === 'hi' ? 'किचन नोट:' : 'Kitchen Note:'} {trackNotes}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {trackRounds.length > 1 ? (
                        trackRounds.map((rnd, rIdx) => {
                          const rItems = Array.isArray(rnd.items) ? rnd.items : [];
                          const rMeta = getRoundStatusMeta(rnd, rIdx);
                          return (
                            <div key={rnd.id || rIdx} style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.72rem', fontWeight: 900, color: '#1D4ED8' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span>{lang === 'hi' ? `राउंड ${rMeta.roundNum}` : `Round ${rMeta.roundNum}`}</span>
                                  <span style={{
                                    background: rMeta.modalBg,
                                    color: rMeta.modalColor,
                                    border: `1px solid ${rMeta.modalBorder}`,
                                    padding: '1px 7px',
                                    borderRadius: '9999px',
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {rMeta.shortLabel}
                                  </span>
                                </div>
                                <span style={{ color: '#475569', fontWeight: 700 }}>{trackCurrency}{Math.round(Number(rnd.grand_total_amount || 0)).toLocaleString('en-IN')}</span>
                              </div>
                              {rnd.notes && String(rnd.notes).trim() && (
                                <div style={{ fontSize: '0.72rem', color: '#92400E', fontWeight: 700 }}>
                                  📝 {String(rnd.notes).trim()}
                                </div>
                              )}
                              {rItems.map((it, idx) => renderTrackItemRow(it, idx, idx > 0, true))}
                            </div>
                          );
                        })
                      ) : trackParsedItems.map((it, idx) => renderTrackItemRow(it, idx, idx < trackParsedItems.length - 1, false))}
                    </div>

                    <div style={{
                      background: '#F8FAFC',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px'
                    }}>
                      {trackTax > 0 && trackSubtotal > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                            <span>{lang === 'hi' ? 'सबटोटल' : 'Subtotal'}</span>
                            <span>{trackCurrency}{trackSubtotal.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                            <span>{lang === 'hi' ? 'टैक्स / GST' : 'Taxes & GST'}</span>
                            <span>{trackCurrency}{trackTax.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.96rem', fontWeight: 900, color: '#0F172A', paddingTop: trackTax > 0 ? '4px' : 0 }}>
                        <span>{lang === 'hi' ? 'कुल राशि' : 'Running Total'}</span>
                        <span>{trackCurrency}{Math.round(trackGrandTotal).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      className="tq-tap"
                      onClick={() => setShowRunningOrderModal(false)}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        background: '#0F172A',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      {lang === 'hi' ? 'ठीक है' : 'Done'}
                    </button>
                    <button
                      type="button"
                      onClick={handleEndTrackingSession}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        background: 'transparent',
                        color: '#DC2626',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {isActiveCooking
                        ? (lang === 'hi' ? 'लाइव ट्रैकिंग सेशन बंद करें' : 'End Live Tracking Session')
                        : (lang === 'hi' ? 'ट्रैकिंग हटाएं' : 'Dismiss Order Tracker')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Polite Post-Bill Completed Banner */}
      {!activeOrderTrack && !sessionExpired && lastCompletedBill && (() => {
        const summary = lastCompletedBill.bill_summary || lastCompletedBill;
        const sym = getCurrencySymbol(summary.currency_symbol || info?.currency_symbol);
        const totalPaid = Number(summary.grand_total_amount) > 0
          ? Number(summary.grand_total_amount)
          : (Number(lastCompletedBill.total_amount) || 0);
        const spaceTxt = lastCompletedBill.spaceLabelSnapshot || getDynamicSpaceLabel(lastCompletedBill.table_number) || '';

        return (
          <div style={{
            background: 'linear-gradient(135deg, #064E3B 0%, #047857 100%)',
            color: '#FFFFFF',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)',
            animation: 'tqCardIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              maxWidth: '800px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <strong style={{ fontSize: '0.84rem', display: 'block', lineHeight: 1.3 }}>
                  🙏 {lang === 'hi' ? 'बिल भुगतान पूर्ण — पधारने के लिए धन्यवाद!' : 'Visit Completed — Thanks for dining with us!'}
                </strong>
                <span style={{ fontSize: '0.73rem', color: '#D1FAE5', fontWeight: 700, display: 'block', marginTop: '1px' }}>
                  {spaceTxt ? `${spaceTxt} • ` : ''}{lang === 'hi' ? 'भुगतान:' : 'Paid'} {sym}{formatPriceNumber(totalPaid)}
                  {(isPostBillViewOnly || isViewOnlyUrl) && (
                    <span style={{ marginLeft: '6px', padding: '1px 7px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', fontSize: '0.66rem', fontWeight: 800 }}>
                      👀 {lang === 'hi' ? 'केवल देखने के लिए मेनू' : 'View-Only Menu'}
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="tq-tap"
                  onClick={() => { triggerHaptic('light'); setBillCompletedModal(lastCompletedBill); }}
                  style={{
                    background: '#FFFFFF',
                    color: '#064E3B',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '5px 11px',
                    fontSize: '0.73rem',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  🧾 {lang === 'hi' ? 'बिल देखें' : 'View Receipt'}
                </button>
                {Boolean(info?.google_reviews_enabled) && (
                  <button
                    type="button"
                    className="tq-tap"
                    onClick={() => { triggerHaptic('light'); handleRateUsClick(); }}
                    style={{
                      background: 'linear-gradient(135deg, #FDE047 0%, #F59E0B 100%)',
                      color: '#0F172A',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '5px 11px',
                      fontSize: '0.73rem',
                      fontWeight: 900,
                      cursor: 'pointer'
                    }}
                  >
                    ⭐ {lang === 'hi' ? 'रेट करें' : 'Rate Us'}
                  </button>
                )}
                <button
                  type="button"
                  className="tq-tap"
                  aria-label="Dismiss completed banner"
                  onClick={() => { triggerHaptic('light'); setLastCompletedBill(null); setCompletedSpaceSnapshot(null); persistLastCompletedBill(getActiveStorageTenantSlug(), null); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.16)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    borderRadius: '50%',
                    width: '26px',
                    height: '26px',
                    padding: 0,
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quiet Post-Settle View-Only Indicator (remains active if completed banner is dismissed) */}
      {!activeOrderTrack && !sessionExpired && !lastCompletedBill && isPostBillViewOnly && (
        <div style={{
          background: '#F8FAFC',
          color: '#475569',
          padding: '8px 14px',
          borderBottom: '1px solid #E2E8F0',
          textAlign: 'center',
          fontSize: '0.76rem',
          fontWeight: 700
        }}>
          👀 {lang === 'hi'
            ? 'मेनू केवल देखने के लिए है • नया ऑर्डर करने के लिए टेबल का QR कोड दोबारा स्कैन करें।'
            : 'View-Only Menu • Scan your table QR code again to place a new order.'}
        </div>
      )}

      {/* Session Expired & Invalid Space Warning Banners */}
      {(() => {
        const isInvalidSpace = Boolean(currentTableNum && info && !isTableValid);
        if (!sessionExpired && !isInvalidSpace) return null;

        const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
        const isCin = isCinemaVenue || activeType === 'cinema_seat' || activeType === 'cinema' || String(currentTableNum || '').toLowerCase().includes('screen') || String(currentTableNum || '').toLowerCase().includes('seat');
        const isRoom = isHotelVenue || activeType === 'room' || String(currentTableNum || '').toLowerCase().includes('room');
        const isCounter = isCounterSpace || activeType === 'counter' || String(currentTableNum || '').toLowerCase().includes('counter');

        const alerts = [];
        if (sessionExpired) {
          alerts.push({
            key: 'session-expired',
            icon: '📱',
            title: lang === 'hi' ? 'सेशन समाप्त (केवल देखने के लिए मेनू):' : 'Session Expired (Read-Only Menu):',
            body: isCin
              ? (lang === 'hi' ? 'सीट सेशन समाप्त हो गया है। नया ऑर्डर करने के लिए सीट QR कोड दोबारा स्कैन करें।' : 'Seat session ended. Please scan the seat QR code again to place a new order.')
              : isRoom
                ? (lang === 'hi' ? 'रूम सेशन समाप्त हो गया है। नया ऑर्डर करने के लिए रूम QR कोड दोबारा स्कैन करें।' : 'Room session ended. Please scan the room QR code again to place a new order.')
                : isCounter
                  ? (lang === 'hi' ? 'काउंटर सेशन समाप्त हो गया है। नया ऑर्डर करने के लिए काउंटर QR कोड दोबारा स्कैन करें।' : 'Counter session ended. Please scan the counter QR code again to place a new order.')
                  : (lang === 'hi' ? 'टेबल सेशन समाप्त हो गया है। नया ऑर्डर करने के लिए टेबल QR कोड दोबारा स्कैन करें।' : 'Table session ended. Please scan the table QR code again to place a new order.'),
            onDismiss: () => setSessionExpired(false)
          });
        }
        if (isInvalidSpace) {
          const scanPrompt = isCin
            ? (lang === 'hi' ? 'ऑर्डर करने के लिए अपनी सिनेमा सीट पर लगा आधिकारिक QR कोड स्कैन करें।' : 'Please scan the official QR code at your cinema seat to order.')
            : isRoom
              ? (lang === 'hi' ? 'ऑर्डर करने के लिए अपने रूम का आधिकारिक QR कोड स्कैन करें।' : 'Please scan the official QR code in your room to order.')
              : isCounter
                ? (lang === 'hi' ? 'ऑर्डर करने के लिए काउंटर का आधिकारिक QR कोड स्कैन करें।' : 'Please scan the official QR code at the counter to order.')
                : (lang === 'hi' ? 'ऑर्डर करने के लिए अपनी टेबल का आधिकारिक QR कोड स्कैन करें।' : 'Please scan the official QR code at your dining table to order.');
          const locationDisplay = formatCustomerLocation(currentTableNum);

          alerts.push({
            key: 'invalid-space',
            icon: '⚠️',
            title: isCin
              ? (lang === 'hi' ? 'अमान्य सीट QR:' : 'Invalid Seat QR:')
              : isRoom
                ? (lang === 'hi' ? 'अमान्य रूम QR:' : 'Invalid Room QR:')
                : isCounter
                  ? (lang === 'hi' ? 'अमान्य काउंटर QR:' : 'Invalid Counter QR:')
                  : (lang === 'hi' ? 'अमान्य टेबल QR:' : 'Invalid Table QR:'),
            body: !initialSpaceInfo.isValidTokenShape
              ? (lang === 'hi' ? `यह QR कोड अधूरा या बदला हुआ है। ${scanPrompt} (मेनू केवल देखने के लिए है)।` : `This QR code is incomplete or modified. ${scanPrompt} (Menu in View-Only mode).`)
              : (lang === 'hi' ? `${locationDisplay} पंजीकृत नहीं है। ${scanPrompt} (मेनू केवल देखने के लिए है)।` : `${locationDisplay} is not registered. ${scanPrompt} (Menu in View-Only mode).`),
            onDismiss: () => setCurrentTableNum('')
          });
        }

        return alerts.map((al) => (
          <div
            key={al.key}
            style={{
              background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
              color: '#FFFFFF',
              padding: '10px 14px',
              borderBottom: '1.5px solid #F87171',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.24)',
              animation: 'tqCardIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{
              maxWidth: '800px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.82rem',
              fontWeight: 700
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 200px' }}>
                <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{al.icon}</span>
                <span style={{ minWidth: 0, overflowWrap: 'break-word', lineHeight: 1.4 }}>
                  <strong>{al.title}</strong> {al.body}
                </span>
              </div>
              <button
                type="button"
                className="tq-tap"
                onClick={() => { triggerHaptic('light'); al.onDismiss(); }}
                style={{
                  background: '#FFFFFF',
                  color: '#991B1B',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '4px 11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                {lang === 'hi' ? 'ठीक है ✕' : 'Got it ✕'}
              </button>
            </div>
          </div>
        ));
      })()}

      {/* Live Search Bar & Quick Micro-Filter Pills */}
      <SearchBar
        value={searchQuery}
        onChange={handleSearchChange}
        onClear={() => setSearchQuery('')}
        activeQuickFilter={activeQuickFilter}
        onQuickFilter={handleQuickFilterChange}
        totalResultsCount={totalMatchingDishesCount}
        filtersVisibility={info?.filters_visibility}
        businessType={info?.business_type}
        restoType={info?.resto_type}
        foodType={info?.food_type}
        isPureVeg={isPureVegResto}
        lang={lang}
        currencySymbol={getCurrencySymbol(info?.currency_symbol)}
      />

      {/* Sticky Category Quick Jump Rail (only shows populated categories to customers) */}
      <CategoryJumpRail
        categories={populatedCategories}
        lang={lang}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          if (searchQuery) setSearchQuery('');
          if (activeQuickFilter) setActiveQuickFilter('');
          setSelectedCategory(catId);
        }}
        hasCombos={combos.length > 0 && info?.filters_visibility?.combo !== false}
      />

      {/* Toolbar: View Switcher */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '6px 12px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
          <h2 style={{
            fontSize: '0.96rem',
            fontWeight: 800,
            color: 'var(--text-dark, var(--primary-emerald))',
            margin: 0
          }}>
            {lang === 'hi' ? 'मेनू' : 'Menu'}
          </h2>
          {(searchQuery || activeQuickFilter || selectedCategory !== 'all') && (
            <>
              <span style={{
                fontSize: '0.72rem',
                background: 'var(--bg-secondary, #F1F5F9)',
                color: 'var(--text-muted, #475569)',
                border: '1px solid var(--theme-card-border, rgba(148, 163, 184, 0.28))',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}>
                {totalMatchingDishesCount} {lang === 'hi' ? 'आइटम्स' : (totalMatchingDishesCount === 1 ? 'item' : 'items')}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  handleClearAllSearchAndFilters();
                }}
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-secondary, #F1F5F9)',
                  color: '#DC2626',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ✕ {lang === 'hi' ? 'रीसेट' : 'Reset'}
              </button>
            </>
          )}
        </div>

        {/* List vs Grid Layout Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          padding: '3px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <button
            onClick={() => {
              triggerHaptic('light');
              setLayoutMode('list');
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: layoutMode === 'list' ? 'var(--primary-emerald)' : 'transparent',
              color: layoutMode === 'list' ? 'var(--theme-btn-text, #FFFFFF)' : 'var(--text-muted)',
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
            onClick={() => {
              triggerHaptic('light');
              setLayoutMode('grid');
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: layoutMode === 'grid' ? 'var(--primary-emerald)' : 'transparent',
              color: layoutMode === 'grid' ? 'var(--theme-btn-text, #FFFFFF)' : 'var(--text-muted)',
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
        padding: (cartItems.length > 0 && isDirectOrderingActive) ? '8px 12px 124px' : '8px 12px 88px'
      }}>
        {loading ? renderMenuSkeletonCards() : restaurantStatus === 'not_found' ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--theme-modal-bg, #FFFFFF)',
            borderRadius: '24px',
            border: '1.5px solid #FEE2E2',
            boxShadow: 'var(--theme-shadow, 0 10px 30px rgba(0,0,0,0.06))',
            margin: '20px 0'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '14px' }}>❌</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EF4444', margin: '0 0 8px 0' }}>
              Business / Outlet Not Found
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted, #64748B)', maxWidth: '420px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
              Yeh outlet ab platform par active nahi hai ya iska link delete kar diya gaya hai.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '12px 26px',
                borderRadius: '9999px',
                border: 'none',
                background: 'var(--theme-btn-gradient, linear-gradient(135deg, #0A2315 0%, #164E2A 100%))',
                color: 'var(--theme-btn-text, #FFD700)',
                fontWeight: 900,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: 'var(--theme-shadow, 0 4px 14px rgba(10,35,21,0.25))'
              }}
            >
              🏠 Go to Main Platform
            </button>
          </div>
        ) : restaurantStatus === 'suspended' ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--theme-modal-bg, #FFFFFF)',
            borderRadius: '24px',
            border: '1.5px solid var(--theme-modal-border, #FEF3C7)',
            boxShadow: 'var(--theme-shadow, 0 10px 30px rgba(0,0,0,0.06))',
            margin: '20px 0'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '14px' }}>🔒</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F59E0B', margin: '0 0 8px 0' }}>
              Business Temporarily Offline
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted, #64748B)', maxWidth: '420px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
              <strong>{info?.name || 'Yeh outlet'}</strong> ki digital menu service filhal suspended hai. Kripya business owner se sampark karein.
            </p>
          </div>
        ) : (groupedDishes.length === 0 && filteredCombos.length === 0) ? (
          <div style={{
            textAlign: 'center',
            padding: '44px 20px',
            background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--theme-card-border, var(--border-light))',
            boxShadow: 'var(--theme-shadow, var(--shadow-sm))'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍽️</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 6px 0' }}>
              {(searchQuery || activeQuickFilter)
                ? (lang === 'hi' ? 'कोई व्यंजन नहीं मिला' : 'No dishes found')
                : selectedCategory !== 'all'
                  ? (lang === 'hi' ? 'इस श्रेणी में अभी कोई व्यंजन नहीं है' : 'No items in this category yet')
                  : (lang === 'hi' ? '✨ मेनू जल्द ही आ रहा है' : '✨ Digital Menu Coming Soon')}
            </p>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              {(searchQuery || activeQuickFilter)
                ? (lang === 'hi' ? 'कृपया अपनी खोज शब्द बदलें या फ़िल्टर हटाएं' : 'Try searching for something else or clear filters')
                : selectedCategory !== 'all'
                  ? (lang === 'hi' ? 'अन्य श्रेणियां या सभी व्यंजन देखने के लिए नीचे क्लिक करें।' : 'Check out our other delicious categories or all items.')
                  : (lang === 'hi' ? 'आउटलेट अपने मेनू आइटम्स जोड़ रहा है।' : 'The outlet is preparing exciting items for you!')}
            </p>
            {(searchQuery || activeQuickFilter || selectedCategory !== 'all') && (
              <button
                onClick={handleClearAllSearchAndFilters}
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--theme-btn-gradient, var(--gold-gradient))',
                  color: 'var(--theme-btn-text, #FFFFFF)',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>❖</span>
                <span>{lang === 'hi' ? 'सभी व्यंजन देखें (View All Items)' : 'View All Items'}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 🔥 SPECIAL OFFERS BANNER */}
            {!searchQuery && !activeQuickFilter && selectedCategory === 'all' && specialOfferItems.length > 0 && (() => {
              const allOfferItems = specialOfferItems;
              const sym = getCurrencySymbol(info?.currency_symbol);
              return (
                <section style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }}>🔥</span>
                        <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                          {lang === 'hi' ? 'स्पेशल ऑफर्स' : 'Special Offers'}
                        </h2>
                        <span style={{
                          background: '#FEF3C7', color: '#92400E', fontSize: '0.65rem', fontWeight: 700,
                          padding: '1.5px 7px', borderRadius: '20px'
                        }}>
                          {allOfferItems.length} {lang === 'hi' ? 'ऑफर' : allOfferItems.length === 1 ? 'deal' : 'deals'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', marginLeft: '22px' }}>
                        {lang === 'hi' ? 'चयनित व्यंजनों पर विशेष छूट' : 'Save on selected dishes & combos'}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px',
                    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none'
                  }}>
                    {allOfferItems.slice(0, 10).map((item, idx) => {
                      const regularPrice = item._type === 'combo' ? (item.regular_price || item.price) : (item.regular_price || item.price || item.portion_full_price);
                      const offerPrice = item.offer_price;
                      return (
                        <div
                          key={`offer-${item._type}-${item.id}-${idx}`}
                          onClick={() => {
                            if (item._type === 'dish') {
                              openDishCustomizationModal(item);
                            } else {
                              setSelectedComboModal(item);
                            }
                          }}
                          style={{
                            minWidth: '148px', maxWidth: '170px', flex: '0 0 auto', overflow: 'hidden',
                            background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))', borderRadius: '12px',
                            border: '1.5px solid var(--theme-card-border, var(--border-light))', padding: '10px',
                            cursor: 'pointer', position: 'relative',
                            boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            {item.offer_badge && (
                              <span style={{
                                position: 'absolute', top: '6px', right: '6px',
                                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                color: '#FFFFFF', fontSize: '0.58rem', fontWeight: 800,
                                padding: '2px 6px', borderRadius: '6px', letterSpacing: '0.02em',
                                maxWidth: 'calc(100% - 12px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                zIndex: 2
                              }}>
                                {item.offer_badge}
                              </span>
                            )}
                            {item.image ? (
                              <img
                                src={item._type === 'combo' ? getComboImageUrl(item.image) : getDishImageUrl(item.image)}
                                alt={item.name}
                                style={{
                                  width: '100%', height: '74px', objectFit: 'cover',
                                  borderRadius: '8px', marginBottom: '6px'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%', height: '74px', borderRadius: '8px',
                                marginBottom: '6px', background: 'var(--bg-secondary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem'
                              }}>
                                {item._type === 'combo' ? '🍱' : '🍽️'}
                              </div>
                            )}
                            <p style={{
                              margin: '0 0 4px 0', fontSize: '0.74rem', fontWeight: 700,
                              color: 'var(--text-dark)', lineHeight: 1.2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                              {item.name}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: '6px', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                              <span style={{
                                fontSize: '0.92rem',
                                fontWeight: 900,
                                color: 'var(--theme-price-color, var(--primary-emerald, #059669))',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.15
                              }}>
                                {sym}{formatPriceNumber(offerPrice)}
                              </span>
                              {Number(regularPrice) > Number(offerPrice) && (
                                <span style={{
                                  fontSize: '0.70rem',
                                  color: '#94A3B8',
                                  textDecoration: 'line-through',
                                  fontWeight: 600,
                                  lineHeight: 1
                                }}>
                                  {sym}{formatPriceNumber(regularPrice)}
                                </span>
                              )}
                            </div>

                            {isDirectOrderingActive && (() => {
                              if (item._type === 'combo') {
                                const inCartCombo = cartItems.find(i => (i.key || i.dish?.id) === `combo_${item.id}`);
                                const comboQty = inCartCombo ? inCartCombo.quantity : 0;
                                if (comboQty > 0) {
                                  return (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        background: 'var(--theme-card-bg, #FFFFFF)',
                                        border: '1.5px solid var(--primary-emerald, #10B981)',
                                        borderRadius: 'var(--radius-pill)',
                                        padding: '2px 4px',
                                        flexShrink: 0
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCartQuantity(inCartCombo.key || inCartCombo.dish?.id, -1)}
                                        aria-label="Decrease quantity"
                                        style={{
                                          background: 'var(--bg-secondary, #F1F5F9)',
                                          color: 'var(--text-dark, #0F172A)',
                                          border: 'none',
                                          width: '24px',
                                          height: '24px',
                                          padding: 0,
                                          flexShrink: 0,
                                          borderRadius: '50%',
                                          fontWeight: 900,
                                          cursor: 'pointer',
                                          fontSize: '0.82rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          lineHeight: 1
                                        }}
                                      >
                                        −
                                      </button>
                                      <span style={{
                                        minWidth: '16px',
                                        textAlign: 'center',
                                        fontSize: '0.72rem',
                                        fontWeight: 900,
                                        color: 'var(--theme-price-color, var(--primary-emerald, #10B981))'
                                      }}>
                                        {comboQty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCartQuantity(inCartCombo.key || inCartCombo.dish?.id, 1)}
                                        aria-label="Increase quantity"
                                        style={{
                                          background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                                          color: 'var(--theme-btn-text, #FFFFFF)',
                                          border: 'none',
                                          width: '24px',
                                          height: '24px',
                                          padding: 0,
                                          flexShrink: 0,
                                          borderRadius: '50%',
                                          fontWeight: 900,
                                          cursor: 'pointer',
                                          fontSize: '0.82rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          lineHeight: 1
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  );
                                }
                              } else {
                                const hasHalf = item.price_half !== null && item.price_half !== undefined && Number(item.price_half) > 0;
                                const hasModifiers = isFlagEnabled(info?.modifiers_enabled, true) && getValidDishModifiers(item.modifiers).length > 0;
                                if (!hasHalf && !hasModifiers) {
                                  const inCartDish = cartItems.find(i => !i.isCombo && String(i.dish?.id) === String(item.id) && (!i.modifiers || i.modifiers.length === 0) && String(i.portion_type || 'full') === 'full');
                                  const dishQty = inCartDish ? inCartDish.quantity : 0;
                                  if (dishQty > 0) {
                                    return (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          background: 'var(--theme-card-bg, #FFFFFF)',
                                          border: '1.5px solid var(--primary-emerald, #10B981)',
                                          borderRadius: 'var(--radius-pill)',
                                          padding: '2px 4px',
                                          flexShrink: 0
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateCartQuantity(inCartDish.key || inCartDish.dish?.id, -1)}
                                          aria-label="Decrease quantity"
                                          style={{
                                            background: 'var(--bg-secondary, #F1F5F9)',
                                            color: 'var(--text-dark, #0F172A)',
                                            border: 'none',
                                            width: '24px',
                                            height: '24px',
                                            padding: 0,
                                            flexShrink: 0,
                                            borderRadius: '50%',
                                            fontWeight: 900,
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1
                                          }}
                                        >
                                          −
                                        </button>
                                        <span style={{
                                          minWidth: '16px',
                                          textAlign: 'center',
                                          fontSize: '0.72rem',
                                          fontWeight: 900,
                                          color: 'var(--theme-price-color, var(--primary-emerald, #10B981))'
                                        }}>
                                          {dishQty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateCartQuantity(inCartDish.key || inCartDish.dish?.id, 1)}
                                          aria-label="Increase quantity"
                                          style={{
                                            background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                                            color: 'var(--theme-btn-text, #FFFFFF)',
                                            border: 'none',
                                            width: '24px',
                                            height: '24px',
                                            padding: 0,
                                            flexShrink: 0,
                                            borderRadius: '50%',
                                            fontWeight: 900,
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1
                                          }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    );
                                  }
                                }
                              }

                              return (
                                <button
                                  type="button"
                                  className="tq-tap"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item._type === 'combo') {
                                      handleAddComboToCart(item, e.currentTarget);
                                    } else {
                                      const hasHalf = item.price_half !== null && item.price_half !== undefined && Number(item.price_half) > 0;
                                      const hasModifiers = isFlagEnabled(info?.modifiers_enabled, true) && getValidDishModifiers(item.modifiers).length > 0;
                                      if (hasHalf || hasModifiers) {
                                        openDishCustomizationModal(item, null, 'addon');
                                      } else {
                                        handleAddToCart(item, 'full', [], 1, e.currentTarget);
                                      }
                                    }
                                  }}
                                  style={{
                                    background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                                    color: 'var(--theme-btn-text, #FFFFFF)',
                                    border: 'none',
                                    padding: '4px 9px',
                                    borderRadius: 'var(--radius-pill)',
                                    fontSize: '0.70rem',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    boxShadow: 'var(--theme-shadow, 0 2px 6px rgba(0, 0, 0, 0.2))',
                                    flexShrink: 0
                                  }}
                                >
                                  <span>+</span>
                                  <span>{lang === 'hi' ? 'जोड़ें' : 'ADD'}</span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
            {/* 🛒 COMBO DEALS SECTION - ULTRA SLIM & MOBILE-NATIVE */}
            {filteredCombos.length > 0 && info?.filters_visibility?.combo !== false && (selectedCategory === 'all' || selectedCategory === 'combos-section' || searchQuery || activeQuickFilter === 'combo') && (
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
                    }}>{filteredCombos.length}</span>
                  </div>
                  {selectedCategory !== 'combos-section' && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#059669' }}>
                      Swipe 👉
                    </span>
                  )}
                </div>

                {/* Slim Horizontal Scroll List (or Multi-column Wrap when dedicated combos view) */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: selectedCategory === 'combos-section' ? 'visible' : 'auto',
                  flexWrap: selectedCategory === 'combos-section' ? 'wrap' : 'nowrap',
                  paddingBottom: '4px',
                  scrollSnapType: selectedCategory === 'combos-section' ? 'none' : 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}>
                  {filteredCombos.map(combo => {
                    const comboMeta = parsedCombosMetaMap.get(combo.id);
                    const originalTotal = comboMeta ? comboMeta.originalTotal : 0;
                    const itemsSummaryText = comboMeta ? comboMeta.itemsSummaryText : '';

                    const regularPrice = (combo.regular_price !== undefined && combo.regular_price !== null && combo.regular_price !== '') ? Number(combo.regular_price) : Number(combo.price || 0);
                    const hasValidOffer = combo.offer_price !== undefined && combo.offer_price !== null && combo.offer_price !== '' && Number(combo.offer_price) < regularPrice;
                    const effectivePrice = hasValidOffer ? Number(combo.offer_price) : regularPrice;
                    const hasDiscount = (originalTotal > effectivePrice) || (regularPrice > effectivePrice);
                    const comparePrice = originalTotal > effectivePrice ? originalTotal : regularPrice;

                    const comboText = `${combo.name || ''} ${combo.description || ''} ${itemsSummaryText}`.toLowerCase();
                    const isNonVeg = comboText.includes('chicken') || comboText.includes('mutton') || comboText.includes('fish') || comboText.includes('egg');
                    const isVeg = isPureVegResto || !isNonVeg;

                    {/* Combo Card Container */ }
                    return (
                      <div
                        key={combo.id}
                        onClick={() => setSelectedComboModal(combo)}
                        style={{
                          minWidth: selectedCategory === 'combos-section' ? 'min(280px, 100%)' : 'min(230px, 76vw)',
                          maxWidth: selectedCategory === 'combos-section' ? '100%' : '250px',
                          flex: selectedCategory === 'combos-section' ? '1 1 260px' : '0 0 auto',
                          scrollSnapAlign: 'start',
                          background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
                          borderRadius: '12px',
                          padding: '8px 10px',
                          border: '1.5px solid var(--theme-card-border, var(--border-light))',
                          boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          justifyContent: 'space-between'
                        }}
                      >
                        {/* Left: Compact Image + Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden',
                            background: 'var(--bg-secondary)', border: '1px solid var(--theme-card-border, var(--border-light))', flexShrink: 0,
                            position: 'relative'
                          }}>
                            <img
                              src={getComboImageUrl(combo.image)}
                              alt={combo.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/images/default-combo.webp?v=3';
                              }}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span
                                title={isVeg ? 'Veg' : 'Non-Veg'}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '11px',
                                  height: '11px',
                                  border: isVeg ? '1.5px solid #16A34A' : '1.5px solid #DC2626',
                                  borderRadius: '2.5px',
                                  padding: '1px',
                                  flexShrink: 0
                                }}
                              >
                                <span style={{
                                  width: '4px',
                                  height: '4px',
                                  borderRadius: '50%',
                                  background: isVeg ? '#16A34A' : '#DC2626'
                                }} />
                              </span>
                              <h4 style={{
                                margin: 0, fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dark)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {combo.name}
                              </h4>
                            </div>

                            <p style={{
                              margin: '2px 0 4px', fontSize: '0.66rem', color: 'var(--text-muted)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {itemsSummaryText || combo.description || (lang === 'hi' ? 'विशेष कॉम्बो थाली' : 'Special combo deal')}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '3px' }}>
                              <span style={{
                                fontSize: '0.92rem',
                                fontWeight: 900,
                                color: 'var(--theme-price-color, var(--primary-emerald, #059669))',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.15
                              }}>
                                {getCurrencySymbol(info?.currency_symbol)}{formatPriceNumber(effectivePrice)}
                              </span>
                              {hasDiscount && (
                                <span style={{
                                  fontSize: '0.70rem',
                                  color: '#94A3B8',
                                  textDecoration: 'line-through',
                                  fontWeight: 600,
                                  lineHeight: 1
                                }}>
                                  {getCurrencySymbol(info?.currency_symbol)}{formatPriceNumber(comparePrice)}
                                </span>
                              )}
                              {hasDiscount && comparePrice > effectivePrice && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 800,
                                  color: '#15803D',
                                  background: '#DCFCE7',
                                  border: '1px solid #BBF7D0',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  lineHeight: 1.1,
                                  letterSpacing: '0.02em'
                                }}>
                                  {Math.round(((comparePrice - effectivePrice) / comparePrice) * 100)}% OFF
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: + ADD button or Stepper when ordering active */}
                        {isDirectOrderingActive && (() => {
                          const inCartItem = cartItems.find(i => (i.key || i.dish?.id) === `combo_${combo.id}`);
                          const inCartQty = inCartItem ? inCartItem.quantity : 0;

                          if (inCartQty > 0) {
                            return (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'var(--theme-card-bg, #FFFFFF)',
                                  border: '1.5px solid var(--primary-emerald, #10B981)',
                                  borderRadius: 'var(--radius-pill)',
                                  padding: '2px 4px',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(inCartItem.key || inCartItem.dish?.id, -1)}
                                  aria-label="Decrease combo quantity"
                                  style={{
                                    background: 'var(--bg-secondary, #F1F5F9)',
                                    color: 'var(--text-dark, #0F172A)',
                                    border: 'none',
                                    width: '24px',
                                    height: '24px',
                                    padding: 0,
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1
                                  }}
                                >
                                  −
                                </button>
                                <span style={{
                                  minWidth: '16px',
                                  textAlign: 'center',
                                  fontSize: '0.74rem',
                                  fontWeight: 900,
                                  color: 'var(--theme-price-color, var(--primary-emerald, #10B981))'
                                }}>
                                  {inCartQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(inCartItem.key || inCartItem.dish?.id, 1)}
                                  aria-label="Increase combo quantity"
                                  style={{
                                    background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                                    color: 'var(--theme-btn-text, #FFFFFF)',
                                    border: 'none',
                                    width: '24px',
                                    height: '24px',
                                    padding: 0,
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            );
                          }

                          return (
                            <button
                              type="button"
                              className="tq-tap"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddComboToCart(combo, e.currentTarget);
                              }}
                              style={{
                                background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                                color: 'var(--theme-btn-text, #FFFFFF)',
                                border: 'none',
                                padding: '5px 9px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: '0.68rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                boxShadow: 'var(--theme-shadow, 0 2px 6px rgba(0, 0, 0, 0.2))',
                                flexShrink: 0
                              }}
                            >
                              <span>+</span>
                              <span>{lang === 'hi' ? 'जोड़ें' : 'ADD'}</span>
                            </button>
                          );
                        })()}
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
                className="dish-category-section"
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
                        currencySymbol={getCurrencySymbol(info?.currency_symbol)}
                        filtersVisibility={info?.filters_visibility}
                        modifiersEnabled={isFlagEnabled(info?.modifiers_enabled, true)}
                        onClick={openDishCustomizationModal}
                        onAddToCart={isDirectOrderingActive ? handleAddToCart : undefined}
                        onUpdateCartQuantity={isDirectOrderingActive ? handleUpdateCartQuantity : undefined}
                        dishCartItems={cartItemsByDishId.get(String(dish.id)) || EMPTY_CART_SLICE}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))',
                    gap: '12px'
                  }}>
                    {group.items.map((dish) => (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        lang={lang}
                        currencySymbol={getCurrencySymbol(info?.currency_symbol)}
                        filtersVisibility={info?.filters_visibility}
                        modifiersEnabled={isFlagEnabled(info?.modifiers_enabled, true)}
                        onClick={openDishCustomizationModal}
                        onAddToCart={isDirectOrderingActive ? handleAddToCart : undefined}
                        onUpdateCartQuantity={isDirectOrderingActive ? handleUpdateCartQuantity : undefined}
                        dishCartItems={cartItemsByDishId.get(String(dish.id)) || EMPTY_CART_SLICE}
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
      {cartItems.length > 0 && isDirectOrderingActive && !showCategoryDrawer && !selectedComboModal && !showInfoModal && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(66px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2100,
          width: 'calc(100% - 28px)',
          maxWidth: '440px'
        }}>
          {(() => {
            const isAddon = Boolean(activeOrderId && activeOrderTrack && ['pending', 'accepted', 'kitchen', 'preparing', 'served'].includes(activeOrderTrack.status));
            const nextRound = (Number(activeOrderTrack?.current_round) || Number(activeOrderTrack?.round_number) || 1) + 1;
            return (
              <button
                className="tq-tap"
                onClick={() => { triggerHaptic('light'); setShowCartDrawer(true); }}
                style={{
                  width: '100%',
                  background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                  color: 'var(--theme-btn-text, #FFFFFF)',
                  padding: '10px 16px',
                  borderRadius: '14px',
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  border: '1.5px solid rgba(255, 255, 255, 0.75)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--theme-shadow, 0 10px 30px rgba(0, 0, 0, 0.35))',
                  animation: 'tqSlideUpFade 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <span
                    id="tq-floating-cart-badge"
                    className="tq-qty-pop"
                    style={{ background: '#FFFFFF', color: '#0F172A', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900, flexShrink: 0 }}
                  >
                    {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left', lineHeight: 1.15 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--theme-btn-text, #FFFFFF)', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const sym = getCurrencySymbol(info?.currency_symbol);
                        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        const isGst = isFlagEnabled(info?.gst_enabled, false);
                        const cgst = isGst ? Math.round(subtotal * 0.025 * 100) / 100 : 0;
                        const sgst = isGst ? Math.round(subtotal * 0.025 * 100) / 100 : 0;
                        const grandTotal = isGst ? Math.round((subtotal + cgst + sgst) * 100) / 100 : subtotal;
                        return `${sym}${formatPriceNumber(grandTotal)}`;
                      })()}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isAddon ? `Add-on (${getDynamicSpaceLabel() || 'Order'} R${nextRound})` : (lang === 'hi' ? 'कुल अनुमानित राशि' : 'Estimated total')}
                    </span>
                  </div>
                </div>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '5px 11px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 900
                }}>
                  <span>{lang === 'hi' ? 'कार्ट देखें' : 'View Cart'}</span>
                  <span>→</span>
                </div>
              </button>
            );
          })()}
        </div>
      )}

      {/* 🛎️ Service Request Modal & Toast */}
      {showServiceModal && !(info?.business_type === 'cinema_theatre' || info?.service_model === 'cinema' || info?.service_model === 'seat_service' || currentSpaceType === 'cinema_seat' || currentSpaceType === 'cinema' || String(info?.table_prefix || '').toLowerCase() === 'cinema_seat') && (
        <ServiceRequestModal
          tableNum={effectiveTableNum || currentTableNum || '1'}
          spaceType={currentSpaceType || initialSpaceInfo.type || 'table'}
          tableToken={currentTableToken || initialSpaceInfo.token || (new URLSearchParams(window.location.search).get('tkn') || '').trim()}
          slug={getSlugFromUrl() || (info && info.slug)}
          onClose={() => setShowServiceModal(false)}
          onSuccess={(msg) => {
            setServiceToastMsg(msg);
            setTimeout(() => setServiceToastMsg(''), 6000);
          }}
        />
      )}

      {/* 🧾 Post-Bill Settled Receipt & Review Sheet */}
      {billCompletedModal && (
        <BillCompletedModal
          bill={billCompletedModal}
          info={info}
          lang={lang}
          spaceLabel={billCompletedModal.spaceLabelSnapshot || getDynamicSpaceLabel(billCompletedModal.table_number)}
          canOrderAgain={Boolean(completedSpaceSnapshot)}
          orderAgainLabel={(() => {
            if (!completedSpaceSnapshot) return '';
            if (completedSpaceSnapshot.type === 'room' || isHotelVenue) {
              return lang === 'hi' ? 'रूम मेनू पर जाएं 🏨' : 'Back to Room Menu';
            }
            if (completedSpaceSnapshot.type === 'cinema_seat' || completedSpaceSnapshot.type === 'cinema' || isCinemaVenue) {
              return lang === 'hi' ? 'और आइटम ऑर्डर करें 🍿' : 'Order More 🍿';
            }
            return lang === 'hi' ? 'नया ऑर्डर करें ⚡' : 'Order Again ⚡';
          })()}
          onOrderAgain={() => {
            if (!completedSpaceSnapshot) return;
            const { num, type, token } = completedSpaceSnapshot;
            setCurrentTableNum(num);
            setCurrentSpaceType(type);
            setCurrentTableToken(token);
            setSessionExpired(false);
            setIsPostBillViewOnly(false);
            setBillCompletedModal(null);
            setLastCompletedBill(null);
            setCompletedSpaceSnapshot(null);
            persistLastCompletedBill(getActiveStorageTenantSlug(), null);
            const params = new URLSearchParams();
            params.set('space_type', type);
            params.set('table_num', num);
            params.set('tkn', token);
            const pathSlug = getSlugFromUrl();
            const basePath = pathSlug ? `/${pathSlug}` : (window.location.pathname || '/');
            window.history.replaceState({}, '', `${basePath}?${params.toString()}`);
          }}
          onOpenReview={Boolean(info?.google_reviews_enabled) ? handleRateUsClick : undefined}
          onClose={() => setBillCompletedModal(null)}
        />
      )}

      {/* 🌟 Smart AI Google Review Booster Modal */}
      {showReviewModal && Boolean(info?.google_reviews_enabled) && (
        <CustomerReviewModal
          info={info}
          lang={lang}
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
          tableToken={currentTableToken || initialSpaceInfo.token || (new URLSearchParams(window.location.search).get('tkn') || '').trim()}
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
          width: 'max-content',
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 10010,
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'var(--dock-gradient, var(--header-gradient))',
            color: '#FFFFFF',
            boxSizing: 'border-box',
            padding: '10px 16px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            fontWeight: 800,
            fontSize: '0.84rem',
            textAlign: 'center',
            animation: 'tqSlideUpFade 0.26s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {serviceToastMsg}
          </div>
        </div>
      )}

      {/* 🛒 Cart Modal / Bottom Drawer */}
      {showCartDrawer && (
        <div
          onClick={() => setShowCartDrawer(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'sheetBackdropFade 0.2s ease-out'
          }}
        >
          {(() => {
            const isAddon = Boolean(activeOrderId && activeOrderTrack && ['pending', 'accepted', 'kitchen', 'preparing', 'served'].includes(activeOrderTrack.status));
            const nextRound = (Number(activeOrderTrack?.current_round) || Number(activeOrderTrack?.round_number) || 1) + 1;
            const sym = getCurrencySymbol(info?.currency_symbol);
            const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const subtotal = cartTotal;
            const isGst = isFlagEnabled(info?.gst_enabled, false);
            const cgst = isGst ? Math.round(subtotal * 0.025 * 100) / 100 : 0;
            const sgst = isGst ? Math.round(subtotal * 0.025 * 100) / 100 : 0;
            const grandTotal = isGst ? Math.round((subtotal + cgst + sgst) * 100) / 100 : subtotal;
            const totalItemCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

            return (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--theme-modal-bg, #FFFFFF)',
                  borderRadius: '24px 24px 0 0',
                  maxWidth: '520px',
                  width: '100%',
                  boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
                  border: '1.5px solid var(--theme-modal-border, var(--border-light, transparent))',
                  borderBottom: 'none',
                  maxHeight: '90dvh',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  animation: 'sheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  color: 'var(--text-dark)'
                }}
              >
                {/* Pinned Header */}
                <div style={{
                  padding: '10px 18px 12px',
                  borderBottom: '1px solid var(--border-light)',
                  flexShrink: 0,
                  background: 'var(--theme-modal-bg, #FFFFFF)'
                }}>
                  <div style={{
                    width: '38px',
                    height: '4px',
                    borderRadius: '9999px',
                    background: '#CBD5E1',
                    margin: '0 auto 10px'
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--theme-price-color, var(--primary-emerald))', display: 'block' }}>
                        {isAddon ? `🛒 Round ${nextRound} (Add-on Items)` : `🛒 My Order Items (${totalItemCount})`}
                      </strong>
                      {isAddon && (
                        <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 800 }}>
                          Active Session: {getDynamicSpaceLabel() || `Table ${effectiveTableNum || '1'}`}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {cartItems.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearCart}
                          aria-label="Clear cart"
                          style={{
                            background: 'var(--bg-secondary, #F1F5F9)',
                            color: '#DC2626',
                            border: '1px solid var(--border-light, #E2E8F0)',
                            borderRadius: '9999px',
                            padding: '5px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            lineHeight: 1
                          }}
                        >
                          <Trash2 size={12} />
                          <span>Clear</span>
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Close cart"
                        onClick={() => setShowCartDrawer(false)}
                        style={{
                          background: 'var(--bg-secondary, #F3F4F6)',
                          color: 'var(--text-dark, #374151)',
                          border: 'none',
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                          flexShrink: 0
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {cartItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '44px 18px', color: 'var(--text-muted)' }}>
                    <MessageSquare size={40} color="#10B981" style={{ marginBottom: '10px', opacity: 0.6 }} />
                    <p style={{ fontSize: '0.95rem', margin: '0 0 6px 0', fontWeight: 800, color: 'var(--text-dark)' }}>Your order cart is empty.</p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>Tap <strong>"+ ADD"</strong> on any item to add items!</p>
                  </div>
                ) : (
                  <>
                    {/* Scrollable Cart Items + Order Form Area */}
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {isAddon && (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '8px 12px', borderRadius: '12px', fontSize: '0.78rem', color: '#065F46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🔄</span>
                          <span>
                            {(() => {
                              const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                              const isCounter = activeType === 'counter' || String(effectiveTableNum).toLowerCase().includes('counter');
                              const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(effectiveTableNum).toLowerCase().includes('screen') || String(effectiveTableNum).toLowerCase().includes('seat');
                              const isRoom = activeType === 'room' || String(effectiveTableNum).toLowerCase().includes('room');
                              if (isCounter) return <>These new items will be sent as <strong>Round {nextRound} Dispatch</strong> and added to your counter order.</>;
                              if (isCin) return <>These new items will be sent as <strong>Round {nextRound} KOT</strong> and merged with your running seat order/bill.</>;
                              if (isRoom) return <>These new items will be sent as <strong>Round {nextRound} KOT</strong> and merged with your running room order/bill.</>;
                              return <>These new items will be sent as <strong>Round {nextRound} KOT</strong> and merged with your running table bill.</>;
                            })()}
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                        {cartItems.map((item) => {
                          const itemKey = item.key || item.dish.id;
                          const itemDisplayName = (lang === 'hi' && item.dish?.name_hi) ? item.dish.name_hi : item.dish?.name;
                          return (
                            <div key={itemKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0, background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--theme-card-border, var(--border-light))' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', lineHeight: 1.3 }}>
                                  <span>{itemDisplayName}</span>
                                  {item.isCombo ? (
                                    <span style={{ background: '#D1FAE5', color: '#059669', fontSize: '0.66rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #6EE7B7', fontWeight: 900 }}>
                                      COMBO
                                    </span>
                                  ) : item.portion && (
                                    <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FCD34D', fontWeight: 900 }}>
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
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px', marginBottom: '2px' }}>
                                    {item.modifiers.map((m, mIdx) => (
                                      <span key={mIdx} style={{ fontSize: '0.68rem', background: 'var(--bg-secondary, #F1F5F9)', color: 'var(--text-dark, #334155)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-light, #CBD5E1)', fontWeight: 700 }}>
                                        + {m.name} (+{sym}{formatPriceNumber(m.price)})
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <span style={{ fontSize: '0.82rem', color: 'var(--theme-price-color, var(--primary-emerald, #064E3B))', fontWeight: 800 }}>
                                    {sym}{formatPriceNumber(item.price)} x {item.quantity} = {sym}{formatPriceNumber(item.price * item.quantity)}
                                  </span>
                                  {item.regular_price && item.regular_price > item.price && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94A3B8)', textDecoration: 'line-through' }}>
                                      {sym}{formatPriceNumber(item.regular_price * item.quantity)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {/* Unified − qty + Stepper Pill */}
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  height: '32px',
                                  padding: '2px',
                                  borderRadius: '9999px',
                                  background: 'var(--bg-secondary, #F8FAFC)',
                                  border: '1.5px solid var(--primary-emerald, #059669)',
                                  flexShrink: 0
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartQuantity(itemKey, -1)}
                                    aria-label="Decrease quantity"
                                    style={{
                                      background: 'var(--theme-card-bg, #FFFFFF)',
                                      color: 'var(--text-dark, #0F172A)',
                                      border: '1px solid var(--border-light, #CBD5E1)',
                                      width: '26px',
                                      height: '26px',
                                      padding: 0,
                                      borderRadius: '50%',
                                      fontWeight: 900,
                                      cursor: 'pointer',
                                      fontSize: '0.95rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: 1,
                                      flexShrink: 0
                                    }}
                                  >
                                    −
                                  </button>
                                  <span style={{ fontSize: '0.86rem', fontWeight: 900, color: 'var(--text-dark)', minWidth: '22px', textAlign: 'center', lineHeight: 1 }}>
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartQuantity(itemKey, 1)}
                                    aria-label="Increase quantity"
                                    style={{
                                      background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                                      color: 'var(--theme-btn-text, #FFFFFF)',
                                      border: 'none',
                                      width: '26px',
                                      height: '26px',
                                      padding: 0,
                                      borderRadius: '50%',
                                      fontWeight: 900,
                                      cursor: 'pointer',
                                      fontSize: '0.95rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: 1,
                                      flexShrink: 0
                                    }}
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCart(itemKey)}
                                  aria-label="Remove item"
                                  title="Remove item"
                                  style={{
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    border: '1px solid #FECACA',
                                    width: '28px',
                                    height: '28px',
                                    padding: 0,
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                    flexShrink: 0
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '12px', flexShrink: 0 }}>
                        {/* 🛎️ Service Mode / Dining Choice (Available in both Initial & Add-on Rounds) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {isCinemaVenue ? (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(14, 165, 233, 0.18) 100%)',
                              border: '1.5px solid #0284C7',
                              borderRadius: '12px',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎬</span>
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '0.82rem', color: 'var(--text-dark, #0F172A)', display: 'block' }}>In-Seat Food Delivery</strong>
                                <span style={{ fontSize: '0.72rem', color: '#0284C7', fontWeight: 600 }}>Food will be delivered directly to your cinema seat</span>
                              </div>
                            </div>
                          ) : isHotelVenue ? (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.18) 100%)',
                              border: '1.5px solid #D97706',
                              borderRadius: '12px',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🏨</span>
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '0.82rem', color: 'var(--text-dark, #0F172A)', display: 'block' }}>In-Room Dining Service</strong>
                                <span style={{ fontSize: '0.72rem', color: '#B45309', fontWeight: 600 }}>Food will be delivered directly to your guest room</span>
                              </div>
                            </div>
                          ) : isCounterSpace ? (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
                              border: '1.5px solid #059669',
                              borderRadius: '12px',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚡</span>
                              <div style={{ flex: 1 }}>
                                <strong style={{ fontSize: '0.82rem', color: 'var(--text-dark, #0F172A)', display: 'block' }}>Takeaway Counter Pickup</strong>
                                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Food will be packed. A Pickup Token will be assigned.</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* 🍽️ Dine-In vs 📦 Takeaway Mode Toggle */}
                              <div style={{
                                display: 'flex',
                                background: 'var(--bg-secondary, #F1F5F9)',
                                padding: '3px',
                                borderRadius: '12px',
                                marginBottom: '2px',
                                gap: '4px'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => setOrderTypeChoice('dine_in')}
                                  style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    fontSize: '0.80rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease',
                                    background: orderTypeChoice === 'dine_in' ? 'var(--theme-card-bg, #FFFFFF)' : 'transparent',
                                    color: orderTypeChoice === 'dine_in' ? 'var(--text-dark, #0F172A)' : 'var(--text-muted, #64748B)',
                                    boxShadow: orderTypeChoice === 'dine_in' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                                  }}
                                >
                                  <span>🍽️</span>
                                  <span>Dine-In</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOrderTypeChoice('takeaway')}
                                  style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    fontSize: '0.80rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease',
                                    background: orderTypeChoice === 'takeaway' ? 'var(--primary-emerald, #10B981)' : 'transparent',
                                    color: orderTypeChoice === 'takeaway' ? 'var(--theme-btn-text, #FFFFFF)' : 'var(--text-muted, #64748B)',
                                    boxShadow: orderTypeChoice === 'takeaway' ? '0 1px 4px rgba(16,185,129,0.3)' : 'none'
                                  }}
                                >
                                  <span>📦</span>
                                  <span>Takeaway / Parcel</span>
                                </button>
                              </div>

                              {orderTypeChoice === 'takeaway' && (
                                <div style={{
                                  background: '#FFFBEB',
                                  border: '1px solid #FDE68A',
                                  borderRadius: '10px',
                                  padding: '6px 10px',
                                  fontSize: '0.74rem',
                                  color: '#92400E',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  <span>📦</span>
                                  <span><strong>Takeaway Mode:</strong> Food will be packed. A Pickup Token will be assigned.</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Customer Information (Table, Name, Mobile) - Locked for Add-on Rounds */}
                        {!isAddon && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ flex: '1 1 130px', minWidth: 0 }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                  {(() => {
                                    const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                                    const isCounter = activeType === 'counter' || String(effectiveTableNum || '').toLowerCase().includes('counter');
                                    const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(effectiveTableNum || '').toLowerCase().includes('screen') || String(effectiveTableNum || '').toLowerCase().includes('seat');
                                    const isRoom = activeType === 'room' || String(effectiveTableNum || '').toLowerCase().includes('room');
                                    const isCabin = activeType === 'cabin' || String(effectiveTableNum || '').toLowerCase().includes('cabin');
                                    const isVip = activeType === 'vip' || String(effectiveTableNum || '').toLowerCase().includes('vip');
                                    if (isCounter) {
                                      return getDynamicSpaceLabel() ? 'SCANNED COUNTER 🔒' : 'COUNTER';
                                    }
                                    if (isCin) {
                                      return getDynamicSpaceLabel() ? 'SCANNED SEAT 🔒' : 'SEAT';
                                    }
                                    if (isRoom) {
                                      return getDynamicSpaceLabel() ? 'SCANNED ROOM 🔒' : 'ROOM';
                                    }
                                    if (isCabin) {
                                      return getDynamicSpaceLabel() ? 'SCANNED CABIN 🔒' : 'CABIN';
                                    }
                                    if (isVip) {
                                      return getDynamicSpaceLabel() ? 'SCANNED VIP LOUNGE 🔒' : 'VIP';
                                    }
                                    return getDynamicSpaceLabel() ? 'SCANNED TABLE 🔒' : 'TABLE';
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
                                    border: '1.5px solid var(--border-light, #CBD5E1)',
                                    fontSize: '0.82rem',
                                    boxSizing: 'border-box',
                                    fontWeight: 800,
                                    background: effectiveTableNum ? 'var(--bg-secondary, #F1F5F9)' : 'var(--theme-input-bg, #FFFFFF)',
                                    color: 'var(--text-dark, #0F172A)',
                                    cursor: effectiveTableNum ? 'not-allowed' : 'text'
                                  }}
                                />
                              </div>
                              <div style={{ flex: '1.2 1 150px', minWidth: 0 }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>YOUR NAME (OPTIONAL)</label>
                                <input
                                  type="text"
                                  value={customerNameInput}
                                  onChange={(e) => setCustomerNameInput(e.target.value)}
                                  placeholder="e.g. Rahul"
                                  style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid var(--border-light, #CBD5E1)', fontSize: '0.86rem', boxSizing: 'border-box', background: 'var(--theme-input-bg, #FFFFFF)', color: 'var(--text-dark, #0F172A)' }}
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
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid var(--border-light, #CBD5E1)', fontSize: '0.86rem', boxSizing: 'border-box', background: 'var(--theme-input-bg, #FFFFFF)', color: 'var(--text-dark, #0F172A)' }}
                              />
                            </div>
                          </div>
                        )}

                        {/* 📝 Cooking / Kitchen Instructions (Available on all rounds) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                              📝 {lang === 'hi' ? 'किचन / पैकिंग निर्देश (वैकल्पिक)' : 'COOKING / KITCHEN NOTES (OPTIONAL)'}
                            </label>
                            {orderNotesInput.length > 0 && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                {orderNotesInput.length}/240
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(() => {
                              const biz = String(info?.business_type || info?.resto_type || '').toLowerCase();
                              const isBakeryOrSweet = ['bakery_confectionery', 'sweet_shop', 'mithai'].includes(biz);
                              const isBeverageOrCafe = ['cafe_coffee', 'juice_beverage', 'ice_cream', 'tea_stall'].includes(biz);
                              const presetList = lang === 'hi'
                                ? (isBakeryOrSweet
                                  ? ['गिफ्ट पैकिंग', 'कम मीठा', 'नैपकिन/चम्मच दें', 'ताज़ा पैक करें']
                                  : isBeverageOrCafe
                                    ? ['कम चीनी', 'कम बर्फ', 'बिना चीनी', 'अलग से पैक करें']
                                    : ['कम तीखा', 'बिना प्याज-लहसुन', 'अतिरिक्त चटनी', 'चम्मच/कटलरी दें'])
                                : (isBakeryOrSweet
                                  ? ['Gift Packing', 'Less Sweet', 'Add Cutlery/Napkins', 'Pack Fresh']
                                  : isBeverageOrCafe
                                    ? ['Less Sugar', 'Less Ice', 'No Sugar', 'Pack Separately']
                                    : ['Less Spicy', 'No Onion/Garlic', 'Extra Chutney', 'Send Cutlery']);

                              return presetList.map((chip) => {
                                const currentParts = orderNotesInput
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                const isSelected = currentParts.some((p) => p.toLowerCase() === chip.toLowerCase());
                                return (
                                  <button
                                    key={chip}
                                    type="button"
                                    className="tq-tap"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      if (isSelected) {
                                        setOrderNotesInput(currentParts.filter((p) => p.toLowerCase() !== chip.toLowerCase()).join(', '));
                                      } else {
                                        const next = [...currentParts, chip].join(', ').slice(0, 240);
                                        setOrderNotesInput(next);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 9px',
                                      borderRadius: '9999px',
                                      border: isSelected
                                        ? '1.5px solid var(--theme-primary, #10B981)'
                                        : '1px solid var(--border-light, #CBD5E1)',
                                      background: isSelected
                                        ? 'var(--theme-nav-active, #064E3B)'
                                        : 'var(--bg-secondary, #F8FAFC)',
                                      color: isSelected
                                        ? 'var(--theme-nav-active-text, #FFFFFF)'
                                        : 'var(--text-dark, #334155)',
                                      fontSize: '0.70rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      lineHeight: 1.3
                                    }}
                                  >
                                    {isSelected ? '✓ ' : '+ '}{chip}
                                  </button>
                                );
                              });
                            })()}
                          </div>

                          <textarea
                            rows={2}
                            maxLength={240}
                            value={orderNotesInput}
                            onChange={(e) => setOrderNotesInput(e.target.value)}
                            placeholder={lang === 'hi'
                              ? 'जैसे: कम नमक/चीनी, बच्चों के लिए हल्का, या पैकिंग निर्देश...'
                              : 'e.g. Less oil/sugar, mild for kids, or packing request...'}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--border-light, #CBD5E1)',
                              fontSize: '1rem',
                              lineHeight: 1.35,
                              resize: 'none',
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                              background: 'var(--theme-input-bg, #FFFFFF)',
                              color: 'var(--text-dark, #0F172A)'
                            }}
                          />
                        </div>

                        {/* 🏷️ Authoritative Bill & GST Summary */}
                        {isGst && (
                          <div style={{
                            background: 'var(--bg-card-soft, #F8FAFC)',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            border: '1.5px solid var(--border-light, #E2E8F0)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '0.8rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                              <span>Items Subtotal</span>
                              <span>{sym}{formatPriceNumber(subtotal)}</span>
                            </div>
                            {(() => {
                              const totalSavings = cartItems.reduce((sum, item) => sum + ((item.discount_amount || 0) * (item.quantity || 1)), 0);
                              return totalSavings > 0 ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 600 }}>
                                  <span>🎉 Offer Savings</span>
                                  <span>-{sym}{formatPriceNumber(totalSavings)}</span>
                                </div>
                              ) : null;
                            })()}
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                              <span>CGST (2.5%)</span>
                              <span>{sym}{formatPriceNumber(cgst)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                              <span>SGST (2.5%)</span>
                              <span>{sym}{formatPriceNumber(sgst)}</span>
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontWeight: 800,
                              color: 'var(--text-dark, #0F172A)',
                              borderTop: '1px dashed var(--border-light, #CBD5E1)',
                              paddingTop: '4px',
                              marginTop: '2px'
                            }}>
                              <span>Grand Total (Inc. 5% GST)</span>
                              <span>{sym}{formatPriceNumber(grandTotal)}</span>
                            </div>
                          </div>
                        )}

                        {/* Vertical-specific Reassurance Callout */}
                        {(() => {
                          const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                          const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(effectiveTableNum || '').toLowerCase().includes('screen') || String(effectiveTableNum || '').toLowerCase().includes('seat');
                          const isRoom = activeType === 'room' || String(effectiveTableNum || '').toLowerCase().includes('room');

                          if (isCin) {
                            return (
                              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '8px 12px', fontSize: '0.76rem', color: '#B45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🍿</span>
                                <span><strong>Cinema Seat Express:</strong> Hot popcorn & drinks will be delivered right to your seat.</span>
                              </div>
                            );
                          }
                          if (isRoom) {
                            return (
                              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '8px 12px', fontSize: '0.76rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🛎️</span>
                                <span><strong>In-Room Dining:</strong> Freshly prepared and delivered straight to your room door.</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Pinned Sticky Checkout Footer */}
                    <div style={{
                      padding: '12px 18px calc(16px + env(safe-area-inset-bottom, 0px))',
                      borderTop: '1px solid var(--border-light)',
                      background: 'var(--theme-modal-bg, #FFFFFF)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      flexShrink: 0
                    }}>
                      {isDirectOrderingActive && (
                        <button
                          type="button"
                          className="tq-tap"
                          onClick={handleSendDirectOrder}
                          disabled={placingOrder}
                          style={{
                            width: '100%',
                            minHeight: '50px',
                            background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                            color: 'var(--theme-btn-text, #FFFFFF)',
                            padding: placingOrder ? '7px 18px' : '14px 18px',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 900,
                            fontSize: '0.96rem',
                            border: 'none',
                            cursor: placingOrder ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: 'var(--theme-shadow, 0 6px 20px rgba(0, 0, 0, 0.3))',
                            position: 'relative',
                            overflow: 'hidden',
                            opacity: 1
                          }}
                        >
                          {placingOrder ? (
                            <span className="tq-truck-stage" aria-live="polite">
                              <span className="tq-truck-road" />
                              <span className="tq-truck-mover">
                                <svg
                                  className="tq-parcel-box"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <rect x="2" y="4" width="20" height="17" rx="3" fill="#D97706" stroke="#78350F" strokeWidth="1.4" />
                                  <path d="M2 9.5H22" stroke="#92400E" strokeWidth="1.4" />
                                  <rect x="9.5" y="4" width="5" height="6.5" rx="0.8" fill="#FDE68A" />
                                  <path d="M7 15H13" stroke="#FEF3C7" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <svg
                                  className="tq-truck-svg"
                                  viewBox="0 0 68 34"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  {/* Cargo body */}
                                  <rect x="4" y="4" width="38" height="21" rx="4" fill="#FFFFFF" />
                                  <rect x="4" y="18" width="38" height="7" rx="2" fill="#F1F5F9" />
                                  {/* Brand accent stripe */}
                                  <rect x="7" y="9" width="30" height="4.5" rx="2.2" fill="#F59E0B" />
                                  <rect x="7" y="15.5" width="16" height="2" rx="1" fill="#CBD5E1" />
                                  {/* Reverse tail-light */}
                                  <rect className="tq-truck-taillight" x="2.5" y="18.5" width="3" height="4.5" rx="1.2" fill="#EF4444" />
                                  {/* Cab */}
                                  <path d="M42 9H54.5C57.5 9 59.8 11 61 13.8L63.4 19.2C63.8 20.1 64 21 64 22V23.5C64 24.6 63.1 25.5 62 25.5H42V9Z" fill="#F8FAFC" />
                                  {/* Windshield */}
                                  <path d="M46 11.5H54.2C56.1 11.5 57.7 12.7 58.4 14.5L59.8 17.8H46V11.5Z" fill="#0F172A" fillOpacity="0.85" />
                                  {/* Headlight */}
                                  <rect x="61.5" y="20" width="3" height="3" rx="1.2" fill="#FDE047" />
                                  {/* Chassis bar */}
                                  <rect x="5" y="24" width="57" height="2.5" rx="1.2" fill="#334155" />
                                  {/* Rear wheel */}
                                  <circle cx="17" cy="27" r="5" fill="#0F172A" />
                                  <circle cx="17" cy="27" r="2.2" fill="#E2E8F0" />
                                  {/* Front wheel */}
                                  <circle cx="52" cy="27" r="5" fill="#0F172A" />
                                  <circle cx="52" cy="27" r="2.2" fill="#E2E8F0" />
                                </svg>
                              </span>
                              <span className="tq-order-done">
                                {orderConfirmed ? (
                                  <>
                                    <svg
                                      className="tq-order-done-check"
                                      width="20"
                                      height="20"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      aria-hidden="true"
                                    >
                                      <circle cx="12" cy="12" r="10.5" fill="rgba(255,255,255,0.22)" stroke="#FFFFFF" strokeWidth="1.8" />
                                      <path
                                        d="M7.5 12.5L10.5 15.5L16.8 9"
                                        stroke="#FFFFFF"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        pathLength="1"
                                      />
                                    </svg>
                                    <span>{lang === 'hi' ? 'ऑर्डर हो गया!' : 'Order Placed!'}</span>
                                  </>
                                ) : (
                                  <>
                                    <span
                                      style={{
                                        width: '15px',
                                        height: '15px',
                                        borderRadius: '50%',
                                        border: '2px solid rgba(255, 255, 255, 0.35)',
                                        borderTopColor: '#FFFFFF',
                                        animation: 'spin 0.75s linear infinite',
                                        flexShrink: 0
                                      }}
                                    />
                                    <span>{lang === 'hi' ? 'किचन में भेजा जा रहा है...' : 'Confirming Order...'}</span>
                                  </>
                                )}
                              </span>
                            </span>
                          ) : (
                            <>
                              <Sparkles size={18} color="#FDE047" />
                              <span>
                                {isAddon
                                  ? (orderTypeChoice === 'takeaway'
                                    ? `📦 Place Round ${nextRound} Parcel Order (${sym}${formatPriceNumber(isGst ? grandTotal : subtotal)})`
                                    : `⚡ Confirm & Place Round ${nextRound} Order (${sym}${formatPriceNumber(isGst ? grandTotal : subtotal)})`)
                                  : (() => {
                                    const activeType = (currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
                                    const isCin = activeType === 'cinema_seat' || activeType === 'cinema' || String(effectiveTableNum || '').toLowerCase().includes('screen') || String(effectiveTableNum || '').toLowerCase().includes('seat');
                                    const isRoom = activeType === 'room' || String(effectiveTableNum || '').toLowerCase().includes('room');
                                    if (isCin) return `🍿 Deliver to Seat Now (${sym}${formatPriceNumber(isGst ? grandTotal : subtotal)})`;
                                    if (isRoom) return `🛎️ Place In-Room Order (${sym}${formatPriceNumber(isGst ? grandTotal : subtotal)})`;
                                    return `⚡ Confirm & Place Order (${sym}${formatPriceNumber(isGst ? grandTotal : subtotal)})`;
                                  })()}
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      {info && isFlagEnabled(info.whatsapp_enabled, true) && (
                        <button
                          type="button"
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
                          <span>Order via WhatsApp ({sym}{formatPriceNumber(isGst ? grandTotal : subtotal)})</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Direct Kitchen Order Success Confirmation Modal */}
      {orderSuccessModal && (() => {
        const hasToken = Boolean(orderSuccessModal.token_display || orderSuccessModal.token_number);
        const tokenCode = orderSuccessModal.token_display || `TK-${String(orderSuccessModal.token_number).padStart(2, '0')}`;
        const roundNum = Number(orderSuccessModal.round_number) || 1;
        const isAddonRound = roundNum > 1;
        const activeSpace = (orderSuccessModal?.space_type || currentSpaceType || String(info?.table_prefix || 'table')).toLowerCase();
        const isCounter = activeSpace === 'counter' || String(orderSuccessModal.table_number).toLowerCase().includes('counter');
        const isTakeaway = orderSuccessModal?.order_type === 'takeaway' || isCounter || hasToken;
        const isCin = activeSpace === 'cinema_seat' || activeSpace === 'cinema' || String(orderSuccessModal.table_number).toLowerCase().includes('screen') || String(orderSuccessModal.table_number).toLowerCase().includes('seat');
        const isRoom = activeSpace === 'room' || String(orderSuccessModal.table_number).toLowerCase().includes('room');
        const isCabin = activeSpace === 'cabin' || String(orderSuccessModal.table_number).toLowerCase().includes('cabin');

        const destinationMsg = isTakeaway
          ? (lang === 'hi'
            ? 'आपका टेकअवे ऑर्डर किचन में भेज दिया गया है! पैक होते ही स्टाफ आपका टोकन नंबर पुकारेगा।'
            : 'Your takeaway order has been sent to the kitchen! Staff will call your token when ready for counter pickup.')
          : isCin
            ? (lang === 'hi'
              ? 'आपका ऑर्डर भेज दिया गया है! तैयार होते ही स्टाफ आपकी सीट तक लाएगा।'
              : 'Your order has been sent! Our staff will prepare and bring it to your seat shortly.')
            : isRoom
              ? (lang === 'hi'
                ? 'आपका ऑर्डर भेज दिया गया है! तैयार होते ही सीधे आपके रूम में डिलीवर किया जाएगा।'
                : 'Your order has been sent! It will be prepared fresh and delivered to your room shortly.')
              : isCabin
                ? (lang === 'hi'
                  ? 'आपका ऑर्डर भेज दिया गया है! तैयार होते ही आपके केबिन तक सर्व किया जाएगा।'
                  : 'Your order has been sent! It will be prepared and delivered to your cabin shortly.')
                : (lang === 'hi'
                  ? 'आपका ऑर्डर किचन में भेज दिया गया है! तैयार होते ही आपकी टेबल पर सर्व किया जाएगा।'
                  : 'Your order has been sent directly to the kitchen! It will be prepared and served to your table shortly.');

        const liveMatchTrack = activeOrderTrack && (
          String(activeOrderTrack.id) === String(orderSuccessModal.primary_order_id || orderSuccessModal.order_id) ||
          String(activeOrderTrack.latest_order_id || '') === String(orderSuccessModal.order_id) ||
          (orderSuccessModal.session_id && activeOrderTrack.session_id === orderSuccessModal.session_id)
        ) ? activeOrderTrack : null;
        const liveRoundsArr = Array.isArray(liveMatchTrack?.session_summary?.rounds)
          ? liveMatchTrack.session_summary.rounds
          : (Array.isArray(liveMatchTrack?.rounds) ? liveMatchTrack.rounds : []);
        const liveLatestRound = liveRoundsArr.length > 0 ? liveRoundsArr[liveRoundsArr.length - 1] : null;
        const liveModalStatus = String((liveLatestRound?.status || liveMatchTrack?.status || orderSuccessModal.status || 'pending')).toLowerCase();
        const hasLiveRoundPrepared = liveRoundsArr.some(r =>
          (r.kitchen_prepared === 1 || r.kitchen_prepared === '1' || r.kitchen_prepared === true) &&
          !['served', 'completed', 'cancelled', 'rejected'].includes(String(r.status || '').toLowerCase())
        );
        const isLiveModalPrepared = liveRoundsArr.length > 0
          ? Boolean(
            liveModalStatus === 'ready' ||
            liveLatestRound?.kitchen_prepared === 1 ||
            liveLatestRound?.kitchen_prepared === '1' ||
            liveLatestRound?.kitchen_prepared === true ||
            hasLiveRoundPrepared
          )
          : Boolean(
            liveMatchTrack?.kitchen_prepared === 1 ||
            liveMatchTrack?.kitchen_prepared === '1' ||
            liveMatchTrack?.kitchen_prepared === true ||
            liveModalStatus === 'ready'
          );
        const modalStatusLabel = liveModalStatus === 'served'
          ? (lang === 'hi' ? 'सर्व हो चुका है 🍽️' : 'Served to Table 🍽️')
          : isLiveModalPrepared
            ? (lang === 'hi' ? 'ऑर्डर तैयार है! अभी आ रहा है 🛎️' : 'Order Ready! Coming Shortly 🛎️')
            : ['accepted', 'kitchen', 'preparing'].includes(liveModalStatus)
              ? (lang === 'hi' ? 'स्वीकृत — किचन में बन रहा है 👨‍🍳' : 'Accepted — Preparing Now 👨‍🍳')
              : (isAddonRound
                ? (lang === 'hi' ? 'रनिंग बिल में जुड़ा 🟢' : 'Added to Active Order 🟢')
                : (lang === 'hi' ? 'स्वीकृति की प्रतीक्षा में 🟡' : 'Pending Acceptance 🟡'));
        const modalStatusColor = (liveModalStatus === 'served' || isLiveModalPrepared)
          ? '#4ADE80'
          : ['accepted', 'kitchen', 'preparing'].includes(liveModalStatus)
            ? '#38BDF8'
            : '#FCD34D';

        return (
          <div
            key={orderSuccessModal.order_id || 'order-success'}
            onClick={() => setOrderSuccessModal(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.78)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 20000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              animation: 'tqBackdropSmooth 0.32s cubic-bezier(0.22, 1, 0.36, 1) both'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--dock-gradient, var(--header-gradient, linear-gradient(135deg, #0A2315 0%, #143A24 100%)))',
                border: '1.5px solid rgba(255, 255, 255, 0.22)',
                borderRadius: '22px',
                maxWidth: '410px',
                width: '100%',
                maxHeight: '90dvh',
                overflowY: 'auto',
                boxSizing: 'border-box',
                padding: '22px 18px',
                textAlign: 'center',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)',
                color: '#FFFFFF',
                willChange: 'transform, opacity',
                animation: 'tqOrderModalEnter 0.48s cubic-bezier(0.22, 1, 0.36, 1) both'
              }}
            >
              <div style={{ position: 'relative', width: '62px', height: '62px', margin: '0 auto 14px' }}>
                {[
                  { sx: '-38px', sy: '-24px', size: 6, bg: '#4ADE80' },
                  { sx: '38px', sy: '-22px', size: 6, bg: '#FBBF24' },
                  { sx: '-44px', sy: '12px', size: 5, bg: '#38BDF8' },
                  { sx: '44px', sy: '14px', size: 5, bg: '#4ADE80' },
                  { sx: '0px', sy: '-42px', size: 5, bg: '#FDE047' },
                  { sx: '-18px', sy: '-38px', size: 4, bg: '#A7F3D0' }
                ].map((sp, sIdx) => (
                  <span
                    key={sIdx}
                    className="tq-sparkle-dot"
                    style={{
                      width: `${sp.size}px`,
                      height: `${sp.size}px`,
                      marginLeft: `-${sp.size / 2}px`,
                      marginTop: `-${sp.size / 2}px`,
                      background: sp.bg,
                      '--sx': sp.sx,
                      '--sy': sp.sy
                    }}
                  />
                ))}
                <div
                  className="tq-check-ripple"
                  style={{
                    position: 'relative',
                    width: '62px',
                    height: '62px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #25D366 0%, #10B981 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 26px rgba(16, 185, 129, 0.5)',
                    willChange: 'transform, opacity',
                    animation: 'tqCheckCircleBounce 0.54s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s both'
                  }}
                >
                  <svg className="tq-svg-check" viewBox="0 0 28 28" width="30" height="30" fill="none" aria-hidden="true">
                    <path
                      pathLength="1"
                      d="M6.5 14.5 L11.5 19.5 L21.5 9"
                      stroke="#FFFFFF"
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <h2 style={{
                fontSize: '1.3rem',
                fontWeight: 900,
                color: '#FFFFFF',
                margin: '0 0 6px 0',
                lineHeight: 1.25,
                animation: 'tqCardIn 0.36s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both'
              }}>
                {isAddonRound
                  ? (lang === 'hi' ? `राउंड ${roundNum} आइटम जुड़ गए!` : `Round ${roundNum} Items Sent!`)
                  : (lang === 'hi' ? 'ऑर्डर सफलतापूर्वक दर्ज हो गया!' : 'Order Placed Successfully!')}
              </h2>

              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '14px',
                margin: '14px 0',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                animation: 'tqCardIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both'
              }}>
                {hasToken ? (
                  <div
                    className="tq-token-sheen"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.32) 100%)',
                      border: '1.5px dashed #FBBF24',
                      borderRadius: '12px',
                      padding: '10px',
                      marginBottom: '10px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '1.4px', color: '#FDE68A', fontWeight: 800 }}>
                      ⚡ {lang === 'hi' ? 'टेकअवे पिकअप टोकन' : 'Takeaway Pickup Token'}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '2px', lineHeight: 1.12, margin: '4px 0' }}>
                      {tokenCode}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.86)' }}>
                      {lang === 'hi' ? 'पार्सल लेने के लिए यह टोकन काउंटर पर दिखाएं' : 'Show this token at the counter to collect your order'}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '1.12rem', fontWeight: 900, color: '#4ADE80', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{formatCustomerLocation(orderSuccessModal.table_number)}</span>
                    {isAddonRound && (
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.16)', color: '#FDE68A' }}>
                        {lang === 'hi' ? `राउंड ${roundNum}` : `Round ${roundNum}`}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                    {lang === 'hi' ? 'स्थिति:' : 'Status:'}
                  </span>
                  <strong style={{ fontSize: '0.80rem', color: modalStatusColor }}>
                    {modalStatusLabel}
                  </strong>
                </div>
              </div>

              <p style={{
                fontSize: '0.84rem',
                color: 'rgba(255, 255, 255, 0.86)',
                lineHeight: 1.5,
                margin: '0 0 18px 0',
                animation: 'tqCardIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) 0.28s both'
              }}>
                {destinationMsg}
              </p>

              <button
                type="button"
                className="tq-tap"
                onClick={() => { triggerHaptic('light'); setOrderSuccessModal(null); }}
                style={{
                  width: '100%',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 900,
                  fontSize: '0.94rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
                  animation: 'tqCardIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) 0.34s both'
                }}
              >
                {lang === 'hi' ? 'ठीक है, लाइव स्टेटस देखें' : 'Track Live Order →'}
              </button>
            </div>
          </div>
        );
      })()}

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
          zIndex: 10015,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div
            onClick={() => setShowCategoryDrawer(false)}
            style={{ flex: 1 }}
          />

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--theme-modal-bg, var(--bg-app, #FFFFFF))',
              borderTopLeftRadius: '22px',
              borderTopRightRadius: '22px',
              padding: '10px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
              maxWidth: '520px',
              width: '100%',
              boxSizing: 'border-box',
              margin: '0 auto',
              boxShadow: '0 -12px 36px rgba(0, 0, 0, 0.28)',
              maxHeight: '82dvh',
              overflowY: 'auto',
              borderTop: '1px solid var(--theme-modal-border, rgba(226, 232, 240, 0.9))',
              animation: 'sheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{
              width: '38px',
              height: '4px',
              borderRadius: '9999px',
              background: '#CBD5E1',
              margin: '0 auto 10px'
            }} />

            {/* Drawer Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--border-light, #E2E8F0)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="var(--primary-emerald)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark, var(--primary-emerald))', margin: 0 }}>
                  {lang === 'hi' ? 'मेनू श्रेणियां' : 'Menu Categories'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryDrawer(false)}
                aria-label="Close categories"
                style={{
                  color: 'var(--text-dark, #334155)',
                  border: 'none',
                  background: 'var(--bg-secondary, #F1F5F9)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Category List Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <button
                type="button"
                onClick={() => scrollToCategory('all')}
                style={{
                  padding: '10px 13px',
                  borderRadius: '12px',
                  textAlign: 'left',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  background: selectedCategory === 'all' ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--bg-secondary, #F8FAFC)',
                  color: selectedCategory === 'all' ? 'var(--theme-nav-active-text, #FFFFFF)' : 'var(--text-dark)',
                  border: selectedCategory === 'all' ? '1px solid var(--theme-primary, var(--primary-emerald))' : '1px solid var(--border-light, #E2E8F0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <span>❖ {lang === 'hi' ? 'सभी श्रेणियां' : 'All Categories'}</span>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  background: selectedCategory === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--theme-card-bg, #FFFFFF)',
                  padding: '2px 8px',
                  borderRadius: '9999px'
                }}>
                  {dishes.length}
                </span>
              </button>

              {combos.length > 0 && info?.filters_visibility?.combo !== false && (
                <button
                  type="button"
                  onClick={() => scrollToCategory('combos-section')}
                  style={{
                    padding: '10px 13px',
                    borderRadius: '12px',
                    textAlign: 'left',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    background: selectedCategory === 'combos-section' ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--bg-secondary, #F8FAFC)',
                    color: selectedCategory === 'combos-section' ? 'var(--theme-nav-active-text, #FFFFFF)' : 'var(--text-dark)',
                    border: selectedCategory === 'combos-section' ? '1px solid var(--theme-primary, var(--primary-emerald))' : '1px solid var(--border-light, #E2E8F0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <span>🍱 {lang === 'hi' ? 'कॉम्बो एवं थाली' : 'Combos & Thalis'}</span>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: selectedCategory === 'combos-section' ? 'rgba(255,255,255,0.2)' : 'var(--theme-card-bg, #FFFFFF)',
                    padding: '2px 8px',
                    borderRadius: '9999px'
                  }}>
                    {combos.length}
                  </span>
                </button>
              )}

              {populatedCategories.map((cat, catIdx) => {
                const isSelected = String(selectedCategory) === String(cat.id);
                const catDisplayName = (lang === 'hi' && cat.name_hi) ? cat.name_hi : cat.name;
                const itemCount = dishes.filter(d => String(d.category_id) === String(cat.id)).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    className="tq-pill-smooth"
                    onClick={() => scrollToCategory(cat.id)}
                    style={{
                      padding: '10px 13px',
                      borderRadius: '12px',
                      textAlign: 'left',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      background: isSelected ? 'var(--theme-nav-active, var(--primary-emerald))' : 'var(--bg-secondary, #F8FAFC)',
                      color: isSelected ? 'var(--theme-nav-active-text, #FFFFFF)' : 'var(--text-dark)',
                      border: isSelected ? '1px solid var(--theme-primary, var(--primary-emerald))' : '1px solid var(--border-light, #E2E8F0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      animation: 'tqCardIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
                      animationDelay: `${Math.min(catIdx * 24, 160)}ms`,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <CategoryImage
                        image={cat.image}
                        name={cat.name}
                        size={26}
                        isSelected={isSelected}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catDisplayName}</span>
                    </div>

                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--theme-card-bg, #FFFFFF)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      flexShrink: 0
                    }}>
                      {itemCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Customer Dish Detail / Add-on Customization Modal */}
      {selectedDishModal && (
        <DishModal
          key={`${selectedDishModal.id}_${selectedDishModalMode}_${selectedDishInitialPortion || 'default'}`}
          dish={selectedDishModal}
          lang={lang}
          currencySymbol={getCurrencySymbol(info?.currency_symbol)}
          initialPortion={selectedDishInitialPortion}
          modifiersEnabled={info?.modifiers_enabled !== false}
          addonOnly={selectedDishModalMode === 'addon'}
          onAddToCart={isDirectOrderingActive ? handleAddToCart : undefined}
          onClose={() => {
            setSelectedDishModal(null);
            setSelectedDishInitialPortion(null);
            setSelectedDishModalMode('detail');
          }}
        />
      )}

      {/* Customer Thali / Combo Detail Modal */}
      {selectedComboModal && (
        <ComboModal
          combo={selectedComboModal}
          onClose={() => setSelectedComboModal(null)}
          onAddToCart={isDirectOrderingActive ? handleAddComboToCart : undefined}
          onUpdateQuantity={isDirectOrderingActive ? handleUpdateCartQuantity : undefined}
          onOpenCart={() => {
            setSelectedComboModal(null);
            setShowCartDrawer(true);
          }}
          cartQuantity={(() => {
            const inCart = cartItems.find(i => (i.key || i.dish?.id) === `combo_${selectedComboModal.id}`);
            return inCart ? inCart.quantity : 0;
          })()}
          cartKey={`combo_${selectedComboModal.id}`}
          dishes={dishes}
          canOrder={isDirectOrderingActive}
          currencySymbol={getCurrencySymbol(info?.currency_symbol)}
          lang={lang}
          restoType={info?.resto_type}
          foodType={info?.food_type}
          isPureVeg={isPureVegResto}
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
          currencySymbol={getCurrencySymbol(info?.currency_symbol)}
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

