import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false, loading = false }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: danger ? 'var(--sa-danger-bg)' : 'var(--sa-warning-bg)',
            color: danger ? 'var(--sa-danger)' : 'var(--sa-warning)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
              {title}
            </h3>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--sa-text-muted)', margin: '0 0 20px 0', lineHeight: 1.4 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="sa-btn sa-btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`sa-btn ${danger ? 'sa-btn-danger' : 'sa-btn-primary'}`}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
