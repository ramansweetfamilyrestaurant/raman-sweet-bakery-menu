import React, { useState, useEffect, useMemo } from 'react';
import CustomerHeader from './components/CustomerHeader';
import MenuCardItem from './components/MenuCardItem';
import SearchBar from './components/SearchBar';
import DishCard from './components/DishCard';
import DishModal from './components/DishModal';
import RestaurantInfoModal from './components/RestaurantInfoModal';
import BottomDock from './components/BottomDock';
import Footer from './components/Footer';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import { fetchRestaurantInfo, fetchCategories, fetchDishes } from './api/client';
import { LayoutList, Grid, BookOpen, X, Sparkles, Utensils } from 'lucide-react';

export default function App() {
  // Parse Table Number from URL query parameter ?table=5
  const urlParams = new URLSearchParams(window.location.search);
  const tableNum = urlParams.get('table') || '';

  // Language State ('en' or 'hi')
  const [lang, setLang] = useState('en');

  // Navigation State
  const [view, setView] = useState('menu'); // 'menu', 'admin-login', 'admin-dashboard'
  const [layoutMode, setLayoutMode] = useState('list'); // 'list' or 'grid'
  
  const getInitialToken = () => {
    const t = localStorage.getItem('raman_admin_token');
    return (t && t !== 'undefined' && t !== 'null') ? t : '';
  };
  const getInitialUser = () => {
    const u = localStorage.getItem('raman_admin_user');
    return (u && u !== 'undefined' && u !== 'null') ? u : '';
  };

  const [adminToken, setAdminToken] = useState(getInitialToken());
  const [adminUsername, setAdminUsername] = useState(getInitialUser());

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
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false); // Zomato Floating Menu Drawer
  const [loading, setLoading] = useState(true);

  // Load Menu Data
  const loadMenuData = async () => {
    try {
      const [infoData, catData, dishData] = await Promise.all([
        fetchRestaurantInfo(),
        fetchCategories(),
        fetchDishes({ query: searchQuery, category_id: selectedCategory })
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
  }, [searchQuery, selectedCategory]);

  // Handle URL route changes (#admin or /admin)
  useEffect(() => {
    const handleRouteCheck = () => {
      const isRouteAdmin = window.location.hash === '#admin' || window.location.pathname.endsWith('/admin') || window.location.pathname.includes('/admin');
      if (isRouteAdmin) {
        if (adminToken) {
          setView('admin-dashboard');
        } else {
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
  }, [adminToken]);

  const handleAdminLoginSuccess = (token, username) => {
    localStorage.setItem('raman_admin_token', token);
    localStorage.setItem('raman_admin_user', username);
    setAdminToken(token);
    setAdminUsername(username);
    setView('admin-dashboard');
    window.location.hash = '#admin';
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('raman_admin_token');
    localStorage.removeItem('raman_admin_user');
    setAdminToken('');
    setAdminUsername('');
    setView('menu');
    window.location.hash = '';
    loadMenuData();
  };

  // Group dishes by category
  const groupedDishes = useMemo(() => {
    if (selectedCategory !== 'all') {
      const targetCat = categories.find(c => String(c.id) === String(selectedCategory));
      return [{
        category: targetCat || { name: 'Filtered Items' },
        items: dishes
      }];
    }

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

    return Object.values(map).filter(group => group.items.length > 0);
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

  // Admin View Render
  if (view === 'admin-login') {
    return (
      <AdminLogin
        onLoginSuccess={handleAdminLoginSuccess}
        onCancel={() => {
          setView('menu');
          window.location.hash = '';
        }}
      />
    );
  }

  if (view === 'admin-dashboard') {
    return (
      <AdminDashboard
        token={adminToken}
        username={adminUsername}
        onLogout={handleAdminLogout}
        onReturnToMenu={() => {
          setView('menu');
          window.location.hash = '';
          loadMenuData();
        }}
      />
    );
  }

  // Customer Digital Menu Render
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header with Dual Language Switcher & Table Indicator */}
      <CustomerHeader
        info={info}
        lang={lang}
        tableNum={tableNum}
        onToggleLang={() => setLang(lang === 'en' ? 'hi' : 'en')}
        onOpenInfoModal={() => setShowInfoModal(true)}
        onOpenAdmin={() => {
          if (adminToken) {
            setView('admin-dashboard');
            window.location.hash = '#admin';
          } else {
            setView('admin-login');
            window.location.hash = '#admin';
          }
        }}
      />

      {/* Live Search Bar & Quick Micro-Filter Pills */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
        onQuickFilter={(filterVal) => setSearchQuery(filterVal)}
        filtersVisibility={info?.filters_visibility}
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
            fontSize: '0.76rem',
            color: 'var(--primary-emerald)',
            background: 'var(--gold-soft)',
            border: '1px solid var(--gold-border)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 700
          }}>
            {dishes.length} {lang === 'hi' ? 'आइटम' : 'Items'}
          </span>
        </div>

        {/* View Switcher: Classic List vs Photo Grid */}
        <div style={{
          display: 'flex',
          gap: '3px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-pill)',
          padding: '2px'
        }}>
          <button
            onClick={() => setLayoutMode('list')}
            title="Menu List View"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: layoutMode === 'list' ? 'var(--primary-emerald)' : 'transparent',
              color: layoutMode === 'list' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'var(--transition-fast)'
            }}
          >
            <LayoutList size={13} /> {lang === 'hi' ? 'सूची' : 'List'}
          </button>

          <button
            onClick={() => setLayoutMode('grid')}
            title="Photo Grid View"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: layoutMode === 'grid' ? 'var(--primary-emerald)' : 'transparent',
              color: layoutMode === 'grid' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'var(--transition-fast)'
            }}
          >
            <Grid size={13} /> {lang === 'hi' ? 'फोटो ग्रिड' : 'Grid'}
          </button>
        </div>
      </div>

      {/* Main Dishes Area */}
      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '10px 10px 120px',
        width: '100%',
        flexGrow: 1
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--bg-secondary)',
              borderTopColor: 'var(--primary-emerald)',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }} />
            Loading menu items...
          </div>
        ) : groupedDishes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '50px 20px',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-emerald)', marginBottom: '6px' }}>
              No dishes found
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              No menu items match "{searchQuery}".
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              style={{
                background: 'var(--primary-emerald)',
                color: '#FFFFFF',
                padding: '8px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              Reset Search
            </button>
          </div>
        ) : (
          groupedDishes.map((group, gIdx) => {
            const catDisplayName = (lang === 'hi' && group.category.name_hi) ? group.category.name_hi : group.category.name;

            return (
              <section key={gIdx} id={`cat-sec-${group.category.id}`} style={{ marginBottom: '28px', scrollMarginTop: '110px' }}>
                {/* Category Header Banner */}
                <div style={{
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  marginBottom: '10px',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {group.category.image && (
                      <img 
                        src={group.category.image} 
                        alt={catDisplayName} 
                        style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    )}
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {catDisplayName}
                    </h2>
                  </div>

                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#4ADE80',
                    background: 'rgba(34, 197, 94, 0.18)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)'
                  }}>
                    {group.items.length} {lang === 'hi' ? 'आइटम' : 'Items'}
                  </span>
                </div>

                {/* Items List / Grid */}
                {layoutMode === 'list' ? (
                  <div className="dish-list-grid">
                    {group.items.map((dish) => (
                      <MenuCardItem
                        key={dish.id}
                        dish={dish}
                        lang={lang}
                        onClick={(d) => setSelectedDishModal(d)}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '14px'
                  }}>
                    {group.items.map((dish) => (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        onClick={(d) => setSelectedDishModal(d)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>

      {/* Zomato-Style Floating Menu Button & Navigation Dock */}
      <BottomDock
        categoriesCount={categories.length}
        lang={lang}
        onOpenCategories={() => setShowCategoryDrawer(true)}
        onOpenInfo={() => setShowInfoModal(true)}
        onOpenAdmin={() => {
          if (adminToken) {
            setView('admin-dashboard');
            window.location.hash = '#admin';
          } else {
            setView('admin-login');
            window.location.hash = '#admin';
          }
        }}
      />

      {/* Zomato-Style Floating Menu Bottom Sheet Drawer Modal */}
      {showCategoryDrawer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3000,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }} onClick={() => setShowCategoryDrawer(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px 20px',
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
              <button onClick={() => setShowCategoryDrawer(false)} style={{ color: 'var(--text-dark)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Zomato Category List Buttons */}
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
                  justifyContent: 'space-between'
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
                      justifyContent: 'space-between'
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

      {/* Footer */}
      <Footer
        info={info}
        onOpenAdmin={() => {
          if (adminToken) {
            setView('admin-dashboard');
            window.location.hash = '#admin';
          } else {
            setView('admin-login');
            window.location.hash = '#admin';
          }
        }}
      />

      {/* Dish Zoom Detail Modal */}
      {selectedDishModal && (
        <DishModal
          dish={selectedDishModal}
          onClose={() => setSelectedDishModal(null)}
        />
      )}

      {/* Restaurant Hours & Location Modal */}
      {showInfoModal && (
        <RestaurantInfoModal
          info={info}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </div>
  );
}
