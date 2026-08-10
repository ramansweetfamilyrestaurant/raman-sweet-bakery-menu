import React from 'react';
import { Star, MessageSquare, ExternalLink, Save } from 'lucide-react';

export default function ReviewView({ settingsForm, setSettingsForm, handleSaveSettings }) {
  const [saving, setSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await handleSaveSettings();
      setSuccessMsg('✅ Google review link saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to save link: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            ⭐ Customer Reviews & Rating Feedback
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Configure Google Review redirect links and collect 5-star customer feedback.
          </span>
        </div>

        {successMsg && (
          <span style={{ background: 'var(--adm-success-bg)', color: 'var(--adm-success)', padding: '6px 14px', borderRadius: 'var(--adm-radius-full)', fontSize: '0.78rem', fontWeight: 800 }}>
            {successMsg}
          </span>
        )}
      </div>

      {/* Review Link Form Card */}
      <div className="adm-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adm-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={18} color="var(--adm-accent)" /> Google Business Review Page URL
        </h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
              GOOGLE REVIEW DIRECT LINK (https://g.page/r/...):
            </label>
            <input
              type="url"
              placeholder="https://g.page/r/your-restaurant-review-link"
              value={settingsForm?.google_review_url || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, google_review_url: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button type="submit" disabled={saving} className="adm-btn adm-btn-primary" style={{ padding: '10px 20px', fontWeight: 800 }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Review URL'}
            </button>

            {settingsForm?.google_review_url && (
              <a
                href={settingsForm.google_review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="adm-btn adm-btn-secondary"
                style={{ padding: '10px 16px', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={15} /> Test Open Google Review Link ➔
              </a>
            )}
          </div>
        </form>
      </div>

      {/* Review Feedback Tips Card */}
      <div className="adm-card" style={{ padding: '18px', background: 'var(--adm-surface-subtle)' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--adm-primary)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MessageSquare size={16} color="var(--adm-accent)" /> How Customer Feedback Works
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--adm-muted)', lineHeight: 1.6 }}>
          <li>When customers view your digital menu, they can tap <strong>"Rate & Review Us"</strong>.</li>
          <li>Happy 5-star guests are automatically directed to your Google Business page to post public reviews!</li>
        </ul>
      </div>
    </div>
  );
}
