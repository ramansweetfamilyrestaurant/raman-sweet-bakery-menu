import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Star, Sparkles, DollarSign, Filter, X } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';

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
                const imageSrc = dish.image || dish.image_url;

                return (
                  <div
                    key={dish.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      opacity: dish.available !== false ? 1 : 0.6,
                      minHeight: '72px',
                      boxSizing: 'border-box',
                      width: '100%',
                      minWidth: 0
                    }}
                  >
                    {/* LEFT: Dish Image (54px) */}
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #F1F5F9'
                    }}>
                      {imageSrc && imageSrc !== '/uploads/logo.jpg' ? (
                        <img
                          src={imageSrc}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: '1.3rem' }}>🍲</span>
                      )}
                    </div>

                    {/* CENTER: Dish Name, Category & Price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}>
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
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: '#111827',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.name}
                        </strong>

                        {dish.must_try && <span style={{ fontSize: '0.68rem', flexShrink: 0 }} title="Must Try">⭐</span>}
                        {dish.is_special && <span style={{ fontSize: '0.68rem', flexShrink: 0 }} title="Special">✨</span>}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {catName}
                      </div>

                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--adm-primary)' }}>
                        {currencySymbol}{Math.round(dish.price)} {dish.price_half ? `/ ${currencySymbol}${Math.round(dish.price_half)}` : ''}
                      </div>
                    </div>

                    {/* RIGHT: Compact Availability Toggle & ⋮ More Options Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => onToggleAvailability(dish.id, dish.available)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '20px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: dish.available !== false ? '#DCFCE7' : '#FEE2E2',
                          color: dish.available !== false ? '#15803D' : '#991B1B',
                          border: dish.available !== false ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          minHeight: '36px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {dish.available !== false ? '● Available' : '● Off'}
                      </button>

                      <button
                        onClick={() => onOpenEditDish(dish)}
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                          fontSize: '0.78rem'
                        }}
                        title="Edit Dish"
                      >
                        <Edit size={14} /> Edit
                      </button>

                      <button
                        onClick={() => onDeleteDish(dish.id)}
                        className="adm-btn adm-btn-danger adm-btn-sm"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700,
                          fontSize: '0.78rem'
                        }}
                        title="Delete Dish"
                      >
                        <Trash2 size={14} />
                      </button>

                      <button
                        onClick={() => setSelectedDishForMore(dish)}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: 'var(--adm-surface-subtle)',
                          border: '1px solid var(--adm-border)',
                          cursor: 'pointer',
                          color: 'var(--adm-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          flexShrink: 0
                        }}
                        title="More Badges & Options"
                      >
                        <Sparkles size={14} color="#D97706" />
                      </button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {safeCategories.map(cat => (
            <div key={cat.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#111827', display: 'block', fontWeight: 700 }}>{cat.name}</strong>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  {safeDishes.filter(d => String(d.category_id) === String(cat.id)).length} dishes
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => onToggleCategoryActive && onToggleCategoryActive(cat.id, cat.active !== false)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '20px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: cat.active !== false ? '#DCFCE7' : '#FEE2E2',
                    color: cat.active !== false ? '#15803D' : '#991B1B',
                    border: '1px solid #E2E8F0',
                    cursor: 'pointer'
                  }}
                >
                  {cat.active !== false ? '● Active' : '● Hidden'}
                </button>
                <button onClick={() => onOpenEditCategory(cat)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ padding: '6px 8px' }}>
                  <Edit size={14} />
                </button>
                <button onClick={() => onDeleteCategory(cat.id)} className="adm-btn adm-btn-danger adm-btn-sm" style={{ padding: '6px 8px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. COMBOS TAB VIEW */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {safeCombos.map(combo => (
            <div key={combo.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.92rem', color: '#111827', fontWeight: 700 }}>{combo.title || combo.name}</strong>
                <strong style={{ fontSize: '0.92rem', color: 'var(--adm-primary)', fontWeight: 800 }}>{currencySymbol}{combo.price}</strong>
              </div>

              {combo.description && (
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>{combo.description}</p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
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
                  <button onClick={() => onOpenEditCombo(combo)} className="adm-btn adm-btn-secondary adm-btn-sm">
                    <Edit size={14} /> Edit
                  </button>
                  <button onClick={() => onDeleteCombo(combo.id)} className="adm-btn adm-btn-danger adm-btn-sm">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
    </div>
  );
}

