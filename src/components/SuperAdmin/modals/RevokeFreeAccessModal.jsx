import React, { useState } from 'react';
import { AlertTriangle, XCircle, X } from 'lucide-react';

export default function RevokeFreeAccessModal({ resto, isOpen, onClose, onConfirmRevoke }) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !resto) return null;

  const handleRevoke = async () => {
    setSubmitting(true);
    try {
      await onConfirmRevoke(resto.id);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to revoke complimentary access');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#FFFFFF', borderRadius: '24px', maxWidth: '480px', width: '100%',
        padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #EF4444', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--sa-danger-bg)', color: 'var(--sa-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>Revoke Free Access?</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Restaurant: <strong>{resto.name}</strong></span>
          </div>
        </div>

        <div style={{ background: 'var(--sa-danger-bg)', border: '1px solid var(--sa-danger-border)', borderRadius: 'var(--sa-radius-md)', padding: '14px', fontSize: '0.82rem', color: '#991B1B', marginBottom: '18px' }}>
          ⚠️ Revoking free access will deactivate the tenant's complimentary status. The restaurant will be required to authorize a paid Cashfree subscription to continue using the admin panel.
          <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: '8px', fontWeight: 700 }}>
            🔒 Safe Operation: Menu items, categories, dishes, orders, and historical payment records will NOT be deleted.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="sa-btn sa-btn-secondary">Keep Free Access</button>
          <button onClick={handleRevoke} disabled={submitting} className="sa-btn sa-btn-danger">
            {submitting ? 'Revoking...' : '🔴 Revoke Access'}
          </button>
        </div>
      </div>
    </div>
  );
}
