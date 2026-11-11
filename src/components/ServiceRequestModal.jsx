import React, { useState } from 'react';
import { Bell, Droplets, Receipt, Sparkles, UserCheck, X } from 'lucide-react';
import { createServiceRequest } from '../api/client';

export default function ServiceRequestModal({ tableNum, slug, onClose, onSuccess, spaceType = 'table', tableToken = '' }) {
  const [selectedType, setSelectedType] = useState('water');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCinema = Boolean(tableNum && (tableNum.includes('Screen') || tableNum.includes('Seat') || tableNum.includes('🎬')));
  const isHotel = Boolean(tableNum && (tableNum.includes('Room') || tableNum.includes('🏨')));

  // Cinema is a pure seat-ordering flow with NO customer staff-call modal
  if (isCinema) {
    return null;
  }

  const requestOptions = [
    { id: 'water', label: 'Drinking Water 💧', icon: <Droplets size={20} color="#0284C7" />, desc: 'Bring fresh drinking water' },
    { id: 'bill', label: isHotel ? 'Room Folio / Bill 🧾' : 'Request Final Bill 🧾', icon: <Receipt size={20} color="#D97706" />, desc: isHotel ? 'Send folio / bill to room' : 'Send printed bill to your location' },
    { id: 'clean', label: isHotel ? 'Housekeeping Clean Up 🧹' : 'Clean Surface / Area 🧹', icon: <Sparkles size={20} color="#059669" />, desc: isHotel ? 'Request room housekeeping' : 'Wipe or clean space surface' },
    ...(isHotel ? [{ id: 'amenities', label: 'Hotel Amenities & Toiletries 🪥', icon: <Sparkles size={20} color="#0D9488" />, desc: 'Fresh towels, dental kit, slippers, soap' }] : []),
    { id: 'waiter', label: isHotel ? 'Room Service Attendant 🛎️' : 'Call Staff / Attendant ❓', icon: <UserCheck size={20} color="#7C3AED" />, desc: isHotel ? 'Staff attendant needed at room' : 'Staff needed at location' }
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const selectedObj = requestOptions.find(o => o.id === selectedType);
      const reqLabel = selectedObj ? selectedObj.label : (isCinema ? 'Staff Assistance' : isHotel ? 'Room Service' : 'Call Staff');
      const res = await createServiceRequest({
        slug: slug || '',
        table_number: tableNum || '1',
        space_type: spaceType,
        table_token: tableToken,
        request_type: reqLabel,
        note: customNote
      });

      if (onSuccess) {
        onSuccess(res?.message || `🛎️ Staff notified for ${tableNum || 'Space'}!`);
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
        background: 'var(--theme-modal-bg, #FFFFFF)',
        borderRadius: '24px',
        maxWidth: '420px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        border: '1.5px solid var(--theme-modal-border, rgba(0,0,0,0.1))',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1.5px solid var(--theme-divider, #F1F5F9)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'var(--theme-badge-bg, #ECFDF5)', color: 'var(--theme-price-color, var(--primary-emerald, #059669))', padding: '8px', borderRadius: '50%', display: 'flex' }}>
              <Bell size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-dark, #0A2315)', display: 'block' }}>
                {isHotel ? 'Room Service & Assistance' : 'Call Staff / Attendant'}
              </strong>
              <span style={{ fontSize: '0.74rem', color: 'var(--theme-price-color, var(--primary-emerald, #059669))', fontWeight: 800 }}>
                {tableNum || 'Space 1'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-secondary, #F1F5F9)', color: 'var(--text-dark, #374151)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 900 }}>✕</button>
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
                border: selectedType === opt.id ? '2px solid var(--gold-bright, #10B981)' : '1.5px solid var(--theme-card-border, #E2E8F0)',
                background: selectedType === opt.id ? 'var(--theme-badge-bg, #ECFDF5)' : 'var(--theme-card-bg, #FFFFFF)',
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
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text-dark, #1F2937)', display: 'block' }}>{opt.label}</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #6B7280)' }}>{opt.desc}</span>
                </div>
              </div>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedType === opt.id ? '6px solid var(--gold-bright, #10B981)' : '2px solid var(--border-light, #CBD5E1)',
                background: 'var(--theme-card-bg, #FFFFFF)'
              }} />
            </div>
          ))}
        </div>

        {/* Optional Custom Note Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark, #374151)', marginBottom: '4px' }}>
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
              border: '1.5px solid var(--theme-card-border, #CBD5E1)',
              background: 'var(--theme-card-bg, #FFFFFF)',
              color: 'var(--text-dark, #0F172A)',
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
            background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
            color: '#FFFFFF',
            padding: '13px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 900,
            fontSize: '0.94rem',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--theme-shadow, 0 6px 20px rgba(0, 0, 0, 0.25))',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? 'Notifying Staff...' : '🛎️ Call Staff Now'}
        </button>
      </div>
    </div>
  );
}
