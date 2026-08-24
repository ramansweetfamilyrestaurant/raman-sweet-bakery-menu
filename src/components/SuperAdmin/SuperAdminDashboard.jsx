import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload, X, XCircle, CreditCard, Lock, Sparkles, Eye, EyeOff, Key, Database, Sliders, Image } from 'lucide-react';
import { fetchSuperAdminRestaurants, createTenantRestaurant, toggleTenantRestaurantActive, deleteTenantRestaurant, impersonateTenantRestaurant, updateTenantRestaurant, createAnnouncement, fetchSuperAnnouncements, deleteAnnouncement, clearAllAnnouncements, fetchAuditLogs, uploadImage, fetchSaaSPlans, createSaaSPlan, updateSaaSPlan, deleteSaaSPlan, superAdminOptimizeDatabase, updateSuperAdminCredentials, grantFreeAccess, revokeFreeAccess } from '../../api/client';
import { SAAS_PLANS, getPlanDetails } from '../../config/plans';
import { resolveImageUrl, getRestaurantLogoUrl } from '../../utils/imageHelper';
import GrantFreeAccessModal from './modals/GrantFreeAccessModal';
import RevokeFreeAccessModal from './modals/RevokeFreeAccessModal';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNavigation from './components/BottomNavigation';
import Drawer from './components/Drawer';
import SaaSPlansView from './views/SaaSPlansView';
import TenantDetailsView from './views/TenantDetailsView';
import './styles/SuperAdmin.css';

export default function SuperAdminDashboard({ token, username, onLogout, onReturnToMenu, onImpersonate }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [grantModalResto, setGrantModalResto] = useState(null);
  const [revokeModalResto, setRevokeModalResto] = useState(null);
  const [selectedTenant360, setSelectedTenant360] = useState(null);
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'tenants', 'billing', 'plans', 'operations', 'activity', 'settings', 'communication'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMoreDrawer, setShowMobileMoreDrawer] = useState(false);
  const [billingFilter, setBillingFilter] = useState('all');

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
        onImpersonate(data.token, data.username, data.restaurant?.slug, data.restaurant?.name || name, data.restaurant?.id || id);
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


  // Render Directory Controls & Tenant Cards Grid
  const renderDirectorySection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Directory Controls Bar */}
      <div className="sa-directory-controls" style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '14px 18px',
        border: '1px solid var(--sa-border)',
        boxShadow: 'var(--sa-shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-primary)', margin: 0 }}>
            Tenant Restaurants Directory ({filteredRestaurants.length})
          </h2>
          <p style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', margin: '2px 0 0 0', fontWeight: 600 }}>
            Manage client subscriptions, plans, QR scans, credentials, and impersonate access
          </p>
        </div>

        <div className="sa-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Filter Pills */}
          <div className="sa-status-pills" style={{ display: 'flex', gap: '4px', background: 'var(--sa-surface-subtle)', padding: '3px', borderRadius: 'var(--sa-radius-full)', border: '1px solid var(--sa-border)' }}>
            <button
              onClick={() => setStatusFilter('all')}
              className={`sa-btn sa-btn-sm ${statusFilter === 'all' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ border: 'none' }}
            >
              All ({restaurants.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`sa-btn sa-btn-sm ${statusFilter === 'active' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ border: 'none' }}
            >
              🟢 Active ({totalActive})
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`sa-btn sa-btn-sm ${statusFilter === 'suspended' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ border: 'none' }}
            >
              🔴 Suspended ({restaurants.length - totalActive})
            </button>
            {totalPending > 0 && (
              <button
                onClick={() => setStatusFilter('pending')}
                className={`sa-btn sa-btn-sm ${statusFilter === 'pending' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                style={{ border: 'none' }}
              >
                ⏳ Pending ({totalPending})
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="sa-search-box" style={{ position: 'relative', width: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
            <input
              type="text"
              placeholder="Search restaurant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: 'var(--sa-radius-full)',
                border: '1px solid var(--sa-border)',
                fontSize: '0.78rem',
                outline: 'none',
                background: 'var(--sa-surface-subtle)'
              }}
            />
          </div>

          <button
            onClick={loadData}
            title="Refresh Directory"
            className="sa-btn sa-btn-secondary sa-btn-sm"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="sa-btn sa-btn-accent sa-btn-sm"
            style={{ fontWeight: 900 }}
          >
            <Plus size={15} /> Add Restaurant
          </button>
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--sa-accent)', fontWeight: 800 }}>
          👑 Loading Tenant Restaurants Directory...
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed var(--sa-border)' }}>
          <Store size={44} color="var(--sa-text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 6px 0' }}>No tenant restaurants found</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)', margin: 0 }}>Try clearing your search query or onboard a new client.</p>
        </div>
      ) : (
        <div className="sa-grid-container" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '18px'
        }}>
          {filteredRestaurants.map(r => {
            const daysLeft = getDaysRemaining(r.plan_expires_at);
            const isExpired = daysLeft !== null && daysLeft <= 0;

            return (
              <div
                key={r.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '20px',
                  padding: '18px',
                  border: r.active !== false ? '1.5px solid var(--sa-border)' : '1.5px solid #FCA5A5',
                  boxShadow: 'var(--sa-shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  position: 'relative'
                }}
              >
                {/* Top Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div 
                      onClick={() => setSelectedTenant360(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      title="Click to open Tenant 360° Profile"
                    >
                      <img
                        src={getRestaurantLogoUrl(r.logo)}
                        alt={r.name}
                        onError={(e) => {
                          e.currentTarget.src = '/images/default-logo.webp';
                        }}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #D4AF37',
                          flexShrink: 0
                        }}
                      />
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: 'var(--sa-text-main)', lineHeight: 1.2 }}>
                          {r.name}
                        </h3>
                        <span style={{ fontSize: '0.72rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 800 }}>
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
                        padding: '4px 9px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Click to Toggle Active / Suspended Subscription"
                    >
                      {r.active !== false ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {r.active !== false ? 'Active' : 'Suspended'}
                    </button>
                  </div>

                  <p style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', margin: '0 0 10px 0', lineHeight: 1.3 }}>
                    {r.tagline || 'No tagline set'}
                  </p>

                  {/* SaaS Badges Row */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <span style={{
                      background: '#FEF3C7',
                      color: '#B45309',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '0.66rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      border: '1px solid #FCD34D'
                    }}>
                      👑 {(r.plan_tier || 'pro').toUpperCase()} (₹{r.plan_price || 999}/mo)
                    </span>

                    {daysLeft !== null && (
                      <span style={{
                        background: (r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '#F3E8FF' : isExpired ? '#FEE2E2' : daysLeft <= 7 ? '#FEF3C7' : '#DCFCE7',
                        color: (r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '#7E22CE' : isExpired ? '#DC2626' : daysLeft <= 7 ? '#B45309' : '#15803D',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        fontSize: '0.66rem',
                        fontWeight: 900,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Calendar size={10} /> {(r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' || daysLeft > 3650) ? '♾️ Lifetime' : isExpired ? 'Expired' : `${daysLeft}d left`}
                      </span>
                    )}

                    {r.mandate_status === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED' ? (
                      <span style={{
                        background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                        color: '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.66rem',
                        fontWeight: 900
                      }}>
                        🎁 VIP
                      </span>
                    ) : null}

                    <span style={{
                      background: '#F3E8FF',
                      color: '#7E22CE',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '0.66rem',
                      fontWeight: 800
                    }}>
                      📲 {r.scan_count || 0} scans
                    </span>
                  </div>

                  {/* Owner Contact Box */}
                  <div style={{
                    background: 'var(--sa-surface-subtle)',
                    borderRadius: '14px',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    border: '1px solid var(--sa-border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Admin User:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontFamily: 'monospace', fontSize: '0.84rem', color: 'var(--sa-text-main)', background: '#FFFFFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--sa-border)' }}>
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
                          {copiedId === r.id + '-user' ? <Check size={12} color="#166534" /> : <Copy size={12} color="#64748B" />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>Phone / WA:</span>
                      {r.phone || r.whatsapp_number ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: 'var(--sa-text-main)', fontWeight: 800, fontSize: '0.78rem' }}>
                            {r.phone || r.whatsapp_number}
                          </strong>
                          <a
                            href={`https://wa.me/${(r.phone || r.whatsapp_number || '').replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#22C55E',
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 900,
                              textDecoration: 'none'
                            }}
                          >
                            💬 Chat
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--sa-text-muted)' }}>Not Provided</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div style={{ display: 'flex', gap: '5px', borderTop: '1px solid var(--sa-border)', paddingTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedTenant360(r)}
                    className="sa-btn sa-btn-primary sa-btn-sm"
                    style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#FCD34D', border: '1px solid #D4AF37', fontWeight: 900 }}
                    title="Open complete 360-degree Tenant Profile"
                  >
                    🔍 360° Profile
                  </button>

                  <button
                    onClick={() => handleImpersonate(r.id, r.name)}
                    className="sa-btn sa-btn-sm"
                    style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#FFD700', border: '1px solid #D4AF37', fontWeight: 900 }}
                    title="1-Click Log In as Restaurant Owner"
                  >
                    <Crown size={13} color="#FFD700" /> Manage Menu
                  </button>

                  <button
                    onClick={() => setEditModalData(r)}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    title="Edit Tenant Info"
                  >
                    <Edit3 size={12} /> Edit
                  </button>

                  <a
                    href={`/${r.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                    title="Preview Public Customer Menu"
                  >
                    <ExternalLink size={12} />
                  </a>

                  <button
                    onClick={() => handleDeleteRestaurant(r.id, r.name)}
                    style={{
                      background: '#FEE2E2',
                      color: '#DC2626',
                      padding: '6px',
                      borderRadius: '50%',
                      border: '1px solid #FCA5A5',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Delete Tenant Restaurant"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="sa-dashboard-container">
      {/* 🧭 DESKTOP & TABLET COLLAPSIBLE SIDEBAR */}
      <Sidebar
        activeView={activeView}
        setActiveView={(v) => {
          setActiveView(v);
          setShowMobileMoreDrawer(false);
        }}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        logoUrl={paymentKeys.platform_logo_url}
        onOpenSupport={() => setShowWhatsappModal(true)}
        onOpenBroadcast={() => handleOpenBroadcastModal()}
      />

      {/* 🖥️ MAIN CANVAS AREA */}
      <div className="sa-main-canvas">
        {/* 🔝 COMPACT TOP HEADER */}
        <Header
          username={username}
          activeView={activeView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleMobileMenu={() => setShowMobileMoreDrawer(true)}
          onOpenBroadcast={() => handleOpenBroadcastModal()}
          onLogout={onLogout}
        />

        {/* 📄 MAIN CONTENT BODY */}
        <main className="sa-content-body">
          {/* ========================================================================= */}
          {/* VIEW 1: OVERVIEW (KPIs + PENDING APPROVALS + DIRECTORY)                   */}
          {/* ========================================================================= */}
          {activeView === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPI Analytics Summary Cards Grid */}
              <div className="sa-stats-grid">
                {/* Card 1: Registered Tenants */}
                <div className="sa-stat-card hover-lift">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Store size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: 'var(--sa-primary)' }}>{restaurants.length}</div>
                      <div className="sa-stat-label">Total Tenants</div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Active Subscriptions */}
                <div className="sa-stat-card hover-lift">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#B45309' }}>{totalActive}</div>
                      <div className="sa-stat-label">Active Paid</div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Total Dishes Hosted */}
                <div className="sa-stat-card hover-lift">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Utensils size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#4338CA' }}>{totalDishes}</div>
                      <div className="sa-stat-label">Dishes Hosted</div>
                    </div>
                  </div>
                </div>

                {/* Card 4: Total QR Code Scans */}
                <div className="sa-stat-card hover-lift">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <QrCode size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#7E22CE' }}>{totalScans}</div>
                      <div className="sa-stat-label">QR Scans</div>
                    </div>
                  </div>
                </div>

                {/* Card 5: Est. Monthly SaaS Revenue */}
                <div className="sa-stat-card hover-lift btn-pulse" style={{ background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#FFFFFF', border: '1.5px solid #DFBA67' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <DollarSign size={22} color="#0A2315" />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#DFBA67' }}>₹{estimatedRevenue.toLocaleString()}</div>
                      <div className="sa-stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>MRR Revenue</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Approvals Alert Banner */}
              {totalPending > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                  border: '2px solid #F59E0B',
                  borderRadius: '16px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '24px' }}>🔔</div>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#B45309', margin: 0 }}>
                        {totalPending} New Registration{totalPending > 1 ? 's' : ''} Pending Approval!
                      </h3>
                      <p style={{ fontSize: '0.76rem', color: '#78350F', margin: '2px 0 0 0', fontWeight: 600 }}>
                        New restaurant owners signed up and are waiting for your permission to start their trial.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setStatusFilter('pending')}
                    style={{
                      background: '#B45309', color: '#FFFFFF', padding: '8px 14px', borderRadius: '10px',
                      border: 'none', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer',
                      boxShadow: '0 3px 10px rgba(180,83,9,0.25)'
                    }}
                  >
                    View Pending ({totalPending}) ➔
                  </button>
                </div>
              )}

              {/* Directory Controls & Cards */}
              {renderDirectorySection()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: TENANTS DIRECTORY                                                 */}
          {/* ========================================================================= */}
          {activeView === 'tenants' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {renderDirectorySection()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: BILLING & SUBSCRIPTIONS                                           */}
          {/* ========================================================================= */}
          {activeView === 'billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="sa-section-header">
                <div>
                  <h2 className="sa-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                    <CreditCard size={20} color="var(--sa-primary)" /> Subscription Management & Billing Lifecycle
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                    Audit tenant Cashfree AutoPay mandates, renewals, complimentary VIP terms, and access expiry.
                  </span>
                </div>
              </div>

              {/* Subscription Status Filter Strip */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Subscriptions' },
                  { id: 'active', label: '🟢 Active Paid' },
                  { id: 'suspended', label: '🔴 Suspended' },
                  { id: 'pending', label: '⏳ Pending Approvals' },
                ].map(pill => (
                  <button
                    key={pill.id}
                    onClick={() => setStatusFilter(pill.id)}
                    className={`sa-btn sa-btn-sm ${statusFilter === pill.id ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                    style={{ flexShrink: 0, border: 'none' }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {renderDirectorySection()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 4: SAAS PLANS & FEATURE MATRIX                                       */}
          {/* ========================================================================= */}
          {activeView === 'plans' && (
            <div className="sa-table-container" style={{ padding: '24px', background: '#FFFFFF' }}>
              <SaaSPlansView token={token} />
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 5: SYSTEM OPERATIONS & DB HEALTH                                     */}
          {/* ========================================================================= */}
          {activeView === 'operations' && (
            <div className="sa-table-container" style={{ padding: '24px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={20} color="var(--sa-primary)" /> System Operations & Neon DB Maintenance
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                  Manage platform-wide retention policies, automated trial terms, and disk space optimizations.
                </span>
              </div>

              {/* Trial Duration Setting */}
              <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '14px', border: '1px solid #FCD34D' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#B45309', marginBottom: '6px' }}>
                  🎁 DEFAULT SAAS FREE TRIAL DURATION:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="16"
                    value={paymentKeys.default_trial_days || ''}
                    onChange={(e) => setPaymentKeys({ ...paymentKeys, default_trial_days: e.target.value })}
                    style={{ width: '100px', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}
                  />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>Days Free Trial for New Registrations</span>
                </div>
              </div>

              {/* Order Retention & Compaction Policy */}
              <div style={{ background: '#F0FDF4', padding: '16px', borderRadius: '14px', border: '1.5px solid #86EFAC' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 900, color: '#166534', marginBottom: '4px' }}>
                  ⚡ GLOBAL ORDER RETENTION & DATA COMPACTION:
                </strong>
                <p style={{ fontSize: '0.74rem', color: '#15803D', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                  Platform-wide data retention policy applied automatically across all restaurants.
                </p>
                <select
                  value={paymentKeys.global_order_retention_days || '90'}
                  onChange={(e) => setPaymentKeys({ ...paymentKeys, global_order_retention_days: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #86EFAC', fontSize: '0.88rem', fontWeight: 800, color: '#14532D', background: '#FFFFFF' }}
                >
                  <option value="1">⚡ 24 Hours / 1 Day (Ultra Light - High Traffic)</option>
                  <option value="7">⚡ 7 Days (Standard Light)</option>
                  <option value="30">⚡ 30 Days (1 Month History)</option>
                  <option value="90">⚡ 90 Days (Quarterly / 3 Months History - Recommended)</option>
                  <option value="180">⚡ 180 Days (Half-Year / 6 Months History)</option>
                  <option value="365">⚡ 365 Days (Full 1 Year History)</option>
                </select>
              </div>

              {/* Vacuum Maintenance */}
              <div style={{ background: '#EFF6FF', padding: '16px', borderRadius: '14px', border: '1px solid #BFDBFE' }}>
                <strong style={{ fontSize: '0.84rem', color: '#1E40AF', display: 'block', marginBottom: '4px' }}>
                  🧹 POSTGRESQL DATABASE MAINTENANCE & VACUUM:
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#3B82F6', display: 'block', marginBottom: '12px' }}>
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
                  className="sa-btn sa-btn-primary"
                  style={{ width: '100%', padding: '12px 14px' }}
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
                className="sa-btn sa-btn-accent"
                style={{ width: '100%', padding: '14px' }}
              >
                {keysSaving ? 'Saving Settings...' : '💾 Save Operations & Trial Settings'}
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 6: PLATFORM AUDIT LOGS STREAM                                        */}
          {/* ========================================================================= */}
          {activeView === 'activity' && (
            <div className="sa-table-container" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={20} color="var(--sa-primary)" /> Platform Audit Log Trail
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                    Real-time security events, tenant activations, impersonations, and credential audits.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadAuditData}
                  className="sa-btn sa-btn-secondary sa-btn-sm"
                >
                  <RefreshCw size={13} className={auditLoading ? 'spin' : ''} /> Refresh Stream
                </button>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: '#F8FAFC', padding: '10px 12px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
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
                        className={`sa-btn sa-btn-sm ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                        style={{ border: 'none' }}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search logs..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    style={{ width: '100%', padding: '6px 12px', borderRadius: 'var(--sa-radius-full)', border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
                  />
                </div>
              </div>

              {/* Audit Stream List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                {auditLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>⏳ Loading live audit logs...</div>
                ) : auditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>No audit log events found.</div>
                ) : (
                  auditLogs
                    .filter(log => {
                      if (auditFilter === 'activations') return (log.action || '').toUpperCase().includes('ACTIVAT');
                      if (auditFilter === 'suspensions') return (log.action || '').toUpperCase().includes('SUSPEND');
                      if (auditFilter === 'settings') return (log.action || '').toUpperCase().includes('SETTING') || (log.action || '').toUpperCase().includes('UPDATE');
                      if (auditFilter === 'security') return (log.action || '').toUpperCase().includes('SECURITY') || (log.action || '').toUpperCase().includes('LOGIN') || (log.action || '').toUpperCase().includes('IMPERSONAT');
                      return true;
                    })
                    .filter(log => {
                      if (!auditSearch.trim()) return true;
                      const q = auditSearch.toLowerCase();
                      return (log.action || '').toLowerCase().includes(q) || (log.details || '').toLowerCase().includes(q) || (log.actor_role || '').toLowerCase().includes(q);
                    })
                    .map(log => (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          background: '#FFFFFF',
                          borderRadius: '12px',
                          border: '1px solid var(--sa-border)',
                          fontSize: '0.82rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="sa-badge sa-badge-info">{log.action}</span>
                          <span style={{ color: 'var(--sa-text-main)', fontWeight: 600 }}>{log.details}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', whiteSpace: 'nowrap' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : 'Just now'}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 7: SYSTEM & GATEWAY SETTINGS                                         */}
          {/* ========================================================================= */}
          {activeView === 'settings' && (
            <div className="sa-table-container" style={{ padding: '24px', maxWidth: '720px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="var(--sa-primary)" /> System Configuration & Security
              </h3>

              {/* 4-Tab Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: '#F1F5F9', padding: '5px', borderRadius: '14px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
                {[
                  { id: 'security', label: '🛡️ Security', icon: Lock },
                  { id: 'gateway', label: '💳 Gateway', icon: Key },
                  { id: 'branding', label: '🖼️ Branding', icon: Image },
                  { id: 'health', label: '⚡ DB Health', icon: Database },
                ].map(tab => {
                  const isActive = secTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSecTab(tab.id)}
                      className={`sa-btn sa-btn-sm ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                      style={{ border: 'none' }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {securityError && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '14px' }}>⚠️ {securityError}</div>}
              {securitySuccess && <div style={{ background: '#ECFDF5', color: '#047857', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '14px' }}>{securitySuccess}</div>}
              {keysMsg && <div style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '14px' }}>{keysMsg}</div>}

              {/* Settings Tab 1: Security */}
              {secTab === 'security' && (
                <form onSubmit={handleSecuritySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>🔑 Current Password (Required) *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurPass ? 'text' : 'password'}
                        required
                        placeholder="Enter current password"
                        value={securityForm.currentPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                        style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => setShowCurPass(!showCurPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                        {showCurPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>👤 Master Login Username</label>
                    <input
                      type="text"
                      required
                      value={securityForm.newUsername}
                      onChange={(e) => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px' }}>🔒 New Password (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        placeholder="Leave blank to keep unchanged"
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                        style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                        {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={securitySubmitting} className="sa-btn sa-btn-accent" style={{ padding: '14px', marginTop: '6px' }}>
                    {securitySubmitting ? 'Updating Credentials...' : '💾 Save Master Credentials'}
                  </button>
                </form>
              )}

              {/* Settings Tab 2: Gateway */}
              {secTab === 'gateway' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>CASHFREE APP ID (CLIENT ID) *</label>
                    <input
                      type="text"
                      placeholder="e.g. 1029384756"
                      value={paymentKeys.cashfree_app_id || ''}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_app_id: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>CASHFREE SECRET KEY *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        placeholder="Cashfree Secret Key"
                        value={paymentKeys.cashfree_secret_key || ''}
                        onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_secret_key: e.target.value })}
                        style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => setShowSecretKey(!showSecretKey)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                        {showSecretKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={keysSaving}
                    onClick={async () => {
                      setKeysSaving(true);
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
                    className="sa-btn sa-btn-primary"
                    style={{ padding: '14px', marginTop: '6px' }}
                  >
                    {keysSaving ? 'Saving Gateway Keys...' : '💾 Save Gateway Credentials'}
                  </button>
                </div>
              )}

              {/* Settings Tab 3: Branding */}
              {secTab === 'branding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#F8FAFC', padding: '14px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                    {logoPreview || (paymentKeys.platform_logo_url && !logoErr) ? (
                      <img
                        src={logoPreview || resolveImageUrl(paymentKeys.platform_logo_url)}
                        alt="Logo"
                        onError={() => setLogoErr(true)}
                        style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'contain', background: '#FFF', padding: '2px', border: '1.5px solid #CBD5E1' }}
                      />
                    ) : (
                      <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#0A2315', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.5rem' }}>👑</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingLogo(true);
                          try {
                            const uploadedData = await uploadImage(file, token, 'superadmin');
                            let newUrl = typeof uploadedData === 'string' ? uploadedData : (uploadedData?.r2ProxyUrl || uploadedData?.url || uploadedData?.path);
                            const updated = { ...paymentKeys, platform_logo_url: newUrl };
                            setPaymentKeys(updated);
                            await fetch('/api/superadmin/settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify(updated)
                            });
                            setKeysMsg('✅ Platform Logo updated successfully!');
                          } catch (err) {
                            alert('Logo upload failed: ' + err.message);
                          } finally {
                            setUploadingLogo(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Tab 4: DB Health */}
              {secTab === 'health' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#EFF6FF', padding: '16px', borderRadius: '14px', border: '1px solid #BFDBFE' }}>
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
                        try {
                          const data = await superAdminOptimizeDatabase(token);
                          setDbOptimizeMsg(`✅ ${data.message || 'Database optimized!'}`);
                        } catch (err) {
                          setDbOptimizeMsg(`⚠️ ${err.message || 'Optimization failed'}`);
                        } finally {
                          setDbOptimizing(false);
                        }
                      }}
                      className="sa-btn sa-btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                    >
                      {dbOptimizing ? 'Optimizing...' : '⚡ Run Vacuum & Database Optimization'}
                    </button>
                    {dbOptimizeMsg && <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E40AF', display: 'block', marginTop: '8px' }}>{dbOptimizeMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 8: GLOBAL BROADCAST NOTICES                                          */}
          {/* ========================================================================= */}
          {activeView === 'communication' && (
            <div className="sa-table-container" style={{ padding: '24px', maxWidth: '720px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={20} color="var(--sa-primary)" /> Global Broadcast Notices
              </h3>
              <form onSubmit={handleCreateAnnouncementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px', display: 'block' }}>
                    ANNOUNCEMENT MESSAGE FOR ALL TENANTS *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. ⚡ New Feature Released: WhatsApp Direct Ordering is now live!"
                    value={announceMsg}
                    onChange={(e) => setAnnounceMsg(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid #CBD5E1', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'info', label: 'ℹ️ Information' },
                    { id: 'success', label: '🎉 Feature Release' },
                    { id: 'warning', label: '⚠️ Maintenance' },
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAnnounceType(type.id)}
                      className={`sa-btn sa-btn-sm ${announceType === type.id ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                      style={{ border: 'none' }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                <button type="submit" disabled={announceSubmitting} className="sa-btn sa-btn-accent" style={{ padding: '14px' }}>
                  <Megaphone size={16} /> {announceSubmitting ? 'Broadcasting...' : '📢 Broadcast Notice'}
                </button>
              </form>
            </div>
          )}
        </main>

        {/* 📱 MOBILE FIXED BOTTOM NAVIGATION BAR */}
        <BottomNavigation
          activeView={activeView}
          setActiveView={(v) => {
            setActiveView(v);
            setShowMobileMoreDrawer(false);
          }}
          onOpenMoreDrawer={() => setShowMobileMoreDrawer(true)}
        />
      </div>

      {/* 📱 MOBILE MORE SLIDE-OVER DRAWER */}
      <Drawer
        isOpen={showMobileMoreDrawer}
        onClose={() => setShowMobileMoreDrawer(false)}
        title="Super Admin Navigation"
        subtitle="Access all platform control sections"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'overview', label: '📊 Overview & KPIs', desc: 'Platform summary & stats' },
            { id: 'tenants', label: '🏪 Tenants Directory', desc: 'Manage client accounts' },
            { id: 'billing', label: '💳 Billing & Subscriptions', desc: 'Mandates & access expiry' },
            { id: 'plans', label: '👑 SaaS Plans & Pricing', desc: 'Feature matrix & tiers' },
            { id: 'operations', label: '⚡ DB Health & Operations', desc: 'Compaction & maintenance' },
            { id: 'activity', label: '📜 Platform Audit Stream', desc: 'Security & event logs' },
            { id: 'settings', label: '⚙️ System & Gateway Settings', desc: 'Credentials & branding' },
            { id: 'communication', label: '📢 Broadcast Notices', desc: 'Live announcements' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                setShowMobileMoreDrawer(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '12px',
                border: activeView === item.id ? '1.5px solid var(--sa-accent)' : '1px solid var(--sa-border)',
                background: activeView === item.id ? 'var(--sa-surface-subtle)' : '#FFFFFF',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--sa-text-main)' }}>{item.label}</strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)' }}>{item.desc}</span>
              </div>
              <span style={{ color: 'var(--sa-accent)', fontWeight: 900 }}>➔</span>
            </button>
          ))}
          <button
            onClick={() => {
              setShowMobileMoreDrawer(false);
              setShowWhatsappModal(true);
            }}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #86EFAC',
              background: '#F0FDF4',
              color: '#15803D',
              fontWeight: 800,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>💬 WhatsApp Support Desk</span>
            <span>➔</span>
          </button>
          <button
            onClick={onLogout}
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #FCA5A5',
              background: '#FEE2E2',
              color: '#DC2626',
              fontWeight: 900,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={16} /> Log Out of Super Admin
          </button>
        </div>
      </Drawer>

      {/* ➕ Modal: Add New Tenant Restaurant */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="sa-modal-box" style={{
            background: '#FFFFFF', borderRadius: '24px', maxWidth: '540px', width: '100%',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #D4AF37',
            maxHeight: '90vh', overflowY: 'auto', position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{
                position: 'absolute', top: '18px', right: '18px', background: '#F3F4F6',
                border: 'none', width: '32px', height: '32px', borderRadius: '50%',
                cursor: 'pointer', fontWeight: 900, color: '#4B5563', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 10
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={20} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>Add New Restaurant Tenant</h3>
            </div>

            {formError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '14px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRestaurant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>RESTAURANT NAME *</label>
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
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>CUSTOM URL SLUG *</label>
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
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>PLAN TIER</label>
                  <select
                    value={form.plan_tier}
                    onChange={(e) => {
                      const tier = e.target.value;
                      const selectedPlan = (plansList || []).find(p => p.key === tier) || getPlanDetails(tier);
                      setForm({ ...form, plan_tier: tier, plan_price: selectedPlan.price });
                    }}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    {(plansList.length > 0 ? plansList : Object.values(SAAS_PLANS)).map(p => (
                      <option key={p.key || p.id} value={p.key || p.id}>{p.name} (₹{p.price}/mo)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>THEME COLOR</label>
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
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>OWNER USERNAME *</label>
                  <input
                    type="text"
                    value={form.owner_username}
                    onChange={(e) => setForm({ ...form, owner_username: e.target.value })}
                    required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>OWNER PASSWORD *</label>
                  <input
                    type="text"
                    value={form.owner_password}
                    onChange={(e) => setForm({ ...form, owner_password: e.target.value })}
                    required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>PHONE NUMBER</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value, whatsapp_number: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="sa-btn sa-btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={formSubmitting} className="sa-btn sa-btn-accent" style={{ flex: 1 }}>
                  {formSubmitting ? 'Creating...' : '✓ Create Restaurant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal: Edit Tenant Restaurant Info */}
      {editModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '24px', maxWidth: '540px', width: '100%',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #D4AF37',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>Edit Tenant: {editModalData.name}</h3>
              </div>
              <button onClick={() => setEditModalData(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateRestaurant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>RESTAURANT NAME</label>
                <input
                  type="text"
                  value={editModalData.name || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>OWNER EMAIL (OPTIONAL / RECOVERY)</label>
                <input
                  type="email"
                  placeholder="e.g. owner@example.com"
                  value={editModalData.owner_email || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, owner_email: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>OWNER USERNAME</label>
                <input
                  type="text"
                  value={editModalData.owner_username || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, owner_username: e.target.value })}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>RESET PASSWORD (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="Enter new password to reset"
                  value={editModalData.owner_password || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, owner_password: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                <button type="button" onClick={() => setEditModalData(null)} className="sa-btn sa-btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="sa-btn sa-btn-accent" style={{ flex: 1 }}>💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💬 WhatsApp Support Modal */}
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
                position: 'absolute', top: '18px', right: '18px', background: '#F3F4F6',
                border: 'none', width: '32px', height: '32px', borderRadius: '50%',
                cursor: 'pointer', fontWeight: 900, color: '#4B5563', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #86EFAC' }}>
                <MessageSquare size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>WhatsApp Support Portal</h3>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch('/api/superadmin/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
              <input
                type="tel"
                required
                value={masterWhatsapp}
                onChange={e => setMasterWhatsapp(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 800, marginBottom: '16px', boxSizing: 'border-box' }}
              />
              <button type="submit" className="sa-btn sa-btn-primary" style={{ width: '100%', padding: '14px' }}>
                <MessageSquare size={18} /> 💾 Save WhatsApp Number
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🎁 Grant Free Access Modal */}
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

      {/* 🔍 Tenant 360 Drawer */}
      <TenantDetailsView
        resto={selectedTenant360}
        isOpen={Boolean(selectedTenant360)}
        onClose={() => setSelectedTenant360(null)}
        onImpersonate={handleImpersonate}
        onEdit={(r) => setEditModalData(r)}
        onGrantFree={(r) => setGrantModalResto(r)}
        onRevokeFree={(r) => setRevokeModalResto(r)}
        onToggleActive={handleToggleActive}
        onDelete={handleDeleteRestaurant}
        token={token}
      />

      {/* ⚠️ Revoke Free Access Modal */}
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
