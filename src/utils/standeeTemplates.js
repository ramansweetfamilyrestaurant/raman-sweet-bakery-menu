/**
 * TouchQR — Standee Templates and Unified Rendering Engine
 * Provides shared theme palettes, HTML generators, print document builders,
 * and high-resolution canvas rendering for single/bulk physical QR standees.
 */

export const STANDEE_THEMES = {
  emerald: {
    id: 'emerald',
    name: 'Emerald & Gold',
    badgeBg: '#0A2315',
    badgeText: '#DFBA67',
    badgeBorder: '#D4AF37',
    cardBg: '#FFFFFF',
    cardBorder: '#D4AF37',
    innerBorder: '#E5C07B',
    titleColor: '#0A2315',
    dividerColor: '#D4AF37',
    subtitleColor: '#15803D',
    accentColor: '#059669',
    qrBoxBorder: '#E2E8F0',
    qrBoxBg: '#FFFFFF',
    pillBg: '#0A2315',
    pillText: '#DFBA67',
    pillBorder: '#D4AF37',
    instructionEn: '#0A2315',
    instructionHi: '#64748B',
    stepBg: '#FAF8F5',
    stepBorder: '#EAE5DF',
    stepText: '#334155',
    isDark: false
  },
  slate: {
    id: 'slate',
    name: 'Luxury Slate',
    badgeBg: '#1E293B',
    badgeText: '#F8FAFC',
    badgeBorder: '#475569',
    cardBg: '#0F172A',
    cardBorder: '#334155',
    innerBorder: '#475569',
    titleColor: '#FFFFFF',
    dividerColor: '#475569',
    subtitleColor: '#94A3B8',
    accentColor: '#38BDF8',
    qrBoxBorder: '#334155',
    qrBoxBg: '#FFFFFF',
    pillBg: '#1E293B',
    pillText: '#F8FAFC',
    pillBorder: '#475569',
    instructionEn: '#F1F5F9',
    instructionHi: '#94A3B8',
    stepBg: '#1E293B',
    stepBorder: '#334155',
    stepText: '#CBD5E1',
    isDark: true
  },
  royal: {
    id: 'royal',
    name: 'Royal Navy',
    badgeBg: '#0B192C',
    badgeText: '#F4CE14',
    badgeBorder: '#F4CE14',
    cardBg: '#FFFFFF',
    cardBorder: '#F4CE14',
    innerBorder: '#E0C097',
    titleColor: '#0B192C',
    dividerColor: '#F4CE14',
    subtitleColor: '#1E3E62',
    accentColor: '#0284C7',
    qrBoxBorder: '#E2E8F0',
    qrBoxBg: '#FFFFFF',
    pillBg: '#0B192C',
    pillText: '#F4CE14',
    pillBorder: '#F4CE14',
    instructionEn: '#0B192C',
    instructionHi: '#64748B',
    stepBg: '#F0F9FF',
    stepBorder: '#BAE6FD',
    stepText: '#0369A1',
    isDark: false
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Modern',
    badgeBg: '#18181B',
    badgeText: '#FFFFFF',
    badgeBorder: '#27272A',
    cardBg: '#FFFFFF',
    cardBorder: '#E4E4E7',
    innerBorder: '#F4F4F5',
    titleColor: '#09090B',
    dividerColor: '#D4D4D8',
    subtitleColor: '#71717A',
    accentColor: '#09090B',
    qrBoxBorder: '#E4E4E7',
    qrBoxBg: '#FFFFFF',
    pillBg: '#18181B',
    pillText: '#FFFFFF',
    pillBorder: '#27272A',
    instructionEn: '#09090B',
    instructionHi: '#71717A',
    stepBg: '#F4F4F5',
    stepBorder: '#E4E4E7',
    stepText: '#27272A',
    isDark: false
  }
};

export const STANDEE_FRAMES = {
  acrylic: {
    id: 'acrylic',
    name: 'Modern Acrylic',
    borderWidth: '3.5px',
    borderRadius: '26px',
    hasInnerFrame: true,
    hasGlare: true
  },
  wood: {
    id: 'wood',
    name: 'Wood Stand',
    borderWidth: '5px',
    borderRadius: '20px',
    hasInnerFrame: true,
    hasGlare: false
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Border',
    borderWidth: '1.5px',
    borderRadius: '16px',
    hasInnerFrame: false,
    hasGlare: false
  }
};

/**
 * Builds HTML string for a single standee card markup.
 */
export function buildStandeeCardHtml({
  space,
  restaurant = {},
  themeId = 'emerald',
  frameStyle = 'acrylic',
  qrDataUrl = '',
  showReassurance = true
}) {
  const theme = STANDEE_THEMES[themeId] || STANDEE_THEMES.emerald;
  const frame = STANDEE_FRAMES[frameStyle] || STANDEE_FRAMES.acrylic;

  const currentName = restaurant.name || 'Digital Menu';
  const isCinema = space.spaceType === 'cinema_seat' || space.spaceType === 'cinema';
  const currentTagline = restaurant.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu');
  const badgeLabel = space.badge || space.label || 'TABLE';

  const innerFrameHtml = frame.hasInnerFrame
    ? `<div class="inner-frame" style="border-color: ${theme.innerBorder};"></div>`
    : '';

  const glareHtml = frame.hasGlare
    ? `<div class="acrylic-glare"></div>`
    : '';

  const reassuranceHtml = showReassurance
    ? `<div class="reassurance" style="color: ${theme.accentColor};">⚡ Instant Digital Menu • No App Required</div>`
    : '';

  const watermarkHtml = !restaurant.watermark_removal_enabled
    ? `<div class="touchqr-watermark" style="color: ${theme.subtitleColor}; font-weight: 800; font-size: 0.65rem; margin-top: 4px;">⚡ Powered by TouchQR</div>`
    : '';

  const footerContact = [
    restaurant.address,
    restaurant.phone ? `Phone: ${restaurant.phone}` : null
  ].filter(Boolean).join(' • ');

  return `
    <div class="standee-card ${theme.isDark ? 'theme-dark' : 'theme-light'}" style="
      background-color: ${theme.cardBg};
      border: ${frame.borderWidth} solid ${theme.cardBorder};
      border-radius: ${frame.borderRadius};
    ">
      ${glareHtml}
      ${innerFrameHtml}
      <div class="table-badge" style="
        background-color: ${theme.badgeBg};
        color: ${theme.badgeText};
        border: 1.5px solid ${theme.badgeBorder};
      ">
        ✦ ${badgeLabel} ✦
      </div>
      <h2 class="logo-title" style="color: ${theme.titleColor};">${escapeHtml(currentName)}</h2>
      <div class="gold-divider" style="color: ${theme.dividerColor};">── ◆ ──</div>
      <div class="subtitle" style="color: ${theme.subtitleColor};">${escapeHtml(currentTagline)}</div>
      <div class="qr-box" style="
        background-color: ${theme.qrBoxBg};
        border: 1.5px solid ${theme.qrBoxBorder};
      ">
        <div class="scan-pill" style="
          background-color: ${theme.pillBg};
          color: ${theme.pillText};
          border: 1px solid ${theme.pillBorder};
        ">
          SCAN TO ORDER
        </div>
        <img src="${qrDataUrl}" alt="${escapeHtml(badgeLabel)} QR Code" />
      </div>
      <div class="instruction-en" style="color: ${theme.instructionEn};">📱 POINT CAMERA AT QR TO ORDER</div>
      <div class="instruction-hi" style="color: ${theme.instructionHi};">${isCinema ? 'स्कैन करें और सीट पर खाना मंगाएं' : 'कैमरे से स्कैन करें और स्वादिष्ट खाना ऑर्डर करें'}</div>
      <div class="steps-bar" style="
        background-color: ${theme.stepBg};
        border: 1px solid ${theme.stepBorder};
        color: ${theme.stepText};
      ">
        ① Open Camera &nbsp;➔&nbsp; ② Scan QR &nbsp;➔&nbsp; ③ Order Food
      </div>
      ${reassuranceHtml}
      <div class="footer-info" style="color: ${theme.isDark ? '#94A3B8' : '#64748B'};">
        ${footerContact ? `<div>${escapeHtml(footerContact)}</div>` : ''}
        ${watermarkHtml}
      </div>
    </div>
  `;
}

/**
 * Builds complete printable HTML document with explicit A4 pagination.
 * Avoids page cuts: groups cards cleanly and applies break-inside: avoid.
 */
export function generateStandeePrintDocument({
  cards = [],
  restaurant = {},
  themeId = 'emerald',
  frameStyle = 'acrylic',
  showReassurance = true,
  isBulk = false
}) {
  const currentName = restaurant.name || 'Digital Menu';

  // Group cards: 2 cards per A4 page to guarantee no page slicing
  const pagesHtml = [];
  const cardsPerPage = 2;

  for (let i = 0; i < cards.length; i += cardsPerPage) {
    const chunk = cards.slice(i, i + cardsPerPage);
    const chunkMarkup = chunk.map(c => buildStandeeCardHtml({
      space: c.space,
      restaurant,
      themeId,
      frameStyle,
      qrDataUrl: c.qrDataUrl,
      showReassurance
    })).join('\n');

    pagesHtml.push(`
      <div class="a4-print-page">
        ${chunkMarkup}
      </div>
    `);
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(currentName)} — TouchQR Standee Print</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
      
      @page {
        size: A4 portrait;
        margin: 10mm;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        background-color: #F8FAFC;
        font-family: 'Plus Jakarta Sans', sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .a4-print-page {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 20px;
        min-height: 250mm;
        page-break-after: always;
        break-after: page;
        padding: 10px 0;
      }

      .a4-print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .standee-card {
        width: 310px;
        padding: 24px 18px 18px 18px;
        text-align: center;
        position: relative;
        box-sizing: border-box;
        page-break-inside: avoid;
        break-inside: avoid;
        box-shadow: 0 4px 14px rgba(0,0,0,0.06);
      }

      .acrylic-glare {
        position: absolute;
        top: 0;
        right: 0;
        width: 90px;
        height: 90px;
        background: radial-gradient(circle at top right, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%);
        border-radius: 0 24px 0 0;
        pointer-events: none;
      }

      .inner-frame {
        position: absolute;
        top: 6px;
        left: 6px;
        right: 6px;
        bottom: 6px;
        border: 1.5px solid;
        border-radius: 18px;
        pointer-events: none;
      }

      .table-badge {
        display: inline-block;
        padding: 5px 16px;
        border-radius: 20px;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.12);
        margin-bottom: 8px;
      }

      .logo-title {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.15rem;
        font-weight: 900;
        letter-spacing: -0.2px;
        line-height: 1.25;
        margin: 0 0 4px 0;
      }

      .gold-divider {
        font-size: 0.65rem;
        letter-spacing: 3px;
        margin: 2px 0 4px 0;
      }

      .subtitle {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-bottom: 10px;
      }

      .qr-box {
        padding: 12px;
        border-radius: 16px;
        display: inline-block;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        position: relative;
      }

      .scan-pill {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.60rem;
        font-weight: 900;
        padding: 2px 9px;
        border-radius: 9px;
        white-space: nowrap;
      }

      .qr-box img {
        width: 175px;
        height: 175px;
        display: block;
      }

      .instruction-en {
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.3px;
        margin-bottom: 2px;
      }

      .instruction-hi {
        font-size: 0.72rem;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .steps-bar {
        border-radius: 8px;
        padding: 4px 6px;
        font-size: 0.62rem;
        font-weight: 800;
        margin-bottom: 6px;
      }

      .reassurance {
        font-size: 0.62rem;
        font-weight: 800;
        margin-bottom: 6px;
      }

      .footer-info {
        border-top: 1px solid rgba(0,0,0,0.08);
        padding-top: 8px;
        font-size: 0.65rem;
        line-height: 1.35;
      }

      @media print {
        body {
          background-color: transparent;
        }
        .a4-print-page {
          min-height: auto;
          height: 100vh;
        }
      }
    </style>
  </head>
  <body>
    ${pagesHtml.join('\n')}
    <script>
      window.onload = function() {
        // Wait for all images to render before printing
        var images = document.images;
        var loaded = 0;
        var total = images.length;
        if (total === 0) {
          window.print();
        } else {
          for (var i = 0; i < total; i++) {
            if (images[i].complete) {
              loaded++;
              if (loaded === total) window.print();
            } else {
              images[i].addEventListener('load', function() {
                loaded++;
                if (loaded === total) window.print();
              });
              images[i].addEventListener('error', function() {
                loaded++;
                if (loaded === total) window.print();
              });
            }
          }
        }
      };
    </script>
  </body>
</html>`;
}

/**
 * Wraps text into multiple centered lines given a maximum canvas width.
 * Splits long unbroken words if needed to prevent border overflow.
 */
export function wrapCanvasText(ctx, text, maxWidth) {
  if (!text) return [];
  const str = String(text).trim();
  if (!str) return [];

  const words = str.split(/\s+/);
  if (words.length === 0) return [];

  // If entire text fits on one line:
  if (ctx.measureText(str).width <= maxWidth) {
    return [str];
  }

  // If text would fit in 2 lines, find the optimal balanced break point
  // to prevent awkward orphan words and match live preview typography:
  if (words.length > 2) {
    let bestSplitIndex = -1;
    let minDiff = Infinity;
    const isolatedConjunctions = new Set(['&', '+', 'and', 'or', 'et']);

    for (let i = 1; i < words.length; i++) {
      const line1 = words.slice(0, i).join(' ');
      const line2 = words.slice(i).join(' ');
      const w1 = ctx.measureText(line1).width;
      const w2 = ctx.measureText(line2).width;

      if (w1 <= maxWidth && w2 <= maxWidth) {
        let penalty = 0;

        // Strongly disfavor isolated conjunctions leading line 2 (e.g. '& Family Restaurant')
        const firstWordLine2 = words[i].toLowerCase();
        if (isolatedConjunctions.has(firstWordLine2)) {
          penalty += 250;
        }

        // Favorable weight for keeping '&' or 'and' at the end of line 1 (e.g. 'Raman Sweet Bakery &')
        const lastWordLine1 = words[i - 1].toLowerCase();
        if (isolatedConjunctions.has(lastWordLine1)) {
          penalty -= 60;
        }

        const diff = Math.abs(w1 - w2) + penalty;
        if (diff < minDiff) {
          minDiff = diff;
          bestSplitIndex = i;
        }
      }
    }

    if (bestSplitIndex !== -1) {
      return [
        words.slice(0, bestSplitIndex).join(' '),
        words.slice(bestSplitIndex).join(' ')
      ];
    }
  }

  // Standard greedy wrapping for 3+ lines or edge cases:
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (ctx.measureText(word).width > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      let chunk = '';
      for (let c = 0; c < word.length; c++) {
        const testChunk = chunk + word[c];
        if (ctx.measureText(testChunk).width <= maxWidth) {
          chunk = testChunk;
        } else {
          if (chunk) lines.push(chunk);
          chunk = word[c];
        }
      }
      currentLine = chunk;
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Draws a high-resolution 300 DPI acrylic standee card on HTML5 Canvas.
 * Matches live preview hierarchy, balanced vertical rhythm, and text wrapping.
 */
export async function renderStandeeToCanvas(canvas, {
  space,
  restaurant = {},
  themeId = 'emerald',
  frameStyle = 'acrylic',
  qrDataUrl = '',
  targetWidth = 1200,
  targetHeight = 1650,
  showReassurance = true
}) {
  const theme = STANDEE_THEMES[themeId] || STANDEE_THEMES.emerald;
  const frame = STANDEE_FRAMES[frameStyle] || STANDEE_FRAMES.acrylic;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const scale = targetWidth / 800;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Standee Background
  ctx.fillStyle = theme.cardBg;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2. Outer Border (Width tuned to selected frame style)
  let outerBorderWidth = 8 * scale;
  if (frameStyle === 'wood') {
    outerBorderWidth = 14 * scale;
  } else if (frameStyle === 'minimal') {
    outerBorderWidth = 4 * scale;
  }
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = outerBorderWidth;
  ctx.strokeRect(
    outerBorderWidth,
    outerBorderWidth,
    targetWidth - (outerBorderWidth * 2),
    targetHeight - (outerBorderWidth * 2)
  );

  // 3. Inner Hairline Border (only if frame.hasInnerFrame)
  if (frame.hasInnerFrame) {
    ctx.strokeStyle = theme.innerBorder;
    ctx.lineWidth = 2.5 * scale;
    const innerInset = 24 * scale;
    ctx.strokeRect(
      innerInset,
      innerInset,
      targetWidth - (innerInset * 2),
      targetHeight - (innerInset * 2)
    );
  }

  // 4. Glare effect in top-right (only if frame.hasGlare)
  if (frame.hasGlare) {
    const glareRadius = 300 * scale;
    const glareGrad = ctx.createRadialGradient(targetWidth, 0, 0, targetWidth, 0, glareRadius);
    glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glareGrad;
    ctx.fillRect(targetWidth - glareRadius, 0, glareRadius, glareRadius);
  }

  // Safe inner content width (never touches inner border of 24*scale)
  const maxSafeTextWidth = targetWidth - (180 * scale);

  // Measure Restaurant Title & Wrap
  const rawName = restaurant.name || 'Digital Menu';
  let titleFontSize = 36 * scale;
  if (rawName.length > 42) {
    titleFontSize = 29 * scale;
  } else if (rawName.length > 22) {
    titleFontSize = 33 * scale;
  }

  ctx.font = `bold ${titleFontSize}px "Playfair Display", Georgia, serif`;
  let titleLines = wrapCanvasText(ctx, rawName, maxSafeTextWidth);

  if (titleLines.length > 2 && titleFontSize > 26 * scale) {
    titleFontSize = 26 * scale;
    ctx.font = `bold ${titleFontSize}px "Playfair Display", Georgia, serif`;
    titleLines = wrapCanvasText(ctx, rawName, maxSafeTextWidth);
  }
  const titleLineHeight = Math.round(titleFontSize * 1.25);

  // Measure Tagline & Wrap
  const isCinema = space.spaceType === 'cinema_seat' || space.spaceType === 'cinema';
  const taglineText = restaurant.tagline || (isCinema ? 'IN-SEAT FOOD ORDERING' : 'SCAN QR CODE FOR DIGITAL MENU');
  const taglineFontSize = 18 * scale;
  ctx.font = `bold ${taglineFontSize}px "Plus Jakarta Sans", sans-serif`;
  const taglineLines = wrapCanvasText(ctx, taglineText.toUpperCase(), maxSafeTextWidth);
  const taglineLineHeight = Math.round(24 * scale);

  // Measure Contact & Wrap
  const contactParts = [
    restaurant.address,
    restaurant.phone ? `Phone: ${restaurant.phone}` : null
  ].filter(Boolean);
  const contactText = contactParts.join(' • ');
  const contactFontSize = 15.5 * scale;
  ctx.font = `bold ${contactFontSize}px "Plus Jakarta Sans", sans-serif`;
  const contactLines = wrapCanvasText(ctx, contactText, maxSafeTextWidth);
  const contactLineHeight = Math.round(21 * scale);

  // Component Sizing (Carefully proportioned to 1200x1650 to match preview)
  const badgeHeight = 42 * scale;
  const dividerHeight = 16 * scale;
  const qrBoxSize = 475 * scale;
  const qrImgSize = 405 * scale;
  const pillHeight = 32 * scale;
  const stepHeight = 36 * scale;
  const instructionEnHeight = 26 * scale;
  const instructionHiHeight = 21 * scale;
  const reassuranceHeight = showReassurance ? (18 * scale) : 0;
  const watermarkHeight = !restaurant.watermark_removal_enabled ? (18 * scale) : 0;

  // Intrinsic Group Heights
  const headerGaps = (18 * scale) + (14 * scale) + (14 * scale);
  const headerHeight = badgeHeight + (titleLines.length * titleLineHeight) + dividerHeight + (taglineLines.length * taglineLineHeight) + headerGaps;

  const qrHeight = qrBoxSize;

  const instGaps = (12 * scale) + (16 * scale) + (showReassurance ? (14 * scale) : 0);
  const instructionsHeight = instructionEnHeight + instructionHiHeight + stepHeight + reassuranceHeight + instGaps;

  const footerLineHeight = 2 * scale;
  let footerGaps = 0;
  if (contactLines.length > 0) footerGaps += 16 * scale;
  if (watermarkHeight > 0) footerGaps += (contactLines.length > 0 ? 12 * scale : 14 * scale);
  const footerHeight = footerLineHeight + (contactLines.length * contactLineHeight) + watermarkHeight + footerGaps;

  // Total Intrinsic Content Height
  const totalContentHeight = headerHeight + qrHeight + instructionsHeight + footerHeight;
  const totalGapsAvailable = targetHeight - totalContentHeight;

  // Proportional Vertical Gap Allocation (Matches live preview compactness)
  const topMargin = Math.max(50 * scale, Math.round(totalGapsAvailable * 0.27));
  const bottomMargin = Math.max(55 * scale, Math.round(totalGapsAvailable * 0.27));
  const remainingInternal = Math.max(50 * scale, totalGapsAvailable - topMargin - bottomMargin);

  // Compact spacing between reassurance and footer divider to closely match live preview
  const gapInstructionsToFooter = Math.round(Math.min(22 * scale, Math.max(16 * scale, remainingInternal * 0.18)));
  const remainingForQrGaps = remainingInternal - gapInstructionsToFooter;

  const gapHeaderToQr = Math.round(remainingForQrGaps * 0.52);
  const gapQrToInstructions = remainingForQrGaps - gapHeaderToQr;

  // -------------------------------------------------------------
  // RENDERING ELEMENTS SEQUENTIALLY WITH ADAPTIVE FLOW
  // -------------------------------------------------------------
  let curY = topMargin;

  // 5. Space Badge Pill
  const badgeText = `✦ ${space.badge || space.label || 'TABLE'} ✦`;
  ctx.font = `bold ${22 * scale}px "Plus Jakarta Sans", sans-serif`;
  const badgeWidth = ctx.measureText(badgeText).width + (48 * scale);
  const badgeX = (targetWidth - badgeWidth) / 2;

  ctx.fillStyle = theme.badgeBg;
  drawRoundRect(ctx, badgeX, curY, badgeWidth, badgeHeight, 21 * scale);
  ctx.fill();

  ctx.strokeStyle = theme.badgeBorder;
  ctx.lineWidth = 2.5 * scale;
  drawRoundRect(ctx, badgeX, curY, badgeWidth, badgeHeight, 21 * scale);
  ctx.stroke();

  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, targetWidth / 2, curY + (badgeHeight / 2));

  curY += badgeHeight + (18 * scale);

  // 6. Restaurant Title (Wrapped Centered Lines)
  ctx.fillStyle = theme.titleColor;
  ctx.font = `bold ${titleFontSize}px "Playfair Display", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < titleLines.length; i++) {
    const lineY = curY + (i * titleLineHeight) + (titleLineHeight / 2);
    ctx.fillText(titleLines[i], targetWidth / 2, lineY);
  }
  curY += (titleLines.length * titleLineHeight) + (14 * scale);

  // 7. Gold / Theme Divider
  ctx.fillStyle = theme.dividerColor;
  ctx.font = `bold ${16 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('── ◆ ──', targetWidth / 2, curY + (dividerHeight / 2));
  curY += dividerHeight + (14 * scale);

  // 8. Tagline (Wrapped Centered Lines)
  ctx.fillStyle = theme.subtitleColor;
  ctx.font = `bold ${taglineFontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < taglineLines.length; i++) {
    const lineY = curY + (i * taglineLineHeight) + (taglineLineHeight / 2);
    ctx.fillText(taglineLines[i], targetWidth / 2, lineY);
  }
  curY += (taglineLines.length * taglineLineHeight) + gapHeaderToQr;

  // 9. QR Plaque & Box
  const qrBoxX = (targetWidth - qrBoxSize) / 2;
  const qrBoxY = curY;

  ctx.fillStyle = theme.qrBoxBg;
  drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 26 * scale);
  ctx.fill();

  ctx.strokeStyle = theme.qrBoxBorder;
  ctx.lineWidth = 3.5 * scale;
  drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 26 * scale);
  ctx.stroke();

  // Draw QR Image
  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise(resolve => {
      qrImg.onload = () => {
        const qrX = (targetWidth - qrImgSize) / 2;
        const qrY = qrBoxY + ((qrBoxSize - qrImgSize) / 2) + (6 * scale);
        ctx.drawImage(qrImg, qrX, qrY, qrImgSize, qrImgSize);
        resolve();
      };
      qrImg.onerror = resolve;
      setTimeout(resolve, 2000);
    });
  }

  // Pill "SCAN TO ORDER"
  const pillText = 'SCAN TO ORDER';
  ctx.font = `bold ${16 * scale}px "Plus Jakarta Sans", sans-serif`;
  const pillW = ctx.measureText(pillText).width + (36 * scale);
  const pillX = (targetWidth - pillW) / 2;
  const pillY = qrBoxY - (pillHeight / 2);

  ctx.fillStyle = theme.pillBg;
  drawRoundRect(ctx, pillX, pillY, pillW, pillHeight, 16 * scale);
  ctx.fill();

  ctx.strokeStyle = theme.pillBorder;
  ctx.lineWidth = 2.5 * scale;
  drawRoundRect(ctx, pillX, pillY, pillW, pillHeight, 16 * scale);
  ctx.stroke();

  ctx.fillStyle = theme.pillText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, targetWidth / 2, pillY + (pillHeight / 2));

  curY += qrBoxSize + gapQrToInstructions;

  // 10. Bilingual Instructions
  ctx.fillStyle = theme.instructionEn;
  ctx.font = `bold ${instructionEnHeight}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📱 POINT CAMERA AT QR TO ORDER', targetWidth / 2, curY + (instructionEnHeight / 2));
  curY += instructionEnHeight + (12 * scale);

  ctx.fillStyle = theme.instructionHi;
  ctx.font = `bold ${instructionHiHeight}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isCinema ? 'स्कैन करें और सीट पर खाना मंगाएं' : 'कैमरे से स्कैन करें और खाना ऑर्डर करें',
    targetWidth / 2,
    curY + (instructionHiHeight / 2)
  );
  curY += instructionHiHeight + (16 * scale);

  // 11. 3-Step Bar
  const stepText = '① Open Camera   ➔   ② Scan QR   ➔   ③ Order Food';
  ctx.font = `bold ${16 * scale}px "Plus Jakarta Sans", sans-serif`;
  const stepW = ctx.measureText(stepText).width + (38 * scale);
  const stepX = (targetWidth - stepW) / 2;

  ctx.fillStyle = theme.stepBg;
  drawRoundRect(ctx, stepX, curY, stepW, stepHeight, 10 * scale);
  ctx.fill();

  ctx.strokeStyle = theme.stepBorder;
  ctx.lineWidth = 2 * scale;
  drawRoundRect(ctx, stepX, curY, stepW, stepHeight, 10 * scale);
  ctx.stroke();

  ctx.fillStyle = theme.stepText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stepText, targetWidth / 2, curY + (stepHeight / 2));
  curY += stepHeight;

  // 12. Reassurance Line
  if (showReassurance) {
    curY += (14 * scale);
    ctx.fillStyle = theme.accentColor;
    ctx.font = `bold ${16.5 * scale}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ Instant Digital Menu • No App Required', targetWidth / 2, curY + (reassuranceHeight / 2));
    curY += reassuranceHeight;
  }

  curY += gapInstructionsToFooter;

  // 13. Footer Block
  ctx.strokeStyle = theme.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  const footerLineMargin = 100 * scale;
  ctx.moveTo(footerLineMargin, curY);
  ctx.lineTo(targetWidth - footerLineMargin, curY);
  ctx.stroke();
  curY += footerLineHeight;

  if (contactLines.length > 0) {
    curY += (18 * scale);
    ctx.fillStyle = theme.isDark ? '#94A3B8' : '#64748B';
    ctx.font = `bold ${contactFontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < contactLines.length; i++) {
      const lineY = curY + (i * contactLineHeight) + (contactLineHeight / 2);
      ctx.fillText(contactLines[i], targetWidth / 2, lineY);
    }
    curY += (contactLines.length * contactLineHeight);
  }

  if (!restaurant.watermark_removal_enabled) {
    curY += (contactLines.length > 0 ? (14 * scale) : (16 * scale));
    ctx.fillStyle = theme.subtitleColor;
    ctx.font = `bold ${15 * scale}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ Powered by TouchQR', targetWidth / 2, curY + (watermarkHeight / 2));
    curY += watermarkHeight;
  }
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
