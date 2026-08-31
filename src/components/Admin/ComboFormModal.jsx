import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, Search, Upload, ShoppingBag, ArrowUpDown, Sparkles, AlertCircle, Utensils, Check } from 'lucide-react';
import { uploadImage } from '../../api/client';

export default function ComboFormModal({ combo, dishes, token, onSave, onClose }) {
  const isEdit = !!combo;
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'dishes'

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
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit && combo) {
      setName(combo.name || '');
      setDescription(combo.description || '');
      setPrice(combo.price !== undefined && combo.price !== null ? combo.price : '');
      setImage(combo.image || '');
      setBadge(combo.badge || '');
      setSortOrder(combo.sort_order || 0);
      try {
        const items = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []);
        setSelectedItems(Array.isArray(items) ? items : []);
      } catch { setSelectedItems([]); }
    }
  }, [combo, isEdit]);

  const availableDishes = (dishes || []).filter(d => {
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

  const originalTotal = selectedItems.reduce((sum, si) => sum + ((Number(si.original_price) || 0) * (si.qty || 1)), 0);
  const savings = (price !== '' && price !== null) ? originalTotal - Number(price) : 0;

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file, token, 'combos');
      setImage(url);
    } catch (err) {
      setError('Image upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!name.trim()) {
      setActiveTab('info');
      setError('Combo / Thali name is required');
      return;
    }
    if (price === '' || price === null || Number(price) < 0) {
      setActiveTab('info');
      setError('Enter a valid combo price');
      return;
    }
    if (selectedItems.length < 2) {
      setActiveTab('dishes');
      setError('Add at least 2 dishes to create a combo thali');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        image,
        items: selectedItems,
        badge,
        sort_order: Number(sortOrder)
      });
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
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
      background: 'rgba(10, 25, 16, 0.70)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3500,
      padding: '12px',
      boxSizing: 'border-box'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className="combo-modal-container"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes modalSlideIn {
            from { transform: translateY(16px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .combo-tab-btn {
            flex: 1;
            padding: 8px 10px;
            font-size: 0.76rem;
            font-weight: 700;
            border: none;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justifyContent: center;
            gap: 5px;
            transition: all 0.2s ease;
            border-radius: 8px;
            color: #64748B;
            white-space: nowrap;
          }
          .combo-tab-btn.active {
            background: #FFFFFF;
            color: #0A2315;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            font-weight: 800;
          }
          @media (max-width: 600px) {
            .combo-modal-container {
              max-width: 100% !important;
              border-radius: 16px !important;
              max-height: 94vh !important;
            }
            .combo-modal-body-form {
              padding: 12px 14px !important;
            }
            .combo-modal-body-form input,
            .combo-modal-body-form select,
            .combo-modal-body-form textarea {
              font-size: 16px !important;
              padding: 9px 11px !important;
            }
          }
        `}} />

        {/* Header */}
        <div style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={16} color="#D4AF37" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, letterSpacing: '0.2px' }}>
              {isEdit ? 'Edit Value Combo' : 'Create Value Combo'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            type="button"
            style={{ 
              background: 'rgba(255, 255, 255, 0.12)', 
              border: 'none', 
              color: '#FFFFFF', 
              cursor: 'pointer',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div style={{
          background: '#F1F5F9',
          padding: '4px',
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid #E2E8F0'
        }}>
          <button
            type="button"
            className={`combo-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <ShoppingBag size={13} color={activeTab === 'info' ? '#0A2315' : '#64748B'} />
            <span>1. Combo Info & Price</span>
          </button>

          <button
            type="button"
            className={`combo-tab-btn ${activeTab === 'dishes' ? 'active' : ''}`}
            onClick={() => setActiveTab('dishes')}
          >
            <Utensils size={13} color={activeTab === 'dishes' ? '#0A2315' : '#64748B'} />
            <span>2. Included Dishes ({selectedItems.length})</span>
            {selectedItems.length >= 2 && (
              <Check size={12} color="#16A34A" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="combo-modal-body-form" style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: COMBO INFO */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  Combo / Thali Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Special Maharaja Thali, Family Pack"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.86rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#0F172A'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                  onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                />
              </div>

              {/* Price + Badge Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                    Combo Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="199"
                    style={{
                      width: '100%',
                      padding: '9px 11px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.90rem',
                      fontWeight: 800,
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#16A34A'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                    Highlight Badge
                  </label>
                  <select
                    value={badge}
                    onChange={e => setBadge(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 11px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {badgeOptions.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Live Savings Banner */}
              {selectedItems.length > 0 && price !== '' && (
                <div style={{
                  background: savings > 0 ? '#F0FDF4' : '#F8FAFC',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  border: savings > 0 ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ color: '#64748B', fontSize: '0.74rem', fontWeight: 600 }}>
                    Items Total: <span style={{ textDecoration: 'line-through', color: '#EF4444', fontWeight: 700 }}>₹{originalTotal}</span>
                  </span>
                  <span style={{ color: savings > 0 ? '#15803D' : '#D97706', fontWeight: 800, fontSize: '0.80rem' }}>
                    {savings > 0 ? `🎉 Save ₹${savings}!` : savings < 0 ? '⚠️ Costs more' : '➡️ Same price'}
                  </span>
                </div>
              )}

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Complete meal with 2 Butter Naan, Paneer Gravy, Dal Fry, Jeera Rice & Gulab Jamun."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                    color: '#0F172A'
                  }}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  Combo Image (Optional)
                </label>
                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  alignItems: 'center',
                  background: '#F8FAFC',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px dashed #CBD5E1'
                }}>
                  {image ? (
                    <img src={image} alt="combo" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E2E8F0' }} />
                  ) : (
                    <img src="/images/default-combo.webp?v=3" alt="default combo" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E2E8F0' }} />
                  )}
                  
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <label style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: '#0A2315',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Upload size={11} color="#D4AF37" />
                      <span>{uploading ? 'Uploading...' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>

                    {image && (
                      <button
                        type="button"
                        onClick={() => setImage('')}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          background: '#FEE2E2',
                          border: 'none',
                          color: '#991B1B',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Next Tab Hint */}
              <button
                type="button"
                onClick={() => setActiveTab('dishes')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#0A2315',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '4px'
                }}
              >
                <span>🍱 Next: Select Included Dishes ({selectedItems.length} added)</span>
                <span>➔</span>
              </button>
            </div>
          )}

          {/* TAB 2: INCLUDED DISHES PICKER */}
          {activeTab === 'dishes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Selected Items List */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
                  Selected Items in Combo ({selectedItems.length})
                </label>
                {selectedItems.length < 2 && (
                  <span style={{ fontSize: '0.68rem', color: '#DC2626', fontWeight: 700 }}>
                    ⚠️ Need min 2 items
                  </span>
                )}
              </div>

              {selectedItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '140px', overflowY: 'auto' }}>
                  {selectedItems.map((si, idx) => (
                    <div key={`${si.dish_id}-${si.portion}-${idx}`} style={{
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid #CBD5E1'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: '#0F172A', fontSize: '0.78rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{si.dish_name}</span>
                        <span style={{ color: '#64748B', fontSize: '0.68rem' }}>
                          {si.portion === 'half' ? 'Half' : 'Full'} • ₹{si.original_price}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button type="button" onClick={() => handleQtyChange(si.dish_id, si.portion, -1)} style={{
                          width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #CBD5E1',
                          background: '#FFFFFF', color: '#475569', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}><Minus size={10} /></button>
                        <span style={{ color: '#0F172A', fontWeight: 800, fontSize: '0.80rem', minWidth: '16px', textAlign: 'center' }}>{si.qty}</span>
                        <button type="button" onClick={() => handleQtyChange(si.dish_id, si.portion, 1)} style={{
                          width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #CBD5E1',
                          background: '#FFFFFF', color: '#475569', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}><Plus size={10} /></button>
                        <button type="button" onClick={() => handleRemoveDish(si.dish_id, si.portion)} style={{
                          width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #FEE2E2',
                          background: '#FFF5F5', color: '#EF4444', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', textAlign: 'center', fontSize: '0.74rem', color: '#64748B', border: '1px dashed #CBD5E1' }}>
                  No dishes added to combo yet. Tap below to add items.
                </div>
              )}

              {/* Search & Dish Picker */}
              <div style={{ position: 'relative', marginTop: '2px' }}>
                <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input
                  value={dishSearch}
                  onChange={e => setDishSearch(e.target.value)}
                  placeholder="Search dishes to add..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 28px',
                    borderRadius: '7px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.78rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#0F172A'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                  onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                />
              </div>

              <div style={{
                maxHeight: '140px',
                overflowY: 'auto',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#F8FAFC'
              }}>
                {availableDishes.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#64748B', fontSize: '0.74rem' }}>
                    {dishSearch ? 'No matching dishes found' : 'All available dishes added'}
                  </div>
                ) : availableDishes.map(dish => (
                  <div key={dish.id} style={{
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #F1F5F9',
                    background: '#FFFFFF'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: '#0F172A', fontSize: '0.76rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.name}</span>
                      <span style={{ color: '#64748B', fontSize: '0.68rem' }}>₹{dish.price}{dish.price_half ? ` / ₹${dish.price_half} Half` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button type="button" onClick={() => handleAddDish(dish, 'full')} style={{
                        padding: '3px 7px', borderRadius: '5px', border: '1px solid #BBF7D0',
                        background: '#F0FDF4', color: '#16A34A', cursor: 'pointer',
                        fontSize: '0.68rem', fontWeight: 700
                      }}>+ Full</button>
                      {dish.price_half && (
                        <button type="button" onClick={() => handleAddDish(dish, 'half')} style={{
                          padding: '3px 7px', borderRadius: '5px', border: '1px solid #FDE68A',
                          background: '#FFFBEB', color: '#D97706', cursor: 'pointer',
                          fontSize: '0.68rem', fontWeight: 700
                        }}>+ Half</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          gap: '8px',
          background: '#FFFFFF'
        }}>
          <button 
            type="button"
            onClick={onClose} 
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit} 
            disabled={saving} 
            style={{
              flex: 1,
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #D4AF37',
              background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.80rem',
              boxShadow: '0 2px 8px rgba(10, 35, 21, 0.2)',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : isEdit ? '✓ Update Combo' : '✓ Create Combo'}
          </button>
        </div>
      </div>
    </div>
  );
}
