import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, Search, Upload, ShoppingBag, ArrowUpDown, HelpCircle } from 'lucide-react';
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
      const url = await uploadImage(file, token, 'combos');
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
    { value: '', label: 'No Badge' },
    { value: 'Bestseller', label: '🔥 Bestseller' },
    { value: 'New', label: '✨ New Pack' },
    { value: 'Value Deal', label: '💰 Value Deal' },
    { value: 'Family Pack', label: '👪 Family Pack' }
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 35, 21, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      boxSizing: 'border-box'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes modalSlideIn {
            from { transform: translateY(12px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}} />

        {/* Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={18} color="#D4AF37" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
              {isEdit ? 'Edit Value Combo' : 'Create Value Combo'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              border: 'none', 
              color: '#FFFFFF', 
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          
          {/* Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Combo / Thali Name *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Special Thali, Family Combo, Student Meal"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
                color: '#0F172A'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0A2315';
                e.target.style.boxShadow = '0 0 0 3px rgba(10, 35, 21, 0.08)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Complete meal with roti, dal, rice and sweet"
              rows={2}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.86rem',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
                color: '#0F172A'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0A2315';
                e.target.style.boxShadow = '0 0 0 3px rgba(10, 35, 21, 0.08)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Price + Badge Row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Combo Price ₹ *
              </label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="199"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.94rem',
                  fontWeight: 800,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                  color: '#16A34A'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0A2315';
                  e.target.style.boxShadow = '0 0 0 3px rgba(10, 35, 21, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Badge Icon
              </label>
              <select
                value={badge}
                onChange={e => setBadge(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.86rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                {badgeOptions.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          {/* Savings Live Tracker */}
          {selectedItems.length > 0 && price && (
            <div style={{
              background: savings > 0 ? 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)' : '#F8FAFC',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '14px',
              border: savings > 0 ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: '#64748B', fontSize: '0.80rem', fontWeight: 600 }}>
                Original Total: <span style={{ textDecoration: 'line-through', color: '#EF4444', fontWeight: 700 }}>₹{originalTotal}</span>
              </span>
              <span style={{
                color: savings > 0 ? '#15803D' : '#D97706',
                fontWeight: 800,
                fontSize: '0.86rem'
              }}>
                {savings > 0 ? `🎉 Save ₹${savings}!` : savings < 0 ? '⚠️ Combo costs more' : '➡️ Same as individual items'}
              </span>
            </div>
          )}

          {/* Image Upload */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Combo / Thali Image
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              background: '#F8FAFC',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px dashed #E2E8F0'
            }}>
              {image ? (
                <img src={image} alt="combo" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', border: '1.5px solid #E2E8F0' }} />
              ) : (
                <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🍱</div>
              )}
              
              <div style={{ display: 'flex', gap: '6px' }}>
                <label style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: '#0A2315',
                  color: '#FFFFFF',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 5px rgba(10, 35, 21, 0.15)',
                  transition: 'background-color 0.2s'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#143A24'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0A2315'}
                >
                  <Upload size={13} color="#D4AF37" />
                  <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>

                {image && (
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      background: '#FEE2E2',
                      border: '1px solid #FCA5A5',
                      color: '#991B1B',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} color="#DC2626" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Selected Items */}
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>
            Included Items ({selectedItems.length}) *
          </label>

          {selectedItems.length > 0 ? (
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedItems.map((si, idx) => (
                <div key={`${si.dish_id}-${si.portion}-${idx}`} style={{
                  background: '#F8FAFC',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{si.dish_name}</span>
                    <span style={{ color: '#64748B', fontSize: '0.70rem', fontWeight: 600 }}>
                      ({si.portion === 'half' ? 'Half Portion' : 'Full Portion'}) • ₹{si.original_price}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button type="button" onClick={() => handleQtyChange(si.dish_id, si.portion, -1)} style={{
                      width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #E2E8F0',
                      background: '#FFFFFF', color: '#475569', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><Minus size={11} /></button>
                    <span style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.86rem', minWidth: '18px', textAlign: 'center' }}>{si.qty}</span>
                    <button type="button" onClick={() => handleQtyChange(si.dish_id, si.portion, 1)} style={{
                      width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #E2E8F0',
                      background: '#FFFFFF', color: '#475569', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><Plus size={11} /></button>
                    <button type="button" onClick={() => handleRemoveDish(si.dish_id, si.portion)} style={{
                      width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #FEE2E2',
                      background: '#FFF5F5', color: '#EF4444', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', textAlign: 'center', fontSize: '0.78rem', color: '#64748B', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
              No dishes added to combo yet. Please select below.
            </div>
          )}

          {/* Dish Picker */}
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
            ➕ Add Dishes to Combo
          </label>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              value={dishSearch}
              onChange={e => setDishSearch(e.target.value)}
              placeholder="Search dishes..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: '8px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.80rem',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#0F172A'
              }}
              onFocus={(e) => e.target.style.borderColor = '#0A2315'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <div style={{
            maxHeight: '160px',
            overflowY: 'auto',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            background: '#F8FAFC'
          }}>
            {availableDishes.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '0.78rem' }}>
                {dishSearch ? 'No matching dishes found' : 'All dishes added to list'}
              </div>
            ) : availableDishes.map(dish => (
              <div key={dish.id} style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #F1F5F9',
                background: '#FFFFFF'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#0F172A', fontSize: '0.80rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.name}</span>
                  <span style={{ color: '#64748B', fontSize: '0.70rem', fontWeight: 600 }}>₹{dish.price}{dish.price_half ? ` / ₹${dish.price_half} Half` : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button type="button" onClick={() => handleAddDish(dish, 'full')} style={{
                    padding: '4px 8px', borderRadius: '6px', border: '1px solid #BBF7D0',
                    background: '#F0FDF4', color: '#16A34A', cursor: 'pointer',
                    fontSize: '0.70rem', fontWeight: 700
                  }}>+ Full</button>
                  {dish.price_half && (
                    <button type="button" onClick={() => handleAddDish(dish, 'half')} style={{
                      padding: '4px 8px', borderRadius: '6px', border: '1px solid #FDE68A',
                      background: '#FFFBEB', color: '#D97706', cursor: 'pointer',
                      fontSize: '0.70rem', fontWeight: 700
                    }}>+ Half</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          gap: '10px',
          background: '#F8FAFC'
        }}>
          <button 
            type="button"
            onClick={onClose} 
            style={{
              flex: 1,
              padding: '10px 18px',
              borderRadius: '100px',
              border: '1.5px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit} 
            disabled={saving} 
            style={{
              flex: 2,
              padding: '10px 24px',
              borderRadius: '100px',
              border: '1.5px solid #D4AF37',
              background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.84rem',
              boxShadow: '0 4px 12px rgba(10, 35, 21, 0.2)',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {saving ? '⏳ Saving...' : isEdit ? '✓ Update Combo' : '✓ Create Combo'}
          </button>
        </div>
      </div>
    </div>
  );
}
