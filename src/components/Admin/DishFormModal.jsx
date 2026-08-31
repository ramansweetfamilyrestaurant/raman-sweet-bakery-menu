import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, AlertCircle, Trash2, Tag, Globe, Sliders, Flame, Layers, Utensils, Check } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'pricing' | 'details'
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
  const [price, setPrice] = useState(dish?.price !== undefined && dish?.price !== null ? dish.price : '');
  const [priceHalf, setPriceHalf] = useState(dish?.price_half !== undefined && dish?.price_half !== null ? dish.price_half : '');
  const [hasHalf, setHasHalf] = useState(Boolean(dish?.price_half !== undefined && dish?.price_half !== null && dish?.price_half !== '' && modifiersEnabled !== false));
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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [available, setAvailable] = useState(
    dish
      ? (dish.available !== false && dish.available !== 0 && dish.is_available !== false)
      : true
  );
  
  const [tempUploadedImages, setTempUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCancelClose = () => {
    if (tempUploadedImages.length > 0) {
      tempUploadedImages.forEach(img => {
        if (img && img !== dish?.image) {
          deleteImageApi(img, token).catch(() => {});
        }
      });
    }
    onClose();
  };

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
      setTempUploadedImages(prev => [...prev, resolvedRes]);
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
    if (!trimmedName || price === '' || price === null || categoryId === '' || categoryId === null) {
      setActiveTab('basic');
      setError('Category, Dish Name, and Full Price are required.');
      return;
    }

    if (isNaN(Number(price)) || Number(price) < 0) {
      setActiveTab('basic');
      setError('Full price must be a valid non-negative number.');
      return;
    }

    if (hasHalf && modifiersEnabled !== false) {
      if (priceHalf === '' || priceHalf === null) {
        setActiveTab('pricing');
        setError('Half price is required when half portion is enabled.');
        return;
      }
      if (isNaN(Number(priceHalf)) || Number(priceHalf) < 0) {
        setActiveTab('pricing');
        setError('Half price must be a valid non-negative number.');
        return;
      }
      if (Number(priceHalf) > Number(price)) {
        setActiveTab('pricing');
        setError('Half price cannot be greater than full price.');
        return;
      }
    }

    const hasInvalidModifier = modifiers.some(m => m.name && m.name.trim() !== '' && (isNaN(Number(m.price)) || Number(m.price) < 0));
    if (hasInvalidModifier) {
      setActiveTab('pricing');
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
        price_half: (modifiersEnabled !== false && hasHalf && priceHalf !== '' && priceHalf !== null) ? Number(priceHalf) : null,
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
      setTempUploadedImages([]);
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
      background: 'rgba(10, 25, 16, 0.70)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
      boxSizing: 'border-box'
    }} onClick={handleCancelClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className="dish-modal-container"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
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
          .dish-tab-btn {
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
          .dish-tab-btn.active {
            background: #FFFFFF;
            color: #0A2315;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            font-weight: 800;
          }
          @media (max-width: 600px) {
            .dish-modal-container {
              max-width: 100% !important;
              border-radius: 16px !important;
              max-height: 94vh !important;
            }
            .dish-modal-body-form {
              padding: 12px 14px !important;
            }
            .dish-modal-body-form input,
            .dish-modal-body-form select,
            .dish-modal-body-form textarea {
              font-size: 16px !important;
              padding: 9px 11px !important;
            }
            .dish-tab-btn {
              padding: 6px 6px !important;
              font-size: 0.72rem !important;
            }
          }
        `}} />

        {/* Compact Header */}
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
            <Sparkles size={16} color="#D4AF37" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, letterSpacing: '0.2px' }}>
              {dish ? 'Edit Dish Details' : 'Add New Dish'}
            </h3>
          </div>
          <button 
            onClick={handleCancelClose} 
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

        {/* Compact Segmented Tabs */}
        <div style={{
          background: '#F1F5F9',
          padding: '4px',
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid #E2E8F0'
        }}>
          <button
            type="button"
            className={`dish-tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            <Utensils size={13} color={activeTab === 'basic' ? '#0A2315' : '#64748B'} />
            <span>1. Basic Info</span>
          </button>

          <button
            type="button"
            className={`dish-tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricing')}
          >
            <Sliders size={13} color={activeTab === 'pricing' ? '#0A2315' : '#64748B'} />
            <span>2. Pricing & Half</span>
            {(hasHalf || modifiers.length > 0) && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37' }} />
            )}
          </button>

          <button
            type="button"
            className={`dish-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <Sparkles size={13} color={activeTab === 'details' ? '#0A2315' : '#64748B'} />
            <span>3. More Details</span>
            {(nameHi || badge || tasteProfile) && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
            )}
          </button>
        </div>

        {/* Form Body with Smooth Scrolling */}
        <form onSubmit={handleSubmit} className="dish-modal-body-form" style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, margin: 0 }}>
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

          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Category & Diet Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 11px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.84rem',
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
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                    Dietary Preference *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    {[
                      { id: 'veg', label: 'Veg', bg: '#F0FDF4', color: '#16A34A', dot: '#16A34A' },
                      { id: 'nonveg', label: 'Non-Veg', bg: '#FDF2F2', color: '#DC2626', dot: '#DC2626' },
                      { id: 'egg', label: 'Egg', bg: '#FFFBEB', color: '#D97706', dot: '#D97706' }
                    ].map(d => {
                      const isSel = type === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setType(d.id)}
                          style={{
                            padding: '8px 2px',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            background: isSel ? d.bg : '#F8FAFC',
                            color: isSel ? d.color : '#64748B',
                            border: isSel ? `1.5px solid ${d.color}` : '1.5px solid #E2E8F0',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.dot }} />
                          <span>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dish Name */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
                    Dish Name (English) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0A2315',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <Globe size={11} color="#64748B" />
                    <span>{nameHi ? `Hindi: ${nameHi}` : '+ Add Hindi Name'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Paneer Butter Masala"
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
                />
              </div>

              {/* Full Price & Quick Half Toggle */}
              <div style={{
                background: '#F8FAFC',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '3px' }}>
                    Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="250"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: '#16A34A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {modifiersEnabled !== false && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                      <input
                        type="checkbox"
                        id="quickHasHalf"
                        checked={hasHalf}
                        onChange={(e) => {
                          setHasHalf(e.target.checked);
                          if (e.target.checked && !priceHalf) setActiveTab('pricing');
                        }}
                        style={{ cursor: 'pointer', accentColor: '#0A2315', width: '15px', height: '15px' }}
                      />
                      <label htmlFor="quickHasHalf" style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Half Portion
                      </label>
                    </div>
                    {hasHalf && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('pricing')}
                        style={{ background: 'none', border: 'none', color: '#D97706', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                      >
                        {priceHalf ? `Half: ${currencySymbol}${priceHalf} ✏️` : 'Set Half Price ⚠️'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Compact Image Upload & Stock Row */}
              <div style={{
                background: '#FAFAFA',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px dashed #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={getDishImageUrl(image)}
                    alt="Preview"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF'
                    }}
                    onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#0A2315',
                      color: '#FFFFFF',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}>
                      <Upload size={11} color="#D4AF37" />
                      <span>{uploading ? 'Uploading...' : (image ? 'Change Photo' : 'Upload Photo')}</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.66rem', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                    >
                      {showUrlInput ? 'Hide URL input' : 'Or paste URL'}
                    </button>
                  </div>
                </div>

                {/* Compact Availability Toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                  <span style={{ fontSize: '0.70rem', fontWeight: 800, color: available ? '#16A34A' : '#94A3B8' }}>
                    {available ? '● In Stock' : '○ Out of Stock'}
                  </span>
                  <div
                    onClick={() => setAvailable(!available)}
                    style={{
                      width: '32px',
                      height: '18px',
                      borderRadius: '9px',
                      background: available ? '#10B981' : '#CBD5E1',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      left: available ? '16px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              </div>

              {showUrlInput && (
                <input
                  type="text"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="Paste direct image URL (https://...)"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.76rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              )}
            </div>
          )}

          {/* TAB 2: PORTION PRICING & MODIFIERS */}
          {activeTab === 'pricing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Half Portion Pricing Card */}
              <div style={{
                background: '#FDFBF7',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #DFBA67'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0A2315', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sliders size={12} color="#D4AF37" />
                    Half / Full Portion Pricing
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      id="enableHalfBox"
                      checked={hasHalf}
                      onChange={(e) => setHasHalf(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#0A2315' }}
                    />
                    <label htmlFor="enableHalfBox" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                      Enable Half
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: hasHalf ? '1fr 1fr' : '1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                      Full Price ({currencySymbol}) *
                    </label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="250"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        color: '#16A34A',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {hasHalf && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 700, color: '#D97706', marginBottom: '2px' }}>
                        Half Price ({currencySymbol}) *
                      </label>
                      <input
                        type="number"
                        required={hasHalf}
                        value={priceHalf}
                        onChange={(e) => setPriceHalf(e.target.value)}
                        placeholder="140"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #DFBA67',
                          fontSize: '0.86rem',
                          fontWeight: 800,
                          color: '#D97706',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}
                </div>

                {hasHalf && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.66rem', color: '#64748B', marginBottom: '2px' }}>
                        Full Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={portionFullLabel}
                        onChange={(e) => setPortionFullLabel(e.target.value)}
                        placeholder="Full Portion"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '0.74rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.66rem', color: '#64748B', marginBottom: '2px' }}>
                        Half Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={portionHalfLabel}
                        onChange={(e) => setPortionHalfLabel(e.target.value)}
                        placeholder="Half Portion"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid #CBD5E1', fontSize: '0.74rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Add-ons / Modifiers */}
              {modifiersEnabled !== false && (
                <div style={{
                  background: '#F8FAFC',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0A2315' }}>
                      Add-ons / Custom Toppings ({modifiers.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddModifier}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#0A2315',
                        color: '#FFFFFF',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Option
                    </button>
                  </div>

                  {modifiers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {modifiers.map((mod, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '5px 6px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                          <input
                            type="text"
                            placeholder="e.g. Extra Cheese"
                            value={mod.name}
                            onChange={(e) => handleUpdateModifier(idx, 'name', e.target.value)}
                            style={{ flex: 2, padding: '5px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', fontSize: '0.76rem' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>+{currencySymbol}</span>
                            <input
                              type="number"
                              placeholder="30"
                              value={mod.price}
                              onChange={(e) => handleUpdateModifier(idx, 'price', e.target.value)}
                              style={{ width: '100%', padding: '5px 6px', borderRadius: '4px', border: '1px solid #E2E8F0', fontSize: '0.76rem', fontWeight: 800 }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveModifier(idx)}
                            style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.70rem', color: '#64748B', fontStyle: 'italic' }}>
                      No add-on toppings added yet (e.g. Extra Butter, Cheese).
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MORE DETAILS (Hindi, Description, Taste, Badges) */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Hindi Name */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  <Globe size={11} color="#64748B" />
                  Hindi Dish Name (हिंदी नाम)
                </label>
                <input
                  type="text"
                  value={nameHi}
                  onChange={(e) => setNameHi(e.target.value)}
                  placeholder="उदा. पनीर बटर मसाला"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '7px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.84rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Badges */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  <Tag size={11} color="#64748B" />
                  Highlight Tag / Badge
                </label>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {[
                    { label: '🔥 Must Try', val: 'Must Try' },
                    { label: '⭐ Bestseller', val: 'Bestseller' },
                    { label: '✨ Special', val: 'Special' }
                  ].map(b => {
                    const isB = badge === b.val;
                    return (
                      <button
                        key={b.val}
                        type="button"
                        onClick={() => setBadge(isB ? '' : b.val)}
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '100px',
                          background: isB ? '#FDF2F2' : '#F8FAFC',
                          color: isB ? '#DC2626' : '#475569',
                          border: `1px solid ${isB ? '#FCA5A5' : '#CBD5E1'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Taste Profile */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 800, color: '#334155', marginBottom: '3px' }}>
                  <Flame size={11} color="#EA580C" />
                  Taste Profile / Spiciness
                </label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  {[
                    { label: '🌶️ Mild', val: 'Mild' },
                    { label: '🌶️🌶️ Medium', val: 'Medium Spicy' },
                    { label: '🔥 Extra Spicy', val: 'Extra Spicy' },
                    { label: '🍬 Sweet', val: 'Sweet' }
                  ].map(tp => {
                    const isTp = tasteProfile === tp.val;
                    return (
                      <button
                        key={tp.val}
                        type="button"
                        onClick={() => setTasteProfile(isTp ? '' : tp.val)}
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '100px',
                          background: isTp ? '#FFF7ED' : '#F8FAFC',
                          color: isTp ? '#EA580C' : '#475569',
                          border: `1px solid ${isTp ? '#FDBA74' : '#CBD5E1'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {tp.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={tasteProfile}
                  onChange={(e) => setTasteProfile(e.target.value)}
                  placeholder="Or enter custom taste (e.g. Rich Gravy, Crispy)"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.74rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Description & Portion */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                    Description
                  </label>
                  <textarea
                    rows="2"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary..."
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.74rem', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                    Portion Size
                  </label>
                  <input
                    type="text"
                    value={portion}
                    onChange={(e) => setPortion(e.target.value)}
                    placeholder="Serves 1-2 • 300g"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.74rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                  Ingredients (Optional)
                </label>
                <input
                  type="text"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder="Paneer, Cashews, Cream, Butter"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.74rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* Sticky Compact Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '14px' }}>
            <button
              type="button"
              onClick={handleCancelClose}
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
              type="submit"
              disabled={saving || uploading}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                border: '1px solid #D4AF37',
                fontSize: '0.80rem',
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(10, 35, 21, 0.2)',
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
