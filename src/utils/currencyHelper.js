/**
 * Safe Currency Helper
 * Properly respects empty string '' (No Currency Symbol).
 * Defaults to '₹' ONLY if symbol is null or undefined.
 */
export function getCurrencySymbol(symbol) {
  if (symbol !== undefined && symbol !== null) {
    return symbol;
  }
  return '₹';
}

export function formatPrice(amount, symbol) {
  const sym = getCurrencySymbol(symbol);
  return `${sym}${amount}`;
}
