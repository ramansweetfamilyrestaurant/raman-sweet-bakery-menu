/**
 * Launches a lightweight 60fps parabolic thumbnail clone from the tapped "+ Add"
 * button into the floating cart pill badge without external dependencies.
 */
export function triggerFlyToCart({ sourceEl, imageSrc, fallbackSrc = '/images/default-dish.webp' } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !sourceEl) return;
  if (typeof sourceEl.getBoundingClientRect !== 'function') return;

  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const srcRect = sourceEl.getBoundingClientRect();
    if (!srcRect || (srcRect.width === 0 && srcRect.height === 0)) return;

    const size = 38;
    const startX = srcRect.left + srcRect.width / 2 - size / 2;
    const startY = srcRect.top + srcRect.height / 2 - size / 2;

    // Locate floating cart badge or estimate its fixed bottom position for the first cart item
    const targetBadge = document.getElementById('tq-floating-cart-badge');
    let endX;
    let endY;

    if (targetBadge && typeof targetBadge.getBoundingClientRect === 'function') {
      const dstRect = targetBadge.getBoundingClientRect();
      endX = dstRect.left + dstRect.width / 2 - size / 2;
      endY = dstRect.top + dstRect.height / 2 - size / 2;
    } else {
      const barWidth = Math.min(440, window.innerWidth - 28);
      const barLeft = (window.innerWidth - barWidth) / 2;
      endX = barLeft + 27 - size / 2;
      endY = window.innerHeight - 90 - size / 2;
    }

    const dx = endX - startX;
    const dy = endY - startY;
    const arcLift = Math.min(-24, Math.min(0, dy) * 0.15 - 22);

    const flyer = document.createElement('div');
    flyer.setAttribute('aria-hidden', 'true');
    Object.assign(flyer.style, {
      position: 'fixed',
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '25000',
      boxShadow: '0 8px 20px rgba(10, 35, 21, 0.28)',
      border: '2px solid #FFFFFF',
      background: '#FFFFFF',
      willChange: 'transform, opacity'
    });

    const img = document.createElement('img');
    img.src = imageSrc || fallbackSrc;
    img.alt = '';
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackSrc;
    };
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block'
    });
    flyer.appendChild(img);
    document.body.appendChild(flyer);

    if (typeof flyer.animate !== 'function') {
      flyer.remove();
      return;
    }

    const anim = flyer.animate(
      [
        { transform: 'translate3d(0px, 0px, 0) scale(0.9)', opacity: 0.95 },
        { transform: `translate3d(${dx * 0.45}px, ${dy * 0.35 + arcLift}px, 0) scale(1.08)`, opacity: 1, offset: 0.42 },
        { transform: `translate3d(${dx * 0.85}px, ${dy * 0.85}px, 0) scale(0.65)`, opacity: 0.9, offset: 0.84 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.32)`, opacity: 0.15 }
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards'
      }
    );

    const cleanup = () => {
      if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
    };
    anim.onfinish = cleanup;
    setTimeout(cleanup, 600);
  } catch {
    // Non-critical visual enhancement; never block add-to-cart flow
  }
}
