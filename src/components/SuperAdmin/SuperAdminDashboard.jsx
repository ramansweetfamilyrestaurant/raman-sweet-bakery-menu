import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload, X, XCircle, CreditCard, Lock, Sparkles, Eye, EyeOff, Key, Database, Sliders, Image } from 'lucide-react';
import { fetchSuperAdminRestaurants, createTenantRestaurant, toggleTenantRestaurantActive, deleteTenantRestaurant, impersonateTenantRestaurant, updateTenantRestaurant, createAnnouncement, fetchSuperAnnouncements, deleteAnnouncement, clearAllAnnouncements, fetchAuditLogs, uploadImage, fetchSaaSPlans, createSaaSPlan, updateSaaSPlan, deleteSaaSPlan, superAdminOptimizeDatabase, updateSuperAdminCredentials, grantFreeAccess, revokeFreeAccess } from '../../api/client';
import { SAAS_PLANS, getPlanDetails } from '../../config/plans';
import { resolveImageUrl, getRestaurantLogoUrl } from '../../utils/imageHelper';
import GrantFreeAccessModal from './modals/GrantFreeAccessModal';
import RevokeFreeAccessModal from './modals/RevokeFreeAccessModal';
import SaaSPlansView from './views/SaaSPlansView';

export default function SuperAdminDashboard({ token, username, onLogout, onReturnToMenu, onImpersonate }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [grantModalResto, setGrantModalResto] = useState(null);
  const [revokeModalResto, setRevokeModalResto] = useState(null);

  // Security & Portal Tab State & Eye Toggles
  const [secTab, setSecTab] = useState('security'); // 'security', 'gateway', 'branding', 'health'
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Security Credentials Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [masterWhatsapp, setMasterWhatsapp] = useState('919876543210');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) setMasterWhatsapp(data.support_whatsapp);
      })
      .catch(console.error);
  }, []);
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newUsername: username || '',
    newPassword: '',
    confirmPassword: ''
  });
  const [securitySubmitting, setSecuritySubmitting] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');

  // SaaS Plans Manager State
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [plansList, setPlansList] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [showCreatePlanForm, setShowCreatePlanForm] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    key: '',
    name: '',
    price: 999,
    badge: '👑 CUSTOM',
    description: '',
    whatsapp_enabled: true,
    direct_ordering_enabled: false,
    google_reviews_enabled: true
  });

  // Payment Gateway API Keys & System Settings State
  const [paymentKeys, setPaymentKeys] = useState(() => {
    let cachedLogo = '';
    try { cachedLogo = localStorage.getItem('touchqr_platform_logo_url') || ''; } catch {}
    return {
      cashfree_app_id: '',
      cashfree_secret_key: '',
      support_whatsapp: '919876543210',
      default_trial_days: '16',
      platform_logo_url: cachedLogo
    };
  });
  const [keysSaving, setKeysSaving] = useState(false);
  const [keysMsg, setKeysMsg] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const [dbOptimizing, setDbOptimizing] = useState(false);
  const [dbOptimizeMsg, setDbOptimizeMsg] = useState('');

  const loadSystemSettings = async () => {
    try {
      const res = await fetch('/api/superadmin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && typeof data === 'object') {
        const logoUrlFromBackend = data.platform_logo_url;
        if (typeof logoUrlFromBackend === 'string' && logoUrlFromBackend.trim() !== '') {
          try { localStorage.setItem('touchqr_platform_logo_url', logoUrlFromBackend); } catch {}
          setLogoErr(false);
        } else if (logoUrlFromBackend === '' || logoUrlFromBackend === null) {
          try { localStorage.removeItem('touchqr_platform_logo_url'); } catch {}
          setLogoErr(false);
        }
        setPaymentKeys(prev => ({
          ...prev,
          cashfree_app_id: data.cashfree_app_id !== undefined ? data.cashfree_app_id : prev.cashfree_app_id,
          cashfree_secret_key: data.cashfree_secret_key !== undefined ? data.cashfree_secret_key : prev.cashfree_secret_key,
          support_whatsapp: data.support_whatsapp || prev.support_whatsapp || '919876543210',
          default_trial_days: data.default_trial_days || prev.default_trial_days || '16',
          platform_logo_url: logoUrlFromBackend !== undefined ? logoUrlFromBackend : prev.platform_logo_url
        }));
      }
    } catch {}
  };

  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (paymentKeys.platform_logo_url) {
      setLogoErr(false);
    }
  }, [paymentKeys.platform_logo_url]);

  // Announcement Modal State
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [announceType, setAnnounceType] = useState('info');
  const [announceSubmitting, setAnnounceSubmitting] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState([]);

  // Audit Log Drawer State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('all'); // 'all', 'activations', 'suspensions', 'settings', 'security'
  const [auditSearch, setAuditSearch] = useState('');

  // New Restaurant Form State
  const [form, setForm] = useState({
    name: '',
    slug: '',
    owner_username: '',
    owner_password: '',
    phone: '',
    address: '',
    tagline: '100% Quality Food & Customer Service',
    plan_tier: 'pro',
    plan_price: 999,
    plan_expires_at: '',
    whatsapp_number: '',
    theme_color: 'gold'
  });
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadSaaSPlans = async () => {
    try {
      const data = await fetchSaaSPlans(token);
      setPlansList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load SaaS plans:', err.message);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSuperAdminRestaurants(token);
      setRestaurants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching tenant restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadSaaSPlans();
    loadSystemSettings();
  }, [token]);

  const loadAuditData = async () => {
    setAuditLoading(true);
    try {
      const logs = await fetchAuditLogs(token);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleOpenAuditModal = () => {
    setShowAuditModal(true);
    loadAuditData();
  };

  // Auto-generate URL slug & username from restaurant name input
  const handleNameChange = (e) => {
    const val = e.target.value;
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const autoUser = val.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin';

    setForm({
      ...form,
      name: val,
      slug: autoSlug,
      owner_username: form.owner_username || autoUser
    });
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      await createTenantRestaurant(form, token);
      setShowAddModal(false);
      setForm({
        name: '',
        slug: '',
        owner_username: '',
        owner_password: '',
        phone: '',
        address: '',
        tagline: '100% Quality Food & Customer Service',
        plan_tier: 'pro',
        plan_price: 999,
        plan_expires_at: '',
        whatsapp_number: '',
        theme_color: 'gold'
      });
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create restaurant');
    } finally {
      setFormSubmitting(false);
    }
  };

  const loadSuperAnnouncements = async () => {
    try {
      const data = await fetchSuperAnnouncements(token);
      setAnnouncementsList(data);
    } catch (err) {
      console.error('Failed to load super announcements:', err);
    }
  };

  const handleOpenBroadcastModal = () => {
    loadSuperAnnouncements();
    setShowAnnounceModal(true);
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this broadcast announcement? It will be removed from all tenant dashboards immediately.')) return;
    try {
      await deleteAnnouncement(id, token);
      loadSuperAnnouncements();
      alert('📢 Announcement deleted successfully!');
    } catch (err) {
      alert(err.message || 'Failed to delete announcement');
    }
  };

  const handleClearAllAnnouncements = async () => {
    if (!window.confirm('Clear ALL active broadcast notices across all tenant dashboards?')) return;
    try {
      await clearAllAnnouncements(token);
      loadSuperAnnouncements();
      alert('✨ All active broadcast notices cleared successfully!');
    } catch (err) {
      alert(err.message || 'Failed to clear announcements');
    }
  };

  const handleCreateAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!announceMsg.trim()) return;
    setAnnounceSubmitting(true);
    try {
      await createAnnouncement(announceMsg.trim(), announceType, token);
      alert('📢 Announcement broadcasted successfully to all tenant dashboards!');
      setAnnounceMsg('');
      loadSuperAnnouncements();
    } catch (err) {
      alert(err.message || 'Failed to broadcast announcement');
    } finally {
      setAnnounceSubmitting(false);
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      const nextActive = !currentActive;
      await toggleTenantRestaurantActive(id, nextActive, token);
      setRestaurants(restaurants.map(r => r.id === id ? { ...r, active: nextActive } : r));
    } catch (err) {
      alert(err.message || 'Failed to update subscription status');
    }
  };

  const handleDeleteRestaurant = async (id, name) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to delete '${name}'? This will permanently delete all dishes, categories, and owner accounts for this restaurant!`)) return;
    try {
      await deleteTenantRestaurant(id, token);
      setRestaurants(restaurants.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete restaurant');
    }
  };

  const handleImpersonate = async (id, name) => {
    try {
      const data = await impersonateTenantRestaurant(id, token);
      if (data && data.token && onImpersonate) {
        onImpersonate(data.token, data.username, data.restaurant?.slug);
      }
    } catch (err) {
      alert(err.message || 'Failed to switch into tenant admin');
    }
  };

  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    setSecurityError('');
    setSecuritySuccess('');

    if (!securityForm.currentPassword) {
      setSecurityError('Current password is required.');
      return;
    }

    if (securityForm.newPassword && securityForm.newPassword !== securityForm.confirmPassword) {
      setSecurityError('New password and confirm password do not match.');
      return;
    }

    setSecuritySubmitting(true);
    try {
      const res = await updateSuperAdminCredentials({
        currentPassword: securityForm.currentPassword,
        newUsername: securityForm.newUsername,
        newPassword: securityForm.newPassword
      }, token);

      if (res && res.token) {
        localStorage.setItem('saas_super_token', res.token);
        if (res.username) localStorage.setItem('saas_super_user', res.username);
      }

      setSecuritySuccess('✨ Master credentials updated successfully!');
      setSecurityForm({
        currentPassword: '',
        newUsername: res.username || username,
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => {
        setShowSecurityModal(false);
        setSecuritySuccess('');
      }, 2000);
    } catch (err) {
      setSecurityError(err.message || 'Failed to update credentials');
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handleUpdateRestaurant = async (e) => {
    e.preventDefault();
    try {
      await updateTenantRestaurant(editModalData.id, editModalData, token);
      setEditModalData(null);
      loadData();
    } catch (err) {
      if (err.message && (err.message.includes('expired') || err.message.includes('token') || err.message.includes('Access denied'))) {
        alert('Super Admin session expired. Please log in again.');
        if (onLogout) onLogout();
        return;
      }
      alert(err.message || 'Failed to update tenant info');
    }
  };

  const getDaysRemaining = (expiryStr) => {
    if (!expiryStr) return null;
    const expiry = new Date(expiryStr);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'suspended', 'pending'

  // Filtered restaurants by search query and status
  const filteredRestaurants = restaurants.filter(r => {
    const isPendingOrSuspended = (r.active === false || r.active === 0 || r.active === '0');
    if (statusFilter === 'active' && isPendingOrSuspended) return false;
    if (statusFilter === 'suspended' && !isPendingOrSuspended) return false;
    if (statusFilter === 'pending' && !isPendingOrSuspended) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.owner_username && r.owner_username.toLowerCase().includes(q)) || (r.phone && r.phone.includes(q));
  });

  const totalPending = restaurants.filter(r => r.active === false || r.active === 0 || r.active === '0').length;
  const totalActive = restaurants.filter(r => r.active !== false && r.active !== 0 && r.active !== '0').length;
  const totalDishes = restaurants.reduce((acc, r) => acc + (r.dish_count || 0), 0);
  const totalScans = restaurants.reduce((acc, r) => acc + (r.scan_count || 0), 0);
  const estimatedRevenue = restaurants.filter(r => r.active !== false).reduce((acc, r) => acc + (parseFloat(r.plan_price) || 999), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-dark)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @media (max-width: 768px) {
          .sa-main-container {
            padding: 12px 8px !important;
          }
          .sa-header-content {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .sa-header-actions {
            justify-content: flex-start !important;
            width: 100% !important;
            overflow-x: auto !important;
            padding-bottom: 4px !important;
            -webkit-overflow-scrolling: touch;
          }
          .sa-header-actions button {
            padding: 7px 10px !important;
            font-size: 0.74rem !important;
          }
          .sa-directory-controls {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 14px 12px !important;
          }
          .sa-controls-right {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .sa-search-box {
            width: 100% !important;
          }
          .sa-status-pills {
            width: 100% !important;
            overflow-x: auto !important;
            justify-content: flex-start !important;
          }
          .sa-grid-container {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .sa-modal-box {
            max-width: 100% !important;
            margin: 8px !important;
            padding: 18px 14px !important;
            border-radius: 18px !important;
            max-height: 92vh !important;
          }
          .sa-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .sa-kpi-grid > div:last-child {
            grid-column: span 2 !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <header style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        padding: '14px 20px',
        borderBottom: '2px solid #D4AF37',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div className="sa-header-content" style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Row 1: Brand Identity & Prominent Logout */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {paymentKeys.platform_logo_url && !logoErr ? (
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#FFFFFF',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 14px rgba(212, 175, 55, 0.5)',
                  border: '1.5px solid #D4AF37',
                  flexShrink: 0
                }}>
                  <img
                    src={resolveImageUrl(paymentKeys.platform_logo_url)}
                    alt="Super Admin Logo"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoErr(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '8px',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)',
                  color: '#0A2315',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 14px rgba(212, 175, 55, 0.5)',
                  border: '1.5px solid #FFFFFF',
                  flexShrink: 0
                }}>
                  <Crown size={24} color="#0A2315" />
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                  <h1 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#DFBA67', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    SaaS Master Control
                  </h1>
                  <span style={{ background: '#DFBA67', color: '#0A2315', fontSize: '0.62rem', fontWeight: 900, padding: '2px 6px', borderRadius: '8px', flexShrink: 0 }}>
                    SUPER ADMIN
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginTop: '2px', flexWrap: 'wrap', minWidth: 0 }}>
                  <span>Master: <strong style={{ color: '#FFFFFF' }}>{username}</strong></span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#86EFAC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E', flexShrink: 0 }}></span> DB Active
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button Always Visible in Top Right */}
            <button
              onClick={onLogout}
              style={{
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                color: '#FFFFFF',
                padding: '7px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 900,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
                marginLeft: 'auto'
              }}
              title="Sign out of Super Admin Portal"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>

          {/* Row 2: Master Header Actions Nav Pills */}
          <div className="sa-header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', overflowX: 'auto', paddingBottom: '2px' }}>
            <button
              onClick={handleOpenBroadcastModal}
              style={{
                background: 'rgba(212, 175, 55, 0.18)',
                color: '#DFBA67',
                padding: '6px 11px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.74rem',
                fontWeight: 900,
                border: '1px solid rgba(212, 175, 55, 0.45)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
              title="Broadcast global announcement banner to all tenant dashboards"
            >
              <Megaphone size={13} color="#DFBA67" /> Broadcast
            </button>

            <button
              onClick={() => {
                loadAuditData();
                setShowAuditModal(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                padding: '6px 11px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.74rem',
                fontWeight: 800,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
              title="View real-time platform activity & security audit logs"
            >
              <FileText size={13} color="#38BDF8" /> Audit
            </button>

            <button
              onClick={() => setShowWhatsappModal(true)}
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ADE80',
                padding: '6px 11px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.74rem',
                fontWeight: 900,
                border: '1px solid rgba(34, 197, 94, 0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
              title="Set Master Super Admin WhatsApp Support Number"
            >
              <MessageSquare size={13} color="#4ADE80" /> Support
            </button>

            {/* 💳 SaaS Plans Manager Button */}
            <button
              onClick={() => {
                loadSaaSPlans();
                setShowPlansModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #164E2A 0%, #0A2315 100%)',
                color: '#FFFFFF',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.74rem',
                fontWeight: 900,
                border: '1.5px solid #D4AF37',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              title="Manage SaaS Plan Tiers, Pricing & Feature Matrix"
            >
              <CreditCard size={13} color="#DFBA67" /> Plans
            </button>

            {/* 🔑 Security & Payment API Keys Button */}
            <button
              onClick={() => {
                setSecurityError('');
                setSecuritySuccess('');
                setKeysMsg('');
                setSecurityForm({
                  currentPassword: '',
                  newUsername: username || 'superadmin',
                  newPassword: '',
                  confirmPassword: ''
                });
                loadSystemSettings();
                setShowSecurityModal(true);
              }}
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
                padding: '6px 11px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.74rem',
                fontWeight: 800,
                border: '1px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
              title="Security, Credentials, Gateway & System Settings"
            >
              <Lock size={13} color="#DFBA67" /> Security
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="sa-main-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 12px' }}>
        
        {/* KPI Analytics Summary Cards Grid */}
        <div className="sa-kpi-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {/* Card 1: Registered Tenants */}
          <div className="hover-lift" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '12px 14px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            boxShadow: '0 4px 16px rgba(10, 35, 21, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Store size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary-emerald)', lineHeight: 1.1 }}>{restaurants.length}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tenants</div>
            </div>
          </div>

          {/* Card 2: Active Subscriptions */}
          <div className="hover-lift" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '12px 14px',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            boxShadow: '0 4px 16px rgba(10, 35, 21, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#B45309', lineHeight: 1.1 }}>{totalActive}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Active</div>
            </div>
          </div>

          {/* Card 3: Total Dishes Hosted */}
          <div className="hover-lift" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '12px 14px',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: '0 4px 16px rgba(10, 35, 21, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Utensils size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#4338CA', lineHeight: 1.1 }}>{totalDishes}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Dishes</div>
            </div>
          </div>

          {/* Card 4: Total QR Code Scans */}
          <div className="hover-lift" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '12px 14px',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            boxShadow: '0 4px 16px rgba(10, 35, 21, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <QrCode size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#7E22CE', lineHeight: 1.1 }}>{totalScans}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>QR Scans</div>
            </div>
          </div>

          {/* Card 5: Est. Monthly SaaS Revenue */}
          <div className="hover-lift btn-pulse" style={{
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#FFFFFF',
            borderRadius: '16px',
            padding: '12px 14px',
            border: '1.5px solid #DFBA67',
            boxShadow: '0 6px 20px rgba(10,35,21,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={20} color="#0A2315" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#DFBA67', lineHeight: 1.1 }}>₹{estimatedRevenue.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Revenue</div>
            </div>
          </div>
        </div>

        {/* Pending Approvals Alert Banner */}
        {totalPending > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '2px solid #F59E0B',
            borderRadius: '20px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(245,158,11,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '28px' }}>🔔</div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#B45309', margin: 0 }}>
                  {totalPending} New Registration{totalPending > 1 ? 's' : ''} Pending Super Admin Approval!
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#78350F', margin: '2px 0 0 0', fontWeight: 600 }}>
                  New restaurant owners signed up and are waiting for your permission to start their trial.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStatusFilter('pending')}
              style={{
                background: '#B45309', color: '#FFFFFF', padding: '10px 18px', borderRadius: '12px',
                border: 'none', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(180,83,9,0.3)'
              }}
            >
              👀 View & Approve Pending Registrations ({totalPending}) ➔
            </button>
          </div>
        )}

        {/* Directory Controls Bar */}
        <div className="sa-directory-controls" style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '16px 20px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
              Tenant Restaurants Directory ({filteredRestaurants.length})
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0', fontWeight: 600 }}>
              Manage client subscriptions, plans, QR scans, credentials, and impersonate access
            </p>
          </div>

          <div className="sa-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Status Filter Pills */}
            <div className="sa-status-pills" style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)' }}>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800, border: 'none', cursor: 'pointer',
                  background: statusFilter === 'all' ? 'var(--primary-emerald)' : 'transparent',
                  color: statusFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)'
                }}
              >
                All ({restaurants.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800, border: 'none', cursor: 'pointer',
                  background: statusFilter === 'active' ? '#15803D' : 'transparent',
                  color: statusFilter === 'active' ? '#FFFFFF' : 'var(--text-muted)'
                }}
              >
                🟢 Active ({totalActive})
              </button>
              <button
                onClick={() => setStatusFilter('suspended')}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800, border: 'none', cursor: 'pointer',
                  background: statusFilter === 'suspended' ? '#DC2626' : 'transparent',
                  color: statusFilter === 'suspended' ? '#FFFFFF' : 'var(--text-muted)'
                }}
              >
                🔴 Suspended ({restaurants.length - totalActive})
              </button>
              {totalPending > 0 && (
                <button
                  onClick={() => setStatusFilter('pending')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.72rem', fontWeight: 800, border: 'none', cursor: 'pointer',
                    background: statusFilter === 'pending' ? '#D97706' : '#FEF3C7',
                    color: statusFilter === 'pending' ? '#FFFFFF' : '#B45309'
                  }}
                >
                  ⏳ Pending ({totalPending})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="sa-search-box" style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search restaurant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>

            <button
              onClick={loadData}
              title="Refresh Directory"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#DFBA67',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                fontWeight: 900,
                border: '1.5px solid #D4AF37',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(10,35,21,0.2)'
              }}
            >
              <Plus size={16} /> Add New Restaurant
            </button>
          </div>
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gold-primary)', fontWeight: 800 }}>
            👑 Loading Tenant Restaurants Directory...
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: '#FFFFFF', borderRadius: '24px', border: '1px dashed var(--border-light)' }}>
            <Store size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px 0' }}>No tenant restaurants found</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Try clearing your search query or onboard a new client.</p>
          </div>
        ) : (
          <div className="sa-grid-container" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px'
          }}>
            {filteredRestaurants.map(r => {
              const daysLeft = getDaysRemaining(r.plan_expires_at);
              const isExpired = daysLeft !== null && daysLeft <= 0;

              return (
                <div
                  key={r.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '24px',
                    padding: '20px',
                    border: r.active !== false ? '1.5px solid var(--border-light)' : '1.5px solid #FCA5A5',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    position: 'relative'
                  }}
                >
                  {/* Top Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={getRestaurantLogoUrl(r.logo)}
                          alt={r.name}
                          onError={(e) => {
                            e.currentTarget.src = '/images/default-logo.webp';
                          }}
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #D4AF37',
                            flexShrink: 0
                          }}
                        />
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: 'var(--text-dark)', lineHeight: 1.2 }}>
                            {r.name}
                          </h3>
                          <span style={{ fontSize: '0.74rem', color: 'var(--gold-primary)', fontWeight: 800 }}>
                            /{r.slug}
                          </span>
                        </div>
                      </div>

                      {/* Active Status Badge */}
                      <button
                        onClick={() => handleToggleActive(r.id, r.active)}
                        style={{
                          background: r.active !== false ? '#DCFCE7' : '#FEE2E2',
                          color: r.active !== false ? '#15803D' : '#DC2626',
                          border: `1px solid ${r.active !== false ? '#86EFAC' : '#FCA5A5'}`,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Click to Toggle Active / Suspended Subscription"
                      >
                        {r.active !== false ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {r.active !== false ? 'Active' : 'Suspended'}
                      </button>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.3 }}>
                      {r.tagline || 'No tagline set'}
                    </p>

                    {/* SaaS Badges Row */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {/* Plan Badge */}
                      <span style={{
                        background: '#FEF3C7',
                        color: '#B45309',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        border: '1px solid #FCD34D'
                      }}>
                        👑 {(r.plan_tier || 'pro').toUpperCase()} (₹{r.plan_price || 999}/mo)
                      </span>

                      {/* Expiry Badge */}
                      {daysLeft !== null && (
                        <span style={{
                          background: (r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '#F3E8FF' : isExpired ? '#FEE2E2' : daysLeft <= 7 ? '#FEF3C7' : '#DCFCE7',
                          color: (r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '#7E22CE' : isExpired ? '#DC2626' : daysLeft <= 7 ? '#B45309' : '#15803D',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          border: (r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '1px solid #E9D5FF' : 'none'
                        }}>
                          <Calendar size={10} /> {(r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '♾️ Lifetime Access' : isExpired ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      )}

                      {r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' ? (
                        <span style={{
                          background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                          color: '#FFFFFF',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          boxShadow: '0 2px 6px rgba(124,58,237,0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          🎁 VIP COMPLIMENTARY (LIFETIME)
                        </span>
                      ) : null}

                      {/* Scans Badge */}
                      <span style={{
                        background: '#F3E8FF',
                        color: '#7E22CE',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        📲 {r.scan_count || 0} scans
                      </span>

                      {/* Theme Badge */}
                      <span style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-dark)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: '1px solid var(--border-light)'
                      }}>
                        🎨 {r.theme_color || 'gold'}
                      </span>
                    </div>

                    {/* 📱 Owner Contact & Account Credentials Box */}
                    <div style={{
                      background: 'linear-gradient(135deg, #F8FAFC 0%, #EDF2F7 100%)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      border: '1.5px solid #CBD5E1',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Shield size={14} color="#D4AF37" /> Admin Username:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#0F172A', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                            {r.owner_username || 'admin'}
                          </strong>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(r.owner_username || 'admin');
                              setCopiedId(r.id + '-user');
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            title="Copy Username"
                          >
                            {copiedId === r.id + '-user' ? <Check size={13} color="#166534" /> : <Copy size={13} color="#64748B" />}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Phone size={14} color="#D4AF37" /> Mobile / WhatsApp:
                        </span>
                        {r.phone || r.whatsapp_number ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                            <strong style={{ color: '#0A2315', fontWeight: 900, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                              {r.phone || r.whatsapp_number}
                            </strong>
                            <a
                              href={`https://wa.me/${(r.phone || r.whatsapp_number || '').replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
                                color: '#FFFFFF',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 900,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(34,197,94,0.3)'
                              }}
                              title="Chat on WhatsApp"
                            >
                              💬 Chat
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', italic: 'true', fontSize: '0.78rem' }}>Not Provided</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Utensils size={14} color="#D4AF37" /> Dishes Hosted:
                        </span>
                        <strong style={{ color: '#15803D', fontWeight: 800 }}>{r.dish_count || 0} Items</strong>
                      </div>

                      {r.address && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', color: '#334155', fontSize: '0.78rem', paddingTop: '2px', borderTop: '1px stroke #E2E8F0' }}>
                          <MapPin size={13} color="#D4AF37" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ lineHeight: 1.3 }}>{r.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', flexWrap: 'wrap' }}>
                    {(r.active === false || r.active === 0 || r.active === '0') ? (
                      <button
                        onClick={() => handleToggleActive(r.id, false)}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
                          color: '#FFFFFF',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.84rem',
                          fontWeight: 900,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                          marginBottom: '6px'
                        }}
                        title="Click to instantly Reactivate / Unsuspend this restaurant"
                      >
                        <CheckCircle size={16} /> 🟢 Unsuspend & Activate Restaurant
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleImpersonate(r.id, r.name)}
                      style={{
                        flex: 1,
                        minWidth: '130px',
                        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                        color: '#FFD700',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.78rem',
                        fontWeight: 900,
                        border: '1.5px solid #D4AF37',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 8px rgba(10,35,21,0.2)'
                      }}
                      title="1-Click Log In as Restaurant Owner to manage dishes, categories, and settings"
                    >
                      <Crown size={14} color="#FFD700" /> Manage Menu
                    </button>

                    {r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' ? (
                      <button
                        onClick={() => setRevokeModalResto(r)}
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          color: '#EF4444',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          border: '1px solid rgba(239,68,68,0.3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Revoke Complimentary VIP Access"
                      >
                        <Sparkles size={14} /> Revoke VIP Access
                      </button>
                    ) : (
                      <button
                        onClick={() => setGrantModalResto(r)}
                        style={{
                          background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 8px rgba(124,58,237,0.3)'
                        }}
                        title="Grant 100% Complimentary VIP Free Access to this restaurant"
                      >
                        <Sparkles size={14} /> 🎁 Grant VIP Access
                      </button>
                    )}

                    <button
                      onClick={() => setEditModalData(r)}
                      style={{
                        background: '#FFFBEB',
                        color: '#B45309',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: '1px solid #FCD34D',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Edit Tenant Details, Plan, Expiry & Credentials"
                    >
                      <Edit3 size={13} /> Edit
                    </button>

                    <a
                      href={`/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--primary-emerald)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid var(--border-light)'
                      }}
                      title="Preview Public Customer Menu"
                    >
                      Preview <ExternalLink size={13} />
                    </a>

                    <button
                      onClick={() => handleDeleteRestaurant(r.id, r.name)}
                      style={{
                        background: '#FEE2E2',
                        color: '#DC2626',
                        padding: '8px',
                        borderRadius: '50%',
                        border: '1px solid #FCA5A5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Delete Tenant Restaurant"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ➕ Modal: Add New Tenant Restaurant */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="sa-modal-box" style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '540px',
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: '2px solid #D4AF37',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#F3F4F6',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 900,
                color: '#4B5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingRight: '40px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={20} />
              </div>
            </div>

            {formError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '14px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRestaurant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  RESTAURANT NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Royal Pizza & Cafe"
                  value={form.name}
                  onChange={handleNameChange}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  CUSTOM URL SLUG (yourdomain.com/slug) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. royal-pizza"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem', fontWeight: 800, color: 'var(--gold-primary)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    SUBSCRIPTION TIER PLAN
                  </label>
                  <select
                    value={form.plan_tier}
                    onChange={(e) => {
                      const tier = e.target.value;
                      const selectedPlan = (plansList || []).find(p => p.key === tier) || getPlanDetails(tier);
                      setForm({
                        ...form,
                        plan_tier: tier,
                        plan_price: selectedPlan.price,
                        whatsapp_enabled: selectedPlan.whatsapp_enabled !== false && selectedPlan.whatsapp_enabled !== 0,
                        direct_ordering_enabled: selectedPlan.direct_ordering_enabled !== false && selectedPlan.direct_ordering_enabled !== 0,
                        google_reviews_enabled: selectedPlan.google_reviews_enabled !== false && selectedPlan.google_reviews_enabled !== 0
                      });
                    }}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    {(plansList.length > 0 ? plansList : Object.values(SAAS_PLANS)).map(p => (
                      <option key={p.key || p.id} value={p.key || p.id}>{p.name} (₹{p.price}/mo)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    BRAND THEME COLOR
                  </label>
                  <select
                    value={form.theme_color}
                    onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    <option value="gold">Gold & Forest Green</option>
                    <option value="emerald">Emerald Mint & Teal</option>
                    <option value="crimson">Ruby Red & Gold</option>
                    <option value="navy">Midnight Navy & Blue</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    OWNER USERNAME *
                  </label>
                  <input
                    type="text"
                    placeholder="royalpizza_admin"
                    value={form.owner_username}
                    onChange={(e) => setForm({ ...form, owner_username: e.target.value })}
                    required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    OWNER PASSWORD *
                  </label>
                  <input
                    type="text"
                    placeholder="pizza123"
                    value={form.owner_password}
                    onChange={(e) => setForm({ ...form, owner_password: e.target.value })}
                    required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  PHONE & WHATSAPP NUMBER
                </label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value, whatsapp_number: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  ADDRESS / LOCATION
                </label>
                <input
                  type="text"
                  placeholder="Main Road, Motihari"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)', fontWeight: 700, cursor: 'pointer', background: 'var(--bg-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                    color: '#DFBA67',
                    padding: '12px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 900,
                    border: '1.5px solid #D4AF37',
                    cursor: 'pointer'
                  }}
                >
                  {formSubmitting ? 'Creating...' : '✓ Create Restaurant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal: Edit Tenant Restaurant Info & Reset Owner Credentials */}
      {editModalData && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '540px',
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: '2px solid #D4AF37',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                  Edit Tenant: {editModalData.name}
                </h3>
              </div>
              <button onClick={() => setEditModalData(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateRestaurant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Logo Uploader in Super Admin Edit Modal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '14px', border: '1.5px solid #CBD5E1' }}>
                <img
                  src={getRestaurantLogoUrl(editModalData.logo)}
                  alt="Logo"
                  onError={(e) => {
                    e.currentTarget.src = '/images/default-logo.webp';
                  }}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #D4AF37', flexShrink: 0 }}
                />
                <div style={{ flexGrow: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dark)', display: 'block', marginBottom: '4px' }}>RESTAURANT BRAND LOGO</label>
                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0A2315', color: '#DFBA67', padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: '0.76rem', fontWeight: 800 }}>
                    <Upload size={13} /> Upload Logo File
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        try {
                          const url = await uploadImage(file, token);
                          setEditModalData(prev => ({ ...prev, logo: url }));
                        } catch (err) {
                          alert('Logo upload failed');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  RESTAURANT NAME
                </label>
                <input
                  type="text"
                  value={editModalData.name || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    SUBSCRIPTION TIER PLAN
                  </label>
                  <select
                    value={editModalData.plan_tier || 'pro'}
                    onChange={(e) => {
                      const tier = e.target.value;
                      const selectedPlan = (plansList || []).find(p => p.key === tier) || getPlanDetails(tier);
                      setEditModalData({
                        ...editModalData,
                        plan_tier: tier,
                        plan_price: selectedPlan.price,
                        whatsapp_enabled: selectedPlan.whatsapp_enabled !== false && selectedPlan.whatsapp_enabled !== 0,
                        direct_ordering_enabled: selectedPlan.direct_ordering_enabled !== false && selectedPlan.direct_ordering_enabled !== 0,
                        google_reviews_enabled: selectedPlan.google_reviews_enabled !== false && selectedPlan.google_reviews_enabled !== 0
                      });
                    }}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    {(plansList.length > 0 ? plansList : Object.values(SAAS_PLANS)).map(p => (
                      <option key={p.key || p.id} value={p.key || p.id}>{p.name} (₹{p.price}/mo)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    THEME COLOR
                  </label>
                  <select
                    value={editModalData.theme_color || 'gold'}
                    onChange={(e) => setEditModalData({ ...editModalData, theme_color: e.target.value })}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    <option value="gold">Gold & Forest Green</option>
                    <option value="emerald">Emerald Mint & Teal</option>
                    <option value="crimson">Ruby Red & Gold</option>
                    <option value="navy">Midnight Navy & Blue</option>
                  </select>
                </div>
              </div>

              {/* ⚡ SAAS FEATURE ACCESS CONTROL MATRIX */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '14px', padding: '14px 16px', marginTop: '6px' }}>
                <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <ShieldCheck size={16} color="#059669" /> SAAS FEATURE ACCESS CONTROL MATRIX
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editModalData.direct_ordering_enabled !== false && editModalData.direct_ordering_enabled !== 0}
                      onChange={(e) => setEditModalData({ ...editModalData, direct_ordering_enabled: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0A2315' }}
                    />
                    ⚡ Direct Table KOT Ordering
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editModalData.whatsapp_enabled !== false && editModalData.whatsapp_enabled !== 0}
                      onChange={(e) => setEditModalData({ ...editModalData, whatsapp_enabled: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                    />
                    💬 WhatsApp Order Drawer
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editModalData.google_reviews_enabled !== false && editModalData.google_reviews_enabled !== 0}
                      onChange={(e) => setEditModalData({ ...editModalData, google_reviews_enabled: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#d97706' }}
                    />
                    ⭐ Smart AI Google Reviews
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editModalData.direct_ordering_enabled !== false && editModalData.direct_ordering_enabled !== 0}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                      readOnly
                    />
                    🍱 Thali & Combos Builder
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editModalData.direct_ordering_enabled !== false && editModalData.direct_ordering_enabled !== 0}
                      style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                      readOnly
                    />
                    🖨️ Thermal Printer (KOT & Bills)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editModalData.direct_ordering_enabled !== false && editModalData.direct_ordering_enabled !== 0}
                      style={{ width: '16px', height: '16px', accentColor: '#7c3aed' }}
                      readOnly
                    />
                    🗺️ Hall Floor Map & Table Grid
                  </label>
                </div>
              </div>

              {/* ⚡ DATA RETENTION & COMPACTION POLICY */}
              <div style={{ background: '#EFF6FF', border: '1.5px solid #93C5FD', borderRadius: '14px', padding: '14px 16px', marginTop: '6px' }}>
                <strong style={{ fontSize: '0.82rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  ⚡ DATA COMPACTION & ORDER RETENTION POLICY
                </strong>
                <select
                  value={editModalData.order_retention_days || 90}
                  onChange={(e) => setEditModalData({ ...editModalData, order_retention_days: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '0.84rem', fontWeight: 800, color: '#1E3A8A', background: '#FFFFFF' }}
                >
                  <option value={1}>⚡ 24 Hours / 1 Day (Ultra Light - High Traffic)</option>
                  <option value={7}>⚡ 7 Days (Recommended for Restaurants)</option>
                  <option value={30}>⚡ 30 Days (1 Month History)</option>
                  <option value={90}>⚡ 90 Days (3 Months History)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  FSSAI LICENSE NO
                </label>
                <input
                  type="text"
                  value={editModalData.fssai_lic_no || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, fssai_lic_no: e.target.value })}
                  placeholder="e.g. 20824001000123"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    OWNER USERNAME
                  </label>
                  <input
                    type="text"
                    value={editModalData.owner_username || ''}
                    onChange={(e) => setEditModalData({ ...editModalData, owner_username: e.target.value })}
                    required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    RESET PASSWORD
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to keep"
                    value={editModalData.owner_password || ''}
                    onChange={(e) => setEditModalData({ ...editModalData, owner_password: e.target.value })}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  WHATSAPP ORDERING NUMBER
                </label>
                <input
                  type="text"
                  value={editModalData.whatsapp_number || editModalData.phone || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, whatsapp_number: e.target.value })}
                  placeholder="+91 9708366583"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  ADDRESS / LOCATION
                </label>
                <input
                  type="text"
                  value={editModalData.address || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, address: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalData(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)', fontWeight: 700, cursor: 'pointer', background: 'var(--bg-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                    color: '#DFBA67',
                    padding: '12px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 900,
                    border: '1.5px solid #D4AF37',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Save Tenant Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📢 Modal: Broadcast Global System Announcement */}
      {showAnnounceModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="sa-modal-box" style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '560px',
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: '2px solid #D4AF37',
            position: 'relative',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button
              type="button"
              onClick={() => setShowAnnounceModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#F3F4F6',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 900,
                color: '#4B5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingRight: '40px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#DFBA67',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #D4AF37',
                boxShadow: '0 4px 14px rgba(10,35,21,0.2)',
                flexShrink: 0
              }}>
                <Megaphone size={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Global Broadcast Notice
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Send live banners to all tenant panels
                </span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              <form onSubmit={handleCreateAnnouncementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px', display: 'block' }}>
                    ANNOUNCEMENT MESSAGE FOR ALL TENANTS *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. ⚡ New Feature Released: WhatsApp Direct Ordering is now live! Update your phone number in Setup Settings."
                    value={announceMsg}
                    onChange={(e) => setAnnounceMsg(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontWeight: 600,
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Notice Type Visual Swatch Picker */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px', display: 'block' }}>
                    SELECT ANNOUNCEMENT TYPE
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { id: 'info', label: 'ℹ️ Information', bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF' },
                      { id: 'success', label: '🎉 Feature Release', bg: '#F0FDF4', border: '#22C55E', color: '#15803D' },
                      { id: 'warning', label: '⚠️ Maintenance', bg: '#FEF3C7', border: '#F59E0B', color: '#B45309' },
                    ].map(type => {
                      const isSel = announceType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setAnnounceType(type.id)}
                          style={{
                            background: isSel ? type.bg : '#F8FAFC',
                            border: isSel ? `2px solid ${type.border}` : '1px solid #E2E8F0',
                            color: isSel ? type.color : '#64748B',
                            padding: '8px',
                            borderRadius: '10px',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Banner Preview Card */}
                {announceMsg && (
                  <div style={{
                    background: announceType === 'success' ? '#F0FDF4' : announceType === 'warning' ? '#FEF3C7' : '#EFF6FF',
                    border: `1.5px solid ${announceType === 'success' ? '#22C55E' : announceType === 'warning' ? '#F59E0B' : '#3B82F6'}`,
                    color: announceType === 'success' ? '#15803D' : announceType === 'warning' ? '#B45309' : '#1E40AF',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    lineHeight: 1.4
                  }}>
                    <strong style={{ display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', marginBottom: '2px', opacity: 0.8 }}>
                      📢 LIVE DASHBOARD BANNER PREVIEW:
                    </strong>
                    {announceMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAnnounceModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: '#F1F5F9',
                      color: '#475569',
                      fontSize: '0.86rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={announceSubmitting}
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                      color: '#FFD700',
                      padding: '12px',
                      borderRadius: '12px',
                      fontWeight: 900,
                      border: '1.5px solid #D4AF37',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      boxShadow: '0 4px 14px rgba(10,35,21,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Megaphone size={16} color="#FFD700" /> {announceSubmitting ? 'Broadcasting...' : '📢 Broadcast Notice'}
                  </button>
                </div>
              </form>

              {/* Active Notices Management Section */}
              {announcementsList && announcementsList.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px dashed #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      📢 ACTIVE BROADCAST NOTICES ({announcementsList.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleClearAllAnnouncements}
                      style={{
                        background: '#FEE2E2',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Clear All
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {announcementsList.map(a => (
                      <div 
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: a.type === 'success' ? '#F0FDF4' : a.type === 'warning' ? '#FEF3C7' : '#F8FAFC',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          gap: '10px',
                          border: `1px solid ${a.type === 'success' ? '#BBF7D0' : a.type === 'warning' ? '#FDE68A' : '#E2E8F0'}`
                        }}
                      >
                        <span style={{ flexGrow: 1, wordBreak: 'break-word', fontWeight: 700, color: '#0F172A' }}>
                          {a.message}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          style={{
                            background: '#EF4444',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          title="Delete this notice"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📜 Modal: Platform Audit Logs */}
      {showAuditModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="sa-modal-box" style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '740px',
            width: '100%',
            padding: '26px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: '2px solid #D4AF37',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowAuditModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#F3F4F6',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 900,
                color: '#4B5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingRight: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                  color: '#DFBA67',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #D4AF37',
                  boxShadow: '0 4px 14px rgba(10,35,21,0.2)',
                  flexShrink: 0
                }}>
                  <FileText size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Platform Audit Stream
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Real-time security & system activity logs
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={loadAuditData}
                  style={{
                    background: '#F1F5F9',
                    color: '#0F172A',
                    border: '1px solid #CBD5E1',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Refresh Audit Logs Stream"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </div>

            {/* Filter Pills Bar & Search Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', background: '#F8FAFC', padding: '10px 12px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: '📜 All Logs' },
                  { id: 'activations', label: '🟢 Activations' },
                  { id: 'suspensions', label: '🔴 Suspensions' },
                  { id: 'settings', label: '⚙️ Settings' },
                  { id: 'security', label: '🔑 Security' },
                ].map(pill => {
                  const isActive = auditFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setAuditFilter(pill.id)}
                      style={{
                        background: isActive ? 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)' : '#FFFFFF',
                        color: isActive ? '#DFBA67' : '#475569',
                        border: isActive ? '1px solid #D4AF37' : '1px solid #CBD5E1',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 2px 6px rgba(10,35,21,0.2)' : 'none'
                      }}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ position: 'relative', width: '200px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search logs..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px 6px 28px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.78rem', boxSizing: 'border-box' }}
                />
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              </div>
            </div>

            {/* Logs List Container */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#B45309', fontWeight: 800 }}>
                  📜 Loading real-time audit logs...
                </div>
              ) : (() => {
                const filtered = auditLogs.filter(log => {
                  const act = (log.action || '').toLowerCase();
                  const det = (log.details || '').toLowerCase();
                  const query = auditSearch.toLowerCase();
                  if (query && !act.includes(query) && !det.includes(query)) return false;

                  if (auditFilter === 'activations') {
                    return act.includes('activate') || act.includes('grant') || act.includes('create');
                  }
                  if (auditFilter === 'suspensions') {
                    return act.includes('suspend') || act.includes('revoke') || act.includes('delete');
                  }
                  if (auditFilter === 'settings') {
                    return act.includes('settings') || act.includes('logo') || act.includes('gateway') || act.includes('vacuum');
                  }
                  if (auditFilter === 'security') {
                    return act.includes('password') || act.includes('security') || act.includes('credentials') || act.includes('login');
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontWeight: 700 }}>
                      No matching audit logs found.
                    </div>
                  );
                }

                return filtered.map(log => {
                  const act = (log.action || '').toLowerCase();
                  let badgeBg = 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)';
                  let badgeColor = '#DFBA67';
                  let icon = '📜';

                  if (act.includes('activate') || act.includes('grant') || act.includes('create')) {
                    badgeBg = 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)';
                    badgeColor = '#FFFFFF';
                    icon = '🟢';
                  } else if (act.includes('suspend') || act.includes('revoke') || act.includes('delete')) {
                    badgeBg = 'linear-gradient(135deg, #991B1B 0%, #EF4444 100%)';
                    badgeColor = '#FFFFFF';
                    icon = '🔴';
                  } else if (act.includes('settings') || act.includes('logo') || act.includes('gateway') || act.includes('vacuum')) {
                    badgeBg = 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)';
                    badgeColor = '#FFFFFF';
                    icon = '⚙️';
                  } else if (act.includes('security') || act.includes('password') || act.includes('credentials')) {
                    badgeBg = 'linear-gradient(135deg, #7E22CE 0%, #A855F7 100%)';
                    badgeColor = '#FFFFFF';
                    icon = '🔑';
                  }

                  const dateObj = new Date(log.created_at);
                  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={log.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '14px',
                        padding: '12px 14px',
                        border: '1.5px solid #E2E8F0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.82rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            background: badgeBg,
                            color: badgeColor,
                            fontSize: '0.66rem',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                          }}>
                            {icon} {log.action.toUpperCase()}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                            by {log.actor_role || 'superadmin'}
                          </span>
                        </div>
                        <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.84rem' }}>
                          {log.details}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                        <div style={{ fontSize: '0.76rem', color: '#0F172A', fontWeight: 800 }}>
                          {formattedTime}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
                          {formattedDate}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
      {/* 💳 Modal: Dedicated SaaS Plan Control Center */}
      {showPlansModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 35, 21, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="sa-modal-box" style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '1100px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 70px rgba(0,0,0,0.45)',
            border: '2px solid #D4AF37',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflowY: 'auto'
          }}>
            <button
              type="button"
              onClick={() => setShowPlansModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#F1F5F9',
                border: 'none',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                fontSize: '1.1rem',
                fontWeight: 900,
                cursor: 'pointer',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              ✕
            </button>
            <SaaSPlansView token={token} />
          </div>
        </div>
      )}
      {showSecurityModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '2px solid #D4AF37',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowSecurityModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#F3F4F6',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingRight: '40px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#DFBA67',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #D4AF37',
                boxShadow: '0 4px 14px rgba(10,35,21,0.2)',
                flexShrink: 0
              }}>
                <ShieldCheck size={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-dark)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Security & System Credentials
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Update admin login & API credentials
                </span>
              </div>
            </div>

            {/* 4-Tab Navigation Selector */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              background: '#F1F5F9',
              padding: '5px',
              borderRadius: '14px',
              marginBottom: '20px',
              border: '1px solid #E2E8F0'
            }}>
              {[
                { id: 'security', label: '🛡️ Security', icon: Lock },
                { id: 'gateway', label: '💳 Gateway', icon: Key },
                { id: 'branding', label: '🖼️ Branding', icon: Image },
                { id: 'health', label: '⚡ DB Health', icon: Database },
              ].map((tab) => {
                const isActive = secTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSecTab(tab.id)}
                    style={{
                      background: isActive ? 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)' : 'transparent',
                      color: isActive ? '#DFBA67' : '#64748B',
                      border: isActive ? '1px solid #D4AF37' : 'none',
                      padding: '8px 6px',
                      borderRadius: '10px',
                      fontSize: '0.76rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 2px 8px rgba(10,35,21,0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {securityError && (
              <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', color: '#B91C1C', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>
                ⚠️ {securityError}
              </div>
            )}

            {securitySuccess && (
              <div style={{ background: '#ECFDF5', border: '1px solid #10B981', color: '#047857', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>
                {securitySuccess}
              </div>
            )}

            {keysMsg && (
              <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', color: '#15803D', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>
                {keysMsg}
              </div>
            )}

            {/* TAB 1: 🛡️ MASTER ACCOUNT SECURITY */}
            {secTab === 'security' && (
              <form onSubmit={handleSecuritySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>
                    🔑 Current Password (Required to apply changes) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurPass ? 'text' : 'password'}
                      required
                      placeholder="Enter current master password"
                      value={securityForm.currentPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '12px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurPass(!showCurPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                    >
                      {showCurPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>
                    👤 Master Login Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. superadmin"
                    value={securityForm.newUsername}
                    onChange={(e) => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>
                    🔒 New Master Password (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="Leave blank to keep unchanged"
                      value={securityForm.newPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '12px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                    >
                      {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {securityForm.newPassword && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>
                      🔒 Confirm New Master Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfPass ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        value={securityForm.confirmPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '11px 40px 11px 14px',
                          borderRadius: '12px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfPass(!showConfPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                      >
                        {showConfPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={securitySubmitting}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                    color: '#FFD700',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(10,35,21,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Lock size={18} color="#FFD700" /> {securitySubmitting ? 'Updating Credentials...' : '💾 Save Master Credentials'}
                </button>
              </form>
            )}

            {/* TAB 2: 💳 CASHFREE GATEWAY */}
            {secTab === 'gateway' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#ECFDF5', padding: '12px 14px', borderRadius: '12px', border: '1px solid #6EE7B7' }}>
                  <strong style={{ fontSize: '0.84rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={16} /> Cashfree UPI AutoPay Subscription Keys
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#065F46', display: 'block', marginTop: '2px' }}>
                    Configure Cashfree Merchant credentials for auto-debit payments.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                    CASHFREE APP ID (CLIENT ID) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1029384756"
                    value={paymentKeys.cashfree_app_id || ''}
                    onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_app_id: e.target.value })}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                    CASHFREE SECRET KEY *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      placeholder="Cashfree Secret Key"
                      value={paymentKeys.cashfree_secret_key || ''}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_secret_key: e.target.value })}
                      style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                    >
                      {showSecretKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={keysSaving}
                  onClick={async () => {
                    setKeysSaving(true);
                    setKeysMsg('');
                    try {
                      const res = await fetch('/api/superadmin/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify(paymentKeys)
                      });
                      const data = await res.json();
                      if (res.ok) setKeysMsg(data.message || '✅ Gateway keys saved successfully!');
                    } catch {
                      setKeysMsg('⚠️ Failed to save gateway keys');
                    } finally {
                      setKeysSaving(false);
                    }
                  }}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
                  }}
                >
                  {keysSaving ? 'Saving Gateway Keys...' : '💾 Save Gateway Credentials'}
                </button>
              </div>
            )}

            {/* TAB 3: 🖼️ PLATFORM LOGO & BRANDING */}
            {secTab === 'branding' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
                    CURRENT PLATFORM LOGO PREVIEW:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                    {logoPreview || (paymentKeys.platform_logo_url && !logoErr) ? (
                      <img
                        src={logoPreview || resolveImageUrl(paymentKeys.platform_logo_url)}
                        alt="Logo Preview"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoErr(true)}
                        style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'contain', background: '#FFF', padding: '4px', border: '1.5px solid #CBD5E1', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: '#0A2315', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.6rem' }}>👑</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const localPreview = URL.createObjectURL(file);
                          setLogoPreview(localPreview);
                          setLogoErr(false);
                          setUploadingLogo(true);
                          try {
                            const uploadedData = await uploadImage(file, token, 'superadmin');
                            let newUrl = typeof uploadedData === 'string' ? uploadedData : (uploadedData?.r2ProxyUrl || uploadedData?.url || uploadedData?.path);
                            if (!newUrl) throw new Error('Invalid image URL returned from server');
                            const timestampedUrl = newUrl.includes('?') ? `${newUrl}&t=${Date.now()}` : `${newUrl}?t=${Date.now()}`;
                            const updated = { ...paymentKeys, platform_logo_url: timestampedUrl };
                            setPaymentKeys(updated);
                            await fetch('/api/superadmin/settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify(updated)
                            });
                            setLogoErr(false);
                            setKeysMsg('✅ New Platform Logo uploaded & saved successfully across all pages!');
                          } catch (err) {
                            alert('Logo upload failed: ' + err.message);
                          } finally {
                            setUploadingLogo(false);
                          }
                        }}
                        disabled={uploadingLogo}
                        style={{ fontSize: '0.8rem' }}
                      />
                      {uploadingLogo && <span style={{ fontSize: '0.76rem', color: '#0284C7', fontWeight: 700, display: 'block', marginTop: '4px' }}>⏳ Uploading image to R2 Storage & Database...</span>}
                    </div>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    LOGO PROXY / CDN URL:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="e.g. /api/r2-proxy/superadmin/branding/logo.webp"
                      value={paymentKeys.platform_logo_url || ''}
                      onChange={(e) => {
                        setPaymentKeys({ ...paymentKeys, platform_logo_url: e.target.value });
                        setLogoErr(false);
                      }}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.84rem' }}
                    />
                    {paymentKeys.platform_logo_url && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Reset platform logo to default crown icon?')) {
                            try { localStorage.removeItem('touchqr_platform_logo_url'); } catch {}
                            const updated = { ...paymentKeys, platform_logo_url: '' };
                            setPaymentKeys(updated);
                            await fetch('/api/superadmin/settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify(updated)
                            });
                            setLogoErr(false);
                            setKeysMsg('🗑️ Logo reset to default');
                          }
                        }}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1.5px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer' }}
                      >
                        Reset Logo
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={keysSaving}
                  onClick={async () => {
                    setKeysSaving(true);
                    setKeysMsg('');
                    try {
                      const res = await fetch('/api/superadmin/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify(paymentKeys)
                      });
                      const data = await res.json();
                      if (res.ok) setKeysMsg(data.message || '✅ Branding logo settings saved!');
                    } catch {
                      setKeysMsg('⚠️ Failed to save branding settings');
                    } finally {
                      setKeysSaving(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2,132,199,0.3)'
                  }}
                >
                  {keysSaving ? 'Saving Branding...' : '💾 Save Logo Branding Settings'}
                </button>
              </div>
            )}

            {/* TAB 4: ⚡ SYSTEM & DATABASE HEALTH */}
            {secTab === 'health' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#FFFBEB', padding: '14px', borderRadius: '14px', border: '1px solid #FCD34D' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#B45309', marginBottom: '6px' }}>
                    🎁 DEFAULT SAAS FREE TRIAL DURATION:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="14"
                      value={paymentKeys.default_trial_days || ''}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, default_trial_days: e.target.value })}
                      style={{ width: '100px', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}
                    />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>Days Free Trial for New Registrations</span>
                  </div>
                </div>

                <div style={{ background: '#EFF6FF', padding: '14px', borderRadius: '14px', border: '1px solid #BFDBFE' }}>
                  <strong style={{ fontSize: '0.84rem', color: '#1E40AF', display: 'block', marginBottom: '4px' }}>
                    🧹 POSTGRESQL DATABASE MAINTENANCE & VACUUM:
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#3B82F6', display: 'block', marginBottom: '10px' }}>
                    Cleans dead tuples, optimizes index pointers, and reclaims disk space on Neon DB.
                  </span>
                  <button
                    type="button"
                    disabled={dbOptimizing}
                    onClick={async () => {
                      setDbOptimizing(true);
                      setDbOptimizeMsg('');
                      try {
                        const data = await superAdminOptimizeDatabase(token);
                        setDbOptimizeMsg(`✅ ${data.message || 'Database vacuumed & optimized successfully!'}`);
                      } catch (err) {
                        setDbOptimizeMsg(`⚠️ ${err.message || 'Optimization failed'}`);
                      } finally {
                        setDbOptimizing(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      color: '#FFF',
                      border: 'none',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      fontWeight: 900,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
                    }}
                  >
                    {dbOptimizing ? 'Optimizing Database Index...' : '⚡ Run Vacuum & Database Optimization'}
                  </button>
                  {dbOptimizeMsg && <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E40AF', display: 'block', marginTop: '8px' }}>{dbOptimizeMsg}</span>}
                </div>

                <button
                  type="button"
                  disabled={keysSaving}
                  onClick={async () => {
                    setKeysSaving(true);
                    setKeysMsg('');
                    try {
                      const res = await fetch('/api/superadmin/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify(paymentKeys)
                      });
                      const data = await res.json();
                      if (res.ok) setKeysMsg(data.message || '✅ System settings saved!');
                    } catch {
                      setKeysMsg('⚠️ Failed to save system settings');
                    } finally {
                      setKeysSaving(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(51,65,85,0.3)'
                  }}
                >
                  {keysSaving ? 'Saving System Settings...' : '💾 Save System & Trial Settings'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 💬 Master Super Admin WhatsApp Support Modal */}
      {showWhatsappModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }} onClick={() => setShowWhatsappModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF', borderRadius: '24px', maxWidth: '460px', width: '100%',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #22C55E', position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowWhatsappModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#F3F4F6',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 900,
                color: '#4B5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingRight: '40px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #86EFAC',
                flexShrink: 0
              }}>
                <MessageSquare size={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  WhatsApp Support Portal
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Set support contact for tenant help desk
                </span>
              </div>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 14px', borderRadius: '14px', fontSize: '0.8rem', color: '#166534', lineHeight: 1.5, marginBottom: '18px' }}>
              💡 When restaurant owners click <strong>"Contact Support"</strong> on Login, Register, or Billing screens, they are immediately connected to this WhatsApp number.
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch('/api/superadmin/settings', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ support_whatsapp: masterWhatsapp })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update');
                alert('✅ Master Super Admin WhatsApp Support Number updated successfully!');
                setShowWhatsappModal(false);
              } catch (err) {
                alert('⚠️ ' + err.message);
              }
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                  SUPER ADMIN WHATSAPP NUMBER (WITH COUNTRY CODE) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 919876543210 (include country code 91)"
                  value={masterWhatsapp}
                  onChange={e => setMasterWhatsapp(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {masterWhatsapp && (
                <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 700 }}>LIVE WHATSAPP TEST LINK:</span>
                  <a
                    href={`https://wa.me/${masterWhatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#22C55E',
                      color: '#FFFFFF',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: 900,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    💬 Test Link ➔
                  </a>
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={18} /> 💾 Save Support WhatsApp Number
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🎁 Grant Complimentary VIP Access Modal */}
      <GrantFreeAccessModal
        resto={grantModalResto}
        plansList={plansList}
        isOpen={!!grantModalResto}
        onClose={() => setGrantModalResto(null)}
        onConfirmGrant={async (restoId, grantData) => {
          const res = await grantFreeAccess(restoId, grantData, token);
          await loadData();
          return res;
        }}
      />

      {/* ⚠️ Revoke Complimentary Access Modal */}
      <RevokeFreeAccessModal
        resto={revokeModalResto}
        isOpen={!!revokeModalResto}
        onClose={() => setRevokeModalResto(null)}
        onConfirmRevoke={async (restoId) => {
          const res = await revokeFreeAccess(restoId, token);
          await loadData();
          return res;
        }}
      />
    </div>
  );
}

