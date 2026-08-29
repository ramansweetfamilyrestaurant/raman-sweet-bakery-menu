import React, { useState, useMemo } from 'react';
import { 
  Star, 
  MessageSquare, 
  ExternalLink, 
  Save, 
  Bot, 
  Copy, 
  Check, 
  RefreshCw, 
  Sparkles, 
  ThumbsUp, 
  AlertTriangle, 
  ArrowLeft,
  Filter,
  Clock,
  ShieldCheck,
  TrendingUp,
  Send,
  Edit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  X,
  Globe,
  Sliders,
  Search,
  Share2,
  HelpCircle,
  Info,
  User,
  HeartHandshake
} from 'lucide-react';
import { resolveTenantCapabilities } from '../../../utils/planCapabilities';

export default function ReviewView({ 
  settingsForm = {}, 
  setSettingsForm, 
  handleSaveSettings, 
  token, 
  restaurantInfo,
  capabilities,
  onUpgrade,
  onBackToSetup 
}) {
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);
  const isAiPlanEnabled = resolvedCaps.ai_review_enabled !== false;
  const isGoogleReviewsPlanEnabled = resolvedCaps.google_reviews_enabled !== false;

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'newest' | 'lowest' | 'unanswered'
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [googleUrlInput, setGoogleUrlInput] = useState(settingsForm?.google_review_url || '');

  // AI Configuration State
  const [aiEnabled, setAiEnabled] = useState(settingsForm?.ai_review_enabled !== false);
  const [autoGenReplies, setAutoGenReplies] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [selectedTone, setSelectedTone] = useState(settingsForm?.ai_review_tone || 'warm'); // 'warm' | 'professional' | 'concise' | 'appreciative'
  const [selectedLanguage, setSelectedLanguage] = useState(settingsForm?.ai_review_language || 'English');
  const [brandVoice, setBrandVoice] = useState(
    settingsForm?.ai_brand_instructions || 
    'Thank customers warmly, highlight our fresh ingredients and hospitality, stay polite and professional, and invite them back.'
  );

  // Active Review Preview & AI Generator State
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [customReplyText, setCustomReplyText] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState({});

  const restoName = settingsForm?.name || restaurantInfo?.name || 'our restaurant';
  const isGoogleConnected = Boolean(settingsForm?.google_review_url && settingsForm.google_review_url.trim());

  // Base Review Feed Data
  const [reviewsList, setReviewsList] = useState([
    {
      id: 'rev-1',
      author: 'Aarav Sharma',
      avatar: 'AS',
      rating: 5,
      date: 'Yesterday',
      timestamp: '28 May 2026',
      platform: 'Google',
      text: 'Amazing food and top-notch hospitality! The Paneer Butter Masala and Garlic Naan were exceptionally delicious, freshly made and piping hot. Definitely our new favorite family dining spot in town.',
      status: 'needs_reply', // 'replied' | 'needs_reply'
      reply: null,
      tags: ['Food Quality', 'Paneer', 'Family Dining']
    },
    {
      id: 'rev-2',
      author: 'Priya Patel',
      avatar: 'PP',
      rating: 5,
      date: '3 days ago',
      timestamp: '26 May 2026',
      platform: 'Google',
      text: 'Loved the digital QR ordering system! We placed our order directly from table 4, and the food arrived in under 12 minutes. The Dal Makhani and Gulab Jamun were heavenly.',
      status: 'replied',
      reply: `Dear Priya, thank you so much for the glowing 5-star review! 🌟 We're thrilled that you enjoyed our fast QR table ordering and loved the Dal Makhani and Gulab Jamun. Looking forward to welcoming you again soon! 🙏`,
      tags: ['QR Ordering', 'Desserts', 'Fast Service']
    },
    {
      id: 'rev-3',
      author: 'Vikram Singh',
      avatar: 'VS',
      rating: 4,
      date: '5 days ago',
      timestamp: '24 May 2026',
      platform: 'Google',
      text: 'Great food quality and clean hygiene. The ambiance was pleasant, though service was slightly busy during Sunday dinner rush. Overall a very good experience and value for money.',
      status: 'needs_reply',
      reply: null,
      tags: ['Ambiance', 'Sunday Rush', 'Hygiene']
    },
    {
      id: 'rev-4',
      author: 'Neha Gupta',
      avatar: 'NG',
      rating: 1,
      date: '1 week ago',
      timestamp: '21 May 2026',
      platform: 'Google',
      text: 'We had to wait over 35 minutes for our main course on Saturday night. While the food was tasty once it arrived, the waiting time needs serious improvement.',
      status: 'needs_reply',
      reply: null,
      tags: ['Wait Time', 'Saturday Rush']
    }
  ]);

  // Filtered Reviews
  const filteredReviews = useMemo(() => {
    return reviewsList.filter(rev => {
      if (activeFilter === 'newest') return true;
      if (activeFilter === 'lowest') return rev.rating <= 3;
      if (activeFilter === 'unanswered') return rev.status === 'needs_reply';
      return true;
    });
  }, [reviewsList, activeFilter]);

  const activeReview = reviewsList[activeReviewIndex] || reviewsList[0];

  // Helper to generate AI response
  const generateAiResponseText = (review, tone, lang) => {
    const dish = review.tags?.find(t => t.toLowerCase().includes('paneer') || t.toLowerCase().includes('dal') || t.toLowerCase().includes('dessert')) || 'dishes';
    
    if (review.rating >= 4) {
      if (tone === 'warm') {
        return `Thank you so much for the wonderful ${review.rating}-star review, ${review.author}! 🌟 We're delighted you loved our food and service${dish ? `, especially our ${dish}` : ''}. Serving you fresh, memorable meals is our greatest pleasure. We can't wait to serve you again soon at ${restoName}! 🙏✨`;
      } else if (tone === 'professional') {
        return `Dear ${review.author}, thank you for taking the time to share your feedback and ${review.rating}-star rating for ${restoName}. We take pride in delivering exceptional dining experiences and high culinary standards. We look forward to your next visit. Warm regards, Management Team.`;
      } else if (tone === 'concise') {
        return `Thank you for the fantastic ${review.rating}-star review, ${review.author}! We're thrilled you enjoyed your dining experience at ${restoName}. See you again soon!`;
      } else {
        return `We are deeply grateful for your generous ${review.rating}-star rating, ${review.author}! Your appreciation brings huge smiles to our kitchen and service staff. Thank you for choosing ${restoName}! ❤️`;
      }
    } else {
      if (tone === 'warm' || tone === 'appreciative') {
        return `Dear ${review.author}, we sincerely apologize for the delay you experienced. Providing prompt, hot meals is our top commitment, and we regret falling short during your visit. We have briefed our kitchen team to improve service speed during peak hours. Please reach out to us at ${settingsForm?.phone || 'our front desk'} so we can make this right on your next visit. 🙏`;
      } else {
        return `Dear ${review.author}, thank you for your candid feedback. We apologize for the wait time during your meal. We are actively refining our kitchen scheduling during weekend rushes to ensure faster turnaround. We appreciate your patience and hope for another opportunity to serve you better.`;
      }
    }
  };

  const [currentAiReply, setCurrentAiReply] = useState(() => {
    return generateAiResponseText(activeReview, selectedTone, selectedLanguage);
  });

  const handleSelectReviewForAi = (index) => {
    setActiveReviewIndex(index);
    const targetRev = reviewsList[index];
    const newReply = targetRev.reply || generateAiResponseText(targetRev, selectedTone, selectedLanguage);
    setCurrentAiReply(newReply);
    setCustomReplyText(newReply);
    setIsEditingReply(false);
  };

  const handleRegenerateAiReply = async () => {
    setGeneratingAi(true);
    try {
      if (token) {
        const res = await fetch('/api/admin/generate-ai-review-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            reviewText: activeReview.text,
            starRating: activeReview.rating,
            selectedTone,
            restaurantName: restoName
          })
        });
        const data = await res.json();
        if (res.ok && data?.reply) {
          setCurrentAiReply(data.reply);
          setCustomReplyText(data.reply);
          setGeneratingAi(false);
          return;
        }
      }
    } catch (e) {}

    // Fallback AI generation
    setTimeout(() => {
      const generated = generateAiResponseText(activeReview, selectedTone, selectedLanguage);
      setCurrentAiReply(generated);
      setCustomReplyText(generated);
      setGeneratingAi(false);
    }, 400);
  };

  const handleApproveAndPost = () => {
    const finalReply = isEditingReply ? customReplyText : currentAiReply;
    
    // Update review status in list
    setReviewsList(prev => prev.map((r, idx) => {
      if (idx === activeReviewIndex) {
        return { ...r, status: 'replied', reply: finalReply };
      }
      return r;
    }));

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(finalReply);
    }
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);

    // Open Google Review page if connected
    if (settingsForm?.google_review_url) {
      window.open(settingsForm.google_review_url, '_blank');
    }
  };

  const handleSaveGoogleUrl = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedForm = { ...settingsForm, google_review_url: googleUrlInput.trim() };
      setSettingsForm(updatedForm);
      if (handleSaveSettings) {
        await handleSaveSettings(updatedForm);
      }
      setSuccessMsg('✓ Google Reviews link connected successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowConnectModal(false);
    } catch (err) {
      alert('Failed to save Google Review link: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (window.confirm('Disconnect Google Reviews link? Customers will no longer be directed to your Google business review page.')) {
      setGoogleUrlInput('');
      const updatedForm = { ...settingsForm, google_review_url: '' };
      setSettingsForm(updatedForm);
      if (handleSaveSettings) {
        await handleSaveSettings(updatedForm);
      }
      setSuccessMsg('✓ Google Reviews link disconnected.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const toggleExpand = (id) => {
    setExpandedReviews(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      maxWidth: '1280px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      paddingBottom: '120px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Responsive Grid Styles */}
      <style>{`
        .reviews-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(340px, 1fr);
          gap: 16px;
          align-items: flex-start;
          width: 100%;
          box-sizing: border-box;
        }
        .filter-chip-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.76rem;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #EAE5DF;
          background: #FAF8F5;
          color: #64748B;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .filter-chip-btn.active {
          background: #064E3B;
          color: #FFFFFF;
          border-color: #064E3B;
          box-shadow: 0 2px 6px rgba(6, 78, 59, 0.20);
        }
        @media (max-width: 960px) {
          .reviews-page-grid {
            grid-template-columns: 100% !important;
            gap: 14px !important;
          }
          .metrics-summary-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

      {/* Global Toast Alert */}
      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '14px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ECFDF5',
          color: '#059669',
          border: '1px solid #A7F3D0'
        }}>
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================================================
          1. PAGE HEADER
         ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        boxSizing: 'border-box',
        width: '100%',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBackToSetup && (
            <button
              type="button"
              onClick={onBackToSetup}
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#0F172A',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '0.78rem',
                fontWeight: 800
              }}
            >
              <ArrowLeft size={16} />
              <span>Settings</span>
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.20rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={18} color="#D97706" fill="#D97706" />
              <span>Customer Reviews & AI Assistant</span>
            </h2>
            <p style={{ fontSize: '0.74rem', color: '#64748B', margin: 0 }}>
              Manage customer reviews, improve your reputation and create helpful AI replies.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isGoogleConnected ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
              <span>Reviews Connected</span>
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FECACA',
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626' }} />
              <span>Not Connected</span>
            </div>
          )}

          {isGoogleConnected ? (
            <a
              href={settingsForm.google_review_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.76rem',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>View Google Reviews</span>
              <ExternalLink size={13} />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#064E3B',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Globe size={14} />
              <span>Connect Google Reviews</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. TOP SUMMARY METRICS (4 Compact Metrics)
         ========================================================================= */}
      <div className="metrics-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        
        {/* Metric 1: Average Rating */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Average Rating
            </span>
            <div style={{ fontSize: '1.40rem', fontWeight: 900, color: '#0F172A', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>4.7</span>
              <Star size={18} color="#D97706" fill="#D97706" />
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Star size={18} />
          </div>
        </div>

        {/* Metric 2: Total Reviews */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Reviews
            </span>
            <div style={{ fontSize: '1.40rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              248
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F1F5F9', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} />
          </div>
        </div>

        {/* Metric 3: New This Month */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New This Month
            </span>
            <div style={{ fontSize: '1.40rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
              32
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Metric 4: Response Rate */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Response Rate
            </span>
            <div style={{ fontSize: '1.40rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              92%
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FAF8F5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN TWO-COLUMN WORKSPACE
         ========================================================================= */}
      <div className="reviews-page-grid">
        
        {/* LEFT / MAIN COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SECTION 1 — RATING OVERVIEW CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A' }}>
              Rating Distribution & Summary
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '20px', alignItems: 'center' }}>
              {/* Score Left */}
              <div style={{ textAlign: 'center', borderRight: '1px solid #EAE5DF', paddingRight: '16px' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>
                  4.7
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', margin: '6px 0 2px' }}>
                  {[1, 2, 3, 4, 5].map(st => (
                    <Star key={st} size={15} color="#D97706" fill={st <= 4 ? '#D97706' : '#FDE68A'} />
                  ))}
                </div>
                <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 700 }}>
                  248 total reviews
                </span>
              </div>

              {/* Distribution Horizontal Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { star: 5, pct: 78, count: 193 },
                  { star: 4, pct: 14, count: 35 },
                  { star: 3, pct: 5, count: 12 },
                  { star: 2, pct: 2, count: 5 },
                  { star: 1, pct: 1, count: 3 }
                ].map(row => (
                  <div key={row.star} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem' }}>
                    <span style={{ width: '24px', fontWeight: 800, color: '#475569' }}>{row.star} ★</span>
                    <div style={{ flex: 1, height: '7px', borderRadius: '4px', background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ width: `${row.pct}%`, height: '100%', background: row.star >= 4 ? '#059669' : row.star === 3 ? '#D97706' : '#DC2626', borderRadius: '4px' }} />
                    </div>
                    <span style={{ width: '32px', textAlign: 'right', fontWeight: 700, color: '#64748B', fontSize: '0.70rem' }}>
                      {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Chips Bar */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px', overflowX: 'auto' }}>
              {[
                { id: 'all', label: 'All (248)' },
                { id: 'newest', label: 'Newest (32)' },
                { id: 'lowest', label: 'Lowest Rated (8)' },
                { id: 'unanswered', label: 'Needs Reply (12)' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`filter-chip-btn ${activeFilter === f.id ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2 — REVIEW FEED LIST */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A' }}>
                Customer Feedback Feed ({filteredReviews.length})
              </strong>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Google Verified Reviews
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredReviews.map((rev, idx) => {
                const isSelected = reviewsList[activeReviewIndex]?.id === rev.id;
                const isExpanded = expandedReviews[rev.id];
                const isLongText = rev.text.length > 130;
                const displayText = isLongText && !isExpanded ? `${rev.text.slice(0, 130)}...` : rev.text;

                return (
                  <div
                    key={rev.id}
                    onClick={() => handleSelectReviewForAi(idx)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: isSelected ? '#F0FDF4' : '#FAF8F5',
                      border: isSelected ? '1.5px solid #064E3B' : '1px solid #EAE5DF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Author & Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          background: '#064E3B',
                          color: '#FFFFFF',
                          fontWeight: 900,
                          fontSize: '0.72rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {rev.avatar}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.84rem', color: '#0F172A', display: 'block' }}>{rev.author}</strong>
                          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{rev.date} • Platform: {rev.platform}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '1px' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={13} color="#D97706" fill={s <= rev.rating ? '#D97706' : '#E2E8F0'} />
                          ))}
                        </div>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '8px',
                          background: rev.status === 'replied' ? '#DCFCE7' : '#FEF3C7',
                          color: rev.status === 'replied' ? '#15803D' : '#D97706',
                          border: rev.status === 'replied' ? '1px solid #BBF7D0' : '1px solid #FDE68A'
                        }}>
                          {rev.status === 'replied' ? '● Replied' : '● Needs Reply'}
                        </span>
                      </div>
                    </div>

                    {/* Review Text */}
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#334155', lineHeight: 1.45 }}>
                      “{displayText}”
                    </p>
                    {isLongText && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(rev.id);
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#064E3B', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}

                    {/* Published Reply Snippet if exists */}
                    {rev.reply && (
                      <div style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: '10px', border: '1px solid #EAE5DF', fontSize: '0.72rem', color: '#475569', display: 'flex', gap: '6px' }}>
                        <Bot size={14} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ color: '#059669', display: 'block', marginBottom: '2px' }}>Your Response:</strong>
                          <span>{rev.reply}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Row */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectReviewForAi(idx);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#064E3B',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Sparkles size={12} />
                        <span>Generate AI Reply</span>
                      </button>

                      {settingsForm?.google_review_url && (
                        <a
                          href={settingsForm.google_review_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#0F172A',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <span>View ↗</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 5 — RESPONSE WORKFLOW CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <strong style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A' }}>
              4-Step Review Response Workflow
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {[
                { step: '1', title: 'New Review', desc: 'Customer posts on Google' },
                { step: '2', title: 'AI Generates', desc: 'Creates tailored response' },
                { step: '3', title: 'Admin Reviews', desc: 'Approve or customize' },
                { step: '4', title: 'Publish Reply', desc: 'Live on Google profile' }
              ].map(st => (
                <div key={st.step} style={{ padding: '10px', borderRadius: '10px', background: '#FAF8F5', border: '1px solid #EAE5DF' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#064E3B', color: '#FFF', fontSize: '0.72rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    {st.step}
                  </div>
                  <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block' }}>{st.title}</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{st.desc}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.74rem', color: '#D97706', fontWeight: 800 }}>
                ● 12 reviews currently need attention
              </span>
              <button
                type="button"
                onClick={() => setActiveFilter('unanswered')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Review Pending Replies →
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SECTION 3 — AI AUTO-REPLY ASSISTANT SETTINGS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={18} color="#059669" />
                  <span>AI Auto-Reply Assistant</span>
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Generate helpful, brand-friendly responses to reviews.
                </span>
              </div>
              <span style={{
                fontSize: '0.70rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '10px',
                background: aiEnabled && isAiPlanEnabled ? '#ECFDF5' : '#F1F5F9',
                color: aiEnabled && isAiPlanEnabled ? '#059669' : '#64748B',
                border: aiEnabled && isAiPlanEnabled ? '1px solid #A7F3D0' : '1px solid #CBD5E1'
              }}>
                {aiEnabled && isAiPlanEnabled ? 'AI Assistant: ON' : 'AI Assistant: OFF'}
              </span>
            </div>

            {/* Plan Lock Card if not enabled in SaaS plan */}
            {!isAiPlanEnabled && (
              <div style={{
                padding: '14px',
                borderRadius: '12px',
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={13} /> AI Smart Assistant Locked
                  </strong>
                  <span style={{ fontSize: '0.70rem', color: '#B45309' }}>
                    Customer Reviews & AI Assistant is available on an eligible TouchQR plan.
                  </span>
                </div>
                {onUpgrade && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#D97706', color: '#FFF', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Upgrade Plan
                  </button>
                )}
              </div>
            )}

            {/* Main Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: isAiPlanEnabled ? 1 : 0.65 }}>
              {/* Toggles */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF' }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Auto-generate replies</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Draft smart responses when reviews arrive</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoGenReplies}
                  disabled={!isAiPlanEnabled}
                  onChange={(e) => setAutoGenReplies(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#064E3B', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAF8F5', borderRadius: '10px', border: '1px solid #EAE5DF' }}>
                <div>
                  <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Require approval before publishing</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Admin verifies before copying to Google</span>
                </div>
                <input
                  type="checkbox"
                  checked={requireApproval}
                  disabled={!isAiPlanEnabled}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#064E3B', cursor: 'pointer' }}
                />
              </div>

              {/* Tone & Language Dropdowns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Reply Tone
                  </label>
                  <select
                    value={selectedTone}
                    disabled={!isAiPlanEnabled}
                    onChange={(e) => {
                      setSelectedTone(e.target.value);
                      setCurrentAiReply(generateAiResponseText(activeReview, e.target.value, selectedLanguage));
                    }}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}
                  >
                    <option value="warm">Warm & Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="concise">Concise</option>
                    <option value="appreciative">Appreciative</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Reply Language
                  </label>
                  <select
                    value={selectedLanguage}
                    disabled={!isAiPlanEnabled}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Hinglish">Hinglish</option>
                    <option value="Spanish">Spanish</option>
                  </select>
                </div>
              </div>

              {/* Brand Voice Instructions */}
              <div>
                <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Brand Voice Instructions
                </label>
                <textarea
                  rows={2}
                  value={brandVoice}
                  disabled={!isAiPlanEnabled}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  placeholder="e.g. Thank customers warmly, stay polite and professional..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.76rem', lineHeight: 1.4, boxSizing: 'border-box', color: '#0F172A' }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4 — AI REPLY PREVIEW (Split / Stacked Preview) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bot size={16} color="#059669" />
                <span>AI Suggested Reply Preview</span>
              </strong>
              <span style={{ fontSize: '0.70rem', color: '#059669', fontWeight: 800, background: '#ECFDF5', padding: '2px 8px', borderRadius: '8px' }}>
                Tone: {selectedTone}
              </span>
            </div>

            {/* Original Customer Review Box */}
            <div style={{ background: '#FAF8F5', padding: '12px 14px', borderRadius: '12px', border: '1px solid #EAE5DF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569' }}>
                  {activeReview.author}
                </span>
                <div style={{ display: 'flex', gap: '1px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={11} color="#D97706" fill={s <= activeReview.rating ? '#D97706' : '#E2E8F0'} />
                  ))}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.4 }}>
                “{activeReview.text}”
              </p>
            </div>

            {/* AI Generated Reply Box */}
            <div style={{ background: '#F0FDF4', padding: '12px 14px', borderRadius: '12px', border: '1px solid #BBF7D0', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={12} color="#166534" />
                  <span>AI Generated Draft</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingReply(!isEditingReply);
                    setCustomReplyText(currentAiReply);
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#166534', fontWeight: 800, fontSize: '0.70rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <Edit size={11} />
                  <span>{isEditingReply ? 'Done' : 'Edit'}</span>
                </button>
              </div>

              {isEditingReply ? (
                <textarea
                  rows={4}
                  value={customReplyText}
                  onChange={(e) => setCustomReplyText(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #86EFAC', fontSize: '0.78rem', boxSizing: 'border-box' }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#14532D', lineHeight: 1.45 }}>
                  {generatingAi ? '✨ AI is crafting response...' : currentAiReply}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={generatingAi}
                onClick={handleRegenerateAiReply}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={13} className={generatingAi ? 'spin' : ''} />
                <span>Regenerate</span>
              </button>

              <button
                type="button"
                onClick={handleApproveAndPost}
                style={{
                  flex: 1.4,
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#064E3B',
                  color: '#FFFFFF',
                  fontSize: '0.76rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                }}
              >
                <Check size={14} />
                <span>{copiedToast ? '✓ Copied & Ready!' : 'Approve & Post'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 6 — REPUTATION INSIGHTS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <strong style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A' }}>
              Review Insights & Topics
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.74rem' }}>
              <div>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Top Positive Topics
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Food Quality (94%)', 'Hospitality & Staff (89%)', 'Cleanliness (86%)'].map(t => (
                    <span key={t} style={{ padding: '3px 8px', borderRadius: '6px', background: '#ECFDF5', color: '#065F46', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                      ✓ {t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Needs Attention
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Peak Hour Wait Times (6%)', 'Packaging Seal (4%)'].map(t => (
                    <span key={t} style={{ padding: '3px 8px', borderRadius: '6px', background: '#FEF3C7', color: '#92400E', fontWeight: 700, border: '1px solid #FDE68A' }}>
                      ⚠ {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 7 — GOOGLE REVIEWS INTEGRATION CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={16} color="#064E3B" />
                <span>Google Reviews Integration</span>
              </strong>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: isGoogleConnected ? '#059669' : '#DC2626'
              }}>
                {isGoogleConnected ? '● Connected' : '○ Not Connected'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B', lineHeight: 1.4 }}>
              Direct customers to your verified Google Business profile to gather 5-star ratings and boost local search ranking.
            </p>

            {isGoogleConnected && (
              <div style={{ fontSize: '0.68rem', color: '#475569', background: '#FAF8F5', padding: '6px 10px', borderRadius: '8px', border: '1px solid #EAE5DF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {settingsForm.google_review_url}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              {isGoogleConnected ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleUrlInput(settingsForm.google_review_url || '');
                      setShowConnectModal(true);
                    }}
                    style={{ flex: 1, height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Reconnect / Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FFF5F5', color: '#DC2626', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setGoogleUrlInput(settingsForm.google_review_url || '');
                    setShowConnectModal(true);
                  }}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Globe size={14} />
                  <span>Connect Google Review URL</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONNECT GOOGLE REVIEW MODAL
         ========================================================================= */}
      {showConnectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE5DF', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  Connect Google Reviews
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Paste your Google Maps or Google Business review link
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGoogleUrl} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Google Review URL *
                </label>
                <input
                  type="url"
                  required
                  value={googleUrlInput}
                  onChange={(e) => setGoogleUrlInput(e.target.value)}
                  placeholder="https://g.page/r/.../review or https://maps.app.goo.gl/..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#FAF8F5', border: '1px solid #EAE5DF', fontSize: '0.72rem', color: '#64748B', lineHeight: 1.45 }}>
                💡 <strong>How to find your Google review link:</strong>
                <ol style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                  <li>Search your restaurant name on Google Maps.</li>
                  <li>Click <strong>Share</strong> or <strong>Ask for reviews</strong>.</li>
                  <li>Copy and paste the short link above.</li>
                </ol>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  style={{ flex: 1, height: '38px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, height: '38px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)' }}
                >
                  {saving ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
