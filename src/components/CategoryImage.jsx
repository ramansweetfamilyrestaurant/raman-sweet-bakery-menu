import React, { useState, useEffect } from 'react';
import { getCategoryImageUrl } from '../utils/imageHelper';

const DEFAULT_CATEGORY_FALLBACK = '/images/default-category.webp';

/**
 * Universal Category Image / Thumbnail Component
 * 
 * Guarantees consistent category visual rendering across customer and admin views:
 * 1. If a valid custom category photo is present, renders an optimized, object-fit covered image thumbnail.
 * 2. If no category image exists (NULL, empty string, undefined), renders the canonical global fallback: /images/default-category.webp
 * 3. If a custom category image fails to load (404, network error, invalid URL), gracefully falls back to: /images/default-category.webp
 * 4. Zero broken-image icons, zero emoji, zero database pollution, zero cross-tenant leakage.
 */
export default function CategoryImage({
  image,
  name = '',
  size = 18,
  isSelected = false,
  style = {},
  className = ''
}) {
  const [imgSrc, setImgSrc] = useState(() => getCategoryImageUrl(image));

  useEffect(() => {
    setImgSrc(getCategoryImageUrl(image));
  }, [image]);

  const handleImageError = () => {
    if (imgSrc !== DEFAULT_CATEGORY_FALLBACK) {
      setImgSrc(DEFAULT_CATEGORY_FALLBACK);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={name || 'Category'}
      loading="lazy"
      onError={handleImageError}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        border: isSelected ? '1.5px solid #FFFFFF' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style
      }}
    />
  );
}
