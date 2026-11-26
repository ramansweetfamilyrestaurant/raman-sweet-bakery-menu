import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function ModalDialog({ isOpen, onClose, title, subtitle, children, maxWidth = '600px' }) {
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
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal-box" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: '#F3F4F6',
            border: 'none',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontWeight: 900,
            color: '#4B5563',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
          <X size={17} />
        </button>

        {title && (
          <div style={{ marginBottom: '18px', paddingRight: '40px', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-primary)', overflowWrap: 'break-word' }}>{title}</h3>
            {subtitle && <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>{subtitle}</span>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
