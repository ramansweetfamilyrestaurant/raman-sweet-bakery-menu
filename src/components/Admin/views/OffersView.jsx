import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
  Plus, 
  Search, 
  Check, 
  Clock, 
  Calendar, 
  Trash2, 
  Edit, 
  Pause, 
  Play, 
  Percent, 
  DollarSign, 
  Sparkles, 
  Utensils, 
  ShoppingBag, 
  ArrowLeft, 
  ChevronRight, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Flame, 
  TrendingUp, 
  Eye, 
  HelpCircle,
  Sliders,
  Filter
} from 'lucide-react';
import { 
  fetchAdminOffers, 
  createAdminOffer, 
  updateAdminOffer, 
  toggleAdminOffer, 
  deleteAdminOffer 
} from '../../../api/client';
import { resolveTenantCapabilities } from '../../../utils/planCapabilities';
import { getCurrencySymbol, formatPriceNumber } from '../../../utils/currencyHelper';
import PlanLockedCard from '../components/PlanLockedCard';

export default function OffersView({
  restaurantInfo = {},
  settingsForm = {},
  dishes = [],
  combos = [],
  categories = [],
  token,
  capabilities,
  onUpgrade,
  onNavigate
}) {
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);
  const currencySym = getCurrencySymbol(settingsForm?.currency_symbol !== undefined ? settingsForm.currency_symbol : restaurantInfo?.currency_symbol);

  // Live Offers State
  const [offersList, setOffersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Filter & Search State
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'active' | 'scheduled' | 'paused' | 'expired'
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [currentStep, setCurrentStep] = useState(1); // 1: Basics, 2: Select Items, 3: Discount & Schedule, 4: Preview

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('percentage'); // 'percentage' | 'flat' | 'special_price'
  const [formValue, setFormValue] = useState('');
  const [formAlwaysActive, setFormAlwaysActive] = useState(true);
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formEndsAt, setFormEndsAt] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [selectedDishIds, setSelectedDishIds] = useState([]);
  const [selectedComboIds, setSelectedComboIds] = useState([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Load Offers from backend
  const loadOffers = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAdminOffers(token);
      setOffersList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load offers:', err);
      setErrorMsg(err.message || 'Failed to load offers from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, [token]);

  // Helper: Determine Offer Lifecycle Status
  const getOfferStatus = (offer) => {
    if (!offer.active) return 'paused';
    const now = new Date();
    const startsAt = offer.starts_at ? new Date(offer.starts_at) : null;
    const endsAt = offer.ends_at ? new Date(offer.ends_at) : null;

    if (startsAt && startsAt > now) return 'scheduled';
    if (endsAt && endsAt < now) return 'expired';
    return 'active';
  };

  // Metrics Calculations (Factual Data Only)
  const activeCount = useMemo(() => offersList.filter(o => getOfferStatus(o) === 'active').length, [offersList]);
  const scheduledCount = useMemo(() => offersList.filter(o => getOfferStatus(o) === 'scheduled').length, [offersList]);
  const pausedOrExpiredCount = useMemo(() => offersList.filter(o => {
    const s = getOfferStatus(o);
    return s === 'paused' || s === 'expired';
  }).length, [offersList]);

  const totalDiscountedItemsCount = useMemo(() => {
    const dishSet = new Set();
    offersList.forEach(off => {
      if (getOfferStatus(off) === 'active' && Array.isArray(off.items)) {
        off.items.forEach(i => {
          if (i.dish_id) dishSet.add(`dish_${i.dish_id}`);
          if (i.combo_id) dishSet.add(`combo_${i.combo_id}`);
        });
      }
    });
    return dishSet.size;
  }, [offersList]);

  // Filtered Offers List
  const filteredOffers = useMemo(() => {
    return offersList.filter(off => {
      const status = getOfferStatus(off);
      if (activeFilter === 'active' && status !== 'active') return false;
      if (activeFilter === 'scheduled' && status !== 'scheduled') return false;
      if (activeFilter === 'paused' && status !== 'paused') return false;
      if (activeFilter === 'expired' && status !== 'expired') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return off.name.toLowerCase().includes(q) || (off.type && off.type.toLowerCase().includes(q));
      }
      return true;
    });
  }, [offersList, activeFilter, searchQuery]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingOfferId(null);
    setFormName('');
    setFormType('percentage');
    setFormValue('10');
    setFormAlwaysActive(true);
    setFormStartsAt('');
    setFormEndsAt('');
    setFormActive(true);
    setSelectedDishIds([]);
    setSelectedComboIds([]);
    setCurrentStep(1);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (offer) => {
    setEditingOfferId(offer.id);
    setFormName(offer.name || '');
    setFormType(offer.type || 'percentage');
    setFormValue(String(offer.value || ''));
    setFormActive(Boolean(offer.active));

    if (offer.starts_at && offer.ends_at) {
      setFormAlwaysActive(false);
      setFormStartsAt(offer.starts_at ? new Date(offer.starts_at).toISOString().slice(0, 16) : '');
      setFormEndsAt(offer.ends_at ? new Date(offer.ends_at).toISOString().slice(0, 16) : '');
    } else {
      setFormAlwaysActive(true);
      setFormStartsAt('');
      setFormEndsAt('');
    }

    const dIds = [];
    const cIds = [];
    (offer.items || []).forEach(item => {
      if (item.dish_id) dIds.push(item.dish_id);
      if (item.combo_id) cIds.push(item.combo_id);
    });
    setSelectedDishIds(dIds);
    setSelectedComboIds(cIds);

    setCurrentStep(1);
    setShowModal(true);
  };

  // Save / Publish Offer
  const handleSaveOffer = async (e) => {
    if (e) e.preventDefault();
    if (!formName.trim()) {
      alert('Please enter an offer name.');
      return;
    }
    const val = Number(formValue);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid discount value greater than 0.');
      return;
    }
    if (formType === 'percentage' && val > 100) {
      alert('Percentage discount cannot exceed 100%.');
      return;
    }
    if (selectedDishIds.length === 0 && selectedComboIds.length === 0) {
      alert('Please select at least one menu dish or combo deal for this offer.');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = [
        ...selectedDishIds.map(id => ({ dish_id: id })),
        ...selectedComboIds.map(id => ({ combo_id: id }))
      ];

      const payload = {
        name: formName.trim(),
        type: formType,
        value: val,
        starts_at: !formAlwaysActive && formStartsAt ? new Date(formStartsAt).toISOString() : new Date().toISOString(),
        ends_at: !formAlwaysActive && formEndsAt ? new Date(formEndsAt).toISOString() : null,
        active: formActive,
        items: itemsPayload
      };

      if (editingOfferId) {
        await updateAdminOffer(editingOfferId, payload, token);
        setSuccessToast(`✓ Offer "${formName}" updated successfully!`);
      } else {
        await createAdminOffer(payload, token);
        setSuccessToast(`✓ Offer "${formName}" created and published!`);
      }

      setShowModal(false);
      await loadOffers();
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to save offer');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Offer Active Status
  const handleToggleOffer = async (offer, e) => {
    if (e) e.stopPropagation();
    try {
      const newStatus = !offer.active;
      await toggleAdminOffer(offer.id, newStatus, token);
      setOffersList(prev => prev.map(o => o.id === offer.id ? { ...o, active: newStatus ? 1 : 0 } : o));
      setSuccessToast(`✓ Offer "${offer.name}" ${newStatus ? 'resumed' : 'paused'}.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update offer status');
    }
  };

  // Delete Offer
  const handleDeleteOffer = async (id) => {
    try {
      await deleteAdminOffer(id, token);
      setOffersList(prev => prev.filter(o => o.id !== id));
      setDeleteConfirmId(null);
      setSuccessToast('✓ Offer deleted successfully.');
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to delete offer');
    }
  };

  // Dish selection toggle
  const toggleDishSelection = (dishId) => {
    setSelectedDishIds(prev => 
      prev.includes(dishId) ? prev.filter(id => id !== dishId) : [...prev, dishId]
    );
  };

  // Combo selection toggle
  const toggleComboSelection = (comboId) => {
    setSelectedComboIds(prev => 
      prev.includes(comboId) ? prev.filter(id => id !== comboId) : [...prev, comboId]
    );
  };

  // Filtered Dishes for Step 2
  const filteredDishesForSelection = useMemo(() => {
    return (dishes || []).filter(d => {
      if (itemCategoryFilter !== 'all' && String(d.category_id) !== String(itemCategoryFilter)) return false;
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.name_hi && d.name_hi.toLowerCase().includes(q));
      }
      return true;
    });
  }, [dishes, itemCategoryFilter, itemSearchQuery]);

  // Preview Calculations for Step 3/4
  const previewCalculation = (basePrice) => {
    const numBase = Number(basePrice) || 0;
    const val = Number(formValue) || 0;
    let disc = numBase;
    let badge = '';

    if (formType === 'percentage') {
      const pct = Math.min(100, Math.max(0, val));
      const discAmt = Math.round((numBase * pct) / 100);
      disc = Math.max(0, numBase - discAmt);
      badge = `${pct}% OFF`;
    } else if (formType === 'flat') {
      disc = Math.max(0, numBase - val);
      badge = currencySym ? `${currencySym}${val} OFF` : `${val} OFF`;
    } else if (formType === 'special_price') {
      disc = Math.max(0, val);
      badge = `Special Price`;
    }

    return {
      original: numBase,
      discounted: disc,
      saved: Math.max(0, numBase - disc),
      badge
    };
  };

  const renderStatusBadge = (status) => {
    if (status === 'active') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: '#ECFDF5',
          color: '#059669',
          fontSize: '0.68rem',
          fontWeight: 900,
          border: '1px solid #A7F3D0'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
          ACTIVE
        </span>
      );
    }
    if (status === 'scheduled') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: '#FEF3C7',
          color: '#D97706',
          fontSize: '0.68rem',
          fontWeight: 900,
          border: '1px solid #FDE68A'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706' }} />
          SCHEDULED
        </span>
      );
    }
    if (status === 'paused') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: '#F1F5F9',
          color: '#64748B',
          fontSize: '0.68rem',
          fontWeight: 900,
          border: '1px solid #CBD5E1'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748B' }} />
          PAUSED
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        background: '#FEF2F2',
        color: '#DC2626',
        fontSize: '0.68rem',
        fontWeight: 900,
        border: '1px solid #FECACA'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626' }} />
        EXPIRED
      </span>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      boxSizing: 'border-box',
      paddingBottom: '90px',
      overflowX: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Responsive Grid & Card Styles */}
      <style>{`
        .offers-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
        }
        .offers-metric-card {
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #EAE5DF;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-width: 0;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .offers-metric-card:hover {
          border-color: #CBD5E1;
        }
        .offer-filter-chip {
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid #EAE5DF;
          background: #FFFFFF;
          color: #64748B;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .offer-filter-chip:hover {
          background: #FAF8F5;
          color: #0F172A;
          border-color: #CBD5E1;
        }
        .offer-filter-chip.active {
          background: #064E3B;
          color: #FFFFFF;
          border-color: #064E3B;
          box-shadow: 0 1px 4px rgba(6, 78, 59, 0.20);
        }
        .offer-row-card {
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #EAE5DF;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          transition: all 0.15s ease;
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          flex-wrap: wrap;
          gap: 10px;
        }
        .offer-row-card:hover {
          border-color: #CBD5E1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .offers-insights-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .offers-tips-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 960px) {
          .offers-metric-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 860px) {
          .offers-insights-grid {
            grid-template-columns: 1fr !important;
          }
          .offers-tips-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .offers-header-container {
            padding: 12px 14px !important;
            gap: 8px !important;
          }
          .offers-metric-grid {
            gap: 8px !important;
          }
          .offers-metric-card {
            padding: 10px 10px !important;
          }
          .offer-row-card {
            padding: 12px 12px !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {successToast && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          fontSize: '0.80rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ECFDF5',
          color: '#059669',
          border: '1px solid #A7F3D0'
        }}>
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* =========================================================================
          1. HEADER CARD
         ========================================================================= */}
      <div className="offers-header-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #EAE5DF',
        padding: '14px 18px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        boxSizing: 'border-box',
        width: '100%',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: '#ECFDF5',
            color: '#064E3B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Tag size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '1.10rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Offers & Promotions
            </h2>
            <p style={{ fontSize: '0.74rem', color: '#64748B', margin: 0, marginTop: '1px' }}>
              Create promotions for selected menu items and boost customer orders.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#064E3B',
              color: '#FFFFFF',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 4px rgba(6, 78, 59, 0.20)',
              transition: 'background 0.15s ease'
            }}
          >
            <Plus size={15} />
            <span>Create Offer</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. SUMMARY METRICS (Active, Scheduled, Paused/Expired, Discounted Items)
         ========================================================================= */}
      <div className="offers-metric-grid">
        <div className="offers-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Active Offers
            </span>
            <div style={{ fontSize: '1.30rem', fontWeight: 900, color: '#0F172A', marginTop: '1px', lineHeight: 1.15 }}>
              {activeCount}
            </div>
            <span style={{ fontSize: '0.66rem', color: '#059669', fontWeight: 700 }}>
              Live on menu
            </span>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Flame size={16} />
          </div>
        </div>

        <div className="offers-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Scheduled
            </span>
            <div style={{ fontSize: '1.30rem', fontWeight: 900, color: '#0F172A', marginTop: '1px', lineHeight: 1.15 }}>
              {scheduledCount}
            </div>
            <span style={{ fontSize: '0.66rem', color: '#D97706', fontWeight: 700 }}>
              Upcoming deals
            </span>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={16} />
          </div>
        </div>

        <div className="offers-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Paused / Expired
            </span>
            <div style={{ fontSize: '1.30rem', fontWeight: 900, color: '#0F172A', marginTop: '1px', lineHeight: 1.15 }}>
              {pausedOrExpiredCount}
            </div>
            <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700 }}>
              Inactive offers
            </span>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pause size={16} />
          </div>
        </div>

        <div className="offers-metric-card">
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Items on Promotion
            </span>
            <div style={{ fontSize: '1.30rem', fontWeight: 900, color: '#064E3B', marginTop: '1px', lineHeight: 1.15 }}>
              {totalDiscountedItemsCount}
            </div>
            <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700 }}>
              Dishes & combos
            </span>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#FAF8F5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Utensils size={16} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. FILTER BAR & SEARCH
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #EAE5DF',
        padding: '10px 14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offers by name or discount..."
            style={{
              width: '100%',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              padding: '0 10px 0 32px',
              fontSize: '0.78rem',
              color: '#0F172A',
              background: '#FAF8F5',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'paused', label: 'Paused' },
            { id: 'expired', label: 'Expired' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={`offer-filter-chip ${activeFilter === f.id ? 'active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          4. OFFERS FEED / LIST
         ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontSize: '0.82rem' }}>
            Loading offers from server...
          </div>
        ) : filteredOffers.length === 0 ? (
          /* EMPTY STATE */
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #EAE5DF',
            padding: '36px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FAF8F5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.98rem', color: '#0F172A', fontWeight: 900, display: 'block' }}>
                {searchQuery ? `No offers matching "${searchQuery}"` : 'No Promotions Yet'}
              </strong>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748B', maxWidth: '380px', lineHeight: 1.4 }}>
                Create your first promotion to highlight selected menu items and attract customer orders.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#064E3B',
                color: '#FFFFFF',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} />
              <span>Create First Offer</span>
            </button>
          </div>
        ) : (
          filteredOffers.map(offer => {
            const status = getOfferStatus(offer);
            const itemsCount = offer.items_count || (offer.items || []).length || 0;

            let discountBadge = '';
            if (offer.type === 'percentage') discountBadge = `${offer.value}% OFF`;
            else if (offer.type === 'flat') discountBadge = currencySym ? `${currencySym}${formatPriceNumber(offer.value)} OFF` : `${formatPriceNumber(offer.value)} OFF`;
            else if (offer.type === 'special_price') discountBadge = currencySym ? `Special Price ${currencySym}${formatPriceNumber(offer.value)}` : `Special Price ${formatPriceNumber(offer.value)}`;

            return (
              <div key={offer.id} className="offer-row-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#FAF8F5',
                    color: '#064E3B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Tag size={18} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 900 }}>
                        {offer.name}
                      </strong>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                        color: '#B45309',
                        border: '1px solid #FDE68A',
                        fontSize: '0.68rem',
                        fontWeight: 900
                      }}>
                        {discountBadge}
                      </span>
                      {renderStatusBadge(status)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.70rem', color: '#64748B', flexWrap: 'wrap' }}>
                      <span>🍽️ {itemsCount} menu item{itemsCount !== 1 ? 's' : ''} included</span>
                      <span>•</span>
                      <span>
                        📅 {offer.ends_at ? `Valid till ${new Date(offer.ends_at).toLocaleDateString()}` : 'Always Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {status !== 'expired' && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleOffer(offer, e)}
                      title={offer.active ? 'Pause Offer' : 'Resume Offer'}
                      style={{
                        height: '32px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#334155',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {offer.active ? <Pause size={12} /> : <Play size={12} />}
                      <span>{offer.active ? 'Pause' : 'Resume'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(offer)}
                    title="Edit Offer"
                    style={{
                      height: '32px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#334155',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Edit size={12} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(offer.id)}
                    title="Delete Offer"
                    style={{
                      height: '32px',
                      width: '32px',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
          5. PROMOTION INSIGHTS & HOW PROMOTIONS WORK (2-COLUMN GRID)
         ========================================================================= */}
      <div className="offers-insights-grid" style={{ marginTop: '2px' }}>
        {/* Column 1: Promotion Insights */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '16px 18px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <TrendingUp size={16} color="#064E3B" />
              <h3 style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Promotion Insights
              </h3>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0 }}>
              Overview of your menu promotion coverage and active campaigns.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: '#FAF8F5', borderRadius: '8px', padding: '10px 12px', border: '1px solid #EAE5DF' }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'block' }}>
                Promoted Items
              </span>
              <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#064E3B', marginTop: '1px', display: 'block' }}>
                {totalDiscountedItemsCount}
              </strong>
              <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                of {Math.max(0, (dishes?.length || 0) + (combos?.length || 0))} catalog items
              </span>
            </div>

            <div style={{ background: '#FAF8F5', borderRadius: '8px', padding: '10px 12px', border: '1px solid #EAE5DF' }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', display: 'block' }}>
                Catalog Coverage
              </span>
              <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: '#059669', marginTop: '1px', display: 'block' }}>
                {((dishes?.length || 0) + (combos?.length || 0)) > 0 ? Math.round((totalDiscountedItemsCount / ((dishes?.length || 0) + (combos?.length || 0))) * 100) : 0}%
              </strong>
              <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700 }}>
                Active on menu
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#64748B', marginBottom: '3px' }}>
              <span>Menu Items with Active Deals</span>
              <span style={{ fontWeight: 800, color: '#064E3B' }}>{totalDiscountedItemsCount} items</span>
            </div>
            <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${((dishes?.length || 0) + (combos?.length || 0)) > 0 ? Math.min(100, Math.round((totalDiscountedItemsCount / ((dishes?.length || 0) + (combos?.length || 0))) * 100)) : 0}%`,
                height: '100%',
                background: '#064E3B',
                borderRadius: '3px'
              }} />
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#64748B', background: '#FAF8F5', padding: '6px 8px', borderRadius: '6px', border: '1px solid #EAE5DF', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="#D97706" />
            <span>Active promotions automatically display strike-through prices and discount badges on table QR menus.</span>
          </div>
        </div>

        {/* Column 2: How Promotions Work */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '16px 18px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <Sparkles size={16} color="#D97706" />
              <h3 style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                How Promotions Work
              </h3>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0 }}>
              Step-by-step promotion lifecycle from setup to diner checkout.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0 }}>
                01
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.76rem', color: '#0F172A', display: 'block' }}>Create Offer</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.3, display: 'block' }}>
                  Choose percentage, flat amount, or special price for selected dishes/combos.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0 }}>
                02
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.76rem', color: '#0F172A', display: 'block' }}>Set Schedule</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.3, display: 'block' }}>
                  Keep it "Always Active" or set automated start & expiry dates for events.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0 }}>
                03
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.76rem', color: '#0F172A', display: 'block' }}>Live on Digital Menu</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.3, display: 'block' }}>
                  Promotional tags and strike-through pricing appear on table QR menus.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: '#FAF8F5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0 }}>
                04
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.76rem', color: '#0F172A', display: 'block' }}>Verified at Checkout</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', lineHeight: 1.3, display: 'block' }}>
                  Discounts are calculated and logged into the order snapshot.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          6. PROMOTIONAL GUIDANCE / TIPS BANNER (FULL WIDTH)
         ========================================================================= */}
      <div style={{
        background: 'linear-gradient(135deg, #FAF8F5 0%, #F4EFE6 100%)',
        borderRadius: '14px',
        border: '1px solid #EAE5DF',
        padding: '14px 18px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxSizing: 'border-box',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle2 size={16} color="#064E3B" />
          <h3 style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Tips to Run Effective Promotions
          </h3>
        </div>

        <div className="offers-tips-grid">
          <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '10px 12px', border: '1px solid #EAE5DF' }}>
            <strong style={{ fontSize: '0.78rem', color: '#064E3B', display: 'block', marginBottom: '2px' }}>
              🎯 Keep It Simple
            </strong>
            <span style={{ fontSize: '0.70rem', color: '#475569', lineHeight: 1.35, display: 'block' }}>
              Clear percentage or flat discounts convert faster with diners than complex deals.
            </span>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '10px 12px', border: '1px solid #EAE5DF' }}>
            <strong style={{ fontSize: '0.78rem', color: '#D97706', display: 'block', marginBottom: '2px' }}>
              ⭐ Promote Bestsellers
            </strong>
            <span style={{ fontSize: '0.70rem', color: '#475569', lineHeight: 1.35, display: 'block' }}>
              Discounts on popular appetizers and combo thalis increase overall table basket size.
            </span>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '10px 12px', border: '1px solid #EAE5DF' }}>
            <strong style={{ fontSize: '0.78rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
              ⏳ Create Urgency
            </strong>
            <span style={{ fontSize: '0.70rem', color: '#475569', lineHeight: 1.35, display: 'block' }}>
              Schedule weekend specials and happy hour timeframes to drive repeat dine-in visits.
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. MULTI-STEP CREATE / EDIT MODAL
         ========================================================================= */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid #EAE5DF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  {editingOfferId ? 'Edit Promotion Offer' : 'Create New Promotion Offer'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Step {currentStep} of 4 · {currentStep === 1 ? 'Offer Basics' : currentStep === 2 ? 'Select Menu Items' : currentStep === 3 ? 'Discount & Schedule' : 'Review & Publish'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Scroll */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* STEP 1: OFFER BASICS */}
              {currentStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Offer Name <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Weekend Special Feast, Biryani Day 10% OFF"
                      style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        padding: '0 12px',
                        fontSize: '0.84rem',
                        color: '#0F172A',
                        background: '#FAF8F5',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Discount Type
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { id: 'percentage', label: '% OFF', desc: 'Percentage Discount' },
                        { id: 'flat', label: currencySym ? `${currencySym} Flat OFF` : 'Flat OFF', desc: 'Fixed Amount Discount' },
                        { id: 'special_price', label: 'Special Price', desc: 'Custom Target Price' }
                      ].map(t => {
                        const isSel = formType === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => setFormType(t.id)}
                            style={{
                              padding: '10px',
                              borderRadius: '10px',
                              border: isSel ? '2px solid #064E3B' : '1px solid #EAE5DF',
                              background: isSel ? '#ECFDF5' : '#FAF8F5',
                              cursor: 'pointer',
                              textAlign: 'center',
                              boxSizing: 'border-box'
                            }}
                          >
                            <strong style={{ fontSize: '0.80rem', color: isSel ? '#064E3B' : '#0F172A', display: 'block' }}>
                              {t.label}
                            </strong>
                            <span style={{ fontSize: '0.64rem', color: '#64748B' }}>
                              {t.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT MENU ITEMS */}
              {currentStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569' }}>
                      Selected: {selectedDishIds.length + selectedComboIds.length} item(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDishIds.length === dishes.length) {
                          setSelectedDishIds([]);
                        } else {
                          setSelectedDishIds(dishes.map(d => d.id));
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#064E3B', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {selectedDishIds.length === dishes.length ? 'Deselect All' : 'Select All Dishes'}
                    </button>
                  </div>

                  {/* Search & Category Filter */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      placeholder="Search dish name..."
                      style={{
                        flex: 1,
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        padding: '0 10px',
                        fontSize: '0.78rem',
                        background: '#FAF8F5',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <select
                      value={itemCategoryFilter}
                      onChange={(e) => setItemCategoryFilter(e.target.value)}
                      style={{
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        padding: '0 8px',
                        fontSize: '0.76rem',
                        background: '#FAF8F5',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="all">All Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Items Checkbox Feed */}
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #EAE5DF', borderRadius: '10px', padding: '6px' }}>
                    {filteredDishesForSelection.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.76rem', color: '#64748B' }}>
                        No dishes found.
                      </div>
                    ) : (
                      filteredDishesForSelection.map(d => {
                        const isChecked = selectedDishIds.includes(d.id);
                        return (
                          <div
                            key={d.id}
                            onClick={() => toggleDishSelection(d.id)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: isChecked ? '#ECFDF5' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              marginBottom: '2px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent onClick
                                style={{ width: '16px', height: '16px', accentColor: '#064E3B', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0F172A' }}>
                                {d.name}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#064E3B' }}>
                              {currencySym}{formatPriceNumber(d.price)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: DISCOUNT VALUE & SCHEDULE */}
              {currentStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      {formType === 'percentage' ? 'Percentage Discount (%)' : formType === 'flat' ? `Flat Discount${currencySym ? ` (${currencySym})` : ''}` : `Special Price${currencySym ? ` (${currencySym})` : ''}`}
                    </label>
                    <input
                      type="number"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder={formType === 'percentage' ? '10' : '50'}
                      min="1"
                      max={formType === 'percentage' ? '100' : '10000'}
                      style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        padding: '0 12px',
                        fontSize: '0.84rem',
                        color: '#0F172A',
                        background: '#FAF8F5',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Scheduling */}
                  <div style={{ padding: '12px', borderRadius: '10px', background: '#FAF8F5', border: '1px solid #EAE5DF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formAlwaysActive}
                        onChange={(e) => setFormAlwaysActive(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#064E3B', cursor: 'pointer' }}
                      />
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A' }}>Always Active (No expiration date)</strong>
                    </label>

                    {!formAlwaysActive && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>Start Time</label>
                          <input
                            type="datetime-local"
                            value={formStartsAt}
                            onChange={(e) => setFormStartsAt(e.target.value)}
                            style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '0.74rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginBottom: '2px' }}>End Time</label>
                          <input
                            type="datetime-local"
                            value={formEndsAt}
                            onChange={(e) => setFormEndsAt(e.target.value)}
                            style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '0.74rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & LIVE PREVIEW */}
              {currentStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '14px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EAE5DF', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Offer Name:</span>
                      <strong style={{ fontSize: '0.76rem', color: '#0F172A' }}>{formName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Selected Items:</span>
                      <strong style={{ fontSize: '0.76rem', color: '#064E3B' }}>{selectedDishIds.length + selectedComboIds.length} items</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Schedule:</span>
                      <strong style={{ fontSize: '0.76rem', color: '#0F172A' }}>{formAlwaysActive ? 'Always Active' : 'Custom Dates'}</strong>
                    </div>
                  </div>

                  {/* Customer Card Live Preview */}
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Customer Menu Preview:
                    </span>

                    {selectedDishIds.length > 0 && (() => {
                      const sampleDish = dishes.find(d => d.id === selectedDishIds[0]) || dishes[0] || { name: 'Paneer Tikka', price: 220 };
                      const calc = previewCalculation(sampleDish.price);
                      return (
                        <div style={{
                          padding: '14px',
                          borderRadius: '12px',
                          background: '#FFFFFF',
                          border: '1.5px solid #FDE68A',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <strong style={{ fontSize: '0.86rem', color: '#0F172A' }}>{sampleDish.name}</strong>
                              <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#FEF3C7', color: '#D97706', fontSize: '0.66rem', fontWeight: 900 }}>
                                🔥 {calc.badge}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.70rem', color: '#059669', fontWeight: 700 }}>✓ Available for Table Order</span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#064E3B' }}>
                              {currencySym}{formatPriceNumber(calc.discounted)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8', textDecoration: 'line-through' }}>
                              {currencySym}{formatPriceNumber(calc.original)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #EAE5DF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FAF8F5'
            }}>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  style={{ height: '36px', padding: '0 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1 && !formName.trim()) {
                      alert('Please enter an offer name.');
                      return;
                    }
                    if (currentStep === 2 && selectedDishIds.length === 0 && selectedComboIds.length === 0) {
                      alert('Please select at least one menu item.');
                      return;
                    }
                    setCurrentStep(prev => prev + 1);
                  }}
                  style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontSize: '0.76rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveOffer}
                  disabled={submitting}
                  style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 900, cursor: submitting ? 'default' : 'pointer' }}
                >
                  {submitting ? 'Publishing...' : 'Publish Offer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. DELETE CONFIRMATION MODAL
         ========================================================================= */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                Delete Promotion Offer?
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#64748B', lineHeight: 1.45 }}>
                This will remove the offer from all associated menu items. The items will return to their regular menu prices.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteOffer(deleteConfirmId)}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer' }}
              >
                Delete Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
