import React, { useState, useEffect } from 'react';
import { X, Star, Sparkles, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import { generateSmartReview, getCustomerReviewProfile } from '../utils/aiReviewGenerator';

export default function CustomerReviewModal({ info, onClose }) {
  const restoName = info?.name || 'Restaurant';
  const profile = getCustomerReviewProfile(info?.business_type, info?.resto_type);
  const availableChips = profile.highlights || [];

  const [rating, setRating] = useState(5);
  const [selectedChips, setSelectedChips] = useState(profile.defaultChips || []);
  const [customNote, setCustomNote] = useState('');
  const [generatedReview, setGeneratedReview] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  // Re-generate AI review on any input change
  useEffect(() => {
    const reviewText = generateSmartReview({
      restoName,
      restoType: info?.resto_type,
      businessType: info?.business_type,
      rating,
      selectedChips,
      customNote
    });
    setGeneratedReview(reviewText);
  }, [restoName, info?.resto_type, info?.business_type, rating, selectedChips, customNote]);

  const toggleChip = (chipLabel) => {
    if (selectedChips.includes(chipLabel)) {
      setSelectedChips(selectedChips.filter(c => c !== chipLabel));
    } else {
      setSelectedChips([...selectedChips, chipLabel]);
    }
  };

  const handleCopyAndPost = () => {
    if (navigator.clipboard && generatedReview) {
      navigator.clipboard.writeText(generatedReview);
    }
    setCopiedToast(true);

    setTimeout(() => {
      setCopiedToast(false);
      const hasCustomUrl = info?.google_review_url && typeof info.google_review_url === 'string' && info.google_review_url.trim() !== '';
      const googleUrl = hasCustomUrl
        ? info.google_review_url.trim()
        : `https://www.google.com/search?q=${encodeURIComponent(restoName + ' ' + (info?.address || ''))}`;
      window.open(googleUrl, '_blank');
    }, 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 12000,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        position: 'relative',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
          color: '#FFFFFF',
          padding: '20px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          borderBottom: '3px solid #DFBA67',
          textAlign: 'center',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '14px', right: '14px',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#FFFFFF', borderRadius: '50%', width: '30px', height: '30px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>

          <div style={{
            width: '50px', height: '50px', borderRadius: '50%',
            background: '#FFFFFF', border: '2px solid #DFBA67',
            margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            {info?.logo ? <img src={info.logo} alt={restoName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '⭐'}
          </div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#DFBA67' }}>
            {restoName}
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#E2E8F0' }}>
            Customer Rating & Google Review
          </span>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          
          {/* Toast Notification */}
          {copiedToast && (
            <div style={{
              background: '#0F172A',
              color: '#FFD700',
              padding: '10px 16px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              border: '1px solid #FFD700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '14px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <CheckCircle2 size={16} color="#FFD700" />
              <span>Review Copied! Opening Google Reviews...</span>
            </div>
          )}

          {/* Star Rating Card */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            border: '1px solid #E2E8F0',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', marginBottom: '10px' }}>
              {profile.question}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <Star
                    size={32}
                    fill={star <= rating ? '#FFD700' : '#E2E8F0'}
                    color={star <= rating ? '#F59E0B' : '#CBD5E1'}
                  />
                </button>
              ))}
            </div>

            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669' }}>
              {rating === 5 && '⭐⭐⭐⭐⭐ Excellent Experience!'}
              {rating === 4 && '⭐⭐⭐⭐ Great Experience!'}
              {rating === 3 && '⭐⭐⭐ Good Experience'}
              {rating === 2 && '⭐⭐ Average Experience'}
              {rating === 1 && '⭐ Needs Improvement'}
            </span>
          </div>

          {/* Highlight Chips */}
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              ✨ Tap highlights to customize review (Optional):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {availableChips.map((chip) => {
                const isSelected = selectedChips.includes(chip.label);
                return (
                  <button
                    key={chip.id}
                    onClick={() => toggleChip(chip.label)}
                    style={{
                      background: isSelected ? '#ECFDF5' : '#F1F5F9',
                      color: isSelected ? '#047857' : '#334155',
                      border: isSelected ? '1px solid #10B981' : '1px solid #CBD5E1',
                      padding: '5px 10px',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Note Input */}
          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder={profile.placeholder}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>

          {/* AI Review Text Box */}
          <div style={{
            background: 'linear-gradient(135deg, #FEFCE8 0%, #FFFBEB 100%)',
            border: '1.5px solid #DFBA67',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #DFBA67, #B45309)',
                color: '#FFFFFF',
                fontSize: '0.62rem',
                fontWeight: 900,
                padding: '2px 7px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                <Sparkles size={10} /> AI Review Generated
              </span>
            </div>

            <textarea
              value={generatedReview}
              onChange={(e) => setGeneratedReview(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                resize: 'vertical',
                fontSize: '0.84rem',
                lineHeight: 1.4,
                color: '#1E293B',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleCopyAndPost}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 18px',
              borderRadius: '14px',
              fontWeight: 900,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Copy size={16} />
            <span>Copy Review & Post on Google</span>
            <ArrowRight size={16} />
          </button>

        </div>
      </div>
    </div>
  );
}
