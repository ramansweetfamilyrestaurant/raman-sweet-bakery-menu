import React, { useState } from 'react';
import { X, Upload, Trash2, FolderOpen, ArrowUpDown, Globe } from 'lucide-react';
import { uploadImage } from '../../api/client';
import { resolveImageUrl, getCategoryImageUrl, hasCustomCategoryImage } from '../../utils/imageHelper';

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
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        name_hi: nameHi.trim(),
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
          maxWidth: '450px',
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

        {/* Modal Header */}
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
            <FolderOpen size={18} color="#D4AF37" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
              {category ? 'Edit Category' : 'Create New Category'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '22px 24px', margin: 0 }}>
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
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. Category Name English */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
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

          {/* 2. Category Name Hindi */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              <Globe size={13} color="#64748B" />
              Category Name in Hindi (optional)
            </label>
            <input
              type="text"
              value={nameHi}
              onChange={(e) => setNameHi(e.target.value)}
              placeholder="उदा. शुद्ध देसी घी की मिठाइयां"
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

          {/* 3. Display Sort Order */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              <ArrowUpDown size={13} color="#64748B" />
              Display Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
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

          {/* 4. Category Image Upload & Preview */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Category Image
            </label>
            
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center', 
              marginBottom: '10px',
              background: '#F8FAFC',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px dashed #E2E8F0'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #E2E8F0',
                background: '#FFFFFF',
                flexShrink: 0
              }}>
                <img
                  src={getCategoryImageUrl(image)}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    if (e.currentTarget.src !== '/images/default-category.webp') {
                      e.currentTarget.src = '/images/default-category.webp';
                    }
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
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
                  {uploading ? 'Uploading...' : 'Upload File'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {hasCustomCategoryImage(image) && (
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#FEE2E2',
                      border: '1px solid #FCA5A5',
                      color: '#991B1B',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FCA5A5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                  >
                    <Trash2 size={12} color="#DC2626" />
                    <span>Remove</span>
                  </button>
                )}
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
                transition: 'all 0.2s ease',
                color: '#0F172A'
              }}
              onFocus={(e) => e.target.style.borderColor = '#0A2315'}
              onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
            />
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.borderColor = '#94A3B8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#CBD5E1';
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
              onMouseEnter={(e) => {
                if (!saving && !uploading) {
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(10, 35, 21, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 35, 21, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
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
