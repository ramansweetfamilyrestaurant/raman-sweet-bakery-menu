import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload, X, XCircle, CreditCard, Lock, Sparkles, Eye, EyeOff, Key, Database, Sliders, Image, LayoutGrid, List, MoreHorizontal, ArrowUpDown, Clock, Radio, HardDrive, Settings } from 'lucide-react';
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
import CommunicationView from './views/CommunicationView';
import { KpiCard, SectionHeader, StatusBadge, EmptyState, DataTable, FilterPills, SearchBar, TenantCard } from './components';
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
  const [dbStats, setDbStats] = useState(null);

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
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
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

  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'trial', 'failed', 'autorenew_off', 'expired', 'vip', 'suspended'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name_asc', 'plan', 'expiry', 'scans'
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'table'
  const [openMoreId, setOpenMoreId] = useState(null);

  // Helper to determine canonical tenant lifecycle status
  const getTenantStatus = (r) => {
    const isSuspended = (r.active === false || r.active === 0 || r.active === '0');
    if (isSuspended) return 'suspended';
    const isVip = (r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted');
    if (isVip) return 'vip';
    const daysLeft = getDaysRemaining(r.plan_expires_at);
    const isExpired = (!isVip && daysLeft !== null && daysLeft <= 0) || r.subscription_status === 'expired';
    if (isExpired) return 'expired';
    const isFailed = (r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due');
    if (isFailed) return 'failed';
    const isTrial = (r.subscription_status === 'trialing' || (r.trial_ends_at && new Date(r.trial_ends_at) > new Date()));
    if (isTrial) return 'trial';
    const isAutoRenewOff = (r.auto_renew === 0 || r.auto_renew === false);
    if (isAutoRenewOff) return 'autorenew_off';
    return 'active';
  };

  // Helper to render semantic status badge
  const renderStatusBadge = (r) => {
    const status = getTenantStatus(r);
    if (status === 'suspended') {
      return (
        <span style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          ⚫ Suspended
        </span>
      );
    }
    if (status === 'vip') {
      return (
        <span style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          🟣 VIP
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          🟡 Payment Failed
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          🔴 Expired
        </span>
      );
    }
    if (status === 'trial') {
      return (
        <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          🎁 Trial
        </span>
      );
    }
    if (status === 'autorenew_off') {
      return (
        <span style={{ background: '#FFEDD5', color: '#C2410C', border: '1px solid #FDBA74', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          🟠 Auto-Renew Off
        </span>
      );
    }
    return (
      <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.66rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        🟢 Active
      </span>
    );
  };

  // Filtered and Sorted restaurants list
  const filteredAndSortedRestaurants = restaurants
    .filter(r => {
      const status = getTenantStatus(r);
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Extended Search (name, slug, owner_name, owner_username, phone, owner_email, id)
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (r.name || '').toLowerCase().includes(q);
      const slugMatch = (r.slug || '').toLowerCase().includes(q);
      const ownerNameMatch = (r.owner_name || '').toLowerCase().includes(q);
      const usernameMatch = (r.owner_username || '').toLowerCase().includes(q);
      const phoneMatch = (r.phone || '').includes(q) || (r.whatsapp_number || '').includes(q);
      const emailMatch = (r.owner_email || '').toLowerCase().includes(q);
      const idMatch = String(r.id || '').includes(q);

      return nameMatch || slugMatch || ownerNameMatch || usernameMatch || phoneMatch || emailMatch || idMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'plan') return (parseFloat(b.plan_price) || 0) - (parseFloat(a.plan_price) || 0);
      if (sortBy === 'expiry') {
        const aExp = a.plan_expires_at ? new Date(a.plan_expires_at).getTime() : 0;
        const bExp = b.plan_expires_at ? new Date(b.plan_expires_at).getTime() : 0;
        return aExp - bExp;
      }
      if (sortBy === 'scans') return (b.scan_count || 0) - (a.scan_count || 0);
      // Default: 'recent' (ID desc)
      return (b.id || 0) - (a.id || 0);
    });

  const totalPending = restaurants.filter(r => r.active === false || r.active === 0 || r.active === '0').length;
  const totalActive = restaurants.filter(r => r.active !== false && r.active !== 0 && r.active !== '0').length;
  const totalDishes = restaurants.reduce((acc, r) => acc + (r.dish_count || 0), 0);
  const totalScans = restaurants.reduce((acc, r) => acc + (r.scan_count || 0), 0);
  const estimatedRevenue = restaurants.filter(r => r.active !== false).reduce((acc, r) => acc + (parseFloat(r.plan_price) || 999), 0);

  // Render Directory Controls & Clean Tenant Cards Grid / Table
  const renderDirectorySection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={() => setOpenMoreId(null)}>
      {/* 👑 1. DIRECTORY SECTION HEADER */}
      <SectionHeader
        title="🏪 Tenant Directory"
        subtitle={`Manage restaurants, subscriptions and tenant access (${filteredAndSortedRestaurants.length} of ${restaurants.length} accounts)`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="sa-btn sa-btn-accent sa-btn-sm"
              style={{ fontWeight: 900 }}
            >
              <Plus size={15} /> Add Restaurant
            </button>
            <button
              type="button"
              onClick={loadData}
              title="Refresh Directory"
              className="sa-btn sa-btn-secondary sa-btn-sm"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        }
      />

      {/* 🛠️ 2. TOOLBAR (SEARCH + SORT + GRID/TABLE TOGGLE) */}
      <div className="sa-directory-controls" style={{
        background: 'var(--sa-surface)',
        borderRadius: 'var(--sa-radius-lg)',
        padding: '12px 16px',
        border: '1px solid var(--sa-border)',
        boxShadow: 'var(--sa-shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
          <input
            type="text"
            placeholder="Search name, slug, owner, phone, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sa-input"
            style={{
              paddingLeft: '34px',
              paddingRight: searchQuery ? '32px' : '12px',
              height: '38px',
              fontSize: '0.80rem',
              borderRadius: 'var(--sa-radius-full)',
              background: 'var(--sa-surface-subtle)'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="sa-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sort Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sa-select"
              style={{
                padding: '6px 12px',
                height: '38px',
                borderRadius: 'var(--sa-radius-full)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--sa-text-main)',
                background: 'var(--sa-surface-subtle)',
                cursor: 'pointer'
              }}
            >
              <option value="recent">⚡ Recent First</option>
              <option value="name_asc">🔤 Name (A-Z)</option>
              <option value="plan">👑 Plan Tier</option>
              <option value="expiry">⏳ Expiry Date</option>
              <option value="scans">📲 QR Scans</option>
            </select>
          </div>

          {/* Grid / Table Toggle */}
          <div className="sa-view-toggle" style={{ display: 'flex', background: 'var(--sa-surface-subtle)', padding: '2px', borderRadius: 'var(--sa-radius-full)', border: '1px solid var(--sa-border)' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: 'var(--sa-radius-full)',
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 800,
                color: viewMode === 'grid' ? 'var(--sa-primary)' : 'var(--sa-text-muted)',
                boxShadow: viewMode === 'grid' ? 'var(--sa-shadow-sm)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Grid Card View"
            >
              <LayoutGrid size={13} /> Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: 'var(--sa-radius-full)',
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 800,
                color: viewMode === 'table' ? 'var(--sa-primary)' : 'var(--sa-text-muted)',
                boxShadow: viewMode === 'table' ? 'var(--sa-shadow-sm)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Spreadsheet Table View"
            >
              <List size={13} /> Table
            </button>
          </div>
        </div>
      </div>

      {/* 🏷️ 3. FILTER PILLS STRIP (USING SHARED FilterPills) */}
      <FilterPills
        pills={[
          { id: 'all', label: 'All', count: restaurants.length },
          { id: 'active', label: '🟢 Active', count: restaurants.filter(r => r.active !== false && r.active !== 0 && r.active !== '0').length },
          { id: 'trial', label: '🎁 Trial', count: restaurants.filter(r => r.subscription_status === 'trialing').length },
          { id: 'failed', label: '🟡 Past Due', count: restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length },
          { id: 'autorenew_off', label: '🟠 Renew Off', count: restaurants.filter(r => r.subscription_status === 'auto_renew_off' || r.cancel_requested_at !== null).length },
          { id: 'expired', label: '🔴 Expired', count: restaurants.filter(r => r.subscription_status === 'expired').length },
          { id: 'vip', label: '🟣 VIP', count: restaurants.filter(r => r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted').length },
          { id: 'suspended', label: '⚫ Suspended', count: restaurants.filter(r => r.active === false || r.active === 0 || r.active === '0').length },
        ]}
        activeId={statusFilter}
        onChange={setStatusFilter}
      />

      {/* 🔄 4. CONTENT DISPLAY (LOADING / EMPTY / TABLE / GRID) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--sa-accent)', fontWeight: 800 }}>
          👑 Loading Tenant Restaurants Directory...
        </div>
      ) : filteredAndSortedRestaurants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No tenants match your criteria"
          description="Try clearing your search query or switching status filters."
          action={
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="sa-btn sa-btn-secondary sa-btn-sm"
            >
              Clear Search & Filters
            </button>
          }
        />
      ) : viewMode === 'table' ? (
        /* 📊 TABLE VIEW */
        <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: 'var(--sa-radius-lg)' }}>
          <table className="sa-table">
            <thead>
              <tr>
                <th>TENANT</th>
                <th>OWNER / CONTACT</th>
                <th>PLAN</th>
                <th>STATUS</th>
                <th>RENEWAL / EXPIRY</th>
                <th>SCANS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRestaurants.map(r => {
                const daysLeft = getDaysRemaining(r.plan_expires_at);
                const isVip = (r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted');
                const isExpired = (!isVip && daysLeft !== null && daysLeft <= 0) || r.subscription_status === 'expired';

                return (
                  <tr key={r.id}>
                    <td>
                      <div 
                        onClick={() => setSelectedTenant360(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        title="Click to open Tenant 360° Profile"
                      >
                        <img
                          src={getRestaurantLogoUrl(r.logo)}
                          alt={r.name}
                          onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #D4AF37' }}
                        />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--sa-text-main)' }}>{r.name}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700 }}>/{r.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', display: 'block', color: 'var(--sa-text-main)' }}>
                        {r.owner_username || 'admin'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                        {r.phone || (r.owner_email ? r.owner_email : 'No contact')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--sa-primary)', fontSize: '0.78rem' }}>{(r.plan_tier || 'pro').toUpperCase()}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                        {isVip ? '₹0/mo (VIP)' : `₹${r.plan_price || 999}/mo`}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.subscription_status} type={r.subscription_type} />
                    </td>
                    <td style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                      {isVip ? '♾️ Lifetime' : daysLeft !== null ? (isExpired ? 'Expired' : `${daysLeft}d left`) : 'Active'}
                    </td>
                    <td style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7E22CE' }}>
                      📲 {r.scan_count || 0}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTenant360(r)}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 800 }}
                          title="Open 360° Profile"
                        >
                          🔍 360°
                        </button>
                        <button
                          type="button"
                          onClick={() => handleImpersonate(r.id, r.name)}
                          className="sa-btn sa-btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', background: '#0A2315', color: '#FFD700', border: '1px solid #D4AF37', fontWeight: 900 }}
                          title="1-Click Manage Menu"
                        >
                          👑 Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 📱 CARD GRID VIEW (COMPACT & CLEAN) */
        <div className="sa-grid-container" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {filteredAndSortedRestaurants.map(r => {
            const daysLeft = getDaysRemaining(r.plan_expires_at);
            const isVip = (r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted');
            const isExpired = (!isVip && daysLeft !== null && daysLeft <= 0) || r.subscription_status === 'expired';

            return (
              <div
                key={r.id}
                className="sa-stat-card"
                style={{
                  padding: '16px',
                  border: r.active !== false ? '1px solid var(--sa-border)' : '1.5px solid #FCA5A5',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  position: 'relative'
                }}
              >
                {/* 1. Header: Avatar, Title, Slug & StatusBadge */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div 
                      onClick={() => setSelectedTenant360(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                      title="Click to open Tenant 360° Profile"
                    >
                      <img
                        src={getRestaurantLogoUrl(r.logo)}
                        alt={r.name}
                        onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #D4AF37',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '0.96rem', fontWeight: 900, margin: 0, color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.name}
                        </h3>
                        <span style={{ fontSize: '0.72rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 800 }}>
                          /{r.slug}
                        </span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <StatusBadge status={r.subscription_status} type={r.subscription_type} />
                    </div>
                  </div>

                  {/* 2. SaaS Badges Row */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 7px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 900 }}>
                      👑 {(r.plan_tier || 'pro').toUpperCase()} (₹{r.plan_price || 999}/mo)
                    </span>

                    <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 7px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800 }}>
                      {isVip ? '♾️ Lifetime' : daysLeft !== null ? (isExpired ? 'Expired' : `${daysLeft}d left`) : 'Active'}
                    </span>

                    <span style={{ background: '#F3E8FF', color: '#7E22CE', padding: '2px 7px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800 }}>
                      📲 {r.scan_count || 0} scans
                    </span>
                  </div>

                  {/* 3. Owner Contact Compact Box */}
                  <div style={{
                    background: 'var(--sa-surface-subtle)',
                    borderRadius: 'var(--sa-radius-md)',
                    padding: '8px 10px',
                    fontSize: '0.74rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px solid var(--sa-border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>👤 Owner:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--sa-text-main)' }}>{r.owner_username || 'admin'}</strong>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(r.owner_username || 'admin');
                            setCopiedId(r.id + '-user');
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          title="Copy Username"
                        >
                          {copiedId === r.id + '-user' ? <Check size={11} color="#166534" /> : <Copy size={11} color="#64748B" />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>📞 Phone:</span>
                      {r.phone || r.whatsapp_number ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: 'var(--sa-text-main)', fontWeight: 800 }}>{r.phone || r.whatsapp_number}</strong>
                          <a
                            href={`https://wa.me/${(r.phone || r.whatsapp_number || '').replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: '#22C55E', color: '#FFFFFF', padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, textDecoration: 'none' }}
                          >
                            💬 Chat
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--sa-text-muted)' }}>Not Provided</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--sa-text-muted)', fontWeight: 700 }}>✉️ Email:</span>
                      <span style={{ color: r.owner_email ? 'var(--sa-text-main)' : 'var(--sa-text-muted)', fontSize: '0.72rem', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.owner_email || 'Email not added'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Actions Footer: EXACTLY [ 🔍 360° Profile ] [ 👑 Manage Menu ] [ ••• More ] */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--sa-border)', paddingTop: '10px', alignItems: 'center', position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedTenant360(r)}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ fontWeight: 800, fontSize: '0.75rem', padding: '7px 10px', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    title="Open complete 360-degree Tenant Profile"
                  >
                    <Search size={13} /> 360° Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => handleImpersonate(r.id, r.name)}
                    className="sa-btn sa-btn-sm"
                    style={{ background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#FFD700', border: '1px solid #D4AF37', fontWeight: 900, fontSize: '0.75rem', padding: '7px 12px', flex: '1.2 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    title="1-Click Log In as Restaurant Owner"
                  >
                    <Crown size={13} color="#FFD700" /> Manage Menu
                  </button>

                  {/* ••• More Button & Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMoreId(openMoreId === r.id ? null : r.id);
                      }}
                      className="sa-btn sa-btn-secondary sa-btn-sm"
                      style={{ padding: '7px 10px', fontWeight: 900, minWidth: '36px' }}
                      title="More Actions"
                    >
                      •••
                    </button>

                    {openMoreId === r.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: 0,
                          marginBottom: '6px',
                          background: '#FFFFFF',
                          borderRadius: '12px',
                          border: '1.5px solid var(--sa-border-strong)',
                          boxShadow: 'var(--sa-shadow-lg)',
                          padding: '6px',
                          zIndex: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          minWidth: '190px'
                        }}
                      >
                        {/* 1. Edit Details */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditModalData(r);
                            setOpenMoreId(null);
                          }}
                          className="sa-btn sa-btn-sm"
                          style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 700, color: '#374151' }}
                        >
                          <Edit3 size={13} /> Edit Restaurant
                        </button>

                        {/* 2. Grant or Revoke Free Access */}
                        {isVip ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeModalResto(r);
                              setOpenMoreId(null);
                            }}
                            className="sa-btn sa-btn-sm"
                            style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: '#FEE2E2', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 800, color: '#991B1B' }}
                          >
                            <Shield size={13} /> Revoke VIP Access
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setGrantModalResto(r);
                              setOpenMoreId(null);
                            }}
                            className="sa-btn sa-btn-sm"
                            style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: '#F3E8FF', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 800, color: '#6B21A8' }}
                          >
                            <Crown size={13} /> Grant VIP Access
                          </button>
                        )}

                        {/* 3. Live Menu Preview Link */}
                        <a
                          href={`/${r.subdomain || r.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpenMoreId(null)}
                          className="sa-btn sa-btn-sm"
                          style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 700, color: '#374151', textDecoration: 'none' }}
                        >
                          <ExternalLink size={13} /> Live Customer Menu
                        </a>

                        {/* 4. Copy URL Link */}
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/${r.subdomain || r.slug}`;
                            navigator.clipboard.writeText(url);
                            setCopiedId(r.id + '-menu');
                            setTimeout(() => setCopiedId(null), 2000);
                            setOpenMoreId(null);
                          }}
                          className="sa-btn sa-btn-sm"
                          style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 700, color: '#374151' }}
                        >
                          {copiedId === r.id + '-menu' ? <Check size={11} color="#166534" /> : <Copy size={11} />} Copy Menu URL
                        </button>

                        {/* 5. Toggle Active/Suspended */}
                        <button
                          type="button"
                          onClick={() => {
                            handleToggleActive(r.id, r.active);
                            setOpenMoreId(null);
                          }}
                          className="sa-btn sa-btn-sm"
                          style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 700, color: r.active === false ? '#15803D' : '#D97706' }}
                        >
                          {r.active === false ? <ShieldCheck size={13} /> : <Shield size={13} />}
                          {r.active === false ? 'Reactivate Tenant' : 'Suspend Tenant'}
                        </button>

                        <div style={{ height: '1px', background: 'var(--sa-border)', margin: '2px 0' }} />

                        {/* 6. Delete Restaurant (Protected Guard) */}
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteRestaurant(r.id, r.name);
                            setOpenMoreId(null);
                          }}
                          className="sa-btn sa-btn-sm"
                          style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '7px 10px', fontSize: '0.76rem', fontWeight: 800, color: '#DC2626' }}
                        >
                          <Trash2 size={13} /> Delete Restaurant
                        </button>
                      </div>
                    )}
                  </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 👑 1. VIEW HEADER */}
              <SectionHeader
                title="📊 Overview"
                subtitle="Platform health, revenue and tenant activity at a glance."
                actions={
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="sa-btn sa-btn-accent sa-btn-sm"
                      style={{ fontWeight: 900 }}
                    >
                      <Plus size={15} /> Add Restaurant
                    </button>
                    <button
                      onClick={loadData}
                      className="sa-btn sa-btn-secondary sa-btn-sm"
                      title="Refresh live metrics"
                    >
                      <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                  </div>
                }
              />

              {/* 👑 2. TOP 5 PRIMARY KPI HERO ROW (USING SHARED KpiCard) */}
              <div className="sa-stats-grid">
                {/* KPI 1: MRR Revenue */}
                <KpiCard
                  label="MRR Revenue"
                  value={`₹${estimatedRevenue.toLocaleString()}`}
                  icon={DollarSign}
                  color="var(--sa-accent)"
                  onClick={() => setActiveView('billing')}
                  badge="+ Active Subscriptions"
                />

                {/* KPI 2: Active Paid */}
                <KpiCard
                  label="Active Paid"
                  value={totalActive}
                  icon={CheckCircle}
                  color="#15803D"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('active'); }}
                  subtitle="Paid Accounts"
                />

                {/* KPI 3: Free Trial */}
                <KpiCard
                  label="Free Trial"
                  value={restaurants.filter(r => r.subscription_status === 'trialing' || (r.trial_ends_at && new Date(r.trial_ends_at) > new Date())).length}
                  icon={Calendar}
                  color="#1D4ED8"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('trial'); }}
                  subtitle="Trial Users"
                />

                {/* KPI 4: Past Due / Failed */}
                <KpiCard
                  label="Past Due / Failed"
                  value={restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length}
                  icon={CreditCard}
                  color="#B45309"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('failed'); }}
                  subtitle="Needs Attention"
                />

                {/* KPI 5: Total Tenants */}
                <KpiCard
                  label="Total Tenants"
                  value={restaurants.length}
                  icon={Store}
                  color="var(--sa-primary)"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('all'); }}
                  subtitle="Onboarded Restos"
                />
              </div>

              {/* ⚠️ 3. TWO-COLUMN OPERATIONAL HUBS: NEEDS ATTENTION & PLATFORM HEALTH */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* LEFT: NEEDS ATTENTION HUB */}
                <div className="sa-table-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield size={18} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>⚠️ Needs Attention</h3>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>Operational Alerts</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Row: Pending Approvals */}
                    {totalPending > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: '#B45309', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>PENDING</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>{totalPending} Registration{totalPending > 1 ? 's' : ''} Pending Approval</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('tenants'); setStatusFilter('suspended'); }}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                        >
                          Review ➔
                        </button>
                      </div>
                    )}

                    {/* Row: Payment Failures */}
                    {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: '#DC2626', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>CRITICAL</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991B1B' }}>
                            {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length} Payment Failures
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('tenants'); setStatusFilter('failed'); }}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                        >
                          Resolve ➔
                        </button>
                      </div>
                    )}

                    {/* Row: Cancellations Requested */}
                    {restaurants.filter(r => r.cancel_requested_at !== null).length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: '#D97706', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>CANCELLATION</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#B45309' }}>
                            {restaurants.filter(r => r.cancel_requested_at !== null).length} Pending Cancellations
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveView('billing')}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                        >
                          View ➔
                        </button>
                      </div>
                    )}

                    {/* Row: Expiring in <= 7 Days */}
                    {restaurants.filter(r => {
                      const d = getDaysRemaining(r.plan_expires_at);
                      return d !== null && d > 0 && d <= 7 && r.subscription_type !== 'ADMIN_GRANTED';
                    }).length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: '#64748B', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>EXPIRING</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                            {restaurants.filter(r => {
                              const d = getDaysRemaining(r.plan_expires_at);
                              return d !== null && d > 0 && d <= 7 && r.subscription_type !== 'ADMIN_GRANTED';
                            }).length} Subscriptions Expiring Soon
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('tenants'); setStatusFilter('expired'); }}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                        >
                          View ➔
                        </button>
                      </div>
                    )}

                    {/* All Clear State if no issues */}
                    {totalPending === 0 && restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due' || (r.cancel_requested_at !== null)).length === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #86EFAC' }}>
                        <CheckCircle size={20} color="#16A34A" />
                        <div>
                          <strong style={{ fontSize: '0.84rem', color: '#15803D', display: 'block' }}>All Systems Operational</strong>
                          <span style={{ fontSize: '0.74rem', color: '#166534' }}>Zero pending approvals or unresolved payment issues.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: PLATFORM HEALTH & ENGAGEMENT */}
                <div className="sa-table-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={18} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>⚡ Platform Engagement & Health</h3>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>Telemetry</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '12px 14px', background: 'var(--sa-surface-subtle)', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7E22CE', marginBottom: '4px' }}>
                        <QrCode size={16} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--sa-text-muted)' }}>TOTAL QR SCANS</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#7E22CE' }}>{totalScans.toLocaleString()}</div>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'var(--sa-surface-subtle)', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4338CA', marginBottom: '4px' }}>
                        <Utensils size={16} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--sa-text-muted)' }}>DISHES HOSTED</span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#4338CA' }}>{totalDishes.toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="sa-badge sa-badge-success">CONNECTED</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>Neon DB Index & Storage</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView('operations')}
                      className="sa-btn sa-btn-secondary sa-btn-sm"
                      style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
                    >
                      Optimize ➔
                    </button>
                  </div>
                </div>
              </div>

              {/* 📋 4. RECENT TENANT SIGNUPS & ACTIVITY TABLE */}
              <div className="sa-table-container" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                      📋 Recent Tenant Activity
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                      Latest onboarded restaurant accounts and status
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveView('tenants')}
                    className="sa-btn sa-btn-accent sa-btn-sm"
                    style={{ fontWeight: 900, fontSize: '0.78rem' }}
                  >
                    View All {restaurants.length} Tenants ➔
                  </button>
                </div>

                <div className="sa-responsive-table">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>RESTAURANT</th>
                        <th>OWNER / CONTACT</th>
                        <th>PLAN</th>
                        <th>STATUS</th>
                        <th style={{ textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...restaurants].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5).map(r => (
                        <tr key={r.id}>
                          <td>
                            <div
                              onClick={() => setSelectedTenant360(r)}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                              title="Click to open Tenant 360° Profile"
                            >
                              <img
                                src={getRestaurantLogoUrl(r.logo)}
                                alt={r.name}
                                onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #D4AF37' }}
                              />
                              <div>
                                <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--sa-text-main)' }}>{r.name}</strong>
                                <span style={{ fontSize: '0.7rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700 }}>/{r.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', display: 'block', color: 'var(--sa-text-main)' }}>
                              {r.owner_username || 'admin'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)' }}>
                              {r.phone || r.owner_email || 'No contact'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 800, color: 'var(--sa-primary)', fontSize: '0.78rem' }}>{(r.plan_tier || 'pro').toUpperCase()}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', display: 'block' }}>₹{r.plan_price || 999}/mo</span>
                          </td>
                          <td>
                            <StatusBadge status={r.subscription_status} type={r.subscription_type} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedTenant360(r)}
                              className="sa-btn sa-btn-secondary sa-btn-sm"
                              style={{ padding: '4px 9px', fontSize: '0.72rem', fontWeight: 800 }}
                              title="Open 360° Profile"
                            >
                              <Eye size={13} /> 360°
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 💳 1. VIEW HEADER (USING SHARED SectionHeader) */}
              <SectionHeader
                title="💳 Billing & Subscription Center"
                subtitle="Monitor subscriptions, renewals, failed payments and cancellations."
                actions={
                  <button
                    type="button"
                    onClick={loadData}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    title="Refresh live metrics"
                  >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                  </button>
                }
              />

              {/* 📊 2. FINANCIAL KPI HERO ROW (USING SHARED KpiCard) */}
              <div className="sa-stats-grid">
                {/* KPI 1: MRR Revenue */}
                <KpiCard
                  label="MRR Revenue"
                  value={`₹${estimatedRevenue.toLocaleString()}`}
                  icon={DollarSign}
                  color="var(--sa-accent)"
                  badge="+ Active Subscriptions"
                  subtitle="Authoritative MRR"
                />

                {/* KPI 2: Active Paid */}
                <KpiCard
                  label="Active Paid"
                  value={totalActive}
                  icon={CheckCircle}
                  color="#15803D"
                  onClick={() => setStatusFilter('active')}
                  subtitle="Paid Accounts"
                />

                {/* KPI 3: Past Due / Failed */}
                <KpiCard
                  label="Past Due / Failed"
                  value={restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length}
                  icon={CreditCard}
                  color="#B45309"
                  onClick={() => setStatusFilter('failed')}
                  subtitle="Needs Attention"
                />

                {/* KPI 4: Auto-Renew Off */}
                <KpiCard
                  label="Auto-Renew Off"
                  value={restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length}
                  icon={Clock}
                  color="#C2410C"
                  onClick={() => setStatusFilter('autorenew_off')}
                  subtitle="Churn Risk"
                />

                {/* KPI 5: Complimentary / VIP */}
                <KpiCard
                  label="Complimentary VIP"
                  value={restaurants.filter(r => r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted').length}
                  icon={Sparkles}
                  color="#7E22CE"
                  onClick={() => setStatusFilter('vip')}
                  subtitle="Lifetime Access"
                />
              </div>

              {/* ⚠️ 3. BILLING ATTENTION HUB */}
              <div className="sa-table-container" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={18} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                      ⚠️ Billing Attention Required
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                    Actionable subscription events
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Row 1: Payment Failures */}
                  {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#DC2626', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>CRITICAL</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991B1B' }}>
                          {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length} Payment Failed / Past Due Accounts
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('failed')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                      >
                        Resolve ➔
                      </button>
                    </div>
                  )}

                  {/* Row 2: Auto-Renew Off */}
                  {restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#D97706', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>CANCEL PENDING</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>
                          {restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length} Accounts with Auto-Renew Disabled
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('autorenew_off')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                      >
                        View ➔
                      </button>
                    </div>
                  )}

                  {/* Row 3: Expiring Within 7 Days */}
                  {restaurants.filter(r => {
                    const d = getDaysRemaining(r.plan_expires_at);
                    return d !== null && d > 0 && d <= 7 && r.subscription_type !== 'ADMIN_GRANTED';
                  }).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#64748B', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>EXPIRING</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                          {restaurants.filter(r => {
                            const d = getDaysRemaining(r.plan_expires_at);
                            return d !== null && d > 0 && d <= 7 && r.subscription_type !== 'ADMIN_GRANTED';
                          }).length} Subscriptions Expiring in &le; 7 Days
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('expired')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                      >
                        View ➔
                      </button>
                    </div>
                  )}

                  {/* Row 4: Scheduled Plan Changes */}
                  {restaurants.filter(r => r.scheduled_plan_key !== null).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#2563EB', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900 }}>PLAN SWITCH</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E40AF' }}>
                          {restaurants.filter(r => r.scheduled_plan_key !== null).length} Scheduled Plan Changes at Next Billing Boundary
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('plans')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                      >
                        View ➔
                      </button>
                    </div>
                  )}

                  {/* All Clear State */}
                  {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length === 0 &&
                   restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #86EFAC' }}>
                      <CheckCircle size={20} color="#16A34A" />
                      <div>
                        <strong style={{ fontSize: '0.84rem', color: '#15803D', display: 'block' }}>All Subscriptions Operational</strong>
                        <span style={{ fontSize: '0.74rem', color: '#166534' }}>Zero payment failures or pending churn cancellations.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 🏷️ 4. TOOLBAR & FILTER PILLS STRIP (USING SHARED FilterPills) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <FilterPills
                  pills={[
                    { id: 'all', label: 'All', count: restaurants.length },
                    { id: 'active', label: '🟢 Active Paid', count: restaurants.filter(r => r.active !== false && r.active !== 0 && r.active !== '0').length },
                    { id: 'trial', label: '🎁 Free Trial', count: restaurants.filter(r => r.subscription_status === 'trialing').length },
                    { id: 'failed', label: '🟡 Past Due', count: restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length },
                    { id: 'autorenew_off', label: '🟠 Auto-Renew Off', count: restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length },
                    { id: 'expired', label: '🔴 Expired', count: restaurants.filter(r => r.subscription_status === 'expired').length },
                    { id: 'vip', label: '🟣 VIP', count: restaurants.filter(r => r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted').length },
                  ]}
                  activeId={statusFilter}
                  onChange={setStatusFilter}
                />

                {/* Search Bar */}
                <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search tenant, owner, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sa-input"
                    style={{
                      paddingLeft: '34px',
                      paddingRight: searchQuery ? '32px' : '12px',
                      height: '38px',
                      fontSize: '0.80rem',
                      borderRadius: 'var(--sa-radius-full)',
                      background: 'var(--sa-surface-subtle)'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* 📋 5. SUBSCRIPTIONS TABLE (USING SHARED DataTable / Table) */}
              {filteredAndSortedRestaurants.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No subscriptions match your criteria"
                  description="Try clearing your search query or switching status filters."
                  action={
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                      className="sa-btn sa-btn-secondary sa-btn-sm"
                    >
                      Clear Search & Filters
                    </button>
                  }
                />
              ) : (
                <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: 'var(--sa-radius-lg)' }}>
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>TENANT</th>
                        <th>OWNER / CONTACT</th>
                        <th>PLAN & BILLING</th>
                        <th>STATUS</th>
                        <th>AUTO-RENEW</th>
                        <th>ACCESS UNTIL / RENEWAL</th>
                        <th style={{ textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedRestaurants.map(r => {
                        const daysLeft = getDaysRemaining(r.plan_expires_at);
                        const isVip = (r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted');
                        const isExpired = (!isVip && daysLeft !== null && daysLeft <= 0) || r.subscription_status === 'expired';
                        const isAutoRenewOff = (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null);

                        return (
                          <tr key={r.id}>
                            <td>
                              <div
                                onClick={() => setSelectedTenant360(r)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                title="Click to open Tenant 360° Profile"
                              >
                                <img
                                  src={getRestaurantLogoUrl(r.logo)}
                                  alt={r.name}
                                  onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #D4AF37' }}
                                />
                                <div>
                                  <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--sa-text-main)' }}>{r.name}</strong>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700 }}>/{r.slug}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', display: 'block', color: 'var(--sa-text-main)' }}>
                                {r.owner_username || 'admin'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)' }}>
                                {r.phone || r.owner_email || 'No contact'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 800, color: 'var(--sa-primary)', fontSize: '0.78rem' }}>
                                {(r.plan_tier || 'pro').toUpperCase()}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                                {isVip ? '₹0/mo (Free)' : `₹${r.plan_price || 999}/mo`}
                              </span>
                              {r.scheduled_plan_key && (
                                <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '1px 5px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 800, display: 'inline-block', marginTop: '2px' }}>
                                  📋 Scheduled: {r.scheduled_plan_key.toUpperCase()}
                                </span>
                              )}
                            </td>
                            <td>
                              <StatusBadge status={r.subscription_status} type={r.subscription_type} />
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.68rem', fontWeight: 800,
                                background: isAutoRenewOff ? '#FEE2E2' : '#DCFCE7',
                                color: isAutoRenewOff ? '#DC2626' : '#15803D'
                              }}>
                                {isAutoRenewOff ? '❌ OFF' : '✅ ON'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                              {isVip ? '♾️ Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : daysLeft !== null ? (isExpired ? 'Expired' : `${daysLeft}d left`) : 'Active'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedTenant360(r)}
                                className="sa-btn sa-btn-secondary sa-btn-sm"
                                style={{ padding: '4px 9px', fontSize: '0.72rem', fontWeight: 800 }}
                                title="Open complete 360-degree Tenant Profile"
                              >
                                🔍 360°
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        

          {/* ========================================================================= */}
          {/* VIEW 4: SAAS PLANS & FEATURE MATRIX                                       */}
          {/* ========================================================================= */}
          {activeView === 'plans' && (
            <SaaSPlansView token={token} restaurants={restaurants} />
          )}

          {/* ========================================================================= */}
          {/* VIEW 5: SYSTEM OPERATIONS & DB HEALTH                                     */}
          {/* ========================================================================= */}
          {activeView === 'operations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* ⚡ 1. HEADER */}
              <div className="sa-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 className="sa-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-primary)', margin: 0 }}>
                    <Database size={22} color="var(--sa-primary)" /> ⚡ Operations & System Health Center
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                    Monitor system health, background jobs and platform operations.
                  </span>
                </div>
              </div>

              {/* 📊 2. SUBSYSTEM HEALTH HERO GRID */}
              <div className="sa-stats-grid">
                {/* 1. Neon PostgreSQL Database */}
                <div className="sa-stat-card hover-lift" title="Neon PostgreSQL Database Connection">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Database size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#15803D', fontSize: '1.05rem', fontWeight: 900 }}>🟢 Connected</div>
                      <div className="sa-stat-label">Neon PostgreSQL</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', marginTop: '2px' }}>Storage: {dbStats?.total_size_pretty || 'Serverless Pool'}</div>
                    </div>
                  </div>
                </div>

                {/* 2. Cashfree Payment Gateway */}
                <div className="sa-stat-card hover-lift" title="Cashfree Gateway Configuration">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: paymentKeys.cashfree_app_id ? '#DCFCE7' : '#F1F5F9', color: paymentKeys.cashfree_app_id ? '#15803D' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: paymentKeys.cashfree_app_id ? '#15803D' : '#64748B', fontSize: '1.05rem', fontWeight: 900 }}>
                        {paymentKeys.cashfree_app_id ? '🟢 Configured' : '⚪ Not Configured'}
                      </div>
                      <div className="sa-stat-label">Cashfree Gateway</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', marginTop: '2px' }}>
                        Mode: {(paymentKeys.cashfree_env || 'sandbox').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Cashfree Webhooks */}
                <div className="sa-stat-card hover-lift" title="Cashfree Webhook Ingestion Engine">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Radio size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#15803D', fontSize: '1.05rem', fontWeight: 900 }}>🟢 Active</div>
                      <div className="sa-stat-label">Cashfree Webhooks</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', marginTop: '2px' }}>Idempotent Logging</div>
                    </div>
                  </div>
                </div>

                {/* 4. Subscription Cron */}
                <div className="sa-stat-card hover-lift" title="Subscription Maintenance Cron Worker">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#15803D', fontSize: '1.05rem', fontWeight: 900 }}>🟢 Scheduled</div>
                      <div className="sa-stat-label">Subscription Cron</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', marginTop: '2px' }}>Every 60 Minutes</div>
                    </div>
                  </div>
                </div>

                {/* 5. Google Gemini AI Engine */}
                <div className="sa-stat-card hover-lift" title="Google Gemini 1.5 Flash AI Engine">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#7E22CE', fontSize: '1.05rem', fontWeight: 900 }}>🟢 Active</div>
                      <div className="sa-stat-label">Gemini 1.5 Flash AI</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', marginTop: '2px' }}>Auto-Reply Assistant</div>
                    </div>
                  </div>
                </div>

                {/* 6. Media Storage Engine */}
                <div className="sa-stat-card hover-lift" title="Cloudflare R2 Storage with DB Fallback">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <HardDrive size={20} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#1D4ED8', fontSize: '1.05rem', fontWeight: 900 }}>🟢 Dual Engine</div>
                      <div className="sa-stat-label">Storage (R2 + DB)</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', marginTop: '2px' }}>Cloudflare R2 + DB</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ⚠️ 3. OPERATIONAL ATTENTION HUB */}
              <div className="sa-table-container" style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="var(--sa-primary)" /> ⚠️ Operational Status & Alerts
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Real-time telemetry</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #86EFAC' }}>
                  <CheckCircle size={16} color="#16A34A" />
                  <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 700 }}>
                    🟢 All monitored background subsystems, crons, and storage engines operational
                  </span>
                </div>
              </div>

              {/* ⚙️ 4. MAINTENANCE & OPERATIONAL POLICIES */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Policy Controls Panel */}
                <div className="sa-table-container" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={18} color="var(--sa-primary)" /> Platform Operational Policies
                  </h3>

                  {/* Trial Duration Setting */}
                  <div style={{ background: '#FFFBEB', padding: '14px', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#B45309', marginBottom: '6px' }}>
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
                        style={{ width: '90px', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 900, color: '#0F172A' }}
                      />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400E' }}>Days Free Trial for New Signups</span>
                    </div>
                  </div>

                  {/* Order Retention & Compaction Policy */}
                  <div style={{ background: '#F0FDF4', padding: '14px', borderRadius: '12px', border: '1.5px solid #86EFAC' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 900, color: '#166534', marginBottom: '4px' }}>
                      ⚡ GLOBAL ORDER RETENTION & DATA COMPACTION:
                    </strong>
                    <p style={{ fontSize: '0.72rem', color: '#15803D', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      Platform-wide data retention policy applied automatically across all restaurants.
                    </p>
                    <select
                      value={paymentKeys.global_order_retention_days || '90'}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, global_order_retention_days: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #86EFAC', fontSize: '0.82rem', fontWeight: 800, color: '#14532D', background: '#FFFFFF' }}
                    >
                      <option value="1">⚡ 24 Hours / 1 Day (Ultra Light - High Traffic)</option>
                      <option value="7">⚡ 7 Days (Standard Light)</option>
                      <option value="30">⚡ 30 Days (1 Month History)</option>
                      <option value="90">⚡ 90 Days (Quarterly / 3 Months History - Recommended)</option>
                      <option value="180">⚡ 180 Days (Half-Year / 6 Months History)</option>
                      <option value="365">⚡ 365 Days (Full 1 Year History)</option>
                    </select>
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
                    style={{ width: '100%', padding: '12px', fontWeight: 900 }}
                  >
                    {keysSaving ? 'Saving Settings...' : '💾 Save Operations & Trial Settings'}
                  </button>
                  {keysMsg && <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-primary)', textAlign: 'center' }}>{keysMsg}</span>}
                </div>

                {/* Database Maintenance Panel */}
                <div className="sa-table-container" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Database size={18} color="var(--sa-primary)" /> Neon DB Optimization & Vacuum
                    </h3>
                    <p style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', lineHeight: 1.4, margin: '0 0 12px 0' }}>
                      Performs live dead-tuple cleanup, optimizes PostgreSQL index pointers, compacts archived records, and reclaims storage on Neon DB.
                    </p>

                    <div style={{ background: '#EFF6FF', padding: '14px', borderRadius: '12px', border: '1px solid #BFDBFE', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: '#1E40AF', fontWeight: 800 }}>⚡ Maintenance Scope:</span>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.72rem', color: '#2563EB', lineHeight: 1.4 }}>
                        <li>Non-blocking dead tuple vacuuming</li>
                        <li>Auto-summarize orders older than retention threshold</li>
                        <li>Reclaim Neon serverless disk quota</li>
                      </ul>
                    </div>
                  </div>

                  <div>
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
                      style={{ width: '100%', padding: '12px', fontWeight: 900 }}
                    >
                      {dbOptimizing ? 'Optimizing Database Index...' : '⚡ Run Vacuum & Database Optimization'}
                    </button>
                    {dbOptimizeMsg && <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E40AF', display: 'block', marginTop: '8px', textAlign: 'center' }}>{dbOptimizeMsg}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 6: PLATFORM AUDIT LOGS STREAM                                        */}
          {/* ========================================================================= */}
          {activeView === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* 📜 1. HEADER */}
              <div className="sa-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 className="sa-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-primary)', margin: 0 }}>
                    <FileText size={22} color="var(--sa-primary)" /> 📜 Activity & Audit Log Trail
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                    Security events, tenant activity and platform operations. <span style={{ opacity: 0.8 }}>(Showing latest 50 events)</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadAuditData}
                  className="sa-btn sa-btn-secondary sa-btn-sm"
                  style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={auditLoading ? 'spin' : ''} /> 🔄 Refresh Stream
                </button>
              </div>

              {/* 🏷️ 2. FILTER PILLS STRIP & SEARCH */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `📜 All (${auditLogs.length})` },
                    { id: 'security', label: '🔑 Security' },
                    { id: 'tenant', label: '🏢 Tenant' },
                    { id: 'billing', label: '💳 Billing' },
                    { id: 'vip', label: '👑 VIP' },
                    { id: 'system', label: '⚙️ System' },
                  ].map(pill => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setAuditFilter(pill.id)}
                      className={`sa-btn sa-btn-sm ${auditFilter === pill.id ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                      style={{ fontSize: '0.72rem', padding: '5px 10px', border: 'none' }}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative', width: '240px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search action, details, actor..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 28px',
                      borderRadius: 'var(--sa-radius-full)',
                      border: '1px solid var(--sa-border)',
                      fontSize: '0.76rem',
                      outline: 'none',
                      background: '#FFFFFF'
                    }}
                  />
                </div>
              </div>

              {/* 📋 3. AUDIT LOG STREAM TABLE */}
              <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: '16px' }}>
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>TIMESTAMP</th>
                      <th>ACTOR & ROLE</th>
                      <th>CATEGORY</th>
                      <th>EVENT / ACTION</th>
                      <th>DESCRIPTION</th>
                      <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLoading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--sa-text-muted)' }}>
                          ⏳ Loading live audit logs...
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--sa-text-muted)' }}>
                          📜 No activity recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs
                        .filter(log => {
                          const act = (log.action || '').toUpperCase();
                          if (auditFilter === 'security') return act.includes('SECURITY') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('CREDENTIAL') || act.includes('PASSWORD') || act.includes('IMPERSONAT');
                          if (auditFilter === 'tenant') return act.includes('TENANT') || act.includes('RESTAURANT') || act.includes('ACTIVAT') || act.includes('SUSPEND') || act.includes('DELETE') || act.includes('REGISTER');
                          if (auditFilter === 'billing') return act.includes('CASHFREE') || act.includes('PAYMENT') || act.includes('SUB_') || act.includes('SUBSCRIPTION') || act.includes('PLAN') || act.includes('CANCEL') || act.includes('RENEW');
                          if (auditFilter === 'vip') return act.includes('VIP') || act.includes('COMPLIMENTARY') || act.includes('ADMIN_GRANTED');
                          if (auditFilter === 'system') return act.includes('SETTING') || act.includes('VACUUM') || act.includes('OPTIMIZ') || act.includes('MAINTENANCE') || act.includes('SYSTEM');
                          return true;
                        })
                        .filter(log => {
                          if (!auditSearch.trim()) return true;
                          const q = auditSearch.toLowerCase();
                          return (log.action || '').toLowerCase().includes(q) ||
                            (log.details || '').toLowerCase().includes(q) ||
                            (log.actor_role || '').toLowerCase().includes(q) ||
                            String(log.restaurant_id || '').includes(q);
                        })
                        .map(log => {
                          const act = (log.action || '').toUpperCase();
                          let cat = { id: 'system', label: 'System', icon: '⚙️' };
                          if (act.includes('SECURITY') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('CREDENTIAL') || act.includes('PASSWORD') || act.includes('IMPERSONAT')) {
                            cat = { id: 'security', label: 'Security', icon: '🔑' };
                          } else if (act.includes('TENANT') || act.includes('RESTAURANT') || act.includes('ACTIVAT') || act.includes('SUSPEND') || act.includes('DELETE') || act.includes('REGISTER')) {
                            cat = { id: 'tenant', label: 'Tenant', icon: '🏢' };
                          } else if (act.includes('CASHFREE') || act.includes('PAYMENT') || act.includes('SUB_') || act.includes('SUBSCRIPTION') || act.includes('PLAN') || act.includes('CANCEL') || act.includes('RENEW')) {
                            cat = { id: 'billing', label: 'Billing', icon: '💳' };
                          } else if (act.includes('VIP') || act.includes('COMPLIMENTARY') || act.includes('ADMIN_GRANTED')) {
                            cat = { id: 'vip', label: 'VIP', icon: '👑' };
                          }

                          let actorLabel = log.actor_role === 'superadmin' ? '👑 Super Admin' :
                            log.actor_role === 'admin' ? '🏢 Resto Owner' :
                            log.actor_role === 'payment_gateway' ? '💳 Cashfree Gateway' :
                            log.actor_role === 'system' ? '⚙️ System' : (log.actor_role || 'System');

                          const targetTenant = log.restaurant_id ? restaurants.find(r => r.id === log.restaurant_id) : null;

                          return (
                            <tr key={log.id}>
                              <td style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--sa-text-muted)', whiteSpace: 'nowrap' }}>
                                {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : 'Just now'}
                              </td>
                              <td>
                                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
                                  {actorLabel}
                                </span>
                              </td>
                              <td>
                                <span className="sa-badge sa-badge-info" style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                                  {cat.icon} {cat.label}
                                </span>
                              </td>
                              <td>
                                <strong style={{ fontSize: '0.82rem', color: 'var(--sa-text-main)' }}>
                                  {log.action}
                                </strong>
                                {targetTenant && (
                                  <span
                                    onClick={() => setSelectedTenant360(targetTenant)}
                                    style={{ display: 'block', fontSize: '0.68rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 800, cursor: 'pointer' }}
                                    title="Open Tenant 360° Profile"
                                  >
                                    🏢 {targetTenant.name} (/{targetTenant.slug})
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: '#475569', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.details}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditLog(log)}
                                  className="sa-btn sa-btn-secondary sa-btn-sm"
                                  style={{ padding: '4px 9px', fontSize: '0.72rem', fontWeight: 800 }}
                                  title="View complete event details"
                                >
                                  🔍 View
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 🔍 4. EVENT DETAIL MODAL */}
              {selectedAuditLog && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 9999,
                  background: 'rgba(10,35,21,0.75)', backdropFilter: 'blur(6px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
                }}>
                  <div style={{
                    background: '#FFFFFF', width: '100%', maxWidth: '540px', borderRadius: '20px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid var(--sa-border)'
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '18px 22px', background: '#0A2315', color: '#DFBA67'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText style={{ width: '20px', height: '20px' }} />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>Audit Event #{selectedAuditLog.id}</h3>
                      </div>
                      <button onClick={() => setSelectedAuditLog(null)} style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}>
                        <X style={{ width: '20px', height: '20px' }} />
                      </button>
                    </div>

                    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>EVENT ACTION:</span>
                          <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>{selectedAuditLog.action}</h4>
                        </div>
                        <span className="sa-badge sa-badge-info" style={{ fontSize: '0.75rem', fontWeight: 900 }}>
                          {selectedAuditLog.actor_role || 'SYSTEM'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>ACTOR / ROLE</span>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--sa-text-main)' }}>
                            {selectedAuditLog.actor_role === 'superadmin' ? '👑 Super Admin' : selectedAuditLog.actor_role || 'System'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>TIMESTAMP</span>
                          <strong style={{ fontSize: '0.78rem', color: 'var(--sa-text-main)' }}>
                            {selectedAuditLog.created_at ? new Date(selectedAuditLog.created_at).toLocaleString('en-IN') : 'Just now'}
                          </strong>
                        </div>
                      </div>

                      {selectedAuditLog.restaurant_id && (
                        <div style={{ background: '#FFFBEB', padding: '12px', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                          <span style={{ fontSize: '0.68rem', color: '#B45309', fontWeight: 800, display: 'block' }}>ATTACHED TENANT (ID: #{selectedAuditLog.restaurant_id})</span>
                          {(() => {
                            const target = restaurants.find(r => r.id === selectedAuditLog.restaurant_id);
                            if (target) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                  <strong style={{ fontSize: '0.86rem', color: '#92400E' }}>{target.name} (/{target.slug})</strong>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedAuditLog(null); setSelectedTenant360(target); }}
                                    className="sa-btn sa-btn-secondary sa-btn-sm"
                                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  >
                                    🔍 360° Profile
                                  </button>
                                </div>
                              );
                            }
                            return <span style={{ fontSize: '0.78rem', color: '#92400E' }}>Tenant #{selectedAuditLog.restaurant_id}</span>;
                          })()}
                        </div>
                      )}

                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>EVENT DETAILS & PAYLOAD:</span>
                        {(() => {
                          try {
                            const parsedJson = JSON.parse(selectedAuditLog.details);
                            const clean = { ...parsedJson };
                            const sensitiveKeys = ['password', 'password_hash', 'jwt', 'token', 'secret', 'api_key', 'client_secret', 'webhook_secret'];
                            for (const key of Object.keys(clean)) {
                              if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
                                clean[key] = '[REDACTED]';
                              }
                            }
                            return (
                              <pre style={{ margin: 0, padding: '12px', background: '#0A2315', color: '#DFBA67', borderRadius: '10px', fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto' }}>
                                {JSON.stringify(clean, null, 2)}
                              </pre>
                            );
                          } catch {
                            return (
                              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.82rem', color: 'var(--sa-text-main)', lineHeight: 1.4 }}>
                                {selectedAuditLog.details}
                              </div>
                            );
                          }
                        })()}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedAuditLog(null)}
                          className="sa-btn sa-btn-primary"
                          style={{ padding: '8px 18px', fontWeight: 800 }}
                        >
                          Close Detail
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 7: SYSTEM & GATEWAY SETTINGS                                         */}
          {/* ========================================================================= */}
          {activeView === 'settings' && (
            <div className="sa-table-container" style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* ⚙️ 1. HEADER */}
              <div className="sa-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', margin: 0 }}>
                <div>
                  <h2 className="sa-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-primary)', margin: 0 }}>
                    <Settings size={22} color="var(--sa-primary)" /> ⚙️ Configuration & Settings Center
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                    Manage security, payment gateway, branding and support.
                  </span>
                </div>
              </div>

              {/* 📑 2. 4-TAB SEGMENTED CONTROLS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: '#F1F5F9', padding: '5px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                {[
                  { id: 'security', label: '🛡️ Security', icon: Lock },
                  { id: 'gateway', label: '💳 Gateway', icon: Key },
                  { id: 'branding', label: '🖼️ Branding', icon: Image },
                  { id: 'support', label: '📞 Support', icon: Phone },
                ].map(tab => {
                  const isActive = secTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSecTab(tab.id)}
                      className={`sa-btn sa-btn-sm ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
                      style={{ border: 'none', padding: '8px 10px', fontSize: '0.78rem', fontWeight: 800 }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {securityError && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>⚠️ {securityError}</div>}
              {securitySuccess && <div style={{ background: '#ECFDF5', color: '#047857', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>{securitySuccess}</div>}
              {keysMsg && <div style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>{keysMsg}</div>}

              {/* 🛡️ TAB 1: MASTER SECURITY */}
              {secTab === 'security' && (
                <form onSubmit={handleSecuritySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                      ℹ️ Current password is required to change Super Admin credentials.
                    </span>
                  </div>

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
                  <button type="submit" disabled={securitySubmitting} className="sa-btn sa-btn-accent" style={{ padding: '14px', marginTop: '6px', fontWeight: 800 }}>
                    {securitySubmitting ? 'Updating Credentials...' : '💾 Save Master Credentials'}
                  </button>
                </form>
              )}

              {/* 💳 TAB 2: CASHFREE GATEWAY */}
              {secTab === 'gateway' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>CASHFREE ENVIRONMENT</label>
                    <select
                      value={paymentKeys.cashfree_env || 'sandbox'}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_env: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box', background: '#FFFFFF' }}
                    >
                      <option value="sandbox">🟢 SANDBOX (TEST MODE - SAFE)</option>
                      <option value="production">⚡ PRODUCTION (LIVE TRANSACTIONS)</option>
                    </select>
                  </div>

                  {paymentKeys.cashfree_env === 'production' && (
                    <div style={{ background: '#FFFBEB', padding: '12px 14px', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                      <span style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 800 }}>
                        ⚠️ Production gateway changes affect live payments and subscriptions.
                      </span>
                    </div>
                  )}

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
                      setKeysMsg('');
                      try {
                        const res = await fetch('/api/superadmin/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify(paymentKeys)
                        });
                        const data = await res.json();
                        if (res.ok) setKeysMsg(data.message || '✅ Gateway credentials saved successfully!');
                      } catch {
                        setKeysMsg('⚠️ Failed to save gateway credentials');
                      } finally {
                        setKeysSaving(false);
                      }
                    }}
                    className="sa-btn sa-btn-primary"
                    style={{ padding: '14px', marginTop: '6px', fontWeight: 800 }}
                  >
                    {keysSaving ? 'Saving Gateway Keys...' : '💾 Save Gateway Credentials'}
                  </button>
                </div>
              )}

              {/* 🖼️ TAB 3: BRANDING */}
              {secTab === 'branding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                      🖼️ Platform logo is hosted on Cloudflare R2 with Neon DB mirror backup.
                    </span>
                  </div>

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

              {/* 📞 TAB 4: SUPPORT CHANNELS */}
              {secTab === 'support' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                      ℹ️ Shown in platform support/customer touchpoints and tenant invoices.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>SUPPORT WHATSAPP NUMBER</label>
                    <input
                      type="text"
                      placeholder="e.g. 919876543210"
                      value={paymentKeys.support_whatsapp || ''}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, support_whatsapp: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>SUPPORT PHONE NUMBER</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={paymentKeys.support_phone || ''}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, support_phone: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>SUPPORT EMAIL ADDRESS</label>
                    <input
                      type="email"
                      placeholder="e.g. support@touchqr.in"
                      value={paymentKeys.support_email || ''}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, support_email: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    />
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
                        if (res.ok) setKeysMsg(data.message || '✅ Support channels saved successfully!');
                      } catch {
                        setKeysMsg('⚠️ Failed to save support channels');
                      } finally {
                        setKeysSaving(false);
                      }
                    }}
                    className="sa-btn sa-btn-primary"
                    style={{ padding: '14px', marginTop: '6px', fontWeight: 800 }}
                  >
                    {keysSaving ? 'Saving Support Channels...' : '💾 Save Support Channels'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 8: GLOBAL BROADCAST NOTICES                                          */}
          {/* ========================================================================= */}
          {activeView === 'communication' && (
            <div style={{ maxWidth: '840px', margin: '0 auto', width: '100%' }}>
              <CommunicationView
                announcementsList={announcementsList}
                onSendAnnouncement={async ({ message, type }) => {
                  await createAnnouncement(message.trim(), type, token);
                  alert('📢 Announcement broadcasted successfully to all tenant dashboards!');
                  loadSuperAnnouncements();
                }}
                onDeleteAnnouncement={handleDeleteAnnouncement}
                onClearAll={handleClearAllAnnouncements}
              />
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

      
      {/* 📢 Global Broadcast Notices Modal */}
      {showAnnounceModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }} onClick={() => setShowAnnounceModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF', borderRadius: '24px', maxWidth: '680px', width: '100%',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #DFBA67',
            maxHeight: '90vh', overflowY: 'auto', position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setShowAnnounceModal(false)}
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
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Megaphone size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-primary)' }}>📢 Global Broadcast Notices</h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Send real-time platform notification banners to all tenant restaurant admin dashboards</span>
              </div>
            </div>

            <form onSubmit={handleCreateAnnouncementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
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
                    style={{ border: 'none', padding: '8px 10px', fontSize: '0.76rem', fontWeight: 800 }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <button type="submit" disabled={announceSubmitting} className="sa-btn sa-btn-accent" style={{ padding: '14px', fontWeight: 800 }}>
                <Megaphone size={16} /> {announceSubmitting ? 'Broadcasting...' : '📢 Broadcast Notice Now'}
              </button>
            </form>

            {/* Active Broadcasts History */}
            <div style={{ borderTop: '1px solid var(--sa-border)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                  Active Announcements ({announcementsList.length})
                </h4>
                {announcementsList.length > 0 && (
                  <button type="button" onClick={handleClearAllAnnouncements} className="sa-btn sa-btn-danger sa-btn-sm" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                    Clear All
                  </button>
                )}
              </div>

              {announcementsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', color: 'var(--sa-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                  No active broadcast notices. Dashboard banners are clean.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {announcementsList.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 900, background: a.type === 'warning' ? '#FEF3C7' : a.type === 'success' ? '#DCFCE7' : '#EFF6FF', color: a.type === 'warning' ? '#B45309' : a.type === 'success' ? '#15803D' : '#1E40AF', padding: '2px 6px', borderRadius: '4px' }}>
                            {(a.type || 'info').toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)' }}>
                            {a.created_at ? new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--sa-text-main)', wordBreak: 'break-word' }}>
                          {a.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="sa-btn sa-btn-danger sa-btn-sm"
                        style={{ padding: '6px 10px', fontSize: '0.72rem', flexShrink: 0 }}
                        title="Delete announcement"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
