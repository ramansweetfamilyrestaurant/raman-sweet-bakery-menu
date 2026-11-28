import React, { useEffect, useState } from 'react';
import { X, Check, Star, Printer, Share2, Receipt } from 'lucide-react';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';
import { resolveImageUrl } from '../utils/imageHelper';
import { triggerHaptic } from '../utils/haptics';
import { formatOrderBillNumber, resolveBusinessOrderNumber, resolveTakeawayToken } from '../utils/orderNumberHelper';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPaymentMethodLabel(method, isHi) {
  const clean = String(method || 'cash').toLowerCase();
  if (clean.includes('upi')) return isHi ? 'UPI भुगतान' : 'Paid via UPI';
  if (clean.includes('card')) return isHi ? 'कार्ड भुगतान' : 'Paid via Card';
  return isHi ? 'कैश भुगतान' : 'Paid via Cash';
}

function parseReceiptItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function BillCompletedModal({
  bill,
  info,
  lang = 'en',
  spaceLabel = '',
  canOrderAgain = false,
  orderAgainLabel = '',
  onOrderAgain,
  onOpenReview,
  onClose
}) {
  const isHi = lang === 'hi';
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!bill) return null;

  const summary = bill.bill_summary || bill;
  const sym = getCurrencySymbol(summary.currency_symbol || info?.currency_symbol);
  const rounds = Array.isArray(summary.rounds) && summary.rounds.length > 0
    ? summary.rounds
    : [{
        id: bill.id,
        round_number: Number(bill.round_number) || 1,
        items: parseReceiptItems(summary.items).length > 0 ? parseReceiptItems(summary.items) : parseReceiptItems(bill.items),
        subtotal_amount: Number(bill.subtotal_amount) || Number(bill.total_amount) || 0,
        tax_amount: Number(bill.tax_amount) || ((Number(bill.cgst_amount) || 0) + (Number(bill.sgst_amount) || 0)),
        grand_total_amount: Number(bill.grand_total_amount) || Number(bill.total_amount) || 0
      }];

  const hasExplicitSubtotal = summary.subtotal_amount !== undefined && summary.subtotal_amount !== null && Number.isFinite(Number(summary.subtotal_amount));
  const subtotal = hasExplicitSubtotal
    ? Number(summary.subtotal_amount)
    : rounds.reduce((acc, r) => acc + (Number(r.subtotal_amount) || 0), 0);
  const cgst = Number(summary.cgst_amount) || 0;
  const sgst = Number(summary.sgst_amount) || 0;
  const totalTax = Number(summary.tax_amount) > 0 ? Number(summary.tax_amount) : (cgst + sgst);
  const hasExplicitGrandTotal = summary.grand_total_amount !== undefined && summary.grand_total_amount !== null && Number.isFinite(Number(summary.grand_total_amount));
  const grandTotal = hasExplicitGrandTotal
    ? Number(summary.grand_total_amount)
    : (subtotal + totalTax);

  const paymentMethod = summary.payment_method || bill.payment_method || 'cash';
  const gstEnabled = Boolean(summary.gst_enabled || totalTax > 0);
  const gstinNumber = summary.gstin_number || info?.gstin_number || '';
  const settledTimestamp = summary.settled_at || bill.terminal_at || bill.created_at;
  const parsedSettledDate = settledTimestamp ? new Date(settledTimestamp) : null;
  const formattedTime = (parsedSettledDate && !isNaN(parsedSettledDate.getTime()))
    ? parsedSettledDate.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  const tokenCode = resolveTakeawayToken(bill);
  const billNumberText = formatOrderBillNumber(bill, gstEnabled);
  const plainOrderNum = resolveBusinessOrderNumber(bill);
  const cleanSpaceLabel = spaceLabel || (bill.table_number && String(bill.table_number).toLowerCase() !== 'counter' ? bill.table_number : '');
  const displaySpace = tokenCode
    ? (cleanSpaceLabel && !cleanSpaceLabel.toLowerCase().includes('counter') && !cleanSpaceLabel.includes(tokenCode)
        ? `${cleanSpaceLabel} • ${tokenCode}`
        : `${isHi ? 'टोकन' : 'Token'} ${tokenCode}`)
    : (spaceLabel || bill.table_number || '');

  const restoName = info?.name || 'TouchQR';
  const resolvedLogo = resolveImageUrl(info?.logo);
  const hasReviews = Boolean(info?.google_reviews_enabled);

  const buildPlainTextReceipt = () => {
    const lines = [
      `${restoName}`,
      billNumberText ? `${gstEnabled ? 'Invoice No' : 'Bill No'}: ${billNumberText}` : '',
      displaySpace ? `Space: ${displaySpace}` : '',
      formattedTime ? `Date: ${formattedTime}` : '',
      `${formatPaymentMethodLabel(paymentMethod, false)}`,
      '--------------------------------'
    ].filter(Boolean);

    rounds.forEach((r) => {
      if (rounds.length > 1) {
        lines.push(`Round ${r.round_number || 1}:`);
      }
      (r.items || []).forEach((item) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.price) || 0;
        const portion = item.portion ? ` (${item.portion})` : '';
        lines.push(`${qty}x ${item.name || item.dish_name || 'Item'}${portion} - ${sym}${formatPriceNumber(unitPrice * qty)}`);
      });
    });

    lines.push('--------------------------------');
    lines.push(`Subtotal: ${sym}${formatPriceNumber(subtotal)}`);
    if (totalTax > 0) {
      if (cgst > 0) lines.push(`CGST (2.5%): ${sym}${formatPriceNumber(cgst)}`);
      if (sgst > 0) lines.push(`SGST (2.5%): ${sym}${formatPriceNumber(sgst)}`);
      if (cgst <= 0 && sgst <= 0) lines.push(`GST / Tax: ${sym}${formatPriceNumber(totalTax)}`);
    }
    lines.push(`Grand Total Paid: ${sym}${formatPriceNumber(grandTotal)}`);
    if (gstEnabled && gstinNumber) {
      lines.push(`GSTIN: ${gstinNumber}`);
    }
    return lines.join('\n');
  };

  const handleShareOrCopy = async () => {
    triggerHaptic('light');
    const textReceipt = buildPlainTextReceipt();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${restoName} - Paid Receipt`,
          text: textReceipt
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textReceipt);
      } else {
        const ta = document.createElement('textarea');
        ta.value = textReceipt;
        ta.style.position = 'fixed';
        ta.style.left = '-999999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 1800);
    } catch (e) {}
  };

  const handlePrintReceipt = () => {
    triggerHaptic('light');
    const win = window.open('', '_blank', 'width=420,height=680');
    if (!win) {
      handleShareOrCopy();
      return;
    }

    const itemsHtml = rounds.map((r) => {
      const rHeader = rounds.length > 1
        ? `<div class="round-title">Round ${escapeHtml(r.round_number || 1)}</div>`
        : '';
      const rows = (r.items || []).map((item) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.price) || 0;
        const portion = item.portion ? ` (${escapeHtml(item.portion)})` : '';
        const mods = Array.isArray(item.modifiers) && item.modifiers.length > 0
          ? `<div class="mods">+ ${item.modifiers.map(m => escapeHtml(m && typeof m === 'object' ? m.name : m)).filter(Boolean).join(', ')}</div>`
          : '';
        return `
          <div class="row">
            <div><strong>${qty}x</strong> ${escapeHtml(item.name || item.dish_name || 'Item')}${portion}${mods}</div>
            <div class="amt">${escapeHtml(sym)}${escapeHtml(formatPriceNumber(unitPrice * qty))}</div>
          </div>
        `;
      }).join('');
      return `${rHeader}${rows}`;
    }).join('');

    const taxHtml = totalTax > 0
      ? (cgst > 0 || sgst > 0
          ? `<div class="row muted"><span>CGST (2.5%)</span><span>${escapeHtml(sym)}${escapeHtml(formatPriceNumber(cgst))}</span></div>
             <div class="row muted"><span>SGST (2.5%)</span><span>${escapeHtml(sym)}${escapeHtml(formatPriceNumber(sgst))}</span></div>`
          : `<div class="row muted"><span>Tax / GST</span><span>${escapeHtml(sym)}${escapeHtml(formatPriceNumber(totalTax))}</span></div>`)
      : '';

    const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(restoName)} Receipt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0F172A; margin: 0; padding: 20px; background: #fff; }
    .box { max-width: 340px; margin: 0 auto; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 16px; }
    h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
    .sub { font-size: 12px; color: #475569; text-align: center; margin-bottom: 12px; }
    .pill { display: inline-block; background: #ECFDF5; color: #047857; font-weight: 700; font-size: 11px; padding: 3px 10px; border-radius: 999px; margin-bottom: 10px; }
    .center { text-align: center; }
    .divider { border-top: 1px dashed #CBD5E1; margin: 10px 0; }
    .round-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin: 8px 0 4px; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; margin: 5px 0; }
    .mods { font-size: 11px; color: #64748B; margin-top: 2px; }
    .amt { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
    .muted { color: #475569; font-size: 12px; }
    .total { font-size: 16px; font-weight: 800; margin-top: 8px; }
    .foot { font-size: 11px; color: #64748B; text-align: center; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${escapeHtml(restoName)}</h1>
    <div class="sub">${billNumberText ? `${gstEnabled ? 'Invoice No:' : 'Bill No:'} ${escapeHtml(billNumberText)} • ` : ''}${displaySpace ? escapeHtml(displaySpace) + ' • ' : ''}${escapeHtml(formattedTime)}</div>
    <div class="center"><span class="pill">✓ ${escapeHtml(formatPaymentMethodLabel(paymentMethod, false))}</span></div>
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="row muted"><span>Subtotal</span><span>${escapeHtml(sym)}${escapeHtml(formatPriceNumber(subtotal))}</span></div>
    ${taxHtml}
    <div class="row total"><span>Grand Total Paid</span><span>${escapeHtml(sym)}${escapeHtml(formatPriceNumber(grandTotal))}</span></div>
    ${gstEnabled && gstinNumber ? `<div class="foot">GSTIN: ${escapeHtml(gstinNumber)}</div>` : ''}
    <div class="foot">Thank you for visiting ${escapeHtml(restoName)}!</div>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
    win.document.open();
    win.document.write(htmlDoc);
    win.document.close();
  };

  return (
    <div
      onClick={() => onClose && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(7px)',
        zIndex: 10035,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        animation: 'sheetBackdropFade 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--theme-modal-bg, #FFFFFF)',
          color: 'var(--text-dark, #0F172A)',
          borderRadius: '24px 24px 0 0',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1.5px solid var(--theme-modal-border, rgba(226, 232, 240, 0.9))',
          borderBottom: 'none',
          boxShadow: '0 -14px 44px rgba(0, 0, 0, 0.42)',
          animation: 'sheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Paid Header Strip */}
        <div style={{
          background: 'var(--header-gradient, linear-gradient(135deg, #064E3B 0%, #059669 100%))',
          color: '#FFFFFF',
          padding: '14px 18px 16px',
          position: 'relative',
          flexShrink: 0
        }}>
          <button
            type="button"
            className="tq-tap"
            aria-label="Close receipt"
            onClick={() => { triggerHaptic('light'); if (onClose) onClose(); }}
            style={{
              position: 'absolute',
              top: '12px',
              right: '14px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.28)',
              background: 'rgba(255,255,255,0.16)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '36px' }}>
            <div
              className="tq-check-ripple"
              style={{
                position: 'relative',
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#10B981',
                border: '2px solid rgba(255,255,255,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 6px 18px rgba(16, 185, 129, 0.45)',
                animation: 'tqPopIn 0.34s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <Check size={24} strokeWidth={3} color="#FFFFFF" />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#A7F3D0' }}>
                {formatPaymentMethodLabel(paymentMethod, isHi)}
              </div>
              <h2 style={{ margin: '2px 0 0', fontSize: '1.16rem', fontWeight: 900, lineHeight: 1.25, color: '#FFFFFF' }}>
                {isHi ? 'बिल भुगतान सफल • धन्यवाद!' : 'Bill Settled • Thank You!'}
              </h2>
              <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.86)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {resolvedLogo && (
                  <img
                    src={resolvedLogo}
                    alt={restoName}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <span style={{ fontWeight: 700 }}>{restoName}</span>
                {displaySpace && <span>• {displaySpace}</span>}
                {formattedTime && <span>• {formattedTime}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Itemized Bill & Review CTA */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Consolidated Bill Card */}
          <div style={{
            background: 'var(--theme-card-bg, var(--bg-secondary, #F8FAFC))',
            border: '1px solid var(--theme-card-border, var(--border-light, #E2E8F0))',
            borderRadius: '16px',
            padding: '12px 14px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '8px',
              marginBottom: '8px',
              borderBottom: '1px dashed var(--border-light, #CBD5E1)'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dark, #0F172A)', flexWrap: 'wrap' }}>
                <Receipt size={15} />
                {isHi ? 'डिजिटल बिल रसीद' : 'Digital Bill Summary'}
                {(billNumberText || plainOrderNum) && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, padding: '1px 7px', borderRadius: '9999px', background: 'rgba(15, 23, 42, 0.08)', color: 'var(--text-dark, #0F172A)' }}>
                    {gstEnabled ? `${isHi ? 'इनवॉइस नं.' : 'Invoice No:'} ${billNumberText}` : `${isHi ? 'बिल नं.' : 'Bill No:'} ${billNumberText || plainOrderNum}`}
                  </span>
                )}
              </span>
              {rounds.length > 1 && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: '#ECFDF5',
                  color: '#047857'
                }}>
                  {isHi ? `${rounds.length} राउंड शामिल` : `${rounds.length} Rounds Merged`}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rounds.map((r, rIdx) => (
                <div key={r.id || rIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rounds.length > 1 && (
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: rIdx > 0 ? '4px' : 0 }}>
                      {isHi ? `राउंड ${r.round_number || rIdx + 1}` : `Round ${r.round_number || rIdx + 1}`}
                    </div>
                  )}
                  {(r.items || []).map((item, idx) => {
                    const qty = Number(item.quantity) || 1;
                    const lineTotal = (Number(item.price) || 0) * qty;
                    const mods = Array.isArray(item.modifiers) ? item.modifiers : [];
                    return (
                      <div key={`${idx}_${item.name || ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-dark, #0F172A)', lineHeight: 1.35 }}>
                            <span>{qty}× </span>
                            <span>{item.name || item.dish_name || 'Item'}</span>
                            {item.portion && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', marginLeft: '5px' }}>
                                ({item.portion})
                              </span>
                            )}
                          </div>
                          {mods.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', marginTop: '1px' }}>
                              + {mods.map(m => (m && typeof m === 'object' ? m.name : m) || '').filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-dark, #0F172A)' }}>
                          {sym}{formatPriceNumber(lineTotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed var(--border-light, #CBD5E1)', marginTop: '10px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #475569)' }}>
                <span>{isHi ? 'सबटोटल' : 'Subtotal'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{sym}{formatPriceNumber(subtotal)}</span>
              </div>
              {totalTax > 0 && (
                cgst > 0 || sgst > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #475569)' }}>
                      <span>CGST (2.5%)</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{sym}{formatPriceNumber(cgst)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #475569)' }}>
                      <span>SGST (2.5%)</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{sym}{formatPriceNumber(sgst)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #475569)' }}>
                    <span>{isHi ? 'जीएसटी / टैक्स' : 'GST / Tax'}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{sym}{formatPriceNumber(totalTax)}</span>
                  </div>
                )
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '1.5px solid var(--border-light, #CBD5E1)',
                fontSize: '1rem',
                fontWeight: 900,
                color: 'var(--text-dark, #0F172A)'
              }}>
                <span>{isHi ? 'कुल भुगतान राशि' : 'Grand Total Paid'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--theme-price-color, #059669)' }}>
                  {sym}{formatPriceNumber(grandTotal)}
                </span>
              </div>

              {gstEnabled && gstinNumber && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                  GSTIN: {gstinNumber}
                </div>
              )}
            </div>
          </div>

          {/* Save / Print & Share Receipt Utility Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="tq-tap"
              onClick={handlePrintReceipt}
              style={{
                background: 'var(--theme-card-bg, var(--bg-secondary, #F1F5F9))',
                color: 'var(--text-dark, #0F172A)',
                border: '1px solid var(--theme-card-border, var(--border-light, #CBD5E1))',
                borderRadius: 'var(--radius-pill)',
                padding: '9px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Printer size={14} />
              <span>{isHi ? 'बिल सेव / प्रिंट' : 'Save / Print'}</span>
            </button>
            <button
              type="button"
              className="tq-tap"
              onClick={handleShareOrCopy}
              style={{
                background: 'var(--theme-card-bg, var(--bg-secondary, #F1F5F9))',
                color: 'var(--text-dark, #0F172A)',
                border: '1px solid var(--theme-card-border, var(--border-light, #CBD5E1))',
                borderRadius: 'var(--radius-pill)',
                padding: '9px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Share2 size={14} />
              <span>
                {copiedReceipt
                  ? (isHi ? 'रसीद कॉपी हुई ✓' : 'Copied ✓')
                  : (isHi ? 'रसीद शेयर करें' : 'Share Receipt')}
              </span>
            </button>
          </div>

          {/* Golden Moment Review Card */}
          {hasReviews && onOpenReview && (
            <div style={{
              background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
              border: '1px solid #F59E0B',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              color: '#78350F'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Star size={15} fill="#F59E0B" color="#B45309" />
                  <span>{isHi ? 'हमारा अनुभव कैसा रहा?' : 'Enjoyed your experience?'}</span>
                </div>
                <div style={{ fontSize: '0.73rem', fontWeight: 600, marginTop: '2px', opacity: 0.9 }}>
                  {isHi ? 'आपका 10-सेकंड का फीडबैक हमारे लिए बहुत मायने रखता है।' : 'Share a quick 10-second rating with us!'}
                </div>
              </div>
              <button
                type="button"
                className="tq-tap"
                onClick={() => {
                  triggerHaptic('medium');
                  if (onClose) onClose();
                  onOpenReview();
                }}
                style={{
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 13px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {isHi ? 'रेट करें ⭐' : 'Rate Us ⭐'}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Sticky CTA */}
        <div style={{
          padding: '12px 18px calc(16px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--border-light, #E2E8F0)',
          background: 'var(--theme-modal-bg, #FFFFFF)',
          display: 'flex',
          gap: '10px',
          flexShrink: 0
        }}>
          {canOrderAgain && onOrderAgain ? (
            <>
              <button
                type="button"
                className="tq-tap"
                onClick={() => { triggerHaptic('light'); if (onClose) onClose(); }}
                style={{
                  flex: 1,
                  background: 'var(--theme-card-bg, var(--bg-secondary, #F1F5F9))',
                  color: 'var(--text-dark, #0F172A)',
                  border: '1px solid var(--theme-card-border, var(--border-light, #CBD5E1))',
                  borderRadius: 'var(--radius-pill)',
                  padding: '12px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                {isHi ? 'ठीक है' : 'Done'}
              </button>
              <button
                type="button"
                className="tq-tap"
                onClick={() => { triggerHaptic('medium'); onOrderAgain(); }}
                style={{
                  flex: 1.5,
                  background: 'var(--header-gradient, #0F172A)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '12px',
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.22)'
                }}
              >
                {orderAgainLabel || (isHi ? 'फिर से ऑर्डर करें ⚡' : 'Order Again ⚡')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="tq-tap"
              onClick={() => { triggerHaptic('light'); if (onClose) onClose(); }}
              style={{
                width: '100%',
                background: 'var(--header-gradient, #0F172A)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '12px',
                fontWeight: 900,
                fontSize: '0.92rem',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)'
              }}
            >
              {isHi ? 'ठीक है • मेनू देखें' : 'Done • Browse Menu'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
