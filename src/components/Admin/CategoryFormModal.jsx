import React, { useState, useMemo, useRef } from 'react';
import { X, Upload, Trash2, FolderOpen, ArrowUpDown, Globe, Sparkles } from 'lucide-react';
import { uploadImage, deleteImageApi } from '../../api/client';
import { resolveImageUrl, getCategoryImageUrl, hasCustomCategoryImage } from '../../utils/imageHelper';
import { resolveBusinessProfile } from '../../utils/businessTaxonomy';

const CATEGORY_SUGGESTIONS_BY_PROFILE = {
  cinema_theatre: [
    { name: 'Popcorn & Combos', nameHi: 'पॉपकॉर्न और कॉम्बो' },
    { name: 'Nachos & Hot Snacks', nameHi: 'नाचोज़ और गरम स्नैक्स' },
    { name: 'Cold Beverages & Sodas', nameHi: 'कोल्ड बेवरेजेस और सोडा' },
    { name: 'Ice Creams & Sweets', nameHi: 'आइसक्रीम और स्वीट्स' },
    { name: 'Gourmet Bites', nameHi: 'गौरमेट बाइट्स' }
  ],
  bakery_confectionery: [
    { name: 'Cakes & Pastries', nameHi: 'केक और पेस्ट्री' },
    { name: 'Fresh Breads & Buns', nameHi: 'ताजा ब्रेड और बन्स' },
    { name: 'Cookies & Biscuits', nameHi: 'कुकीज़ और बिस्कुट' },
    { name: 'Savory Puffs & Rolls', nameHi: 'नमकीन पफ्स और रोल्स' },
    { name: 'Desserts & Chocolates', nameHi: 'डेसर्ट और चॉकलेट' }
  ],
  sweet_shop: [
    { name: 'Pure Desi Ghee Sweets', nameHi: 'शुद्ध देसी घी की मिठाइयां' },
    { name: 'Bengali Sweets & Chena', nameHi: 'बंगाली मिठाई और छेना' },
    { name: 'Namkeen & Mixtures', nameHi: 'नमकीन और मिक्सचर' },
    { name: 'Dry Fruits & Gift Packs', nameHi: 'ड्राई फ्रूट्स और गिफ्ट पैक्स' },
    { name: 'Chaat & Snacks', nameHi: 'चाट और स्नैक्स' }
  ],
  cafe: [
    { name: 'Hot Brews & Espresso', nameHi: 'गरम कॉफ़ी और एस्प्रेसो' },
    { name: 'Cold Brews & Frappes', nameHi: 'कोल्ड ब्रू और फ्रैपे' },
    { name: 'Artisanal Teas & Chai', nameHi: 'स्पेशल चाय और टी' },
    { name: 'Sandwiches & Paninis', nameHi: 'सैंडविच और पनीनी' },
    { name: 'Bakes & Quick Bites', nameHi: 'बेकरी और क्विक बाइट्स' }
  ],
  hotel_resort: [
    { name: 'Morning Breakfast & Buffet', nameHi: 'मॉर्निंग ब्रेकफास्ट और बुफे' },
    { name: 'In-Room Dining Specials', nameHi: 'इन-रूम डाइनिंग स्पेशल्स' },
    { name: 'Main Course & Platters', nameHi: 'मेन कोर्स और प्लैटर्स' },
    { name: 'Soups, Salads & Starters', nameHi: 'सूप, सलाद और स्टार्टर्स' },
    { name: 'Beverages & Mocktails', nameHi: 'बेवरेजेस और मॉकटेल्स' }
  ],
  cloud_kitchen: [
    { name: 'Daily Thali & Meal Bowls', nameHi: 'डेली थाली और मील बाउल्स' },
    { name: 'Biryani & Rice Platters', nameHi: 'बिरयानी और पुलाव' },
    { name: 'Rolls, Wraps & Momos', nameHi: 'रोल्स, रैप्स और मोमोज़' },
    { name: 'Starters & Sides', nameHi: 'स्टार्टर्स और साइड्स' },
    { name: 'Desserts & Beverages', nameHi: 'डेसर्ट और बेवरेजेस' }
  ],
  dhaba: [
    { name: 'Tandoori Roti & Naan', nameHi: 'तंदूरी रोटी और नान' },
    { name: 'Special Paneer & Dal Makhani', nameHi: 'स्पेशल पनीर और दाल मखनी' },
    { name: 'Punjabi Sabzi & Curries', nameHi: 'पंजाबी सब्ज़ी और तरी' },
    { name: 'Special Lassi & Desi Drinks', nameHi: 'स्पेशल लस्सी और छाछ' },
    { name: 'Stuffed Parathas', nameHi: 'भरवां परांठे' }
  ],
  pub_bar: [
    { name: 'Signature Cocktails', nameHi: 'सिग्नेचर कॉकटेल्स' },
    { name: 'Beers & Draughts', nameHi: 'बीयर और ड्राफ्ट' },
    { name: 'Bar Bites & Finger Food', nameHi: 'बार बाइट्स और फिंगर फ़ूड' },
    { name: 'Mocktails & Soft Drinks', nameHi: 'मॉकटेल्स और सॉफ्ट ड्रिंक्स' }
  ],
  fast_food_qsr: [
    { name: 'Loaded Burgers & Fries', nameHi: 'लोडेड बर्गर और फ्राइज़' },
    { name: 'Pizzas & Garlic Bread', nameHi: 'पिज़्ज़ा और गार्लिक ब्रेड' },
    { name: 'Rolls, Wraps & Momos', nameHi: 'रोल्स, रैप्स और मोमोज़' },
    { name: 'Combos & Meal Deals', nameHi: 'कॉम्बो और मील डील्स' },
    { name: 'Thick Shakes & Coolers', nameHi: 'मिल्कशेक और कूलर्स' }
  ],
  default: [
    { name: 'Starters & Appetizers', nameHi: 'स्टार्टर्स और ऐपेटाइज़र' },
    { name: 'Main Course', nameHi: 'मेन कोर्स' },
    { name: 'Breads, Rice & Biryani', nameHi: 'रोटी, नान और चावल' },
    { name: 'Beverages & Mocktails', nameHi: 'बेवरेजेस और मॉकटेल्स' },
    { name: 'Desserts & Sweets', nameHi: 'डेसर्ट और मीठा' }
  ]
};

export default function CategoryFormModal({ category, token, onSave, onClose, restaurantInfo = {} }) {
  const profile = useMemo(() => resolveBusinessProfile(restaurantInfo || {}), [restaurantInfo]);
  const suggestions = useMemo(() => {
    return CATEGORY_SUGGESTIONS_BY_PROFILE[profile.business_type] ||
      CATEGORY_SUGGESTIONS_BY_PROFILE.default;
  }, [profile]);

  const [name, setName] = useState(category?.name || '');
  const [nameHi, setNameHi] = useState(category?.name_hi || '');
  const [image, setImage] = useState(category?.image && category.image !== '/uploads/logo.jpg' ? category.image : '');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [sortOrder, setSortOrder] = useState(category?.sort_order || 0);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempUploadedImages, setTempUploadedImages] = useState([]);
  const fileInputRef = useRef(null);

  const handleCancelClose = () => {
    if (tempUploadedImages.length > 0) {
      tempUploadedImages.forEach(img => {
        if (img && img !== category?.image) {
          deleteImageApi(img, token).catch(() => {});
        }
      });
    }
    onClose();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const oldTempImage = image;
      const res = await uploadImage(file, token, 'categories');
      setImage(res);
      setTempUploadedImages(prev => [...prev, res]);
      if (oldTempImage && oldTempImage !== category?.image) {
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
      setTempUploadedImages([]);
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
    }} onClick={handleCancelClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="cat-modal-container"
        style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '450px',
          maxHeight: '92vh',
          boxShadow: '0 24px 48px -12px rgba(10, 35, 21, 0.35), 0 0 0 1px rgba(10, 35, 21, 0.16)',
          border: 'none',
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
          .cat-modal-field {
            width: 100%;
            padding: 8px 11px;
            border-radius: 9px;
            border: 1.5px solid #CBD5E1;
            font-size: 0.82rem;
            outline: none;
            box-sizing: border-box;
            background: #FFFFFF;
            color: #0F172A;
            line-height: 1.35;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }
          .cat-modal-field:focus {
            border-color: #0A2315 !important;
            box-shadow: 0 0 0 3px rgba(10, 35, 21, 0.08) !important;
          }
          .cat-modal-container .cat-modal-focus-btn:focus-visible {
            outline: 2px solid #0A2315;
            outline-offset: 2px;
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.24);
          }
          .cat-modal-container .cat-sr-only-input {
            position: absolute;
            width: 1px;
            height: 1px;
            min-height: 0 !important;
            padding: 0 !important;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
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
            .cat-modal-body-form input:not([type="file"]),
            .cat-modal-body-form select {
              font-size: 16px !important;
              padding: 8px 10px !important;
            }
          }
        `}} />

        {/* Modal Header */}
        <div style={{
          padding: '13px 16px',
          background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(212, 175, 55, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <FolderOpen size={15} color="#D4AF37" />
            <h3 style={{ fontSize: '0.94rem', fontWeight: 700, margin: 0, letterSpacing: '0.1px', lineHeight: 1.2 }}>
              {category ? 'Edit Category' : 'Create New Category'}
            </h3>
          </div>
          <button
            onClick={handleCancelClose}
            type="button"
            style={{
              background: 'rgba(255, 255, 255, 0.14)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
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
                placeholder={`e.g. ${suggestions[0]?.name || 'Specialties'}`}
                className="cat-modal-field"
              />

              {!category && suggestions && suggestions.length > 0 && (
                <div style={{ marginTop: '7px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <Sparkles size={11} color="#D97706" />
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B' }}>
                      Quick Suggestions ({profile.badge || 'Popular'}):
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setName(sug.name);
                          if (sug.nameHi) setNameHi(sug.nameHi);
                        }}
                        style={{
                          background: name === sug.name ? '#0A2315' : '#F1F5F9',
                          color: name === sug.name ? '#FFFFFF' : '#334155',
                          border: name === sug.name ? '1px solid #0A2315' : '1px solid #CBD5E1',
                          borderRadius: '12px',
                          padding: '3px 8px',
                          fontSize: '0.67rem',
                          fontWeight: 650,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>+</span>
                        <span>{sug.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                placeholder={`उदा. ${suggestions[0]?.nameHi || 'विशेष व्यंजन'}`}
                className="cat-modal-field"
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
                className="cat-modal-field"
              />
            </div>

            {/* 4. Category Image Upload */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Category Image (Optional)
              </label>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '8px', 
                background: '#F8FAFC',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px dashed #CBD5E1'
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #CBD5E1',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, position: 'relative' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="cat-sr-only-input"
                  />
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="cat-modal-focus-btn"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        cursor: uploading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#0A2315',
                        color: '#FFFFFF',
                        border: '1.5px solid #0A2315',
                        padding: '6px 12px',
                        borderRadius: '7px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        minWidth: '104px',
                        justifyContent: 'center'
                      }}
                    >
                      <Upload size={11} color="#D4AF37" />
                      <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                    </button>

                    {hasCustomCategoryImage(image) && (
                      <button
                        type="button"
                        className="cat-modal-focus-btn"
                        onClick={() => setImage('')}
                        style={{
                          background: '#FEE2E2',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          padding: '5px 9px',
                          borderRadius: '7px',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cat-modal-focus-btn"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', borderRadius: '4px' }}
                  >
                    {showUrlInput ? 'Hide URL input' : 'Or paste image URL'}
                  </button>
                </div>
                </div>

              {showUrlInput && (
                <input
                  type="text"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="Paste direct image URL (https://...)"
                  className="cat-modal-field"
                  style={{ fontSize: '0.76rem', padding: '7px 10px' }}
                />
              )}
              </div>
            </div>
          </div>

          {/* Sticky Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #CBD5E1', paddingTop: '12px', marginTop: '14px' }}>
            <button
              type="button"
              onClick={handleCancelClose}
              style={{
                padding: '0 14px',
                height: '38px',
                borderRadius: '9px',
                border: '1.5px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '0.74rem',
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
                padding: '0 16px',
                height: '38px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                border: '1.5px solid #0A2315',
                fontSize: '0.76rem',
                fontWeight: 750,
                boxShadow: '0 2px 8px rgba(10, 35, 21, 0.22)',
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
