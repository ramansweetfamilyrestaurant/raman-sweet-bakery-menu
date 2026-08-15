/**
 * Universal Image URL Resolver
 * Guarantees 100% reliable image URLs for Cloudflare R2 Cloud Storage, local uploads, and web links.
 */
export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const cleanUrl = url.trim();

  // 1. Filter out invalid nulls or empty strings
  if (!cleanUrl || cleanUrl === 'null' || cleanUrl === 'undefined') {
    return '';
  }

  // 2. Already an /api/r2-proxy/ link -> return as-is
  if (cleanUrl.startsWith('/api/r2-proxy/')) {
    return cleanUrl;
  }

  // 3. Cloudflare R2 direct domain (pub-xxxx.r2.dev/...) -> Convert to reliable /api/r2-proxy/
  if (cleanUrl.includes('.r2.dev/')) {
    const idx = cleanUrl.indexOf('.r2.dev/');
    if (idx !== -1) {
      const keyPath = cleanUrl.substring(idx + 8);
      return `/api/r2-proxy/${keyPath}`;
    }
  }

  // 4. Any direct r2-proxy link missing leading slash -> normalize
  if (cleanUrl.startsWith('api/r2-proxy/')) {
    return `/${cleanUrl}`;
  }

  // 5. Normal absolute HTTP/HTTPS URLs or Data URLs
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }

  // 6. Relative server upload path
  if (cleanUrl.startsWith('/')) {
    return cleanUrl;
  }

  return `/${cleanUrl}`;
}

/**
 * Dish Image Fallback Helper
 */
export function getDishImageUrl(url) {
  if (!url || typeof url !== 'string') return '/images/default-dish.webp';
  const cleanUrl = url.trim();
  if (!cleanUrl || cleanUrl === 'null' || cleanUrl === 'undefined' || cleanUrl === '/uploads/logo.jpg') {
    return '/images/default-dish.webp';
  }
  return resolveImageUrl(cleanUrl);
}

/**
 * Category Image Fallback Helper
 */
export function getCategoryImageUrl(url) {
  if (!url || typeof url !== 'string') return '/images/default-category.webp';
  const cleanUrl = url.trim();
  if (!cleanUrl || cleanUrl === 'null' || cleanUrl === 'undefined' || cleanUrl === '/uploads/logo.jpg') {
    return '/images/default-category.webp';
  }
  return resolveImageUrl(cleanUrl);
}

/**
 * Restaurant Custom Logo Checker
 */
export function hasCustomRestaurantLogo(logo) {
  if (!logo || typeof logo !== 'string') return false;
  const clean = logo.trim();
  if (!clean || clean === 'null' || clean === 'undefined') return false;
  if (clean === '/uploads/logo.jpg' || clean === '/images/default-logo.webp' || clean === '/images/default-logo.svg') return false;
  return true;
}

/**
 * Universal Restaurant Logo URL Resolver
 * Guarantees that uncustomized or invalid logos resolve cleanly to /images/default-logo.svg
 */
export function getRestaurantLogoUrl(logo) {
  if (!hasCustomRestaurantLogo(logo)) {
    return '/images/default-logo.svg';
  }
  return resolveImageUrl(logo);
}
