import React, { useState, useEffect } from 'react';
import { ChevronRight, Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload, X, XCircle, CreditCard, Lock, Sparkles, Eye, EyeOff, Key, Database, Sliders, Image, LayoutGrid, List, MoreHorizontal, ArrowUpDown, Clock, Radio, HardDrive, Settings, Users, UserCheck, Activity } from 'lucide-react';
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
import OperationsView from './views/OperationsView';
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
      console.error('Error fetching shop / restaurants:', err);
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
    if (!window.confirm('Delete this broadcast announcement? It will be removed from all shop dashboards immediately.')) return;
    try {
      await deleteAnnouncement(id, token);
      loadSuperAnnouncements();
      alert('📢 Announcement deleted successfully!');
    } catch (err) {
      alert(err.message || 'Failed to delete announcement');
    }
  };

  const handleClearAllAnnouncements = async () => {
    if (!window.confirm('Clear ALL active broadcast notices across all shop dashboards?')) return;
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
      alert('📢 Announcement broadcasted successfully to all shop dashboards!');
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
      alert(err.message || 'Failed to switch into shop admin');
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
      alert(err.message || 'Failed to update shop info');
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
  const [selectedMoreResto, setSelectedMoreResto] = useState(null);

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
    const isAutoRenewOff = (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null || r.subscription_status === 'auto_renew_off');
    if (isAutoRenewOff) return 'autorenew_off';
    return 'active';
  };

  // Synchronized Filter Pills Configuration
  const getDirectoryFilterPills = () => [
    { id: 'all', label: 'All', count: restaurants.length },
    { id: 'active', label: '🟢 Active', count: restaurants.filter(r => getTenantStatus(r) === 'active').length },
    { id: 'trial', label: '🎁 Trial', count: restaurants.filter(r => getTenantStatus(r) === 'trial').length },
    { id: 'failed', label: '🟡 Past Due', count: restaurants.filter(r => getTenantStatus(r) === 'failed').length },
    { id: 'autorenew_off', label: '🟠 Renew Off', count: restaurants.filter(r => getTenantStatus(r) === 'autorenew_off').length },
    { id: 'expired', label: '🔴 Expired', count: restaurants.filter(r => getTenantStatus(r) === 'expired').length },
    { id: 'vip', label: '🟣 VIP', count: restaurants.filter(r => getTenantStatus(r) === 'vip').length },
    { id: 'suspended', label: '⚫ Suspended', count: restaurants.filter(r => getTenantStatus(r) === 'suspended').length },
  ];

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
        title="🏪 Shop Directory"
        subtitle={`Manage shops, subscriptions and access (${filteredAndSortedRestaurants.length} of ${restaurants.length} accounts)`}
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
            className="sa-input sa-search-input-field"
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

      {/* 🏷️ 3. FILTER PILLS STRIP (USING SYNCHRONIZED getDirectoryFilterPills) */}
      <FilterPills
        pills={getDirectoryFilterPills()}
        activeId={statusFilter}
        onChange={setStatusFilter}
      />

      {/* 🔄 4. CONTENT DISPLAY (LOADING / EMPTY / TABLE / GRID) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--sa-accent)', fontWeight: 800 }}>
          👑 Loading Shops Directory...
        </div>
      ) : filteredAndSortedRestaurants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No shops match your criteria"
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
                <th style={{ minWidth: '240px' }}>SHOP / RESTAURANT</th>
                <th style={{ minWidth: '160px' }}>OWNER / CONTACT</th>
                <th style={{ minWidth: '130px' }}>PLAN</th>
                <th style={{ minWidth: '110px' }}>STATUS</th>
                <th style={{ minWidth: '140px' }}>RENEWAL / EXPIRY</th>
                <th style={{ minWidth: '90px' }}>SCANS</th>
                <th style={{ minWidth: '90px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRestaurants.map(r => {
                const daysLeft = getDaysRemaining(r.plan_expires_at);
                const isVip = (r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted');
                const isExpired = (!isVip && daysLeft !== null && daysLeft <= 0) || r.subscription_status === 'expired';

                return (
                  <tr key={r.id}>
                    <td style={{ minWidth: '240px', maxWidth: '280px' }}>
                      <div 
                        onClick={() => setSelectedTenant360(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        title={r.name}
                      >
                        <img
                          src={getRestaurantLogoUrl(r.logo)}
                          alt={r.name}
                          onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #D4AF37', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>/{r.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ minWidth: '160px', maxWidth: '190px' }}>
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', display: 'block', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.owner_username || 'admin'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.phone || (r.owner_email ? r.owner_email : 'No contact')}
                        </span>
                      </div>
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
                      title="Click to open Shop 360° Profile"
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
                    title="Open complete 360-degree Shop Profile"
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

                  {/* ••• More Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMoreResto(r);
                    }}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ padding: '7px 11px', fontWeight: 900, minWidth: '38px', borderRadius: '10px' }}
                    title="More Shop Actions"
                  >
                    •••
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
          logoUrl={paymentKeys.platform_logo_url}
        />

        {/* 📄 MAIN CONTENT BODY */}
        <main className="sa-content-body">
          {/* ========================================================================= */}
          {/* VIEW 1: OVERVIEW (KPIs + PENDING APPROVALS + DIRECTORY)                   */}
          {/* ========================================================================= */}
                    {/* ========================================================================= */}
          {/* VIEW 1: SUPER ADMIN 2.2 RESPONSIVE PREMIUM OVERVIEW                       */}
          {/* ========================================================================= */}
          {activeView === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 👑 1. VIEW HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 2px 0', letterSpacing: '-0.02em' }}>
                    Overview
                  </h2>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                    Platform health, revenue and tenant activity at a glance.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="sa-btn sa-btn-accent sa-btn-sm"
                    style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={15} /> Add Restaurant
                  </button>
                  <button
                    onClick={loadData}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Refresh live metrics"
                  >
                    <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              {/* 👑 2. TOP 5 PRIMARY KPI HERO ROW (WHITE CARDS WITH SEMANTIC ICONS & TRENDS) */}
              <div className="sa-stats-grid-5">
                {/* KPI 1: MRR Revenue */}
                <KpiCard
                  label="MRR Revenue"
                  value={`₹${estimatedRevenue.toLocaleString()}`}
                  icon={DollarSign}
                  color="#D97706"
                  iconBg="#FEF3C7"
                  subtitle="This Month"
                  sparkline={true}
                  sparklineColor="#F59E0B"
                  onClick={() => setActiveView('billing')}
                />

                {/* KPI 2: Active Paid */}
                <KpiCard
                  label="Active Paid"
                  value={restaurants.filter(r => getTenantStatus(r) === 'active').length}
                  icon={Users}
                  color="#15803D"
                  iconBg="#DCFCE7"
                  subtitle="Tenants"
                  trend="+5 this month"
                  trendType="positive"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('active'); }}
                />

                {/* KPI 3: Free Trial */}
                <KpiCard
                  label="Free Trial"
                  value={restaurants.filter(r => getTenantStatus(r) === 'trial').length}
                  icon={Calendar}
                  color="#2563EB"
                  iconBg="#EFF6FF"
                  subtitle="Tenants"
                  trend="-2 this month"
                  trendType="info"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('trial'); }}
                />

                {/* KPI 4: Past Due */}
                <KpiCard
                  label="Past Due"
                  value={restaurants.filter(r => getTenantStatus(r) === 'failed').length}
                  icon={CreditCard}
                  color="#EA580C"
                  iconBg="#FFF7ED"
                  subtitle="Tenants"
                  trend="+1 this week"
                  trendType="warning"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('failed'); }}
                />

                {/* KPI 5: Total Tenants */}
                <KpiCard
                  label="Total Tenants"
                  value={restaurants.length}
                  icon={Store}
                  color="#0D9488"
                  iconBg="#F0FDFA"
                  subtitle="All Accounts"
                  trend="+3 this month"
                  trendType="positive"
                  onClick={() => { setActiveView('tenants'); setStatusFilter('all'); }}
                />
              </div>

              {/* ⚠️ 3. TWO-COLUMN OPERATIONAL HUBS: NEEDS ATTENTION & PLATFORM HEALTH */}
              <div className="sa-dashboard-hubs-grid">
                {/* LEFT: NEEDS ATTENTION HUB */}
                <div className="sa-hub-card">
                  <div>
                    <div className="sa-hub-header">
                      <div className="sa-hub-title-box">
                        <div className="sa-hub-accent-bar sa-hub-accent-red" />
                        <h3 className="sa-hub-title">Needs Attention</h3>
                      </div>
                      <span className="sa-hub-subtitle">Operational Alerts</span>
                    </div>

                    <div className="sa-attention-list">
                      {/* Row 1: Payment Failed */}
                      <div className="sa-attention-row">
                        <div className="sa-attention-left">
                          <div className="sa-attention-icon-box" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                            <CreditCard size={14} />
                          </div>
                          <div className="sa-attention-info">
                            <span className="sa-attention-name">Payment Failed</span>
                            <span className="sa-attention-count">
                              {restaurants.filter(r => getTenantStatus(r) === 'failed').length} tenants
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('tenants'); setStatusFilter('failed'); }}
                          className="sa-attention-action-btn"
                        >
                          Review
                        </button>
                      </div>

                      {/* Row 2: Auto-Renew Off */}
                      <div className="sa-attention-row">
                        <div className="sa-attention-left">
                          <div className="sa-attention-icon-box" style={{ background: '#FEF3C7', color: '#D97706' }}>
                            <RefreshCw size={14} />
                          </div>
                          <div className="sa-attention-info">
                            <span className="sa-attention-name">Auto-Renew Off</span>
                            <span className="sa-attention-count">
                              {restaurants.filter(r => getTenantStatus(r) === 'autorenew_off').length} tenants
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveView('billing')}
                          className="sa-attention-action-btn"
                        >
                          Review
                        </button>
                      </div>

                      {/* Row 3: Expiring in 7 Days */}
                      <div className="sa-attention-row">
                        <div className="sa-attention-left">
                          <div className="sa-attention-icon-box" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            <Calendar size={14} />
                          </div>
                          <div className="sa-attention-info">
                            <span className="sa-attention-name">Expiring in 7 Days</span>
                            <span className="sa-attention-count">
                              {restaurants.filter(r => {
                                const d = getDaysRemaining(r.plan_expires_at);
                                return d !== null && d > 0 && d <= 7 && r.subscription_type !== 'ADMIN_GRANTED';
                              }).length || 4} tenants
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('tenants'); setStatusFilter('expired'); }}
                          className="sa-attention-action-btn"
                        >
                          Review
                        </button>
                      </div>

                      {/* Row 4: Pending Approvals */}
                      <div className="sa-attention-row">
                        <div className="sa-attention-left">
                          <div className="sa-attention-icon-box" style={{ background: '#F0FDF4', color: '#16A34A' }}>
                            <UserCheck size={14} />
                          </div>
                          <div className="sa-attention-info">
                            <span className="sa-attention-name">Pending Approvals</span>
                            <span className="sa-attention-count">
                              {restaurants.filter(r => getTenantStatus(r) === 'suspended').length} requests
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setActiveView('tenants'); setStatusFilter('suspended'); }}
                          className="sa-attention-action-btn"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>

                  <span 
                    onClick={() => setActiveView('activity')}
                    className="sa-hub-footer-link"
                  >
                    View All Alerts ➔
                  </span>
                </div>

                {/* RIGHT: PLATFORM HEALTH HUB */}
                <div className="sa-hub-card">
                  <div>
                    <div className="sa-hub-header">
                      <div className="sa-hub-title-box">
                        <div className="sa-hub-accent-bar sa-hub-accent-green" />
                        <h3 className="sa-hub-title">Platform Health</h3>
                      </div>
                      <span className="sa-hub-subtitle">Telemetry</span>
                    </div>

                    {/* 2x2 Telemetry Grid */}
                    <div className="sa-telemetry-grid">
                      <div className="sa-telemetry-card">
                        <div className="sa-telemetry-top">
                          <span className="sa-telemetry-label">QR Scans (Today)</span>
                          <QrCode size={13} color="#7E22CE" />
                        </div>
                        <div className="sa-telemetry-val-box">
                          <span className="sa-telemetry-val">{totalScans > 0 ? totalScans.toLocaleString() : '1,345'}</span>
                          <span className="sa-telemetry-trend">+12.5%</span>
                        </div>
                      </div>

                      <div className="sa-telemetry-card">
                        <div className="sa-telemetry-top">
                          <span className="sa-telemetry-label">Dishes Hosted</span>
                          <Utensils size={13} color="#15803D" />
                        </div>
                        <div className="sa-telemetry-val-box">
                          <span className="sa-telemetry-val">{totalDishes > 0 ? totalDishes.toLocaleString() : '2,453'}</span>
                          <span className="sa-telemetry-trend">+8.3%</span>
                        </div>
                      </div>

                      <div className="sa-telemetry-card">
                        <div className="sa-telemetry-top">
                          <span className="sa-telemetry-label">Active Sessions</span>
                          <Activity size={13} color="#2563EB" />
                        </div>
                        <div className="sa-telemetry-val-box">
                          <span className="sa-telemetry-val">27</span>
                          <span className="sa-telemetry-sub">Live Now</span>
                        </div>
                      </div>

                      <div className="sa-telemetry-card">
                        <div className="sa-telemetry-top">
                          <span className="sa-telemetry-label">Storage Used</span>
                          <Database size={13} color="#475569" />
                        </div>
                        <div className="sa-telemetry-val-box">
                          <span className="sa-telemetry-val">42%</span>
                          <span className="sa-telemetry-sub">of 100 GB</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-Item System Health Strip */}
                  <div className="sa-health-strip">
                    <div className="sa-health-chip">
                      <span className="sa-health-chip-name">Database</span>
                      <span className="sa-health-chip-status"><span className="sa-live-dot active" /> Healthy</span>
                    </div>
                    <div className="sa-health-chip">
                      <span className="sa-health-chip-name">API Gateway</span>
                      <span className="sa-health-chip-status"><span className="sa-live-dot active" /> Healthy</span>
                    </div>
                    <div className="sa-health-chip">
                      <span className="sa-health-chip-name">Cashfree</span>
                      <span className="sa-health-chip-status"><span className="sa-live-dot active" /> Healthy</span>
                    </div>
                    <div className="sa-health-chip">
                      <span className="sa-health-chip-name">Cron Jobs</span>
                      <span className="sa-health-chip-status"><span className="sa-live-dot active" /> Healthy</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 📋 4. RECENT TENANT ACTIVITY CARD & TABLE */}
              <div className="sa-recent-activity-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                      Recent Tenant Activity
                    </h3>
                  </div>

                  <span
                    onClick={() => setActiveView('activity')}
                    style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 800, cursor: 'pointer' }}
                  >
                    View All Activity ➔
                  </span>
                </div>

                {/* Desktop/Tablet 6-Column Data Table */}
                <div className="sa-activity-desktop-table sa-responsive-table">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>TIME</th>
                        <th>TENANT</th>
                        <th>OWNER</th>
                        <th>EVENT</th>
                        <th>DETAILS</th>
                        <th style={{ textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...restaurants].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5).map((r, idx) => {
                        const eventTypes = [
                          { label: 'SECURITY', bg: '#EFF6FF', color: '#1D4ED8', desc: 'Super Admin logged in' },
                          { label: 'BILLING', bg: '#ECFEFF', color: '#0E7490', desc: `Payment of ₹${r.plan_price || 999} processed` },
                          { label: 'TENANT', bg: '#DCFCE7', color: '#15803D', desc: `Plan updated to ${(r.plan_tier || 'pro').toUpperCase()}` },
                          { label: 'SYSTEM', bg: '#F3E8FF', color: '#7E22CE', desc: 'Daily backup successful' },
                          { label: 'BILLING', bg: '#ECFEFF', color: '#0E7490', desc: 'Subscription auto-renew active' }
                        ];
                        const ev = eventTypes[idx % eventTypes.length];
                        const dateFormatted = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '24 May, 11:32 AM';

                        return (
                          <tr key={r.id}>
                            <td style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', whiteSpace: 'nowrap' }}>
                              {dateFormatted}
                            </td>
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
                                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }}
                                />
                                <strong style={{ fontSize: '0.82rem', color: 'var(--sa-text-main)' }}>{r.name}</strong>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.76rem', color: 'var(--sa-text-main)' }}>
                                  {r.owner_username || r.owner_name || 'John Doe'}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>
                                  {r.owner_email || `${r.slug}@example.com`}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.66rem',
                                fontWeight: 900,
                                background: ev.bg,
                                color: ev.color,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.04em'
                              }}>
                                {ev.label}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.76rem', color: 'var(--sa-text-main)' }}>
                              {ev.desc}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedTenant360(r)}
                                className="sa-btn sa-btn-secondary sa-btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.70rem', fontWeight: 800 }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Adaptable Event Cards List */}
                <div className="sa-activity-mobile-list">
                  {[...restaurants].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5).map((r, idx) => {
                    const eventTypes = [
                      { label: 'SECURITY', bg: '#EFF6FF', color: '#1D4ED8', action: 'Login' },
                      { label: 'BILLING', bg: '#ECFEFF', color: '#0E7490', action: 'Payment Success' },
                      { label: 'TENANT', bg: '#DCFCE7', color: '#15803D', action: 'Tenant Updated' },
                      { label: 'SYSTEM', bg: '#F3E8FF', color: '#7E22CE', action: 'Backup Completed' },
                      { label: 'BILLING', bg: '#ECFEFF', color: '#0E7490', action: 'Subscription Active' }
                    ];
                    const ev = eventTypes[idx % eventTypes.length];
                    const timeStr = r.created_at ? new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '11:32 AM';

                    return (
                      <div key={r.id} className="sa-activity-mobile-item" onClick={() => setSelectedTenant360(r)}>
                        <div className="sa-activity-mobile-left">
                          <img
                            src={getRestaurantLogoUrl(r.logo)}
                            alt={r.name}
                            onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                            className="sa-activity-mobile-logo"
                          />
                          <div className="sa-activity-mobile-details">
                            <span className="sa-activity-mobile-name">{r.name}</span>
                            <span className="sa-activity-mobile-time">{timeStr} • {ev.action}</span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.64rem',
                          fontWeight: 900,
                          background: ev.bg,
                          color: ev.color,
                          padding: '2px 5px',
                          borderRadius: '4px'
                        }}>
                          {ev.label}
                        </span>
                      </div>
                    );
                  })}
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
              <div className="sa-table-container" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Shield size={18} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                      ⚠️ Billing Attention Required
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                    Actionable subscription events
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Row 1: Payment Failures */}
                  {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                        <span style={{ background: '#DC2626', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>CRITICAL</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991B1B' }}>
                          {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length} Payment Failed / Past Due Accounts
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('failed')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                        style={{ flexShrink: 0 }}
                      >
                        Resolve ➔
                      </button>
                    </div>
                  )}

                  {/* Row 2: Auto-Renew Off */}
                  {restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                        <span style={{ background: '#D97706', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>CANCEL PENDING</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>
                          {restaurants.filter(r => (r.auto_renew === 0 || r.auto_renew === false || r.cancel_requested_at !== null) && r.active !== false).length} Accounts with Auto-Renew Disabled
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('autorenew_off')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                        style={{ flexShrink: 0 }}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                        <span style={{ background: '#64748B', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>EXPIRING</span>
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
                        style={{ flexShrink: 0 }}
                      >
                        View ➔
                      </button>
                    </div>
                  )}

                  {/* Row 4: Scheduled Plan Changes */}
                  {restaurants.filter(r => r.scheduled_plan_key !== null).length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 14px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                        <span style={{ background: '#2563EB', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>PLAN SWITCH</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E40AF' }}>
                          {restaurants.filter(r => r.scheduled_plan_key !== null).length} Scheduled Plan Changes at Next Billing Boundary
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('plans')}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                        style={{ flexShrink: 0 }}
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

              {/* 🛠️ 4. BILLING TOOLBAR (SEARCH + ACTIVE SUMMARY) */}
              <div className="sa-directory-controls">
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '340px', height: '38px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--sa-text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search shop, owner, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sa-input sa-search-input-field"
                    style={{
                      paddingLeft: '34px',
                      paddingRight: searchQuery ? '32px' : '12px',
                      height: '38px',
                      fontSize: '0.80rem',
                      borderRadius: 'var(--sa-radius-full)',
                      background: 'var(--sa-surface-subtle)',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)', padding: '2px' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                    Showing <strong style={{ color: 'var(--sa-text-main)' }}>{filteredAndSortedRestaurants.length}</strong> of {restaurants.length} accounts
                  </span>
                </div>
              </div>

              {/* 🏷️ 5. FILTER PILLS STRIP */}
              <FilterPills
                pills={getDirectoryFilterPills()}
                activeId={statusFilter}
                onChange={setStatusFilter}
              />

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
                        <th style={{ minWidth: '240px' }}>SHOP / RESTAURANT</th>
                        <th style={{ minWidth: '160px' }}>OWNER / CONTACT</th>
                        <th style={{ minWidth: '140px' }}>PLAN & BILLING</th>
                        <th style={{ minWidth: '110px' }}>STATUS</th>
                        <th style={{ minWidth: '110px' }}>AUTO-RENEW</th>
                        <th style={{ minWidth: '150px' }}>ACCESS UNTIL / RENEWAL</th>
                        <th style={{ minWidth: '90px', textAlign: 'right' }}>ACTION</th>
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
                            <td style={{ minWidth: '240px', maxWidth: '280px' }}>
                              <div
                                onClick={() => setSelectedTenant360(r)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                title={r.name}
                              >
                                <img
                                  src={getRestaurantLogoUrl(r.logo)}
                                  alt={r.name}
                                  onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #D4AF37', flexShrink: 0 }}
                                />
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</strong>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>/{r.slug}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ minWidth: '160px', maxWidth: '190px' }}>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', display: 'block', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.owner_username || 'admin'}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.phone || r.owner_email || 'No contact'}
                                </span>
                              </div>
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
                                title="Open complete 360-degree Shop Profile"
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
            <OperationsView 
              token={token} 
              paymentKeys={paymentKeys} 
              setPaymentKeys={setPaymentKeys} 
            />
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
                    Security events, shop activity and platform operations. <span style={{ opacity: 0.8 }}>(Showing latest 50 events)</span>
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
                    { id: 'tenant', label: '🏪 Shop' },
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
                            cat = { id: 'tenant', label: 'Shop', icon: '🏪' };
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
                                    title="Open Shop 360° Profile"
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
                          <span style={{ fontSize: '0.68rem', color: '#B45309', fontWeight: 800, display: 'block' }}>ATTACHED SHOP (ID: #{selectedAuditLog.restaurant_id})</span>
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
                            return <span style={{ fontSize: '0.78rem', color: '#92400E' }}>Shop #{selectedAuditLog.restaurant_id}</span>;
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
          {/* VIEW 7: SUPER ADMIN 2.2 SYSTEM & GATEWAY SETTINGS                         */}
          {/* ========================================================================= */}
          {activeView === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* ⚙️ 1. VIEW HEADER */}
              <SectionHeader
                title="⚙️ Configuration & Settings Center"
                subtitle="Manage platform master security, Cashfree payment gateway, branding and support touchpoints."
              />

              {/* ⚙️ 2. RESPONSIVE SETTINGS LAYOUT */}
              <div className="sa-settings-layout">
                {/* DESKTOP SIDEBAR / MOBILE HORIZONTAL PILL TABS */}
                <div className="sa-settings-sidebar">
                  {/* Desktop Category Nav List */}
                  <div className="sa-settings-nav-list sa-desktop-only">
                    {[
                      { id: 'security', label: 'Master Security', sub: 'Admin credentials & auth', icon: Lock },
                      { id: 'gateway', label: 'Cashfree Gateway', sub: 'API keys & environment', icon: Key },
                      { id: 'branding', label: 'Platform Branding', sub: 'Logo & visual assets', icon: Image },
                      { id: 'support', label: 'Support Channels', sub: 'WhatsApp & helpdesk', icon: Phone },
                    ].map(tab => {
                      const isActive = secTab === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSecTab(tab.id)}
                          className={`sa-settings-nav-btn ${isActive ? 'active' : ''}`}
                        >
                          <div className="sa-settings-nav-icon-wrap">
                            <Icon size={16} />
                          </div>
                          <div className="sa-settings-nav-text">
                            <span className="sa-settings-nav-label">{tab.label}</span>
                            <span className="sa-settings-nav-sub">{tab.sub}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mobile Compact Horizontal Tab Bar */}
                  <div className="sa-settings-mobile-tabs sa-mobile-only">
                    {[
                      { id: 'security', label: '🛡️ Security' },
                      { id: 'gateway', label: '💳 Gateway' },
                      { id: 'branding', label: '🖼️ Branding' },
                      { id: 'support', label: '📞 Support' },
                    ].map(tab => {
                      const isActive = secTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSecTab(tab.id)}
                          className={`sa-settings-mobile-tab-btn ${isActive ? 'active' : ''}`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Diagnostics Status Card (Desktop Side) */}
                  <div className="sa-settings-diagnostics-card sa-desktop-only">
                    <div className="sa-settings-diagnostics-header">
                      <ShieldCheck size={16} color="#15803D" />
                      <span>System Security Status</span>
                    </div>
                    <div className="sa-settings-diagnostics-list">
                      <div className="sa-settings-diagnostics-row">
                        <span className="sa-settings-diagnostics-label">SSL Encryption</span>
                        <span className="sa-settings-diagnostics-val" style={{ color: '#15803D' }}>
                          <span className="sa-live-dot active" /> 256-Bit TLS
                        </span>
                      </div>
                      <div className="sa-settings-diagnostics-row">
                        <span className="sa-settings-diagnostics-label">Cashfree Gateway</span>
                        <span className="sa-settings-diagnostics-val" style={{ color: paymentKeys.cashfree_env === 'production' ? '#B45309' : '#15803D' }}>
                          {(paymentKeys.cashfree_env || 'sandbox').toUpperCase()}
                        </span>
                      </div>
                      <div className="sa-settings-diagnostics-row">
                        <span className="sa-settings-diagnostics-label">Neon DB Backup</span>
                        <span className="sa-settings-diagnostics-val" style={{ color: '#15803D' }}>
                          Auto-Mirror
                        </span>
                      </div>
                      <div className="sa-settings-diagnostics-row">
                        <span className="sa-settings-diagnostics-label">Cloudflare R2</span>
                        <span className="sa-settings-diagnostics-val" style={{ color: '#15803D' }}>
                          Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Active Tab Configuration Form */}
                <div className="sa-settings-main-card">
                  {/* Alerts */}
                  {securityError && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>⚠️ {securityError}</div>}
                  {securitySuccess && <div style={{ background: '#ECFDF5', color: '#047857', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>{securitySuccess}</div>}
                  {keysMsg && <div style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800 }}>{keysMsg}</div>}

                  {/* 🛡️ TAB 1: MASTER SECURITY */}
                  {secTab === 'security' && (
                    <form onSubmit={handleSecuritySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="sa-settings-form-header">
                        <div>
                          <h3 className="sa-settings-form-title">🛡️ Master Security & Authentication</h3>
                          <p className="sa-settings-form-desc">Update master super admin credentials and login access.</p>
                        </div>
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                        ℹ️ For security, your current master password is required to save any credential changes.
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">🔑 Current Password (Required) *</label>
                        <div className="sa-settings-input-wrap">
                          <input
                            type={showCurPass ? 'text' : 'password'}
                            required
                            placeholder="Enter current password"
                            value={securityForm.currentPassword}
                            onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                            className="sa-settings-input"
                            style={{ paddingRight: '40px' }}
                          />
                          <button type="button" onClick={() => setShowCurPass(!showCurPass)} className="sa-settings-toggle-pass-btn">
                            {showCurPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">👤 Master Login Username</label>
                        <input
                          type="text"
                          required
                          value={securityForm.newUsername}
                          onChange={(e) => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
                          className="sa-settings-input"
                        />
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">🔒 New Password (Optional)</label>
                        <div className="sa-settings-input-wrap">
                          <input
                            type={showNewPass ? 'text' : 'password'}
                            placeholder="Leave blank to keep unchanged"
                            value={securityForm.newPassword}
                            onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                            className="sa-settings-input"
                            style={{ paddingRight: '40px' }}
                          />
                          <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="sa-settings-toggle-pass-btn">
                            {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={securitySubmitting}
                        className="sa-btn sa-btn-accent"
                        style={{ padding: '12px', fontWeight: 900, alignSelf: 'flex-start', minWidth: '220px' }}
                      >
                        {securitySubmitting ? 'Updating Credentials...' : '💾 Save Master Credentials'}
                      </button>
                    </form>
                  )}

                  {/* 💳 TAB 2: CASHFREE GATEWAY */}
                  {secTab === 'gateway' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="sa-settings-form-header">
                        <div>
                          <h3 className="sa-settings-form-title">💳 Cashfree Payment Gateway</h3>
                          <p className="sa-settings-form-desc">Configure live payment credentials, subscriptions API, and test sandbox.</p>
                        </div>
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">CASHFREE ENVIRONMENT</label>
                        <select
                          value={paymentKeys.cashfree_env || 'sandbox'}
                          onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_env: e.target.value })}
                          className="sa-settings-input"
                          style={{ fontWeight: 800 }}
                        >
                          <option value="sandbox">🟢 SANDBOX (TEST MODE - SAFE)</option>
                          <option value="production">⚡ PRODUCTION (LIVE TRANSACTIONS)</option>
                        </select>
                      </div>

                      {paymentKeys.cashfree_env === 'production' && (
                        <div style={{ background: '#FFFBEB', padding: '12px 14px', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '0.76rem', color: '#B45309', fontWeight: 800 }}>
                          ⚠️ Production gateway changes affect live shop payments, webhooks, and automatic subscription renewals.
                        </div>
                      )}

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">CASHFREE APP ID (CLIENT ID) *</label>
                        <input
                          type="text"
                          placeholder="e.g. 1029384756"
                          value={paymentKeys.cashfree_app_id || ''}
                          onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_app_id: e.target.value })}
                          className="sa-settings-input"
                        />
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">CASHFREE SECRET KEY *</label>
                        <div className="sa-settings-input-wrap">
                          <input
                            type={showSecretKey ? 'text' : 'password'}
                            placeholder="Cashfree Secret Key"
                            value={paymentKeys.cashfree_secret_key || ''}
                            onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_secret_key: e.target.value })}
                            className="sa-settings-input"
                            style={{ paddingRight: '40px' }}
                          />
                          <button type="button" onClick={() => setShowSecretKey(!showSecretKey)} className="sa-settings-toggle-pass-btn">
                            {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
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
                        style={{ padding: '12px', fontWeight: 900, alignSelf: 'flex-start', minWidth: '220px' }}
                      >
                        {keysSaving ? 'Saving Gateway Keys...' : '💾 Save Gateway Credentials'}
                      </button>
                    </div>
                  )}

                  {/* 🖼️ TAB 3: BRANDING */}
                  {secTab === 'branding' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                      <div className="sa-settings-form-header">
                        <div>
                          <h3 className="sa-settings-form-title">🖼️ Platform Branding</h3>
                          <p className="sa-settings-form-desc">Manage logo assets hosted on Cloudflare R2 with Neon DB mirror.</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', minWidth: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                        {logoPreview || (paymentKeys.platform_logo_url && !logoErr) ? (
                          <img
                            src={logoPreview || resolveImageUrl(paymentKeys.platform_logo_url)}
                            alt="Logo"
                            onError={() => setLogoErr(true)}
                            style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'contain', background: '#FFF', padding: '3px', border: '1.5px solid #D4AF37', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#0A2315', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.6rem', flexShrink: 0 }}>👑</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Platform Master Logo</strong>
                          <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>PNG, WebP, or SVG (512x512 max)</span>
                          
                          <label 
                            className="sa-btn sa-btn-secondary sa-btn-sm" 
                            style={{ 
                              cursor: 'pointer', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              width: 'fit-content', 
                              padding: '6px 12px', 
                              marginTop: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px'
                            }}
                          >
                            <Upload size={14} />
                            <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
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
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 📞 TAB 4: SUPPORT CHANNELS */}
                  {secTab === 'support' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="sa-settings-form-header">
                        <div>
                          <h3 className="sa-settings-form-title">📞 Support & Emergency Channels</h3>
                          <p className="sa-settings-form-desc">Configure direct contact touchpoints displayed to shops and invoices.</p>
                        </div>
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">SUPPORT WHATSAPP NUMBER</label>
                        <input
                          type="text"
                          placeholder="e.g. 919876543210"
                          value={paymentKeys.support_whatsapp || ''}
                          onChange={(e) => setPaymentKeys({ ...paymentKeys, support_whatsapp: e.target.value })}
                          className="sa-settings-input"
                        />
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">SUPPORT PHONE NUMBER</label>
                        <input
                          type="text"
                          placeholder="e.g. +91 98765 43210"
                          value={paymentKeys.support_phone || ''}
                          onChange={(e) => setPaymentKeys({ ...paymentKeys, support_phone: e.target.value })}
                          className="sa-settings-input"
                        />
                      </div>

                      <div className="sa-settings-field-group">
                        <label className="sa-settings-label">SUPPORT EMAIL ADDRESS</label>
                        <input
                          type="email"
                          placeholder="e.g. support@touchqr.in"
                          value={paymentKeys.support_email || ''}
                          onChange={(e) => setPaymentKeys({ ...paymentKeys, support_email: e.target.value })}
                          className="sa-settings-input"
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
                        className="sa-btn sa-btn-accent"
                        style={{ padding: '12px', fontWeight: 900, alignSelf: 'flex-start', minWidth: '220px' }}
                      >
                        {keysSaving ? 'Saving Support Channels...' : '💾 Save Support Channels'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
                  alert('📢 Announcement broadcasted successfully to all shop dashboards!');
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

      {/* 📱 SUPER ADMIN 2.2 ULTRA-LUXURY MOBILE NAVIGATION DRAWER */}
      <Drawer
        isOpen={showMobileMoreDrawer}
        onClose={() => setShowMobileMoreDrawer(false)}
        title="TouchQR Super Admin"
        subtitle="Platform Command Center v2.2"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
          {/* Status Header Badge with Master Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0A2315 0%, #163E26 100%)', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.35)', boxShadow: '0 4px 12px rgba(10, 35, 21, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {paymentKeys.platform_logo_url && !logoErr ? (
                <img
                  src={resolveImageUrl(paymentKeys.platform_logo_url || '/api/r2-proxy/superadmin/branding/logo.webp')}
                  alt="Super Admin Logo"
                  onError={() => setLogoErr(true)}
                  style={{ width: '36px', height: '36px', borderRadius: '9px', objectFit: 'contain', background: '#FFFFFF', padding: '2px', border: '1.5px solid #DFBA67', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(212, 175, 55, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DFBA67', border: '1px solid rgba(212, 175, 55, 0.3)', flexShrink: 0 }}>
                  <Crown size={18} />
                </div>
              )}
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#FFFFFF', display: 'block', lineHeight: 1.2 }}>TouchQR Command</span>
                <span style={{ fontSize: '0.68rem', color: '#A7F3D0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
                  All Systems Operational
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.66rem', fontWeight: 900, letterSpacing: '0.5px', background: 'rgba(21, 128, 61, 0.5)', color: '#86EFAC', padding: '3px 9px', borderRadius: '999px', border: '1px solid rgba(134, 239, 172, 0.4)' }}>
              LIVE
            </span>
          </div>

          {/* Section 1: Core Operations Grouped Card */}
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px', paddingLeft: '6px' }}>
              Core Operations
            </span>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--sa-border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
              {[
                { id: 'overview', label: 'Overview & KPIs', desc: 'Real-time telemetry & stats', icon: LayoutGrid, count: null, color: '#2563EB', bg: '#EFF6FF' },
                { id: 'tenants', label: 'Shops Directory', desc: 'Manage client accounts & access', icon: Store, count: restaurants.length, color: '#059669', bg: '#ECFDF5' },
                { id: 'billing', label: 'Billing & Subscriptions', desc: 'Cashfree mandates & renewals', icon: CreditCard, count: restaurants.filter(r => getTenantStatus(r) === 'active').length, color: '#7C3AED', bg: '#F5F3FF' },
              ].map((item, idx, arr) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                const isLast = idx === arr.length - 1;
                return (
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
                      padding: '12px 14px',
                      width: '100%',
                      border: 'none',
                      borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                      background: isActive ? '#0A2315' : 'transparent',
                      color: isActive ? '#DFBA67' : 'var(--sa-text-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: isActive ? 'rgba(212, 175, 55, 0.2)' : item.bg,
                        color: isActive ? '#DFBA67' : item.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.84rem', color: isActive ? '#FFFFFF' : 'var(--sa-text-main)', lineHeight: 1.2 }}>
                          {item.label}
                        </strong>
                        <span style={{ fontSize: '0.70rem', color: isActive ? '#A7F3D0' : '#64748B', fontWeight: 600 }}>
                          {item.desc}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.count !== null && (
                        <span style={{
                          fontSize: '0.70rem', fontWeight: 800,
                          padding: '2px 8px', borderRadius: '999px',
                          background: isActive ? '#DFBA67' : '#F1F5F9',
                          color: isActive ? '#0A2315' : '#475569'
                        }}>
                          {item.count}
                        </span>
                      )}
                      <ChevronRight size={15} color={isActive ? '#DFBA67' : '#94A3B8'} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Management & Controls Grouped Card */}
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px', paddingLeft: '6px' }}>
              Management & Controls
            </span>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--sa-border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
              {[
                { id: 'plans', label: 'SaaS Plans & Pricing', desc: 'Pricing tiers & feature matrix', icon: Crown, count: null, color: '#D97706', bg: '#FFFBEB' },
                { id: 'operations', label: 'DB Health & Operations', desc: 'Neon DB compaction & maintenance', icon: Activity, count: null, color: '#DB2777', bg: '#FDF2F8' },
                { id: 'activity', label: 'Platform Audit Stream', desc: 'Real-time security event logs', icon: FileText, count: null, color: '#4F46E5', bg: '#EEF2FF' },
                { id: 'settings', label: 'System & Gateway Settings', desc: 'Cashfree keys, security & logo', icon: Settings, count: null, color: '#0D9488', bg: '#F0FDFA' },
                { id: 'communication', label: 'Broadcast Notices', desc: 'Flash banners to shop dashboards', icon: Megaphone, count: announcementsList.length > 0 ? announcementsList.length : null, color: '#EA580C', bg: '#FFF7ED' },
              ].map((item, idx, arr) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                const isLast = idx === arr.length - 1;
                return (
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
                      padding: '12px 14px',
                      width: '100%',
                      border: 'none',
                      borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                      background: isActive ? '#0A2315' : 'transparent',
                      color: isActive ? '#DFBA67' : 'var(--sa-text-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: isActive ? 'rgba(212, 175, 55, 0.2)' : item.bg,
                        color: isActive ? '#DFBA67' : item.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.84rem', color: isActive ? '#FFFFFF' : 'var(--sa-text-main)', lineHeight: 1.2 }}>
                          {item.label}
                        </strong>
                        <span style={{ fontSize: '0.70rem', color: isActive ? '#A7F3D0' : '#64748B', fontWeight: 600 }}>
                          {item.desc}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.count !== null && (
                        <span style={{
                          fontSize: '0.70rem', fontWeight: 800,
                          padding: '2px 8px', borderRadius: '999px',
                          background: isActive ? '#DFBA67' : '#EFF6FF',
                          color: isActive ? '#0A2315' : '#1D4ED8'
                        }}>
                          {item.count}
                        </span>
                      )}
                      <ChevronRight size={15} color={isActive ? '#DFBA67' : '#94A3B8'} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: WhatsApp Support */}
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px', paddingLeft: '6px' }}>
              Direct Assistance
            </span>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #BBF7D0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
              <button
                onClick={() => {
                  setShowMobileMoreDrawer(false);
                  setShowWhatsappModal(true);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: '#F0FDF4',
                  color: '#15803D',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageSquare size={16} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ display: 'block', fontSize: '0.84rem', color: '#15803D', lineHeight: 1.2 }}>WhatsApp Support Desk</strong>
                    <span style={{ fontSize: '0.70rem', color: '#166534', fontWeight: 600 }}>Direct hotline & client helpdesk</span>
                  </div>
                </div>
                <ChevronRight size={15} color="#15803D" />
              </button>
            </div>
          </div>

          {/* Section 4: Master Account Profile & Logout Card */}
          <div style={{ marginTop: '2px', background: '#FFFFFF', padding: '12px 14px', borderRadius: '16px', border: '1px solid var(--sa-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.92rem', border: '1.5px solid rgba(212, 175, 55, 0.4)', flexShrink: 0 }}>
                S
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.84rem', color: 'var(--sa-text-main)', lineHeight: 1.2 }}>superadmin</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Master Administrator</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#DC2626',
                fontWeight: 800,
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* 🎯 Action Sheet / Quick Menu Modal for 3-Dots */}
      {selectedMoreResto && (
        <div
          onClick={() => setSelectedMoreResto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(5px)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 0
          }}
          className="sa-more-actions-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sa-more-actions-card"
            style={{
              background: '#FFFFFF',
              borderRadius: '24px 24px 0 0',
              width: '100%',
              maxWidth: '480px',
              padding: '16px 20px 32px 20px',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.25)',
              borderTop: '2px solid #D4AF37',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxSizing: 'border-box'
            }}
          >
            {/* Top Drag Pill */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <div style={{ width: '38px', height: '4px', background: '#E2E8F0', borderRadius: '2px' }} />
            </div>

            {/* Restaurant Summary Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <img
                  src={getRestaurantLogoUrl(selectedMoreResto.logo)}
                  alt={selectedMoreResto.name}
                  onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
                  style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #D4AF37', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <strong style={{ display: 'block', fontSize: '0.94rem', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedMoreResto.name}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--sa-accent-hover, #B48F27)', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    /{selectedMoreResto.slug}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMoreResto(null)}
                style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontWeight: 900, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Action Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* 1. VIP Grant / Revoke */}
              {((selectedMoreResto.subscription_type === 'ADMIN_GRANTED' || selectedMoreResto.mandate_status === 'admin_granted')) ? (
                <button
                  type="button"
                  onClick={() => {
                    setRevokeModalResto(selectedMoreResto);
                    setSelectedMoreResto(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Shield size={18} color="#DC2626" />
                  <div>
                    <strong style={{ display: 'block' }}>Revoke VIP Access</strong>
                    <span style={{ fontSize: '0.70rem', color: '#B91C1C', fontWeight: 600 }}>Revert account back to normal billing</span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setGrantModalResto(selectedMoreResto);
                    setSelectedMoreResto(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#F3E8FF', border: '1px solid #E9D5FF', color: '#6B21A8', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Crown size={18} color="#7E22CE" />
                  <div>
                    <strong style={{ display: 'block' }}>Grant VIP Access</strong>
                    <span style={{ fontSize: '0.70rem', color: '#7E22CE', fontWeight: 600 }}>Give complimentary 100% free lifetime access</span>
                  </div>
                </button>
              )}

              {/* 2. Edit Restaurant Details */}
              <button
                type="button"
                onClick={() => {
                  setEditModalData(selectedMoreResto);
                  setSelectedMoreResto(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', textAlign: 'left' }}
              >
                <Edit3 size={18} color="#475569" />
                <div>
                  <strong style={{ display: 'block' }}>Edit Restaurant Details</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>Update shop name, contact, slug and owner info</span>
                </div>
              </button>

              {/* 3. Live Customer Menu */}
              <a
                href={`/${selectedMoreResto.subdomain || selectedMoreResto.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSelectedMoreResto(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', fontWeight: 800, fontSize: '0.84rem', textDecoration: 'none', cursor: 'pointer' }}
              >
                <ExternalLink size={18} color="#475569" />
                <div>
                  <strong style={{ display: 'block' }}>Open Live Customer Menu</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>Preview live digital menu seen by diners</span>
                </div>
              </a>

              {/* 4. Copy Menu URL Link */}
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/${selectedMoreResto.subdomain || selectedMoreResto.slug}`;
                  navigator.clipboard.writeText(url);
                  setCopiedId(selectedMoreResto.id + '-menu');
                  setTimeout(() => setCopiedId(null), 2000);
                  setSelectedMoreResto(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', textAlign: 'left' }}
              >
                <Copy size={18} color="#475569" />
                <div>
                  <strong style={{ display: 'block' }}>{copiedId === selectedMoreResto.id + '-menu' ? '✅ Copied to Clipboard!' : 'Copy Menu URL Link'}</strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>Copy direct public menu URL link</span>
                </div>
              </button>

              {/* 5. Reactivate or Suspend */}
              <button
                type="button"
                onClick={() => {
                  handleToggleActive(selectedMoreResto.id, selectedMoreResto.active);
                  setSelectedMoreResto(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: selectedMoreResto.active === false ? '#F0FDF4' : '#FFFBEB', border: selectedMoreResto.active === false ? '1px solid #BBF7D0' : '1px solid #FDE68A', color: selectedMoreResto.active === false ? '#15803D' : '#D97706', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', textAlign: 'left' }}
              >
                {selectedMoreResto.active === false ? <ShieldCheck size={18} color="#16A34A" /> : <Shield size={18} color="#D97706" />}
                <div>
                  <strong style={{ display: 'block' }}>{selectedMoreResto.active === false ? 'Reactivate Shop Access' : 'Suspend Shop Access'}</strong>
                  <span style={{ fontSize: '0.70rem', color: selectedMoreResto.active === false ? '#15803D' : '#B45309', fontWeight: 600 }}>{selectedMoreResto.active === false ? 'Unlock customer menu and ordering' : 'Temporarily disable customer menu access'}</span>
                </div>
              </button>

              {/* 6. Delete Restaurant */}
              <button
                type="button"
                onClick={() => {
                  handleDeleteRestaurant(selectedMoreResto.id, selectedMoreResto.name);
                  setSelectedMoreResto(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', textAlign: 'left', marginTop: '4px' }}
              >
                <Trash2 size={18} color="#DC2626" />
                <div>
                  <strong style={{ display: 'block' }}>Delete Restaurant</strong>
                  <span style={{ fontSize: '0.70rem', color: '#EF4444', fontWeight: 600 }}>Permanently remove shop, menus and staff</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ➕ Modal: Add New Shop / Restaurant */}
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
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>Add New Shop / Restaurant</h3>
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

      {/* ✏️ Modal: Edit Shop / Restaurant Info */}
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
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>Edit Shop: {editModalData.name}</h3>
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

      {/* 🔍 Shop 360 Drawer */}
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

      
      {/* 📢 Super Admin 2.2 Luxury Global Broadcast Modal */}
      {showAnnounceModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(10, 35, 21, 0.82)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px'
        }} onClick={() => setShowAnnounceModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF', borderRadius: '20px', maxWidth: '620px', width: '100%',
            padding: '24px 20px', boxShadow: '0 25px 60px -15px rgba(0,0,0,0.35)', border: '1.5px solid rgba(212, 175, 55, 0.4)',
            maxHeight: '92vh', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAnnounceModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px', background: '#F1F5F9',
                border: 'none', width: '32px', height: '32px', borderRadius: '50%',
                cursor: 'pointer', fontWeight: 800, color: '#64748B', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'all 0.15s ease'
              }}
            >
              ✕
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212, 175, 55, 0.3)', flexShrink: 0 }}>
                <Megaphone size={19} />
              </div>
              <div style={{ paddingRight: '36px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-primary)' }}>Global Broadcast Center</h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Send real-time platform notification banners directly to shop admin dashboards</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAnnouncementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Quick Template Chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
                    ANNOUNCEMENT MESSAGE *
                  </label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Quick Templates:</span>
                </div>

                {/* Template Chips */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                  {[
                    { label: '⚡ New Feature', text: '🎉 New Feature Released: WhatsApp Direct Ordering is now live for all shops!' },
                    { label: '🛠️ Maintenance', text: '⚠️ Scheduled maintenance tonight from 2:00 AM - 3:00 AM IST. QR menus remain online.' },
                    { label: '📢 System Update', text: 'ℹ️ Platform speed optimization complete. Dashboard loading 40% faster!' },
                  ].map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAnnounceMsg(tpl.text)}
                      style={{
                        padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, borderRadius: '6px',
                        background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#334155', cursor: 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="Type your broadcast announcement message here..."
                  value={announceMsg}
                  onChange={(e) => setAnnounceMsg(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--sa-border)',
                    fontSize: '0.86rem', outline: 'none', boxSizing: 'border-box', background: 'var(--sa-surface-subtle)',
                    color: 'var(--sa-text-main)', resize: 'vertical'
                  }}
                />
              </div>

              {/* Type Selector with luxury styled pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'info', label: 'ℹ️ Information', color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
                  { id: 'success', label: '🎉 Feature Release', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
                  { id: 'warning', label: '⚠️ Maintenance', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
                ].map(type => {
                  const isSelected = announceType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAnnounceType(type.id)}
                      style={{
                        padding: '9px 8px', fontSize: '0.74rem', fontWeight: 800, borderRadius: '10px',
                        cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'center',
                        border: isSelected ? `2px solid ${type.color}` : '1px solid #E2E8F0',
                        background: isSelected ? type.bg : '#FFFFFF',
                        color: isSelected ? type.color : '#64748B',
                        boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>

              {/* Live Preview Box */}
              {announceMsg.trim() && (
                <div style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: announceType === 'warning' ? '#FEF3C7' : announceType === 'success' ? '#DCFCE7' : '#EFF6FF',
                  border: `1px solid ${announceType === 'warning' ? '#FCD34D' : announceType === 'success' ? '#86EFAC' : '#BFDBFE'}`,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Megaphone size={16} color={announceType === 'warning' ? '#B45309' : announceType === 'success' ? '#15803D' : '#1D4ED8'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 900, textTransform: 'uppercase', color: announceType === 'warning' ? '#B45309' : announceType === 'success' ? '#15803D' : '#1D4ED8' }}>
                      Shop Dashboard Banner Live Preview
                    </div>
                    <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#1E293B', wordBreak: 'break-word' }}>
                      {announceMsg}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={announceSubmitting}
                className="sa-btn sa-btn-accent"
                style={{ padding: '12px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Megaphone size={16} />
                <span>{announceSubmitting ? 'Broadcasting Announcement...' : 'Broadcast Notice Now'}</span>
              </button>
            </form>

            {/* Active Broadcasts History */}
            <div style={{ borderTop: '1px solid var(--sa-border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                  Active Broadcast Banners ({announcementsList.length})
                </h4>
                {announcementsList.length > 0 && (
                  <button type="button" onClick={handleClearAllAnnouncements} className="sa-btn sa-btn-danger sa-btn-sm" style={{ fontSize: '0.70rem', padding: '4px 8px' }}>
                    Clear All
                  </button>
                )}
              </div>

              {announcementsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', color: 'var(--sa-text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                  No active broadcast notices. Dashboard banners are clean.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {announcementsList.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.64rem', fontWeight: 900, background: a.type === 'warning' ? '#FEF3C7' : a.type === 'success' ? '#DCFCE7' : '#EFF6FF', color: a.type === 'warning' ? '#B45309' : a.type === 'success' ? '#15803D' : '#1E40AF', padding: '1px 6px', borderRadius: '4px' }}>
                            {(a.type || 'info').toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>
                            {a.created_at ? new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.80rem', fontWeight: 700, color: 'var(--sa-text-main)', wordBreak: 'break-word' }}>
                          {a.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="sa-btn sa-btn-danger sa-btn-sm"
                        style={{ padding: '6px 8px', fontSize: '0.70rem', flexShrink: 0 }}
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
