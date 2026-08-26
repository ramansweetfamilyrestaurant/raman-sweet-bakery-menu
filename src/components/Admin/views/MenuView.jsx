import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Star, 
  Sparkles, 
  DollarSign, 
  Filter, 
  X, 
  Utensils, 
  Layers, 
  Package, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Copy,
  ToggleLeft,
  ToggleRight,
  Eye,
  Store,
  ArrowUpDown,
  CheckSquare,
  Square,
  Check
} from 'lucide-react';
import PlanLockedCard from '../components/PlanLockedCard';
import { resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../../utils/imageHelper';
import { formatQuota } from '../../../utils/planCapabilities';

export default function MenuView({
  dishes = [],
  categories = [],
  combos = [],
  activeSubTab = 'dishes',
  setActiveSubTab,
  search = '',
  setSearch,
  selectedCatFilter = 'all',
  setSelectedCatFilter,
  onToggleAvailability,
  onOpenAddDish,
  onOpenEditDish,
  onDeleteDish,
  onUpdateQuickPrice,
  onToggleCategoryActive,
  onDeleteCategory,
  onOpenAddCategory,
  onOpenEditCategory,
  onOpenAddCombo,
  onOpenEditCombo,
  onDeleteCombo,
  onToggleComboAvailability,
  onToggleBadge,
  currencySymbol = '₹',
  maxDishes = 9999,
  maxCategories = 9999,
  maxCombos = 9999,
  modifiersEnabled = true,
  onUpgrade = null,
  onReturnToMenu = null,
  restaurantInfo = {}
}) {
  const [deleteConfirmDish, setDeleteConfirmDish] = useState(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [deleteConfirmCombo, setDeleteConfirmCombo] = useState(null);
  const [activeMenuDishId, setActiveMenuDishId] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'special', 'available', 'unavailable'
  const [sortBy, setSortBy] = useState('default'); // 'default', 'price_asc', 'price_desc', 'name_asc'
  
  // Bulk selection mode state
  const [selectedDishIds, setSelectedDishIds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  // Decorative hero image from dishes or fallback
  const heroSampleImage = useMemo(() => {
    const dishWithImg = safeDishes.find(d => Boolean(d.image || d.image_url));
    return dishWithImg ? getDishImageUrl(dishWithImg.image || dishWithImg.image_url) : '/images/default-dish.webp';
  }, [safeDishes]);

  // Filtered & Sorted dishes
  const filteredDishes = useMemo(() => {
    let list = safeDishes.filter(d => {
      const q = (search || '').toLowerCase().trim();
      const matchesSearch = !q || (d.name || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
      const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
      
      let matchesBadge = true;
      if (badgeFilter === 'veg') matchesBadge = d.type === 'veg';
      if (badgeFilter === 'nonveg') matchesBadge = d.type === 'nonveg';
      if (badgeFilter === 'must_try') matchesBadge = Boolean(d.must_try);
      if (badgeFilter === 'special') matchesBadge = Boolean(d.is_special);
      if (badgeFilter === 'available') matchesBadge = d.is_available !== false;
      if (badgeFilter === 'unavailable') matchesBadge = d.is_available === false;

      return matchesSearch && matchesCat && matchesBadge;
    });

    if (sortBy === 'price_asc') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [safeDishes, search, selectedCatFilter, badgeFilter, sortBy]);

  // Handle Quick Price Submit
  const handleQuickPriceSubmit = (e) => {
    e.preventDefault();
    if (quickPriceDish && onUpdateQuickPrice) {
      onUpdateQuickPrice(quickPriceDish.id, quickPriceVal.price, quickPriceVal.price_half);
      setQuickPriceDish(null);
    }
  };

  // Toggle selection for bulk actions
  const toggleSelectDish = (id) => {
    setSelectedDishIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk availability update
  const handleBulkAvailability = (makeAvailable) => {
    if (!onToggleAvailability) return;
    selectedDishIds.forEach(id => {
      onToggleAvailability(id, makeAvailable);
    });
    setSelectedDishIds(new Set());
    setBulkMode(false);
  };

  // Bulk delete
  const handleBulkDelete = () => {
    if (!onDeleteDish) return;
    if (window.confirm(`Are you sure you want to delete ${selectedDishIds.size} selected dishes?`)) {
      selectedDishIds.forEach(id => {
        onDeleteDish(id);
      });
      setSelectedDishIds(new Set());
      setBulkMode(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '110px'
    }}>
      <style>{`
        /* Hide scrollbars for clean mobile feel */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .dish-card-wrapper {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .dish-card-wrapper:active {
          transform: scale(0.99);
        }
        @media (min-width: 901px) {
          .floating-add-btn {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. PREMIUM MENU HERO CARD (MOBILE-OPTIMIZED)
         ======================================================== */}
      <div style={{
        background: 'linear-gradient(135deg, #062B1C 0%, #0A2315 100%)',
        borderRadius: '20px',
        padding: '20px',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 6px 20px rgba(6, 43, 28, 0.18)',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        boxSizing: 'border-box'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', position: 'relative', zIndex: 1 }}>
          {/* Left Hero Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#D4AF37', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Catalog Console
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
              Menu Management
            </h2>
            <p style={{ fontSize: '0.74rem', color: '#CBD5E1', margin: '3px 0 0 0' }}>
              Manage your dishes, prices, and catalog
            </p>
          </div>

          {/* Right Visual Image */}
          <div style={{
            width: '62px',
            height: '62px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            flexShrink: 0
          }}>
            <img
              src={heroSampleImage}
              alt="Menu preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
            />
          </div>
        </div>

        {/* Hero Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <button
            onClick={onOpenAddDish}
            disabled={dishQuota.isAtLimit}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: dishQuota.isAtLimit ? '#64748B' : '#EAB308',
              color: '#000000',
              fontSize: '0.82rem',
              fontWeight: 900,
              border: 'none',
              cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(234, 179, 8, 0.3)'
            }}
          >
            <Plus size={16} strokeWidth={3} />
            <span>+ Add Dish</span>
          </button>

          <button
            onClick={onOpenAddCategory}
            disabled={catQuota.isAtLimit}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} />
            <span>Category</span>
          </button>

          {restaurantInfo?.slug && (
            <button
              onClick={() => {
                if (onReturnToMenu) onReturnToMenu(restaurantInfo.slug);
                else window.open(`/r/${restaurantInfo.slug}`, '_blank');
              }}
              style={{
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Preview Customer Menu"
            >
              <Store size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. QUICK CATALOG SUMMARY (3 COMPACT METRIC CHIPS)
         ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '8px'
      }}>
        {/* Dishes */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '10px 12px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', fontWeight: 600 }}>🍽 Dishes</span>
          <strong style={{ fontSize: '1.05rem', color: dishQuota.isAtLimit ? '#DC2626' : '#0F172A', fontWeight: 900, display: 'block', marginTop: '2px' }}>
            {safeDishes.length}
          </strong>
        </div>

        {/* Categories */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '10px 12px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', fontWeight: 600 }}>🗂 Categories</span>
          <strong style={{ fontSize: '1.05rem', color: catQuota.isAtLimit ? '#DC2626' : '#0F172A', fontWeight: 900, display: 'block', marginTop: '2px' }}>
            {safeCategories.length}
          </strong>
        </div>

        {/* Combos */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '10px 12px',
          textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', fontWeight: 600 }}>🥡 Combos</span>
          <strong style={{ fontSize: '1.05rem', color: comboQuota.isAtLimit ? '#DC2626' : '#0F172A', fontWeight: 900, display: 'block', marginTop: '2px' }}>
            {safeCombos.length}
          </strong>
        </div>
      </div>

      {/* ========================================================
          3. PRIMARY SEGMENTED NAVIGATION PILLS
         ======================================================== */}
      <div className="no-scrollbar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '2px 0',
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
          style={{
            padding: '8px 14px',
            borderRadius: '12px',
            border: 'none',
            background: activeSubTab === 'dishes' ? '#0A2315' : '#FFFFFF',
            color: activeSubTab === 'dishes' ? '#FFFFFF' : '#475569',
            boxShadow: activeSubTab === 'dishes' ? '0 2px 6px rgba(10,35,21,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <Utensils size={14} />
          <span>Items ({safeDishes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('categories')}
          style={{
            padding: '8px 14px',
            borderRadius: '12px',
            border: 'none',
            background: activeSubTab === 'categories' ? '#0A2315' : '#FFFFFF',
            color: activeSubTab === 'categories' ? '#FFFFFF' : '#475569',
            boxShadow: activeSubTab === 'categories' ? '0 2px 6px rgba(10,35,21,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <Layers size={14} />
          <span>Categories ({safeCategories.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('combos')}
          style={{
            padding: '8px 14px',
            borderRadius: '12px',
            border: 'none',
            background: activeSubTab === 'combos' ? '#0A2315' : '#FFFFFF',
            color: activeSubTab === 'combos' ? '#FFFFFF' : '#475569',
            boxShadow: activeSubTab === 'combos' ? '0 2px 6px rgba(10,35,21,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <Package size={14} />
          <span>Combos ({safeCombos.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('modifiers')}
          style={{
            padding: '8px 14px',
            borderRadius: '12px',
            border: 'none',
            background: activeSubTab === 'modifiers' ? '#0A2315' : '#FFFFFF',
            color: activeSubTab === 'modifiers' ? '#FFFFFF' : '#475569',
            boxShadow: activeSubTab === 'modifiers' ? '0 2px 6px rgba(10,35,21,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <Sliders size={14} />
          <span>Modifiers</span>
          {!modifiersEnabled && <Lock size={12} color="#D4AF37" />}
        </button>
      </div>

      {/* ========================================================
          4. DISHES TAB: SEARCH + FILTER CHIPS + HORIZONTAL CATEGORIES
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* A. Search Field */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients…"
              style={{
                width: '100%',
                padding: '11px 36px 11px 40px',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '0.84rem',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* B. Horizontally Scrollable Filter Chips */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '2px 0',
            WebkitOverflowScrolling: 'touch'
          }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'veg', label: '🟢 Veg' },
              { id: 'nonveg', label: '🔴 Non-Veg' },
              { id: 'must_try', label: '⭐ Best Seller' },
              { id: 'special', label: '✨ Special' },
              { id: 'available', label: '● Available' },
              { id: 'unavailable', label: '● Unavailable' }
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setBadgeFilter(chip.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: badgeFilter === chip.id ? '1px solid #0A2315' : '1px solid #E2E8F0',
                  background: badgeFilter === chip.id ? '#0A2315' : '#FFFFFF',
                  color: badgeFilter === chip.id ? '#FFFFFF' : '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* C. Horizontally Scrollable Category Pills */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '2px 0',
            WebkitOverflowScrolling: 'touch'
          }}>
            <button
              onClick={() => setSelectedCatFilter('all')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: selectedCatFilter === 'all' ? '1px solid #0A2315' : '1px solid #E2E8F0',
                background: selectedCatFilter === 'all' ? '#0A2315' : '#FFFFFF',
                color: selectedCatFilter === 'all' ? '#FFFFFF' : '#334155',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              All Categories ({safeDishes.length})
            </button>

            {safeCategories.map(cat => {
              const catCount = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              const isSelected = String(selectedCatFilter) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid #0A2315' : '1px solid #E2E8F0',
                    background: isSelected ? '#0A2315' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#334155',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {cat.name} ({catCount})
                </button>
              );
            })}
          </div>

          {/* D. Status Header Row + Bulk Selection Switch */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 2px',
            marginTop: '4px'
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
              Showing <strong>{filteredDishes.length}</strong> dishe{filteredDishes.length !== 1 ? 's' : ''}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedDishIds(new Set());
                }}
                style={{
                  background: bulkMode ? '#DCFCE7' : 'none',
                  border: bulkMode ? '1px solid #86EFAC' : 'none',
                  color: bulkMode ? '#16A34A' : '#64748B',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
              >
                {bulkMode ? '✕ Cancel Select' : 'Select Multiple'}
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#334155',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <option value="default">Sort: Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* E. REDESIGNED COMPACT DISH LIST (HEIGHT ~110px–125px) */}
          {filteredDishes.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '44px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              marginTop: '8px'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#F1F5F9',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto'
              }}>
                <Utensils size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                {search ? 'No dishes match your search' : 'Your menu is ready for its first dish'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 18px 0' }}>
                {search || selectedCatFilter !== 'all' || badgeFilter !== 'all'
                  ? 'Try clearing active filters or search terms.'
                  : 'Add dishes to start accepting guest orders.'}
              </p>
              {(search || selectedCatFilter !== 'all' || badgeFilter !== 'all') ? (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedCatFilter('all');
                    setBadgeFilter('all');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Clear Search & Filters
                </button>
              ) : (
                <button
                  onClick={onOpenAddDish}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '12px',
                    background: '#0A2315',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  + Add First Dish
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDishes.map(dish => {
                const isAvailable = dish.is_available !== false;
                const isVeg = dish.type === 'veg';
                const isSelected = selectedDishIds.has(dish.id);
                const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                return (
                  <div
                    key={dish.id}
                    className="dish-card-wrapper"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: isSelected ? '2px solid #16A34A' : '1px solid #E2E8F0',
                      padding: '12px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxSizing: 'border-box',
                      position: 'relative'
                    }}
                  >
                    {/* Bulk Selection Checkbox */}
                    {bulkMode && (
                      <button
                        onClick={() => toggleSelectDish(dish.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: isSelected ? '#16A34A' : '#94A3B8'
                        }}
                      >
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                    )}

                    {/* Food Image Thumbnail */}
                    <div style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      overflow: 'hidden',
                      flexShrink: 0,
                      position: 'relative'
                    }}>
                      <img
                        src={getDishImageUrl(dish.image || dish.image_url)}
                        alt={dish.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                      />
                      {/* Veg / Non-Veg dot overlay */}
                      <span style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isVeg ? '#16A34A' : '#DC2626',
                        border: '1.5px solid #FFFFFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>

                    {/* Middle Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <h4 style={{
                          fontSize: '0.88rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.name}
                        </h4>
                        
                        {/* Overflow ⋮ Action Menu */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setActiveMenuDishId(activeMenuDishId === dish.id ? null : dish.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#64748B',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* Dropdown Menu */}
                          {activeMenuDishId === dish.id && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '22px',
                              background: '#FFFFFF',
                              borderRadius: '10px',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              border: '1px solid #E2E8F0',
                              zIndex: 100,
                              minWidth: '130px',
                              padding: '4px'
                            }}>
                              <button
                                onClick={() => {
                                  setQuickPriceDish(dish);
                                  setQuickPriceVal({ price: dish.price || '', price_half: dish.price_half || '' });
                                  setActiveMenuDishId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#0F172A',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <DollarSign size={13} />
                                <span>Quick Price</span>
                              </button>

                              <button
                                onClick={() => {
                                  setDeleteConfirmDish(dish);
                                  setActiveMenuDishId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: '#DC2626',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Delete Dish</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Category & Tags */}
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                        {catObj?.name || 'Category'} {dish.must_try ? '• ⭐ Best Seller' : ''}
                      </span>

                      {/* Price & Status Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A' }}>
                            {currencySymbol}{dish.price || 0}
                          </span>
                          {dish.price_half && (
                            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                              (Half: {currencySymbol}{dish.price_half})
                            </span>
                          )}
                        </div>

                        {/* Status Pill */}
                        <span style={{
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          color: isAvailable ? '#16A34A' : '#DC2626',
                          background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                          padding: '2px 7px',
                          borderRadius: '6px'
                        }}>
                          {isAvailable ? '● Available' : '● Off'}
                        </span>
                      </div>

                      {/* Bottom Quick Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                        <button
                          onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                            color: isAvailable ? '#DC2626' : '#16A34A',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isAvailable ? 'Turn Off' : 'Turn On'}
                        </button>

                        <button
                          onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #0A2315',
                            background: '#0A2315',
                            color: '#FFFFFF',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit size={11} />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          5. CATEGORIES TAB CONTENT (CLEAN ROWS)
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {safeCategories.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center' }}>
              <Layers size={30} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>No categories yet</h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 14px 0' }}>Create categories to organize your menu items.</p>
              <button onClick={onOpenAddCategory} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0A2315', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Category
              </button>
            </div>
          ) : (
            safeCategories.map(cat => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              return (
                <div key={cat.id} style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid #E2E8F0',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{cat.name}</h4>
                    <span style={{ fontSize: '0.70rem', color: '#64748B' }}>{count} dish{count !== 1 ? 'es' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onOpenEditCategory && onOpenEditCategory(cat)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirmCategory(cat)} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================
          6. COMBOS TAB CONTENT (COMPACT ROWS)
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {safeCombos.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center' }}>
              <Package size={30} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>No meal combos yet</h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 14px 0' }}>Create special value meal bundles to boost sales.</p>
              <button onClick={onOpenAddCombo} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0A2315', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Combo
              </button>
            </div>
          ) : (
            safeCombos.map(combo => (
              <div key={combo.id} style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{combo.name}</h4>
                  <span style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A' }}>{currencySymbol}{combo.price}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onOpenEditCombo && onOpenEditCombo(combo)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirmCombo(combo)} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================
          7. MODIFIERS TAB (PLAN-GATED)
         ======================================================== */}
      {activeSubTab === 'modifiers' && (
        <div>
          {!modifiersEnabled ? (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <PlanLockedCard
                featureKey="modifiers_enabled"
                featureName="Dish Modifiers & Add-Ons"
                featureDescription="Allow guests to customize items with extra toppings, spice levels, and variants."
                requiredPlanName="Pro Plan or Higher"
                onUpgradeClick={onUpgrade}
              />
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '36px 20px', textAlign: 'center' }}>
              <Sliders size={30} color="#16A34A" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>Modifiers Active</h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0 }}>Configure modifiers directly within dish edit forms.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          8. FLOATING QUICK ACTION BUTTON (+ Add Dish)
         ======================================================== */}
      <button
        className="floating-add-btn"
        onClick={onOpenAddDish}
        style={{
          position: 'fixed',
          bottom: '76px',
          right: '16px',
          background: 'linear-gradient(135deg, #0A2315 0%, #062B1C 100%)',
          color: '#FFFFFF',
          border: '1.5px solid rgba(212, 175, 55, 0.4)',
          borderRadius: '30px',
          padding: '10px 18px',
          fontSize: '0.80rem',
          fontWeight: 900,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 900,
          cursor: 'pointer'
        }}
      >
        <Plus size={16} color="#D4AF37" strokeWidth={3} />
        <span>Add Dish</span>
      </button>

      {/* ========================================================
          9. BULK MANAGEMENT STICKY BOTTOM BAR
         ======================================================== */}
      {bulkMode && selectedDishIds.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '66px',
          left: '12px',
          right: '12px',
          background: '#0F172A',
          color: '#FFFFFF',
          borderRadius: '16px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 950
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>
            {selectedDishIds.size} selected
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => handleBulkAvailability(true)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                background: '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.70rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ● Available
            </button>

            <button
              onClick={() => handleBulkAvailability(false)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.70rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ● Off
            </button>

            <button
              onClick={handleBulkDelete}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                background: '#334155',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Delete Selected"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          10. QUICK PRICE MODAL
         ======================================================== */}
      {quickPriceDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <form onSubmit={handleQuickPriceSubmit} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '20px', maxWidth: '340px', width: '100%' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 12px 0' }}>
              Quick Price: {quickPriceDish.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Full Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  required
                  value={quickPriceVal.price}
                  onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.84rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Half Price ({currencySymbol}) Optional
                </label>
                <input
                  type="number"
                  value={quickPriceVal.price_half}
                  onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price_half: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.84rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setQuickPriceDish(null)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0A2315', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                Save Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          11. DELETE CONFIRMATION MODALS
         ======================================================== */}
      {deleteConfirmDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Dish</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete <strong>'{deleteConfirmDish.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmDish(null)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteDish(deleteConfirmDish.id); setDeleteConfirmDish(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Category</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete category <strong>'{deleteConfirmCategory.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmCategory(null)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteCategory(deleteConfirmCategory.id); setDeleteConfirmCategory(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
