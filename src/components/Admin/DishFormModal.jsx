import React, { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Sparkles, AlertCircle, Trash2, ArrowUpDown, Plus, Minus, Tag, Globe, Sliders } from 'lucide-react';
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

export default function DishFormModal({ dish, categories, token, modifiersEnabled = true, currencySymbol = '₹', onSave, onClose }) {
  const [categoryId, setCategoryId] = useState(dish?.category_id || categories?.[0]?.id || '');

  useEffect(() => {
    if (!categoryId && Array.isArray(categories) && categories.length > 0) {
      setCategoryId(dish?.category_id || categories[0].id);
    }
  }, [categories, dish, categoryId]);

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
  const [available, setAvailable] = useState(
    dish
      ? (dish.available !== false && dish.available !== 0 && dish.is_available !== false)
      : true
  );
  
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

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB.');
      return;
    }

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
    const trimmedName = name.trim();
    if (!trimmedName || !price || !categoryId) {
      setError('Category, Name, and Full Price are required.');
      return;
    }

    if (isNaN(Number(price)) || Number(price) < 0) {
      setError('Full price must be a valid non-negative number.');
      return;
    }

    if (hasHalf && modifiersEnabled !== false) {
      if (!priceHalf) {
        setError('Half price is required when half portion is enabled.');
        return;
      }
      if (isNaN(Number(priceHalf)) || Number(priceHalf) < 0) {
        setError('Half price must be a valid non-negative number.');
        return;
      }
      if (Number(priceHalf) > Number(price)) {
        setError('Half price cannot be greater than full price.');
        return;
      }
    }

    const hasInvalidModifier = modifiers.some(m => m.name && m.name.trim() !== '' && (isNaN(Number(m.price)) || Number(m.price) < 0));
    if (hasInvalidModifier) {
      setError('Add-on prices must be valid non-negative numbers.');
      return;
    }

    if (image && !image.startsWith('http://') && !image.startsWith('https://') && !image.startsWith('/api/') && !image.startsWith('/uploads/')) {
      setError('Please enter a valid image URL (must start with http://, https://, or local paths).');
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
        name: trimmedName,
        name_hi: nameHi.trim(),
        description: description.trim(),
        description_hi: descriptionHi.trim(),
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
      background: 'rgba(15, 35, 21, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '560px',
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
            <Sparkles size={18} color="#D4AF37" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
              {dish ? 'Edit Dish details' : 'Add New Dish to Menu'}
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
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '22px 24px', overflowY: 'auto', margin: 0 }}>
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.80rem',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Category *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#FFFFFF',
                color: '#0F172A',
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {(!categories || categories.length === 0) && (
              <div style={{ fontSize: '0.74rem', color: '#DC2626', marginTop: '6px', fontWeight: 600 }}>
                ⚠️ No categories available. Please create a category before adding a dish.
              </div>
            )}
          </div>

          {/* Food Type Selector (Veg / Non-Veg / Egg) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Dietary Preference *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setType('veg')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'veg' ? '#F0FDF4' : '#FFFFFF',
                  color: type === 'veg' ? '#16A34A' : '#475569',
                  border: type === 'veg' ? '1.5px solid #16A34A' : '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                <span>Pure Veg</span>
              </button>

              <button
                type="button"
                onClick={() => setType('nonveg')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'nonveg' ? '#FDF2F2' : '#FFFFFF',
                  color: type === 'nonveg' ? '#DC2626' : '#475569',
                  border: type === 'nonveg' ? '1.5px solid #DC2626' : '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                <span>Non-Veg</span>
              </button>

              <button
                type="button"
                onClick={() => setType('egg')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: type === 'egg' ? '#FFFBEB' : '#FFFFFF',
                  color: type === 'egg' ? '#D97706' : '#475569',
                  border: type === 'egg' ? '1.5px solid #D97706' : '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }} />
                <span>Egg</span>
              </button>
            </div>
          </div>

          {/* Name & Hindi Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Dish Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Shahi Paneer"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                <Globe size={12} color="#64748B" />
                Hindi Name
              </label>
              <input
                type="text"
                value={nameHi}
                onChange={(e) => setNameHi(e.target.value)}
                placeholder="उदा. शाही पनीर"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A'
                }}
                onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>
          </div>

          {/* Badge Tag */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              <Tag size={12} color="#64748B" />
              Special Tag / Badge
            </label>
            <input
              type="text"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Select quick tag or type custom tag"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#0F172A'
              }}
              onFocus={(e) => e.target.style.borderColor = '#0A2315'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {[
                { label: '🔥 Must Try', val: 'Must Try' },
                { label: '⭐ Bestseller', val: 'Bestseller' },
                { label: '✨ Special', val: 'Special' }
              ].map(badgeOpt => {
                const isActiveBadge = badge === badgeOpt.val;
                return (
                  <button
                    key={badgeOpt.val}
                    type="button"
                    onClick={() => setBadge(isActiveBadge ? '' : badgeOpt.val)}
                    style={{
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '100px',
                      background: isActiveBadge ? '#FDF2F2' : '#F8FAFC',
                      color: isActiveBadge ? '#DC2626' : '#475569',
                      border: `1px solid ${isActiveBadge ? '#FCA5A5' : '#E2E8F0'}`,
                      cursor: 'pointer'
                    }}
                  >
                    {badgeOpt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pricing & Custom Portions */}
          <div style={{
            background: '#FDFBF7',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid #DFBA67',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0A2315', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sliders size={13} color="#D4AF37" />
                Portion Pricing & Portions
              </span>
              
              {modifiersEnabled !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    id="hasHalfPortion"
                    checked={hasHalf}
                    onChange={(e) => setHasHalf(e.target.checked)}
                    style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0A2315' }}
                  />
                  <label htmlFor="hasHalfPortion" style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                    Enable Half Portion
                  </label>
                </div>
              )}
            </div>

            {/* Pricing fields */}
            <div style={{ display: 'grid', gridTemplateColumns: (hasHalf && modifiersEnabled !== false) ? '1fr 1fr' : '1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                  {(hasHalf && modifiersEnabled !== false) ? `Full Price (${currencySymbol}) *` : `Dish Price (${currencySymbol}) *`}
                </label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 250"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #E2E8F0',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: '#16A34A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {(hasHalf && modifiersEnabled !== false) && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                    Half Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    required={hasHalf}
                    value={priceHalf}
                    onChange={(e) => setPriceHalf(e.target.value)}
                    placeholder="e.g. 150"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #DFBA67',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: '#D97706',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Custom Portion Labels */}
            {(hasHalf && modifiersEnabled !== false) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                    Full Label
                  </label>
                  <input
                    type="text"
                    value={portionFullLabel}
                    onChange={(e) => setPortionFullLabel(e.target.value)}
                    placeholder="e.g. Full Portion"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid #E2E8F0',
                      fontSize: '0.80rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                    Half Label
                  </label>
                  <input
                    type="text"
                    value={portionHalfLabel}
                    onChange={(e) => setPortionHalfLabel(e.target.value)}
                    placeholder="e.g. Half Portion"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid #E2E8F0',
                      fontSize: '0.80rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Custom Modifiers / Toppings */}
            {modifiersEnabled !== false && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #DFBA67' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0A2315' }}>
                    Add-ons / Custom Toppings ({modifiers.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddModifier}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#0A2315',
                      color: '#FFFFFF',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    + Add option
                  </button>
                </div>

                {/* Modifiers List */}
                {modifiers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {modifiers.map((mod, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <input
                          type="text"
                          placeholder="e.g. Extra Cheese"
                          value={mod.name}
                          onChange={(e) => handleUpdateModifier(idx, 'name', e.target.value)}
                          style={{
                            flex: 2,
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.80rem',
                            outline: 'none'
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                          <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#64748B' }}>+{currencySymbol}</span>
                          <input
                            type="number"
                            placeholder="30"
                            value={mod.price}
                            onChange={(e) => handleUpdateModifier(idx, 'price', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.80rem',
                              fontWeight: 800,
                              outline: 'none'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveModifier(idx)}
                          style={{
                            background: '#FFF5F5',
                            color: '#DC2626',
                            border: '1px solid #FEE2E2',
                            borderRadius: '6px',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontStyle: 'italic' }}>
                    No custom modifiers added yet.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description & Description Hindi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Description
              </label>
              <textarea
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Delicious fresh cooked paneer gravy..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.82rem',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                <Globe size={12} color="#64748B" />
                Hindi Description
              </label>
              <textarea
                rows="2"
                value={descriptionHi}
                onChange={(e) => setDescriptionHi(e.target.value)}
                placeholder="स्वादिष्ट ताज़ा पनीर की तरी..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.82rem',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A'
                }}
              />
            </div>
          </div>

          {/* Ingredients & Portion Size */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Ingredients (comma separated)
              </label>
              <input
                type="text"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="e.g. Paneer, Cashews, Cream"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                Portion Size (Servings)
              </label>
              <input
                type="text"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                placeholder="e.g. Serves 1-2 • 300g"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #E2E8F0',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A'
                }}
              />
            </div>
          </div>

          {/* Dish Image */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Dish Image
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              background: '#F8FAFC',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px dashed #E2E8F0',
              marginBottom: '8px'
            }}>
              <img
                src={getDishImageUrl(image)}
                alt="Preview"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '1.5px solid #E2E8F0',
                  background: '#FFFFFF'
                }}
                onError={(e) => {
                  e.currentTarget.src = '/images/default-dish.webp';
                }}
              />
              
              <div style={{ display: 'flex', gap: '6px' }}>
                <label style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0A2315',
                  color: '#FFFFFF',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  transition: 'background-color 0.2s',
                  boxShadow: '0 2px 5px rgba(10, 35, 21, 0.15)'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#143A24'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0A2315'}
                >
                  <Upload size={13} color="#D4AF37" />
                  <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="Or enter image URL (optional)"
              style={{
                width: '100%',
                padding: '9px 12px',
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

          {/* Availability Switch */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px'
          }}>
            <div>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0A2315', display: 'block' }}>
                Item Available on Menu
              </span>
              <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                In stock items can be ordered by customers immediately
              </span>
            </div>
            
            <div
              onClick={() => setAvailable(!available)}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: available ? '#10B981' : '#CBD5E1',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 2px'
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#FFFFFF',
                position: 'absolute',
                left: available ? '18px' : '2px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)'
              }} />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
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
              type="submit"
              disabled={saving || uploading}
              style={{
                padding: '10px 24px',
                borderRadius: '100px',
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                border: '1.5px solid #D4AF37',
                fontSize: '0.84rem',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(10, 35, 21, 0.2)',
                cursor: (saving || uploading) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
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
