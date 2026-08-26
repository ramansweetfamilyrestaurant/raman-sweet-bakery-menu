import React from 'react';
import { Info } from 'lucide-react';

/**
 * Reusable Unsupported Business Type Feature Card
 * 
 * Explains that a feature is specific to another business taxonomy (e.g. Cinema screens)
 * without showing misleading plan upgrade prompts.
 */
export default function UnsupportedFeatureCard({
  title,
  requiredBusinessType = 'Cinema / Theatre',
  description
}) {
  return (
    <div style={{
      background: '#F8FAFC',
      borderRadius: '16px',
      border: '1.5px dashed #CBD5E1',
      padding: '24px 20px',
      maxWidth: '560px',
      margin: '16px auto',
      textAlign: 'center',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '46px',
        height: '46px',
        borderRadius: '12px',
        background: '#E2E8F0',
        color: '#64748B',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10px'
      }}>
        <Info size={22} />
      </div>

      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', margin: '0 0 6px 0' }}>
        {title || 'Business-Specific Tool'}
      </h4>

      <p style={{ fontSize: '0.80rem', color: '#64748B', lineHeight: '1.5', margin: '0 auto', maxWidth: '420px' }}>
        {description || `This operational tool is designed specifically for ${requiredBusinessType} venues.`}
      </p>
    </div>
  );
}
