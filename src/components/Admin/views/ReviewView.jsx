import React, { useState } from 'react';
import { Star, MessageSquare, ExternalLink, Save, Bot, Copy, Check, RefreshCw, Sparkles, ThumbsUp, AlertTriangle } from 'lucide-react';

export default function ReviewView({ settingsForm, setSettingsForm, handleSaveSettings }) {
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // AI Review Assistant State
  const [customerReview, setCustomerReview] = useState('');
  const [starRating, setStarRating] = useState(5);
  const [selectedTone, setSelectedTone] = useState('warm'); // warm, professional, apologetic, short
  const [generatedReply, setGeneratedReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quickCopiedId, setQuickCopiedId] = useState(null);

  const isAiEnabled = settingsForm?.ai_review_enabled !== false && settingsForm?.ai_review_enabled !== 0;
  const restoName = settingsForm?.name || 'our restaurant';

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

  const sampleReviews = [
    {
      label: '🌟 5-Star Delicious Food',
      text: 'Amazing food! The Shahi Paneer and Butter Naan were exceptionally delicious. Highly recommended!',
      rating: 5
    },
    {
      label: '😊 4-Star Good Ambience',
      text: 'Great food quality and clean hygiene. Service was slightly busy during peak hours, but overall a wonderful experience.',
      rating: 4
    },
    {
      label: '⚠️ 1-Star Delay Complaint',
      text: 'Order was delayed by 30 minutes and the food was not served hot. Disappointed with the service today.',
      rating: 1
    }
  ];

  const handleGenerateAIReply = () => {
    setGenerating(true);
    setCopied(false);
    
    setTimeout(() => {
      let reply = '';
      const textLower = customerReview.toLowerCase();
      const mentionsPaneer = textLower.includes('paneer');
      const mentionsNaan = textLower.includes('naan');
      const mentionsSweet = textLower.includes('sweet') || textLower.includes('mithai');
      const dishMention = mentionsPaneer ? 'Paneer dishes' : mentionsSweet ? 'sweet delicacies' : mentionsNaan ? 'freshly baked Naans' : 'dishes';

      if (starRating >= 4) {
        if (selectedTone === 'warm') {
          reply = `Thank you so much for the glowing ${starRating}-star review! 🌟 We are absolutely thrilled to hear that you enjoyed ${customerReview ? `our ${dishMention}` : 'your dining experience'} at ${restoName}. Serving you fresh, flavorful meals is our top priority. We look forward to welcoming you back again soon for another delicious feast! 🙏😊`;
        } else if (selectedTone === 'professional') {
          reply = `Dear Guest, thank you for sharing your positive feedback and ${starRating}-star rating for ${restoName}. We take immense pride in maintaining high standards of quality and service. Your appreciation motivates our entire culinary team. We look forward to serving you again in the near future. Best regards, Management Team.`;
        } else if (selectedTone === 'short') {
          reply = `Thank you for the fantastic ${starRating}-star review! 🙏 We are delighted you loved your meal at ${restoName}. Hope to see you again soon!`;
        } else {
          reply = `Thank you for choosing ${restoName}! We truly appreciate your feedback and hope your next visit is even more memorable. ✨`;
        }
      } else {
        // 1 - 3 Star Reviews
        if (selectedTone === 'apologetic') {
          reply = `Dear Guest, thank you for bringing your concern to our attention. We sincerely apologize for not meeting your expectations during your recent visit to ${restoName}. Providing prompt and high-quality food is our commitment, and we regret the delay/issue you experienced. Please reach out directly to us at ${settingsForm?.phone || 'our restaurant contact'} so we can make this right for you. We hope to have the chance to serve you better next time.`;
        } else if (selectedTone === 'professional') {
          reply = `Dear Valued Customer, thank you for providing your constructive feedback regarding ${restoName}. We apologize for the inconvenience caused. We have shared your comments with our kitchen & service staff to ensure immediate corrective action. Please give us another opportunity to serve you a better experience.`;
        } else {
          reply = `We sincerely apologize for your experience at ${restoName}. We take all customer feedback seriously and are taking immediate steps to resolve this. Kindly contact our team at ${settingsForm?.phone || 'phone'} so we can assist you personally.`;
        }
      }

      setGeneratedReply(reply);
      setGenerating(false);
    }, 400);
  };

  const handleCopyReply = (text, id = null) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setQuickCopiedId(id);
      setTimeout(() => setQuickCopiedId(null), 2500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={20} color="var(--adm-accent)" /> Customer Reviews & AI Auto-Reply Assistant
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Configure Google Review links & generate instant AI responses for Google Business reviews.
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

      {/* 🤖 Google Review AI Auto-Reply Assistant Card */}
      <div className="adm-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(180deg, var(--adm-card) 0%, var(--adm-surface-subtle) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--adm-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={20} color="#8B5CF6" /> Google Review AI Auto-Reply Assistant
            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', color: '#FFFFFF', padding: '2px 8px', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={11} /> AI Powered
            </span>
          </h3>

          {!isAiEnabled && (
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', border: '1px solid #F59E0B', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
              🔒 Pro / Enterprise Feature
            </span>
          )}
        </div>

        {isAiEnabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Quick Sample Buttons */}
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>
                QUICK TEST SAMPLES:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {sampleReviews.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomerReview(s.text);
                      setStarRating(s.rating);
                      setSelectedTone(s.rating <= 3 ? 'apologetic' : 'warm');
                    }}
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--adm-surface)',
                      border: '1px solid var(--adm-border)',
                      color: 'var(--adm-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Review Text */}
            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
                PASTE CUSTOMER GOOGLE REVIEW TEXT:
              </label>
              <textarea
                rows="3"
                placeholder="Paste customer Google review text here (e.g. 'Loved the Paneer Tikka! Great service and quick delivery.')"
                value={customerReview}
                onChange={(e) => setCustomerReview(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.86rem' }}
              />
            </div>

            {/* Rating & Tone Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
                  REVIEW STAR RATING:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        setStarRating(star);
                        if (star <= 3 && selectedTone === 'warm') setSelectedTone('apologetic');
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--adm-radius-md)',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        border: starRating === star ? '2px solid #F59E0B' : '1px solid var(--adm-border)',
                        background: starRating === star ? '#FEF3C7' : 'var(--adm-surface)',
                        color: starRating === star ? '#D97706' : 'var(--adm-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
                  RESPONSE TONE:
                </label>
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.85rem' }}
                >
                  <option value="warm">🌟 Warm & Hospitable</option>
                  <option value="professional">💼 Professional & Elegant</option>
                  <option value="apologetic">🙏 Humble & Resolution-Focused</option>
                  <option value="short">⚡ Short & Punchy</option>
                </select>
              </div>
            </div>

            {/* Action Button */}
            <div>
              <button
                type="button"
                onClick={handleGenerateAIReply}
                disabled={generating}
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 'var(--adm-radius-md)',
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
                }}
              >
                {generating ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                {generating ? 'Generating AI Response...' : '🤖 Generate AI Auto-Reply'}
              </button>
            </div>

            {/* Output AI Generated Reply */}
            {generatedReply && (
              <div style={{
                background: 'var(--adm-surface)',
                border: '1.5px solid #8B5CF6',
                borderRadius: 'var(--adm-radius-md)',
                padding: '16px',
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#8B5CF6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Bot size={14} /> AI GENERATED GOOGLE RESPONSE:
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyReply(generatedReply)}
                      style={{
                        background: copied ? '#10B981' : '#8B5CF6',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied to Clipboard!' : 'Copy Reply'}
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateAIReply}
                      style={{
                        background: 'transparent',
                        color: 'var(--adm-muted)',
                        border: '1px solid var(--adm-border)',
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RefreshCw size={12} /> Regenerate
                    </button>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--adm-primary)', lineHeight: 1.6, fontWeight: 500 }}>
                  "{generatedReply}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--adm-muted)', lineHeight: 1.5 }}>
            Google Review AI Auto-Reply Assistant enables automated, intelligent 5-star responses for Google Business reviews. Upgrade your SaaS subscription plan to Pro / Enterprise to activate this feature.
          </div>
        )}
      </div>

      {/* Review Feedback Tips Card */}
      <div className="adm-card" style={{ padding: '18px', background: 'var(--adm-surface-subtle)' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--adm-primary)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MessageSquare size={16} color="var(--adm-accent)" /> How Customer Feedback & Reviews Work
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--adm-muted)', lineHeight: 1.6 }}>
          <li>When customers view your digital menu, they can tap <strong>"Rate & Review Us"</strong>.</li>
          <li>Happy 5-star guests are automatically directed to your Google Business page to post public reviews!</li>
          <li>Use the <strong>AI Auto-Reply Assistant</strong> above to quickly copy personalized responses to your Google Business reviews dashboard.</li>
        </ul>
      </div>
    </div>
  );
}
