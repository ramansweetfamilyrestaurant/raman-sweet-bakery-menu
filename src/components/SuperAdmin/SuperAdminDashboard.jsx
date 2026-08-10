import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload, X, XCircle, CreditCard, Lock, Sparkles } from 'lucide-react';
import { fetchSuperAdminRestaurants, createTenantRestaurant, toggleTenantRestaurantActive, deleteTenantRestaurant, impersonateTenantRestaurant, updateTenantRestaurant, createAnnouncement, fetchSuperAnnouncements, deleteAnnouncement, clearAllAnnouncements, fetchAuditLogs, uploadImage, fetchSaaSPlans, createSaaSPlan, updateSaaSPlan, deleteSaaSPlan, superAdminOptimizeDatabase, updateSuperAdminCredentials } from '../../api/client';
import { SAAS_PLANS, getPlanDetails } from '../../config/plans';

export default function SuperAdminDashboard({ token, username, onLogout, onReturnToMenu, onImpersonate }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

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
  const [paymentKeys, setPaymentKeys] = useState({
    cashfree_app_id: '',
    cashfree_secret_key: '',
    support_whatsapp: '919876543210',
    default_trial_days: '14'
  });
  const [keysSaving, setKeysSaving] = useState(false);
  const [keysMsg, setKeysMsg] = useState('');

  const loadSystemSettings = async () => {
    try {
      const res = await fetch('/api/superadmin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && typeof data === 'object') {
        setPaymentKeys(prev => ({
          ...prev,
          cashfree_app_id: data.cashfree_app_id || '',
          cashfree_secret_key: data.cashfree_secret_key || '',
          support_whatsapp: data.support_whatsapp || '919876543210',
          default_trial_days: data.default_trial_days || '14'
        }));
      }
    } catch {}
  };

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
      {/* Super Admin Top Header */}
      <header style={{
        background: 'linear-gradient(135deg, #05140B 0%, #0A2315 100%)',
        color: '#FFFFFF',
        padding: '16px 20px',
        borderBottom: '2px solid #D4AF37',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)',
              color: '#0A2315',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.4)'
            }}>
              <Crown size={24} color="#0A2315" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DFBA67', margin: 0 }}>
                  SaaS Master Control Portal
                </h1>
                <span style={{ background: '#DFBA67', color: '#0A2315', fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: '12px' }}>
                  SUPER ADMIN
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                Platform Master: {username} • Enterprise Multi-Tenant Engine
              </span>
            </div>
          </div>

          {/* Master Header Actions */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenBroadcastModal}
              style={{
                background: 'rgba(212, 175, 55, 0.15)',
                color: '#DFBA67',
                padding: '7px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: '1px solid rgba(212, 175, 55, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title="Broadcast global announcement banner to all tenant dashboards"
            >
              <Megaphone size={14} /> Broadcast
            </button>

            <button
              onClick={() => {
                loadAuditData();
                setShowAuditModal(true);
              }}
              style={{
                background: '#F1F5F9',
                color: '#334155',
                padding: '7px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title="View platform activity & security audit logs"
            >
              <FileText size={14} /> Audit Logs
            </button>

            <button
              onClick={() => setShowWhatsappModal(true)}
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22C55E',
                padding: '7px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: '1px solid rgba(34, 197, 94, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title="Set Master Super Admin WhatsApp Support Number"
            >
              <MessageSquare size={14} /> Support WhatsApp
            </button>

            {/* 💳 SaaS Plans Manager Button */}
            <button
              onClick={() => {
                loadSaaSPlans();
                setShowPlansModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#FFFFFF',
                padding: '7px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: '1.5px solid #D4AF37',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(10,35,21,0.25)'
              }}
              title="Manage SaaS Plan Tiers, Pricing & Feature Matrix"
            >
              <CreditCard size={14} color="#DFBA67" /> SaaS Plans
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
                background: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                padding: '7px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: '1px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title="Change Super Admin Username & Password"
            >
              <Lock size={14} color="#DFBA67" /> Security
            </button>

            <button
              onClick={onLogout}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                padding: '7px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.76rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)'
              }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 12px' }}>
        
        {/* KPI Analytics Summary Cards Grid */}
        <div style={{
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
        <div style={{
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Status Filter Pills */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)' }}>
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
            <div style={{ position: 'relative', width: '220px' }}>
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
          <div style={{
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
                        {r.logo && r.logo !== '/uploads/logo.jpg' ? (
                          <img
                            src={r.logo}
                            alt={r.name}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid #D4AF37'
                            }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#FFD700', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', flexShrink: 0 }}>
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                        )}
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
                          background: isExpired ? '#FEE2E2' : daysLeft <= 7 ? '#FEF3C7' : '#DCFCE7',
                          color: isExpired ? '#DC2626' : daysLeft <= 7 ? '#B45309' : '#15803D',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <Calendar size={10} /> {isExpired ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      )}

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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: '#0A2315', fontWeight: 900 }}>
                              {r.phone || r.whatsapp_number}
                            </strong>
                            <a
                              href={`https://wa.me/${(r.phone || r.whatsapp_number || '').replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ background: '#22C55E', color: '#FFF', padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
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
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                  Onboard New Tenant Restaurant
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
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
                {editModalData.logo && editModalData.logo !== '/uploads/logo.jpg' ? (
                  <img src={editModalData.logo} alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #D4AF37' }} onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0A2315', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', flexShrink: 0 }}>
                    {(editModalData.name || 'R').charAt(0).toUpperCase()}
                  </div>
                )}
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
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '500px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: '2px solid #DFBA67'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                  Broadcast Announcement Notice
                </h3>
              </div>
              <button onClick={() => setShowAnnounceModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateAnnouncementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  ANNOUNCEMENT MESSAGE FOR ALL TENANTS *
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. ⚡ New Feature Added: WhatsApp Direct Ordering is now live! Update your WhatsApp number in Settings."
                  value={announceMsg}
                  onChange={(e) => setAnnounceMsg(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '14px', border: '1.5px solid var(--border-light)', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  NOTICE TYPE
                </label>
                <select
                  value={announceType}
                  onChange={(e) => setAnnounceType(e.target.value)}
                  style={{ width: '100%', padding: '11px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                >
                  <option value="info">ℹ️ Info Announcement (Blue)</option>
                  <option value="success">🎉 Success & Feature Release (Green)</option>
                  <option value="warning">⚠️ Maintenance / Warning (Gold)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)', fontWeight: 700, cursor: 'pointer', background: 'var(--bg-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={announceSubmitting}
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
                  {announceSubmitting ? 'Broadcasting...' : '📢 Broadcast Notice'}
                </button>
              </div>
            </form>

            {/* Active Notices Management Section */}
            {announcementsList && announcementsList.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px dashed var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-emerald)', margin: 0 }}>
                    ACTIVE BROADCAST NOTICES ({announcementsList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleClearAllAnnouncements}
                    style={{
                      background: '#FEE2E2',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Clear All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {announcementsList.map(a => (
                    <div 
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        gap: '8px',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      <span style={{ flexGrow: 1, wordBreak: 'break-word', fontWeight: 600, color: 'var(--text-dark)' }}>
                        {a.message}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        style={{
                          background: '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
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
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '650px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: '2px solid #D4AF37',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                    Platform Activity & Security Audit Logs
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Real-time logging of logins, tenant creations, and admin actions</span>
                </div>
              </div>
              <button onClick={() => setShowAuditModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gold-primary)', fontWeight: 800 }}>
                  📜 Loading audit logs...
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No audit logs recorded yet.
                </div>
              ) : (
                auditLogs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      background: 'var(--bg-app)',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ background: '#0A2315', color: '#DFBA67', fontSize: '0.66rem', fontWeight: 900, padding: '2px 7px', borderRadius: '6px' }}>
                          {log.actor_role.toUpperCase()}
                        </span>
                        <strong style={{ color: 'var(--primary-emerald)' }}>{log.action}</strong>
                      </div>
                      <div style={{ color: 'var(--text-dark)', fontWeight: 600 }}>
                        {log.details}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0, marginLeft: '12px' }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* 💳 Modal: Dedicated SaaS Plan Control Center */}
      {showPlansModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '900px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 25px 70px rgba(0,0,0,0.45)',
            border: '2px solid #D4AF37',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#DFBA67', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #D4AF37' }}>
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                    💳 Enterprise SaaS Plans & Pricing Matrix
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Manage base plan tiers, monthly pricing, feature access matrices, and create custom plans</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setShowCreatePlanForm(!showCreatePlanForm)}
                  style={{
                    background: 'var(--header-gradient)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={16} /> {showCreatePlanForm ? 'Hide Form' : 'Create Custom SaaS Plan'}
                </button>
                <button onClick={() => setShowPlansModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Create Custom SaaS Plan Accordion Form */}
              {showCreatePlanForm && (
                <div style={{
                  background: '#F8FAFC',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '2px dashed #0A2315'
                }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--primary-emerald)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={18} /> Create New Custom SaaS Subscription Plan
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>PLAN NAME *</label>
                      <input
                        type="text"
                        placeholder="e.g. Platinum VIP Plan"
                        value={newPlanForm.name}
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, name: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>MONTHLY PRICE (₹) *</label>
                      <input
                        type="number"
                        placeholder="2999"
                        value={newPlanForm.price}
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, price: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', outline: 'none', fontWeight: 800 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>PLAN BADGE TEXT</label>
                      <input
                        type="text"
                        placeholder="e.g. 💎 PLATINUM"
                        value={newPlanForm.badge}
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, badge: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', outline: 'none', fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>PLAN DESCRIPTION</label>
                    <input
                      type="text"
                      placeholder="e.g. All features + Priority 24/7 VIP Phone Support"
                      value={newPlanForm.description}
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, description: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                    />
                  </div>

                  {/* Feature Permissions Matrix */}
                  <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                    <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block', marginBottom: '8px' }}>FEATURE ACCESS MATRIX PERMISSIONS:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newPlanForm.whatsapp_enabled}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, whatsapp_enabled: e.target.checked })}
                          style={{ accentColor: '#16a34a' }}
                        /> 💬 WhatsApp Drawer
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newPlanForm.direct_ordering_enabled}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, direct_ordering_enabled: e.target.checked })}
                          style={{ accentColor: '#0A2315' }}
                        /> ⚡ Direct Table KOT Ordering
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newPlanForm.google_reviews_enabled}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, google_reviews_enabled: e.target.checked })}
                          style={{ accentColor: '#D4AF37' }}
                        /> ⭐ Smart AI Google Reviews
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newPlanForm.direct_ordering_enabled}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, direct_ordering_enabled: e.target.checked })}
                          style={{ accentColor: '#2563eb' }}
                        /> 🍱 Thali & Combos Builder
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newPlanForm.direct_ordering_enabled}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, direct_ordering_enabled: e.target.checked })}
                          style={{ accentColor: '#059669' }}
                        /> 🖨️ Thermal Printer (KOT & Bills)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newPlanForm.direct_ordering_enabled}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, direct_ordering_enabled: e.target.checked })}
                          style={{ accentColor: '#7c3aed' }}
                        /> 🗺️ Hall Floor Map & Grid
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!newPlanForm.name.trim()) return alert('Plan name is required');
                      try {
                        await createSaaSPlan(newPlanForm, token);
                        alert(`Custom Plan '${newPlanForm.name}' created successfully!`);
                        setShowCreatePlanForm(false);
                        setNewPlanForm({ key: '', name: '', price: 999, badge: '👑 CUSTOM', description: '', whatsapp_enabled: true, direct_ordering_enabled: false, google_reviews_enabled: true });
                        loadSaaSPlans();
                      } catch (err) {
                        alert(err.message || 'Failed to create plan');
                      }
                    }}
                    style={{
                      background: 'var(--primary-emerald)',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Save & Deploy Custom Plan
                  </button>
                </div>
              )}

              {/* Plans Pills / Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {plansList.map(plan => (
                  <div key={plan.key} style={{
                    background: '#FFFFFF',
                    borderRadius: '20px',
                    padding: '20px',
                    border: editingPlan?.key === plan.key ? '2px solid #0A2315' : '1.5px solid #E2E8F0',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative'
                  }}>
                    <div>
                      {/* Top Badges Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{
                          background: '#FEF3C7',
                          color: '#B45309',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.74rem',
                          fontWeight: 900,
                          border: '1px solid #FCD34D'
                        }}>
                          {plan.badge || '👑 PLAN'}
                        </span>

                        <span style={{
                          background: '#E0E7FF',
                          color: '#4338CA',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}>
                          🏢 {plan.enrolled_count || 0} Enrolled
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: '0 0 6px 0' }}>
                        {plan.name}
                      </h4>

                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginBottom: '8px' }}>
                        ₹{plan.price}<span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>/month</span>
                      </div>

                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4, height: '36px', overflow: 'hidden' }}>
                        {plan.description || 'Enterprise SaaS Plan'}
                      </p>

                      {/* Included Feature Pills */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} color="#16a34a" />
                          <span style={{ color: '#15803D', fontWeight: 700 }}>📱 Digital QR Menu & Themes</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {plan.whatsapp_enabled ? <CheckCircle size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}
                          <span style={{ color: plan.whatsapp_enabled ? '#15803D' : '#94A3B8', fontWeight: 700 }}>💬 WhatsApp Direct Order</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {plan.google_reviews_enabled ? <CheckCircle size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}
                          <span style={{ color: plan.google_reviews_enabled ? '#15803D' : '#94A3B8', fontWeight: 700 }}>⭐ Smart AI Google Reviews</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {plan.direct_ordering_enabled ? <CheckCircle size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}
                          <span style={{ color: plan.direct_ordering_enabled ? '#15803D' : '#94A3B8', fontWeight: 700 }}>⚡ Direct Table QR KOT Ordering</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {plan.direct_ordering_enabled ? <CheckCircle size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}
                          <span style={{ color: plan.direct_ordering_enabled ? '#15803D' : '#94A3B8', fontWeight: 700 }}>🖨️ Thermal Printer KOT & Bills</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {plan.direct_ordering_enabled ? <CheckCircle size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}
                          <span style={{ color: plan.direct_ordering_enabled ? '#15803D' : '#94A3B8', fontWeight: 700 }}>🗺️ Hall Floor Map & Table Grid</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                      <button
                        onClick={() => setEditingPlan(editingPlan?.key === plan.key ? null : { ...plan })}
                        style={{
                          flex: 1,
                          background: '#F1F5F9',
                          color: '#0F172A',
                          border: '1px solid #CBD5E1',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Edit3 size={14} /> Quick Edit
                      </button>

                      {!['basic', 'pro', 'enterprise'].includes(plan.key) && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete custom plan '${plan.name}'?`)) return;
                            try {
                              await deleteSaaSPlan(plan.key, token);
                              loadSaaSPlans();
                            } catch (err) {
                              alert(err.message || 'Failed to delete');
                            }
                          }}
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Inline Quick Edit Form */}
                    {editingPlan?.key === plan.key && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#FFFBEB',
                        borderRadius: '12px',
                        border: '1.5px solid #FCD34D'
                      }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#B45309', marginBottom: '8px' }}>
                          ⚡ EDIT BASE RATE & FEATURES MATRIX:
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Actual Price (₹)</label>
                            <input
                              type="number"
                              value={editingPlan.price}
                              onChange={(e) => setEditingPlan({ ...editingPlan, price: e.target.value })}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', fontWeight: 800 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Cut MRP Price (₹)</label>
                            <input
                              type="number"
                              placeholder="e.g. 1999"
                              value={editingPlan.original_price || ''}
                              onChange={(e) => setEditingPlan({ ...editingPlan, original_price: e.target.value })}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', fontWeight: 800, color: '#DC2626' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Badge</label>
                            <input
                              type="text"
                              value={editingPlan.badge}
                              onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem', fontWeight: 800 }}
                            />
                          </div>
                        </div>

                        {/* Toggles */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editingPlan.whatsapp_enabled} onChange={(e) => setEditingPlan({ ...editingPlan, whatsapp_enabled: e.target.checked })} style={{ accentColor: '#16a34a' }} /> 💬 WhatsApp
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editingPlan.direct_ordering_enabled} onChange={(e) => setEditingPlan({ ...editingPlan, direct_ordering_enabled: e.target.checked })} style={{ accentColor: '#0A2315' }} /> ⚡ Table KOT
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editingPlan.google_reviews_enabled} onChange={(e) => setEditingPlan({ ...editingPlan, google_reviews_enabled: e.target.checked })} style={{ accentColor: '#d97706' }} /> ⭐ AI Reviews
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editingPlan.direct_ordering_enabled} onChange={(e) => setEditingPlan({ ...editingPlan, direct_ordering_enabled: e.target.checked })} style={{ accentColor: '#2563eb' }} /> 🍱 Combos
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editingPlan.direct_ordering_enabled} onChange={(e) => setEditingPlan({ ...editingPlan, direct_ordering_enabled: e.target.checked })} style={{ accentColor: '#059669' }} /> 🖨️ Printer KOT
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editingPlan.direct_ordering_enabled} onChange={(e) => setEditingPlan({ ...editingPlan, direct_ordering_enabled: e.target.checked })} style={{ accentColor: '#7c3aed' }} /> 🗺️ Floor Map
                          </label>
                        </div>

                        <button
                          onClick={async () => {
                            try {
                              await updateSaaSPlan(plan.key, editingPlan, token);
                              setEditingPlan(null);
                              loadSaaSPlans();
                            } catch (err) {
                              alert('Failed to update plan');
                            }
                          }}
                          style={{
                            width: '100%',
                            background: '#0A2315',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Update Base Plan
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#DFBA67',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Lock size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-dark)' }}>
                  Change Master Credentials
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Super Admin Account Security Settings
                </span>
              </div>
            </div>

            {securityError && (
              <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', color: '#B91C1C', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '14px' }}>
                ⚠️ {securityError}
              </div>
            )}

            {securitySuccess && (
              <div style={{ background: '#ECFDF5', border: '1px solid #10B981', color: '#047857', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '14px' }}>
                {securitySuccess}
              </div>
            )}

            {/* 💳 Payment Gateway API Keys Setup Box */}
            <div style={{ background: '#F8FAFC', border: '1.5px dashed #0EA5E9', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.84rem', color: '#0369A1', display: 'block', marginBottom: '10px' }}>
                💳 Payment Gateway Merchant API Keys Setup:
              </strong>

              {keysMsg && (
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#059669', marginBottom: '8px' }}>
                  ✅ {keysMsg}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.78rem' }}>
                {/* Free Trial Days */}
                <div style={{ background: '#FFFBEB', padding: '10px', borderRadius: '8px', border: '1px solid #FCD34D' }}>
                  <span style={{ fontWeight: 800, color: '#B45309', display: 'block', marginBottom: '4px' }}>🎁 SAAS FREE TRIAL DURATION:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="14"
                      value={paymentKeys.default_trial_days}
                      onChange={(e) => setPaymentKeys({ ...paymentKeys, default_trial_days: e.target.value })}
                      style={{ width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 900, color: '#0F172A' }}
                    />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#92400E' }}>Days Free Trial for New Registrations</span>
                  </div>
                </div>

                {/* Cashfree */}
                <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                  <span style={{ fontWeight: 800, color: '#059669', display: 'block', marginBottom: '4px' }}>🚀 CASHFREE GATEWAY (PRIMARY):</span>
                  <input
                    type="text"
                    placeholder="Cashfree App ID (e.g. 1029384756)"
                    value={paymentKeys.cashfree_app_id}
                    onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_app_id: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '6px', fontSize: '0.78rem' }}
                  />
                  <input
                    type="password"
                    placeholder="Cashfree Secret Key"
                    value={paymentKeys.cashfree_secret_key}
                    onChange={(e) => setPaymentKeys({ ...paymentKeys, cashfree_secret_key: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.78rem' }}
                  />
                </div>

                <button
                  type="button"
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
                      if (res.ok) {
                        setKeysMsg(data.message || 'Payment API Keys saved successfully!');
                      }
                    } catch {
                      setKeysMsg('Failed to save API keys');
                    } finally {
                      setKeysSaving(false);
                    }
                  }}
                  style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                >
                  {keysSaving ? 'Saving...' : '✓ Save Payment API Keys'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSecuritySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px' }}>
                  🔑 Current Password (Required) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password (e.g. superadmin123)"
                  value={securityForm.currentPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px' }}>
                  👤 Master Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. superadmin"
                  value={securityForm.newUsername}
                  onChange={(e) => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px' }}>
                  🔒 New Master Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-light)',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {securityForm.newPassword && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px' }}>
                    🔒 Confirm New Master Password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={securityForm.confirmPassword}
                    onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border-light)',
                      fontSize: '0.86rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={securitySubmitting}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                  color: '#DFBA67',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(10,35,21,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Lock size={16} /> {securitySubmitting ? 'Updating...' : 'Save Master Credentials'}
              </button>
            </form>
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
            background: '#FFFFFF', borderRadius: '24px', maxWidth: '440px', width: '100%',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #22C55E'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={20} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
                  Super Admin WhatsApp Support
                </h3>
              </div>
              <button onClick={() => setShowWhatsappModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '20px' }}>
              Enter your Master WhatsApp Support Mobile Number. When restaurant owners click <strong>"Contact Super Admin Support"</strong> on Forgot Password or Support screens, they will be directed to this WhatsApp number!
            </p>

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
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#374151', marginBottom: '6px' }}>
                SUPER ADMIN WHATSAPP NUMBER *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 919876543210 (with country code)"
                value={masterWhatsapp}
                onChange={e => setMasterWhatsapp(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '12px',
                  border: '1.5px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', marginBottom: '20px'
                }}
              />

              <button type="submit" style={{
                width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, #15803D, #22C55E)', color: '#FFFFFF',
                fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.4)'
              }}>
                💾 Save Master Support WhatsApp Number
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
