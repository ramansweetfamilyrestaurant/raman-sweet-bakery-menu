import React from 'react';
import StatusBadge from './StatusBadge';
import { Eye, Edit3, Trash2, ExternalLink } from 'lucide-react';

export default function TenantCard({ resto, onOpen360, onEdit, onDelete, onImpersonate }) {
  return (
    <div className="sa-stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>{resto.name}</h3>
          <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)' }}>/{resto.subdomain}</span>
        </div>
        <StatusBadge status={resto.subscription_status} type={resto.subscription_type} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--sa-text-muted)' }}>
        <div><strong>Plan:</strong> {(resto.plan_name || resto.plan_tier || 'Free Trial').toUpperCase()}</div>
        <div><strong>Owner:</strong> {resto.owner_email || resto.email || resto.phone || 'N/A'}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--sa-border)', paddingTop: '12px', marginTop: 'auto' }}>
        <button
          type="button"
          onClick={() => onOpen360(resto)}
          className="sa-btn sa-btn-accent sa-btn-sm"
        >
          <Eye size={13} /> 360° Profile
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onEdit && (
            <button type="button" onClick={() => onEdit(resto)} className="sa-btn sa-btn-secondary sa-btn-sm" title="Edit details">
              <Edit3 size={13} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(resto.id, resto.name)} className="sa-btn sa-btn-danger sa-btn-sm" title="Delete restaurant">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
