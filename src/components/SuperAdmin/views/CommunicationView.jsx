import React, { useState } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';

export default function CommunicationView({ announcementsList, onSendAnnouncement, onDeleteAnnouncement, onClearAll }) {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [targetAudience, setTargetAudience] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await onSendAnnouncement({ message, type, audience: targetAudience });
      setMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
      {/* 📢 Header */}
      <div className="sa-section-header" style={{ margin: 0 }}>
        <div>
          <h2 className="sa-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-primary)' }}>
            <Megaphone size={22} color="var(--sa-primary)" /> Platform Broadcast Command Center
          </h2>
          <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Send real-time platform notification banners directly to all business admin dashboards.
          </span>
        </div>
      </div>

      {/* 📢 Main Broadcast Card */}
      <div className="sa-settings-main-card">
        <div className="sa-settings-form-header">
          <div>
            <h3 className="sa-settings-form-title">📢 Broadcast New Dashboard Banner</h3>
            <p className="sa-settings-form-desc">Flash instant alerts, feature announcements, and maintenance warnings.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Quick Templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="sa-settings-label">
                ANNOUNCEMENT MESSAGE CONTENT *
              </label>
              <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Quick Presets:</span>
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
              {[
                { label: '⚡ New Feature', text: '🎉 New Feature Released: WhatsApp Direct Ordering is now live for all businesses!' },
                { label: '🛠️ Maintenance', text: '⚠️ Scheduled maintenance tonight from 2:00 AM - 3:00 AM IST. QR menus remain online.' },
                { label: '📢 System Update', text: 'ℹ️ Platform speed optimization complete. Dashboard loading 40% faster!' },
              ].map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMessage(tpl.text)}
                  style={{
                    padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, borderRadius: '6px',
                    background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#334155', cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={3}
              placeholder="e.g. Scheduled system maintenance on Sunday from 2 AM to 4 AM IST. Menu service will remain 100% active."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="sa-settings-input"
              style={{ minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div className="sa-settings-field-group">
              <label className="sa-settings-label">BANNER NOTICE TYPE</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="sa-settings-input"
                style={{ fontWeight: 800 }}
              >
                <option value="info">ℹ️ Information (Blue Banner)</option>
                <option value="success">🎉 Feature Release (Green Banner)</option>
                <option value="warning">⚠️ Warning / Maintenance (Yellow Banner)</option>
                <option value="error">🚨 Critical Alert (Red Banner)</option>
              </select>
            </div>

            <div className="sa-settings-field-group">
              <label className="sa-settings-label">TARGET AUDIENCE</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="sa-settings-input"
                style={{ fontWeight: 800 }}
              >
                <option value="all">👥 All Businesses</option>
                <option value="active">🟢 Active Paid Businesses Only</option>
                <option value="trial">🎁 Trial Businesses Only</option>
              </select>
            </div>
          </div>

          {/* Live Preview */}
          {message.trim() && (
            <div style={{
              padding: '12px 14px', borderRadius: '10px',
              background: type === 'warning' ? '#FEF3C7' : type === 'success' ? '#DCFCE7' : type === 'error' ? '#FEE2E2' : '#EFF6FF',
              border: `1px solid ${type === 'warning' ? '#FCD34D' : type === 'success' ? '#86EFAC' : type === 'error' ? '#FCA5A5' : '#BFDBFE'}`,
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <Megaphone size={18} color={type === 'warning' ? '#B45309' : type === 'success' ? '#15803D' : type === 'error' ? '#B91C1C' : '#1D4ED8'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', color: type === 'warning' ? '#B45309' : type === 'success' ? '#15803D' : type === 'error' ? '#B91C1C' : '#1D4ED8' }}>
                  Live Business Dashboard Banner Preview
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', wordBreak: 'break-word' }}>
                  {message}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="sa-btn sa-btn-accent"
            disabled={submitting}
            style={{ padding: '12px 20px', fontWeight: 900, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={15} />
            <span>{submitting ? 'Broadcasting...' : 'Broadcast Announcement Now'}</span>
          </button>
        </form>
      </div>

      {/* 📋 Broadcast History */}
      <div className="sa-settings-main-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--sa-border)' }}>
          <h3 style={{ fontSize: '0.96rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
            Active Announcements History ({announcementsList.length})
          </h3>
          {announcementsList.length > 0 && (
            <button onClick={onClearAll} className="sa-btn sa-btn-danger sa-btn-sm" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
              Clear All Broadcasts
            </button>
          )}
        </div>

        {announcementsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', color: 'var(--sa-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            No active broadcast notices. Dashboard banners are clean.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {announcementsList.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 900,
                      background: a.type === 'warning' ? '#FEF3C7' : a.type === 'success' ? '#DCFCE7' : a.type === 'error' ? '#FEE2E2' : '#EFF6FF',
                      color: a.type === 'warning' ? '#B45309' : a.type === 'success' ? '#15803D' : a.type === 'error' ? '#B91C1C' : '#1E40AF',
                      padding: '2px 8px', borderRadius: '4px'
                    }}>
                      {(a.type || 'info').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--sa-text-main)', wordBreak: 'break-word' }}>
                    {a.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteAnnouncement(a.id)}
                  className="sa-btn sa-btn-danger sa-btn-sm"
                  style={{ padding: '6px 10px', fontSize: '0.72rem', flexShrink: 0 }}
                  title="Delete announcement"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
