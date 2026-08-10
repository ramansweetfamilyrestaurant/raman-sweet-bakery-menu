import React, { useState } from 'react';
import { Settings, CreditCard, Clock, Send, Trash2, RefreshCw, Plus, Edit3, Lock } from 'lucide-react';

export default function SettingsView({
  paymentKeys, onSavePaymentKeys, securityForm, setSecurityForm, onSaveSecurity, savingKeys, savingSecurity, keysMsg, securityMsg, securityError,
  plansList = [], restaurants = [], onCreatePlan, onUpdatePlan, onDeletePlan,
  announcementsList = [], onSendAnnouncement, onDeleteAnnouncement, onClearAll,
  auditLogs = [], loading, onRefresh, onOptimizeDatabase, onUploadLogo
}) {
  const [openSection, setOpenSection] = useState(null);
  const [keysForm, setKeysForm] = useState(paymentKeys);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync keysForm whenever backend paymentKeys values change (e.g. after loadSystemSettings finishes)
  React.useEffect(() => {
    if (paymentKeys && typeof paymentKeys === 'object') {
      setKeysForm(paymentKeys);
    }
  }, [
    paymentKeys?.platform_logo_url,
    paymentKeys?.cashfree_app_id,
    paymentKeys?.cashfree_secret_key,
    paymentKeys?.support_whatsapp,
    paymentKeys?.default_trial_days
  ]);

  const handleLogoFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      if (onUploadLogo) {
        const url = await onUploadLogo(file);
        if (url) {
          const updatedForm = { ...keysForm, platform_logo_url: url };
          setKeysForm(updatedForm);
          // Auto-save to backend database immediately
          if (onSavePaymentKeys) {
            await onSavePaymentKeys(updatedForm);
          }
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to upload logo image file');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Plans editing state
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ key: '', name: '', price: 999 });
  const [showPlanForm, setShowPlanForm] = useState(false);

  // Announcement state
  const [annMessage, setAnnMessage] = useState('');
  const [annType, setAnnType] = useState('info');

  const toggleSection = (key) => setOpenSection(openSection === key ? null : key);

  const AccordionHeader = ({ sectionKey, emoji, title, count }) => (
    <div
      onClick={() => toggleSection(sectionKey)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', cursor: 'pointer',
        background: openSection === sectionKey ? 'var(--sa-surface-subtle)' : 'var(--sa-surface)',
        border: '1px solid var(--sa-border)', borderRadius: 'var(--sa-radius-md)',
        marginBottom: openSection === sectionKey ? '0' : '8px',
        borderBottomLeftRadius: openSection === sectionKey ? 0 : 'var(--sa-radius-md)',
        borderBottomRightRadius: openSection === sectionKey ? 0 : 'var(--sa-radius-md)',
      }}
    >
      <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
        {emoji} {title} {count !== undefined && <span style={{ fontWeight: 600, color: 'var(--sa-text-muted)', fontSize: '0.85rem' }}>({count})</span>}
      </span>
      <span style={{ color: 'var(--sa-text-muted)', fontSize: '1.1rem' }}>{openSection === sectionKey ? '▲' : '▼'}</span>
    </div>
  );

  const AccordionBody = ({ sectionKey, children }) => {
    if (openSection !== sectionKey) return null;
    return (
      <div style={{
        padding: '20px', border: '1px solid var(--sa-border)', borderTop: 'none',
        borderBottomLeftRadius: 'var(--sa-radius-md)', borderBottomRightRadius: 'var(--sa-radius-md)',
        marginBottom: '8px', background: 'var(--sa-surface)'
      }}>
        {children}
      </div>
    );
  };

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.88rem', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 4px 0', color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={22} color="var(--sa-primary)" /> Settings
        </h2>
        <span style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)' }}>
          Manage your platform configuration in one place.
        </span>
      </div>

      {/* 1. Logo & Branding */}
      <AccordionHeader sectionKey="branding" emoji="🖼️" title="Super Admin Logo & Branding" />
      <AccordionBody sectionKey="branding">
        <form onSubmit={(e) => { e.preventDefault(); onSavePaymentKeys(keysForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
          
          {/* File Selection Button */}
          <div>
            <label style={labelStyle}>SELECT LOGO IMAGE FILE FROM COMPUTER / PHONE:</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
                  color: '#0A2315',
                  borderRadius: 'var(--sa-radius-md)', fontWeight: 900, fontSize: '0.85rem',
                  cursor: uploadingLogo ? 'wait' : 'pointer', border: 'none',
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
                }}
              >
                📁 {uploadingLogo ? 'Uploading Image...' : 'Choose Logo File'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingLogo}
                  onChange={handleLogoFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                {uploadingLogo ? '⏳ Processing & Uploading...' : 'Supports PNG, JPG, WEBP, SVG'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, borderTop: '1px solid var(--sa-border)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', fontWeight: 800 }}>OR PASTE IMAGE URL</span>
            <div style={{ flex: 1, borderTop: '1px solid var(--sa-border)' }} />
          </div>

          <div>
            <label style={labelStyle}>PLATFORM LOGO IMAGE URL / PATH:</label>
            <input
              type="text"
              placeholder="e.g. https://your-domain.com/logo.png or uploaded path"
              value={keysForm.platform_logo_url || ''}
              onChange={(e) => setKeysForm({ ...keysForm, platform_logo_url: e.target.value })}
              style={inputStyle}
            />
          </div>

          {keysForm.platform_logo_url && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Active Logo Preview:</span>
              <img
                src={keysForm.platform_logo_url}
                alt="Logo preview"
                referrerPolicy="no-referrer"
                style={{ height: '38px', width: 'auto', borderRadius: '6px', objectFit: 'contain', background: '#FFF', padding: '2px' }}
              />
            </div>
          )}

          {keysMsg && <div style={{ color: 'var(--sa-success)', fontWeight: 700, fontSize: '0.85rem' }}>{keysMsg}</div>}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
            <button type="submit" className="sa-btn sa-btn-accent" disabled={savingKeys || uploadingLogo}>
              {savingKeys ? 'Saving...' : '💾 Save Logo Settings'}
            </button>

            {keysForm.platform_logo_url && (
              <button
                type="button"
                className="sa-btn sa-btn-danger sa-btn-sm"
                disabled={savingKeys || uploadingLogo}
                onClick={async () => {
                  if (window.confirm('Are you sure you want to reset/delete the Super Admin logo?')) {
                    const clearedForm = { ...keysForm, platform_logo_url: '' };
                    setKeysForm(clearedForm);
                    if (onSavePaymentKeys) {
                      await onSavePaymentKeys(clearedForm);
                    }
                  }
                }}
                style={{ padding: '8px 14px' }}
              >
                <Trash2 size={14} /> Reset Logo
              </button>
            )}
          </div>
        </form>
      </AccordionBody>

      {/* 2. Payment Gateway */}
      <AccordionHeader sectionKey="payments" emoji="💳" title="Payment Gateway" />
      <AccordionBody sectionKey="payments">
        <form onSubmit={(e) => { e.preventDefault(); onSavePaymentKeys(keysForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '500px' }}>
          <div>
            <label style={labelStyle}>CASHFREE APP ID:</label>
            <input type="text" required placeholder="e.g. 1047648f574d..." value={keysForm.cashfree_app_id} onChange={(e) => setKeysForm({ ...keysForm, cashfree_app_id: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CASHFREE SECRET KEY:</label>
            <input type="password" required placeholder="••••••••" value={keysForm.cashfree_secret_key} onChange={(e) => setKeysForm({ ...keysForm, cashfree_secret_key: e.target.value })} style={inputStyle} />
          </div>
          {keysMsg && <div style={{ color: 'var(--sa-success)', fontWeight: 700, fontSize: '0.85rem' }}>{keysMsg}</div>}
          <button type="submit" className="sa-btn sa-btn-primary" disabled={savingKeys} style={{ alignSelf: 'flex-start' }}>
            {savingKeys ? 'Saving...' : '💾 Save Gateway Keys'}
          </button>
        </form>
      </AccordionBody>

      {/* 2. Trial & Support */}
      <AccordionHeader sectionKey="trial" emoji="⏰" title="Trial & Support" />
      <AccordionBody sectionKey="trial">
        <form onSubmit={(e) => { e.preventDefault(); onSavePaymentKeys(keysForm); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '500px' }}>
          <div>
            <label style={labelStyle}>DEFAULT FREE TRIAL DAYS:</label>
            <input type="number" min="1" max="90" value={keysForm.default_trial_days} onChange={(e) => setKeysForm({ ...keysForm, default_trial_days: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>SUPPORT WHATSAPP NUMBER (WITH COUNTRY CODE):</label>
            <input type="text" placeholder="919876543210" value={keysForm.support_whatsapp} onChange={(e) => setKeysForm({ ...keysForm, support_whatsapp: e.target.value })} style={inputStyle} />
          </div>
          <button type="submit" className="sa-btn sa-btn-primary" disabled={savingKeys} style={{ alignSelf: 'flex-start' }}>
            {savingKeys ? 'Saving...' : '💾 Save Settings'}
          </button>
        </form>
      </AccordionBody>

      {/* 3. SaaS Plans */}
      <AccordionHeader sectionKey="plans" emoji="📋" title="SaaS Plans" count={plansList.length} />
      <AccordionBody sectionKey="plans">
        <div style={{ overflowX: 'auto' }}>
          <table className="sa-table" style={{ fontSize: '0.88rem' }}>
            <thead>
              <tr>
                <th>PLAN</th>
                <th>PRICE</th>
                <th>CLIENTS</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {plansList.map(p => {
                const clientCount = restaurants.filter(r => (r.plan_tier || 'pro').toLowerCase() === p.key.toLowerCase()).length;
                return (
                  <tr key={p.key}>
                    <td><strong>{p.name}</strong> <span style={{ color: 'var(--sa-text-muted)', fontSize: '0.75rem' }}>({p.key})</span></td>
                    <td style={{ fontWeight: 800, color: 'var(--sa-primary)' }}>₹{p.price}/mo</td>
                    <td>{clientCount} active</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => { setEditingPlan(p); setPlanForm({ key: p.key, name: p.name, price: p.price }); setShowPlanForm(true); }} className="sa-btn sa-btn-secondary sa-btn-sm">
                        <Edit3 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showPlanForm && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 900 }}>{editingPlan ? `Edit: ${editingPlan.name}` : 'Create New Plan'}</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {!editingPlan && (
                <div>
                  <label style={labelStyle}>KEY:</label>
                  <input type="text" placeholder="e.g. premium" value={planForm.key} onChange={e => setPlanForm({ ...planForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} style={{ ...inputStyle, width: '140px' }} />
                </div>
              )}
              <div>
                <label style={labelStyle}>NAME:</label>
                <input type="text" placeholder="Plan Name" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} style={{ ...inputStyle, width: '180px' }} />
              </div>
              <div>
                <label style={labelStyle}>PRICE (₹):</label>
                <input type="number" min="0" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })} style={{ ...inputStyle, width: '120px' }} />
              </div>
              <button onClick={() => { editingPlan ? onUpdatePlan(editingPlan.key, planForm) : onCreatePlan(planForm); setShowPlanForm(false); setEditingPlan(null); }} className="sa-btn sa-btn-primary sa-btn-sm">
                {editingPlan ? 'Save' : 'Create'}
              </button>
              <button onClick={() => { setShowPlanForm(false); setEditingPlan(null); }} className="sa-btn sa-btn-secondary sa-btn-sm">Cancel</button>
            </div>
          </div>
        )}

        {!showPlanForm && (
          <button onClick={() => { setEditingPlan(null); setPlanForm({ key: '', name: '', price: 999 }); setShowPlanForm(true); }} className="sa-btn sa-btn-accent sa-btn-sm" style={{ marginTop: '12px' }}>
            <Plus size={14} /> Add New Plan
          </button>
        )}
      </AccordionBody>

      {/* 4. Announcements */}
      <AccordionHeader sectionKey="announcements" emoji="📢" title="Announcements" count={announcementsList.length} />
      <AccordionBody sectionKey="announcements">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px' }}>
          <textarea
            rows={2}
            placeholder="Type announcement message..."
            value={annMessage}
            onChange={e => setAnnMessage(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select value={annType} onChange={e => setAnnType(e.target.value)} style={{ ...inputStyle, width: '180px' }}>
              <option value="info">ℹ️ Info</option>
              <option value="warning">⚠️ Warning</option>
              <option value="success">✅ Success</option>
              <option value="error">🚨 Critical</option>
            </select>
            <button onClick={async () => { if (annMessage.trim()) { await onSendAnnouncement({ message: annMessage, type: annType, audience: 'all' }); setAnnMessage(''); } }} className="sa-btn sa-btn-primary sa-btn-sm">
              <Send size={14} /> Send
            </button>
          </div>
        </div>

        {announcementsList.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Active ({announcementsList.length})</span>
              <button onClick={onClearAll} className="sa-btn sa-btn-danger sa-btn-sm">Clear All</button>
            </div>
            {announcementsList.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
                <div>
                  <span className={`sa-badge sa-badge-${a.type === 'error' ? 'danger' : a.type === 'warning' ? 'warning' : 'info'}`} style={{ marginRight: '8px' }}>{(a.type || 'info').toUpperCase()}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.message}</span>
                </div>
                <button onClick={() => onDeleteAnnouncement(a.id)} className="sa-btn sa-btn-danger sa-btn-sm" style={{ padding: '4px 8px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </AccordionBody>

      {/* 5. Activity Log */}
      <AccordionHeader sectionKey="audit" emoji="📜" title="Activity Log" count={auditLogs.length} />
      <AccordionBody sectionKey="audit">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button onClick={onRefresh} className="sa-btn sa-btn-secondary sa-btn-sm">
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sa-text-muted)' }}>No activity logged yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {auditLogs.slice(0, 20).map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="sa-badge sa-badge-purple" style={{ marginRight: '8px' }}>{log.action || 'EVENT'}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--sa-text-main)' }}>{log.details || 'System event'}</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at || Date.now()).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </AccordionBody>

      {/* 6. Database Maintenance */}
      <AccordionHeader sectionKey="database" emoji="🧹" title="Database Maintenance & Vacuum" />
      <AccordionBody sectionKey="database">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)', margin: 0, lineHeight: 1.5 }}>
            Clean up old expired logs, vacuum database indexes, and optimize query speeds across all tenant restaurants.
          </p>
          <button
            onClick={() => onOptimizeDatabase && onOptimizeDatabase(90)}
            className="sa-btn sa-btn-accent sa-btn-sm"
            style={{ alignSelf: 'flex-start' }}
          >
            🧹 Run Global DB Vacuum & Optimization Now
          </button>
        </div>
      </AccordionBody>
    </div>
  );
}
