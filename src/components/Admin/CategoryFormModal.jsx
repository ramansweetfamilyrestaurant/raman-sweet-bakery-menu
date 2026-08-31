import React, { useState } from 'react';
import { X, Upload, Trash2, FolderOpen, ArrowUpDown, Globe } from 'lucide-react';
import { uploadImage } from '../../api/client';
import { resolveImageUrl, getCategoryImageUrl, hasCustomCategoryImage } from '../../utils/imageHelper';

export default function CategoryFormModal({ category, token, onSave, onClose }) {
  const [name, setName] = useState(category?.name || '');
  const [nameHi, setNameHi] = useState(category?.name_hi || '');
  const [image, setImage] = useState(category?.image && category.image !== '/uploads/logo.jpg' ? category.image : '');
  const [showUrlInput, setShowUrlInput] = useState(false);
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
      zIndex: 3500,
      background: 'rgba(10, 25, 16, 0.70)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
      boxSizing: 'border-box'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className="cat-modal-container"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
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
          @media (max-width: 600px) {
            .cat-modal-container {
              max-width: 100% !important;
              border-radius: 16px !important;
              max-height: 94vh !important;
            }
            .cat-modal-body-form {
              padding: 12px 14px !important;
            }
            .cat-modal-body-form input,
            .cat-modal-body-form select {
              font-size: 14px !important;
              padding: 8px 11px !important;
            }
          }
        `}} />

        {/* Modal Header */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <FolderOpen size={15} color="#D4AF37" />
            <h3 style={{ fontSize: '0.94rem', fontWeight: 700, margin: 0, letterSpacing: '0.1px', lineHeight: 1.2 }}>
              {category ? 'Edit Category' : 'Create New Category'}
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
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="cat-modal-body-form" style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, margin: 0 }}>
          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              padding: '7px 10px',
              borderRadius: '7px',
              fontSize: '0.74rem',
              fontWeight: 600,
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 1. Category Name English */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Category Name (English) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pure Desi Ghee Sweets"
                style={{
                  width: '100%',
                  padding: '8px 11px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A',
                  lineHeight: 1.35
                }}
                onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
              />
            </div>

            {/* 2. Category Name Hindi */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                <Globe size={11} color="#64748B" />
                Category Name in Hindi (हिंदी नाम)
              </label>
              <input
                type="text"
                value={nameHi}
                onChange={(e) => setNameHi(e.target.value)}
                placeholder="उदा. शुद्ध देसी घी की मिठाइयां"
                style={{
                  width: '100%',
                  padding: '8px 11px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A',
                  lineHeight: 1.35
                }}
                onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
              />
            </div>

            {/* 3. Display Sort Order */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                <ArrowUpDown size={11} color="#64748B" />
                Display Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 11px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A',
                  lineHeight: 1.35
                }}
                onFocus={(e) => e.target.style.borderColor = '#0A2315'}
                onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
              />
            </div>

            {/* 4. Category Image Upload */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Category Image (Optional)
              </label>
              
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                alignItems: 'center', 
                background: '#F8FAFC',
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px dashed #CBD5E1'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '7px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #E2E8F0',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#0A2315',
                      color: '#FFFFFF',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 650,
                      minWidth: '100px',
                      justifyContent: 'center'
                    }}>
                      <Upload size={11} color="#D4AF37" />
                      <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>

                    {hasCustomCategoryImage(image) && (
                      <button
                        type="button"
                        onClick={() => setImage('')}
                        style={{
                          background: '#FEE2E2',
                          border: 'none',
                          color: '#DC2626',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontSize: '0.70rem',
                          fontWeight: 650,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.68rem', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: '2px' }}
                  >
                    {showUrlInput ? 'Hide URL input' : 'Or paste URL'}
                  </button>
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
                    boxSizing: 'border-box',
                    marginTop: '6px',
                    color: '#0F172A'
                  }}
                />
              )}
            </div>
          </div>

          {/* Sticky Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '14px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                height: '42px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '0.74rem',
                fontWeight: 650,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              style={{
                padding: '8px 16px',
                height: '42px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                border: '1px solid #D4AF37',
                fontSize: '0.76rem',
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(10, 35, 21, 0.18)',
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
