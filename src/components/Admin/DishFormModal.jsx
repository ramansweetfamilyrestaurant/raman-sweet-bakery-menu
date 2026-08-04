import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { uploadImage } from '../../api/client';

export default function DishFormModal({ dish, categories, token, onSave, onClose }) {
  const [categoryId, setCategoryId] = useState(dish?.category_id || categories[0]?.id || '');
  const [name, setName] = useState(dish?.name || '');
  const [description, setDescription] = useState(dish?.description || '');
  const [price, setPrice] = useState(dish?.price || '');
  const [priceHalf, setPriceHalf] = useState(dish?.price_half || '');
  const [hasHalf, setHasHalf] = useState(Boolean(dish?.price_half));
  const [portion, setPortion] = useState(dish?.portion || '');
  const [badge, setBadge] = useState(dish?.badge || '');
  const [ingredients, setIngredients] = useState(dish?.ingredients || '');
  const [tasteProfile, setTasteProfile] = useState(dish?.taste_profile || '');
  const [image, setImage] = useState(dish?.image || '/uploads/logo.jpg');
  const [available, setAvailable] = useState(dish?.available !== false);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const res = await uploadImage(file, token);
      setImage(res.url);
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
      await onSave({
        category_id: Number(categoryId),
        name,
        description,
        image,
        price: Number(price),
        price_half: (hasHalf && priceHalf) ? Number(priceHalf) : null,
        portion,
        portion_half_label: hasHalf ? 'Half Portion' : '',
        portion_full_label: hasHalf ? 'Full Portion' : '',
        badge,
        ingredients,
        taste_profile: tasteProfile,
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
          justify: 'space-between',
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

          {/* Name & Badge */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
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
            </div>
          </div>

          {/* Pricing: Full & Optional Half Price */}
          <div style={{
            background: 'var(--bg-cream-primary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(197, 160, 89, 0.3)',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                Portion Pricing System
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasHalf}
                  onChange={(e) => setHasHalf(e.target.checked)}
                />
                Enable Half / Full Option
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: hasHalf ? '1fr 1fr' : '1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  {hasHalf ? 'Full Portion Price (₹) *' : 'Price (₹) *'}
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

              {hasHalf && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Half Portion Price (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
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
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Description
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
                src={image || '/uploads/logo.jpg'}
                alt="Preview"
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  border: '1px solid var(--accent-gold)'
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
                padding: '8px 24px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--primary-dark-green)',
                color: '#FFFFFF',
                border: '1px solid var(--accent-gold)',
                fontSize: '0.85rem',
                fontWeight: 700
              }}
            >
              {saving ? 'Saving...' : 'Save Dish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
