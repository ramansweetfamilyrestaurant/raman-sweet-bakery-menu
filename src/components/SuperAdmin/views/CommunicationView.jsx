import React, { useState } from 'react';
import { Megaphone, Send, Trash2, CheckCircle2 } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <Megaphone size={20} color="var(--sa-primary)" /> Broadcast Client Communication
          </h2>
          <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Send real-time platform notification banners directly to shop owner admin dashboards.
          </span>
        </div>
      </div>

      {/* Broadcast Sender Card */}
      <div className="sa-table-container" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 12px 0' }}>
          📢 Broadcast New Banner Announcement
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="sa-form-group" style={{ margin: 0 }}>
            <label className="sa-label">
              ANNOUNCEMENT MESSAGE CONTENT:
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Scheduled system maintenance on Sunday from 2 AM to 4 AM IST. Menu service will remain 100% active."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="sa-textarea"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div className="sa-form-group" style={{ margin: 0 }}>
              <label className="sa-label">NOTICE TYPE:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="sa-select"
              >
                <option value="info">ℹ️ Information (Blue Banner)</option>
                <option value="success">🟢 System Announcement (Green Banner)</option>
                <option value="warning">⚠️ Warning / Maintenance (Yellow Banner)</option>
                <option value="error">🚨 Critical Alert (Red Banner)</option>
              </select>
            </div>

            <div className="sa-form-group" style={{ margin: 0 }}>
              <label className="sa-label">TARGET AUDIENCE:</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="sa-select"
              >
                <option value="all">All Shops & Restaurants</option>
                <option value="active">Active Paid Clients Only</option>
                <option value="trial">Trial Users Only</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="submit" className="sa-btn sa-btn-accent" disabled={submitting}>
              <Send size={15} /> {submitting ? 'Broadcasting...' : 'Broadcast Announcement Now'}
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History */}
      <div className="sa-table-container">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sa-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>Active Announcements History ({announcementsList.length})</h3>
          {announcementsList.length > 0 && (
            <button onClick={onClearAll} className="sa-btn sa-btn-danger sa-btn-sm">
              Clear All Broadcasts
            </button>
          )}
        </div>

        <table className="sa-table">
          <thead>
            <tr>
              <th>TYPE</th>
              <th>MESSAGE CONTENT</th>
              <th>TARGET AUDIENCE</th>
              <th>DATE SENT</th>
              <th style={{ textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {announcementsList.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--sa-text-muted)' }}>
                  No active broadcast announcements.
                </td>
              </tr>
            ) : (
              announcementsList.map(a => (
                <tr key={a.id}>
                  <td><span className={`sa-badge sa-badge-${a.type === 'error' ? 'danger' : a.type === 'warning' ? 'warning' : 'info'}`}>{(a.type || 'info').toUpperCase()}</span></td>
                  <td style={{ fontWeight: 700 }}>{a.message}</td>
                  <td style={{ fontWeight: 700, color: 'var(--sa-text-muted)' }}>{(a.audience || 'all').toUpperCase()}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(a.created_at || Date.now()).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => onDeleteAnnouncement(a.id)} className="sa-btn sa-btn-danger sa-btn-sm">
                      <Trash2 size={13} /> Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
