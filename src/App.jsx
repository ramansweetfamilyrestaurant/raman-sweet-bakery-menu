import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
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
import { verifyCustomerLocation } from './utils/geo';
import ServiceRequestModal from './components/ServiceRequestModal';

// Code Splitting (Lazy Loading): Super Admin & Admin JS chunks are loaded ONLY when requested!
const AdminLogin = lazy(() => import('./components/Admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const SuperAdminLogin = lazy(() => import('./components/SuperAdmin/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdmin/SuperAdminDashboard'));
const RegisterPage = lazy(() => import('./components/RegisterPage'));

export default function App() {
  // Parse Table Number from URL query parameter ?table=5
  const urlParams = new URLSearchParams(window.location.search);
  const initialTableNum = urlParams.get('table') || '';
  const [currentTableNum, setCurrentTableNum] = useState(initialTableNum);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [autoKillSeconds, setAutoKillSeconds] = useState(null);

  // Effective Table Number (Empty if session expired or no QR scanned)
  const effectiveTableNum = sessionExpired ? '' : currentTableNum;

  // Language State ('en' or 'hi')
  const [lang, setLang] = useState('en');

  // Navigation State
  const [view, setView] = useState('menu'); // 'menu', 'admin-login', 'admin-dashboard', 'super-admin-login', 'super-admin-dashboard'
  const [layoutMode, setLayoutMode] = useState('list'); // 'list' or 'grid'

  const getInitialToken = () => {
    const t = localStorage.getItem('raman_admin_token');
    return (t && t !== 'undefined' && t !== 'null') ? t : '';
  };
  const getInitialUser = () => {
    const u = localStorage.getItem('raman_admin_user');
    return (u && u !== 'undefined' && u !== 'null') ? u : '';
  };
  const getInitialSlug = () => {
    const s = localStorage.getItem('raman_admin_slug');
    return (s && s !== 'undefined' && s !== 'null') ? s : '';
  };

  const [adminToken, setAdminToken] = useState(getInitialToken());
  const [adminUsername, setAdminUsername] = useState(getInitialUser());
  const [adminSlug, setAdminSlug] = useState(getInitialSlug());
  const [showLandingLoginModal, setShowLandingLoginModal] = useState(false);
  const [landingLoginMode, setLandingLoginMode] = useState('login'); // 'login' | 'forgot'
  const [loginSlugInput, setLoginSlugInput] = useState('');
  const [loginPassInput, setLoginPassInput] = useState('');
  const [landingNewPassInput, setLandingNewPassInput] = useState('');
  const [loginErrMessage, setLoginErrMessage] = useState('');
  const [landingSuccessMessage, setLandingSuccessMessage] = useState('');
  const [landingLoginLoading, setLandingLoginLoading] = useState(false);
  const [masterSupportPhone, setMasterSupportPhone] = useState('919876543210');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) setMasterSupportPhone(data.support_whatsapp);
      })
      .catch(console.error);
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
  const [info, setInfo] = useState(null);
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
  const [serviceToastMsg, setServiceToastMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // In-Context Owner Modals State
  const [ownerDishModalData, setOwnerDishModalData] = useState(null); // null, 'new', or dish object
  const [ownerCatModalData, setOwnerCatModalData] = useState(null); // null, 'new', or cat object

  // WhatsApp Direct Order Cart State & Handlers
  const [cartItems, setCartItems] = useState([]);
  const [combos, setCombos] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  const handleAddToCart = (dish, portionType = 'full') => {
    const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
    const isHalf = portionType === 'half' && hasHalfPrice;
    
    // Explicit portion label for clear Kitchen KOT receipt printing
    let portionName = '';
    if (hasHalfPrice) {
      portionName = isHalf ? 'Half' : 'Full';
    } else if (dish.portion && dish.portion.trim() !== '') {
      portionName = dish.portion.trim();
    }

    const unitPrice = isHalf ? Math.round(Number(dish.price_half)) : Math.round(Number(dish.price));
    const cartKey = `${dish.id}_${portionName || 'regular'}`;

    const existingIndex = cartItems.findIndex(i => (i.key === cartKey) || (i.dish.id === dish.id && i.portion === portionName));
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        key: cartKey,
        dish,
        portion: portionName,
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
    let msg = `👋 Hello *${info.name}*!\nI would like to place an order from table #${effectiveTableNum || '1'}:\n\n`;
    let grandTotal = 0;
    cartItems.forEach(item => {
      const itemPrice = item.price * item.quantity;
      grandTotal += itemPrice;
      const portionText = item.portion ? ` (${item.portion})` : '';
      msg += `• ${item.quantity}x *${item.dish.name}${portionText}* - ${info.currency_symbol || '₹'}${itemPrice}\n`;
    });
    msg += `\n*Total Amount:* ${info.currency_symbol || '₹'}${grandTotal}\n\nThank you!`;
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const [orderTableInput, setOrderTableInput] = useState(initialTableNum || '1');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // FIX: Table-specific localStorage key to prevent cross-table order leakage
  const getOrderStorageKey = () => {
    const t = effectiveTableNum || orderTableInput || '1';
    return `raman_active_order_id_table_${t}`;
  };
  const [activeOrderId, setActiveOrderId] = useState(localStorage.getItem(getOrderStorageKey()) || null);
  const [activeOrderTrack, setActiveOrderTrack] = useState(null);

  // 2-Minute (120s) Auto-Kill Timer Effect after order completion
  useEffect(() => {
    if (activeOrderTrack && (activeOrderTrack.status === 'completed' || activeOrderTrack.status === 'cancelled')) {
      if (autoKillSeconds === null) {
        setAutoKillSeconds(120); // 2 minutes countdown
      }
    } else {
      setAutoKillSeconds(null);
    }
  }, [activeOrderTrack?.status]);

  useEffect(() => {
    if (autoKillSeconds === null) return;
    if (autoKillSeconds <= 0) {
      // Auto-kill session after 2 mins
      localStorage.removeItem(getOrderStorageKey());
      setActiveOrderId(null);
      setActiveOrderTrack(null);
      setCurrentTableNum('');
      setSessionExpired(true);
      setAutoKillSeconds(null);
      // Clean URL parameter without reloading page
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const timer = setInterval(() => {
      setAutoKillSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [autoKillSeconds]);

  // Multi-Device Table-Level Live Sync Effect
  useEffect(() => {
    const activeTargetTable = effectiveTableNum || orderTableInput || '1';
    const currentSlug = getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';

    const checkTableStatus = async () => {
      try {
        if (activeOrderId) {
          const data = await trackOrderStatus(activeOrderId);
          if (data) {
            setActiveOrderTrack(data);
            return;
          }
        }
        // Multi-device table sync: fetch latest active order for this table
        if (activeTargetTable && !sessionExpired) {
          const tableData = await fetchActiveTableOrder(currentSlug, activeTargetTable);
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
  }, [activeOrderId, effectiveTableNum, orderTableInput, info, sessionExpired]);

  const handleSendDirectOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacingOrder(true);
    try {
      // 📍 GPS Geo-Fencing Radius Check (Verifies customer is physically within restaurant radius)
      if (info && info.latitude && info.longitude) {
        const geoCheck = await verifyCustomerLocation(
          info.latitude,
          info.longitude,
          info.max_distance_meters || 100
        );

        if (!geoCheck.allowed) {
          alert(`📍 ${geoCheck.message || 'Location verification failed.'}`);
          setPlacingOrder(false);
          return;
        }
      }

      const currentSlug = getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';
      const itemsPayload = cartItems.map(item => ({
        dish_id: item.isCombo ? item.dish.id : item.dish.id,
        name: item.dish.name,
        portion: item.portion || '',
        price: item.price,
        quantity: item.quantity,
        ...(item.isCombo ? { type: 'combo', includes: item.comboIncludes || '' } : {})
      }));
      const grandTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const res = await createDirectOrder({
        slug: currentSlug,
        table_number: orderTableInput || '1',
        customer_name: customerNameInput || 'Dine-In Customer',
        customer_phone: customerPhoneInput || '',
        items: itemsPayload,
        total_amount: grandTotal
      });

      if (res && res.order_id) {
        localStorage.setItem(getOrderStorageKey(), String(res.order_id));
        setActiveOrderId(String(res.order_id));
      }

      setOrderSuccessModal(res);
      setCartItems([]);
      setShowCartDrawer(false);
    } catch (err) {
      alert(err.message || 'Failed to place order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Extract restaurant slug from URL (/slug, /r/:slug, or default)
  const getSlugFromUrl = () => {
    const path = window.location.pathname;
    if (!path || path === '/' || path === '/admin' || path === '/super-admin' || path === '/superadmin' || path === '/register') {
      return '';
    }
    
    // Support legacy /r/:slug format
    if (path.startsWith('/r/')) {
      const parts = path.split('/r/')[1].split('/');
      return parts[0] || '';
    }

    // Support clean direct /:slug format (e.g., /raja-restaurant or /raja-restaurant/admin)
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const parts = cleanPath.split('/');
    const candidate = parts[0];
    
    // Filter out system routes
    if (['admin', 'superadmin', 'super-admin', 'api', 'uploads', 'assets', 'register'].includes(candidate.toLowerCase())) {
      return '';
    }
    
    return candidate || '';
  };

  // Load Menu Data
  const loadMenuData = async (forcedSlug) => {
    setLoading(true);
    setRestaurantStatus('active');
    const slug = forcedSlug || getSlugFromUrl();
    const isAdminMode = Boolean(adminToken);
    try {
      const infoData = await fetchRestaurantInfo(slug);
      if (!infoData || infoData.notFound) {
        setRestaurantStatus('not_found');
        setLoading(false);
        return;
      }
      if (infoData.suspended) {
        setRestaurantStatus('suspended');
        setInfo(infoData);
        setLoading(false);
        return;
      }

      const [catData, dishData, comboData] = await Promise.all([
        fetchCategories({ slug, adminView: isAdminMode }),
        fetchDishes({ query: searchQuery, slug, adminView: isAdminMode }),
        fetchCombos(slug).catch(() => [])
      ]);
      setInfo(infoData);
      setCategories(catData);
      setDishes(dishData);
      setCombos(Array.isArray(comboData) ? comboData : []);
      if (infoData && infoData.name && window.location.pathname !== '/' && window.location.pathname !== '/register') {
        document.title = `${infoData.name} - Digital Menu & Ordering`;
      } else if (window.location.pathname === '/') {
        document.title = 'KhanaMaster - Digital Menu & QR Ordering Platform';
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
    loadMenuData();
  }, [searchQuery, adminToken]);

  // Dynamic Theme Color Engine Applicator
  useEffect(() => {
    if (info && info.theme_color) {
      document.documentElement.setAttribute('data-theme', info.theme_color);
    } else {
      document.documentElement.setAttribute('data-theme', 'gold');
    }
  }, [info]);

  // Handle URL route changes (/super-admin, /admin, /, /r/:slug, #super-admin, #admin)
  useEffect(() => {
    const handleRouteCheck = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      // If someone types bare /admin without restaurant slug
      if (path === '/admin' || path === '/admin/') {
        const storedSlug = localStorage.getItem('raman_admin_slug');
        if (storedSlug) {
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

      if (isSuperAdmin) {
        if (superToken) {
          setView('super-admin-dashboard');
        } else {
          setView('super-admin-login');
        }
      } else if (isRegister) {
        setView('register');
      } else if (isRouteAdmin) {
        const currentSlug = getSlugFromUrl() || (info && info.slug);
        const storedSlug = localStorage.getItem('raman_admin_slug');
        if (adminToken && storedSlug && currentSlug && storedSlug === currentSlug) {
          setView('admin-dashboard');
        } else {
          if (storedSlug && currentSlug && storedSlug !== currentSlug) {
            localStorage.removeItem('raman_admin_token');
            localStorage.removeItem('raman_admin_user');
            localStorage.removeItem('raman_admin_slug');
            setAdminToken('');
            setAdminUsername('');
            setAdminSlug('');
          }
          setView('admin-login');
        }
      } else if (isRootPath) {
        setView('landing');
        document.title = 'KhanaMaster - Digital Menu & QR Ordering Platform';
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
  }, [adminToken, superToken, info]);

  const handleAdminLoginSuccess = (token, username, slug) => {
    const currentSlug = slug || getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';
    localStorage.setItem('raman_admin_token', token);
    localStorage.setItem('raman_admin_user', username);
    localStorage.setItem('raman_admin_slug', currentSlug);
    setAdminToken(token);
    setAdminUsername(username);
    setAdminSlug(currentSlug);
    setView('admin-dashboard');
    window.history.pushState({}, '', `/${currentSlug}/admin`);
  };

  const handleAdminLogout = () => {
    const currentSlug = getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';
    localStorage.removeItem('raman_admin_token');
    localStorage.removeItem('raman_admin_user');
    localStorage.removeItem('raman_admin_slug');
    setAdminToken('');
    setAdminUsername('');
    setAdminSlug('');
    setView('menu');
    window.history.pushState({}, '', `/${currentSlug}`);
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

  // Landing Page View — Public SaaS Home
  if (view === 'landing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #1A0A2E 30%, #0D1B2A 70%, #0A0A0A 100%)',
        color: '#FFFFFF',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        overflow: 'hidden'
      }}>
        {/* Animated background particles */}
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 20% 50%, rgba(120, 80, 255, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255, 180, 50, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(0, 200, 150, 0.05) 0%, transparent 50%)'
        }} />

        {/* Navigation */}
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', position: 'relative', zIndex: 10, flexWrap: 'wrap', gap: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🍽️</span>
            <span style={{
              fontSize: '20px', fontWeight: 800,
              background: 'linear-gradient(135deg, #DFBA67, #F4D490)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Khana Master</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #DFBA67, #F4D490)', color: '#0A0A0A', cursor: 'pointer', fontWeight: 800, fontSize: '13px',
                boxShadow: '0 4px 14px rgba(223,186,103,0.3)', transition: 'all 0.3s', whiteSpace: 'nowrap'
              }}
            >🚀 Start Free Trial</button>
            
            <button onClick={() => setShowLandingLoginModal(true)}
              style={{
                padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)', color: '#ccc', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                transition: 'all 0.3s', whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#fff'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#ccc'; }}
            >🔑 Login</button>
          </div>
        </nav>

        {/* 🔑 Restaurant Admin Login & Forgot Password Modal */}
        {showLandingLoginModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10050,
            background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px'
          }} onClick={() => { setShowLandingLoginModal(false); setLandingLoginMode('login'); }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#111827', border: '2px solid #DFBA67', borderRadius: '24px',
              padding: '24px 18px', maxWidth: '400px', width: '95%', maxHeight: '90vh', overflowY: 'auto',
              color: '#FFFFFF', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', position: 'relative'
            }}>
              <button onClick={() => { setShowLandingLoginModal(false); setLandingLoginMode('login'); }} style={{
                position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#FFF',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>

              <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '10px' }}>
                {landingLoginMode === 'forgot' ? '🔒' : '🔑'}
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DFBA67', margin: '0 0 6px 0', textAlign: 'center' }}>
                {landingLoginMode === 'forgot' ? 'Reset Admin Password' : 'Restaurant Admin Login'}
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.82rem', lineHeight: 1.4, margin: '0 0 16px 0', textAlign: 'center' }}>
                {landingLoginMode === 'forgot'
                  ? 'Enter your registered Username or Phone Number to set a new password'
                  : 'Enter your Admin Username & Password to access your Dashboard'}
              </p>

              {landingSuccessMessage && (
                <div style={{
                  background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.4)',
                  color: '#34D399', padding: '10px 14px', borderRadius: '12px',
                  fontSize: '0.82rem', marginBottom: '16px', textAlign: 'center', fontWeight: 700
                }}>
                  {landingSuccessMessage}
                </div>
              )}

              {loginErrMessage && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#FCA5A5', padding: '10px 14px', borderRadius: '12px',
                  fontSize: '0.82rem', marginBottom: '16px', textAlign: 'center'
                }}>
                  ⚠️ {loginErrMessage}
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoginErrMessage('');
                setLandingSuccessMessage('');

                if (landingLoginMode === 'forgot') {
                  if (!loginSlugInput.trim() || !landingNewPassInput) {
                    setLoginErrMessage('Please fill in all fields');
                    return;
                  }
                  if (landingNewPassInput.length < 4) {
                    setLoginErrMessage('New password must be at least 4 characters long');
                    return;
                  }
                  setLandingLoginLoading(true);
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
                  return;
                }

                if (!loginSlugInput.trim() || !loginPassInput) return;

                setLandingLoginLoading(true);
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

                  // Save admin session tokens
                  localStorage.setItem('raman_admin_token', data.token);
                  localStorage.setItem('raman_admin_user', data.username);
                  localStorage.setItem('raman_admin_slug', data.slug);
                  setAdminToken(data.token);
                  setAdminUsername(data.username);
                  setAdminSlug(data.slug);

                  setShowLandingLoginModal(false);
                  window.history.pushState({}, '', `/${data.slug}/admin`);
                  window.dispatchEvent(new PopStateEvent('popstate'));
                } catch (err) {
                  console.error('Landing login error:', err);
                  setLoginErrMessage(err.message);
                } finally {
                  setLandingLoginLoading(false);
                }
              }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                    {landingLoginMode === 'forgot' ? 'USERNAME OR PHONE NUMBER *' : 'ADMIN USERNAME *'}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder={landingLoginMode === 'forgot' ? 'e.g. admin or 9876543210' : 'Enter your admin username'}
                    value={loginSlugInput}
                    onChange={e => setLoginSlugInput(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.2)', background: '#1F2937',
                      color: '#FFFFFF', fontSize: '0.9rem', outline: 'none'
                    }}
                  />
                </div>

                {landingLoginMode === 'login' ? (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#DFBA67' }}>
                        PASSWORD *
                      </label>
                      <button
                        type="button"
                        onClick={() => { setLandingLoginMode('forgot'); setLoginErrMessage(''); setLandingSuccessMessage(''); }}
                        style={{ background: 'none', border: 'none', color: '#34D399', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        🔑 Forgot Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={loginPassInput}
                      onChange={e => setLoginPassInput(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 14px', borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.2)', background: '#1F2937',
                        color: '#FFFFFF', fontSize: '0.9rem', outline: 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#DFBA67', marginBottom: '6px' }}>
                      NEW PASSWORD *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter new password (min 4 chars)"
                      value={landingNewPassInput}
                      onChange={e => setLandingNewPassInput(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 14px', borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.2)', background: '#1F2937',
                        color: '#FFFFFF', fontSize: '0.9rem', outline: 'none'
                      }}
                    />
                  </div>
                )}

                <button type="submit" disabled={landingLoginLoading} style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #DFBA67, #F4D490)', color: '#0A0A0A',
                  fontWeight: 900, fontSize: '0.9rem', cursor: landingLoginLoading ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(223,186,103,0.4)'
                }}>
                  {landingLoginLoading
                    ? 'Processing...'
                    : (landingLoginMode === 'forgot' ? '🔑 Update Password' : '🚀 Log In & Open Dashboard ➔')}
                </button>

                {landingLoginMode === 'forgot' && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setLandingLoginMode('login'); setLoginErrMessage(''); setLandingSuccessMessage(''); }}
                      style={{
                        width: '100%', marginTop: '12px', padding: '8px', color: '#34D399',
                        fontSize: '0.82rem', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer'
                      }}
                    >
                      ← Back to Owner Login
                    </button>
                    <div style={{
                      marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)',
                      textAlign: 'center', fontSize: '0.76rem', color: '#9CA3AF'
                    }}>
                      <span>Dono Username & Phone bhool gaye? </span>
                      <a
                        href={`https://wa.me/${(masterSupportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello Super Admin, I forgot my restaurant login details. Please help me recover my account.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#DFBA67', fontWeight: 800, textDecoration: 'none' }}
                      >
                        💬 WhatsApp Support
                      </a>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '50px 16px 40px', position: 'relative', zIndex: 5
        }}>
          <div style={{
            display: 'inline-block', padding: '6px 14px', borderRadius: '50px',
            background: 'linear-gradient(135deg, rgba(223,186,103,0.15), rgba(223,186,103,0.05))',
            border: '1px solid rgba(223,186,103,0.3)', fontSize: '12px', color: '#DFBA67',
            fontWeight: 700, marginBottom: '20px', letterSpacing: '0.5px'
          }}>🚀 INDIA's #1 DIGITAL MENU PLATFORM</div>

          <h1 style={{
            fontSize: 'clamp(28px, 7vw, 60px)', fontWeight: 900, lineHeight: 1.2,
            marginBottom: '18px', maxWidth: '800px', width: '100%'
          }}>
            <span style={{ color: '#FFFFFF' }}>Apne Restaurant Ka </span>
            <span style={{
              background: 'linear-gradient(135deg, #DFBA67, #F4D490, #DFBA67)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Digital Menu</span>
            <span style={{ color: '#FFFFFF' }}> Banayein</span>
          </h1>

          <p style={{
            fontSize: 'clamp(14px, 3.5vw, 18px)', color: 'rgba(255,255,255,0.7)',
            maxWidth: '560px', lineHeight: 1.6, marginBottom: '32px', padding: '0 8px'
          }}>
            QR Code se Digital Menu, WhatsApp Ordering, Google Reviews — sab kuch ek jagah. 
            <strong style={{ color: '#DFBA67' }}> 14 din free trial</strong>, koi credit card nahi chahiye!
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '480px' }}>
            <button onClick={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              style={{
                flex: '1 1 200px', padding: '14px 24px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, #DFBA67, #C9A44A)', color: '#0A0A0A',
                fontWeight: 900, fontSize: '16px', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(223,186,103,0.3)',
                transition: 'all 0.3s ease', textAlign: 'center'
              }}
            >🚀 Free Trial Shuru Karein</button>
            <button onClick={() => window.open('https://khana-master.onrender.com/raman-sweet-bakery', '_blank')}
              style={{
                flex: '1 1 160px', padding: '14px 20px', borderRadius: '14px',
                border: '2px solid rgba(223,186,103,0.4)', background: 'rgba(223,186,103,0.05)',
                color: '#DFBA67', fontWeight: 800, fontSize: '15px', cursor: 'pointer',
                transition: 'all 0.3s', textAlign: 'center'
              }}
            >👁️ Live Demo Dekhein</button>
          </div>
        </div>

        {/* Features Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px', padding: '40px 16px', maxWidth: '1100px', margin: '0 auto',
          position: 'relative', zIndex: 5
        }}>
          {[
            { icon: '📱', title: 'Digital QR Menu', desc: 'Customer QR scan kare aur luxury menu dekhe — no app download required' },
            { icon: '💬', title: 'WhatsApp Ordering', desc: 'Customer seedha WhatsApp pe order bhej sake — zero commission' },
            { icon: '⭐', title: 'Google Reviews', desc: 'One-click Google review collection — 5-star ratings badhayein' },
            { icon: '🎨', title: 'Premium Themes', desc: 'Gold, Rose, Emerald — 10+ luxury themes apne brand ke hisaab se' },
            { icon: '📊', title: 'Admin Dashboard', desc: 'Menu manage karein, orders dekhein, analytics — sab ek jagah' },
            { icon: '🚀', title: 'Instant Setup', desc: '5 minute me ready — registration karein aur turant shuru karein' }
          ].map((f, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px', padding: '24px 20px', transition: 'all 0.3s',
              cursor: 'default'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px', color: '#DFBA67' }}>{f.title}</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing Section */}
        <div style={{
          padding: '50px 16px', textAlign: 'center', position: 'relative', zIndex: 5
        }}>
          <h2 style={{ fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 900, marginBottom: '8px' }}>
            <span style={{ background: 'linear-gradient(135deg, #DFBA67, #F4D490)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Simple Pricing</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '32px' }}>Har plan me 14-din ka free trial included hai</p>
          
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px', maxWidth: '900px', margin: '0 auto'
          }}>
            {[
              { name: 'Basic', price: '₹499', period: '/month', badge: '⚡', features: ['Digital QR Menu', 'Premium Themes', 'Admin Dashboard', 'Unlimited Items'], popular: false },
              { name: 'Pro', price: '₹999', period: '/month', badge: '👑', features: ['Everything in Basic', 'WhatsApp Ordering', 'Google Reviews', 'Priority Support'], popular: true },
              { name: 'Enterprise', price: '₹1,999', period: '/month', badge: '🚀', features: ['Everything in Pro', 'Direct Table Ordering', 'KOT Kitchen System', 'Custom Branding'], popular: false }
            ].map((plan, i) => (
              <div key={i} style={{
                background: plan.popular ? 'linear-gradient(135deg, rgba(223,186,103,0.12), rgba(223,186,103,0.04))' : 'rgba(255,255,255,0.03)',
                border: plan.popular ? '2px solid rgba(223,186,103,0.6)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px', padding: '28px 20px', position: 'relative',
                transition: 'all 0.3s'
              }}>
                {plan.popular && <div style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #DFBA67, #C9A44A)', color: '#0A0A0A',
                  padding: '3px 16px', borderRadius: '50px', fontSize: '11px', fontWeight: 900
                }}>MOST POPULAR</div>}
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>{plan.badge}</div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{plan.name}</h3>
                <div style={{ marginBottom: '20px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#DFBA67' }}>{plan.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{plan.period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px', textAlign: 'left' }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ padding: '7px 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      ✅ {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => { window.history.pushState({}, '', '/register'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                    background: plan.popular ? 'linear-gradient(135deg, #DFBA67, #C9A44A)' : 'rgba(255,255,255,0.1)',
                    color: plan.popular ? '#0A0A0A' : '#DFBA67', fontWeight: 800, fontSize: '14px',
                    cursor: 'pointer', transition: 'all 0.3s'
                  }}
                >Start Free Trial</button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          textAlign: 'center', padding: '40px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          position: 'relative', zIndex: 5
        }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
            © 2025 Khana Master — India's Premium Digital Menu SaaS Platform
          </p>
        </footer>
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
          handleAdminLoginSuccess(res.token, res.username || 'Admin', res.slug);
        }} />
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
            const targetSlug = tenantSlug || (info && info.slug) || 'raman-sweet-bakery';
            localStorage.setItem('raman_admin_token', tenantToken);
            localStorage.setItem('raman_admin_user', tenantUsername);
            localStorage.setItem('raman_admin_slug', targetSlug);
            setAdminToken(tenantToken);
            setAdminUsername(tenantUsername);
            setAdminSlug(targetSlug);
            setView('admin-dashboard');
            window.history.pushState({}, '', `/r/${targetSlug}/admin`);
          }}
          onReturnToMenu={(tenantSlug) => {
            const targetSlug = tenantSlug || (info && info.slug) || getSlugFromUrl() || 'raman-sweet-bakery';
            setView('menu');
            window.history.pushState({}, '', `/r/${targetSlug}`);
            loadMenuData(targetSlug);
          }}
        />
      </Suspense>
    );
  }

  // Restaurant Admin View Render
  if (view === 'admin-login') {
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#0A2315', color: '#FFFFFF', minHeight: '100vh', fontWeight: 800 }}>🔑 Loading Admin Login...</div>}>
        <AdminLogin
          restaurantName={info?.name}
          onLoginSuccess={handleAdminLoginSuccess}
          onCancel={() => {
            const targetSlug = getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';
            setView('menu');
            window.history.pushState({}, '', `/r/${targetSlug}`);
            loadMenuData(targetSlug);
          }}
        />
      </Suspense>
    );
  }

  if (view === 'admin-dashboard') {
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#0A2315', color: '#FFFFFF', minHeight: '100vh', fontWeight: 800 }}>⚙️ Loading Owner Dashboard...</div>}>
        <AdminDashboard
          token={adminToken}
          username={adminUsername}
          onLogout={handleAdminLogout}
          onReturnToMenu={(tenantSlug) => {
            const targetSlug = tenantSlug || (info && info.slug) || getSlugFromUrl() || 'raman-sweet-bakery';
            setView('menu');
            window.history.pushState({}, '', `/r/${targetSlug}`);
            loadMenuData(targetSlug);
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
          Restaurant Not Found / Deleted
        </h1>
        <p style={{ fontSize: '0.92rem', color: '#94A3B8', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          Yeh restaurant ab platform par active nahi hai ya iska URL delete kar diya gaya hai.
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
          🏠 Go to KhanaMaster Homepage
        </button>
      </div>
    );
  }

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

  // Customer Digital Menu Render (Clean public view — NO admin controls)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Customer Header */}
      <CustomerHeader
        info={info}
        lang={lang}
        tableNum={effectiveTableNum}
        onToggleLang={() => setLang(lang === 'en' ? 'hi' : 'en')}
        onOpenInfoModal={() => setShowInfoModal(true)}
        onCallStaff={() => setShowServiceModal(true)}
        onOpenAdmin={() => {
          if (adminToken) {
            setView('admin-dashboard');
            window.history.pushState({}, '', '/admin');
          } else {
            setView('admin-login');
            window.history.pushState({}, '', '/admin');
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
                Order #{activeOrderTrack.id} • Table {activeOrderTrack.table_number || '1'}
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#E5E7EB', fontWeight: 700 }}>
                Status: {
                  activeOrderTrack.status === 'pending' ? 'Pending Kitchen Acceptance 🟡' :
                  activeOrderTrack.status === 'preparing' ? 'Chef is Preparing 👨‍🍳' :
                  activeOrderTrack.status === 'served' ? 'Served to Table 🟢' :
                  activeOrderTrack.status === 'completed' ? `Order Completed & Paid 🏁` : 'Cancelled 🔴'
                }
              </span>
              {(activeOrderTrack.status === 'completed' || activeOrderTrack.status === 'cancelled') && (
                <div style={{ fontSize: '0.72rem', color: '#FCD34D', fontWeight: 700, marginTop: '3px' }}>
                  ⏳ Session expire hone me: <strong>{autoKillSeconds !== null ? `${Math.floor(autoKillSeconds/60)}m ${String(autoKillSeconds%60).padStart(2,'0')}s` : '2m 00s'}</strong> (Naya order karne ke liye QR dobara scan karein)
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem(getOrderStorageKey());
              setActiveOrderId(null);
              setActiveOrderTrack(null);
              setCurrentTableNum('');
              setSessionExpired(true);
              window.history.replaceState({}, '', window.location.pathname);
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
          padding: '10px 16px',
          borderBottom: '2px solid #F87171',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          fontWeight: 700
        }}>
          <span>⌛ <strong>Session Expired:</strong> Order complete ho chuka hai! Naya order karne ke liye table QR dubara scan karein.</span>
          <button
            onClick={() => setSessionExpired(false)}
            style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
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
      />

      {/* Sticky Category Quick Jump Rail */}
      <CategoryJumpRail
        categories={categories}
        lang={lang}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => setSelectedCategory(catId)}
        hasCombos={combos.length > 0}
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
            padding: '40px 20px',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              {lang === 'hi' ? 'कोई व्यंजन नहीं मिला' : 'No dishes found'}
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {lang === 'hi' ? 'कृपया अपनी खोज शब्द बदलें' : 'Try searching for something else'}
            </p>
          </div>
        ) : (
          <>
          {/* 🛒 COMBO DEALS SECTION */}
          {combos.length > 0 && !searchQuery && (
            <section id="combos-section" style={{ marginBottom: '28px', scrollMarginTop: '110px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '12px', paddingBottom: '6px', borderBottom: '2px solid var(--gold-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🍱</span>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                    {lang === 'hi' ? 'कॉम्बो डील्स & थाली' : 'Combo Deals & Thalis'}
                  </h2>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 800, color: '#B45309',
                    background: '#FEF3C7', padding: '2px 8px', borderRadius: '12px',
                    border: '1px solid #FCD34D'
                  }}>{combos.length}</span>
                </div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800, color: '#059669'
                }}>👉 Swipe ({combos.length})</span>
              </div>
              <div style={{
                display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px',
                scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', msOverflowStyle: 'none'
              }}>
                {combos.map(combo => {
                  let comboItems = [];
                  try { comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []); } catch { comboItems = []; }
                  const originalTotal = comboItems.reduce((s, i) => s + ((i.original_price || 0) * (i.qty || 1)), 0);
                  const savings = originalTotal - combo.price;
                  const canOrder = effectiveTableNum && (info?.direct_ordering_enabled === true || info?.direct_ordering_enabled === 1);
                  return (
                    <div 
                      key={combo.id}
                      onClick={() => setSelectedComboModal(combo)}
                      style={{
                        minWidth: '290px', maxWidth: '320px', flexShrink: 0, scrollSnapAlign: 'start',
                        background: '#FFFFFF', borderRadius: 'var(--radius-md)', padding: '14px',
                        border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)',
                        position: 'relative', overflow: 'hidden', cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        {/* Food Image Container */}
                        <div style={{
                          width: '94px', height: '78px', borderRadius: '14px', overflow: 'hidden',
                          background: '#F9FAFB', border: '1.5px solid var(--gold-border)', flexShrink: 0,
                          position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}>
                          {combo.image && combo.image !== '/uploads/logo.jpg' ? (
                            <img 
                              src={combo.image} 
                              alt={combo.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }} 
                            />
                          ) : null}
                          <div style={{
                            width: '100%', height: '100%',
                            display: (combo.image && combo.image !== '/uploads/logo.jpg') ? 'none' : 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem',
                            background: 'linear-gradient(135deg, rgba(223,186,103,0.15), rgba(10,35,21,0.5))'
                          }}>
                            🍱
                          </div>
                        </div>

                        {/* Combo Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Badges Row */}
                          {(combo.badge || savings > 0) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
                              {combo.badge && (
                                <span style={{
                                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.64rem', fontWeight: 800,
                                  background: 'linear-gradient(135deg, #FFD700, #F59E0B)', color: '#0A0A0A',
                                  whiteSpace: 'nowrap'
                                }}>{combo.badge}</span>
                              )}
                              {savings > 0 && (
                                <span style={{
                                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.64rem', fontWeight: 900,
                                  background: 'linear-gradient(135deg, #059669, #10B981)', color: '#FFFFFF',
                                  whiteSpace: 'nowrap'
                                }}>SAVE ₹{Math.round(savings)}</span>
                              )}
                            </div>
                          )}

                          {/* Full-width Title */}
                          <h3 style={{
                            fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-dark)',
                            margin: '0 0 5px 0', lineHeight: 1.3
                          }}>
                            {combo.name}
                          </h3>

                          {combo.description && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', margin: '0 0 6px 0', lineHeight: 1.3 }}>{combo.description}</p>
                          )}

                          {/* Included Dishes Pills */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {comboItems.map((item, idx) => (
                              <span key={idx} style={{
                                padding: '2px 7px', borderRadius: '6px', fontSize: '0.66rem',
                                background: '#F3F4F6', color: '#374151', fontWeight: 700,
                                border: '1px solid #E5E7EB'
                              }}>
                                {item.qty > 1 ? `${item.qty}x ` : ''}{item.dish_name}{item.portion === 'half' ? ' (H)' : ''}
                              </span>
                            ))}
                          </div>

                          {/* Price & Add Button */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 900, fontSize: '1.15rem', color: 'var(--primary-emerald)' }}>
                                {info?.currency_symbol || '₹'}{Math.round(Number(combo.price))}
                              </span>
                              {originalTotal > 0 && originalTotal > combo.price && (
                                <span style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: '0.8rem', fontWeight: 600 }}>
                                  ₹{Math.round(originalTotal)}
                                </span>
                              )}
                            </div>
                            {canOrder && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddComboToCart(combo);
                                }}
                                style={{
                                  padding: '7px 16px', borderRadius: '10px', border: 'none',
                                  background: 'linear-gradient(135deg, var(--primary-emerald), #059669)',
                                  color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                                  boxShadow: '0 3px 10px rgba(16,185,129,0.3)',
                                  display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <Plus size={14} /> Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {groupedDishes.map((group, gIdx) => (
            <section key={gIdx} id={`cat-sec-${group.category.id}`} style={{ marginBottom: '28px', scrollMarginTop: '110px' }}>
              {/* Category Section Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                paddingBottom: '6px',
                borderBottom: '2px solid var(--gold-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {group.category.image && (
                    <img
                      src={group.category.image}
                      alt=""
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: 'var(--primary-emerald)'
                  }}>
                    {(lang === 'hi' && group.category.name_hi) ? group.category.name_hi : group.category.name}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Category Dish Count */}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {group.items.length} {lang === 'hi' ? 'आइटम' : 'items'}
                  </span>


                </div>
              </div>

              {/* Items List or Grid Display */}
              {layoutMode === 'list' ? (
                <div className="dish-list-grid">
                  {group.items.map((dish) => (
                    <MenuCardItem
                      key={dish.id}
                      dish={dish}
                      lang={lang}
                      currencySymbol={info?.currency_symbol !== undefined ? info.currency_symbol : '₹'}
                      onClick={() => setSelectedDishModal(dish)}
                      onAddToCart={(effectiveTableNum && (info?.direct_ordering_enabled === true || info?.direct_ordering_enabled === 1)) ? handleAddToCart : undefined}
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
                      onClick={() => setSelectedDishModal(dish)}
                      onAddToCart={(effectiveTableNum && (info?.direct_ordering_enabled === true || info?.direct_ordering_enabled === 1)) ? handleAddToCart : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
          </>
        )}
      </main>

      {/* 🛒 Zomato-Style Floating Cart Bar (Appears ONLY when cart has items) */}
      {cartItems.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '78px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 'calc(100% - 32px)',
          maxWidth: '440px'
        }}>
          <button
            onClick={() => setShowCartDrawer(true)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
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
              <span>{lang === 'hi' ? 'कार्ट देखें' : 'View Cart'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#FFFFFF' }}>
                ₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
              </span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}

      {/* 🛎️ Service Request Modal & Toast */}
      {showServiceModal && (
        <ServiceRequestModal
          tableNum={effectiveTableNum}
          slug={getSlugFromUrl() || (info && info.slug)}
          onClose={() => setShowServiceModal(false)}
          onSuccess={(msg) => {
            setServiceToastMsg(msg);
            setTimeout(() => setServiceToastMsg(''), 6000);
          }}
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

      {/* 📲 Order Cart Drawer */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary-emerald)' }}>🛒 My Order Items ({cartItems.reduce((acc, i) => acc + i.quantity, 0)})</strong>
              <button onClick={() => setShowCartDrawer(false)} style={{ background: '#F3F4F6', color: '#374151', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>✕</button>
            </div>

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
                      <span style={{ fontSize: '0.82rem', color: 'var(--gold-primary)', fontWeight: 800 }}>
                        {info?.currency_symbol || '₹'}{item.price} x {item.quantity} = {info?.currency_symbol || '₹'}{item.price * item.quantity}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => handleAddToCart(item.dish, item.portion === 'Half' ? 'half' : 'full')} style={{ background: 'var(--primary-emerald)', color: '#FFF', border: 'none', width: '28px', height: '28px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{item.quantity}</span>
                      <button onClick={() => handleRemoveFromCart(item.key || item.dish.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', width: '28px', height: '28px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cartItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                {/* Table Number & Customer Name Inputs */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>TABLE #</label>
                    <input
                      type="text"
                      value={orderTableInput}
                      onChange={(e) => setOrderTableInput(e.target.value)}
                      placeholder="e.g. 4"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', fontWeight: 800 }}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
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

                {/* ⚡ 1-Click Direct Table Order Button (Only when QR scanned and session active) */}
                {effectiveTableNum && info && info.direct_ordering_enabled !== false && (
                  <button
                    onClick={handleSendDirectOrder}
                    disabled={placingOrder}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
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
                    <span>{placingOrder ? 'Sending to Kitchen...' : `⚡ PLACE DIRECT KITCHEN ORDER (${info?.currency_symbol || '₹'}${cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)})`}</span>
                  </button>
                )}

                {/* 💬 WhatsApp Alternative Order Button (Gated by Super Admin) */}
                {info && info.whatsapp_enabled !== false && (
                  <button
                    onClick={handleSendWhatsAppOrder}
                    style={{
                      width: '100%',
                      background: '#F0FDF4',
                      color: '#15803D',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-pill)',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      border: '1.5px solid #86EFAC',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <MessageSquare size={16} color="#15803D" />
                    <span>Or Send via WhatsApp</span>
                  </button>
                )}
              </div>
            )}
          </div>
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
                Order #{orderSuccessModal.order_id} • Table {orderSuccessModal.table_number}
              </p>
              <p style={{ fontSize: '0.82rem', color: '#D1D5DB', margin: 0 }}>
                Status: <strong style={{ color: '#FBBF24' }}>Pending Kitchen Acceptance 🟡</strong>
              </p>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#E5E7EB', lineHeight: 1.5, marginBottom: '20px' }}>
              Your order has been sent directly to the kitchen terminal! Our staff will prepare and serve it to your table shortly.
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
          if (adminToken) {
            setView('admin-dashboard');
            window.history.pushState({}, '', '/admin');
          } else {
            setView('admin-login');
            window.history.pushState({}, '', '/admin');
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
                      {cat.image && (
                        <img src={cat.image} alt={catDisplayName} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                      )}
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
          onClose={() => setSelectedDishModal(null)}
        />
      )}

      {/* Customer Thali / Combo Detail Modal */}
      {selectedComboModal && (
        <ComboModal
          combo={selectedComboModal}
          onClose={() => setSelectedComboModal(null)}
          onAddToCart={handleAddComboToCart}
          canOrder={Boolean(effectiveTableNum && (info?.direct_ordering_enabled === true || info?.direct_ordering_enabled === 1))}
          currencySymbol={info?.currency_symbol || '₹'}
        />
      )}

      {/* Restaurant Information Modal */}
      {showInfoModal && (
        <RestaurantInfoModal
          info={info}
          lang={lang}
          onClose={() => setShowInfoModal(false)}
        />
      )}

      {/* Owner Dish Edit/Add Form Modal */}
      {ownerDishModalData && (
        <DishFormModal
          dish={ownerDishModalData === 'new' ? null : ownerDishModalData}
          categories={categories}
          token={adminToken}
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
        onOpenAdmin={() => {
          const currentSlug = getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';
          const storedSlug = localStorage.getItem('raman_admin_slug');
          if (adminToken && storedSlug && storedSlug === currentSlug) {
            setView('admin-dashboard');
          } else {
            if (storedSlug !== currentSlug) {
              localStorage.removeItem('raman_admin_token');
              localStorage.removeItem('raman_admin_user');
              localStorage.removeItem('raman_admin_slug');
              setAdminToken('');
              setAdminUsername('');
              setAdminSlug('');
            }
            setView('admin-login');
          }
          window.history.pushState({}, '', `/r/${currentSlug}/admin`);
        }}
      />
    </div>
  );
}
