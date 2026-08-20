import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Star, Sparkles, DollarSign, Filter, X } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';
import { resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../../utils/imageHelper';

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
  currencySymbol = '₹'
}) {
  const [deleteConfirmDish, setDeleteConfirmDish] = useState(null);
  const [selectedDishForMore, setSelectedDishForMore] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'special'

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const filteredDishes = safeDishes.filter(d => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
    let matchesBadge = true;
    if (badgeFilter === 'veg') matchesBadge = d.type === 'veg';
    if (badgeFilter === 'nonveg') matchesBadge = d.type === 'nonveg';
    if (badgeFilter === 'must_try') matchesBadge = Boolean(d.must_try);
    if (badgeFilter === 'special') matchesBadge = Boolean(d.is_special);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. COMPACT POS MENU HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Menu Management
          </h2>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: '12px' }}>
            {safeDishes.length} Dishes • {safeCategories.length} Categories
          </span>
        </div>

        {activeSubTab === 'dishes' && (
          <button
            onClick={onOpenAddDish}
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
              color: '#0A2315',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(212, 175, 55, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={16} /> Add Dish
          </button>
        )}
        {activeSubTab === 'categories' && (
          <button
            onClick={onOpenAddCategory}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={16} /> Add Category
          </button>
        )}
        {activeSubTab === 'combos' && (
          <button
            onClick={onOpenAddCombo}
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={16} /> Add Combo
          </button>
        )}
      </div>

      {/* 2. SEGMENTED NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '6px', background: '#FFFFFF', padding: '5px', borderRadius: '12px', width: 'fit-content', maxWidth: '100%', border: '1px solid #E2E8F0' }}>
        <button
          onClick={() => setActiveSubTab('dishes')}
          style={{
            padding: '7px 16px',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'dishes' ? '#0F172A' : 'transparent',
            color: activeSubTab === 'dishes' ? '#FFFFFF' : '#64748B',
            transition: 'all 0.15s ease'
          }}
        >
          🍲 Dishes ({safeDishes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('categories')}
          style={{
            padding: '7px 16px',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'categories' ? '#0F172A' : 'transparent',
            color: activeSubTab === 'categories' ? '#FFFFFF' : '#64748B',
            transition: 'all 0.15s ease'
          }}
        >
          📁 Categories ({safeCategories.length})
        </button>
        <button
          onClick={() => setActiveSubTab('combos')}
          style={{
            padding: '7px 16px',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'combos' ? '#0F172A' : 'transparent',
            color: activeSubTab === 'combos' ? '#FFFFFF' : '#64748B',
            transition: 'all 0.15s ease'
          }}
        >
          🍱 Combos ({safeCombos.length})
        </button>
      </div>

      {/* 3. DISHES TAB VIEW */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* SEARCH & CATEGORY SELECTOR TOOLBAR */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes by name..."
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 36px 0 38px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  background: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: '#FFFFFF',
                color: '#0F172A',
                cursor: 'pointer',
                flex: '1 1 180px',
                maxWidth: '100%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <option value="all">📁 All Categories ({safeCategories.length})</option>
              {safeCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* HORIZONTALLY SCROLLABLE CHIP FILTERS */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {[
              { id: 'all', label: `All (${safeDishes.length})` },
              { id: 'veg', label: `🟢 Veg (${safeDishes.filter(d => d.type === 'veg').length})` },
              { id: 'nonveg', label: `🔴 Non-Veg (${safeDishes.filter(d => d.type === 'nonveg').length})` },
              { id: 'must_try', label: `⭐ Must Try (${safeDishes.filter(d => d.must_try).length})` },
              { id: 'special', label: `✨ Special (${safeDishes.filter(d => d.is_special).length})` }
            ].map(f => {
              const isActive = badgeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setBadgeFilter(f.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isActive ? '#0F172A' : '#E2E8F0',
                    cursor: 'pointer',
                    background: isActive ? '#0F172A' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#475569',
                    boxShadow: isActive ? '0 2px 6px rgba(15, 23, 42, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* DISH LIST (EXECUTIVE POS CARDS) */}
          {filteredDishes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍲</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                {search ? 'No dishes found' : 'No dishes yet'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0' }}>
                {search ? 'Try searching for another dish name or category.' : 'Add your first dish to start building your menu catalog.'}
              </p>
              {!search && (
                <button onClick={onOpenAddDish} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
                  <Plus size={15} /> Add First Dish
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
              {filteredDishes.map(dish => {
                const catName = dish.category_name || safeCategories.find(c => String(c.id) === String(dish.category_id))?.name || 'General';
                const imageSrc = getDishImageUrl(dish.image || dish.image_url);
                const isAvail = dish.available !== false;

                return (
                  <div
                    key={dish.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: isAvail ? 1 : 0.65,
                      boxSizing: 'border-box',
                      width: '100%',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    {/* LEFT: Dish Image (60px Square) */}
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #E2E8F0'
                    }}>
                      <img
                        src={imageSrc}
                        alt={dish.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                      />
                    </div>

                    {/* MIDDLE: Dish Name, Category, Price & Badges */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '9px',
                          height: '9px',
                          border: dish.type === 'nonveg' ? '1.5px solid #DC2626' : dish.type === 'egg' ? '1.5px solid #D97706' : '1.5px solid #16A34A',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '2px',
                          flexShrink: 0
                        }}>
                          <span style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#D97706' : '#16A34A'
                          }} />
                        </span>

                        <strong style={{
                          fontSize: '0.92rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          lineHeight: 1.25,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.name}
                        </strong>

                        {dish.must_try && <span style={{ fontSize: '0.7rem', flexShrink: 0 }} title="Must Try">⭐</span>}
                        {dish.is_special && <span style={{ fontSize: '0.7rem', flexShrink: 0 }} title="Special">✨</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, background: '#F1F5F9', padding: '1px 7px', borderRadius: '6px' }}>
                          {catName}
                        </span>
                        <span style={{ fontSize: '0.90rem', fontWeight: 900, color: '#059669' }}>
                          {currencySymbol}{Math.round(dish.price)} {dish.price_half ? `/ ${currencySymbol}${Math.round(dish.price_half)}` : ''}
                        </span>
                      </div>

                      {dish.description && (
                        <div style={{
                          fontSize: '0.70rem',
                          color: '#94A3B8',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.description}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Availability Toggle & Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => onToggleAvailability(dish.id, dish.available)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          background: isAvail ? '#DCFCE7' : '#FEE2E2',
                          color: isAvail ? '#15803D' : '#991B1B',
                          border: isAvail ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: isAvail ? '0 1px 4px rgba(22, 163, 74, 0.15)' : 'none'
                        }}
                        title="Toggle Dish Availability"
                      >
                        {isAvail ? '● Available' : '● Off'}
                      </button>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => onOpenEditDish(dish)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            background: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #E2E8F0',
                            cursor: 'pointer'
                          }}
                          title="Edit Dish"
                        >
                          <Edit size={12} /> Edit
                        </button>

                        <button
                          onClick={() => setDeleteConfirmDish(dish)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            background: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
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
        </div>
      )}

      {/* 4. CATEGORIES TAB VIEW */}
      {activeSubTab === 'categories' && (
        safeCategories.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📁</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
              No categories yet
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0' }}>
              Create your first menu category (e.g. Starters, Main Course, Drinks) to organize your dishes.
            </p>
            <button onClick={onOpenAddCategory} style={{
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Plus size={15} /> Add First Category
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {safeCategories.map(cat => {
            const catImage = getCategoryImageUrl(cat.image || cat.image_url);
            const dishCount = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
            const isActive = cat.active !== false;

            return (
              <div
                key={cat.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  opacity: isActive ? 1 : 0.65,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {/* Category Image (56px Square) */}
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #E2E8F0'
                  }}>
                    <img
                      src={catImage}
                      alt={cat.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.src = '/images/default-category.webp'; }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{
                      fontSize: '0.92rem',
                      color: '#0F172A',
                      display: 'block',
                      fontWeight: 800,
                      lineHeight: 1.25,
                      wordBreak: 'break-word'
                    }}>
                      {cat.name}
                    </strong>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px', display: 'inline-block' }}>
                      🍲 {dishCount} {dishCount === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => onToggleCategoryActive && onToggleCategoryActive(cat.id, cat.active !== false)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      background: isActive ? '#DCFCE7' : '#FEE2E2',
                      color: isActive ? '#15803D' : '#991B1B',
                      border: isActive ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? '0 1px 4px rgba(22, 163, 74, 0.15)' : 'none'
                    }}
                  >
                    {isActive ? '● Active' : '● Hidden'}
                  </button>
                  <button
                    onClick={() => onOpenEditCategory(cat)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: '#F1F5F9',
                      color: '#334155',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer'
                    }}
                    title="Edit Category"
                  >
                    <Edit size={13} />
                  </button>
                  <button
                    onClick={() => onDeleteCategory(cat.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
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
        )
      )}

      {/* 5. COMBOS TAB VIEW */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
          {safeCombos.map(combo => {
            const comboImage = resolveImageUrl(combo.image || combo.image_url);
            const isAvail = combo.available !== false;

            return (
              <div
                key={combo.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  opacity: isAvail ? 1 : 0.65,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Combo Image (60px Square) */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #E2E8F0'
                  }}>
                    {comboImage ? (
                      <img
                        src={comboImage}
                        alt={combo.title || combo.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>🍱</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 800, lineHeight: 1.25 }}>
                        {combo.title || combo.name}
                      </strong>
                      <strong style={{ fontSize: '0.94rem', color: '#059669', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {currencySymbol}{Math.round(Number(combo.price) || 0)}
                      </strong>
                    </div>

                    {combo.description && (
                      <p style={{
                        fontSize: '0.74rem',
                        color: '#64748B',
                        margin: '4px 0 0 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3
                      }}>
                        {combo.description}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    onClick={() => onToggleComboAvailability && onToggleComboAvailability(combo.id, combo.available !== false)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      background: isAvail ? '#DCFCE7' : '#FEE2E2',
                      color: isAvail ? '#15803D' : '#991B1B',
                      border: isAvail ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                      cursor: 'pointer',
                      boxShadow: isAvail ? '0 1px 4px rgba(22, 163, 74, 0.15)' : 'none'
                    }}
                  >
                    {isAvail ? '● Available' : '● Off'}
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => onOpenEditCombo(combo)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #E2E8F0',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit size={13} /> Edit
                    </button>

                    <button
                      onClick={() => onDeleteCombo && onDeleteCombo(combo.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#FEE2E2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        cursor: 'pointer'
                      }}
                      title="Delete Combo"
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

      {/* 6. DISH ⋮ MORE OPTIONS ACTION SHEET DRAWER */}
      <AdminDrawer
        isOpen={!!selectedDishForMore}
        onClose={() => setSelectedDishForMore(null)}
        title={selectedDishForMore?.name || 'Dish Options'}
        subtitle={`Category: ${safeCategories.find(c => String(c.id) === String(selectedDishForMore?.category_id))?.name || 'General'}`}
      >
        {selectedDishForMore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                setQuickPriceDish(d);
                setQuickPriceVal({ price: Math.round(d.price) || '', price_half: d.price_half ? Math.round(d.price_half) : '' });
              }}
              className="adm-btn adm-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700 }}
            >
              <DollarSign size={16} color="var(--adm-primary)" /> Quick Price Edit ({currencySymbol}{Math.round(selectedDishForMore.price)})
            </button>

            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                onOpenEditDish(d);
              }}
              className="adm-btn adm-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700 }}
            >
              <Edit size={16} color="var(--adm-primary)" /> Edit Dish Details
            </button>

            {onToggleBadge && (
              <>
                <button
                  onClick={() => {
                    const d = selectedDishForMore;
                    setSelectedDishForMore(null);
                    onToggleBadge(d, 'must_try');
                  }}
                  className="adm-btn adm-btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  <Star size={16} color="#D97706" /> {selectedDishForMore.must_try ? 'Remove Must Try Badge' : 'Mark Must Try ⭐'}
                </button>

                <button
                  onClick={() => {
                    const d = selectedDishForMore;
                    setSelectedDishForMore(null);
                    onToggleBadge(d, 'is_special');
                  }}
                  className="adm-btn adm-btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  <Sparkles size={16} color="#7E22CE" /> {selectedDishForMore.is_special ? 'Remove Special Badge' : 'Mark Special ✨'}
                </button>
              </>
            )}

            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                onDeleteDish(d.id);
              }}
              className="adm-btn adm-btn-danger"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem', fontWeight: 700, marginTop: '6px' }}
            >
              <Trash2 size={16} /> Delete Dish
            </button>
          </div>
        )}
      </AdminDrawer>

      {/* 7. QUICK PRICE SHEET DRAWER */}
      <AdminDrawer
        isOpen={!!quickPriceDish}
        onClose={() => setQuickPriceDish(null)}
        title={`Quick Price: ${quickPriceDish?.name}`}
        subtitle="Update dish pricing instantly"
        footer={(
          <button onClick={handleQuickPriceSubmit} className="adm-btn adm-btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 900 }}>
            Save Price Change
          </button>
        )}
      >
        <form onSubmit={handleQuickPriceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>FULL PORTION PRICE ({currencySymbol}):</label>
            <input
              type="number"
              required
              value={quickPriceVal.price}
              onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.95rem', fontWeight: 800 }}
            />
          </div>

          {quickPriceDish?.price_half !== undefined && quickPriceDish?.price_half !== null && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>HALF PORTION PRICE ({currencySymbol}):</label>
              <input
                type="number"
                value={quickPriceVal.price_half}
                onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price_half: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.95rem', fontWeight: 800 }}
              />
            </div>
          )}
        </form>
      </AdminDrawer>

      {/* 8. ACCIDENTAL DELETE CONFIRMATION DIALOG */}
      {deleteConfirmDish && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 11000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🗑️</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#111827', margin: '0 0 6px 0' }}>
              Delete Dish?
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>"{deleteConfirmDish.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDeleteConfirmDish(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#475569',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteDish(deleteConfirmDish.id);
                  setDeleteConfirmDish(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

