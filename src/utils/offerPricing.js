/**
 * Canonical Offer Pricing Calculator shared across public menu API, checkout, and admin preview.
 */
export function roundOfferCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateOfferPrice(basePrice, offer, sym = '₹') {
  const numBase = Number(basePrice);
  if (!offer || !Number.isFinite(numBase) || numBase <= 0) return null;
  if (
    offer.value === null ||
    offer.value === undefined ||
    offer.value === '' ||
    typeof offer.value === 'boolean'
  ) {
    return null;
  }
  const rawValue = Number(offer.value);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return null;
  }

  let cleanSym = '₹';
  if (sym !== undefined && sym !== null) {
    const s = String(sym).trim();
    if (s.toLowerCase() === 'none' || s.toLowerCase() === 'hidden') {
      cleanSym = '';
    } else if (s) {
      cleanSym = s;
    }
  }

  let discounted = numBase;
  let badge = '';

  if (offer.type === 'percentage') {
    const pct = Math.min(100, Math.max(0, rawValue));
    const discAmt = roundOfferCurrency((numBase * pct) / 100);
    discounted = Math.max(0, roundOfferCurrency(numBase - discAmt));
    badge = `${pct}% OFF`;
  } else if (offer.type === 'flat') {
    const flatVal = Math.max(0, rawValue);
    const discAmt = roundOfferCurrency(Math.min(numBase, flatVal));
    discounted = Math.max(0, roundOfferCurrency(numBase - discAmt));
    badge = cleanSym ? `${cleanSym}${flatVal} OFF` : `${flatVal} OFF`;
  } else if (offer.type === 'special_price') {
    const targetPrice = Math.max(0, roundOfferCurrency(rawValue));
    if (!Number.isFinite(targetPrice) || targetPrice >= numBase) {
      return null;
    }
    discounted = targetPrice;
    badge = 'Special Price';
  } else {
    return null;
  }

  if (discounted >= numBase) {
    return null;
  }

  return {
    offer_id: offer.id,
    offer_name: offer.name,
    offer_type: offer.type,
    offer_value: offer.value,
    offer_badge: badge,
    offer_price: discounted,
    regular_price: numBase,
    discount_amount: Math.max(0, roundOfferCurrency(numBase - discounted)),
    starts_at: offer.starts_at || null,
    ends_at: offer.ends_at || null
  };
}
