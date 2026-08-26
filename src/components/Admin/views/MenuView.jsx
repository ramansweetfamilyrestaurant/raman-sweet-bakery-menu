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
  Flame,
  Coffee,
  Pizza,
  ShoppingBag
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
        .ultra-card-hover {
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ultra-card-hover:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.04) !important;
          border-color: #CBD5E1 !important;
        }
        .action-btn-hover {
          transition: all 0.15s ease;
        }
        .action-btn-hover:active {
          transform: scale(0.94);
        }
        .premium-search-input:focus {
          border-color: #16A34A !important;
          background: #FFFFFF !important;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12) !important;
        }
      `}</style>

      {/* ========================================================
          1. TOP BRAND HEADER & STOREFRONT PREVIEW
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid rgba(226, 232, 240, 0.85)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Menu & Catalog
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
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              {safeDishes.length} Dishes
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
            className="action-btn-hover"
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
            <span>Customer Menu</span>
          </button>
        )}
      </div>

      {/* ========================================================
          2. SEGMENTED TABS (DISHES • CATEGORIES • COMBOS ONLY)
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
            padding: '10px 14px',
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
            whiteSpace: 'nowrap',
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
            padding: '10px 14px',
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
            whiteSpace: 'nowrap',
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
            padding: '10px 14px',
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
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          <Package size={15} />
          <span>Combos ({safeCombos.length})</span>
        </button>
      </div>

      {/* ========================================================
          3. DISHES TAB: ULTRA-PREMIUM SEARCH + DYNAMIC FILTERS
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <>
          {/* Ultra-Premium Search Box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <Search size={17} color="#16A34A" />
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, categories, or ingredients..."
              className="premium-search-input"
              style={{
                width: '100%',
                padding: '12px 42px 12px 42px',
                borderRadius: '14px',
                border: '1.5px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '0.84rem',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'all 0.18s ease'
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
              { id: 'off', label: '⚠️ Sold Out' }
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

          {/* Dishes Cards Grid */}
          {filteredDishes.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
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
                    className="ultra-card-hover"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '18px',
                      border: '1px solid rgba(226, 232, 240, 0.85)',
                      padding: '14px 16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      boxSizing: 'border-box',
                      opacity: isAvailable ? 1 : 0.72
                    }}
                  >
                    {/* Left: HD Food Image + Official Veg/NonVeg Stamp */}
                    <div style={{
                      width: '72px',
                      height: '72px',
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
                        top: '5px',
                        left: '5px',
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

                    {/* Middle: Name, Category & Price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{
                          fontSize: '0.92rem',
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

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                        <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                          {currencySymbol}{dish.price || 0}
                        </strong>
                        {dish.price_half && (
                          <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                            · Half: {currencySymbol}{dish.price_half}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Smooth Stock Switch & Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      {/* Live In-Stock Toggle Switch */}
                      <button
                        onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                        className="action-btn-hover"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                          color: isAvailable ? '#16A34A' : '#DC2626',
                          border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                          padding: '5px 9px',
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
                          className="action-btn-hover"
                          style={{
                            padding: '5px 7px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                            color: '#0284C7',
                            fontSize: '0.70rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                          title="Quick Price"
                        >
                          ₹
                        </button>

                        <button
                          onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                          className="action-btn-hover"
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                            color: '#0F172A',
                            fontSize: '0.70rem',
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
                          className="action-btn-hover"
                          style={{
                            padding: '5px 7px',
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
          4. REDESIGNED ULTRA-PREMIUM CATEGORIES SECTION
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header Bar */}
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
              className="action-btn-hover"
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

          {/* Categories Grid */}
          {safeCategories.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center' }}>
              <Layers size={32} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>No categories yet</h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 14px 0' }}>Create categories to organize your menu items.</p>
              <button onClick={onOpenAddCategory} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0A2315', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Category
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {safeCategories.map((cat, idx) => {
                const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
                return (
                  <div
                    key={cat.id}
                    className="ultra-card-hover"
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
                    {/* Category Icon & Details */}
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
                        <h4 style={{
                          fontSize: '0.90rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {cat.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                            {count} dish{count !== 1 ? 'es' : ''}
                          </span>
                          <span style={{ color: '#CBD5E1' }}>•</span>
                          <span style={{ fontSize: '0.66rem', color: '#16A34A', fontWeight: 800, background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
                            ● Active
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => onOpenEditCategory && onOpenEditCategory(cat)}
                        className="action-btn-hover"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: '#F8FAFC',
                          color: '#0F172A',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => setDeleteConfirmCategory(cat)}
                        className="action-btn-hover"
                        style={{
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid #FEE2E2',
                          background: '#FFF5F5',
                          color: '#DC2626',
                          cursor: 'pointer'
                        }}
                        title="Delete Category"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          5. REDESIGNED ULTRA-PREMIUM COMBOS SECTION
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header Bar */}
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
              className="action-btn-hover"
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

          {/* Combos Grid */}
          {safeCombos.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center' }}>
              <Package size={32} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>No meal combos yet</h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 14px 0' }}>Create value meal bundles (e.g., Burger + Fries + Drink) to increase sales.</p>
              <button onClick={onOpenAddCombo} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0A2315', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Combo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
              {safeCombos.map(combo => (
                <div
                  key={combo.id}
                  className="ultra-card-hover"
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
                    {/* Top Row: Tag + Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        background: '#FEF3C7',
                        color: '#D97706',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Sparkles size={11} />
                        <span>VALUE COMBO</span>
                      </span>

                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        color: '#16A34A',
                        background: '#DCFCE7',
                        padding: '2px 7px',
                        borderRadius: '6px'
                      }}>
                        ● In Stock
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                      {combo.name}
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A' }}>
                        {currencySymbol}{combo.price}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                    <button
                      onClick={() => onOpenEditCombo && onOpenEditCombo(combo)}
                      className="action-btn-hover"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        color: '#0F172A',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit3 size={12} />
                      <span>Edit Combo</span>
                    </button>

                    <button
                      onClick={() => setDeleteConfirmCombo(combo)}
                      className="action-btn-hover"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid #FEE2E2',
                        background: '#FFF5F5',
                        color: '#DC2626',
                        cursor: 'pointer'
                      }}
                      title="Delete Combo"
                    >
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
          6. FLOATING + ADD DISH ACTION BUTTON (FAB)
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
