import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Star, Sparkles, DollarSign, Filter } from 'lucide-react';
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
  onToggleBadge
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Menu Header with Action CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            Menu Catalog
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            {safeDishes.length} dishes • {safeCategories.length} categories • {safeCombos.length} combos
          </span>
        </div>

        {activeSubTab === 'dishes' && (
          <button onClick={onOpenAddDish} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
            <Plus size={16} /> Add Dish
          </button>
        )}
        {activeSubTab === 'categories' && (
          <button onClick={onOpenAddCategory} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
            <Plus size={16} /> Add Category
          </button>
        )}
        {activeSubTab === 'combos' && (
          <button onClick={onOpenAddCombo} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
            <Plus size={16} /> Add Combo
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs: Dishes / Categories / Combos */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setActiveSubTab('dishes')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'dishes' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          Dishes ({safeDishes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('categories')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'categories' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          Categories ({safeCategories.length})
        </button>
        <button
          onClick={() => setActiveSubTab('combos')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'combos' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          Combos ({safeCombos.length})
        </button>
      </div>

      {/* DISHES TAB CONTENT */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search & Category Dropdown */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-muted)' }} />
              <input
                type="text"
                placeholder="Search dishes by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 'var(--adm-radius-md)',
                  border: '1px solid var(--adm-border)',
                  fontSize: '0.86rem',
                  background: '#FFFFFF',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--adm-radius-md)',
                border: '1px solid var(--adm-border)',
                fontSize: '0.84rem',
                fontWeight: 700,
                background: '#FFFFFF',
                color: 'var(--adm-primary)'
              }}
            >
              <option value="all">All Categories ({safeCategories.length})</option>
              {safeCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Filter Chips (Veg / NonVeg / Must Try / Special) */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: `All (${safeDishes.length})` },
              { id: 'veg', label: `🟢 Veg (${safeDishes.filter(d => d.type === 'veg').length})` },
              { id: 'nonveg', label: `🔴 Non-Veg (${safeDishes.filter(d => d.type === 'nonveg').length})` },
              { id: 'must_try', label: `⭐ Must Try (${safeDishes.filter(d => d.must_try).length})` },
              { id: 'special', label: `✨ Special (${safeDishes.filter(d => d.is_special).length})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setBadgeFilter(f.id)}
                className={`adm-btn adm-btn-sm ${badgeFilter === f.id ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
                style={{ flexShrink: 0, padding: '5px 12px', fontSize: '0.76rem', borderRadius: 'var(--adm-radius-full)' }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* POS DISH GRID */}
          <div className="adm-dish-grid">
            {filteredDishes.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '36px', textAlign: 'center', background: '#FFFFFF', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
                <p style={{ color: 'var(--adm-muted)', margin: 0, fontWeight: 600 }}>No dishes found matching criteria.</p>
              </div>
            ) : (
              filteredDishes.map(dish => {
                const catName = dish.category_name || safeCategories.find(c => String(c.id) === String(dish.category_id))?.name || 'General';
                const imageSrc = dish.image || dish.image_url;

                return (
                  <div
                    key={dish.id}
                    className="adm-dish-card"
                    style={{ opacity: dish.available !== false ? 1 : 0.65 }}
                  >
                    {/* Dish Image */}
                    <div className="adm-dish-card-img">
                      {imageSrc && imageSrc !== '/uploads/logo.jpg' ? (
                        <img
                          src={imageSrc}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: '1.4rem' }}>🍲</span>
                      )}
                    </div>

                    {/* Dish Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
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
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--adm-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {dish.name}
                        </strong>

                        {dish.must_try && <span style={{ fontSize: '0.72rem' }} title="Must Try">⭐</span>}
                        {dish.is_special && <span style={{ fontSize: '0.72rem' }} title="Special">✨</span>}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--adm-muted)', marginBottom: '3px' }}>
                        {catName}
                      </div>

                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--adm-primary)' }}>
                        ₹{Math.round(dish.price)} {dish.price_half ? `/ ₹${Math.round(dish.price_half)}` : ''}
                      </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => onToggleAvailability(dish.id, dish.available)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--adm-radius-full)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: dish.available !== false ? 'var(--adm-success-bg)' : 'var(--adm-danger-bg)',
                          color: dish.available !== false ? 'var(--adm-success)' : 'var(--adm-danger)',
                          border: dish.available !== false ? '1px solid var(--adm-success-border)' : '1px solid var(--adm-danger-border)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {dish.available !== false ? '🟢 Available' : '🔴 Off'}
                      </button>

                      <button
                        onClick={() => setSelectedDishForMore(dish)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-muted)', padding: '4px' }}
                        title="More Options"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CATEGORIES TAB CONTENT */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {safeCategories.map(cat => (
            <div key={cat.id} className="adm-card" style={{ padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--adm-primary)', display: 'block' }}>{cat.name}</strong>
                <span style={{ fontSize: '0.76rem', color: 'var(--adm-muted)' }}>
                  {safeDishes.filter(d => String(d.category_id) === String(cat.id)).length} dishes
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => onToggleCategoryActive && onToggleCategoryActive(cat.id, cat.active !== false)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--adm-radius-full)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: cat.active !== false ? 'var(--adm-success-bg)' : 'var(--adm-danger-bg)',
                    color: cat.active !== false ? 'var(--adm-success)' : 'var(--adm-danger)',
                    border: '1px solid var(--adm-border)',
                    cursor: 'pointer'
                  }}
                >
                  {cat.active !== false ? '🟢 Active' : '🔴 Hidden'}
                </button>
                <button onClick={() => onOpenEditCategory(cat)} className="adm-btn adm-btn-secondary adm-btn-sm">
                  <Edit size={14} />
                </button>
                <button onClick={() => onDeleteCategory(cat.id)} className="adm-btn adm-btn-danger adm-btn-sm">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMBOS TAB CONTENT */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {safeCombos.map(combo => (
            <div key={combo.id} className="adm-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--adm-primary)' }}>{combo.title || combo.name}</strong>
                <strong style={{ fontSize: '0.95rem', color: 'var(--adm-accent)' }}>₹{combo.price}</strong>
              </div>

              {combo.description && (
                <p style={{ fontSize: '0.78rem', color: 'var(--adm-muted)', margin: 0 }}>{combo.description}</p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                <button
                  onClick={() => onToggleComboAvailability && onToggleComboAvailability(combo.id, combo.available !== false)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--adm-radius-full)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: combo.available !== false ? 'var(--adm-success-bg)' : 'var(--adm-danger-bg)',
                    color: combo.available !== false ? 'var(--adm-success)' : 'var(--adm-danger)',
                    border: '1px solid var(--adm-border)',
                    cursor: 'pointer'
                  }}
                >
                  {combo.available !== false ? '🟢 Available' : '🔴 Off'}
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

      {/* Dish ⋮ More Options Action Sheet Drawer */}
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
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem' }}
            >
              <DollarSign size={16} color="var(--adm-accent)" /> Quick Price Edit (₹{Math.round(selectedDishForMore.price)})
            </button>

            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                onOpenEditDish(d);
              }}
              className="adm-btn adm-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem' }}
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
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '0.88rem', marginTop: '6px' }}
            >
              <Trash2 size={16} /> Delete Dish
            </button>
          </div>
        )}
      </AdminDrawer>

      {/* Quick Price Sheet Drawer */}
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
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>FULL PORTION PRICE (₹):</label>
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
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>HALF PORTION PRICE (₹):</label>
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
