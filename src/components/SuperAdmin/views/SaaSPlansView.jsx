import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Save, CheckCircle2, Sparkles, AlertCircle, RefreshCw, 
  Plus, X, Edit3, Trash2, Users, Palette, Check,
  Utensils, Building2, Film, ShieldCheck, Bed, Tv, Zap, Bell, Clock
} from 'lucide-react';
import { SectionHeader } from '../components';

const toBoolInt = (val) => {
  if (val === undefined || val === null) return 1;
  return (val === 1 || val === true || val === '1' || val === 'true') ? 1 : 0;
};

// Clean plan header label generator: prevents duplicated words like "BASIC BASIC STARTER PLAN"
const getPlanDisplayLabel = (plan) => {
  if (!plan) return '';
  const rawBadge = String(plan.badge || '').trim();
  const rawName = String(plan.name || '').trim();

  // Extract leading emoji/symbol from badge if present (e.g. '⚡' from '⚡ BASIC', '👑' from '👑 PRO')
  const emojiMatch = rawBadge.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[⚡👑🚀🏨🎬✨💎🔥])/u);
  const emoji = emojiMatch ? emojiMatch[0] : '';

  if (emoji) {
    return `${emoji} ${rawName}`.trim();
  }

  // If badge doesn't have an emoji, check if badge text is already inside name
  const badgeText = rawBadge.toLowerCase();
  if (badgeText && rawName.toLowerCase().startsWith(badgeText)) {
    return `👑 ${rawName}`;
  }

  return rawBadge ? `${rawBadge} ${rawName}` : `👑 ${rawName}`;
};

const THEME_ACCESS_OPTIONS = [
  { value: 'gold', label: '👑 Standard Gold Theme Only (Default)' },
  { value: 'gold,emerald,crimson,navy', label: '💎 4 Popular Themes (Gold, Emerald, Crimson, Navy)' },
  { value: 'ALL', label: '🌟 All 8 Luxury Themes Unlocked' }
];

const INITIAL_CREATE_FORM = {
  key: '',
  name: '',
  price: '',
  original_price: '',
  badge: '👑 PRO',
  description: '',
  industry: 'restaurant',
  theme_color: 'gold',
  allowed_themes: 'gold,emerald,crimson,navy',
  max_tables: 50,
  tables_enabled: 1,
  cabins_enabled: 0,
  max_cabins: 0,
  vip_enabled: 0,
  max_vip: 0,
  rooms_enabled: 1,
  max_rooms: 60,
  screens_enabled: 1,
  max_screens: 3,
  seats_enabled: 1,
  max_seats: 800,
  max_dishes: 9999,
  max_categories: 9999,
  max_combos: 10,
  max_staff_accounts: 5,
  order_retention_days: 365,
  whatsapp_enabled: 1,
  direct_ordering_enabled: 1,
  kds_enabled: 1,
  bluetooth_kot_enabled: 1,
  dual_printer_enabled: 0,
  audio_alarm_enabled: 1,
  google_reviews_enabled: 1,
  ai_review_enabled: 1,
  gst_invoice_enabled: 1,
  analytics_export_enabled: 1,
  multi_language_enabled: 1,
  watermark_removal_enabled: 1,
  custom_domain_enabled: 1,
  amenities_booking_enabled: 1,
  seat_runner_dispatch_enabled: 1,
  interval_rush_mode_enabled: 1
};

export default function SaaSPlansView({ token, restaurants = [] }) {
  const authToken = token || localStorage.getItem('touchqr_superadmin_token') || localStorage.getItem('token');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('restaurant'); // 'restaurant' | 'hotel' | 'cinema' | 'all'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Create Plan Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  // Edit Single Plan Modal State
  const [editingPlan, setEditingPlan] = useState(null);

  const fetchPlans = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/superadmin/plans', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data);
      } else {
        setErrorMsg('Failed to load SaaS plans data.');
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setErrorMsg('Network error loading SaaS plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) fetchPlans();
  }, [authToken]);

  const handlePlanValueChange = (planKey, field, val) => {
    setHasUnsavedChanges(true);
    setPlans(prev => prev.map(p => p.key === planKey ? { ...p, [field]: val } : p));
  };

  const handleSaveAllPlans = async () => {
    setSaving(true);
    setMsg('');
    setErrorMsg('');
    try {
      for (const p of plans) {
        const directOrderingVal = toBoolInt(p.direct_ordering_enabled);
        const planInd = p.industry || (p.key.startsWith('hotel') ? 'hotel' : p.key.startsWith('cinema') ? 'cinema' : 'restaurant');
        const payload = {
          ...p,
          industry: planInd,
          max_tables: p.max_tables !== undefined ? parseInt(p.max_tables, 10) : 9999,
          tables_enabled: toBoolInt(p.tables_enabled, 1),
          cabins_enabled: toBoolInt(p.cabins_enabled, 0),
          max_cabins: p.max_cabins !== undefined ? parseInt(p.max_cabins, 10) : 0,
          vip_enabled: toBoolInt(p.vip_enabled, 0),
          max_vip: p.max_vip !== undefined ? parseInt(p.max_vip, 10) : 0,
          rooms_enabled: toBoolInt(p.rooms_enabled, 1),
          max_rooms: p.max_rooms !== undefined ? parseInt(p.max_rooms, 10) : 9999,
          screens_enabled: toBoolInt(p.screens_enabled, 1),
          max_screens: p.max_screens !== undefined ? parseInt(p.max_screens, 10) : 9999,
          seats_enabled: toBoolInt(p.seats_enabled, 1),
          max_seats: p.max_seats !== undefined ? parseInt(p.max_seats, 10) : 9999,
          direct_ordering_enabled: directOrderingVal,
          presence_verification_enabled: directOrderingVal,
          amenities_booking_enabled: toBoolInt(p.amenities_booking_enabled),
          seat_runner_dispatch_enabled: toBoolInt(p.seat_runner_dispatch_enabled),
          interval_rush_mode_enabled: toBoolInt(p.interval_rush_mode_enabled),
          allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK',
          theme_color: p.theme_color || 'gold',
          allowed_themes: p.allowed_themes || 'ALL'
        };

        const res = await fetch(`/api/superadmin/plans/${p.key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Failed to update plan '${p.name}'`);
        }
      }
      setHasUnsavedChanges(false);
      setMsg('⚡ All Industry Limits, Permissions & Features Saved Successfully!');
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      console.error('Error saving plans:', err);
      setErrorMsg(err.message || 'Failed to save plan permissions.');
    } finally {
      setSaving(false);
    }
  };

  const isCreateFormValid = Boolean(
    createForm.name.trim() &&
    createForm.key.trim() &&
    createForm.price !== '' &&
    !isNaN(parseFloat(createForm.price)) &&
    parseFloat(createForm.price) >= 0 &&
    createForm.allowed_themes
  );

  const handleCreatePlanSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return alert('Plan Name is required!');
    if (!createForm.key.trim()) return alert('Unique Plan Key is required!');

    const numericPrice = parseFloat(createForm.price);
    if (createForm.price === '' || isNaN(numericPrice) || numericPrice < 0) {
      return alert('Enter a valid monthly price (0 or greater).');
    }

    setCreating(true);
    try {
      const directOrderingVal = toBoolInt(createForm.direct_ordering_enabled);
      const payload = {
        ...createForm,
        name: createForm.name.trim(),
        key: createForm.key.trim().toLowerCase(),
        price: numericPrice,
        original_price: createForm.original_price ? parseFloat(createForm.original_price) : (numericPrice * 2 - 1),
        industry: createForm.industry || 'restaurant',
        max_tables: parseInt(createForm.max_tables, 10) || 50,
        tables_enabled: toBoolInt(createForm.tables_enabled, 1),
        cabins_enabled: toBoolInt(createForm.cabins_enabled, 0),
        max_cabins: parseInt(createForm.max_cabins, 10) || 0,
        vip_enabled: toBoolInt(createForm.vip_enabled, 0),
        max_vip: parseInt(createForm.max_vip, 10) || 0,
        rooms_enabled: toBoolInt(createForm.rooms_enabled, 1),
        max_rooms: parseInt(createForm.max_rooms, 10) || 60,
        screens_enabled: toBoolInt(createForm.screens_enabled, 1),
        max_screens: parseInt(createForm.max_screens, 10) || 3,
        seats_enabled: toBoolInt(createForm.seats_enabled, 1),
        max_seats: parseInt(createForm.max_seats, 10) || 800,
        direct_ordering_enabled: directOrderingVal,
        presence_verification_enabled: directOrderingVal,
        amenities_booking_enabled: toBoolInt(createForm.amenities_booking_enabled),
        seat_runner_dispatch_enabled: toBoolInt(createForm.seat_runner_dispatch_enabled),
        interval_rush_mode_enabled: toBoolInt(createForm.interval_rush_mode_enabled),
        allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK',
        theme_color: createForm.theme_color || 'gold',
        allowed_themes: createForm.allowed_themes || 'gold'
      };

      const res = await fetch('/api/superadmin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create plan');
      setMsg(`✨ SaaS Plan '${createForm.name}' created successfully!`);
      setShowCreateModal(false);
      setCreateForm(INITIAL_CREATE_FORM);
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Error creating plan');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSinglePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSaving(true);
    try {
      const directOrderingVal = toBoolInt(editingPlan.direct_ordering_enabled);
      const planInd = editingPlan.industry || (editingPlan.key.startsWith('hotel') ? 'hotel' : editingPlan.key.startsWith('cinema') ? 'cinema' : 'restaurant');
      const payload = {
        ...editingPlan,
        industry: planInd,
        max_tables: editingPlan.max_tables !== undefined ? parseInt(editingPlan.max_tables, 10) : 9999,
        tables_enabled: toBoolInt(editingPlan.tables_enabled, 1),
        cabins_enabled: toBoolInt(editingPlan.cabins_enabled, 0),
        max_cabins: editingPlan.max_cabins !== undefined ? parseInt(editingPlan.max_cabins, 10) : 0,
        vip_enabled: toBoolInt(editingPlan.vip_enabled, 0),
        max_vip: editingPlan.max_vip !== undefined ? parseInt(editingPlan.max_vip, 10) : 0,
        rooms_enabled: toBoolInt(editingPlan.rooms_enabled, 1),
        max_rooms: editingPlan.max_rooms !== undefined ? parseInt(editingPlan.max_rooms, 10) : 9999,
        screens_enabled: toBoolInt(editingPlan.screens_enabled, 1),
        max_screens: editingPlan.max_screens !== undefined ? parseInt(editingPlan.max_screens, 10) : 9999,
        seats_enabled: toBoolInt(editingPlan.seats_enabled, 1),
        max_seats: editingPlan.max_seats !== undefined ? parseInt(editingPlan.max_seats, 10) : 9999,
        direct_ordering_enabled: directOrderingVal,
        presence_verification_enabled: directOrderingVal,
        amenities_booking_enabled: toBoolInt(editingPlan.amenities_booking_enabled),
        seat_runner_dispatch_enabled: toBoolInt(editingPlan.seat_runner_dispatch_enabled),
        interval_rush_mode_enabled: toBoolInt(editingPlan.interval_rush_mode_enabled),
        allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK',
        theme_color: editingPlan.theme_color || 'gold',
        allowed_themes: editingPlan.allowed_themes || 'ALL'
      };

      const res = await fetch(`/api/superadmin/plans/${editingPlan.key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to update plan '${editingPlan.name}'`);
      }
      setMsg(`⚡ Plan '${editingPlan.name}' updated successfully!`);
      setEditingPlan(null);
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planKey, planName) => {
    const protectedPlans = [
      'basic', 'pro', 'enterprise', 
      'hotel_basic', 'hotel_pro', 'hotel_enterprise', 
      'cinema_basic', 'cinema_pro', 'cinema_enterprise'
    ];
    if (protectedPlans.includes(planKey.toLowerCase())) {
      return alert('Standard system plans (Basic, Pro, Enterprise across all industries) cannot be deleted.');
    }
    const confirmDelete = window.confirm(`Are you sure you want to delete custom plan "${planName}"? Any businesses currently on this plan will be safely migrated to the Pro plan for their industry.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/superadmin/plans/${planKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete plan');
      setMsg(data.message || `Plan "${planName}" deleted successfully!`);
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Failed to delete plan');
    }
  };

  // Helper to categorize plans cleanly by industry
  const resolveIndustry = (p) => {
    if (p.industry) return p.industry.toLowerCase();
    const key = (p.key || '').toLowerCase();
    if (key.startsWith('hotel')) return 'hotel';
    if (key.startsWith('cinema')) return 'cinema';
    return 'restaurant';
  };

  const restaurantPlans = useMemo(() => plans.filter(p => resolveIndustry(p) === 'restaurant'), [plans]);
  const hotelPlans = useMemo(() => plans.filter(p => resolveIndustry(p) === 'hotel'), [plans]);
  const cinemaPlans = useMemo(() => plans.filter(p => resolveIndustry(p) === 'cinema'), [plans]);

  // Plans displayed based on selected tab
  const displayedPlans = useMemo(() => {
    if (selectedIndustry === 'restaurant') return restaurantPlans;
    if (selectedIndustry === 'hotel') return hotelPlans;
    if (selectedIndustry === 'cinema') return cinemaPlans;
    return plans;
  }, [selectedIndustry, plans, restaurantPlans, hotelPlans, cinemaPlans]);

  const protectedPlans = [
    'basic', 'pro', 'enterprise',
    'hotel_basic', 'hotel_pro', 'hotel_enterprise',
    'cinema_basic', 'cinema_pro', 'cinema_enterprise'
  ];

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--sa-text-muted)' }}>
        <RefreshCw className="animate-spin" style={{ width: '32px', height: '32px', margin: '0 auto 14px auto', color: 'var(--sa-primary)' }} />
        <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--sa-text-main)' }}>Loading SaaS Plans & Feature Matrix...</p>
      </div>
    );
  }

  const renderPlanCard = (p) => {
    const subscriberCount = (restaurants || []).filter(r => (r.plan_tier || 'pro').toLowerCase() === p.key.toLowerCase()).length;
    const isProtected = protectedPlans.includes(p.key.toLowerCase());
    const isPopular = p.key.toLowerCase().endsWith('_pro') || p.key.toLowerCase() === 'pro';
    const themeBadge = getThemeSummaryBadge(p.allowed_themes);
    const ind = resolveIndustry(p);

    const indStyles = ind === 'hotel' 
      ? { label: '🏨 Hotel & Resort', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' }
      : ind === 'cinema'
        ? { label: '🎬 Cinema', color: '#7E22CE', bg: '#F5F3FF', border: '#E9D5FF' }
        : { label: '🍽️ Restaurant', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' };

    return (
      <div
        key={p.key}
        className="sa-stat-card hover-lift"
        style={{
          padding: '22px',
          border: isPopular ? '2px solid var(--sa-accent)' : '1px solid var(--sa-border)',
          borderRadius: 'var(--sa-radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px',
          position: 'relative',
          background: 'var(--sa-surface)',
          boxShadow: isPopular ? '0 8px 24px rgba(212, 175, 55, 0.12)' : '0 4px 14px rgba(0,0,0,0.03)'
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  color: isPopular ? '#0A2315' : 'var(--sa-text-main)',
                  background: isPopular ? 'var(--sa-accent-light)' : 'var(--sa-surface-subtle)',
                  border: isPopular ? '1px solid var(--sa-accent)' : '1px solid var(--sa-border)',
                  padding: '2px 8px',
                  borderRadius: 'var(--sa-radius-full)',
                  textTransform: 'uppercase'
                }}>
                  {p.badge || '✨ TIER'}
                </span>

                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: indStyles.color,
                  background: indStyles.bg,
                  border: `1px solid ${indStyles.border}`,
                  padding: '2px 8px',
                  borderRadius: 'var(--sa-radius-full)'
                }}>
                  {indStyles.label}
                </span>
              </div>

              <h3 style={{ fontSize: '1.18rem', fontWeight: 900, margin: '10px 0 2px 0', color: 'var(--sa-text-main)' }}>
                {p.name}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontFamily: 'monospace' }}>
                ID: <code style={{ color: 'var(--sa-primary)', fontWeight: 800 }}>{p.key}</code>
              </span>
            </div>

            <span style={{
              fontSize: '0.72rem',
              background: subscriberCount > 0 ? '#DCFCE7' : '#F1F5F9',
              color: subscriberCount > 0 ? '#15803D' : '#64748B',
              border: subscriberCount > 0 ? '1px solid #86EFAC' : '1px solid #E2E8F0',
              padding: '3px 9px',
              borderRadius: 'var(--sa-radius-full)',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Users size={12} /> {subscriberCount} {subscriberCount === 1 ? 'Business' : 'Businesses'}
            </span>
          </div>

          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--sa-primary)', marginBottom: '4px' }}>
            ₹{Number(p.price || 0).toLocaleString()} <span style={{ fontSize: '0.80rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>/ month</span>
          </div>

          {p.original_price && Number(p.original_price) > Number(p.price) && (
            <div style={{ fontSize: '0.74rem', color: '#94A3B8', textDecoration: 'line-through', marginBottom: '8px' }}>
              Regular ₹{Number(p.original_price).toLocaleString()}
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', margin: '0 0 12px 0', minHeight: '34px', lineHeight: 1.4 }}>
            {p.description || 'Standard industry vertical subscription tier.'}
          </p>

          {/* 🎯 Capacity Limit Indicator */}
          <div style={{
            background: indStyles.bg,
            border: `1.5px solid ${indStyles.border}`,
            color: indStyles.color,
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 900,
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{renderCapacityText(p)}</span>
          </div>

          {/* Clean Theme Access Pill */}
          <div style={{
            padding: '5px 9px',
            borderRadius: '8px',
            background: themeBadge.bg,
            border: `1px solid ${themeBadge.border}`,
            color: themeBadge.color,
            fontSize: '0.72rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {themeBadge.text}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--sa-border)', paddingTop: '14px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => setEditingPlan(p)}
            className="sa-btn sa-btn-secondary sa-btn-sm"
            style={{ flex: 1, fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          >
            <Edit3 size={13} /> Edit Tier
          </button>
          {!isProtected && (
            <button
              type="button"
              onClick={() => handleDeletePlan(p.key, p.name)}
              className="sa-btn sa-btn-danger sa-btn-sm"
              style={{ padding: '6px 10px' }}
              title="Delete Custom Plan"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // 🎯 1. INDUSTRY SPECIFIC NUMERICAL LIMIT CONTROLS
  // =========================================================================
  const getNumericFieldsForIndustry = () => {
    const fields = [
      { key: 'price', label: 'Monthly Price (₹)', placeholder: '999' }
    ];

    if (selectedIndustry === 'restaurant') {
      fields.push(
        { key: 'max_tables', label: '🍽️ Max Dining Tables Limit (Quota)', placeholder: '20' },
        { key: 'max_cabins', label: '🛋️ Max Private Cabins Limit (Quota)', placeholder: '4' },
        { key: 'max_vip', label: '👑 Max VIP Lounges Limit (Quota)', placeholder: '2' },
        { key: 'max_dishes', label: '🍲 Max Food Menu Items / Dishes', placeholder: '9999' },
        { key: 'max_categories', label: '📑 Max Menu Categories', placeholder: '9999' },
        { key: 'max_combos', label: '🍱 Max Thali & Combo Deals Quota', placeholder: '10' },
        { key: 'max_staff_accounts', label: '👨‍🍳 Max Waiter / Captain Staff Accounts', placeholder: '5' },
        { key: 'order_retention_days', label: '📅 Order History Retention (Days)', placeholder: '365' }
      );
    } else if (selectedIndustry === 'hotel') {
      fields.push(
        { key: 'max_rooms', label: '🏨 Max Guest Rooms Limit (Quota)', placeholder: '60' },
        { key: 'max_dishes', label: '🛎️ Max Room Service Menu Items', placeholder: '9999' },
        { key: 'max_categories', label: '📑 Max In-Room Dining Categories', placeholder: '9999' },
        { key: 'max_combos', label: '🥂 Max Breakfast & Room Stay Packages', placeholder: '10' },
        { key: 'max_staff_accounts', label: '🛎️ Max Butler & Room Service Staff Accounts', placeholder: '5' },
        { key: 'order_retention_days', label: '📅 Guest Stay & Order History (Days)', placeholder: '365' }
      );
    } else if (selectedIndustry === 'cinema') {
      fields.push(
        { key: 'max_screens', label: '🎬 Max Cinema Screens / Audi Limit (Quota)', placeholder: '3' },
        { key: 'max_seats', label: '💺 Max Auditorium Seats Quota', placeholder: '800' },
        { key: 'max_categories', label: '📑 Max Concessions Categories Quota', placeholder: '9999' },
        { key: 'max_combos', label: '🍿 Max Popcorn & Drink Combo Bundles', placeholder: '10' },
        { key: 'max_dishes', label: '🥤 Max Concessions & Snack Bar Items', placeholder: '9999' },
        { key: 'max_staff_accounts', label: '🎟️ Max Seat Runner & Canteen Staff Accounts', placeholder: '5' },
        { key: 'order_retention_days', label: '📅 Showtimes & Concessions History (Days)', placeholder: '365' }
      );
    } else {
      // Unified / All Plans
      fields.push(
        { key: 'max_tables', label: '🍽️ Max Dining Tables Limit (Restaurant)', placeholder: '50' },
        { key: 'max_rooms', label: '🏨 Max Guest Rooms Limit (Hotel)', placeholder: '60' },
        { key: 'max_screens', label: '🎬 Max Cinema Screens Limit (Cinema)', placeholder: '3' },
        { key: 'max_seats', label: '💺 Max Auditorium Seats Limit (Cinema)', placeholder: '800' },
        { key: 'max_dishes', label: 'Max Dishes / Menu Items Limit', placeholder: '9999' },
        { key: 'max_combos', label: 'Max Combos / Bundles Quota', placeholder: '10' },
        { key: 'max_staff_accounts', label: 'Max Staff Accounts Limit', placeholder: '5' },
        { key: 'order_retention_days', label: 'Order History Retention (Days)', placeholder: '365' }
      );
    }

    return fields;
  };

  // =========================================================================
  // ⚡ 2. INDUSTRY SPECIFIC FEATURE PERMISSIONS CONTROLS
  // =========================================================================
  const getToggleFieldsForIndustry = () => {
    if (selectedIndustry === 'restaurant') {
      return [
        { key: 'tables_enabled', label: '🍽️ Allow Dining Tables (Dine-In Tables)' },
        { key: 'cabins_enabled', label: '🛋️ Allow Private Cabins (Exclusive Dining Suites)' },
        { key: 'vip_enabled', label: '👑 Allow VIP Lounges (Premium Lounges)' },
        { key: 'direct_ordering_enabled', label: '📋 Customer Dining Table QR Ordering & Live Orders Page' },
        { key: 'modifiers_enabled', label: '🌶️ Dish Modifiers & Half/Full Variants' },
        { key: 'whatsapp_ordering_enabled', label: '💬 WhatsApp Customer Food Ordering' },
        { key: 'kds_enabled', label: '🍳 Dedicated Kitchen Display System (KDS Chef Screen)' },
        { key: 'bluetooth_kot_enabled', label: '🖨️ Thermal KOT Printing & Bill Receipts' },
        { key: 'dual_printer_enabled', label: '⚡ Dual Separate Printers (Kitchen KOT + Counter Bill Printers)' },
        { key: 'audio_alarm_enabled', label: '🔔 Real-time Audio Siren Alert on New Table Order' },
        { key: 'google_reviews_enabled', label: '⭐ Google Review Collector' },
        { key: 'ai_review_enabled', label: '🤖 AI Auto-Reply Assistant for Reviews' },
        { key: 'gst_invoice_enabled', label: '🧾 5% / 18% GST Invoicing & Custom Tax Bills' },
        { key: 'analytics_export_enabled', label: '📈 Sales Analytics & Daily CSV Export' },
        { key: 'multi_language_enabled', label: '🌐 Hindi + English Multi-Language Menu' },
        { key: 'watermark_removal_enabled', label: '🏷️ "Powered by TouchQR" Watermark Removal' },
        { key: 'custom_domain_enabled', label: '🌐 Custom Domain Mapping (menu.myresto.com)' }
      ];
    }

    if (selectedIndustry === 'hotel') {
      return [
        { key: 'rooms_enabled', label: '🏨 Allow Guest Rooms (In-Room QR Dining Operations)' },
        { key: 'direct_ordering_enabled', label: '🚪 Guest In-Room QR Food & Beverage Dining (Room Scan)' },
        { key: 'amenities_booking_enabled', label: '🛎️ Hotel Amenities & Guest Services Booking (Spa, Laundry, Towels, Cab)' },
        { key: 'whatsapp_ordering_enabled', label: '💬 WhatsApp Guest Concierge & Butler Chat' },
        { key: 'kds_enabled', label: '🍳 Room Service Pantry KDS Chef Screen' },
        { key: 'bluetooth_kot_enabled', label: '🖨️ Room Service Order Receipt & Kitchen Dispatch Printing' },
        { key: 'dual_printer_enabled', label: '⚡ Dual Printing (Pantry Slip + Front Desk Bill)' },
        { key: 'audio_alarm_enabled', label: '🔔 Real-time Audio Chime on Incoming Room Orders' },
        { key: 'google_reviews_enabled', label: '⭐ TripAdvisor & Google Hotel Reviews Booster' },
        { key: 'ai_review_enabled', label: '🤖 AI Hospitality Review Responder' },
        { key: 'gst_invoice_enabled', label: '🧾 GST Hotel Folio & Room Food Tax Receipt' },
        { key: 'analytics_export_enabled', label: '📈 Room Revenue & In-Room Dining Analytics' },
        { key: 'multi_language_enabled', label: '🌐 International Multi-Language Menu (English, Hindi, etc.)' },
        { key: 'watermark_removal_enabled', label: '🏷️ White-Label Hotel Branding (No TouchQR badge)' },
        { key: 'custom_domain_enabled', label: '🌐 Custom Luxury Hotel Domain (dining.grandpalace.com)' }
      ];
    }

    if (selectedIndustry === 'cinema') {
      return [
        { key: 'screens_enabled', label: '🎬 Allow Cinema Audi Screens' },
        { key: 'seats_enabled', label: '💺 Allow In-Seat Ordering' },
        { key: 'direct_ordering_enabled', label: '💺 In-Seat QR Delivery (Customer orders from Audi Seat)' },
        { key: 'interval_rush_mode_enabled', label: '⚡ Interval Express Rush Mode (15-min interval fast-pass order queue)' },
        { key: 'seat_runner_dispatch_enabled', label: '🏃 Seat Runner Dispatch Routing (Auto-tags Audi, Row & Seat #)' },
        { key: 'whatsapp_ordering_enabled', label: '💬 WhatsApp Concessions Express Counter Pickup' },
        { key: 'kds_enabled', label: '🍿 Popcorn & Fast Food Concessions Kitchen Screen' },
        { key: 'bluetooth_kot_enabled', label: '🖨️ Concessions Runner Dispatch Ticket Printing' },
        { key: 'dual_printer_enabled', label: '⚡ Dual Separate Printers (Concessions Counter + Runner Dispatch)' },
        { key: 'audio_alarm_enabled', label: '🔔 Audio Chime Alert on Incoming Seat Order' },
        { key: 'google_reviews_enabled', label: '⭐ Cinema & Movie Experience Review Collector' },
        { key: 'ai_review_enabled', label: '🤖 AI Review Feedback Analyzer' },
        { key: 'gst_invoice_enabled', label: '🧾 Concessions GST Tax Invoicing' },
        { key: 'analytics_export_enabled', label: '📈 Concessions Per-Capita & Movie-wise Sales Analytics' },
        { key: 'multi_language_enabled', label: '🌐 Multi-Language Snack Menu' },
        { key: 'watermark_removal_enabled', label: '🏷️ Multiplex Custom White-Labeling' },
        { key: 'custom_domain_enabled', label: '🌐 Custom Multiplex Domain (food.cinestar.com)' }
      ];
    }

    // Unified All Plans Table: Universal Master Permissions
    return [
      { key: 'direct_ordering_enabled', label: '📋 Direct Space QR Ordering (Table / Room / Seat)' },
      { key: 'whatsapp_ordering_enabled', label: '💬 WhatsApp Ordering & Concierge' },
      { key: 'kds_enabled', label: '🍳 Kitchen / Pantry / Concessions KDS Screen' },
      { key: 'bluetooth_kot_enabled', label: '🖨️ Thermal KOT / Runner Ticket Printing' },
      { key: 'dual_printer_enabled', label: '⚡ Dual Separate Printers (Kitchen + Counter/Desk)' },
      { key: 'amenities_booking_enabled', label: '🛎️ Hotel Amenities Booking (Hotels Only)' },
      { key: 'seat_runner_dispatch_enabled', label: '🏃 Cinema Seat Runner Dispatch (Cinemas Only)' },
      { key: 'interval_rush_mode_enabled', label: '⚡ Interval Express Rush Mode (Cinemas Only)' },
      { key: 'modifiers_enabled', label: '🌶️ Modifiers & Half/Full Variants (Restaurants Only)' },
      { key: 'google_reviews_enabled', label: '⭐ Google & TripAdvisor Review Collector' },
      { key: 'ai_review_enabled', label: '🤖 AI Auto-Reply Assistant' },
      { key: 'gst_invoice_enabled', label: '🧾 GST Tax Invoicing' },
      { key: 'analytics_export_enabled', label: '📈 Analytics CSV Report Export' },
      { key: 'multi_language_enabled', label: '🌐 Multi-Language Auto Translation' },
      { key: 'watermark_removal_enabled', label: '🏷️ White-Label Watermark Removal' },
      { key: 'custom_domain_enabled', label: '🌐 Custom Web Subdomain' }
    ];
  };

  const getThemeSummaryBadge = (allowedThemes) => {
    const raw = (allowedThemes || 'ALL').trim();
    if (raw === 'ALL' || raw.split(',').length >= 8) {
      return { text: '🎨 All 8 Luxury Themes', color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' };
    }
    if (raw.includes('crimson') || raw.split(',').length >= 4) {
      return { text: '🎨 4 Themes Unlocked', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' };
    }
    return { text: '🎨 Standard Gold Theme', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' };
  };

  const renderCapacityText = (p) => {
    const ind = resolveIndustry(p);
    if (ind === 'hotel') {
      const rooms = Number(p.max_rooms);
      const enabled = p.rooms_enabled !== 0 && p.rooms_enabled !== false;
      if (!enabled) return '🏨 Rooms Disabled';
      return rooms >= 9999 ? 'Unlimited Guest Rooms' : `Up to ${rooms || 60} Guest Rooms`;
    }
    if (ind === 'cinema') {
      const screens = Number(p.max_screens);
      const seats = Number(p.max_seats);
      if (screens >= 9999) return 'Unlimited Screens & Seats';
      return `${screens || 1} Screen${screens > 1 ? 's' : ''} · Up to ${seats || 200} Seats`;
    }
    // Restaurant: Tables, Cabins, Lounges
    const tables = Number(p.max_tables) || 0;
    const cabins = Number(p.max_cabins) || 0;
    const vip = Number(p.max_vip) || 0;
    const tablesOn = p.tables_enabled !== 0 && p.tables_enabled !== false;
    const cabinsOn = p.cabins_enabled === 1 || p.cabins_enabled === true;
    const vipOn = p.vip_enabled === 1 || p.vip_enabled === true;

    const parts = [];
    if (tablesOn) parts.push(tables >= 9999 ? '∞ Tables' : `${tables} Tables`);
    if (cabinsOn) parts.push(cabins >= 9999 ? '∞ Cabins' : `${cabins} Cabins`);
    if (vipOn) parts.push(vip >= 9999 ? '∞ Lounges' : `${vip} Lounges`);
    return parts.length > 0 ? parts.join(' • ') : 'No spaces enabled';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 👑 1. HEADER */}
      <SectionHeader
        title="👑 SaaS Subscription Plans & Industry Controls"
        subtitle="Manage dedicated subscription tiers, limits, quotas, and feature permissions segregated for Restaurants, Hotels, and Cinemas."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={fetchPlans}
              disabled={loading}
              className="sa-btn sa-btn-secondary sa-btn-sm"
              style={{ fontWeight: 800 }}
              title="Refresh SaaS Plans"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setCreateForm({
                  ...INITIAL_CREATE_FORM,
                  industry: selectedIndustry !== 'all' ? selectedIndustry : 'restaurant'
                });
                setShowCreateModal(true);
              }}
              className="sa-btn sa-btn-secondary sa-btn-sm"
              style={{ fontWeight: 800 }}
            >
              <Plus size={14} /> Create Custom Plan
            </button>

            <button
              type="button"
              onClick={handleSaveAllPlans}
              disabled={saving}
              className="sa-btn sa-btn-accent sa-btn-sm"
              style={{ 
                fontWeight: 900,
                position: 'relative',
                boxShadow: hasUnsavedChanges ? '0 0 0 2px #F59E0B, 0 4px 12px rgba(245, 158, 11, 0.4)' : 'none'
              }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes (Unsaved)*' : 'Save All Plan Permissions'}
            </button>
          </div>
        }
      />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 style={{ width: '18px', height: '18px' }} /> {msg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEE2E2', color: '#B91C1C', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle style={{ width: '18px', height: '18px' }} /> {errorMsg}
        </div>
      )}

      {/* 🏢 2. INDUSTRY VERTICAL SELECTOR TABS */}
      <div style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: '#FFFFFF',
        padding: '12px 16px',
        borderRadius: 'var(--sa-radius-lg)',
        border: '1px solid var(--sa-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <span style={{ fontSize: '0.80rem', fontWeight: 900, color: 'var(--sa-text-muted)', marginRight: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Vertical Controls:
        </span>

        {[
          { id: 'restaurant', label: '🍽️ Restaurant / Cafe', icon: Utensils, count: restaurantPlans.length, color: '#047857', bg: '#ECFDF5' },
          { id: 'hotel', label: '🏨 Hotel & Resort', icon: Building2, count: hotelPlans.length, color: '#1E40AF', bg: '#EFF6FF' },
          { id: 'cinema', label: '🎬 Cinema & Multiplex', icon: Film, count: cinemaPlans.length, color: '#7E22CE', bg: '#F5F3FF' },
          { id: 'all', label: '🌐 All Plans (Unified)', icon: Layers, count: plans.length, color: '#0F172A', bg: '#F1F5F9' }
        ].map(tab => {
          const isActive = selectedIndustry === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedIndustry(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: 'var(--sa-radius-full)',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isActive ? `2px solid ${tab.color}` : '1px solid var(--sa-border)',
                background: isActive ? tab.color : '#FFFFFF',
                color: isActive ? '#FFFFFF' : 'var(--sa-text-main)',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.12)' : 'none'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: isActive ? 'rgba(255, 255, 255, 0.25)' : tab.bg,
                color: isActive ? '#FFFFFF' : tab.color,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 900
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 📦 3. PLAN SUMMARY CARDS ROW */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--sa-primary)" />
              {selectedIndustry === 'restaurant' && '🍽️ Restaurant / Cafe Vertical (₹499 Basic · ₹999 Pro · ₹1,999 Enterprise)'}
              {selectedIndustry === 'hotel' && '🏨 Hotel & Resort Vertical (₹999 Basic · ₹1,999 Pro · ₹3,499 Enterprise)'}
              {selectedIndustry === 'cinema' && '🎬 Cinema & Multiplex Vertical (₹1,499 Basic · ₹2,999 Pro · ₹4,999 Enterprise)'}
              {selectedIndustry === 'all' && `🌐 All Industry Plans Catalog (${plans.length} Tiers)`}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              {selectedIndustry === 'restaurant' && 'Dedicated Table Quotas, KDS Kitchen Chef Screens, Dual Printers & WhatsApp Customer Ordering.'}
              {selectedIndustry === 'hotel' && 'Dedicated Guest Room Quotas, In-Room QR Dining, Amenities Requests & Pantry Dispatch KDS.'}
              {selectedIndustry === 'cinema' && 'Dedicated Screens & Auditorium Seat Quotas, In-Seat Delivery, Interval Rush Pass & Concessions KDS.'}
              {selectedIndustry === 'all' && 'Master view across all three business verticals.'}
            </span>
          </div>
          <span style={{ fontSize: '0.76rem', background: '#F1F5F9', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, color: '#334155' }}>
            {displayedPlans.length} Active {displayedPlans.length === 1 ? 'Tier' : 'Tiers'}
          </span>
        </div>

{selectedIndustry === 'all' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 🍽️ Restaurant Section */}
            <div style={{ background: '#FFFFFF', border: '1.5px solid #A7F3D0', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(4, 120, 87, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #A7F3D0' }}>
                    <Utensils size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#047857' }}>🍽️ Restaurant & Cafe Vertical Plans</h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Dine-In Tables Quotas, Kitchen KDS, Dual Printing & WhatsApp Ordering</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIndustry('restaurant')}
                  className="sa-btn sa-btn-secondary sa-btn-sm"
                  style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857', borderColor: '#A7F3D0' }}
                >
                  Configure Restaurant Matrix →
                </button>
              </div>
              <div className="sa-plan-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {restaurantPlans.map(renderPlanCard)}
              </div>
            </div>

            {/* 🏨 Hotel Section */}
            <div style={{ background: '#FFFFFF', border: '1.5px solid #BFDBFE', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(30, 64, 175, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF6FF', color: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #BFDBFE' }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#1E40AF' }}>🏨 Hotel & Resort In-Room Dining Plans</h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Guest Room QR Quotas, Amenities Requests & Room Service Pantry KDS</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIndustry('hotel')}
                  className="sa-btn sa-btn-secondary sa-btn-sm"
                  style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1E40AF', borderColor: '#BFDBFE' }}
                >
                  Configure Hotel Matrix →
                </button>
              </div>
              <div className="sa-plan-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {hotelPlans.map(renderPlanCard)}
              </div>
            </div>

            {/* 🎬 Cinema Section */}
            <div style={{ background: '#FFFFFF', border: '1.5px solid #E9D5FF', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(126, 34, 206, 0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F5F3FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E9D5FF' }}>
                    <Film size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: '#7E22CE' }}>🎬 Cinema & Multiplex In-Seat Delivery Plans</h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Audi Screen & Seat Quotas, Interval Rush Mode & Concessions Runner Dispatch</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIndustry('cinema')}
                  className="sa-btn sa-btn-secondary sa-btn-sm"
                  style={{ fontSize: '0.74rem', fontWeight: 800, color: '#7E22CE', borderColor: '#E9D5FF' }}
                >
                  Configure Cinema Matrix →
                </button>
              </div>
              <div className="sa-plan-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {cinemaPlans.map(renderPlanCard)}
              </div>
            </div>
          </div>
        ) : (
          <div className="sa-plan-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {displayedPlans.map(renderPlanCard)}
          </div>
        )}
      </div>

      {/* 📊 4. TABLE SECTION (EXECUTIVE CATALOG FOR ALL, DETAILED MATRIX FOR VERTICAL) */}
      {selectedIndustry === 'all' ? (
        <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: 'var(--sa-radius-lg)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--sa-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="var(--sa-primary)" />
                🌐 Executive Master Plans Catalog ({plans.length} Tiers Across 3 Verticals)
              </h3>
              <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                High-level overview of pricing, quotas, capabilities, and active tenants. To configure granular feature checkboxes and limits, click any vertical tab above or the 'Configure Matrix' button.
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-primary)', background: '#F1F5F9', padding: '5px 12px', borderRadius: '8px' }}>
              Total Tiers: {plans.length}
            </span>
          </div>

          <table className="sa-table" style={{ minWidth: '980px' }}>
            <thead>
              <tr>
                <th style={{ width: '24%' }}>TIER & PLAN NAME</th>
                <th style={{ width: '13%' }}>VERTICAL</th>
                <th style={{ width: '12%' }}>MONTHLY PRICE</th>
                <th style={{ width: '16%' }}>CAPACITY LIMIT (QUOTA)</th>
                <th style={{ width: '20%' }}>CORE SYSTEM CAPABILITIES</th>
                <th style={{ width: '7%', textAlign: 'center' }}>USERS</th>
                <th style={{ width: '8%', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => {
                const ind = resolveIndustry(p);
                const subscriberCount = (restaurants || []).filter(r => (r.plan_tier || 'pro').toLowerCase() === p.key.toLowerCase()).length;
                const isProtected = protectedPlans.includes(p.key.toLowerCase());
                const themeBadge = getThemeSummaryBadge(p.allowed_themes);
                const indBadge = ind === 'hotel' 
                  ? { label: '🏨 Hotel & Resort', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' }
                  : ind === 'cinema' 
                    ? { label: '🎬 Cinema', color: '#7E22CE', bg: '#F5F3FF', border: '#E9D5FF' }
                    : { label: '🍽️ Restaurant', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' };

                return (
                  <tr key={p.key} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.66rem', fontWeight: 900, background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {p.badge || '✨ TIER'}
                          </span>
                          <strong style={{ fontSize: '0.90rem', color: '#0F172A' }}>{p.name}</strong>
                        </div>
                        <span style={{ fontSize: '0.70rem', color: '#64748B', fontFamily: 'monospace' }}>
                          ID: <code style={{ color: 'var(--sa-primary)', fontWeight: 700 }}>{p.key}</code>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 800, 
                        color: indBadge.color, 
                        background: indBadge.bg, 
                        border: `1px solid ${indBadge.border}`, 
                        padding: '3px 8px', 
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {indBadge.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '0.96rem', color: 'var(--sa-primary)', fontWeight: 900 }}>
                          ₹{Number(p.price || 0).toLocaleString()}
                        </strong>
                        <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>/ month</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>
                        {renderCapacityText(p)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {p.direct_ordering_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                            ⚡ Direct QR
                          </span>
                        ) : null}
                        {p.kds_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#EFF6FF', color: '#1E40AF', padding: '2px 6px', borderRadius: '4px', border: '1px solid #BFDBFE' }}>
                            🍳 KDS Screen
                          </span>
                        ) : null}
                        {p.dual_printer_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FCD34D' }}>
                            ⚡ Dual Print
                          </span>
                        ) : p.bluetooth_kot_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#F1F5F9', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                            🖨️ KOT Thermal
                          </span>
                        ) : null}
                        {p.whatsapp_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px' }}>
                            💬 WhatsApp
                          </span>
                        ) : null}
                        {ind === 'hotel' && p.amenities_booking_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#F3E8FF', color: '#7E22CE', padding: '2px 6px', borderRadius: '4px' }}>
                            🛎️ Amenities
                          </span>
                        ) : null}
                        {ind === 'cinema' && p.interval_rush_mode_enabled ? (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, background: '#F5F3FF', color: '#7E22CE', padding: '2px 6px', borderRadius: '4px' }}>
                            ⚡ Rush Pass
                          </span>
                        ) : null}
                        <span style={{ fontSize: '0.64rem', fontWeight: 800, background: themeBadge.bg, color: themeBadge.color, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${themeBadge.border}` }}>
                          {themeBadge.text}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        color: subscriberCount > 0 ? '#15803D' : '#64748B',
                        background: subscriberCount > 0 ? '#DCFCE7' : '#F1F5F9',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Users size={11} /> {subscriberCount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedIndustry(ind)}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ fontSize: '0.70rem', padding: '4px 8px', fontWeight: 800, color: indBadge.color, borderColor: indBadge.border }}
                          title={`Configure ${ind.toUpperCase()} Matrix`}
                        >
                          Matrix →
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPlan(p)}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ fontSize: '0.70rem', padding: '4px 7px' }}
                          title="Edit Plan"
                        >
                          <Edit3 size={12} />
                        </button>
                        {!isProtected && (
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(p.key, p.name)}
                            className="sa-btn sa-btn-danger sa-btn-sm"
                            style={{ padding: '4px 7px' }}
                            title="Delete Custom Plan"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: 'var(--sa-radius-lg)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sa-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                ⚡ {selectedIndustry === 'restaurant' ? '🍽️ Restaurant & Cafe' : selectedIndustry === 'hotel' ? '🏨 Hotel & Resort' : '🎬 Cinema & Multiplex'} Feature & Permissions Matrix
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                Dedicated limits, quotas, and feature toggles for {displayedPlans.length} visible tiers
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-primary)', background: '#F1F5F9', padding: '4px 10px', borderRadius: '6px' }}>
              Tiers: {displayedPlans.length}
            </span>
          </div>

          <table className="sa-table" style={{ minWidth: '850px' }}>
            <thead>
              <tr>
                <th style={{ width: '38%' }}>FEATURE / CAPACITY PERMISSION</th>
                {displayedPlans.map(p => {
                  const ind = resolveIndustry(p);
                  return (
                    <th key={p.key} style={{ color: 'var(--sa-primary)', fontWeight: 900, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: ind === 'hotel' ? '#EFF6FF' : ind === 'cinema' ? '#F5F3FF' : '#ECFDF5', color: ind === 'hotel' ? '#1E40AF' : ind === 'cinema' ? '#7E22CE' : '#047857' }}>
                          {ind.toUpperCase()}
                        </span>
                        <span>{getPlanDisplayLabel(p)}</span>
                        <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 600 }}>₹{p.price}/mo</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* THEME ACCESS SECTION */}
              <tr style={{ background: 'var(--sa-surface-subtle)' }}>
                <td colSpan={displayedPlans.length + 1} style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sa-primary)', letterSpacing: '0.03em' }}>
                  🎨 LUXURY BRAND THEMES ACCESS CONTROL
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Palette size={16} color="var(--sa-accent)" />
                    <div>
                      <div>Allowed Brand Theme Engine</div>
                      <div style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Themes available for shops subscribed to this plan</div>
                    </div>
                  </div>
                </td>
                {displayedPlans.map(p => {
                  const currentVal = (p.allowed_themes || 'ALL').trim();
                  let normalizedVal = 'ALL';
                  if (currentVal === 'gold') normalizedVal = 'gold';
                  else if (currentVal.includes('crimson') || currentVal.includes('emerald')) normalizedVal = 'gold,emerald,crimson,navy';

                  return (
                    <td key={p.key} style={{ textAlign: 'center' }}>
                      <select
                        value={normalizedVal}
                        onChange={(e) => handlePlanValueChange(p.key, 'allowed_themes', e.target.value)}
                        className="sa-input"
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          width: '100%',
                          maxWidth: '190px'
                        }}
                      >
                        <option value="ALL">🌟 All 8 Themes (Luxury)</option>
                        <option value="gold,emerald,crimson,navy">💎 4 Popular Themes</option>
                        <option value="gold">👑 Gold Theme Only</option>
                      </select>
                    </td>
                  );
                })}
              </tr>

              {/* NUMERICAL LIMITS SECTION */}
              <tr style={{ background: 'var(--sa-surface-subtle)' }}>
                <td colSpan={displayedPlans.length + 1} style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sa-primary)', letterSpacing: '0.03em' }}>
                  📊 {selectedIndustry === 'restaurant' ? '🍽️ RESTAURANT' : selectedIndustry === 'hotel' ? '🏨 HOTEL' : '🎬 CINEMA'} LIMITS & CAPACITY CONTROLS
                </td>
              </tr>
              {getNumericFieldsForIndustry().map(f => (
                <tr key={f.key}>
                  <td style={{ fontWeight: 800 }}>
                    {f.label}
                  </td>
                  {displayedPlans.map(p => {
                    const val = p[f.key];
                    const isUnlimited = val === 9999;
                    return (
                      <td key={p.key} style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            value={val !== undefined && val !== null ? val : ''}
                            onChange={(e) => handlePlanValueChange(p.key, f.key, parseFloat(e.target.value) || 0)}
                            placeholder={f.placeholder}
                            className="sa-input"
                            style={{
                              maxWidth: '110px',
                              height: '34px',
                              padding: '4px 8px',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              textAlign: 'center'
                            }}
                          />
                          {isUnlimited && (
                            <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 900 }} title="9999 represents Unlimited">
                              ♾️
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* BOOLEAN FEATURE PERMISSIONS SECTION */}
              <tr style={{ background: 'var(--sa-surface-subtle)' }}>
                <td colSpan={displayedPlans.length + 1} style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sa-primary)', letterSpacing: '0.03em' }}>
                  ⚡ {selectedIndustry === 'restaurant' ? '🍽️ RESTAURANT' : selectedIndustry === 'hotel' ? '🏨 HOTEL' : '🎬 CINEMA'} DEDICATED FEATURE PERMISSIONS (ON / OFF)
                </td>
              </tr>
              {getToggleFieldsForIndustry().map(f => (
                <tr key={f.key}>
                  <td style={{ fontWeight: 800 }}>
                    {f.label}
                  </td>
                  {displayedPlans.map(p => {
                    const isChecked = Boolean(p[f.key] !== 0 && p[f.key] !== false && p[f.key] !== '0');
                    return (
                      <td key={p.key} style={{ textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handlePlanValueChange(p.key, f.key, e.target.checked ? 1 : 0)}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--sa-primary)',
                              cursor: 'pointer'
                            }}
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ✏️ 5. EDIT SINGLE PLAN MODAL */}
      {editingPlan && (
        <div 
          className="sa-modal-overlay"
          onClick={() => setEditingPlan(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditingPlan(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-plan-title"
        >
          <div className="sa-modal-box" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--sa-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="var(--sa-primary)" />
                <h3 id="edit-plan-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>Edit Plan: {editingPlan.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                aria-label="Close Edit Plan Modal"
                style={{ background: 'none', border: 'none', color: 'var(--sa-text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSinglePlan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>INDUSTRY VERTICAL</label>
                <select
                  value={editingPlan.industry || resolveIndustry(editingPlan)}
                  onChange={e => setEditingPlan({ ...editingPlan, industry: e.target.value })}
                  className="sa-input"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value="restaurant">🍽️ Restaurant & Cafe</option>
                  <option value="hotel">🏨 Hotel & Resort</option>
                  <option value="cinema">🎬 Cinema & Multiplex</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DISPLAY NAME *</label>
                <input
                  type="text"
                  required
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="sa-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MONTHLY PRICE (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={editingPlan.price}
                    onChange={e => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })}
                    className="sa-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>BADGE / EMOJI</label>
                  <input
                    type="text"
                    value={editingPlan.badge || ''}
                    onChange={e => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                    className="sa-input"
                  />
                </div>
              </div>

              {/* Dynamic Capacity & Spaces Allocation Controls */}
              {(editingPlan.industry === 'hotel' || resolveIndustry(editingPlan) === 'hotel') ? (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 800, marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={editingPlan.rooms_enabled !== 0 && editingPlan.rooms_enabled !== false}
                      onChange={e => setEditingPlan({ ...editingPlan, rooms_enabled: e.target.checked ? 1 : 0 })}
                    />
                    🏨 Allow Guest Rooms (In-Room QR Dining)
                  </label>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MAX GUEST ROOMS LIMIT (QUOTA)</label>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={editingPlan.max_rooms || 60}
                    onChange={e => setEditingPlan({ ...editingPlan, max_rooms: parseInt(e.target.value, 10) || 60 })}
                    className="sa-input"
                  />
                </div>
              ) : (editingPlan.industry === 'cinema' || resolveIndustry(editingPlan) === 'cinema') ? (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={editingPlan.screens_enabled !== 0 && editingPlan.screens_enabled !== false}
                          onChange={e => setEditingPlan({ ...editingPlan, screens_enabled: e.target.checked ? 1 : 0 })}
                        />
                        🎬 Allow Screens
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={editingPlan.max_screens || 3}
                        onChange={e => setEditingPlan({ ...editingPlan, max_screens: parseInt(e.target.value, 10) || 3 })}
                        className="sa-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={editingPlan.seats_enabled !== 0 && editingPlan.seats_enabled !== false}
                          onChange={e => setEditingPlan({ ...editingPlan, seats_enabled: e.target.checked ? 1 : 0 })}
                        />
                        💺 Allow In-Seat Orders
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={editingPlan.max_seats || 800}
                        onChange={e => setEditingPlan({ ...editingPlan, max_seats: parseInt(e.target.value, 10) || 800 })}
                        className="sa-input"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 900, color: '#1E293B', textTransform: 'uppercase' }}>
                    🏢 Physical Space Allocations & Plan Limits:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    {/* Tables */}
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={editingPlan.tables_enabled !== 0 && editingPlan.tables_enabled !== false}
                          onChange={e => setEditingPlan({ ...editingPlan, tables_enabled: e.target.checked ? 1 : 0 })}
                        />
                        🍽️ Tables
                      </label>
                      <label style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Max Tables</label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={editingPlan.max_tables ?? 20}
                        onChange={e => setEditingPlan({ ...editingPlan, max_tables: parseInt(e.target.value, 10) || 0 })}
                        className="sa-input"
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                    {/* Cabins */}
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={editingPlan.cabins_enabled === 1 || editingPlan.cabins_enabled === true}
                          onChange={e => setEditingPlan({ ...editingPlan, cabins_enabled: e.target.checked ? 1 : 0 })}
                        />
                        🛋️ Cabins
                      </label>
                      <label style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Max Cabins</label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={editingPlan.max_cabins ?? 0}
                        onChange={e => setEditingPlan({ ...editingPlan, max_cabins: parseInt(e.target.value, 10) || 0 })}
                        className="sa-input"
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                    {/* VIP Lounges */}
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={editingPlan.vip_enabled === 1 || editingPlan.vip_enabled === true}
                          onChange={e => setEditingPlan({ ...editingPlan, vip_enabled: e.target.checked ? 1 : 0 })}
                        />
                        👑 Lounges
                      </label>
                      <label style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Max Lounges</label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={editingPlan.max_vip ?? 0}
                        onChange={e => setEditingPlan({ ...editingPlan, max_vip: parseInt(e.target.value, 10) || 0 })}
                        className="sa-input"
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dedicated Feature Toggles in Modal */}
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid var(--sa-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase' }}>
                  Key Feature Permissions:
                </span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.direct_ordering_enabled !== 0 && editingPlan.direct_ordering_enabled !== false}
                    onChange={e => setEditingPlan({ ...editingPlan, direct_ordering_enabled: e.target.checked ? 1 : 0 })}
                    style={{ accentColor: 'var(--sa-primary)' }}
                  />
                  <span>
                    {(editingPlan.industry === 'hotel' || resolveIndustry(editingPlan) === 'hotel')
                      ? '🚪 In-Room QR Dining Enabled'
                      : (editingPlan.industry === 'cinema' || resolveIndustry(editingPlan) === 'cinema')
                        ? '💺 In-Seat QR Delivery Enabled'
                        : '📋 Customer Dining Table QR Ordering'}
                  </span>
                </label>

                {(editingPlan.industry === 'hotel' || resolveIndustry(editingPlan) === 'hotel') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={editingPlan.amenities_booking_enabled !== 0 && editingPlan.amenities_booking_enabled !== false}
                      onChange={e => setEditingPlan({ ...editingPlan, amenities_booking_enabled: e.target.checked ? 1 : 0 })}
                      style={{ accentColor: 'var(--sa-primary)' }}
                    />
                    <span>🛎️ Hotel Amenities & Guest Services Booking</span>
                  </label>
                )}

                {(editingPlan.industry === 'cinema' || resolveIndustry(editingPlan) === 'cinema') && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={editingPlan.interval_rush_mode_enabled !== 0 && editingPlan.interval_rush_mode_enabled !== false}
                        onChange={e => setEditingPlan({ ...editingPlan, interval_rush_mode_enabled: e.target.checked ? 1 : 0 })}
                        style={{ accentColor: 'var(--sa-primary)' }}
                      />
                      <span>⚡ Interval Express Rush Mode (15-min queue)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={editingPlan.seat_runner_dispatch_enabled !== 0 && editingPlan.seat_runner_dispatch_enabled !== false}
                        onChange={e => setEditingPlan({ ...editingPlan, seat_runner_dispatch_enabled: e.target.checked ? 1 : 0 })}
                        style={{ accentColor: 'var(--sa-primary)' }}
                      />
                      <span>🏃 Seat Runner Dispatch Screen (Audi + Row + Seat)</span>
                    </label>
                  </>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.whatsapp_enabled !== 0 && editingPlan.whatsapp_enabled !== false}
                    onChange={e => setEditingPlan({ ...editingPlan, whatsapp_enabled: e.target.checked ? 1 : 0, whatsapp_ordering_enabled: e.target.checked ? 1 : 0 })}
                    style={{ accentColor: 'var(--sa-primary)' }}
                  />
                  <span>💬 WhatsApp Ordering / Concierge Chat</span>
                </label>
              </div>

              {/* Theme Access Dropdown */}
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                  THEME ACCESS LEVEL
                </label>
                <select
                  value={editingPlan.allowed_themes || 'gold'}
                  onChange={e => setEditingPlan({ ...editingPlan, allowed_themes: e.target.value })}
                  className="sa-input"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  {THEME_ACCESS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MARKETING DESCRIPTION</label>
                <input
                  type="text"
                  value={editingPlan.description || ''}
                  onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="sa-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="sa-btn sa-btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="sa-btn sa-btn-accent"
                  style={{ padding: '8px 20px', fontWeight: 900 }}
                >
                  {saving ? 'Saving...' : 'Save Plan Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✨ 6. CREATE PLAN MODAL */}
      {showCreateModal && (
        <div 
          className="sa-modal-overlay"
          onClick={() => setShowCreateModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowCreateModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-plan-title"
        >
          <div className="sa-modal-box" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--sa-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--sa-accent)" />
                <h3 id="create-plan-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>Create Custom SaaS Plan Tier</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close Create Plan Modal"
                style={{ background: 'none', border: 'none', color: 'var(--sa-text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                  INDUSTRY VERTICAL <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={createForm.industry}
                  onChange={e => setCreateForm({ ...createForm, industry: e.target.value })}
                  className="sa-input"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value="restaurant">🍽️ Restaurant & Cafe</option>
                  <option value="hotel">🏨 Hotel & Resort</option>
                  <option value="cinema">🎬 Cinema & Multiplex</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                  PLAN NAME <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hotel Presidential Suite Plan"
                  value={createForm.name}
                  onChange={e => setCreateForm({ 
                    ...createForm, 
                    name: e.target.value, 
                    key: createForm.key || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') 
                  })}
                  className="sa-input"
                  aria-required="true"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                    PLAN KEY (UNIQUE) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. hotel_presidential"
                    value={createForm.key}
                    onChange={e => setCreateForm({ ...createForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="sa-input"
                    aria-required="true"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                    MONTHLY PRICE (₹) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="2499"
                    value={createForm.price}
                    onChange={e => setCreateForm({ ...createForm, price: e.target.value })}
                    className="sa-input"
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Dynamic Capacity inputs based on selected industry */}
              {createForm.industry === 'hotel' ? (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 800, marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={createForm.rooms_enabled !== 0 && createForm.rooms_enabled !== false}
                      onChange={e => setCreateForm({ ...createForm, rooms_enabled: e.target.checked ? 1 : 0 })}
                    />
                    🏨 Allow Guest Rooms (In-Room QR Dining)
                  </label>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MAX GUEST ROOMS LIMIT (QUOTA)</label>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={createForm.max_rooms}
                    onChange={e => setCreateForm({ ...createForm, max_rooms: parseInt(e.target.value, 10) || 60 })}
                    className="sa-input"
                  />
                </div>
              ) : createForm.industry === 'cinema' ? (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={createForm.screens_enabled !== 0 && createForm.screens_enabled !== false}
                          onChange={e => setCreateForm({ ...createForm, screens_enabled: e.target.checked ? 1 : 0 })}
                        />
                        🎬 Allow Screens
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={createForm.max_screens}
                        onChange={e => setCreateForm({ ...createForm, max_screens: parseInt(e.target.value, 10) || 3 })}
                        className="sa-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={createForm.seats_enabled !== 0 && createForm.seats_enabled !== false}
                          onChange={e => setCreateForm({ ...createForm, seats_enabled: e.target.checked ? 1 : 0 })}
                        />
                        💺 Allow In-Seat Orders
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={createForm.max_seats}
                        onChange={e => setCreateForm({ ...createForm, max_seats: parseInt(e.target.value, 10) || 800 })}
                        className="sa-input"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 900, color: '#1E293B', textTransform: 'uppercase' }}>
                    🏢 Physical Space Allocations & Plan Limits:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={createForm.tables_enabled !== 0 && createForm.tables_enabled !== false}
                          onChange={e => setCreateForm({ ...createForm, tables_enabled: e.target.checked ? 1 : 0 })}
                        />
                        🍽️ Tables
                      </label>
                      <label style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Max Tables</label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={createForm.max_tables ?? 20}
                        onChange={e => setCreateForm({ ...createForm, max_tables: parseInt(e.target.value, 10) || 0 })}
                        className="sa-input"
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={createForm.cabins_enabled === 1 || createForm.cabins_enabled === true}
                          onChange={e => setCreateForm({ ...createForm, cabins_enabled: e.target.checked ? 1 : 0 })}
                        />
                        🛋️ Cabins
                      </label>
                      <label style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Max Cabins</label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={createForm.max_cabins ?? 0}
                        onChange={e => setCreateForm({ ...createForm, max_cabins: parseInt(e.target.value, 10) || 0 })}
                        className="sa-input"
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={createForm.vip_enabled === 1 || createForm.vip_enabled === true}
                          onChange={e => setCreateForm({ ...createForm, vip_enabled: e.target.checked ? 1 : 0 })}
                        />
                        👑 Lounges
                      </label>
                      <label style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Max Lounges</label>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={createForm.max_vip ?? 0}
                        onChange={e => setCreateForm({ ...createForm, max_vip: parseInt(e.target.value, 10) || 0 })}
                        className="sa-input"
                        style={{ height: '34px', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dedicated Feature Toggles in Create Modal */}
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid var(--sa-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase' }}>
                  Key Feature Permissions:
                </span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={createForm.direct_ordering_enabled !== 0 && createForm.direct_ordering_enabled !== false}
                    onChange={e => setCreateForm({ ...createForm, direct_ordering_enabled: e.target.checked ? 1 : 0 })}
                    style={{ accentColor: 'var(--sa-primary)' }}
                  />
                  <span>
                    {createForm.industry === 'hotel'
                      ? '🚪 In-Room QR Dining Enabled'
                      : createForm.industry === 'cinema'
                        ? '💺 In-Seat QR Delivery Enabled'
                        : '📋 Customer Dining Table QR Ordering'}
                  </span>
                </label>

                {createForm.industry === 'hotel' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={createForm.amenities_booking_enabled !== 0 && createForm.amenities_booking_enabled !== false}
                      onChange={e => setCreateForm({ ...createForm, amenities_booking_enabled: e.target.checked ? 1 : 0 })}
                      style={{ accentColor: 'var(--sa-primary)' }}
                    />
                    <span>🛎️ Hotel Amenities & Guest Services Booking</span>
                  </label>
                )}

                {createForm.industry === 'cinema' && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={createForm.interval_rush_mode_enabled !== 0 && createForm.interval_rush_mode_enabled !== false}
                        onChange={e => setCreateForm({ ...createForm, interval_rush_mode_enabled: e.target.checked ? 1 : 0 })}
                        style={{ accentColor: 'var(--sa-primary)' }}
                      />
                      <span>⚡ Interval Express Rush Mode (15-min queue)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={createForm.seat_runner_dispatch_enabled !== 0 && createForm.seat_runner_dispatch_enabled !== false}
                        onChange={e => setCreateForm({ ...createForm, seat_runner_dispatch_enabled: e.target.checked ? 1 : 0 })}
                        style={{ accentColor: 'var(--sa-primary)' }}
                      />
                      <span>🏃 Seat Runner Dispatch Screen (Audi + Row + Seat)</span>
                    </label>
                  </>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={createForm.whatsapp_enabled !== 0 && createForm.whatsapp_enabled !== false}
                    onChange={e => setCreateForm({ ...createForm, whatsapp_enabled: e.target.checked ? 1 : 0, whatsapp_ordering_enabled: e.target.checked ? 1 : 0 })}
                    style={{ accentColor: 'var(--sa-primary)' }}
                  />
                  <span>💬 WhatsApp Ordering / Concierge Chat</span>
                </label>
              </div>

              {/* Theme Access Selection */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                  THEME ACCESS LEVEL
                </label>
                <select
                  value={createForm.allowed_themes || 'gold'}
                  onChange={e => setCreateForm({ ...createForm, allowed_themes: e.target.value })}
                  className="sa-input"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  {THEME_ACCESS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DESCRIPTION</label>
                <input
                  type="text"
                  placeholder="Short marketing headline for this plan tier"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  className="sa-input"
                />
              </div>

              {!isCreateFormValid && (
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, marginTop: '-4px' }}>
                  * Required: Plan Name, unique Plan Key, and non-negative Monthly Price.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="sa-btn sa-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !isCreateFormValid}
                  className="sa-btn sa-btn-accent"
                  style={{
                    fontWeight: 900,
                    opacity: (creating || !isCreateFormValid) ? 0.45 : 1,
                    cursor: (creating || !isCreateFormValid) ? 'not-allowed' : 'pointer',
                    boxShadow: (creating || !isCreateFormValid) ? 'none' : '0 4px 12px rgba(212, 175, 55, 0.35)'
                  }}
                >
                  {creating ? 'Creating Plan...' : '✨ Create SaaS Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
