import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import CustomerHeader from './components/CustomerHeader';
import MenuCardItem from './components/MenuCardItem';
import SearchBar from './components/SearchBar';
import CategoryJumpRail from './components/CategoryJumpRail';
import DishCard from './components/DishCard';
import DishModal from './components/DishModal';
import RestaurantInfoModal from './components/RestaurantInfoModal';
import BottomDock from './components/BottomDock';
import Footer from './components/Footer';
import DishFormModal from './components/Admin/DishFormModal';
import CategoryFormModal from './components/Admin/CategoryFormModal';
import { fetchRestaurantInfo, fetchCategories, fetchDishes, toggleDishAvailability, deleteDish, createDirectOrder, trackOrderStatus, fetchActiveTableOrder } from './api/client';
import { LayoutList, Grid, BookOpen, X, Sparkles, ShieldAlert, Phone, Plus, Edit3, Trash2, LogOut, Settings, Crown, CheckCircle, MessageSquare } from 'lucide-react';

// Code Splitting (Lazy Loading): Super Admin & Admin JS chunks are loaded ONLY when requested!
const AdminLogin = lazy(() => import('./components/Admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const SuperAdminLogin = lazy(() => import('./components/SuperAdmin/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdmin/SuperAdminDashboard'));

export default function App() {
  // Parse Table Number from URL query parameter ?table=5
  const urlParams = new URLSearchParams(window.location.search);
  const tableNum = urlParams.get('table') || '';

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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [loading, setLoading] = useState(true);

  // In-Context Owner Modals State
  const [ownerDishModalData, setOwnerDishModalData] = useState(null); // null, 'new', or dish object
  const [ownerCatModalData, setOwnerCatModalData] = useState(null); // null, 'new', or cat object

  // WhatsApp Direct Order Cart State & Handlers
  const [cartItems, setCartItems] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  const handleAddToCart = (dish) => {
    const existingIndex = cartItems.findIndex(i => i.dish.id === dish.id);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, { dish, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (dishId) => {
    setCartItems(cartItems.filter(i => i.dish.id !== dishId));
  };

  const handleSendWhatsAppOrder = () => {
    if (!info || cartItems.length === 0) return;
    const rawPhone = info.whatsapp_number || info.phone || '';
    const phone = rawPhone.replace(/[^0-9]/g, '');
    if (!phone) {
      alert('WhatsApp number is not configured for this restaurant yet.');
      return;
    }
    let msg = `👋 Hello *${info.name}*!\nI would like to place an order from table #${tableNum || '1'}:\n\n`;
    let grandTotal = 0;
    cartItems.forEach(({ dish, quantity }) => {
      const itemPrice = dish.price * quantity;
      grandTotal += itemPrice;
      msg += `• ${quantity}x *${dish.name}* - ${info.currency_symbol || '₹'}${itemPrice}\n`;
    });
    msg += `\n*Total Amount:* ${info.currency_symbol || '₹'}${grandTotal}\n\nThank you!`;
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const [orderTableInput, setOrderTableInput] = useState(tableNum || '1');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [orderSuccessModal, setOrderSuccessModal] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(localStorage.getItem('raman_active_order_id') || null);
  const [activeOrderTrack, setActiveOrderTrack] = useState(null);

  // Multi-Device Table-Level Live Sync Effect
  useEffect(() => {
    const activeTargetTable = tableNum || orderTableInput || '1';
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
        if (activeTargetTable) {
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
  }, [activeOrderId, tableNum, orderTableInput, info]);

  const handleSendDirectOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacingOrder(true);
    try {
      const currentSlug = getSlugFromUrl() || (info && info.slug) || 'raman-sweet-bakery';
      const itemsPayload = cartItems.map(({ dish, quantity }) => ({
        dish_id: dish.id,
        name: dish.name,
        price: dish.price,
        quantity
      }));
      const grandTotal = cartItems.reduce((sum, i) => sum + i.dish.price * i.quantity, 0);

      const res = await createDirectOrder({
        slug: currentSlug,
        table_number: orderTableInput || '1',
        customer_name: customerNameInput || 'Dine-In Customer',
        customer_phone: customerPhoneInput || '',
        items: itemsPayload,
        total_amount: grandTotal
      });

      if (res && res.order_id) {
        localStorage.setItem('raman_active_order_id', String(res.order_id));
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

  // Extract restaurant slug from URL /r/:slug
  const getSlugFromUrl = () => {
    const path = window.location.pathname;
    if (path.includes('/r/')) {
      const parts = path.split('/r/')[1].split('/');
      return parts[0] || 'raman-sweet-bakery';
    }
    return 'raman-sweet-bakery';
  };

  // Load Menu Data
  const loadMenuData = async (forcedSlug) => {
    const slug = forcedSlug || getSlugFromUrl();
    const isAdminMode = Boolean(adminToken);
    try {
      const [infoData, catData, dishData] = await Promise.all([
        fetchRestaurantInfo(slug),
        fetchCategories({ slug, adminView: isAdminMode }),
        fetchDishes({ query: searchQuery, slug, adminView: isAdminMode })
      ]);
      setInfo(infoData);
      setCategories(catData);
      setDishes(dishData);
    } catch (err) {
      console.error('Error loading digital menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenuData();
  }, [searchQuery, adminToken]);

  // Handle URL route changes (/super-admin, /admin, /r/:slug, #super-admin, #admin)
  useEffect(() => {
    const handleRouteCheck = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      const isSuperAdmin = path.startsWith('/super-admin') || path.startsWith('/superadmin') || hash === '#super-admin' || hash === '#superadmin';
      const isRouteAdmin = (path.includes('/admin') || hash === '#admin') && !isSuperAdmin;

      if (isSuperAdmin) {
        if (superToken) {
          setView('super-admin-dashboard');
        } else {
          setView('super-admin-login');
        }
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
      } else {
        setView('menu');
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
    window.history.pushState({}, '', `/r/${currentSlug}/admin`);
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
    window.history.pushState({}, '', `/r/${currentSlug}`);
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
    setView('menu');
    window.history.pushState({}, '', '/');
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

  // Super Admin Portal Views
  if (view === 'super-admin-login') {
    return (
      <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', background: '#0A2315', color: '#DFBA67', minHeight: '100vh', fontWeight: 800 }}>👑 Loading Master Portal...</div>}>
        <SuperAdminLogin
          onLoginSuccess={handleSuperAdminLoginSuccess}
          onCancel={() => {
            setView('menu');
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

  // Customer Digital Menu Render (Clean public view — NO admin controls)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Customer Header */}
      <CustomerHeader
        info={info}
        lang={lang}
        tableNum={tableNum}
        onToggleLang={() => setLang(lang === 'en' ? 'hi' : 'en')}
        onOpenInfoModal={() => setShowInfoModal(true)}
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
      {activeOrderTrack && (
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
                Order #{activeOrderTrack.id} • Table #{activeOrderTrack.table_number || '1'}
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#E5E7EB', fontWeight: 700 }}>
                Status: {
                  activeOrderTrack.status === 'pending' ? 'Pending Kitchen Acceptance 🟡' :
                  activeOrderTrack.status === 'preparing' ? 'Chef is Preparing 👨‍🍳' :
                  activeOrderTrack.status === 'served' ? 'Served to Table 🟢' : 'Cancelled 🔴'
                }
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('raman_active_order_id');
              setActiveOrderId(null);
              setActiveOrderTrack(null);
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
            Clear Banner
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
          groupedDishes.map((group, gIdx) => (
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
                      onAddToCart={handleAddToCart}
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
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>

      {/* 📲 Floating WhatsApp Order Button */}
      {info && info.whatsapp_enabled !== false && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '18px',
          zIndex: 1200
        }}>
          <button
            onClick={() => setShowCartDrawer(true)}
            style={{
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#FFFFFF',
              padding: '12px 18px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 900,
              fontSize: '0.88rem',
              border: '2px solid #FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 28px rgba(37, 211, 102, 0.6)'
            }}
          >
            <MessageSquare size={18} />
            <span>Order on WhatsApp</span>
            {cartItems.length > 0 && (
              <span style={{
                background: '#FFFFFF',
                color: '#128C7E',
                fontSize: '0.78rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: '12px',
                marginLeft: '2px'
              }}>
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      )}

      {/* 📲 WhatsApp Order Cart Drawer */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={20} color="#15803D" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                    WhatsApp Direct Order
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send order directly to restaurant WhatsApp</span>
                </div>
              </div>
              <button onClick={() => setShowCartDrawer(false)} style={{ background: '#F3F4F6', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <MessageSquare size={40} color="#25D366" style={{ marginBottom: '10px', opacity: 0.6 }} />
                <p style={{ fontSize: '0.95rem', margin: '0 0 6px 0', fontWeight: 800, color: 'var(--text-dark)' }}>Your order cart is empty.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>Tap <strong>"+ Order"</strong> on any dish to add items to your WhatsApp order!</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {cartItems.map(({ dish, quantity }) => (
                  <div key={dish.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)', padding: '12px 14px', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-dark)', display: 'block' }}>{dish.name}</strong>
                      <span style={{ fontSize: '0.82rem', color: 'var(--gold-primary)', fontWeight: 800 }}>
                        {info?.currency_symbol || '₹'}{dish.price} x {quantity} = {info?.currency_symbol || '₹'}{dish.price * quantity}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => handleAddToCart(dish)} style={{ background: 'var(--primary-emerald)', color: '#FFF', border: 'none', width: '28px', height: '28px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{quantity}</span>
                      <button onClick={() => handleRemoveFromCart(dish.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', width: '28px', height: '28px', borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
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
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--gold-border)',
                        fontWeight: 900,
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>NAME (OPTIONAL)</label>
                    <input
                      type="text"
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      placeholder="Your Name"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border-light)',
                        fontSize: '0.86rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* 1-Click Instant Direct Kitchen Order Button */}
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
                  <span>{placingOrder ? 'Sending to Kitchen...' : `⚡ PLACE DIRECT KITCHEN ORDER (${info?.currency_symbol || '₹'}${cartItems.reduce((sum, i) => sum + i.dish.price * i.quantity, 0)})`}</span>
                </button>

                {/* WhatsApp Alternative Order Button */}
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
                Order #{orderSuccessModal.order_id} • Table #{orderSuccessModal.table_number}
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
