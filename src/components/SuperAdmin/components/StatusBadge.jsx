import React from 'react';

export default function StatusBadge({ status, type }) {
  let badgeClass = 'sa-badge-info';
  let dotType = 'active';
  let label = status || 'UNKNOWN';

  const s = String(status || '').toLowerCase();
  const t = String(type || '').toUpperCase();

  if (t === 'ADMIN_GRANTED' || s === 'admin_granted' || s === 'vip' || t === 'COMPLIMENTARY' || s === 'complimentary') {
    badgeClass = 'sa-badge-purple';
    dotType = 'vip';
    label = 'VIP ACCESS';
  } else if (s === 'active' || status === true) {
    badgeClass = 'sa-badge-success';
    dotType = 'active';
    label = 'ACTIVE';
  } else if (s === 'trialing' || s === 'trial') {
    badgeClass = 'sa-badge-info';
    dotType = 'active';
    label = 'FREE TRIAL';
  } else if (s === 'payment_failed' || s === 'past_due' || s === 'failed') {
    badgeClass = 'sa-badge-warning';
    dotType = 'warning';
    label = 'PAST DUE';
  } else if (s === 'auto_renew_off' || s === 'cancelled') {
    badgeClass = 'sa-badge-warning';
    dotType = 'warning';
    label = 'RENEW OFF';
  } else if (s === 'expired' || status === false) {
    badgeClass = 'sa-badge-danger';
    dotType = 'danger';
    label = 'EXPIRED';
  } else if (s === 'suspended') {
    badgeClass = 'sa-badge-muted';
    dotType = 'muted';
    label = 'SUSPENDED';
  }

  return (
    <span className={`sa-badge ${badgeClass}`}>
      <span className={`sa-live-dot ${dotType}`} />
      {label}
    </span>
  );
}
