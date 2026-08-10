import React, { useState, useEffect } from 'react';
import './styles/SuperAdmin.css';

// Layout & UI Shell Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNavigation from './components/BottomNavigation';
import Drawer from './components/Drawer';

// Views
import OverviewView from './views/OverviewView';
import TenantsView from './views/TenantsView';
import TenantDetailsView from './views/TenantDetailsView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';

// Modals
import GrantFreeAccessModal from './modals/GrantFreeAccessModal';
import RevokeFreeAccessModal from './modals/RevokeFreeAccessModal';

// API Client
import {
  fetchSuperAdminRestaurants, createTenantRestaurant, updateTenantRestaurant, toggleTenantRestaurantActive,
  deleteTenantRestaurant, impersonateTenantRestaurant, grantFreeAccess, revokeFreeAccess, fetchPendingRegistrations,
  fetchSaaSPlans, createSaaSPlan, updateSaaSPlan, deleteSaaSPlan, fetchAuditLogs,
  createAnnouncement, fetchSuperAnnouncements, deleteAnnouncement, clearAllAnnouncements,
  superAdminOptimizeDatabase
} from '../../api/client';

export default function SuperAdminDashboard({ token, username, onLogout, onImpersonate }) {
  const [activeView, setActiveView] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Data State
  const [restaurants, setRestaurants] = useState([]);
  const [plansList, setPlansList] = useState([]);
  const [announcementsList, setAnnouncementsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);

  // Drawers & Modals State
  const [selectedRestoDrawer, setSelectedRestoDrawer] = useState(null);
  const [grantModalResto, setGrantModalResto] = useState(null);
  const [revokeModalResto, setRevokeModalResto] = useState(null);
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  // Settings State
  const [paymentKeys, setPaymentKeys] = useState({
    cashfree_app_id: '',
    cashfree_secret_key: '',
    support_whatsapp: '919876543210',
    default_trial_days: '14',
    platform_logo_url: ''
  });
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysMsg, setKeysMsg] = useState('');

  // Security Credentials Form State
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newUsername: username || '',
    newPassword: ''
  });
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityMsg, setSecurityMsg] = useState('');
  const [securityError, setSecurityError] = useState('');

  // Form State for Add Tenant
  const [tenantForm, setTenantForm] = useState({
    name: '', slug: '', owner_username: '', owner_password: '',
    phone: '', address: '', plan_tier: 'pro', plan_price: 999
  });

  // Load all dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [restos, plans, ann, logs, pRegs] = await Promise.all([
        fetchSuperAdminRestaurants(token).catch(() => []),
        fetchSaaSPlans(token).catch(() => []),
        fetchSuperAnnouncements(token).catch(() => []),
        fetchAuditLogs(token).catch(() => []),
        fetchPendingRegistrations(token).catch(() => [])
      ]);
      setRestaurants(Array.isArray(restos) ? restos : []);
      setPlansList(Array.isArray(plans) ? plans : []);
      setAnnouncementsList(Array.isArray(ann) ? ann : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setPendingRegistrations(Array.isArray(pRegs) ? pRegs : []);
    } catch (err) {
      console.error('Failed to load Super Admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const res = await fetch('/api/superadmin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && typeof data === 'object') {
        setPaymentKeys({
          cashfree_app_id: data.cashfree_app_id || '',
          cashfree_secret_key: data.cashfree_secret_key || '',
          support_whatsapp: data.support_whatsapp || '919876543210',
          default_trial_days: data.default_trial_days || '14',
          platform_logo_url: data.platform_logo_url || ''
        });
      }
    } catch (err) {
      console.warn('Load settings notice:', err.message);
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadSystemSettings();
  }, [token]);

  // Handlers for Tenant Operations
  const handleToggleActive = async (id, currentActive) => {
    try {
      const targetState = !(currentActive === true || currentActive === 1 || currentActive === 'true');
      await toggleTenantRestaurantActive(id, targetState, token);
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, active: targetState } : r));
    } catch (err) {
      alert(err.message || 'Failed to update tenant active state');
    }
  };

  const handleImpersonateClick = async (id, name) => {
    try {
      const data = await impersonateTenantRestaurant(id, token);
      if (data && data.token) {
        onImpersonate(data.token, data.username, data.restaurant?.slug);
      }
    } catch (err) {
      alert(err.message || 'Failed to impersonate tenant');
    }
  };

  const handleSaveTenantSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTenant) {
        await updateTenantRestaurant(editingTenant.id, tenantForm, token);
      } else {
        await createTenantRestaurant(tenantForm, token);
      }
      setShowAddTenantModal(false);
      setEditingTenant(null);
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Failed to save tenant restaurant');
    }
  };

  // Handlers for Complimentary Access
  const handleConfirmGrantFree = async (id, payload) => {
    const res = await grantFreeAccess(id, payload, token);
    setRestaurants(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, subscription_type: 'ADMIN_GRANTED', mandate_status: 'admin_granted', plan_tier: res.plan_key || payload.plan_key, plan_price: 0, access_until: res.access_until, plan_expires_at: res.access_until, active: true };
      }
      return r;
    }));
    return res;
  };

  const handleConfirmRevokeFree = async (id) => {
    await revokeFreeAccess(id, token);
    setRestaurants(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, subscription_type: 'PAID', mandate_status: 'cancelled', active: false };
      }
      return r;
    }));
  };

  // Handlers for SaaS Plans
  const handleCreatePlan = async (planForm) => {
    try { await createSaaSPlan(planForm, token); loadDashboardData(); }
    catch (err) { alert(err.message || 'Failed to create SaaS plan'); }
  };

  const handleUpdatePlan = async (key, planForm) => {
    try { await updateSaaSPlan(key, planForm, token); loadDashboardData(); }
    catch (err) { alert(err.message || 'Failed to update SaaS plan'); }
  };

  const handleDeletePlan = async (key) => {
    try { await deleteSaaSPlan(key, token); loadDashboardData(); }
    catch (err) { alert(err.message || 'Failed to delete SaaS plan'); }
  };

  // Handlers for Communications
  const handleSendAnnouncement = async (payload) => { await createAnnouncement(payload, token); loadDashboardData(); };
  const handleDeleteAnnouncement = async (id) => { await deleteAnnouncement(id, token); loadDashboardData(); };
  const handleClearAllAnnouncements = async () => { await clearAllAnnouncements(token); loadDashboardData(); };

  // Handlers for System Settings
  const handleSavePaymentKeys = async (keysForm) => {
    setSavingKeys(true);
    setKeysMsg('');
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(keysForm)
      });
      const data = await res.json();
      if (res.ok) {
        setKeysMsg('✓ Settings updated successfully!');
        setPaymentKeys(keysForm);
      } else {
        alert(data.error || 'Failed to save settings');
      }
    } catch (err) {
      alert(err.message || 'Settings update error');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    setSavingSecurity(true);
    setSecurityMsg('');
    setSecurityError('');
    try {
      const res = await fetch('/api/superadmin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(securityForm)
      });
      const data = await res.json();
      if (res.ok) {
        setSecurityMsg('✓ Credentials updated successfully!');
        setSecurityForm({ currentPassword: '', newUsername: data.username || securityForm.newUsername, newPassword: '' });
      } else {
        setSecurityError(data.error || 'Failed to change credentials');
      }
    } catch (err) {
      setSecurityError(err.message || 'Security update error');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleOptimizeDatabase = async (daysOld = 90) => {
    try {
      const res = await superAdminOptimizeDatabase(daysOld, token);
      alert(res.message || '✓ Global Database Vacuum & Optimization Complete!');
    } catch (err) {
      alert(err.message || 'Failed to optimize database');
    }
  };

  return (
    <div className="sa-dashboard-container">
      {/* Desktop Sidebar — 4 Clean Tabs */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        logoUrl={paymentKeys.platform_logo_url}
      />

      {/* Main Canvas */}
      <main className="sa-main-canvas">
        <Header
          username={username}
          activeView={activeView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenMobileMenu={() => {}}
          pendingCount={pendingRegistrations.length}
          onLogout={onLogout}
        />

        <div className="sa-content-body">
          {activeView === 'overview' && (
            <OverviewView
              restaurants={restaurants}
              pendingRegistrations={pendingRegistrations}
              onSelectTenant={setSelectedRestoDrawer}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'tenants' && (
            <TenantsView
              restaurants={restaurants}
              searchQuery={searchQuery}
              onSelectTenant={setSelectedRestoDrawer}
              onAddTenant={() => {
                setEditingTenant(null);
                setTenantForm({ name: '', slug: '', owner_username: '', owner_password: '', phone: '', address: '', plan_tier: 'pro', plan_price: 999 });
                setShowAddTenantModal(true);
              }}
              onRefresh={loadDashboardData}
              loading={loading}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              paymentKeys={paymentKeys}
              onSavePaymentKeys={handleSavePaymentKeys}
              securityForm={securityForm}
              setSecurityForm={setSecurityForm}
              onSaveSecurity={handleSaveSecurity}
              savingKeys={savingKeys}
              savingSecurity={savingSecurity}
              keysMsg={keysMsg}
              securityMsg={securityMsg}
              securityError={securityError}
              plansList={plansList}
              restaurants={restaurants}
              onCreatePlan={handleCreatePlan}
              onUpdatePlan={handleUpdatePlan}
              onDeletePlan={handleDeletePlan}
              announcementsList={announcementsList}
              onSendAnnouncement={handleSendAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              onClearAll={handleClearAllAnnouncements}
              auditLogs={auditLogs}
              loading={loading}
              onRefresh={loadDashboardData}
              onOptimizeDatabase={handleOptimizeDatabase}
            />
          )}

          {activeView === 'profile' && (
            <ProfileView
              username={username}
              securityForm={securityForm}
              setSecurityForm={setSecurityForm}
              onSaveSecurity={handleSaveSecurity}
              savingSecurity={savingSecurity}
              securityMsg={securityMsg}
              securityError={securityError}
              onLogout={onLogout}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation — 4 Clean Tabs */}
      <BottomNavigation
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Tenant Details Slide-over Drawer */}
      <TenantDetailsView
        resto={selectedRestoDrawer}
        isOpen={!!selectedRestoDrawer}
        onClose={() => setSelectedRestoDrawer(null)}
        onImpersonate={handleImpersonateClick}
        onEdit={(r) => {
          setEditingTenant(r);
          setTenantForm({
            name: r.name, slug: r.slug, owner_username: r.owner_username || 'admin',
            owner_password: '', phone: r.phone || '', address: r.address || '',
            plan_tier: r.plan_tier || 'pro', plan_price: r.plan_price || 999
          });
          setShowAddTenantModal(true);
        }}
        onGrantFree={setGrantModalResto}
        onRevokeFree={setRevokeModalResto}
        onToggleActive={handleToggleActive}
      />

      {/* Grant/Revoke Modals */}
      <GrantFreeAccessModal
        resto={grantModalResto}
        plansList={plansList}
        isOpen={!!grantModalResto}
        onClose={() => setGrantModalResto(null)}
        onConfirmGrant={handleConfirmGrantFree}
      />
      <RevokeFreeAccessModal
        resto={revokeModalResto}
        isOpen={!!revokeModalResto}
        onClose={() => setRevokeModalResto(null)}
        onConfirmRevoke={handleConfirmRevokeFree}
      />

      {/* Add / Edit Tenant Drawer */}
      <Drawer
        isOpen={showAddTenantModal}
        onClose={() => setShowAddTenantModal(false)}
        title={editingTenant ? `Edit: ${editingTenant.name}` : 'Add New Restaurant'}
        subtitle="Set up restaurant, credentials, and plan"
        footer={(<>
          <button onClick={() => setShowAddTenantModal(false)} className="sa-btn sa-btn-secondary">Cancel</button>
          <button onClick={handleSaveTenantSubmit} className="sa-btn sa-btn-primary">
            {editingTenant ? 'Save Changes' : 'Create Restaurant'}
          </button>
        </>)}
      >
        <form onSubmit={handleSaveTenantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>RESTAURANT NAME:</label>
            <input type="text" required placeholder="e.g. Royal Spice Restaurant" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>URL SLUG:</label>
            <input type="text" required disabled={!!editingTenant} placeholder="e.g. royal-spice" value={tenantForm.slug} onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>OWNER USERNAME:</label>
            <input type="text" required placeholder="admin" value={tenantForm.owner_username} onChange={(e) => setTenantForm({ ...tenantForm, owner_username: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
              PASSWORD {editingTenant ? '(LEAVE BLANK TO KEEP)' : ''}:
            </label>
            <input type="password" required={!editingTenant} placeholder="••••••••" value={tenantForm.owner_password} onChange={(e) => setTenantForm({ ...tenantForm, owner_password: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>PLAN TIER:</label>
            <select value={tenantForm.plan_tier} onChange={(e) => { const key = e.target.value; const found = plansList.find(p => p.key === key); setTenantForm({ ...tenantForm, plan_tier: key, plan_price: found ? found.price : 999 }); }} style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)', fontWeight: 700 }}>
              {(plansList.length > 0 ? plansList : [{ key: 'pro', name: 'Pro Plan', price: 999 }]).map(p => (
                <option key={p.key} value={p.key}>{p.name || p.key.toUpperCase()} (₹{p.price}/mo)</option>
              ))}
            </select>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
