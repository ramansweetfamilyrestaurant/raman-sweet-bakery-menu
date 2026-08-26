import React from 'react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { FEATURE_METADATA } from '../../../utils/planCapabilities';

/**
 * Reusable Luxury Plan Locked Feature Card
 * 
 * Displays locked feature benefit and direct CTA to open existing billing upgrade flow.
 */
export default function PlanLockedCard({
  featureKey,
  title,
  description,
  minTier,
  onUpgrade,
  compact = false
}) {
  const meta = FEATURE_METADATA[featureKey] || {};
  const featureTitle = title || meta.name || 'Premium Feature';
  const featureDesc = description || meta.benefit || 'This feature is not included in your current plan tier.';
  const requiredPlan = minTier || meta.minTier || 'Pro';

  if (compact) {
    return (
      <div style={{
        background: '#FFFBEB',
        border: '1.5px solid #FDE68A',
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: '#FEF3C7',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Lock size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: '0.84rem', color: '#78350F', display: 'block' }}>
              🔒 {featureTitle}
            </strong>
            <span style={{ fontSize: '0.74rem', color: '#92400E' }}>
              Available on <strong>{requiredPlan} Plan</strong>
            </span>
          </div>
        </div>

        {onUpgrade && (
          <button
            onClick={onUpgrade}
            style={{
              padding: '7px 14px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
              color: '#FFFFFF',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
              flexShrink: 0
            }}
          >
            <Sparkles size={13} />
            Upgrade Plan
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1.5px solid #FDE68A',
      padding: '28px 24px',
      maxWidth: '620px',
      margin: '20px auto',
      textAlign: 'center',
      boxShadow: '0 4px 16px rgba(217, 119, 6, 0.06)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: '#FEF3C7',
        color: '#D97706',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '14px'
      }}>
        <Lock size={26} />
      </div>

      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1E293B', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
        {featureTitle}
      </h3>

      <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: '1.5', margin: '0 auto 18px auto', maxWidth: '480px' }}>
        {featureDesc}
      </p>

      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#FEF3C7',
        border: '1px solid #FDE68A',
        color: '#92400E',
        padding: '5px 12px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 800,
        marginBottom: '20px'
      }}>
        <span>⭐ Included in {requiredPlan} Plan & above</span>
      </div>

      {onUpgrade && (
        <div>
          <button
            onClick={onUpgrade}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFFFFF',
              fontSize: '0.90rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              minHeight: '44px'
            }}
          >
            <span>View Upgrade Options</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
