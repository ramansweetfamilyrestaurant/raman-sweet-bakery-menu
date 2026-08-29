/**
 * Safe Currency & Price Formatting Helper
 * Properly respects empty string '' or 'none' (No Currency Symbol).
 * Formats price numbers cleanly without trailing .00 decimals (e.g. 50 instead of 50.00).
 */
export function getCurrencySymbol(symbol) {
  if (symbol === undefined || symbol === null) return '₹';
  const str = String(symbol).trim();
  if (str === '' || str.toLowerCase() === 'none') return '';
  return str;
}

export function formatPriceNumber(amount) {
  if (amount === undefined || amount === null || amount === '') return '0';
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  if (num % 1 === 0) {
    return Math.round(num).toLocaleString('en-IN');
  }
  const rounded = Number(num.toFixed(2));
  return (rounded % 1 === 0) ? Math.round(rounded).toLocaleString('en-IN') : rounded.toLocaleString('en-IN');
}

export function formatPrice(amount, symbol) {
  const sym = getCurrencySymbol(symbol);
  return `${sym}${formatPriceNumber(amount)}`;
}
