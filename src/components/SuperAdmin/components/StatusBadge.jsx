import React from 'react';

export default function StatusBadge({ status, type }) {
  let badgeClass = 'sa-badge-info';
  let label = status || 'UNKNOWN';

  if (type === 'ADMIN_GRANTED' || status === 'admin_granted' || status === 'COMPLIMENTARY') {
    badgeClass = 'sa-badge-purple';
    label = '🎁 COMPLIMENTARY';
  } else if (status === 'active' || status === 'ACTIVE' || status === true) {
    badgeClass = 'sa-badge-success';
    label = '🟢 ACTIVE';
  } else if (status === 'trialing' || status === 'TRIAL') {
    badgeClass = 'sa-badge-warning';
    label = '⏳ TRIAL';
  } else if (status === 'cancelled' || status === 'CANCELLED') {
    badgeClass = 'sa-badge-danger';
    label = '⏸️ CANCELLED';
  } else if (status === 'expired' || status === 'EXPIRED' || status === false) {
    badgeClass = 'sa-badge-danger';
    label = '🔴 EXPIRED';
  } else if (status === 'payment_failed' || status === 'PAST_DUE') {
    badgeClass = 'sa-badge-danger';
    label = '⚠️ PAYMENT FAILED';
  }

  return <span className={`sa-badge ${badgeClass}`}>{label}</span>;
}
