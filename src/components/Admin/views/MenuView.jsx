import React, { useState } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Star, Sparkles, CheckCircle2, XCircle, DollarSign } from 'lucide-react';
import AdminDrawer from '../components/AdminDrawer';

export default function MenuView({
  dishes,
  categories,
  combos,
  activeSubTab,
  setActiveSubTab,
  search,
  setSearch,
  selectedCatFilter,
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
  onToggleComboAvailability
}) {
  const [selectedDishForMore, setSelectedDishForMore] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });

  const filteredDishes = dishes.filter(d => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
    return matchesSearch && matchesCat;
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
      {/* Top Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--adm-text)', margin: '0 0 2px 0' }}>
            🍽 Restaurant Menu Management
          </h2>
          <span style={{ fontSize: '0.76rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Configure dishes, prices, categories, and combo packages.
          </span>
        </div>

        {activeSubTab === 'dishes' && (
          <button onClick={onOpenAddDish} className="adm-btn adm-btn-accent adm-btn-sm">
            <Plus size={15} /> Add New Dish
          </button>
        )}
        {activeSubTab === 'categories' && (
          <button onClick={onOpenAddCategory} className="adm-btn adm-btn-accent adm-btn-sm">
            <Plus size={15} /> Add Category
          </button>
        )}
        {activeSubTab === 'combos' && (
          <button onClick={onOpenAddCombo} className="adm-btn adm-btn-accent adm-btn-sm">
            <Plus size={15} /> Add Combo
          </button>
        )}
      </div>

      {/* Sub-navigation Chips */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setActiveSubTab('dishes')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'dishes' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
        >
          Dishes ({dishes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('categories')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'categories' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
        >
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveSubTab('combos')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'combos' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
        >
          Combos ({combos.length})
        </button>
      </div>

      {/* DISHES TAB CONTENT */}
      {activeSubTab === 'dishes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search & Category Filter Row */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-muted)' }} />
              <input
                type="text"
                placeholder="Search dishes by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.84rem' }}
              />
            </div>

            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.84rem', fontWeight: 700 }}
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 1-Column Mobile / 2-Column Desktop Dish Card Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredDishes.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', background: '#FFF', borderRadius: 'var(--adm-radius-lg)', border: '1px solid var(--adm-border)' }}>
                <p style={{ color: 'var(--adm-muted)', margin: 0 }}>No dishes match criteria.</p>
              </div>
            ) : (
              filteredDishes.map(dish => (
                <div
                  key={dish.id}
                  className="adm-card"
                  style={{ padding: '12px', display: 'flex', gap: '12px', alignItems: 'center', opacity: dish.available ? 1 : 0.65 }}
                >
                  {/* Dish Image */}
                  <div style={{
                    width: '64px', height: '64px', borderRadius: 'var(--adm-radius-md)',
                    background: 'var(--adm-surface-subtle)', overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {dish.image_url ? (
                      <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1.2rem' }}>🍲</span>
                    )}
                  </div>

                  {/* Dish Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--adm-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dish.name}
                      </strong>
                    </div>

                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--adm-primary)' }}>
                      ₹{dish.price} {dish.price_half ? `/ ₹${dish.price_half}` : ''}
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      {dish.must_try && <span className="adm-badge adm-badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>⭐ MUST TRY</span>}
                      {dish.is_special && <span className="adm-badge adm-badge-purple" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>✨ SPECIAL</span>}
                    </div>
                  </div>

                  {/* Right Actions: Availability Switch & More Menu */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => onToggleAvailability(dish.id, dish.available)}
                      className={`adm-btn adm-btn-sm ${dish.available ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                      title={dish.available ? 'Mark Unavailable' : 'Mark Available'}
                    >
                      {dish.available ? '🟢 Available' : '🔴 Off'}
                    </button>

                    <button
                      onClick={() => setSelectedDishForMore(dish)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-muted)', padding: '4px' }}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dish More Options Drawer */}
      <AdminDrawer
        isOpen={!!selectedDishForMore}
        onClose={() => setSelectedDishForMore(null)}
        title={selectedDishForMore?.name || 'Dish Options'}
        subtitle={`Category: ${categories.find(c => String(c.id) === String(selectedDishForMore?.category_id))?.name || 'General'}`}
      >
        {selectedDishForMore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                setQuickPriceDish(d);
                setQuickPriceVal({ price: d.price || '', price_half: d.price_half || '' });
              }}
              className="adm-btn adm-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <DollarSign size={16} /> Quick Price Edit (₹{selectedDishForMore.price})
            </button>

            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                onOpenEditDish(d);
              }}
              className="adm-btn adm-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <Edit size={16} /> Full Edit Dish Details
            </button>

            <button
              onClick={() => {
                const d = selectedDishForMore;
                setSelectedDishForMore(null);
                onDeleteDish(d.id);
              }}
              className="adm-btn adm-btn-danger"
              style={{ width: '100%', justifyContent: 'flex-start' }}
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
          <button onClick={handleQuickPriceSubmit} className="adm-btn adm-btn-primary" style={{ width: '100%' }}>
            Save New Price
          </button>
        )}
      >
        <form onSubmit={handleQuickPriceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>FULL PORTION PRICE (₹):</label>
            <input
              type="number"
              required
              value={quickPriceVal.price}
              onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}
            />
          </div>
        </form>
      </AdminDrawer>
    </div>
  );
}
