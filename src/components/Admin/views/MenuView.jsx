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
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Copy,
  Store,
  Check,
  Tag,
  ToggleLeft,
  ToggleRight
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
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [dietFilter, setDietFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'special', 'off'

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
      if (dietFilter === 'special') matchesDiet = Boolean(d.is_special);
      if (dietFilter === 'off') matchesDiet = d.is_available === false;

      return matchesSearch && matchesCat && matchesDiet;
    });
  }, [safeDishes, search, selectedCatFilter, dietFilter]);

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
      gap: '14px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '110px'
    }}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .modern-dish-card {
          transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
        }
        .modern-dish-card:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.04) !important;
          border-color: #CBD5E1 !important;
        }
      `}</style>

      {/* ========================================================
          1. TOP BRAND HEADER & STOREFRONT PREVIEW
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Menu & Catalog
            </h2>
            <span style={{
              background: '#DCFCE7',
              color: '#16A34A',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              {safeDishes.length} Active Dishes
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
            {restaurantInfo?.name || 'Digital Storefront Operations'}
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
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              color: '#0F172A',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Store size={15} color="#16A34A" />
            <span>Preview Storefront</span>
          </button>
        )}
      </div>

      {/* ========================================================
          2. LUXURY SEGMENTED SUB-NAVIGATION TABS
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
        boxSizing: 'border-box',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'dishes' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'dishes' ? '#FFFFFF' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          <Utensils size={14} />
          <span>Dishes ({safeDishes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('categories')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'categories' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'categories' ? '#FFFFFF' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={14} />
          <span>Categories ({safeCategories.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('combos')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'combos' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'combos' ? '#FFFFFF' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          <Package size={14} />
          <span>Combos ({safeCombos.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab && setActiveSubTab('modifiers')}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: activeSubTab === 'modifiers' ? '#0A2315' : 'transparent',
            color: activeSubTab === 'modifiers' ? '#FFFFFF' : '#475569',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          <Sliders size={14} />
          <span>Modifiers</span>
          {!modifiersEnabled && <Lock size={12} color="#D4AF37" />}
        </button>
      </div>

      {/* ========================================================
          3. DISHES TAB: SEARCH + FILTER CHIPS + HORIZONTAL CATEGORIES
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dish name, category, or ingredients..."
              style={{
                width: '100%',
                padding: '11px 36px 11px 38px',
                borderRadius: '14px',
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
                  right: '12px',
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

          {/* Quick Diet & Status Filter Chips */}
          <div className="no-scrollbar" style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '2px 0',
            WebkitOverflowScrolling: 'touch'
          }}>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'veg', label: '🟢 Veg Only' },
              { id: 'nonveg', label: '🔴 Non-Veg' },
              { id: 'must_try', label: '⭐ Best Sellers' },
              { id: 'special', label: '✨ Chef Special' },
              { id: 'off', label: '⚠️ Out of Stock' }
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setDietFilter(chip.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: dietFilter === chip.id ? '1px solid #0A2315' : '1px solid #E2E8F0',
                  background: dietFilter === chip.id ? '#0A2315' : '#FFFFFF',
                  color: dietFilter === chip.id ? '#FFFFFF' : '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Horizontal Category Selector Pills */}
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
              All Categories ({safeDishes.length})
            </button>

            {safeCategories.map(cat => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              const isSelected = String(selectedCatFilter) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat.id)}
                  style={{
                    padding: '7px 14px',
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

          {/* Dish List Counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
            <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
              Showing <strong>{filteredDishes.length}</strong> dishe{filteredDishes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ========================================================
              MODERN LUXURY DISH CARDS (CLEAN, PROPORTIONED, INTUITIVE)
             ======================================================== */}
          {filteredDishes.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <Utensils size={32} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                {search ? 'No dishes match your search' : 'Your menu is ready for its first dish'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 16px 0' }}>
                {search ? 'Try clearing search keyword or filters.' : 'Add your first dish to start taking orders.'}
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
                {search ? 'Clear Search' : '+ Add First Dish'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDishes.map(dish => {
                const isAvailable = dish.is_available !== false;
                const isVeg = dish.type === 'veg';
                const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                return (
                  <div
                    key={dish.id}
                    className="modern-dish-card"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      padding: '14px 16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      boxSizing: 'border-box',
                      opacity: isAvailable ? 1 : 0.75
                    }}
                  >
                    {/* Left: Food Image + Indian Veg/NonVeg Stamp */}
                    <div style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '14px',
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

                      {/* Official Indian Veg / Non-Veg Indicator Stamp */}
                      <span style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        width: '14px',
                        height: '14px',
                        background: '#FFFFFF',
                        border: `1.5px solid ${isVeg ? '#16A34A' : '#DC2626'}`,
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isVeg ? '#16A34A' : '#DC2626'
                        }} />
                      </span>
                    </div>

                    {/* Middle: Dish Name, Category, Price & Tags */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{
                          fontSize: '0.90rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.name}
                        </h4>
                        {dish.must_try && (
                          <span style={{ fontSize: '0.60rem', background: '#FEF3C7', color: '#D97706', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>
                            ⭐ Best
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {catObj?.name || 'Uncategorized'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
                        <strong style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}>
                          {currencySymbol}{dish.price || 0}
                        </strong>
                        {dish.price_half && (
                          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                            · Half: {currencySymbol}{dish.price_half}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Modern Stock Switch + Edit Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      {/* Live In-Stock Toggle Switch */}
                      <button
                        onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                          color: isAvailable ? '#16A34A' : '#DC2626',
                          border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isAvailable ? '#16A34A' : '#DC2626' }} />
                        <span>{isAvailable ? 'In Stock' : 'Sold Out'}</span>
                      </button>

                      {/* Action Buttons: Quick Price, Edit, Delete */}
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
                            fontWeight: 700,
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
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================
          4. CATEGORIES TAB CONTENT
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0F172A' }}>
              Categories ({safeCategories.length})
            </span>
            <button
              onClick={onOpenAddCategory}
              style={{
                padding: '7px 14px',
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {safeCategories.map(cat => {
              const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
              return (
                <div
                  key={cat.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
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
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          5. COMBOS TAB CONTENT
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0F172A' }}>
              Value Combos ({safeCombos.length})
            </span>
            <button
              onClick={onOpenAddCombo}
              style={{
                padding: '7px 14px',
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {safeCombos.map(combo => (
              <div
                key={combo.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid #E2E8F0',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{combo.name}</h4>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A' }}>{currencySymbol}{combo.price}</strong>
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
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          6. MODIFIERS TAB (PLAN-GATED)
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
          7. FLOATING + ADD DISH ACTION BUTTON (FAB)
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
