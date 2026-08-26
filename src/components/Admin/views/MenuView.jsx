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
  Store
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
  const [activeActionMenuDishId, setActiveActionMenuDishId] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'special', 'off'

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return safeDishes.filter(d => {
      const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
      let matchesBadge = true;
      if (badgeFilter === 'veg') matchesBadge = d.type === 'veg';
      if (badgeFilter === 'nonveg') matchesBadge = d.type === 'nonveg';
      if (badgeFilter === 'must_try') matchesBadge = Boolean(d.must_try);
      if (badgeFilter === 'special') matchesBadge = Boolean(d.is_special);
      if (badgeFilter === 'off') matchesBadge = d.is_available === false;

      return matchesSearch && matchesCat && matchesBadge;
    });
  }, [safeDishes, search, selectedCatFilter, badgeFilter]);

  // Featured / Must Try Dishes for Top Section (max 3 items)
  const featuredDishes = useMemo(() => {
    if (search || selectedCatFilter !== 'all' || badgeFilter !== 'all') return [];
    return safeDishes.filter(d => d.must_try || d.is_special).slice(0, 3);
  }, [safeDishes, search, selectedCatFilter, badgeFilter]);

  const handleQuickPriceSubmit = (e) => {
    e.preventDefault();
    if (quickPriceDish) {
      onUpdateQuickPrice(quickPriceDish.id, quickPriceVal.price, quickPriceVal.price_half);
      setQuickPriceDish(null);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '80px'
    }}>
      <style>{`
        .menu-featured-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .menu-table-view {
          display: block;
        }
        .menu-mobile-list-view {
          display: none;
        }
        @media (max-width: 1024px) {
          .menu-featured-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 768px) {
          .menu-featured-grid {
            grid-template-columns: 1fr !important;
          }
          .menu-table-view {
            display: none !important;
          }
          .menu-mobile-list-view {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>

      {/* ========================================================
          1. MASTER HEADER & COMPACT CATALOG SUMMARY
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Menu
          </h2>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Manage your digital catalog.
          </p>

          {/* Compact Quota Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            <div style={{
              background: '#F8FAFC',
              border: `1px solid ${dishQuota.isAtLimit ? '#FECACA' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: '#64748B' }}>Dishes:</span>
              <strong style={{ color: dishQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{dishQuota.display}</strong>
            </div>

            <div style={{
              background: '#F8FAFC',
              border: `1px solid ${catQuota.isAtLimit ? '#FECACA' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: '#64748B' }}>Categories:</span>
              <strong style={{ color: catQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{catQuota.display}</strong>
            </div>

            <div style={{
              background: '#F8FAFC',
              border: `1px solid ${comboQuota.isAtLimit ? '#FECACA' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: '#64748B' }}>Combos:</span>
              <strong style={{ color: comboQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{comboQuota.display}</strong>
            </div>
          </div>
        </div>

        {/* Primary Header CTAs */}
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
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Preview Customer Menu"
            >
              <Store size={15} color="#475569" />
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
                background: dishQuota.isAtLimit ? '#94A3B8' : '#0D3823',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: dishQuota.isAtLimit ? 'none' : '0 2px 8px rgba(13, 56, 35, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={16} />
              <span>Add Dish</span>
            </button>
          )}

          {activeSubTab === 'categories' && (
            <button
              onClick={onOpenAddCategory}
              disabled={catQuota.isAtLimit}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: catQuota.isAtLimit ? '#94A3B8' : '#0D3823',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: catQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} />
              <span>Add Category</span>
            </button>
          )}

          {activeSubTab === 'combos' && (
            <button
              onClick={onOpenAddCombo}
              disabled={comboQuota.isAtLimit}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: comboQuota.isAtLimit ? '#94A3B8' : '#0D3823',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: comboQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} />
              <span>Add Combo</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. PRIMARY SEGMENTED NAVIGATION
         ======================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '6px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'dishes' ? '#0D3823' : 'transparent',
            color: activeSubTab === 'dishes' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Utensils size={15} />
          <span>Items ({safeDishes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('categories')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'categories' ? '#0D3823' : 'transparent',
            color: activeSubTab === 'categories' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
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
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'combos' ? '#0D3823' : 'transparent',
            color: activeSubTab === 'combos' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Package size={15} />
          <span>Combos ({safeCombos.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('modifiers')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'modifiers' ? '#0D3823' : 'transparent',
            color: activeSubTab === 'modifiers' ? '#FFFFFF' : '#64748B',
            fontSize: '0.80rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Sliders size={15} />
          <span>Modifiers</span>
          {!modifiersEnabled && <Lock size={12} color="#D4AF37" />}
        </button>
      </div>

      {/* ========================================================
          3. ITEMS WORKSPACE: SEARCH + FILTERS + 2-LEVEL CATALOG
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* SEARCH & FILTERS TOOLBAR */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes..."
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  fontSize: '0.80rem',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="all">All Categories ({safeCategories.length})</option>
              {safeCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'veg', label: '🟢 Veg' },
                { id: 'nonveg', label: '🔴 Non-Veg' },
                { id: 'must_try', label: '⭐ Must Try' },
                { id: 'special', label: '✨ Special' },
                { id: 'off', label: '⚠️ Unavailable' }
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => setBadgeFilter(chip.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: badgeFilter === chip.id ? '1px solid #0D3823' : '1px solid #E2E8F0',
                    background: badgeFilter === chip.id ? '#0D3823' : '#F8FAFC',
                    color: badgeFilter === chip.id ? '#FFFFFF' : '#475569',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* LEVEL A: FEATURED / MUST TRY ITEMS (Only shown when not actively filtering) */}
          {featuredDishes.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Star size={16} color="#D4AF37" fill="#D4AF37" />
                <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Featured / Popular Items
                </h3>
              </div>

              <div className="menu-featured-grid">
                {featuredDishes.map(dish => {
                  const isAvailable = dish.is_available !== false;
                  const isVeg = dish.type === 'veg';
                  const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                  return (
                    <div
                      key={dish.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      {/* Image Thumbnail with Overlay Badges */}
                      <div style={{ height: '140px', width: '100%', position: 'relative', background: '#F8FAFC' }}>
                        <img
                          src={getDishImageUrl(dish.image || dish.image_url)}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                        />
                        <span style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          backdropFilter: 'blur(4px)'
                        }}>
                          {dish.must_try ? '⭐ Must Try' : '✨ Chef Special'}
                        </span>
                      </div>

                      {/* Content */}
                      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : '#DC2626' }} />
                            <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {dish.name}
                            </h4>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{catObj?.name || 'Category'}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                            {currencySymbol}{dish.price}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: isAvailable ? '#16A34A' : '#DC2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isAvailable ? '#16A34A' : '#DC2626' }} />
                              {isAvailable ? 'Available' : 'Off'}
                            </span>

                            <button
                              onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                background: '#F8FAFC',
                                color: '#0F172A',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL B: ALL ITEMS (HIGH-DENSITY LIST / HYBRID ROW BROWSER) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                All Catalog Dishes ({filteredDishes.length})
              </h3>
            </div>

            {filteredDishes.length === 0 ? (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid #E2E8F0',
                padding: '48px 24px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <Utensils size={24} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                  {search ? 'No dishes match your search.' : selectedCatFilter !== 'all' ? 'No dishes in this category.' : 'Your menu is empty.'}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 20px 0' }}>
                  {search || selectedCatFilter !== 'all' || badgeFilter !== 'all'
                    ? 'Try clearing the active filters or search keyword.'
                    : 'Add your first dish to start building your digital menu.'}
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
                      padding: '9px 18px',
                      borderRadius: '10px',
                      background: '#0D3823',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    + Add Dish
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* DESKTOP HIGH-DENSITY TABLE */}
                <div className="menu-table-view" style={{
                  background: '#FFFFFF',
                  borderRadius: '18px',
                  border: '1px solid #E2E8F0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <th style={{ padding: '12px 18px', width: '56px' }}>IMAGE</th>
                        <th style={{ padding: '12px 18px' }}>ITEM NAME</th>
                        <th style={{ padding: '12px 18px' }}>CATEGORY</th>
                        <th style={{ padding: '12px 18px' }}>PRICE</th>
                        <th style={{ padding: '12px 18px' }}>STATUS</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDishes.map(dish => {
                        const isAvailable = dish.is_available !== false;
                        const isVeg = dish.type === 'veg';
                        const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                        return (
                          <tr 
                            key={dish.id}
                            style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            {/* Thumbnail */}
                            <td style={{ padding: '10px 18px' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                                <img
                                  src={getDishImageUrl(dish.image || dish.image_url)}
                                  alt={dish.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                                />
                              </div>
                            </td>

                            {/* Item Name + Tags */}
                            <td style={{ padding: '10px 18px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : '#DC2626', flexShrink: 0 }} />
                                <strong style={{ color: '#0F172A', fontSize: '0.84rem' }}>{dish.name}</strong>
                                {dish.must_try && (
                                  <span style={{ fontSize: '0.62rem', background: '#FEF3C7', color: '#D97706', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                                    Must Try
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Category */}
                            <td style={{ padding: '10px 18px', color: '#64748B', fontSize: '0.78rem' }}>
                              {catObj?.name || 'Uncategorized'}
                            </td>

                            {/* Price */}
                            <td style={{ padding: '10px 18px', fontWeight: 800, color: '#0F172A' }}>
                              <div>{currencySymbol}{dish.price || 0}</div>
                              {dish.price_half && (
                                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>
                                  Half: {currencySymbol}{dish.price_half}
                                </span>
                              )}
                            </td>

                            {/* Availability Toggle */}
                            <td style={{ padding: '10px 18px' }}>
                              <button
                                onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                                style={{
                                  background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                                  color: isAvailable ? '#16A34A' : '#DC2626',
                                  border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                                  borderRadius: '8px',
                                  padding: '4px 10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isAvailable ? '#16A34A' : '#DC2626' }} />
                                <span>{isAvailable ? 'Available' : 'Unavailable'}</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', position: 'relative' }}>
                                <button
                                  onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #E2E8F0',
                                    background: '#FFFFFF',
                                    color: '#0F172A',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Edit size={13} />
                                  <span>Edit</span>
                                </button>

                                <button
                                  onClick={() => setDeleteConfirmDish(dish)}
                                  style={{
                                    padding: '6px 8px',
                                    borderRadius: '8px',
                                    border: '1px solid #FEE2E2',
                                    background: '#FFF5F5',
                                    color: '#DC2626',
                                    cursor: 'pointer'
                                  }}
                                  title="Delete Dish"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE COMPACT LIST ROWS */}
                <div className="menu-mobile-list-view">
                  {filteredDishes.map(dish => {
                    const isAvailable = dish.is_available !== false;
                    const isVeg = dish.type === 'veg';
                    const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                    return (
                      <div
                        key={dish.id}
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '14px',
                          border: '1px solid #E2E8F0',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Thumbnail + Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0 }}>
                            <img
                              src={getDishImageUrl(dish.image || dish.image_url)}
                              alt={dish.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                            />
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : '#DC2626', flexShrink: 0 }} />
                              <strong style={{ fontSize: '0.82rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {dish.name}
                              </strong>
                            </div>

                            <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                              {catObj?.name || 'Category'}
                            </span>

                            <span style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0F172A', display: 'block', marginTop: '2px' }}>
                              {currencySymbol}{dish.price || 0}
                            </span>
                          </div>
                        </div>

                        {/* Fast Availability Toggle + Edit */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                            style={{
                              background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                              color: isAvailable ? '#16A34A' : '#DC2626',
                              border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '0.70rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {isAvailable ? '● Available' : '● Off'}
                          </button>

                          <button
                            onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              background: '#F8FAFC',
                              color: '#0F172A',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          4. CATEGORIES WORKSPACE (HIGH-DENSITY ROWS)
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {safeCategories.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '48px 24px', textAlign: 'center' }}>
              <Layers size={32} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>No categories yet</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 16px 0' }}>Create categories to organize your menu catalog.</p>
              <button onClick={onOpenAddCategory} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0D3823', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Category
              </button>
            </div>
          ) : (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 20px' }}>CATEGORY NAME</th>
                    <th style={{ padding: '12px 20px' }}>DISH COUNT</th>
                    <th style={{ padding: '12px 20px' }}>STATUS</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {safeCategories.map(cat => {
                    const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
                    return (
                      <tr 
                        key={cat.id}
                        style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0F172A' }}>
                          {cat.name}
                        </td>
                        <td style={{ padding: '14px 20px', color: '#64748B', fontSize: '0.78rem' }}>
                          {count} dish{count !== 1 ? 'es' : ''}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                            ● Active
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => onOpenEditCategory && onOpenEditCategory(cat)}
                              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirmCategory(cat)}
                              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}
                              title="Delete Category"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          5. COMBOS WORKSPACE (COMPACT ROWS)
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {safeCombos.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '48px 24px', textAlign: 'center' }}>
              <Package size={32} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>No meal combos yet</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 16px 0' }}>Create special bundle meal combos to increase average order values.</p>
              <button onClick={onOpenAddCombo} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0D3823', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Combo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {safeCombos.map(combo => (
                <div key={combo.id} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{combo.name}</h4>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '6px' }}>Active</span>
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', display: 'block', marginTop: '6px' }}>
                      {currencySymbol}{combo.price}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                    <button onClick={() => onOpenEditCombo && onOpenEditCombo(combo)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirmCombo(combo)} style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          6. MODIFIERS WORKSPACE (PLAN-GATED)
         ======================================================== */}
      {activeSubTab === 'modifiers' && (
        <div>
          {!modifiersEnabled ? (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <PlanLockedCard
                featureKey="modifiers_enabled"
                featureName="Dish Modifiers & Add-Ons"
                featureDescription="Allow guests to customize items with extra toppings, spice levels, variants, and addons."
                requiredPlanName="Pro Plan or Higher"
                onUpgradeClick={onUpgrade}
              />
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '36px 24px', textAlign: 'center' }}>
              <Sliders size={32} color="#16A34A" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>Modifiers Library Active</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>Configure modifiers and add-on sets directly inside individual dish forms.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          7. DELETE CONFIRMATION MODALS
         ======================================================== */}
      {deleteConfirmDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Dish</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete <strong>'{deleteConfirmDish.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmDish(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteDish(deleteConfirmDish.id); setDeleteConfirmDish(null); }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Category</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete category <strong>'{deleteConfirmCategory.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmCategory(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteCategory(deleteConfirmCategory.id); setDeleteConfirmCategory(null); }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
