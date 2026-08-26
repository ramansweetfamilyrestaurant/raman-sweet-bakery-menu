import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Star, 
  Sparkles, 
  DollarSign, 
  Filter, 
  X, 
  Utensils, 
  Layers, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ExternalLink, 
  ChevronDown, 
  Copy, 
  Store, 
  Check, 
  Tag,
  FolderPlus,
  Grid,
  List,
  ArrowUpDown,
  Flame,
  LayoutGrid
} from 'lucide-react';
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
  onUpgrade = null,
  onReturnToMenu = null,
  restaurantInfo = {}
}) {
  const [deleteConfirmDish, setDeleteConfirmDish] = useState(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [deleteConfirmCombo, setDeleteConfirmCombo] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [dietFilter, setDietFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'special', 'off'
  const [sortBy, setSortBy] = useState('default'); // 'default', 'price_asc', 'price_desc', 'name_asc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [activeMenuDishId, setActiveMenuDishId] = useState(null);

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  // Filtered & Sorted dishes
  const filteredDishes = useMemo(() => {
    let list = safeDishes.filter(d => {
      const q = (search || '').toLowerCase().trim();
      const matchesSearch = !q || (d.name || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
      const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
      
      let matchesDiet = true;
      if (dietFilter === 'veg') matchesDiet = d.type === 'veg';
      if (dietFilter === 'nonveg') matchesDiet = d.type === 'nonveg';
      if (dietFilter === 'must_try') matchesDiet = Boolean(d.must_try);
      if (dietFilter === 'special') matchesDiet = Boolean(d.is_special);
      if (dietFilter === 'off') matchesDiet = d.is_available === false;

      return matchesSearch && matchesCat && matchesDiet;
    });

    if (sortBy === 'price_asc') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [safeDishes, search, selectedCatFilter, dietFilter, sortBy]);

  const activeCategoryObj = safeCategories.find(c => String(c.id) === String(selectedCatFilter));

  const handleQuickPriceSubmit = (e) => {
    e.preventDefault();
    if (quickPriceDish && onUpdateQuickPrice) {
      onUpdateQuickPrice(quickPriceDish.id, quickPriceVal.price, quickPriceVal.price_half);
      setQuickPriceDish(null);
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .menu-workspace-grid {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .dish-catalog-2col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .dish-catalog-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .desktop-category-panel {
          display: block;
        }

        .mobile-category-strip {
          display: none;
        }

        @media (max-width: 900px) {
          .menu-workspace-grid {
            grid-template-columns: 1fr !important;
          }
          .desktop-category-panel {
            display: none !important;
          }
          .mobile-category-strip {
            display: flex !important;
          }
          .dish-catalog-2col {
            grid-template-columns: 1fr !important;
          }
        }

        .category-sidebar-item {
          transition: all 0.15s ease;
        }
        .category-sidebar-item:hover {
          background: #F8FAFC;
        }

        .catalog-card-item {
          transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .catalog-card-item:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.04) !important;
          border-color: #CBD5E1 !important;
        }
      `}</style>

      {/* ========================================================
          1. MASTER HEADER & COMPACT CATALOG SUMMARY
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Menu & Catalog Workspace
            </h2>
            <span style={{
              background: '#DCFCE7',
              color: '#16A34A',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              Live Catalog
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Manage and organize your digital dishes, categories, and combos.
          </p>

          {/* Compact Catalog Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', fontSize: '0.74rem' }}>
            <span style={{ color: '#0F172A', fontWeight: 700 }}><strong>{safeDishes.length}</strong> Dishes</span>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span style={{ color: '#0F172A', fontWeight: 700 }}><strong>{safeCategories.length}</strong> Categories</span>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span style={{ color: '#0F172A', fontWeight: 700 }}><strong>{safeCombos.length}</strong> Combos</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {restaurantInfo?.slug && (
            <button
              onClick={() => {
                if (onReturnToMenu) onReturnToMenu(restaurantInfo.slug);
                else window.open(`/r/${restaurantInfo.slug}`, '_blank');
              }}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Store size={15} color="#16A34A" />
              <span>Public Menu</span>
            </button>
          )}

          {activeSubTab === 'dishes' && (
            <button
              onClick={onOpenAddDish}
              disabled={dishQuota.isAtLimit}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: dishQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)'
              }}
            >
              <Plus size={16} color="#D4AF37" strokeWidth={3} />
              <span>+ Add Dish</span>
            </button>
          )}

          {activeSubTab === 'categories' && (
            <button
              onClick={onOpenAddCategory}
              disabled={catQuota.isAtLimit}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: catQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: catQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)'
              }}
            >
              <FolderPlus size={16} color="#D4AF37" />
              <span>+ Add Category</span>
            </button>
          )}

          {activeSubTab === 'combos' && (
            <button
              onClick={onOpenAddCombo}
              disabled={comboQuota.isAtLimit}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: comboQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: comboQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)'
              }}
            >
              <Package size={16} color="#D4AF37" />
              <span>+ Add Combo</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. SEGMENTED PRODUCT TABS (DISHES • CATEGORIES • COMBOS)
         ======================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '5px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'dishes' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'dishes' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Utensils size={15} />
          <span>Dishes ({safeDishes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('categories')}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'categories' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'categories' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={15} />
          <span>Categories ({safeCategories.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('combos')}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'combos' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'combos' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Package size={15} />
          <span>Combos ({safeCombos.length})</span>
        </button>
      </div>

      {/* ========================================================
          3. DISHES TAB: SEARCH & FILTER TOOLBAR + TWO-COLUMN WORKSPACE
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <>
          {/* SEARCH & FILTERS TOOLBAR */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={16} color="#16A34A" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes, ingredients..."
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  fontSize: '0.82rem',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#E2E8F0',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    color: '#64748B',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Diet Filter Chips */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: '5px', overflowX: 'auto', flexWrap: 'nowrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'veg', label: '🟢 Veg' },
                { id: 'nonveg', label: '🔴 Non-Veg' },
                { id: 'must_try', label: '⭐ Best Sellers' },
                { id: 'special', label: '✨ Special' },
                { id: 'off', label: '⚠️ Sold Out' }
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => setDietFilter(chip.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: dietFilter === chip.id ? '1px solid #0A2315' : '1px solid #E2E8F0',
                    background: dietFilter === chip.id ? '#0A2315' : '#FFFFFF',
                    color: dietFilter === chip.id ? '#FFFFFF' : '#475569',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Sort & Grid/List View Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <option value="default">Sort: Default</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>

              {/* View Toggle */}
              <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '2px' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    padding: '4px 6px',
                    border: 'none',
                    borderRadius: '6px',
                    background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                    color: viewMode === 'grid' ? '#0A2315' : '#94A3B8',
                    boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer'
                  }}
                  title="2-Column Card Grid"
                >
                  <Grid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '4px 6px',
                    border: 'none',
                    borderRadius: '6px',
                    background: viewMode === 'list' ? '#FFFFFF' : 'transparent',
                    color: viewMode === 'list' ? '#0A2315' : '#94A3B8',
                    boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer'
                  }}
                  title="List Rows"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE ONLY: HORIZONTAL CATEGORY SCROLL CHIPS */}
          <div className="mobile-category-strip no-scrollbar" style={{
            gap: '6px',
            overflowX: 'auto',
            padding: '2px 0',
            WebkitOverflowScrolling: 'touch'
          }}>
            <button
              onClick={() => setSelectedCatFilter('all')}
              style={{
                padding: '7px 12px',
                borderRadius: '10px',
                border: selectedCatFilter === 'all' ? '1px solid #16A34A' : '1px solid #E2E8F0',
                background: selectedCatFilter === 'all' ? '#DCFCE7' : '#FFFFFF',
                color: selectedCatFilter === 'all' ? '#16A34A' : '#334155',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              All Dishes ({safeDishes.length})
            </button>

            {safeCategories.map(cat => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              const isSelected = String(selectedCatFilter) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat.id)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid #16A34A' : '1px solid #E2E8F0',
                    background: isSelected ? '#DCFCE7' : '#FFFFFF',
                    color: isSelected ? '#16A34A' : '#334155',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* ========================================================
              HYBRID TWO-COLUMN WORKSPACE (DESKTOP HYBRID)
             ======================================================== */}
          <div className="menu-workspace-grid">
            
            {/* LEFT COLUMN: STICKY CATEGORIES SIDEBAR (DESKTOP) */}
            <aside className="desktop-category-panel" style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              position: 'sticky',
              top: '80px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} color="#0A2315" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                    Categories
                  </span>
                </div>
                <button
                  onClick={onOpenAddCategory}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#F0FDF4',
                    border: '1px solid #DCFCE7',
                    color: '#16A34A',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  + Add
                </button>
              </div>

              {/* Category List Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                {/* All Dishes item */}
                <div
                  onClick={() => setSelectedCatFilter('all')}
                  className="category-sidebar-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: selectedCatFilter === 'all' ? '#0A2315' : 'transparent',
                    color: selectedCatFilter === 'all' ? '#FFFFFF' : '#0F172A',
                    fontWeight: selectedCatFilter === 'all' ? 800 : 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🍽️</span>
                    <span>All Dishes</span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    background: selectedCatFilter === 'all' ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                    color: selectedCatFilter === 'all' ? '#FFFFFF' : '#64748B'
                  }}>
                    {safeDishes.length}
                  </span>
                </div>

                {/* Dynamic Category items */}
                {safeCategories.map(cat => {
                  const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
                  const isSelected = String(selectedCatFilter) === String(cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat.id)}
                      className="category-sidebar-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: isSelected ? '#0A2315' : 'transparent',
                        color: isSelected ? '#FFFFFF' : '#0F172A',
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span>📁</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : '#64748B',
                        flexShrink: 0
                      }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* RIGHT COLUMN: DISH CATALOG WORKSPACE */}
            <main style={{ minWidth: 0 }}>
              {/* Category Subheader */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                  {activeCategoryObj ? `📁 ${activeCategoryObj.name}` : 'All Dishes'} ({filteredDishes.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Click edit or price to update item live
                </span>
              </div>

              {/* Dishes Container */}
              {filteredDishes.length === 0 ? (
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '18px',
                  border: '1px solid #E2E8F0',
                  padding: '44px 20px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <Utensils size={32} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                    {search ? 'No dishes match your search' : 'No dishes in this category'}
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 16px 0' }}>
                    {search ? 'Try clearing search keyword or filters.' : 'Add your first dish to this category.'}
                  </p>
                  <button
                    onClick={search ? () => { setSearch(''); setSelectedCatFilter('all'); setDietFilter('all'); } : onOpenAddDish}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '10px',
                      background: '#0A2315',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {search ? 'Clear Search' : '+ Add Dish'}
                  </button>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'dish-catalog-2col' : 'dish-catalog-list'}>
                  {filteredDishes.map(dish => {
                    const isAvailable = dish.is_available !== false;
                    const isVeg = dish.type === 'veg';
                    const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                    return (
                      <div
                        key={dish.id}
                        className="catalog-card-item"
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '16px',
                          border: '1px solid #E2E8F0',
                          padding: '12px 14px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          boxSizing: 'border-box',
                          opacity: isAvailable ? 1 : 0.72,
                          position: 'relative'
                        }}
                      >
                        {/* 64px Thumbnail with FSSAI Veg Stamp */}
                        <div style={{
                          width: '64px',
                          height: '64px',
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

                          {/* Stamp */}
                          <span style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            width: '13px',
                            height: '13px',
                            background: '#FFFFFF',
                            border: `1.5px solid ${isVeg ? '#16A34A' : '#DC2626'}`,
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                          }}>
                            <span style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: isVeg ? '#16A34A' : '#DC2626'
                            }} />
                          </span>
                        </div>

                        {/* Middle Details: Name, Category, Price */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <h4 style={{
                              fontSize: '0.88rem',
                              fontWeight: 800,
                              color: '#0F172A',
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }} title={dish.name}>
                              {dish.name}
                            </h4>
                            {dish.must_try && (
                              <span style={{ fontSize: '0.58rem', background: '#FEF3C7', color: '#D97706', padding: '1px 4px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>
                                ⭐ Best
                              </span>
                            )}
                          </div>

                          <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {catObj?.name || 'Category'}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                            <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A' }}>
                              {currencySymbol}{dish.price || 0}
                            </strong>
                            {dish.price_half && (
                              <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
                                · Half: {currencySymbol}{dish.price_half}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Availability Toggle + Edit Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          {/* Stock Toggle Switch */}
                          <button
                            onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                              color: isAvailable ? '#16A34A' : '#DC2626',
                              border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                              padding: '3px 7px',
                              borderRadius: '6px',
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isAvailable ? '#16A34A' : '#DC2626' }} />
                            <span>{isAvailable ? 'In Stock' : 'Sold Out'}</span>
                          </button>

                          {/* Quick Controls: Quick Price, Edit, Delete */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => {
                                setQuickPriceDish(dish);
                                setQuickPriceVal({ price: dish.price || '', price_half: dish.price_half || '' });
                              }}
                              style={{
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                background: '#F8FAFC',
                                color: '#0284C7',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                              title="Quick Price"
                            >
                              ₹
                            </button>

                            <button
                              onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                background: '#F8FAFC',
                                color: '#0F172A',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Edit3 size={11} />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => setDeleteConfirmDish(dish)}
                              style={{
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid #FEE2E2',
                                background: '#FFF5F5',
                                color: '#DC2626',
                                cursor: 'pointer'
                              }}
                              title="Delete Dish"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          </div>
        </>
      )}

      {/* ========================================================
          4. CATEGORIES TAB (FULL WORKSPACE)
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Menu Categories
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Organize dishes into structured sections ({safeCategories.length} categories)
              </span>
            </div>

            <button
              onClick={onOpenAddCategory}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)'
              }}
            >
              <FolderPlus size={15} color="#D4AF37" />
              <span>+ Add Category</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {safeCategories.map(cat => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              return (
                <div
                  key={cat.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid rgba(226, 232, 240, 0.85)',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: '#F0FDF4',
                      border: '1px solid #DCFCE7',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Layers size={20} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.name}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{count} dishes</span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ fontSize: '0.66rem', color: '#16A34A', fontWeight: 800, background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>● Active</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => onOpenEditCategory && onOpenEditCategory(cat)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirmCategory(cat)} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          5. COMBOS TAB (FULL WORKSPACE)
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Value Meal Combos
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Multi-dish bundles to boost Average Order Value ({safeCombos.length} combos)
              </span>
            </div>

            <button
              onClick={onOpenAddCombo}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)'
              }}
            >
              <Package size={15} color="#D4AF37" />
              <span>+ Add Combo</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
            {safeCombos.map(combo => (
              <div
                key={combo.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '18px',
                  border: '1px solid rgba(226, 232, 240, 0.85)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.64rem', fontWeight: 800, background: '#FEF3C7', color: '#D97706', padding: '2px 7px', borderRadius: '6px' }}>
                      ✨ VALUE COMBO
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '2px 7px', borderRadius: '6px' }}>
                      ● In Stock
                    </span>
                  </div>
                  <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>{combo.name}</h4>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', display: 'block', marginTop: '6px' }}>
                    {currencySymbol}{combo.price}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                  <button onClick={() => onOpenEditCombo && onOpenEditCombo(combo)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                    Edit Combo
                  </button>
                  <button onClick={() => setDeleteConfirmCombo(combo)} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          6. FLOATING + ADD DISH ACTION BUTTON (MOBILE FAB)
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <button
          onClick={onOpenAddDish}
          disabled={dishQuota.isAtLimit}
          style={{
            position: 'fixed',
            bottom: '76px',
            right: '16px',
            background: dishQuota.isAtLimit ? '#64748B' : 'linear-gradient(135deg, #0A2315 0%, #062B1C 100%)',
            color: '#FFFFFF',
            border: '1.5px solid rgba(212, 175, 55, 0.4)',
            borderRadius: '30px',
            padding: '10px 18px',
            fontSize: '0.82rem',
            fontWeight: 900,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 900,
            cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer'
          }}
        >
          <Plus size={16} color="#D4AF37" strokeWidth={3} />
          <span>Add Dish</span>
        </button>
      )}

      {/* ========================================================
          7. QUICK PRICE MODAL
         ======================================================== */}
      {quickPriceDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <form onSubmit={handleQuickPriceSubmit} style={{ background: '#FFFFFF', borderRadius: '18px', padding: '22px', maxWidth: '340px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
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
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.84rem', boxSizing: 'border-box' }}
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
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.84rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => setQuickPriceDish(null)}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: '#0A2315', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                Save Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          8. DELETE CONFIRMATION MODALS
         ======================================================== */}
      {deleteConfirmDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Dish</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete <strong>'{deleteConfirmDish.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmDish(null)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
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
          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Category</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete category <strong>'{deleteConfirmCategory.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmCategory(null)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteCategory(deleteConfirmCategory.id); setDeleteConfirmCategory(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCombo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Combo</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete combo <strong>'{deleteConfirmCombo.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmCombo(null)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteCombo(deleteConfirmCombo.id); setDeleteConfirmCombo(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
