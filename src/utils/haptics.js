// Mobile Haptic Feedback Utility
export const triggerHaptic = (type = 'light') => {
  if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
    try {
      if (type === 'light') {
        window.navigator.vibrate(12);
      } else if (type === 'medium') {
        window.navigator.vibrate(22);
      } else if (type === 'success') {
        window.navigator.vibrate([12, 40, 15]);
      } else if (type === 'error') {
        window.navigator.vibrate([25, 40, 25]);
      }
    } catch (_) {}
  }
};
