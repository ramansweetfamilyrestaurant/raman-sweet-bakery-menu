import React, { useState, useEffect } from 'react';
import { Crown, Plus, LogOut, ArrowLeft, ExternalLink, Trash2, CheckCircle, XCircle, Store, Utensils, DollarSign, Phone, MapPin, Copy, Check, Search, Edit3, Key, Shield, RefreshCw } from 'lucide-react';
import { fetchSuperAdminRestaurants, createTenantRestaurant, toggleTenantRestaurantActive, deleteTenantRestaurant, impersonateTenantRestaurant, updateTenantRestaurant } from '../../api/client';

export default function SuperAdminDashboard({ token, username, onLogout, onReturnToMenu, onImpersonate }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // New Restaurant Form State
  const [form, setForm] = useState({
    name: '',
    slug: '',
    owner_username: '',
    owner_password: '',
    phone: '',
    address: '',
    tagline: '100% Quality Food & Customer Service'
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

  // Auto-generate URL slug from restaurant name input
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
        tagline: '100% Quality Food & Customer Service'
      });
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create restaurant');
    } finally {
      setFormSubmitting(false);
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
        onImpersonate(data.token, data.username);
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
      alert(err.message || 'Failed to update tenant info');
    }
  };

  const handleCopyLink = (slug, id) => {
    const liveOrigin = window.location.origin.includes('localhost')
      ? 'http://localhost:5000'
      : window.location.origin;
    const url = `${liveOrigin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered restaurants by search query
  const filteredRestaurants = restaurants.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.owner_username && r.owner_username.toLowerCase().includes(q));
  });

  const totalActive = restaurants.filter(r => r.active !== false).length;
  const totalDishes = restaurants.reduce((acc, r) => acc + (r.dish_count || 0), 0);
  const estimatedRevenue = totalActive * 999;

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
                <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DFBA67', margin: 0, tracking: '0.5px' }}>
                  SaaS Master Control Portal
                </h1>
                <span style={{ background: '#DFBA67', color: '#0A2315', fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: '12px' }}>
                  SUPER ADMIN
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                Platform Master: {username} • Multi-Tenant SaaS Architecture
              </span>
            </div>
          </div>

          {/* Master Header Actions */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={onLogout}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)'
              }}
            >
              <LogOut size={15} /> Logout Super Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Banner Metrics Alignment Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}>
          {/* Card 1: Total Restaurants */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={26} />
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary-emerald)', lineHeight: 1.1 }}>{restaurants.length}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Registered Restaurants</div>
            </div>
          </div>

          {/* Card 2: Active Subscriptions */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={26} />
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#B45309', lineHeight: 1.1 }}>{totalActive}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Active Subscriptions</div>
            </div>
          </div>

          {/* Card 3: Total Dishes Hosted */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Utensils size={26} />
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4338CA', lineHeight: 1.1 }}>{totalDishes}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total Dishes Hosted</div>
            </div>
          </div>

          {/* Card 4: Est. Monthly SaaS Revenue */}
          <div style={{
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#FFFFFF',
            borderRadius: '20px',
            padding: '20px',
            border: '1.5px solid #D4AF37',
            boxShadow: '0 8px 24px rgba(10,35,21,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={28} color="#0A2315" />
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#DFBA67', lineHeight: 1.1 }}>₹{estimatedRevenue.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Est. Monthly Revenue</div>
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0 }}>
              Tenant Restaurants Directory ({filteredRestaurants.length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Manage clients, view live menus, credentials, and toggle subscription access
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Search Input Bar */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search restaurant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            <button
              onClick={loadData}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--primary-emerald)',
                padding: '9px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Refresh Directory"
            >
              <RefreshCw size={15} /> Refresh
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
                color: '#DFBA67',
                padding: '9px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.88rem',
                fontWeight: 900,
                border: '1.5px solid #D4AF37',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(10,35,21,0.25)'
              }}
            >
              <Plus size={18} color="#DFBA67" /> Add New Restaurant
            </button>
          </div>
        </div>

        {/* Directory Grid Listing */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-light)', borderTopColor: '#DFBA67', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            Loading tenant restaurants...
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#FFFFFF', borderRadius: '20px', border: '1px solid var(--border-light)' }}>
            <Store size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>No Matching Restaurants Found</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {searchQuery ? `No restaurant found matching '${searchQuery}'` : "Click 'Add New Restaurant' to onboard your first client restaurant!"}
            </p>
            <button
              onClick={() => { setSearchQuery(''); setShowAddModal(true); }}
              style={{
                background: 'var(--primary-emerald)',
                color: '#FFFFFF',
                padding: '10px 20px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              + Add New Restaurant
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {filteredRestaurants.map((r) => {
              const liveOrigin = window.location.origin.includes('localhost')
                ? 'http://localhost:5000'
                : window.location.origin;
              const menuUrl = `${liveOrigin}/r/${r.slug}`;
              const isActive = r.active !== false;

              return (
                <div key={r.id} style={{
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  padding: '22px',
                  border: isActive ? '1.5px solid var(--border-light)' : '2px solid #FCA5A5',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  transition: 'all 0.2s ease-in-out'
                }}>
                  {/* Status Pill Badge */}
                  <div style={{ position: 'absolute', top: '18px', right: '18px' }}>
                    <button
                      onClick={() => handleToggleActive(r.id, isActive)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        background: isActive ? '#DCFCE7' : '#FEE2E2',
                        color: isActive ? '#15803D' : '#DC2626',
                        border: isActive ? '1.5px solid #86EFAC' : '1.5px solid #FCA5A5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      title="Click to Toggle Subscription Active / Suspended"
                    >
                      {isActive ? <CheckCircle size={13} color="#15803D" /> : <XCircle size={13} color="#DC2626" />}
                      {isActive ? 'Active' : 'Suspended'}
                    </button>
                  </div>

                  <div>
                    {/* Header Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                      <img
                        src={r.logo || '/uploads/logo.jpg'}
                        alt=""
                        style={{ width: '52px', height: '52px', borderRadius: '16px', objectFit: 'cover', border: '1px solid var(--border-light)' }}
                      />
                      <div style={{ paddingRight: '90px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary-emerald)', margin: 0, lineHeight: 1.2 }}>
                          {r.name}
                        </h3>
                        <span style={{ fontSize: '0.76rem', color: 'var(--gold-primary)', fontWeight: 800 }}>
                          /r/{r.slug}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.3, fontWeight: 500 }}>
                      {r.tagline || '100% Quality Food & Service'}
                    </p>

                    {/* Metadata Card Info */}
                    <div style={{ background: '#FAF8F5', borderRadius: '16px', padding: '12px 14px', marginBottom: '16px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Key size={13} color="var(--gold-primary)" /> Owner Login:
                        </span>
                        <strong style={{ color: 'var(--primary-emerald)', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
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
                      title="Edit Tenant Details & Reset Owner Credentials"
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
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            maxWidth: '520px',
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
                  placeholder="e.g. Royal Pizza & Bakery"
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
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                  TAGLINE
                </label>
                <input
                  type="text"
                  placeholder="Fresh Woodfired Pizza & Bakery"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
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
            maxWidth: '520px',
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
                    RESET PASSWORD (OPTIONAL)
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
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  value={editModalData.phone || ''}
                  onChange={(e) => setEditModalData({ ...editModalData, phone: e.target.value })}
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
    </div>
  );
}
