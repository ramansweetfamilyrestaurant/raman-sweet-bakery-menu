import React, { useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';
import PlanLockedCard from '../components/PlanLockedCard';
import { resolveImageUrl, getDishImageUrl, getCategoryImageUrl, hasCustomCategoryImage } from '../../../utils/imageHelper';
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
  onUpgrade = null
}) {
  const [deleteConfirmDish, setDeleteConfirmDish] = useState(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [deleteConfirmCombo, setDeleteConfirmCombo] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'special', 'off'

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  const filteredDishes = safeDishes.filter(d => {
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
      paddingBottom: '40px'
    }}>
      <style>{`
        .menu-dish-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1100px) {
          .menu-dish-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 680px) {
          .menu-dish-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. HEADER + QUOTA SUMMARY + PRIMARY ACTIONS
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
            Menu Management
          </h2>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Manage dishes, categories, pricing, and combos across your digital storefront.
          </p>

          {/* Compact Quota Strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{
              background: dishQuota.isAtLimit ? '#FEE2E2' : '#F8FAFC',
              border: `1px solid ${dishQuota.isAtLimit ? '#FECACA' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              color: dishQuota.isAtLimit ? '#DC2626' : '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🍽️ Dishes:</span>
              <strong style={{ color: dishQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{dishQuota.display}</strong>
            </div>

            <div style={{
              background: catQuota.isAtLimit ? '#FEE2E2' : '#F8FAFC',
              border: `1px solid ${catQuota.isAtLimit ? '#FECACA' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              color: catQuota.isAtLimit ? '#DC2626' : '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📁 Categories:</span>
              <strong style={{ color: catQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{catQuota.display}</strong>
            </div>

            <div style={{
              background: comboQuota.isAtLimit ? '#FEE2E2' : '#F8FAFC',
              border: `1px solid ${comboQuota.isAtLimit ? '#FECACA' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              color: comboQuota.isAtLimit ? '#DC2626' : '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🍱 Combos:</span>
              <strong style={{ color: comboQuota.isAtLimit ? '#DC2626' : '#0F172A' }}>{comboQuota.display}</strong>
            </div>
          </div>
        </div>

        {/* Primary CTA Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {activeSubTab === 'dishes' && (
            <button
              onClick={onOpenAddDish}
              disabled={dishQuota.isAtLimit}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: dishQuota.isAtLimit ? '#94A3B8' : '#0D3823',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
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
                padding: '10px 18px',
                borderRadius: '10px',
                background: catQuota.isAtLimit ? '#94A3B8' : '#0D3823',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: catQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(13, 56, 35, 0.25)'
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
                padding: '10px 18px',
                borderRadius: '10px',
                background: comboQuota.isAtLimit ? '#94A3B8' : '#0D3823',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: comboQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(13, 56, 35, 0.25)'
              }}
            >
              <Plus size={16} />
              <span>Add Combo</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. INTERNAL SEGMENTED SUB-NAVIGATION
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
          <span>Dishes ({safeDishes.length})</span>
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
          3. DISHES TAB CONTENT
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Search & Filter Strip */}
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
                placeholder="Search dishes by name..."
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
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
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

            {/* Diet & Status Filter Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'veg', label: '🟢 Veg' },
                { id: 'nonveg', label: '🔴 Non-Veg' },
                { id: 'must_try', label: '⭐ Must Try' },
                { id: 'special', label: '✨ Special' },
                { id: 'off', label: '⚠️ Off' }
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
                    cursor: 'pointer'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dish Cards Grid */}
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                No dishes found
              </h3>
              <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 20px 0' }}>
                {search || selectedCatFilter !== 'all' || badgeFilter !== 'all'
                  ? 'Try clearing filters or search query.'
                  : 'Start building your menu by adding your first dish.'}
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
                  Clear Filters
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
                  + Add First Dish
                </button>
              )}
            </div>
          ) : (
            <div className="menu-dish-grid">
              {filteredDishes.map(dish => {
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
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Top Row: Thumbnail + Info */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        <img
                          src={getDishImageUrl(dish.image || dish.image_url)}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isVeg ? '#16A34A' : '#DC2626'
                          }} />
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
                        </div>

                        <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {catObj?.name || 'Uncategorized'}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A' }}>
                            {currencySymbol}{dish.price || 0}
                          </span>
                          {dish.price_half && (
                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                              (Half: {currencySymbol}{dish.price_half})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Operational Controls: Availability + Edit + Delete */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #F1F5F9',
                      paddingTop: '10px'
                    }}>
                      {/* Availability Toggle */}
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
                        aria-label={`Toggle availability for ${dish.name}`}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isAvailable ? '#16A34A' : '#DC2626' }} />
                        <span>{isAvailable ? 'Available' : 'Off'}</span>
                      </button>

                      {/* Action Triggers */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onOpenEditDish && onOpenEditDish(dish)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            color: '#0F172A',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          4. CATEGORIES TAB CONTENT
         ======================================================== */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {safeCategories.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '48px 24px', textAlign: 'center' }}>
              <Layers size={32} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>No categories yet</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 16px 0' }}>Create categories to organize your menu dishes.</p>
              <button onClick={onOpenAddCategory} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0D3823', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Category
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {safeCategories.map(cat => {
                const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
                return (
                  <div key={cat.id} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div>
                      <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{cat.name}</h4>
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{count} dish{count !== 1 ? 'es' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => onOpenEditCategory && onOpenEditCategory(cat)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
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
          )}
        </div>
      )}

      {/* ========================================================
          5. COMBOS TAB CONTENT
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {safeCombos.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '48px 24px', textAlign: 'center' }}>
              <Package size={32} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>No combos yet</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 16px 0' }}>Create special value meal combos to increase average order value.</p>
              <button onClick={onOpenAddCombo} style={{ padding: '8px 16px', borderRadius: '10px', background: '#0D3823', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                + Add Combo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {safeCombos.map(combo => (
                <div key={combo.id} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{combo.name}</h4>
                      <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{currencySymbol}{combo.price}</strong>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', fontSize: '0.68rem', fontWeight: 800 }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                    <button onClick={() => onOpenEditCombo && onOpenEditCombo(combo)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
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
          6. MODIFIERS TAB CONTENT (PLAN-GATED)
         ======================================================== */}
      {activeSubTab === 'modifiers' && (
        <div>
          {!modifiersEnabled ? (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <PlanLockedCard
                featureKey="modifiers_enabled"
                featureName="Dish Modifiers & Add-Ons"
                featureDescription="Allow guests to customize items with extra cheese, spice level, toppings, and variants."
                requiredPlanName="Pro Plan or Higher"
                onUpgradeClick={onUpgrade}
              />
            </div>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '36px 24px', textAlign: 'center' }}>
              <Sliders size={32} color="#16A34A" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>Modifiers Active</h3>
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
