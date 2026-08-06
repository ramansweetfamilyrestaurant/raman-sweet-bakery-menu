import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ExternalLink, Trash2, CheckCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Shield, ShieldCheck, RefreshCw, QrCode, Megaphone, FileText, Calendar, Palette, MessageSquare, Upload } from 'lucide-react';
import { fetchSuperAdminRestaurants, createTenantRestaurant, toggleTenantRestaurantActive, deleteTenantRestaurant, impersonateTenantRestaurant, updateTenantRestaurant, createAnnouncement, fetchAuditLogs, uploadImage } from '../../api/client';

export default function SuperAdminDashboard({ token, username, onLogout, onReturnToMenu, onImpersonate }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Announcement Modal State
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [announceType, setAnnounceType] = useState('info');
  const [announceSubmitting, setAnnounceSubmitting] = useState(false);

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

  const handleCreateAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!announceMsg.trim()) return;
    setAnnounceSubmitting(true);
    try {
      await createAnnouncement(announceMsg.trim(), announceType, token);
      alert('📢 Announcement broadcasted successfully to all tenant dashboards!');
      setAnnounceMsg('');
      setShowAnnounceModal(false);
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

  // Filtered restaurants by search query
  const filteredRestaurants = restaurants.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.owner_username && r.owner_username.toLowerCase().includes(q));
  });

  const totalActive = restaurants.filter(r => r.active !== false).length;
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowAnnounceModal(true)}
              style={{
                background: 'rgba(212, 175, 55, 0.15)',
                color: '#DFBA67',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.8rem',
                fontWeight: 800,
                border: '1px solid rgba(212, 175, 55, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Broadcast global announcement banner to all tenant dashboards"
            >
              <Megaphone size={15} /> Broadcast Notice
            </button>

            <button
              onClick={handleOpenAuditModal}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="View platform activity & security audit logs"
            >
              <FileText size={15} /> Audit Logs
            </button>

            <button
              onClick={onLogout}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.8rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)'
              }}
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        
        {/* KPI Analytics Summary Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Registered Tenants */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Store size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary-emerald)', lineHeight: 1.1 }}>{restaurants.length}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tenants Hosted</div>
            </div>
          </div>

          {/* Card 2: Active Subscriptions */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#B45309', lineHeight: 1.1 }}>{totalActive}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Active Subscriptions</div>
            </div>
          </div>

          {/* Card 3: Total Dishes Hosted */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Utensils size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#4338CA', lineHeight: 1.1 }}>{totalDishes}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Dishes Hosted</div>
            </div>
          </div>

          {/* Card 4: Total QR Code Scans */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <QrCode size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7E22CE', lineHeight: 1.1 }}>{totalScans}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total QR Scans</div>
            </div>
          </div>

          {/* Card 5: Est. Monthly SaaS Revenue */}
          <div style={{
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#FFFFFF',
            borderRadius: '20px',
            padding: '18px',
            border: '1.5px solid #D4AF37',
            boxShadow: '0 8px 24px rgba(10,35,21,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={26} color="#0A2315" />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#DFBA67', lineHeight: 1.1 }}>₹{estimatedRevenue.toLocaleString()}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Est. SaaS Revenue</div>
            </div>
          </div>
        </div>

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
                            /r/{r.slug}
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

                    {/* Metadata Table */}
                    <div style={{
                      background: 'var(--bg-app)',
                      borderRadius: '14px',
                      padding: '10px 12px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Shield size={13} color="var(--gold-primary)" /> Owner Login:
                        </span>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--text-dark)' }}>
                          {r.owner_username}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Utensils size={13} color="var(--gold-primary)" /> Dishes Hosted:
                        </span>
                        <strong style={{ color: 'var(--primary-emerald)' }}>{r.dish_count} Items</strong>
                      </div>

                      {r.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dark)' }}>
                          <Phone size={13} color="var(--gold-primary)" /> {r.phone}
                        </div>
                      )}

                      {r.address && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dark)' }}>
                          <MapPin size={13} color="var(--gold-primary)" /> {r.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', flexWrap: 'wrap' }}>
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
                      href={`/r/${r.slug}`}
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
                  CUSTOM URL SLUG (yourdomain.com/r/slug) *
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
                    SUBSCRIPTION TIER
                  </label>
                  <select
                    value={form.plan_tier}
                    onChange={(e) => {
                      const tier = e.target.value;
                      const price = tier === 'basic' ? 499 : tier === 'enterprise' ? 1999 : 999;
                      setForm({ ...form, plan_tier: tier, plan_price: price });
                    }}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    <option value="basic">Basic Plan (₹499/mo)</option>
                    <option value="pro">Pro Plan (₹999/mo)</option>
                    <option value="enterprise">Enterprise Plan (₹1,999/mo)</option>
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
                    <option value="emerald">Emerald Mint & Deep Teal</option>
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
                    SUBSCRIPTION TIER
                  </label>
                  <select
                    value={editModalData.plan_tier || 'pro'}
                    onChange={(e) => {
                      const tier = e.target.value;
                      const price = tier === 'basic' ? 499 : tier === 'enterprise' ? 1999 : 999;
                      setEditModalData({ ...editModalData, plan_tier: tier, plan_price: price });
                    }}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border-light)', fontSize: '0.86rem', outline: 'none', fontWeight: 700 }}
                  >
                    <option value="basic">Basic Plan (₹499/mo)</option>
                    <option value="pro">Pro Plan (₹999/mo)</option>
                    <option value="enterprise">Enterprise Plan (₹1,999/mo)</option>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                    ⭐ Google Review Button
                  </label>
                </div>
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
    </div>
  );
}
