import React, { useState } from 'react';
import { Crown, Sparkles, ExternalLink, Edit3, Trash2, CheckCircle, XCircle, Utensils, MapPin, Phone, UserCheck, ShieldAlert, Key } from 'lucide-react';
import Drawer from '../components/Drawer';
import StatusBadge from '../components/StatusBadge';

export default function TenantDetailsView({ resto, isOpen, onClose, onImpersonate, onEdit, onGrantFree, onRevokeFree, onToggleActive, onDelete }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'subscription', 'actions'

  if (!resto) return null;

  const isLifetime = resto.subscription_type === 'ADMIN_GRANTED' || (resto.access_until && new Date(resto.access_until).getFullYear() > 2030);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={resto.name}
      subtitle={`Slug: /${resto.slug} • Tenant ID #${resto.id}`}
    >
      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--sa-border)', marginBottom: '18px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 16px', fontWeight: 800, fontSize: '0.84rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'overview' ? '2px solid var(--sa-primary)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('subscription')}
          style={{
            padding: '10px 16px', fontWeight: 800, fontSize: '0.84rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'subscription' ? '2px solid var(--sa-primary)' : '2px solid transparent',
            color: activeTab === 'subscription' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer'
          }}
        >
          Subscription & Terms
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          style={{
            padding: '10px 16px', fontWeight: 800, fontSize: '0.84rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'actions' ? '2px solid var(--sa-primary)' : '2px solid transparent',
            color: activeTab === 'actions' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer'
          }}
        >
          Actions & Control
        </button>
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--sa-primary)', color: 'var(--sa-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem' }}>
              {resto.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 900, margin: '0 0 2px 0' }}>{resto.name}</h4>
              <StatusBadge status={resto.subscription_status || (resto.active !== false ? 'active' : 'expired')} type={resto.subscription_type} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>OWNER USERNAME</span>
              <strong style={{ color: 'var(--sa-text-main)' }}>{resto.owner_username || 'admin'}</strong>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>DISHES HOSTED</span>
              <strong style={{ color: 'var(--sa-success)' }}>{resto.dish_count || 0} Items</strong>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>CONTACT MOBILE</span>
              <strong>{resto.phone || 'Not Provided'}</strong>
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>THEME COLOR</span>
              <strong style={{ textTransform: 'capitalize' }}>{resto.theme_color || 'gold'}</strong>
            </div>
          </div>

          {resto.address && (
            <div style={{ fontSize: '0.82rem', background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>RESTAURANT ADDRESS</span>
              <span>{resto.address}</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div style={{ background: 'var(--sa-surface-subtle)', padding: '14px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Current SaaS Plan:</span>
              <strong style={{ color: 'var(--sa-success)' }}>{(resto.plan_tier || 'pro').toUpperCase()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Subscription Amount:</span>
              <strong>₹{resto.plan_price || 999} / month</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Subscription Type:</span>
              <strong style={{ color: resto.subscription_type === 'ADMIN_GRANTED' ? 'var(--sa-purple)' : 'var(--sa-text-main)' }}>{resto.subscription_type || 'PAID'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--sa-border)' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Auto Debit / Mandate:</span>
              <strong style={{ color: (resto.auto_renew === 0 || resto.auto_renew === false) ? 'var(--sa-danger)' : 'var(--sa-success)' }}>
                {(resto.auto_renew === 0 || resto.auto_renew === false) ? '❌ Disabled (OFF)' : '✅ Active (ON)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--sa-text-muted)' }}>Access Expiry Date:</span>
              <strong style={{ color: 'var(--sa-primary)' }}>{isLifetime ? '♾️ Lifetime Access' : resto.access_until ? new Date(resto.access_until).toLocaleDateString('en-IN') : 'N/A'}</strong>
            </div>
          </div>

          {resto.cancel_requested_at && (
            <div style={{ background: 'var(--sa-warning-bg)', border: '1px solid var(--sa-warning-border)', color: '#78350F', padding: '12px', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem' }}>
              ⏸️ Cancellation Requested on {new Date(resto.cancel_requested_at).toLocaleDateString('en-IN')}. Access continues until period end.
            </div>
          )}

          {resto.scheduled_plan_key && (
            <div style={{ background: 'var(--sa-info-bg)', border: '1px solid var(--sa-info-border)', color: '#1E40AF', padding: '12px', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem' }}>
              📋 Scheduled Switch to {resto.scheduled_plan_key.toUpperCase()} at billing boundary.
            </div>
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Primary Operations */}
          <button
            onClick={() => onImpersonate(resto.id, resto.name)}
            className="sa-btn sa-btn-accent"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            <Crown size={18} /> 1-Click Log In as Restaurant Owner (Manage Menu)
          </button>

          <button
            onClick={() => window.open(`/r/${resto.slug}`, '_blank')}
            className="sa-btn sa-btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            <ExternalLink size={18} /> Open Live Digital QR Menu
          </button>

          <button
            onClick={() => { onClose(); onEdit(resto); }}
            className="sa-btn sa-btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            <Edit3 size={18} /> Edit Restaurant Info & Owner Password
          </button>

          {/* Complimentary Access Controls */}
          {resto.subscription_type === 'ADMIN_GRANTED' || resto.mandate_status === 'admin_granted' ? (
            <button
              onClick={() => { onClose(); onRevokeFree(resto); }}
              className="sa-btn sa-btn-danger"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <Sparkles size={18} /> Revoke Complimentary Free Access
            </button>
          ) : (
            <button
              onClick={() => { onClose(); onGrantFree(resto); }}
              className="sa-btn sa-btn-primary"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <Sparkles size={18} /> Grant Complimentary Free Access (₹0 Charge)
            </button>
          )}

          {/* Suspend / Unsuspend */}
          <button
            onClick={() => { onClose(); onToggleActive(resto.id, resto.active); }}
            className={`sa-btn ${(resto.active === false || resto.active === 0 || resto.active === '0') ? 'sa-btn-primary' : 'sa-btn-danger'}`}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            {(resto.active === false || resto.active === 0 || resto.active === '0') ? (
              <><CheckCircle size={18} /> 🟢 Unsuspend & Activate Restaurant</>
            ) : (
              <><XCircle size={18} /> 🔴 Suspend Tenant Access</>
            )}
          </button>
        </div>
      )}
    </Drawer>
  );
}
