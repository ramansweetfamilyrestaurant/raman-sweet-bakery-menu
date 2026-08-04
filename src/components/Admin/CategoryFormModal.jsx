import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { uploadImage } from '../../api/client';

export default function CategoryFormModal({ category, token, onSave, onClose }) {
  const [name, setName] = useState(category?.name || '');
  const [image, setImage] = useState(category?.image || '/uploads/logo.jpg');
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
    if (!name) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        name,
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
          background: 'var(--primary-dark-green)',
          color: '#FFFFFF',
          padding: '16px 20px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--accent-gold)'
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#FFFFFF' }}>
            {category ? 'Edit Category' : 'Create New Category'}
          </h3>
          <button onClick={onClose} style={{ color: '#FFFFFF' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
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

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
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
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                fontSize: '0.9rem'
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
                src={image || '/uploads/logo.jpg'}
                alt="Preview"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
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
                padding: '8px 24px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--primary-dark-green)',
                color: '#FFFFFF',
                border: '1px solid var(--accent-gold)',
                fontSize: '0.85rem',
                fontWeight: 700
              }}
            >
              {saving ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
