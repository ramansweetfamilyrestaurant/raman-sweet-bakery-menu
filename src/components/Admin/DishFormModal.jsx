import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { uploadImage, deleteImageApi } from '../../api/client';
import { getDishImageUrl } from '../../utils/imageHelper';

const resolveImageUrl = (url) => {
  if (!url || url === '/uploads/logo.jpg') return '';
  if (typeof url === 'string' && url.includes('.r2.dev/restaurants/')) {
    const idx = url.indexOf('restaurants/');
    return `/api/r2-proxy/${url.substring(idx)}`;
  }
  return url;
};

export default function DishFormModal({ dish, categories, token, modifiersEnabled = true, onSave, onClose }) {
  const [categoryId, setCategoryId] = useState(dish?.category_id || categories[0]?.id || '');
  const [name, setName] = useState(dish?.name || '');
  const [nameHi, setNameHi] = useState(dish?.name_hi || '');
  const [description, setDescription] = useState(dish?.description || '');
  const [descriptionHi, setDescriptionHi] = useState(dish?.description_hi || '');
  const [price, setPrice] = useState(dish?.price || '');
  const [priceHalf, setPriceHalf] = useState(dish?.price_half || '');
  const [hasHalf, setHasHalf] = useState(Boolean(dish?.price_half && modifiersEnabled !== false));
  const [portionHalfLabel, setPortionHalfLabel] = useState(dish?.portion_half_label || 'Half Portion');
  const [portionFullLabel, setPortionFullLabel] = useState(dish?.portion_full_label || 'Full Portion');
  
  const parseInitialModifiers = () => {
    if (!dish?.modifiers) return [];
    if (Array.isArray(dish.modifiers)) return dish.modifiers;
    try {
      const parsed = JSON.parse(dish.modifiers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const [modifiers, setModifiers] = useState(parseInitialModifiers);

  const [portion, setPortion] = useState(dish?.portion || '');
  const [badge, setBadge] = useState(dish?.badge || '');
  const [ingredients, setIngredients] = useState(dish?.ingredients || '');
  const [tasteProfile, setTasteProfile] = useState(dish?.taste_profile || '');
  const [type, setType] = useState(dish?.type || 'veg'); // 'veg', 'nonveg', 'egg'
  const [image, setImage] = useState(dish?.image ? resolveImageUrl(dish.image) : '');
  const [available, setAvailable] = useState(dish?.available !== false);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddModifier = () => {
    setModifiers([...modifiers, { name: '', price: '' }]);
  };
  const handleUpdateModifier = (idx, field, value) => {
    setModifiers(modifiers.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };
  const handleRemoveModifier = (idx) => {
    setModifiers(modifiers.filter((_, i) => i !== idx));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const oldTempImage = image;
      const res = await uploadImage(file, token, 'dishes');
      const resolvedRes = resolveImageUrl(res);
      setImage(resolvedRes);
      // Delete old temp image if replaced before saving
      if (oldTempImage && oldTempImage !== dish?.image) {
        deleteImageApi(oldTempImage, token).catch(() => {});
      }
    } catch (err) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price || !categoryId) {
      setError('Category, Name, and Full Price are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const cleanModifiers = (modifiersEnabled !== false) ? modifiers.filter(m => m.name && m.name.trim() !== '').map(m => ({
        name: m.name.trim(),
        price: Number(m.price) || 0
      })) : [];

      await onSave({
        category_id: Number(categoryId),
        name,
        name_hi: nameHi,
        description,
        description_hi: descriptionHi,
        image,
        price: Number(price),
        price_half: (modifiersEnabled !== false && hasHalf && priceHalf) ? Number(priceHalf) : null,
        portion,
        portion_half_label: (modifiersEnabled !== false && hasHalf) ? (portionHalfLabel || 'Half Portion') : '',
        portion_full_label: (modifiersEnabled !== false && hasHalf) ? (portionFullLabel || 'Full Portion') : '',
        modifiers: cleanModifiers,
        badge,
        ingredients,
        taste_profile: tasteProfile,
        type,
        available
      });
    } catch (err) {
      setError(err.message || 'Failed to save dish');
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3500,
      background: 'rgba(15, 44, 29, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          boxShadow: 'var(--shadow-lg)',
          border: '1.5px solid var(--accent-gold)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--primary-dark-green)',
          color: '#FFFFFF',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--accent-gold)'
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#FFFFFF' }}>
            {dish ? 'Edit Dish' : 'Add New Dish'}
          </h3>
          <button onClick={onClose} style={{ color: '#FFFFFF' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto' }}>
          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: '#991B1B',
              fontSize: '0.84rem',
              marginBottom: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Category *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                fontSize: '0.9rem'
              }}
            >
              <option value="" disabled>Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Food Type Selector (Veg / Non-Veg / Egg) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-dark-green)', marginBottom: '6px' }}>
              Food Preference / Dietary Type:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setType('veg')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'veg' ? '#DCFCE7' : '#F9FAFB',
                  color: type === 'veg' ? '#15803D' : '#4B5563',
                  border: type === 'veg' ? '2px solid #16A34A' : '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ width: '10px', height: '10px', border: '1.5px solid #16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', background: '#FFFFFF' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                </span>
                Pure Veg
              </button>

              <button
                type="button"
                onClick={() => setType('nonveg')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'nonveg' ? '#FEE2E2' : '#F9FAFB',
                  color: type === 'nonveg' ? '#B91C1C' : '#4B5563',
                  border: type === 'nonveg' ? '2px solid #DC2626' : '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ width: '10px', height: '10px', border: '1.5px solid #DC2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', background: '#FFFFFF' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                </span>
                Non-Veg
              </button>

              <button
                type="button"
                onClick={() => setType('egg')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'egg' ? '#FEF3C7' : '#F9FAFB',
                  color: type === 'egg' ? '#B45309' : '#4B5563',
                  border: type === 'egg' ? '2px solid #D97706' : '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ width: '10px', height: '10px', border: '1.5px solid #D97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', background: '#FFFFFF' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#D97706' }} />
                </span>
                Egg
              </button>
            </div>
          </div>

          {/* Name (EN + HI) & Badge */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Dish Name (English) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Shahi Paneer"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Dish Name (हिंदी)
              </label>
              <input
                type="text"
                value={nameHi}
                onChange={(e) => setNameHi(e.target.value)}
                placeholder="e.g. शाही पनीर"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Badge Tag
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="🔥 Bestseller"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.9rem'
                }}
              />
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setBadge(badge === 'Must Try' ? '' : 'Must Try')}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: badge === 'Must Try' ? '#FEF3C7' : '#F3F4F6',
                    color: badge === 'Must Try' ? '#D97706' : '#374151',
                    border: badge === 'Must Try' ? '1px solid #F59E0B' : '1px solid #D1D5DB'
                  }}
                >
                  ⭐ Must Try
                </button>
                <button
                  type="button"
                  onClick={() => setBadge(badge === 'Bestseller' ? '' : 'Bestseller')}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: badge === 'Bestseller' ? '#FFFBEB' : '#F3F4F6',
                    color: badge === 'Bestseller' ? '#B45309' : '#374151',
                    border: badge === 'Bestseller' ? '1px solid #F59E0B' : '1px solid #D1D5DB'
                  }}
                >
                  🔥 Bestseller
                </button>
                <button
                  type="button"
                  onClick={() => setBadge(badge === 'Special' ? '' : 'Special')}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    background: badge === 'Special' ? '#E0E7FF' : '#F3F4F6',
                    color: badge === 'Special' ? '#4338CA' : '#374151',
                    border: badge === 'Special' ? '1px solid #818CF8' : '1px solid #D1D5DB'
                  }}
                >
                  ✨ Special
                </button>
              </div>
            </div>
          </div>

          {/* Pricing: Full & Optional Half Price */}
          <div style={{
            background: modifiersEnabled !== false ? 'var(--bg-cream-primary)' : '#F8FAFC',
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)',
            border: modifiersEnabled !== false ? '1px solid rgba(197, 160, 89, 0.3)' : '1px solid #E2E8F0',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: modifiersEnabled !== false ? 'var(--primary-dark-green)' : '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {modifiersEnabled !== false ? '⚡ Portion Pricing & Modifiers' : '🔒 Portion Pricing & Modifiers'}
              </span>
              {modifiersEnabled !== false ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', color: 'var(--primary-dark-green)' }}>
                  <input
                    type="checkbox"
                    checked={hasHalf}
                    onChange={(e) => setHasHalf(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#0A2315', cursor: 'pointer' }}
                  />
                  Enable Half / Full Portion
                </label>
              ) : (
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '4px 10px', borderRadius: '6px', border: '1px solid #FCA5A5' }}>
                  🔒 DISABLED in SuperAdmin Plan
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (hasHalf && modifiersEnabled !== false) ? '1fr 1fr' : '1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  {(hasHalf && modifiersEnabled !== false) ? 'Full Portion Price (₹) *' : 'Price (₹) *'}
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="260"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(197, 160, 89, 0.4)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {(hasHalf && modifiersEnabled !== false) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Half Portion Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required={hasHalf}
                    value={priceHalf}
                    onChange={(e) => setPriceHalf(e.target.value)}
                    placeholder="160"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(197, 160, 89, 0.4)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              )}
            </div>

            {(hasHalf && modifiersEnabled !== false) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>
                    Full Portion Label
                  </label>
                  <input
                    type="text"
                    value={portionFullLabel}
                    onChange={(e) => setPortionFullLabel(e.target.value)}
                    placeholder="e.g. Full Portion / 500g"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(197, 160, 89, 0.3)',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#4B5563', marginBottom: '4px' }}>
                    Half Portion Label
                  </label>
                  <input
                    type="text"
                    value={portionHalfLabel}
                    onChange={(e) => setPortionHalfLabel(e.target.value)}
                    placeholder="e.g. Half Portion / 250g"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(197, 160, 89, 0.3)',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Custom Add-ons & Modifiers (e.g. Extra Cheese, Mayo Dip, Butter) */}
            {modifiersEnabled !== false && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed rgba(197, 160, 89, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-dark-green)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    ➕ Custom Add-on Modifiers (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddModifier}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      background: '#0A2315',
                      color: '#DFBA67',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      border: '1px solid #DFBA67',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Topping / Add-on
                  </button>
                </div>

                {modifiers.length === 0 ? (
                  <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: 0, fontStyle: 'italic' }}>
                    Click "+ Add Topping / Add-on" to create extra options (e.g. Extra Cheese +₹30, Dip +₹15, Butter +₹20).
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modifiers.map((mod, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="e.g. Extra Cheese / Dip / Butter"
                          value={mod.name}
                          onChange={(e) => handleUpdateModifier(idx, 'name', e.target.value)}
                          style={{
                            flex: 2,
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(197, 160, 89, 0.4)',
                            fontSize: '0.82rem'
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-dark-green)' }}>+₹</span>
                          <input
                            type="number"
                            placeholder="30"
                            value={mod.price}
                            onChange={(e) => handleUpdateModifier(idx, 'price', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(197, 160, 89, 0.4)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveModifier(idx)}
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FCA5A5',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 800
                          }}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description (EN + HI) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Description (English)
              </label>
              <textarea
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fresh paneer cooked in velvety tomato gravy..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Description (हिंदी - Optional)
              </label>
              <textarea
                rows="2"
                value={descriptionHi}
                onChange={(e) => setDescriptionHi(e.target.value)}
                placeholder="ताज़ा पनीर मखमली टमाटर ग्रेवी में पकाया गया..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          {/* Ingredients & Portion Size text */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Ingredients (comma separated)
              </label>
              <input
                type="text"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Paneer, Cashew, Butter"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Portion Size Label
              </label>
              <input
                type="text"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                placeholder="Serves 1-2 • 350ml"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  fontSize: '0.82rem'
                }}
              />
            </div>
          </div>

          {/* Dish Image */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Dish Image
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <img
                src={getDishImageUrl(image)}
                alt="Preview"
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  border: '1px solid var(--accent-gold)'
                }}
                onError={(e) => {
                  e.currentTarget.src = '/images/default-dish.webp';
                }}
              />
              <label style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-cream-secondary)',
                border: '1px solid var(--accent-gold)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 600
              }}>
                <Upload size={14} />
                {uploading ? 'Uploading...' : 'Upload File'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="Or paste image URL"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                fontSize: '0.8rem'
              }}
            />
          </div>

          {/* Availability Toggle */}
          <div style={{
            background: 'var(--bg-cream-primary)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
              Item Available on Menu
            </span>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary-dark-green)', cursor: 'pointer' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--text-muted)',
                fontSize: '0.85rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              style={{
                padding: '10px 26px',
                borderRadius: 'var(--radius-pill)',
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                border: '1.5px solid #D4AF37',
                fontSize: '0.88rem',
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(10, 35, 21, 0.35)',
                cursor: (saving || uploading) ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : (dish ? '✓ Update Dish' : '✓ Save Dish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
