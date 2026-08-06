import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, Search, Upload, ShoppingBag } from 'lucide-react';
import { uploadImage } from '../../api/client';

export default function ComboFormModal({ combo, dishes, token, onSave, onClose }) {
  const isEdit = !!combo;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [badge, setBadge] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [selectedItems, setSelectedItems] = useState([]);
  const [dishSearch, setDishSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && combo) {
      setName(combo.name || '');
      setDescription(combo.description || '');
      setPrice(combo.price || '');
      setImage(combo.image || '');
      setBadge(combo.badge || '');
      setSortOrder(combo.sort_order || 0);
      try {
        const items = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []);
        setSelectedItems(items);
      } catch { setSelectedItems([]); }
    }
  }, [combo, isEdit]);

  const availableDishes = (dishes || []).filter(d => {
    const alreadyAdded = selectedItems.some(si => si.dish_id === d.id && si.portion === 'full');
    const matchesSearch = !dishSearch || d.name.toLowerCase().includes(dishSearch.toLowerCase());
    return matchesSearch && d.available !== 0 && d.available !== false;
  });

  const handleAddDish = (dish, portion = 'full') => {
    const existing = selectedItems.find(si => si.dish_id === dish.id && si.portion === portion);
    if (existing) {
      setSelectedItems(prev => prev.map(si =>
        (si.dish_id === dish.id && si.portion === portion) ? { ...si, qty: si.qty + 1 } : si
      ));
    } else {
      const itemPrice = portion === 'half' && dish.price_half ? dish.price_half : dish.price;
      setSelectedItems(prev => [...prev, {
        dish_id: dish.id,
        dish_name: dish.name,
        qty: 1,
        portion,
        original_price: itemPrice
      }]);
    }
  };

  const handleRemoveDish = (dishId, portion) => {
    setSelectedItems(prev => prev.filter(si => !(si.dish_id === dishId && si.portion === portion)));
  };

  const handleQtyChange = (dishId, portion, delta) => {
    setSelectedItems(prev => prev.map(si => {
      if (si.dish_id === dishId && si.portion === portion) {
        const newQty = Math.max(1, si.qty + delta);
        return { ...si, qty: newQty };
      }
      return si;
    }));
  };

  const originalTotal = selectedItems.reduce((sum, si) => sum + (si.original_price * si.qty), 0);
  const savings = price ? originalTotal - Number(price) : 0;

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, token);
      setImage(url);
    } catch (err) {
      alert('Image upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return alert('Combo name is required');
    if (!price || Number(price) <= 0) return alert('Enter a valid combo price');
    if (selectedItems.length < 2) return alert('Add at least 2 items to create a combo');

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        image,
        items: selectedItems,
        badge,
        sort_order: sortOrder
      });
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  };

  const badgeOptions = [
    { value: '', label: 'None' },
    { value: 'Bestseller', label: '⭐ Bestseller' },
    { value: 'New', label: '🆕 New' },
    { value: 'Value Deal', label: '💰 Value Deal' },
    { value: 'Family Pack', label: '👨‍👩‍👧‍👦 Family' }
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '20px', width: '100%', maxWidth: '520px',
        maxHeight: '90vh', overflow: 'hidden',
        border: '1px solid rgba(255,215,0,0.2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid rgba(255,215,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, transparent 100%)'
        }}>
          <h2 style={{ margin: 0, color: '#FFD700', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} /> {isEdit ? '✏️ Edit Combo' : '🛒 Create New Combo'}
          </h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: '34px', height: '34px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}><X size={18} /></button>
        </div>

        {/* Body - Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Name */}
          <label style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Combo / Thali Name *</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Special Thali, Family Combo, Student Meal"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,215,0,0.25)', background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontSize: '0.9rem', marginBottom: '12px', outline: 'none',
              boxSizing: 'border-box'
            }}
          />

          {/* Description */}
          <label style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Description</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Complete meal with roti, dal, rice and sweet"
            rows={2}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,215,0,0.25)', background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontSize: '0.85rem', marginBottom: '12px', outline: 'none',
              resize: 'none', boxSizing: 'border-box'
            }}
          />

          {/* Price + Badge Row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Combo Price ₹ *</label>
              <input
                type="number" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="199"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid rgba(255,215,0,0.25)', background: 'rgba(255,255,255,0.06)',
                  color: '#4ADE80', fontSize: '1rem', fontWeight: 800, outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Badge</label>
              <select
                value={badge} onChange={e => setBadge(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid rgba(255,215,0,0.25)', background: 'rgba(30,30,50,0.9)',
                  color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
                }}
              >
                {badgeOptions.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          {/* Savings Indicator */}
          {selectedItems.length > 0 && price && (
            <div style={{
              background: savings > 0 ? 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,197,94,0.08))' : 'rgba(255,255,255,0.05)',
              borderRadius: '12px', padding: '10px 14px', marginBottom: '14px',
              border: savings > 0 ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>
                Original: <span style={{ textDecoration: 'line-through', color: '#EF4444' }}>₹{originalTotal}</span>
              </span>
              <span style={{
                color: savings > 0 ? '#4ADE80' : '#F59E0B',
                fontWeight: 800, fontSize: '0.9rem'
              }}>
                {savings > 0 ? `🎉 Save ₹${savings}!` : savings < 0 ? '⚠️ Combo costs more' : '➡️ Same price'}
              </span>
            </div>
          )}

          {/* Image Upload */}
          <label style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Combo Image</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
            {image && (
              <img src={image} alt="combo" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(255,215,0,0.3)' }} />
            )}
            <label style={{
              padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
              background: 'rgba(255,215,0,0.12)', color: '#FFD700', fontSize: '0.82rem',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
              border: '1px solid rgba(255,215,0,0.25)'
            }}>
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Image'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Selected Items */}
          <label style={{ color: '#FFD700', fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
            Included Items ({selectedItems.length}) *
          </label>

          {selectedItems.length > 0 && (
            <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedItems.map((si, idx) => (
                <div key={`${si.dish_id}-${si.portion}-${idx}`} style={{
                  background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid rgba(255,215,0,0.12)'
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#fff', fontSize: '0.84rem', fontWeight: 700 }}>{si.dish_name}</span>
                    <span style={{ color: '#9CA3AF', fontSize: '0.72rem', marginLeft: '6px' }}>
                      ({si.portion === 'half' ? 'Half' : 'Full'}) • ₹{si.original_price}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => handleQtyChange(si.dish_id, si.portion, -1)} style={{
                      width: '26px', height: '26px', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.3)',
                      background: 'rgba(255,215,0,0.1)', color: '#FFD700', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><Minus size={12} /></button>
                    <span style={{ color: '#FFD700', fontWeight: 800, fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{si.qty}</span>
                    <button onClick={() => handleQtyChange(si.dish_id, si.portion, 1)} style={{
                      width: '26px', height: '26px', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.3)',
                      background: 'rgba(255,215,0,0.1)', color: '#FFD700', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><Plus size={12} /></button>
                    <button onClick={() => handleRemoveDish(si.dish_id, si.portion)} style={{
                      width: '26px', height: '26px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dish Picker */}
          <label style={{ color: '#9CA3AF', fontSize: '0.76rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
            ➕ Add Dishes to Combo
          </label>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
            <input
              value={dishSearch} onChange={e => setDishSearch(e.target.value)}
              placeholder="Search dishes..."
              style={{
                width: '100%', padding: '9px 14px 9px 34px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                color: '#fff', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{
            maxHeight: '200px', overflowY: 'auto', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)'
          }}>
            {availableDishes.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '0.82rem' }}>
                {dishSearch ? 'No dishes found' : 'All dishes are already added'}
              </div>
            ) : availableDishes.map(dish => (
              <div key={dish.id} style={{
                padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                transition: 'background 0.15s'
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#E5E7EB', fontSize: '0.82rem', fontWeight: 600 }}>{dish.name}</span>
                  <span style={{ color: '#6B7280', fontSize: '0.72rem', marginLeft: '6px' }}>₹{dish.price}{dish.price_half ? ` / ₹${dish.price_half} Half` : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleAddDish(dish, 'full')} style={{
                    padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.3)',
                    background: 'rgba(74,222,128,0.1)', color: '#4ADE80', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 700
                  }}>+ Full</button>
                  {dish.price_half && (
                    <button onClick={() => handleAddDish(dish, 'half')} style={{
                      padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.3)',
                      background: 'rgba(251,191,36,0.1)', color: '#FBBF24', cursor: 'pointer',
                      fontSize: '0.72rem', fontWeight: 700
                    }}>+ Half</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid rgba(255,215,0,0.15)',
          display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)'
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#9CA3AF', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer'
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
            background: saving ? '#6B7280' : 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
            color: '#0A0A0A', fontWeight: 800, fontSize: '0.92rem', cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(255,215,0,0.35)'
          }}>
            {saving ? '⏳ Saving...' : isEdit ? '✅ Update Combo' : '🛒 Create Combo'}
          </button>
        </div>
      </div>
    </div>
  );
}
