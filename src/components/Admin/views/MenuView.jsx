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
  Store,
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
  const [bottomSheetDish, setBottomSheetDish] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [dietFilter, setDietFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'off'

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return safeDishes.filter(d => {
      const q = (search || '').toLowerCase().trim();
      const matchesSearch = !q || (d.name || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
      const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
      
      let matchesDiet = true;
      if (dietFilter === 'veg') matchesDiet = d.type === 'veg';
      if (dietFilter === 'nonveg') matchesDiet = d.type === 'nonveg';
      if (dietFilter === 'must_try') matchesDiet = Boolean(d.must_try);
      if (dietFilter === 'off') matchesDiet = d.is_available === false;

      return matchesSearch && matchesCat && matchesDiet;
    });
  }, [safeDishes, search, selectedCatFilter, dietFilter]);

  // Group dishes by category if "All" is selected and no active search
  const categorizedSections = useMemo(() => {
    if (selectedCatFilter !== 'all' || search || dietFilter !== 'all') {
      return [{ id: 'all', name: null, items: filteredDishes }];
    }

    const map = new Map();
    safeCategories.forEach(cat => {
      map.set(String(cat.id), { id: cat.id, name: cat.name, items: [] });
    });
    const uncategorized = { id: 'uncategorized', name: 'Other Dishes', items: [] };

    filteredDishes.forEach(dish => {
      const key = String(dish.category_id);
      if (map.has(key)) {
        map.get(key).items.push(dish);
      } else {
        uncategorized.items.push(dish);
      }
    });

    const sections = Array.from(map.values()).filter(sec => sec.items.length > 0);
    if (uncategorized.items.length > 0) sections.push(uncategorized);
    return sections.length > 0 ? sections : [{ id: 'all', name: null, items: [] }];
  }, [filteredDishes, safeCategories, selectedCatFilter, search, dietFilter]);

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
      gap: '12px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '110px'
    }}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .dense-dish-row {
          transition: background 0.15s ease, transform 0.12s ease;
        }
        .dense-dish-row:active {
          background: #F1F5F9 !important;
          transform: scale(0.995);
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .bottom-sheet-anim {
          animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ========================================================
          1. COMPACT TOP HEADER & SUB-TABS
         ======================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 2px',
        gap: '8px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Menu Management
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#DCFCE7',
              color: '#16A34A',
              fontSize: '0.66rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '10px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              Live
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            {restaurantInfo?.name || 'Digital Catalog & Operations'}
          </span>
        </div>

        {/* Storefront Preview Button */}
        {restaurantInfo?.slug && (
          <button
            onClick={() => {
              if (onReturnToMenu) onReturnToMenu(restaurantInfo.slug);
              else window.open(`/r/${restaurantInfo.slug}`, '_blank');
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            <Store size={14} color="#16A34A" />
            <span>Preview</span>
          </button>
        )}
      </div>

      {/* ========================================================
          2. ONE COMPACT SUMMARY ROW
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.76rem',
        color: '#475569',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span><strong>{safeDishes.length}</strong> Dishes</span>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <span><strong>{safeCategories.length}</strong> Categories</span>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <span><strong>{safeCombos.length}</strong> Combos</span>
        </div>

        {/* Section Pill Switcher */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              background: activeSubTab === 'dishes' ? '#0A2315' : '#F1F5F9',
              color: activeSubTab === 'dishes' ? '#FFFFFF' : '#475569',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Items
          </button>
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('categories')}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              background: activeSubTab === 'categories' ? '#0A2315' : '#F1F5F9',
              color: activeSubTab === 'categories' ? '#FFFFFF' : '#475569',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('combos')}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              background: activeSubTab === 'combos' ? '#0A2315' : '#F1F5F9',
              color: activeSubTab === 'combos' ? '#FFFFFF' : '#475569',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Combos
          </button>
        </div>
      </div>

      {/* ========================================================
          3. DISHES TAB: SEARCH + FILTER CHIPS + DENSE LIST
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <>
          {/* A. Full-Width Search */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients..."
              style={{
                width: '100%',
                padding: '10px 34px 10px 36px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '0.82rem',
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
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* B. Horizontally Scrollable Category & Filter Chips Strip */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '2px 0',
            WebkitOverflowScrolling: 'touch'
          }}>
            {/* All Chips */}
            <button
              onClick={() => { setSelectedCatFilter('all'); setDietFilter('all'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: (selectedCatFilter === 'all' && dietFilter === 'all') ? '1px solid #0A2315' : '1px solid #E2E8F0',
                background: (selectedCatFilter === 'all' && dietFilter === 'all') ? '#0A2315' : '#FFFFFF',
                color: (selectedCatFilter === 'all' && dietFilter === 'all') ? '#FFFFFF' : '#334155',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              All ({safeDishes.length})
            </button>

            {/* Diet Filters */}
            <button
              onClick={() => setDietFilter(dietFilter === 'veg' ? 'all' : 'veg')}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: dietFilter === 'veg' ? '1px solid #16A34A' : '1px solid #E2E8F0',
                background: dietFilter === 'veg' ? '#DCFCE7' : '#FFFFFF',
                color: dietFilter === 'veg' ? '#16A34A' : '#334155',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              🟢 Veg
            </button>

            <button
              onClick={() => setDietFilter(dietFilter === 'nonveg' ? 'all' : 'nonveg')}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: dietFilter === 'nonveg' ? '1px solid #DC2626' : '1px solid #E2E8F0',
                background: dietFilter === 'nonveg' ? '#FEE2E2' : '#FFFFFF',
                color: dietFilter === 'nonveg' ? '#DC2626' : '#334155',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              🔴 Non-Veg
            </button>

            {/* Categories */}
            {safeCategories.map(cat => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              const isSelected = String(selectedCatFilter) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #0A2315' : '1px solid #E2E8F0',
                    background: isSelected ? '#0A2315' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#334155',
                    fontSize: '0.72rem',
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

          {/* C. Dense List Rows (~5-6 dishes visible on 1 screen) */}
          {filteredDishes.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '36px 16px',
              textAlign: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <Utensils size={28} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                {search ? 'No dishes match your search' : 'Your menu is ready for its first dish'}
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '0 0 14px 0' }}>
                {search ? 'Try clearing search keyword or filters.' : 'Add dishes to start taking customer orders.'}
              </p>
              <button
                onClick={search ? () => { setSearch(''); setSelectedCatFilter('all'); setDietFilter('all'); } : onOpenAddDish}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: '#0A2315',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {search ? 'Clear Search' : '+ Add First Dish'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {categorizedSections.map((sec, secIdx) => (
                <div key={sec.id || secIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Category Section Header */}
                  {sec.name && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {sec.name} ({sec.items.length})
                      </span>
                    </div>
                  )}

                  {/* Dense Dish List Container */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    {sec.items.map((dish, idx) => {
                      const isAvailable = dish.is_available !== false;
                      const isVeg = dish.type === 'veg';
                      const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                      return (
                        <div
                          key={dish.id}
                          className="dense-dish-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '9px 12px',
                            borderBottom: idx === sec.items.length - 1 ? 'none' : '1px solid #F1F5F9',
                            gap: '10px',
                            cursor: 'pointer',
                            minHeight: '62px',
                            boxSizing: 'border-box'
                          }}
                          onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                        >
                          {/* Left: 52px Thumbnail with Veg/Non-Veg dot */}
                          <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '10px',
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
                            <span style={{
                              position: 'absolute',
                              top: '3px',
                              left: '3px',
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: isVeg ? '#16A34A' : '#DC2626',
                              border: '1px solid #FFFFFF',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.25)'
                            }} />
                          </div>

                          {/* Center Details */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <h4 style={{
                                fontSize: '0.86rem',
                                fontWeight: 800,
                                color: isAvailable ? '#0F172A' : '#94A3B8',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
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

                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                              <strong style={{ fontSize: '0.90rem', fontWeight: 900, color: isAvailable ? '#0F172A' : '#94A3B8' }}>
                                {currencySymbol}{dish.price || 0}
                              </strong>
                              {dish.price_half && (
                                <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
                                  · H: {currencySymbol}{dish.price_half}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Controls: Availability pill + ⋮ Action */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Fast Availability Toggle */}
                            <button
                              onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                              style={{
                                background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                                color: isAvailable ? '#16A34A' : '#DC2626',
                                border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isAvailable ? '#16A34A' : '#DC2626' }} />
                              <span>{isAvailable ? 'Available' : 'Off'}</span>
                            </button>

                            {/* Overflow ⋮ Menu Button (Opens Bottom Sheet) */}
                            <button
                              onClick={() => setBottomSheetDish(dish)}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                                padding: '6px',
                                color: '#64748B',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              aria-label="Dish actions"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========================================================
          4. CATEGORIES TAB
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
              Categories ({safeCategories.length})
            </span>
            <button
              onClick={onOpenAddCategory}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              + Add Category
            </button>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {safeCategories.map((cat, idx) => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              return (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderBottom: idx === safeCategories.length - 1 ? 'none' : '1px solid #F1F5F9'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{cat.name}</h4>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{count} dish{count !== 1 ? 'es' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onOpenEditCategory && onOpenEditCategory(cat)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirmCategory(cat)} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
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
          5. COMBOS TAB
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
              Meal Combos ({safeCombos.length})
            </span>
            <button
              onClick={onOpenAddCombo}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              + Add Combo
            </button>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {safeCombos.map((combo, idx) => (
              <div
                key={combo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: idx === safeCombos.length - 1 ? 'none' : '1px solid #F1F5F9'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{combo.name}</h4>
                  <strong style={{ fontSize: '0.90rem', color: '#0F172A' }}>{currencySymbol}{combo.price}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onOpenEditCombo && onOpenEditCombo(combo)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirmCombo(combo)} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          6. FLOATING + ADD DISH ACTION BUTTON (FAB)
         ======================================================== */}
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

      {/* ========================================================
          7. MOBILE BOTTOM SHEET FOR DISH ACTIONS
         ======================================================== */}
      {bottomSheetDish && (
        <div
          onClick={() => setBottomSheetDish(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 35, 21, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          <div
            className="bottom-sheet-anim"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              width: '100%',
              maxWidth: '480px',
              borderTopLeftRadius: '22px',
              borderTopRightRadius: '22px',
              padding: '20px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -8px 30px rgba(0,0,0,0.15)'
            }}
          >
            {/* Drag handle */}
            <div style={{ width: '36px', height: '4px', borderRadius: '4px', background: '#E2E8F0', margin: '0 auto 6px auto' }} />

            {/* Dish Header Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', background: '#F8FAFC', border: '1px solid #E2E8F0', flexShrink: 0 }}>
                <img
                  src={getDishImageUrl(bottomSheetDish.image || bottomSheetDish.image_url)}
                  alt={bottomSheetDish.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {bottomSheetDish.name}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A' }}>
                    {currencySymbol}{bottomSheetDish.price || 0}
                  </span>
                  <span style={{
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    color: bottomSheetDish.is_available !== false ? '#16A34A' : '#DC2626',
                    background: bottomSheetDish.is_available !== false ? '#DCFCE7' : '#FEE2E2',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}>
                    {bottomSheetDish.is_available !== false ? '● Available' : '● Off'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => {
                  const d = bottomSheetDish;
                  setBottomSheetDish(null);
                  if (onOpenEditDish) onOpenEditDish(d);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Edit size={16} color="#0A2315" />
                <span>Edit Dish Details</span>
              </button>

              <button
                onClick={() => {
                  const d = bottomSheetDish;
                  setBottomSheetDish(null);
                  if (onToggleAvailability) onToggleAvailability(d.id, d.is_available === false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: bottomSheetDish.is_available !== false ? '#DC2626' : '#16A34A',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{bottomSheetDish.is_available !== false ? 'Turn Dish Off (Unavailable)' : 'Turn Dish On (Available)'}</span>
              </button>

              <button
                onClick={() => {
                  const d = bottomSheetDish;
                  setBottomSheetDish(null);
                  setQuickPriceDish(d);
                  setQuickPriceVal({ price: d.price || '', price_half: d.price_half || '' });
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <DollarSign size={16} color="#0284C7" />
                <span>Quick Price Update</span>
              </button>

              <button
                onClick={() => {
                  const d = bottomSheetDish;
                  setBottomSheetDish(null);
                  setDeleteConfirmDish(d);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #FECACA',
                  background: '#FFF5F5',
                  color: '#DC2626',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Trash2 size={16} />
                <span>Delete Dish</span>
              </button>
            </div>

            <button
              onClick={() => setBottomSheetDish(null)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: '#F1F5F9',
                color: '#64748B',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          8. QUICK PRICE MODAL
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
          9. DELETE CONFIRMATION MODALS
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
