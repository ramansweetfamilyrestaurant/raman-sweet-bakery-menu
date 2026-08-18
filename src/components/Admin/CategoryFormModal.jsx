import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { uploadImage } from '../../api/client';
import { getCategoryImageUrl } from '../../utils/imageHelper';

export default function CategoryFormModal({ category, token, onSave, onClose }) {
  const [name, setName] = useState(category?.name || '');
  const [nameHi, setNameHi] = useState(category?.name_hi || '');
  const [image, setImage] = useState(category?.image && category.image !== '/uploads/logo.jpg' ? category.image : '');
  const [sortOrder, setSortOrder] = useState(category?.sort_order || 0);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const res = await uploadImage(file, token, 'categories');
      setImage(res);
    } catch (err) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        name,
        name_hi: nameHi,
        image,
        sort_order: Number(sortOrder)
      });
    } catch (err) {
      setError(err.message || 'Failed to save category');
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
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
          maxWidth: '460px',
          boxShadow: 'var(--shadow-lg)',
          border: '1.5px solid var(--accent-gold)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '16px 20px',
          background: 'var(--header-gradient)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {category ? 'Edit Category' : 'Create New Category'}
          </h3>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #EF4444',
              color: '#991B1B',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84rem',
              marginBottom: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-dark-green)', marginBottom: '4px' }}>
              Category Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pure Desi Ghee Sweets"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Display Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Category Image
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <img
                src={getCategoryImageUrl(image)}
                alt="Preview"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--accent-gold)'
                }}
                onError={(e) => { e.currentTarget.src = '/images/default-category.webp'; }}
              />
              <label style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-cream-secondary)',
                border: '1px solid var(--accent-gold)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
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
              placeholder="Or image URL"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                fontSize: '0.8rem'
              }}
            />
          </div>

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
              {saving ? 'Saving...' : (category ? '✓ Update Category' : '✓ Save Category')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
