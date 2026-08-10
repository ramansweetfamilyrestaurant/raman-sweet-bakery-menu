import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function AdminDrawer({ isOpen, onClose, title, subtitle, children, footer }) {
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
    <div className="adm-drawer-overlay" onClick={onClose}>
      <div className="adm-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="adm-drawer-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--adm-text)', margin: 0 }}>
              {title}
            </h3>
            {subtitle && (
              <span style={{ fontSize: '0.74rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
                {subtitle}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="adm-drawer-body">
          {children}
        </div>

        {footer && (
          <div className="adm-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
