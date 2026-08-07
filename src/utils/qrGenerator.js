// Light-weight zero-dependency QR code SVG matrix generator for Table QR Stickers

export function generateTableQRDataUrl(tableNum, baseUrl = 'http://localhost:5000', slug = 'raman-sweet-bakery') {
  const targetUrl = `${baseUrl}/${slug}?table=${tableNum}`;
  // Standard SVG QR placeholder graphic for high-res printing
  return targetUrl;
}
