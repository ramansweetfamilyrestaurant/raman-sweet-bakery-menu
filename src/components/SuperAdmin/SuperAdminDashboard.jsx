import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload, X, XCircle, CreditCard, Lock, Sparkles, Eye, EyeOff, Key, Database, Sliders, Image, LayoutGrid, List, MoreHorizontal, ArrowUpDown } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={() => setOpenMoreId(null)}>
      {/* 🛠️ Compact Directory Controls Bar */}
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
          <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-primary)', margin: 0 }}>
            Tenant Restaurants Directory ({filteredAndSortedRestaurants.length})
          </h2>
          <p style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', margin: '2px 0 0 0', fontWeight: 600 }}>
            Monitor and manage all onboarded restaurant tenant accounts
          </p>
        </div>

        <div className="sa-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div className="sa-search-box" style={{ position: 'relative', width: '210px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
            <input
              type="text"
              placeholder="Search name, slug, owner, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 28px',
                borderRadius: 'var(--sa-radius-full)',
                border: '1px solid var(--sa-border)',
                fontSize: '0.76rem',
                outline: 'none',
                background: 'var(--sa-surface-subtle)'
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--sa-radius-full)',
                border: '1px solid var(--sa-border)',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: 'var(--sa-text-main)',
                background: 'var(--sa-surface-subtle)',
                outline: 'none',
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

          {/* Grid / Table Toggle (Hidden on <= 767px via CSS) */}
          <div className="sa-view-toggle" style={{ display: 'flex', background: 'var(--sa-surface-subtle)', padding: '2px', borderRadius: 'var(--sa-radius-full)', border: '1px solid var(--sa-border)' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: 'var(--sa-radius-full)',
                padding: '5px 9px',
                fontSize: '0.74rem',
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
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: 'var(--sa-radius-full)',
                padding: '5px 9px',
                fontSize: '0.74rem',
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

          <button
            onClick={loadData}
            title="Refresh Directory"
            className="sa-btn sa-btn-secondary sa-btn-sm"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="sa-btn sa-btn-accent sa-btn-sm"
            style={{ fontWeight: 900 }}
          >
            <Plus size={14} /> Add Restaurant
          </button>
        </div>
      </div>

      {/* 🏷️ Filter Pills Strip */}
      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `All (${restaurants.length})` },
          { id: 'active', label: '🟢 Active' },
          { id: 'trial', label: '🎁 Trial' },
          { id: 'failed', label: '🟡 Payment Failed' },
          { id: 'autorenew_off', label: '🟠 Auto-Renew Off' },
          { id: 'expired', label: '🔴 Expired' },
          { id: 'vip', label: '🟣 VIP' },
          { id: 'suspended', label: '⚫ Suspended' },
        ].map(pill => {
          const isActive = statusFilter === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`sa-btn sa-btn-sm ${isActive ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ flexShrink: 0, fontSize: '0.72rem', padding: '5px 10px', border: 'none' }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* 🔄 Loading / Empty / Content Views */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--sa-accent)', fontWeight: 800 }}>
          👑 Loading Tenant Restaurants Directory...
        </div>
      ) : filteredAndSortedRestaurants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed var(--sa-border)' }}>
          <Store size={44} color="var(--sa-text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 6px 0' }}>No tenants match your criteria</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)', margin: 0 }}>Try clearing your search query or switching filters.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* 📊 TABLE VIEW */
        <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: '16px' }}>
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
                    <td>{renderStatusBadge(r)}</td>
                    <td style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                      {isVip ? '♾️ Lifetime' : daysLeft !== null ? (isExpired ? 'Expired' : `${daysLeft}d left`) : 'Active'}
                    </td>
                    <td style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7E22CE' }}>
                      📲 {r.scan_count || 0}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => setSelectedTenant360(r)}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 800 }}
                          title="Open 360° Profile"
                        >
                          🔍 360°
                        </button>
                        <button
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
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '16px',
                  border: r.active !== false ? '1px solid var(--sa-border)' : '1.5px solid #FCA5A5',
                  boxShadow: 'var(--sa-shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  position: 'relative'
                }}
              >
                {/* 1. Header: Avatar, Title, Slug & Semantic Status Badge */}
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
                      {renderStatusBadge(r)}
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
                    borderRadius: '12px',
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
                    onClick={() => setSelectedTenant360(r)}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ fontWeight: 800, fontSize: '0.75rem', padding: '7px 10px', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    title="Open complete 360-degree Tenant Profile"
                  >
                    <Search size={13} /> 360° Profile
                  </button>

                  <button
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
                          border: '1px solid var(--sa-border)',
                          boxShadow: 'var(--sa-shadow-lg)',
                          padding: '6px',
                          minWidth: '180px',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <button
                          onClick={() => { setOpenMoreId(null); setEditModalData(r); }}
                          className="sa-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px' }}
                        >
                          <Edit3 size={13} color="#64748B" /> Edit Tenant
                        </button>

                        <button
                          onClick={() => {
                            setOpenMoreId(null);
                            if (r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted') {
                              setRevokeModalResto(r);
                            } else {
                              setGrantModalResto(r);
                            }
                          }}
                          className="sa-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', color: '#7E22CE' }}
                        >
                          <Sparkles size={13} /> {r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted' ? 'Revoke VIP Access' : 'Grant VIP Access'}
                        </button>

                        <a
                          href={`/${r.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpenMoreId(null)}
                          className="sa-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', textDecoration: 'none', color: 'var(--sa-text-main)' }}
                        >
                          <ExternalLink size={13} color="#64748B" /> Preview Public Menu
                        </a>

                        <button
                          onClick={() => {
                            setOpenMoreId(null);
                            navigator.clipboard.writeText(r.slug);
                            alert(`Copied slug: /${r.slug}`);
                          }}
                          className="sa-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px' }}
                        >
                          <Copy size={13} color="#64748B" /> Copy Slug
                        </button>

                        <button
                          onClick={() => {
                            setOpenMoreId(null);
                            handleToggleActive(r.id, r.active);
                          }}
                          className="sa-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', borderRadius: '6px', color: r.active !== false ? '#D97706' : '#16A34A' }}
                        >
                          {r.active !== false ? <XCircle size={13} /> : <CheckCircle size={13} />} {r.active !== false ? 'Suspend Account' : 'Reactivate Account'}
                        </button>

                        <div style={{ height: '1px', background: 'var(--sa-border)', margin: '4px 0' }} />

                        <button
                          onClick={() => { setOpenMoreId(null); handleDeleteRestaurant(r.id, r.name); }}
                          className="sa-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', borderRadius: '6px', color: '#DC2626' }}
                        >
                          <Trash2 size={13} color="#DC2626" /> Delete Restaurant
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 👑 1. TOP 5 PRIMARY KPI HERO CARDS */}
              <div className="sa-stats-grid">
                {/* KPI 1: MRR Revenue */}
                <div
                  onClick={() => setActiveView('billing')}
                  className="sa-stat-card hover-lift"
                  style={{ background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#FFFFFF', border: '1.5px solid #DFBA67', cursor: 'pointer' }}
                  title="Click to view Billing & Subscription Management"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <DollarSign size={22} color="#0A2315" />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#DFBA67', fontSize: '1.45rem', fontWeight: 900 }}>₹{estimatedRevenue.toLocaleString()}</div>
                      <div className="sa-stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>MRR Revenue</div>
                    </div>
                  </div>
                </div>

                {/* KPI 2: Active Paid Tenants */}
                <div
                  onClick={() => { setActiveView('tenants'); setStatusFilter('active'); }}
                  className="sa-stat-card hover-lift"
                  style={{ cursor: 'pointer' }}
                  title="Click to filter Active Paid Tenants"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle size={22} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#15803D', fontSize: '1.45rem', fontWeight: 900 }}>{totalActive}</div>
                      <div className="sa-stat-label">Active Paid</div>
                    </div>
                  </div>
                </div>

                {/* KPI 3: Free Trial Accounts */}
                <div
                  onClick={() => { setActiveView('tenants'); setStatusFilter('trial'); }}
                  className="sa-stat-card hover-lift"
                  style={{ cursor: 'pointer' }}
                  title="Click to filter Free Trial Accounts"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar size={22} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#1D4ED8', fontSize: '1.45rem', fontWeight: 900 }}>
                        {restaurants.filter(r => r.subscription_status === 'trialing' || (r.trial_ends_at && new Date(r.trial_ends_at) > new Date())).length}
                      </div>
                      <div className="sa-stat-label">Free Trial</div>
                    </div>
                  </div>
                </div>

                {/* KPI 4: Past Due / Payment Failed */}
                <div
                  onClick={() => { setActiveView('tenants'); setStatusFilter('failed'); }}
                  className="sa-stat-card hover-lift"
                  style={{ cursor: 'pointer' }}
                  title="Click to view Payment Failed Accounts"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CreditCard size={22} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: '#B45309', fontSize: '1.45rem', fontWeight: 900 }}>
                        {restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length}
                      </div>
                      <div className="sa-stat-label">Past Due / Failed</div>
                    </div>
                  </div>
                </div>

                {/* KPI 5: Total Tenants */}
                <div
                  onClick={() => { setActiveView('tenants'); setStatusFilter('all'); }}
                  className="sa-stat-card hover-lift"
                  style={{ cursor: 'pointer' }}
                  title="Click to view All Tenants Directory"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Store size={22} />
                    </div>
                    <div>
                      <div className="sa-stat-value" style={{ color: 'var(--sa-primary)', fontSize: '1.45rem', fontWeight: 900 }}>{restaurants.length}</div>
                      <div className="sa-stat-label">Total Tenants</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ⚠️ 2. TWO-COLUMN OPERATIONAL HUBS: NEEDS ATTENTION & PLATFORM HEALTH */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                {/* LEFT: NEEDS ATTENTION HUB */}
                <div className="sa-table-container" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                          onClick={() => { setActiveView('tenants'); setStatusFilter('suspended'); }}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
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
                          onClick={() => { setActiveView('tenants'); setStatusFilter('failed'); }}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
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
                          onClick={() => setActiveView('billing')}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
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
                          onClick={() => { setActiveView('tenants'); setStatusFilter('expired'); }}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
                        >
                          View ➔
                        </button>
                      </div>
                    )}

                    {/* All Clear State if no issues */}
                    {totalPending === 0 && restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length === 0 && (
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
                <div className="sa-table-container" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                      onClick={() => setActiveView('operations')}
                      className="sa-btn sa-btn-secondary sa-btn-sm"
                      style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
                    >
                      Optimize ➔
                    </button>
                  </div>
                </div>
              </div>

              {/* 📋 3. RECENT TENANT SIGNUPS & ACTIVITY TABLE */}
              <div className="sa-table-container" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px' }}>
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
                          <td>{renderStatusBadge(r)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedTenant360(r)}
                              className="sa-btn sa-btn-secondary sa-btn-sm"
                              style={{ padding: '4px 9px', fontSize: '0.72rem', fontWeight: 800 }}
                              title="Open 360° Profile"
                            >
                              🔍 360°
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
