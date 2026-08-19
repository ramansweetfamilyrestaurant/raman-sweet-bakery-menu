export function generateQrToken(slug, type, num, secret) {
  const cleanSlug = String(slug || '').toLowerCase();
  const cleanType = String(type || 'table').toLowerCase();
  const cleanNum = String(num || '1');
  const cleanSecret = String(secret || 'tq_secure_sign');

  let hash = 0;
  const str = cleanSlug + ':' + cleanType + ':' + cleanNum + ':' + cleanSecret;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function verifyQrToken(slug, type, num, secret, token) {
  if (!token) return false;
  const expected = generateQrToken(slug, type, num, secret);
  return String(token).toLowerCase() === expected.toLowerCase();
}

export default { generateQrToken, verifyQrToken };
