import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Drawer({ isOpen, onClose, title, subtitle, children, footer, width }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sa-drawer-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="sa-drawer" 
        onClick={(e) => e.stopPropagation()}
        style={width ? { maxWidth: width } : {}}
      >
        <div className="sa-drawer-header" style={{ gap: '12px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {title}
            </h3>
            {subtitle && (
              <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600, display: 'block', overflowWrap: 'anywhere' }}>
                {subtitle}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)', padding: '8px', minWidth: '40px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sa-drawer-body">
          {children}
        </div>

        {footer && (
          <div className="sa-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
