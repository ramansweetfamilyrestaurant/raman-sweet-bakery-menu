import React, { useState } from 'react';
import { Bell, Droplets, Receipt, Sparkles, UserCheck, X } from 'lucide-react';
import { createServiceRequest } from '../api/client';

export default function ServiceRequestModal({ tableNum, slug, onClose, onSuccess }) {
  const [selectedType, setSelectedType] = useState('water');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestOptions = [
    { id: 'water', label: 'Drinking Water 💧', icon: <Droplets size={20} color="#0284C7" />, desc: 'Bring fresh drinking water' },
    { id: 'bill', label: 'Request Final Bill 🧾', icon: <Receipt size={20} color="#D97706" />, desc: 'Send printed bill to table' },
    { id: 'clean', label: 'Clean Table 🧹', icon: <Sparkles size={20} color="#059669" />, desc: 'Wipe or clean table surface' },
    { id: 'waiter', label: 'Call Waiter / Help ❓', icon: <UserCheck size={20} color="#7C3AED" />, desc: 'Staff needed at table' }
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const selectedObj = requestOptions.find(o => o.id === selectedType);
      const reqLabel = selectedObj ? selectedObj.label : 'Call Waiter';
      const res = await createServiceRequest({
        slug: slug || 'raman-sweet-bakery',
        table_number: tableNum || '1',
        request_type: reqLabel,
        note: customNote
      });

      if (onSuccess) {
        onSuccess(res?.message || `🛎️ Staff notified for Table ${tableNum || '1'}!`);
      }
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to send request to staff');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 10005,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        maxWidth: '420px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1.5px solid #F1F5F9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#ECFDF5', color: '#059669', padding: '8px', borderRadius: '50%', display: 'flex' }}>
              <Bell size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', color: '#0A2315', display: 'block' }}>Call Table Staff / Waiter</strong>
              <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 800 }}>Table {tableNum || '1'}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>✕</button>
        </div>

        {/* Options List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {requestOptions.map((opt) => (
            <div
              key={opt.id}
              onClick={() => setSelectedType(opt.id)}
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                border: selectedType === opt.id ? '2px solid #10B981' : '1.5px solid #E2E8F0',
                background: selectedType === opt.id ? '#ECFDF5' : '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {opt.icon}
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#1F2937', display: 'block' }}>{opt.label}</strong>
                  <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>{opt.desc}</span>
                </div>
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedType === opt.id ? '6px solid #10B981' : '2px solid #CBD5E1',
                background: '#FFFFFF'
              }} />
            </div>
          ))}
        </div>

        {/* Optional Custom Note Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
            Extra Instruction / Custom Request (Optional):
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="e.g. Extra spoons & napkins"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#FFFFFF',
            padding: '13px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 900,
            fontSize: '0.94rem',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? 'Notifying Staff...' : '🛎️ Call Staff Now'}
        </button>
      </div>
    </div>
  );
}
