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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--adm-primary)', margin: 0, letterSpacing: '-0.3px' }}>
              Menu
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
              {safeDishes.length} dishes
            </span>
          </div>
        </div>

        {activeSubTab === 'dishes' && (
          <button
            onClick={onOpenAddDish}
            className="adm-btn adm-btn-accent adm-btn-sm"
            style={{ fontWeight: 800, padding: '7px 14px', borderRadius: 'var(--adm-radius-md)', fontSize: '0.82rem' }}
          >
            <Plus size={15} /> Add Dish
          </button>
        )}
        {activeSubTab === 'categories' && (
          <button
            onClick={onOpenAddCategory}
            className="adm-btn adm-btn-accent adm-btn-sm"
            style={{ fontWeight: 800, padding: '7px 14px', borderRadius: 'var(--adm-radius-md)', fontSize: '0.82rem' }}
          >
            <Plus size={15} /> Add Category
          </button>
        )}
        {activeSubTab === 'combos' && (
          <button
            onClick={onOpenAddCombo}
            className="adm-btn adm-btn-accent adm-btn-sm"
            style={{ fontWeight: 800, padding: '7px 14px', borderRadius: 'var(--adm-radius-md)', fontSize: '0.82rem' }}
          >
            <Plus size={15} /> Add Combo
          </button>
        )}
      </div>

      {/* 2. SEGMENTED NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '4px', background: '#E2E8F0', padding: '3px', borderRadius: '10px', width: 'fit-content', maxWidth: '100%' }}>
        <button
          onClick={() => setActiveSubTab('dishes')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'dishes' ? 'var(--adm-primary)' : 'transparent',
            color: activeSubTab === 'dishes' ? '#FFFFFF' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          Dishes ({safeDishes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('categories')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'categories' ? 'var(--adm-primary)' : 'transparent',
            color: activeSubTab === 'categories' ? '#FFFFFF' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          Categories ({safeCategories.length})
        </button>
        <button
          onClick={() => setActiveSubTab('combos')}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'combos' ? 'var(--adm-primary)' : 'transparent',
            color: activeSubTab === 'combos' ? '#FFFFFF' : '#475569',
            transition: 'all 0.15s ease'
          }}
        >
          Combos ({safeCombos.length})
        </button>
      </div>

      {/* 3. DISHES TAB VIEW */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* SEARCH BAR & CATEGORY SELECTOR */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', width: '100%', minWidth: 0 }}>
              <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search dishes by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 36px 0 38px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: '#FFFFFF',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
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

            {/* Category Quick Selector Dropdown */}
            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              style={{
                height: '44px',
                padding: '0 12px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: '#FFFFFF',
                color: 'var(--adm-primary)',
                cursor: 'pointer',
                flex: '1 1 auto',
                maxWidth: '100%'
              }}
            >
              <option value="all">All Categories ({safeCategories.length})</option>
              {safeCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* HORIZONTALLY SCROLLABLE CHIP FILTERS */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
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
                    padding: '6px 12px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--adm-primary)' : '#E2E8F0',
                    color: isActive ? '#FFFFFF' : '#334155',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* DISH LIST (COMPACT POS ROWS) */}
          {filteredDishes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍲</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adm-primary)', margin: '0 0 4px 0' }}>
                {search ? 'No dishes found' : 'No dishes yet'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', margin: '0 0 16px 0' }}>
                {search ? 'Try searching for another dish name or category.' : 'Add your first dish to start building your menu catalog.'}
              </p>
              {!search && (
                <button onClick={onOpenAddDish} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
                  <Plus size={15} /> Add First Dish
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '8px' }}>
              {filteredDishes.map(dish => {
                const catName = dish.category_name || safeCategories.find(c => String(c.id) === String(dish.category_id))?.name || 'General';
                const imageSrc = getDishImageUrl(dish.image || dish.image_url);

                return (
                  <div
                    key={dish.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '14px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: dish.available !== false ? 1 : 0.6,
                      boxSizing: 'border-box',
                      width: '100%',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* LEFT: Dish Image (56px Square) */}
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '10px',
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

                    {/* MIDDLE: Dish Name, Category, Price & Description (1-2 lines max) */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          border: dish.type === 'nonveg' ? '1.5px solid #DC2626' : dish.type === 'egg' ? '1.5px solid #D97706' : '1.5px solid #16A34A',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '2px',
                          flexShrink: 0
                        }}>
                          <span style={{
                            width: '3.5px',
                            height: '3.5px',
                            borderRadius: '50%',
                            backgroundColor: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#D97706' : '#16A34A'
                          }} />
                        </span>

                        <strong style={{
                          fontSize: '0.90rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          lineHeight: 1.25,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {dish.name}
                        </strong>

                        {dish.must_try && <span style={{ fontSize: '0.7rem', flexShrink: 0 }} title="Must Try">⭐</span>}
                        {dish.is_special && <span style={{ fontSize: '0.7rem', flexShrink: 0 }} title="Special">✨</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.73rem', color: '#64748B', fontWeight: 600 }}>
                          {catName}
                        </span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 900, color: 'var(--adm-primary)' }}>
                          {currencySymbol}{Math.round(dish.price)} {dish.price_half ? `/ ${currencySymbol}${Math.round(dish.price_half)}` : ''}
                        </span>
                      </div>

                      {dish.description && (
                        <div style={{
                          fontSize: '0.70rem',
                          color: '#94A3B8',
                          lineHeight: 1.25,
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.description}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Primary Action (Available Toggle) & Secondary Actions (Edit, Delete) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      {/* PRIMARY ACTION: Available Status Badge */}
                      <button
                        onClick={() => onToggleAvailability(dish.id, dish.available)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          background: dish.available !== false ? '#DCFCE7' : '#FEE2E2',
                          color: dish.available !== false ? '#15803D' : '#991B1B',
                          border: dish.available !== false ? '1.5px solid #86EFAC' : '1.5px solid #FCA5A5',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: dish.available !== false ? '0 1px 4px rgba(22, 163, 74, 0.15)' : 'none'
                        }}
                        title="Toggle Dish Availability"
                      >
                        {dish.available !== false ? '● Available' : '● Off'}
                      </button>

                      {/* SECONDARY ACTIONS: Edit & Delete */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => onOpenEditDish(dish)}
                          className="adm-btn adm-btn-secondary adm-btn-sm"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 800,
                            fontSize: '0.74rem'
                          }}
                          title="Edit Dish"
                        >
                          <Edit size={12} /> Edit
                        </button>

                        <button
                          onClick={() => setDeleteConfirmDish(dish)}
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.74rem'
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
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📁</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adm-primary)', margin: '0 0 4px 0' }}>
              No categories yet
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', margin: '0 0 16px 0' }}>
              Create your first menu category (e.g. Starters, Main Course, Drinks) to organize your dishes.
            </p>
            <button onClick={onOpenAddCategory} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
              <Plus size={15} /> Add First Category
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '10px' }}>
          {safeCategories.map(cat => {
            const catImage = getCategoryImageUrl(cat.image || cat.image_url);
            const dishCount = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
            return (
              <div key={cat.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {/* Category Image (52px Square) */}
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
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
                    <strong style={{ fontSize: '0.92rem', color: '#111827', display: 'block', fontWeight: 800 }}>{cat.name}</strong>
                    <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
                      {dishCount} {dishCount === 1 ? 'dish' : 'dishes'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => onToggleCategoryActive && onToggleCategoryActive(cat.id, cat.active !== false)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '20px',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      background: cat.active !== false ? '#DCFCE7' : '#FEE2E2',
                      color: cat.active !== false ? '#15803D' : '#991B1B',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat.active !== false ? '● Active' : '● Hidden'}
                  </button>
                  <button onClick={() => onOpenEditCategory(cat)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ padding: '6px 8px' }} title="Edit Category">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => onDeleteCategory(cat.id)} className="adm-btn adm-btn-danger adm-btn-sm" style={{ padding: '6px 8px' }} title="Delete Category">
                    <Trash2 size={14} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {safeCombos.map(combo => {
            const comboImage = resolveImageUrl(combo.image || combo.image_url);
            return (
              <div key={combo.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Combo Image (56px Square) */}
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '10px',
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
                      <span style={{ fontSize: '1.4rem' }}>🍱</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#111827', fontWeight: 800 }}>{combo.title || combo.name}</strong>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--adm-primary)', fontWeight: 900 }}>{currencySymbol}{combo.price}</strong>
                    </div>

                    {combo.description && (
                      <p style={{
                        fontSize: '0.76rem',
                        color: '#64748B',
                        margin: '2px 0 0 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>{combo.description}</p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    onClick={() => onToggleComboAvailability && onToggleComboAvailability(combo.id, combo.available !== false)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: combo.available !== false ? '#DCFCE7' : '#FEE2E2',
                      color: combo.available !== false ? '#15803D' : '#991B1B',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer'
                    }}
                  >
                    {combo.available !== false ? '● Available' : '● Off'}
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => onOpenEditCombo(combo)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ padding: '6px 10px', fontWeight: 800 }}>
                      <Edit size={14} /> Edit
                    </button>
                    <button onClick={() => onDeleteCombo(combo.id)} className="adm-btn adm-btn-danger adm-btn-sm" style={{ padding: '6px 10px' }}>
                      <Trash2 size={14} />
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

