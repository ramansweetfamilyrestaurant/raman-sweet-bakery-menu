import React, { useState } from 'react';
import { Megaphone, Send, Trash2, Sparkles, AlertTriangle, ShieldAlert, Info, Users, Crown, Gift } from 'lucide-react';

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

  const handleInsertEmoji = (emoji) => {
    setMessage(prev => (prev ? `${prev} ${emoji}` : emoji));
  };

  // Preview styling matching AdminDashboard 1:1 replica
  const previewThemes = {
    warning: {
      bg: 'linear-gradient(135deg, rgba(120, 53, 15, 0.96) 0%, rgba(146, 64, 14, 0.96) 100%)',
      border: 'rgba(245, 158, 11, 0.45)',
      text: '#FEF3C7',
      icon: '#FDE68A',
      badge: 'MAINTENANCE ALERT',
      badgeBg: 'rgba(245, 158, 11, 0.22)',
      badgeBorder: 'rgba(245, 158, 11, 0.45)',
      badgeText: '#FDE68A',
      dot: '#F59E0B'
    },
    success: {
      bg: 'linear-gradient(135deg, rgba(6, 78, 59, 0.96) 0%, rgba(6, 95, 70, 0.96) 100%)',
      border: 'rgba(16, 185, 129, 0.45)',
      text: '#ECFDF5',
      icon: '#6EE7B7',
      badge: 'NEW FEATURE RELEASE',
      badgeBg: 'rgba(16, 185, 129, 0.22)',
      badgeBorder: 'rgba(16, 185, 129, 0.45)',
      badgeText: '#A7F3D0',
      dot: '#10B981'
    },
    error: {
      bg: 'linear-gradient(135deg, rgba(127, 29, 29, 0.96) 0%, rgba(153, 27, 27, 0.96) 100%)',
      border: 'rgba(239, 68, 68, 0.45)',
      text: '#FEF2F2',
      icon: '#FCA5A5',
      badge: 'CRITICAL SYSTEM ALERT',
      badgeBg: 'rgba(239, 68, 68, 0.22)',
      badgeBorder: 'rgba(239, 68, 68, 0.45)',
      badgeText: '#FECACA',
      dot: '#EF4444'
    },
    info: {
      bg: 'linear-gradient(135deg, rgba(30, 27, 75, 0.96) 0%, rgba(49, 46, 129, 0.96) 100%)',
      border: 'rgba(99, 102, 241, 0.45)',
      text: '#EEF2FF',
      icon: '#FBBF24',
      badge: 'PLATFORM ANNOUNCEMENT',
      badgeBg: 'rgba(99, 102, 241, 0.22)',
      badgeBorder: 'rgba(99, 102, 241, 0.45)',
      badgeText: '#C7D2FE',
      dot: '#6366F1'
    }
  };

  const activeTheme = previewThemes[type] || previewThemes.info;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* 📢 Header Section */}
      <div className="sa-section-header" style={{ margin: 0, paddingBottom: '4px' }}>
        <div>
          <h2 className="sa-section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', fontWeight: 900, color: 'var(--sa-primary)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={20} color="#6366F1" />
            </div>
            Platform Broadcast Command Center
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Broadcast real-time, glassmorphic notification banners directly to tenant admin dashboards with target audience controls.
          </span>
        </div>
      </div>

      {/* 📢 Main Broadcast Card */}
      <div className="sa-settings-main-card" style={{ padding: '24px' }}>
        <div className="sa-settings-form-header" style={{ marginBottom: '18px' }}>
          <div>
            <h3 className="sa-settings-form-title" style={{ fontSize: '1.05rem', fontWeight: 900, margin: '0 0 4px 0' }}>
              📢 Broadcast New Dashboard Banner
            </h3>
            <p className="sa-settings-form-desc" style={{ margin: 0, fontSize: '0.80rem' }}>
              Push live alerts, maintenance notices, and new feature spotlights to connected shops.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Quick Presets & Emojis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <label className="sa-settings-label" style={{ fontWeight: 800, fontSize: '0.76rem' }}>
                ANNOUNCEMENT CONTENT *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Quick Presets:</span>
              </div>
            </div>

            {/* Quick Template Chips */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {[
                { label: '⚡ New Feature', type: 'success', text: '🎉 New Feature Released: WhatsApp Direct Ordering is now live for all businesses!' },
                { label: '🛠️ Maintenance', type: 'warning', text: '⚠️ Scheduled maintenance tonight from 2:00 AM - 3:00 AM IST. QR menus remain online.' },
                { label: '📢 Speed Update', type: 'info', text: 'ℹ️ Platform speed optimization complete. Dashboard loading 40% faster!' },
                { label: '🚨 Critical Alert', type: 'error', text: '🚨 Immediate Notice: Essential system update in progress. QR menu ordering remains active.' },
              ].map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setMessage(tpl.text);
                    if (tpl.type) setType(tpl.type);
                  }}
                  style={{
                    padding: '5px 10px', fontSize: '0.70rem', fontWeight: 700, borderRadius: '8px',
                    background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#1E293B', cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#4F46E5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#1E293B'; }}
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              required
              rows={3}
              maxLength={250}
              placeholder="e.g. Scheduled platform maintenance on Sunday from 2 AM to 4 AM IST. Menu service will remain 100% active."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="sa-settings-input"
              style={{ minHeight: '85px', resize: 'vertical', fontSize: '0.88rem', lineHeight: 1.45, padding: '12px 14px' }}
            />

            {/* Emoji Quick Insert + Character Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 600, marginRight: '4px' }}>Quick Emojis:</span>
                {['⚡', '🎉', '⚠️', '🛠️', 'ℹ️', '🚨', '📢', '🔥', '🚀'].map((em, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertEmoji(em)}
                    style={{
                      background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '4px',
                      padding: '2px 5px', fontSize: '0.80rem', cursor: 'pointer'
                    }}
                    title={`Insert ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: message.length > 200 ? '#EF4444' : 'var(--sa-text-muted)' }}>
                {message.length} / 250
              </span>
            </div>
          </div>

          {/* Interactive Visual Cards: Notice Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="sa-settings-label" style={{ fontWeight: 800, fontSize: '0.76rem' }}>
              BANNER NOTICE TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                { id: 'info', label: 'General Notice', desc: 'Updates & Announcements', icon: <Info size={18} color="#6366F1" />, color: '#6366F1', bg: 'rgba(99, 102, 241, 0.08)' },
                { id: 'success', label: 'Feature Release', desc: 'New Tools & Upgrades', icon: <Sparkles size={18} color="#10B981" />, color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' },
                { id: 'warning', label: 'Maintenance Alert', desc: 'Schedule & Downtime', icon: <AlertTriangle size={18} color="#F59E0B" />, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)' },
                { id: 'error', label: 'Critical Alert', desc: 'Urgent System Warning', icon: <ShieldAlert size={18} color="#EF4444" />, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.08)' }
              ].map(card => {
                const isSelected = type === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setType(card.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '11px 13px',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${card.color}` : '1.5px solid #E2E8F0',
                      background: isSelected ? card.bg : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isSelected ? `0 4px 12px ${card.color}20` : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>{card.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.80rem', color: isSelected ? card.color : '#1E293B' }}>{card.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{card.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Visual Cards: Target Audience */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="sa-settings-label" style={{ fontWeight: 800, fontSize: '0.76rem' }}>
              TARGET AUDIENCE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {[
                { id: 'all', label: 'All Businesses', desc: 'Every registered tenant', icon: <Users size={18} color="#6366F1" />, color: '#6366F1' },
                { id: 'active', label: 'Paid & VIP Only', desc: 'Active paid subscribers', icon: <Crown size={18} color="#10B981" />, color: '#10B981' },
                { id: 'trial', label: 'Free Trial Only', desc: 'Tenants evaluating trial', icon: <Gift size={18} color="#F59E0B" />, color: '#F59E0B' }
              ].map(aud => {
                const isSelected = targetAudience === aud.id;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setTargetAudience(aud.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '11px 13px',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${aud.color}` : '1.5px solid #E2E8F0',
                      background: isSelected ? `${aud.color}10` : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isSelected ? `0 4px 12px ${aud.color}20` : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>{aud.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.80rem', color: isSelected ? aud.color : '#1E293B' }}>{aud.label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{aud.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1:1 Live Business Dashboard Replica Preview */}
          {message.trim() && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--sa-text-muted)', letterSpacing: '0.04em' }}>
                  👁️ 1:1 Live Business Dashboard Banner Preview:
                </span>
                <span style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 700 }}>● Exact Shop Replica</span>
              </div>
              <div style={{
                background: activeTheme.bg,
                borderRadius: '12px',
                padding: '12px 18px',
                color: activeTheme.text,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                border: `1px solid ${activeTheme.border}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  <Megaphone size={16} color={activeTheme.icon} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px',
                    background: activeTheme.badgeBg, border: `1px solid ${activeTheme.badgeBorder}`,
                    color: activeTheme.badgeText, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0
                  }}>
                    {activeTheme.badge}
                  </span>
                  <span style={{ wordBreak: 'break-word', fontWeight: 600, flex: 1, minWidth: '180px' }}>
                    {message}
                  </span>
                </div>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '0.75rem', flexShrink: 0
                }}>
                  ✕
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="sa-btn sa-btn-accent"
            disabled={submitting}
            style={{ padding: '12px 24px', fontWeight: 900, fontSize: '0.90rem', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}
          >
            <Send size={16} />
            <span>{submitting ? 'Broadcasting Banner...' : 'Broadcast Announcement Now'}</span>
          </button>
        </form>
      </div>

      {/* 📋 Broadcast History */}
      <div className="sa-settings-main-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid var(--sa-border)' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 2px 0' }}>
              Active Announcements History ({announcementsList.length})
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Live broadcast banners currently visible on tenant dashboards
            </span>
          </div>
          {announcementsList.length > 0 && (
            <button onClick={onClearAll} className="sa-btn sa-btn-danger sa-btn-sm" style={{ fontSize: '0.72rem', padding: '5px 12px' }}>
              Clear All Broadcasts
            </button>
          )}
        </div>

        {announcementsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', background: '#F8FAFC', borderRadius: '12px', border: '1.5px dashed #CBD5E1', color: 'var(--sa-text-muted)', fontSize: '0.84rem', fontWeight: 600, marginTop: '14px' }}>
            <Megaphone size={28} color="#94A3B8" style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.6 }} />
            No active broadcast notices. Dashboard banners are clean.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', marginTop: '14px' }}>
            {announcementsList.map(a => {
              const itemType = a.type || 'info';
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', gap: '14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 900,
                        background: itemType === 'warning' ? '#FEF3C7' : itemType === 'success' ? '#DCFCE7' : itemType === 'error' ? '#FEE2E2' : '#EFF6FF',
                        color: itemType === 'warning' ? '#B45309' : itemType === 'success' ? '#15803D' : itemType === 'error' ? '#B91C1C' : '#1E40AF',
                        padding: '2px 8px', borderRadius: '6px', border: `1px solid ${itemType === 'warning' ? '#FCD34D' : itemType === 'success' ? '#86EFAC' : itemType === 'error' ? '#FCA5A5' : '#BFDBFE'}`
                      }}>
                        {itemType.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                        background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1'
                      }}>
                        {a.audience === 'trial' ? '🎁 Free Trial Only' : a.audience === 'active' ? '🟢 Paid & VIP Only' : '👥 All Businesses'}
                      </span>
                      <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                        {a.created_at ? new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--sa-text-main)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {a.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteAnnouncement(a.id)}
                    className="sa-btn sa-btn-danger sa-btn-sm"
                    style={{ padding: '7px 11px', fontSize: '0.74rem', flexShrink: 0 }}
                    title="Delete announcement"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
