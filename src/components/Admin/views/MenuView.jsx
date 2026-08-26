import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Star, 
  Sparkles, 
  DollarSign, 
  Filter, 
  X, 
  Utensils, 
  Layers, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink, 
  ChevronDown, 
  Copy, 
  Store, 
  Check, 
  Tag,
  FolderPlus,
  LayoutGrid,
  List,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { resolveImageUrl, getDishImageUrl, getCategoryImageUrl } from '../../../utils/imageHelper';
import { formatQuota } from '../../../utils/planCapabilities';

export default function MenuView({
  dishes = [],
  categories = [],
  combos = [],
  activeSubTab = 'dishes',
  setActiveSubTab,
  search = '',
  setSearch,
  selectedCatFilter = 'all',
  setSelectedCatFilter,
  onToggleAvailability,
  onOpenAddDish,
  onOpenEditDish,
  onDeleteDish,
  onUpdateQuickPrice,
  onToggleCategoryActive,
  onDeleteCategory,
  onOpenAddCategory,
  onOpenEditCategory,
  onOpenAddCombo,
  onOpenEditCombo,
  onDeleteCombo,
  onToggleComboAvailability,
  onToggleBadge,
  currencySymbol = '₹',
  maxDishes = 9999,
  maxCategories = 9999,
  maxCombos = 9999,
  onUpgrade = null,
  onReturnToMenu = null,
  restaurantInfo = {}
}) {
  const [deleteConfirmDish, setDeleteConfirmDish] = useState(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [deleteConfirmCombo, setDeleteConfirmCombo] = useState(null);
  const [quickPriceDish, setQuickPriceDish] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState({ price: '', price_half: '' });
  const [dietFilter, setDietFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'must_try', 'available', 'sold_out'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name_asc', 'price_asc', 'price_desc', 'instock_first'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showAddMenuDropdown, setShowAddMenuDropdown] = useState(false);
  const [showMobileAddDropdown, setShowMobileAddDropdown] = useState(false);
  const [openDishMenuId, setOpenDishMenuId] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCatFilter, dietFilter, sortBy, pageSize]);

  // Close open menus on outside click / escape
  useEffect(() => {
    if (!openDishMenuId) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenDishMenuId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openDishMenuId]);

  // Filtered & Sorted dishes
  const filteredDishes = useMemo(() => {
    let list = safeDishes.filter(d => {
      const q = (search || '').toLowerCase().trim();
      const matchesSearch = !q || (d.name || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
      const matchesCat = selectedCatFilter === 'all' || String(d.category_id) === String(selectedCatFilter);
      
      let matchesDiet = true;
      if (dietFilter === 'veg') matchesDiet = d.type === 'veg';
      if (dietFilter === 'nonveg') matchesDiet = d.type === 'nonveg';
      if (dietFilter === 'must_try') matchesDiet = Boolean(d.must_try);
      if (dietFilter === 'available') matchesDiet = d.is_available !== false;
      if (dietFilter === 'sold_out') matchesDiet = d.is_available === false;

      return matchesSearch && matchesCat && matchesDiet;
    });

    if (sortBy === 'price_asc') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'instock_first') {
      list.sort((a, b) => (b.is_available !== false ? 1 : 0) - (a.is_available !== false ? 1 : 0));
    }

    return list;
  }, [safeDishes, search, selectedCatFilter, dietFilter, sortBy]);

  // Pagination calculation
  const totalItems = filteredDishes.length;
  const isAllPages = pageSize === 'all';
  const effectivePageSize = isAllPages ? (totalItems || 1) : Number(pageSize);
  const totalPages = Math.ceil(totalItems / effectivePageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedDishes = useMemo(() => {
    if (isAllPages) return filteredDishes;
    const startIndex = (safeCurrentPage - 1) * effectivePageSize;
    return filteredDishes.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredDishes, isAllPages, safeCurrentPage, effectivePageSize]);

  const activeCategoryObj = safeCategories.find(c => String(c.id) === String(selectedCatFilter));

  const handleQuickPriceSubmit = (e) => {
    e.preventDefault();
    if (quickPriceDish && onUpdateQuickPrice) {
      onUpdateQuickPrice(quickPriceDish.id, quickPriceVal.price, quickPriceVal.price_half);
      setQuickPriceDish(null);
    }
  };

  // Helper for category food emojis
  const getCategoryEmoji = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('chaat') || n.includes('kachori')) return '🍲';
    if (n.includes('snack') || n.includes('fries') || n.includes('pakora')) return '🍟';
    if (n.includes('momo') || n.includes('dimsum')) return '🥟';
    if (n.includes('chinese') || n.includes('noodle') || n.includes('manchurian')) return '🍜';
    if (n.includes('burger')) return '🍔';
    if (n.includes('roll') || n.includes('wrap') || n.includes('kathi')) return '🌯';
    if (n.includes('pizza')) return '🍕';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('roti') || n.includes('naan') || n.includes('paratha') || n.includes('bread')) return '🫓';
    if (n.includes('rice') || n.includes('biryani')) return '🍚';
    if (n.includes('beverage') || n.includes('drink') || n.includes('shake') || n.includes('tea') || n.includes('coffee')) return '🥤';
    if (n.includes('sweet') || n.includes('dessert') || n.includes('cake') || n.includes('ice cream')) return '🍰';
    if (n.includes('south') || n.includes('dosa') || n.includes('idli')) return '🥞';
    return '🍽️';
  };

  // Helper to format price in ultra-premium luxury pills
  const renderDishPrice = (dish, layout = 'card') => {
    const currentPrice = Number(dish.price) || 0;
    const rawOldPrice = Number(dish.original_price || dish.mrp || dish.old_price || dish.compare_at_price);
    const hasValidOldPrice = !isNaN(rawOldPrice) && rawOldPrice > currentPrice;
    const savings = hasValidOldPrice ? rawOldPrice - currentPrice : 0;
    const rawHalfPrice = Number(dish.price_half);
    const hasHalfPrice = !isNaN(rawHalfPrice) && rawHalfPrice > 0;

    if (hasHalfPrice) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Dual Segmented Luxury Capsule */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '999px',
            padding: '2px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            {/* Full portion */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              background: '#FFFFFF',
              borderRadius: '999px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '0.60rem', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full</span>
              <strong style={{ fontSize: layout === 'card' ? '0.94rem' : '0.88rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{currencySymbol}{currentPrice}</strong>
            </span>

            {/* Half portion */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              <span style={{ fontSize: '0.60rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Half</span>
              <strong style={{ fontSize: layout === 'card' ? '0.90rem' : '0.84rem', fontWeight: 800, color: '#475569', lineHeight: 1 }}>{currencySymbol}{rawHalfPrice}</strong>
            </span>
          </div>

          {/* Struck-through Old Price */}
          {hasValidOldPrice && (
            <span style={{
              fontSize: '0.74rem',
              color: '#94A3B8',
              textDecoration: 'line-through',
              fontWeight: 500
            }}>
              {currencySymbol}{rawOldPrice}
            </span>
          )}
        </div>
      );
    }

    // Single Price Layout: Sleek, high-contrast, crystal clear typography
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '2px'
        }}>
          <span style={{
            fontSize: layout === 'card' ? '1.14rem' : '1.02rem',
            fontWeight: 900,
            color: '#0F172A',
            letterSpacing: '-0.02em',
            lineHeight: 1
          }}>
            {currencySymbol}{currentPrice}
          </span>
        </div>

        {/* Struck-through Old Price */}
        {hasValidOldPrice && (
          <span style={{
            fontSize: '0.76rem',
            color: '#94A3B8',
            textDecoration: 'line-through',
            fontWeight: 500
          }}>
            {currencySymbol}{rawOldPrice}
          </span>
        )}

        {/* SAVE Badge */}
        {hasValidOldPrice && savings > 0 && (
          <span style={{
            fontSize: '0.60rem',
            fontWeight: 800,
            color: '#15803D',
            background: '#DCFCE7',
            border: '1px solid #BBF7D0',
            padding: '1px 6px',
            borderRadius: '999px',
            letterSpacing: '0.02em'
          }}>
            SAVE {currencySymbol}{savings}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '110px'
    }}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Grid View Responsiveness */
        .dish-catalog-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 1250px) {
          .dish-catalog-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 14px !important;
          }
        }

        @media (max-width: 900px) {
          .dish-catalog-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
        }

        @media (max-width: 500px) {
          .dish-catalog-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }

        /* List View Display */
        .dish-catalog-table-wrapper {
          width: 100%;
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .dish-table-row {
          transition: background 0.15s ease;
        }
        .dish-table-row:hover {
          background-color: #F8FAFC;
        }

        .mobile-dish-list-container {
          display: none;
          flex-direction: column;
          gap: 10px;
        }

        @media (max-width: 768px) {
          .desktop-table-view {
            display: none !important;
          }
          .mobile-dish-list-container {
            display: flex !important;
          }
          .desktop-only-header {
            display: none !important;
          }
          .mobile-only-hero {
            display: block !important;
          }
          .desktop-summary-cards {
            display: none !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-only-hero {
            display: none !important;
          }
        }

        .dish-grid-card {
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
        }
        .dish-grid-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(0,0,0,0.06) !important;
          border-color: #CBD5E1 !important;
        }

        .category-tile-btn {
          transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .category-tile-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
      `}</style>

      {/* ========================================================
          1. DESKTOP PAGE HEADER (1100px+)
         ======================================================== */}
      <div className="desktop-only-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Menu & Catalog
            </h1>
            <span style={{
              background: '#DCFCE7',
              color: '#15803D',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              Live Catalog
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Manage and organize your dishes, categories and combos with precision.
          </p>
        </div>

        {/* Desktop Primary CTA: + Add Dish (with Dropdown) */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {restaurantInfo?.slug && (
            <button
              onClick={() => {
                if (onReturnToMenu) onReturnToMenu(restaurantInfo.slug);
                else window.open(`/r/${restaurantInfo.slug}`, '_blank');
              }}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.80rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Store size={15} color="#16A34A" />
              <span>Business View</span>
            </button>
          )}

          <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(10,35,21,0.25)' }}>
            <button
              onClick={activeSubTab === 'combos' ? onOpenAddCombo : activeSubTab === 'categories' ? onOpenAddCategory : onOpenAddDish}
              disabled={dishQuota.isAtLimit}
              style={{
                padding: '10px 18px',
                background: dishQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} color="#D4AF37" strokeWidth={3} />
              <span>
                {activeSubTab === 'combos' ? '+ Add Combo' : activeSubTab === 'categories' ? '+ Add Category' : '+ Add Dish'}
              </span>
            </button>
            <button
              onClick={() => setShowAddMenuDropdown(!showAddMenuDropdown)}
              style={{
                padding: '10px 10px',
                background: '#061D11',
                color: '#FFFFFF',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Add more options"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Add Dropdown Menu */}
          {showAddMenuDropdown && (
            <div style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
              padding: '6px',
              zIndex: 1000,
              minWidth: '170px'
            }}>
              <button
                onClick={() => { onOpenAddDish(); setShowAddMenuDropdown(false); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#0F172A',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={14} color="#16A34A" />
                <span>+ Add Dish</span>
              </button>
              <button
                onClick={() => { onOpenAddCategory(); setShowAddMenuDropdown(false); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#0F172A',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FolderPlus size={14} color="#0284C7" />
                <span>+ Add Category</span>
              </button>
              <button
                onClick={() => { onOpenAddCombo(); setShowAddMenuDropdown(false); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#0F172A',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Package size={14} color="#9333EA" />
                <span>+ Add Combo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          MOBILE HERO CARD (DARK FOREST GREEN #062B1C)
         ======================================================== */}
      <div className="mobile-only-hero" style={{
        background: 'linear-gradient(145deg, #0A2315 0%, #061D11 100%)',
        borderRadius: '20px',
        padding: '20px 18px',
        color: '#FFFFFF',
        boxShadow: '0 4px 16px rgba(10,35,21,0.2)',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Menu & Catalog
          </h2>
          <span style={{
            background: 'rgba(22, 163, 74, 0.25)',
            color: '#4ADE80',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            fontSize: '0.66rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '6px'
          }}>
            Live Catalog
          </span>
        </div>

        <p style={{ fontSize: '0.76rem', color: '#94A3B8', margin: '0 0 16px 0', lineHeight: 1.3 }}>
          Manage and organize your dishes, categories and combos.
        </p>

        {/* 3 Metric Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          <div
            onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
            style={{
              background: activeSubTab === 'dishes' ? 'rgba(22, 163, 74, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
              border: activeSubTab === 'dishes' ? '1px solid #22C55E' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF' }}>{safeDishes.length}</div>
            <div style={{ fontSize: '0.66rem', color: activeSubTab === 'dishes' ? '#4ADE80' : '#94A3B8', fontWeight: 700, marginTop: '2px' }}>Dishes</div>
          </div>

          <div
            onClick={() => setActiveSubTab && setActiveSubTab('categories')}
            style={{
              background: activeSubTab === 'categories' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
              border: activeSubTab === 'categories' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF' }}>{safeCategories.length}</div>
            <div style={{ fontSize: '0.66rem', color: activeSubTab === 'categories' ? '#38BDF8' : '#94A3B8', fontWeight: 700, marginTop: '2px' }}>Categories</div>
          </div>

          <div
            onClick={() => setActiveSubTab && setActiveSubTab('combos')}
            style={{
              background: activeSubTab === 'combos' ? 'rgba(147, 51, 234, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
              border: activeSubTab === 'combos' ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF' }}>{safeCombos.length}</div>
            <div style={{ fontSize: '0.66rem', color: activeSubTab === 'combos' ? '#C084FC' : '#94A3B8', fontWeight: 700, marginTop: '2px' }}>Combos</div>
          </div>
        </div>

        {/* Mobile Split Action Button (+ Add Dish | ▼) */}
        <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}>
          <button
            onClick={activeSubTab === 'combos' ? onOpenAddCombo : activeSubTab === 'categories' ? onOpenAddCategory : onOpenAddDish}
            disabled={dishQuota.isAtLimit}
            style={{
              flex: 1,
              padding: '11px 14px',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={3} />
            <span>
              {activeSubTab === 'combos' ? '+ Add Combo' : activeSubTab === 'categories' ? '+ Add Category' : '+ Add Dish'}
            </span>
          </button>
          <button
            onClick={() => setShowMobileAddDropdown(!showMobileAddDropdown)}
            style={{
              padding: '11px 12px',
              background: '#0F6932',
              color: '#FFFFFF',
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {/* Mobile Add Dropdown Modal */}
        {showMobileAddDropdown && (
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '18px',
            right: '18px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            padding: '8px',
            zIndex: 1000,
            color: '#0F172A'
          }}>
            <button
              onClick={() => { onOpenAddDish(); setShowMobileAddDropdown(false); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: '#0F172A',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} />
              </div>
              <div>
                <strong>+ Add Dish</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Add single food item</span>
              </div>
            </button>

            <button
              onClick={() => { onOpenAddCategory(); setShowMobileAddDropdown(false); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: '#0F172A',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#EFF6FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderPlus size={16} />
              </div>
              <div>
                <strong>+ Add Category</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Create a new food section</span>
              </div>
            </button>

            <button
              onClick={() => { onOpenAddCombo(); setShowMobileAddDropdown(false); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: '#0F172A',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#FAF5FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} />
              </div>
              <div>
                <strong>+ Add Combo</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Create value meal bundle</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          2. DESKTOP SUMMARY CARDS (4 EQUAL COMPACT CARDS)
         ======================================================== */}
      <div className="desktop-summary-cards" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px'
      }}>
        {/* Card 1: Dishes */}
        <div
          onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: activeSubTab === 'dishes' ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#EBFDF5',
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Utensils size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
              {safeDishes.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
              Dishes
            </div>
          </div>
        </div>

        {/* Card 2: Categories */}
        <div
          onClick={() => setActiveSubTab && setActiveSubTab('categories')}
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: activeSubTab === 'categories' ? '1.5px solid #0284C7' : '1px solid #E2E8F0',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#EFF6FF',
            color: '#0284C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
              {safeCategories.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
              Categories
            </div>
          </div>
        </div>

        {/* Card 3: Combos */}
        <div
          onClick={() => setActiveSubTab && setActiveSubTab('combos')}
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: activeSubTab === 'combos' ? '1.5px solid #9333EA' : '1px solid #E2E8F0',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#FAF5FF',
            color: '#9333EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
              {safeCombos.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
              Combos
            </div>
          </div>
        </div>

        {/* Card 4: Menu Views */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#FEFCE8',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Eye size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
              100
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
              Menu Views This Month
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. SEARCH & COMPACT PILL FILTERS
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Search Input Row with Filters Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={17} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients..."
              style={{
                width: '100%',
                padding: '11px 36px 11px 40px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontSize: '0.84rem',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#E2E8F0',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          <button
            onClick={() => { setDietFilter('all'); setSelectedCatFilter('all'); setSearch(''); }}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <SlidersHorizontal size={14} color="#64748B" />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Compact Filter Pills */}
        <div className="no-scrollbar" style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          padding: '2px 0',
          WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { id: 'all', label: `All (${safeDishes.length})` },
            { id: 'veg', label: '🟢 Veg' },
            { id: 'nonveg', label: '🔴 Non-Veg' },
            { id: 'must_try', label: '⭐ Best Sellers' },
            { id: 'available', label: '🟢 In Stock' },
            { id: 'sold_out', label: '✕ Sold Out' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setDietFilter(chip.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: dietFilter === chip.id ? '1px solid #0A2315' : '1px solid #E2E8F0',
                background: dietFilter === chip.id ? '#0A2315' : '#FFFFFF',
                color: dietFilter === chip.id ? '#FFFFFF' : '#475569',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================
          4. CATEGORIES (HORIZONTALLY SCROLLABLE TILES AT TOP - NO SIDEBAR)
         ======================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Categories
          </h3>
          <button
            onClick={onOpenAddCategory}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#16A34A',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} color="#16A34A" />
            <span>+ Add Category</span>
          </button>
        </div>

        {/* Horizontal Category Scroll Strip */}
        <div className="no-scrollbar" style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          padding: '4px 2px 8px 2px',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Tile 1: All Dishes */}
          <button
            onClick={() => { setSelectedCatFilter('all'); setActiveSubTab && setActiveSubTab('dishes'); }}
            className="category-tile-btn"
            style={{
              width: '84px',
              minWidth: '84px',
              height: '84px',
              borderRadius: '16px',
              border: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '1.5px solid #0A2315' : '1px solid #E2E8F0',
              background: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#0A2315' : '#FFFFFF',
              color: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#FFFFFF' : '#0F172A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexShrink: 0
            }}
          >
            <div style={{ fontSize: '1.2rem', color: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#4ADE80' : '#16A34A' }}>
              <LayoutGrid size={20} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>
              All Dishes
            </span>
            <span style={{ fontSize: '0.64rem', color: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
              {safeDishes.length}
            </span>
          </button>

          {/* Tile 2: Combos Shortcut Tile */}
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('combos')}
            className="category-tile-btn"
            style={{
              width: '84px',
              minWidth: '84px',
              height: '84px',
              borderRadius: '16px',
              border: activeSubTab === 'combos' ? '1.5px solid #9333EA' : '1px solid #E2E8F0',
              background: activeSubTab === 'combos' ? '#9333EA' : '#FFFFFF',
              color: activeSubTab === 'combos' ? '#FFFFFF' : '#0F172A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexShrink: 0
            }}
          >
            <div style={{ fontSize: '1.3rem' }}>
              🍱
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '72px'
            }}>
              Combos
            </span>
            <span style={{ fontSize: '0.64rem', color: activeSubTab === 'combos' ? '#F3E8FF' : '#9333EA', fontWeight: 700 }}>
              {safeCombos.length}
            </span>
          </button>

          {/* Dynamic Category Tiles */}
          {safeCategories.map(cat => {
            const count = safeDishes.filter(d => String(d.category_id) === String(cat.id)).length;
            const isSelected = String(selectedCatFilter) === String(cat.id) && activeSubTab === 'dishes';
            const emoji = getCategoryEmoji(cat.name);

            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCatFilter(isSelected ? 'all' : cat.id); setActiveSubTab && setActiveSubTab('dishes'); }}
                className="category-tile-btn"
                style={{
                  width: '84px',
                  minWidth: '84px',
                  height: '84px',
                  borderRadius: '16px',
                  border: isSelected ? '1.5px solid #0A2315' : '1px solid #E2E8F0',
                  background: isSelected ? '#0A2315' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#0F172A',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  flexShrink: 0
                }}
              >
                <div style={{ fontSize: '1.3rem' }}>
                  {emoji}
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '72px'
                }}>
                  {cat.name}
                </span>
                <span style={{ fontSize: '0.64rem', color: isSelected ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          5. COMBOS VIEW (WHEN COMBOS TAB IS SELECTED)
         ======================================================== */}
      {activeSubTab === 'combos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Value Meal Combos ({safeCombos.length})
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Multi-dish bundles to boost Average Order Value
              </span>
            </div>

            <button
              onClick={onOpenAddCombo}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.78rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(10,35,21,0.2)'
              }}
            >
              <Package size={15} color="#D4AF37" />
              <span>+ Add Combo</span>
            </button>
          </div>

          {safeCombos.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '44px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <Package size={34} color="#9333EA" style={{ margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>No meal combos created yet</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 16px 0' }}>Create value meal bundles (e.g. Burger + Fries + Coke) to increase revenue.</p>
              <button
                onClick={onOpenAddCombo}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#0A2315',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                + Add First Combo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {safeCombos.map(combo => (
                <div
                  key={combo.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        background: '#FAF5FF',
                        color: '#9333EA',
                        border: '1px solid #F3E8FF',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        ✨ VALUE COMBO
                      </span>
                      <button
                        onClick={() => onToggleComboAvailability && onToggleComboAvailability(combo.id, !combo.is_available)}
                        style={{
                          background: combo.is_available !== false ? '#DCFCE7' : '#FEE2E2',
                          color: combo.is_available !== false ? '#15803D' : '#DC2626',
                          border: `1px solid ${combo.is_available !== false ? '#BBF7D0' : '#FECACA'}`,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {combo.is_available !== false ? '✓ In Stock' : '✕ Sold Out'}
                      </button>
                    </div>

                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                      {combo.name}
                    </h4>

                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', marginTop: '6px' }}>
                      {currencySymbol}{combo.price}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #F8FAFC', paddingTop: '10px' }}>
                    <button
                      onClick={() => onOpenEditCombo && onOpenEditCombo(combo)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        color: '#0F172A',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit3 size={12} />
                      <span>Edit Combo</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmCombo(combo)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid #FEE2E2',
                        background: '#FFF5F5',
                        color: '#DC2626',
                        cursor: 'pointer'
                      }}
                      title="Delete Combo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          6. DISH CATALOG (WHEN DISHES TAB IS SELECTED)
         ======================================================== */}
      {activeSubTab === 'dishes' && (
        <>
          {/* Header & Controls Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 2px 0 2px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                {activeCategoryObj ? `${activeCategoryObj.name}` : `All Dishes`}
                <span style={{ fontSize: '0.84rem', color: '#64748B', fontWeight: 600, marginLeft: '6px' }}>
                  ({filteredDishes.length})
                </span>
              </h3>
            </div>

            {/* View Toggle + Sort + Items Per Page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Segmented View Toggle [ ▦ Grid ] [ ☷ List ] */}
              <div 
                role="group" 
                aria-label="View Mode Selector"
                style={{ 
                  display: 'inline-flex', 
                  background: '#FFFFFF', 
                  border: '1px solid #E2E8F0', 
                  borderRadius: '10px', 
                  padding: '3px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                <button
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  style={{
                    padding: '5px 10px',
                    border: 'none',
                    borderRadius: '7px',
                    background: viewMode === 'grid' ? '#0A2315' : 'transparent',
                    color: viewMode === 'grid' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    transition: 'all 0.15s ease'
                  }}
                  title="Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  style={{
                    padding: '5px 10px',
                    border: 'none',
                    borderRadius: '7px',
                    background: viewMode === 'list' ? '#0A2315' : 'transparent',
                    color: viewMode === 'list' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    transition: 'all 0.15s ease'
                  }}
                  title="List View"
                >
                  <List size={14} />
                  <span>List</span>
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                <option value="recent">Sort by: Recently Updated</option>
                <option value="name_asc">Sort by: Name (A-Z)</option>
                <option value="price_asc">Sort by: Price (Low to High)</option>
                <option value="price_desc">Sort by: Price (High to Low)</option>
                <option value="instock_first">Sort by: In Stock First</option>
              </select>

              {/* Page Size Dropdown */}
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#64748B',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value={24}>24 / page</option>
                <option value={48}>48 / page</option>
                <option value={96}>96 / page</option>
                <option value="all">All ({filteredDishes.length})</option>
              </select>
            </div>
          </div>

          {/* Empty State */}
          {filteredDishes.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '48px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <Utensils size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                {search ? 'No dishes match your search' : 'No dishes found'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 18px 0', maxWidth: '340px', marginLeft: 'auto', marginRight: 'auto' }}>
                {search ? 'Try clearing your search keyword or active filters to see more menu items.' : 'Add your first dish to this category to get started.'}
              </p>
              <button
                onClick={search ? () => { setSearch(''); setSelectedCatFilter('all'); setDietFilter('all'); } : onOpenAddDish}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#0A2315',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {search ? 'Clear Search & Filters' : '+ Add Dish'}
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* ========================================================
               1. POLISHED GRID VIEW (4/3/2/1 COLS RESPONSIVE)
               ======================================================== */
            <div className="dish-catalog-grid">
              {paginatedDishes.map(dish => {
                const isAvailable = dish.is_available !== false;
                const isVeg = dish.type === 'veg';
                const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                return (
                  <div
                    key={dish.id}
                    className="dish-grid-card"
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      padding: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      position: 'relative',
                      opacity: isAvailable ? 1 : 0.72,
                      minHeight: '290px'
                    }}
                  >
                    <div>
                      {/* Dish Image Container (~42% Card Height) */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '138px',
                        borderRadius: '12px',
                        background: '#F8FAFC',
                        overflow: 'hidden',
                        marginBottom: '10px',
                        border: '1px solid #F1F5F9'
                      }}>
                        <img
                          src={getDishImageUrl(dish.image || dish.image_url)}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                        />

                        {/* Top-Left: Bestseller Badge or FSSAI Veg/NonVeg Stamp */}
                        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {dish.must_try ? (
                            <span style={{
                              background: '#0A2315',
                              color: '#FFFFFF',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <Star size={10} color="#D4AF37" fill="#D4AF37" />
                              <span>Bestseller</span>
                            </span>
                          ) : (
                            <span style={{
                              width: '15px',
                              height: '15px',
                              background: '#FFFFFF',
                              border: `1.5px solid ${isVeg ? '#16A34A' : '#DC2626'}`,
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.18)'
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isVeg ? '#16A34A' : '#DC2626'
                              }} />
                            </span>
                          )}
                        </div>

                        {/* Top-Right: 3-Dot Overflow Menu */}
                        <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                          <button
                            onClick={() => setOpenDishMenuId(openDishMenuId === dish.id ? null : dish.id)}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.94)',
                              border: '1px solid rgba(0,0,0,0.06)',
                              color: '#0F172A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                            }}
                            title="More Actions"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {/* Floating Context Menu */}
                          {openDishMenuId === dish.id && (
                            <div style={{
                              position: 'absolute',
                              top: '32px',
                              right: 0,
                              background: '#FFFFFF',
                              borderRadius: '12px',
                              border: '1px solid #E2E8F0',
                              boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                              padding: '5px',
                              zIndex: 100,
                              minWidth: '145px'
                            }}>
                              <button
                                onClick={() => { onOpenEditDish(dish); setOpenDishMenuId(null); }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#0F172A',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <Edit3 size={13} />
                                <span>Edit Details</span>
                              </button>
                              <button
                                onClick={() => {
                                  setQuickPriceDish(dish);
                                  setQuickPriceVal({ price: dish.price || '', price_half: dish.price_half || '' });
                                  setOpenDishMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#0284C7',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <DollarSign size={13} />
                                <span>Quick Price</span>
                              </button>
                              <button
                                onClick={() => {
                                  onToggleAvailability(dish.id, !isAvailable);
                                  setOpenDishMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: isAvailable ? '#DC2626' : '#16A34A',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>{isAvailable ? 'Mark Sold Out' : 'Mark In Stock'}</span>
                              </button>
                              <button
                                onClick={() => { setDeleteConfirmDish(dish); setOpenDishMenuId(null); }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#DC2626',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Dish Title (Max 2 lines, clean height) */}
                      <h4 style={{
                        fontSize: '0.94rem',
                        fontWeight: 800,
                        color: '#0F172A',
                        margin: '0 0 2px 0',
                        lineHeight: 1.25,
                        minHeight: '2.5em',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        letterSpacing: '-0.01em'
                      }} title={dish.name}>
                        {dish.name}
                      </h4>

                      {/* Category Label */}
                      <span style={{
                        fontSize: '0.70rem',
                        color: '#64748B',
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {catObj?.name || 'Main Course'}
                      </span>
                    </div>

                    {/* Bottom Row: Price & In Stock Pill (Rock-solid baseline) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '6px',
                      paddingTop: '8px',
                      borderTop: '1px solid #F1F5F9'
                    }}>
                      {/* Formatted Price Hierarchy */}
                      {renderDishPrice(dish, 'card')}

                      {/* Status Pill Toggle */}
                      <button
                        onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                        style={{
                          background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                          color: isAvailable ? '#15803D' : '#DC2626',
                          border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        <span>{isAvailable ? '✓ In Stock' : '✕ Sold Out'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ========================================================
               2. POLISHED LIST VIEW (DESKTOP DATA TABLE + MOBILE CARDS)
               ======================================================== */
            <>
              {/* DESKTOP DATA TABLE (>= 769px) */}
              <div className="desktop-table-view dish-catalog-table-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      background: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      color: '#64748B',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      <th style={{ padding: '12px 16px', width: '56px' }}>IMAGE</th>
                      <th style={{ padding: '12px 16px' }}>DISH</th>
                      <th style={{ padding: '12px 16px', width: '160px' }}>CATEGORY</th>
                      <th style={{ padding: '12px 16px', width: '140px' }}>PRICE</th>
                      <th style={{ padding: '12px 16px', width: '120px' }}>STATUS</th>
                      <th style={{ padding: '12px 16px', width: '140px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDishes.map(dish => {
                      const isAvailable = dish.is_available !== false;
                      const isVeg = dish.type === 'veg';
                      const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                      return (
                        <tr 
                          key={dish.id}
                          className="dish-table-row"
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            opacity: isAvailable ? 1 : 0.72
                          }}
                        >
                          {/* Image Thumbnail */}
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '10px',
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <img
                                src={getDishImageUrl(dish.image || dish.image_url)}
                                alt={dish.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                              />
                            </div>
                          </td>

                          {/* Dish Name & Details */}
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                width: '12px',
                                height: '12px',
                                background: '#FFFFFF',
                                border: `1.5px solid ${isVeg ? '#16A34A' : '#DC2626'}`,
                                borderRadius: '3px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : '#DC2626' }} />
                              </span>

                              <strong style={{ fontSize: '0.90rem', color: '#0F172A', fontWeight: 800 }}>
                                {dish.name}
                              </strong>

                              {dish.must_try && (
                                <span style={{
                                  fontSize: '0.60rem',
                                  background: '#FEF3C7',
                                  color: '#D97706',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  ⭐ Best
                                </span>
                              )}
                            </div>

                            {dish.description && (
                              <p style={{
                                fontSize: '0.72rem',
                                color: '#64748B',
                                margin: '2px 0 0 18px',
                                maxWidth: '400px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {dish.description}
                              </p>
                            )}
                          </td>

                          {/* Category */}
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{
                              fontSize: '0.74rem',
                              color: '#334155',
                              fontWeight: 600,
                              background: '#F1F5F9',
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}>
                              {catObj?.name || 'Main Course'}
                            </span>
                          </td>

                          {/* Price */}
                          <td style={{ padding: '10px 16px' }}>
                            {renderDishPrice(dish, 'table')}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 16px' }}>
                            <button
                              onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                              style={{
                                background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                                color: isAvailable ? '#15803D' : '#DC2626',
                                border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <span>{isAvailable ? '✓ In Stock' : '✕ Sold Out'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                onClick={() => {
                                  setQuickPriceDish(dish);
                                  setQuickPriceVal({ price: dish.price || '', price_half: dish.price_half || '' });
                                }}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #E2E8F0',
                                  background: '#FFFFFF',
                                  color: '#0284C7',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                                title="Quick Price"
                              >
                                ₹ Price
                              </button>

                              <button
                                onClick={() => onOpenEditDish(dish)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #E2E8F0',
                                  background: '#FFFFFF',
                                  color: '#0F172A',
                                  cursor: 'pointer'
                                }}
                                title="Edit Dish"
                              >
                                <Edit3 size={13} />
                              </button>

                              <button
                                onClick={() => setDeleteConfirmDish(dish)}
                                style={{
                                  padding: '5px 7px',
                                  borderRadius: '6px',
                                  border: '1px solid #FEE2E2',
                                  background: '#FFF5F5',
                                  color: '#DC2626',
                                  cursor: 'pointer'
                                }}
                                title="Delete Dish"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE COMPACT LIST ROWS (< 769px) */}
              <div className="mobile-dish-list-container">
                {paginatedDishes.map(dish => {
                  const isAvailable = dish.is_available !== false;
                  const isVeg = dish.type === 'veg';
                  const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                  return (
                    <div
                      key={dish.id}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '14px',
                        border: '1px solid #E2E8F0',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        opacity: isAvailable ? 1 : 0.72
                      }}
                    >
                      {/* Left: 64px Image */}
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '10px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative'
                      }}>
                        <img
                          src={getDishImageUrl(dish.image || dish.image_url)}
                          alt={dish.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                        />
                        <span style={{
                          position: 'absolute',
                          top: '3px',
                          left: '3px',
                          width: '12px',
                          height: '12px',
                          background: '#FFFFFF',
                          border: `1.5px solid ${isVeg ? '#16A34A' : '#DC2626'}`,
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : '#DC2626' }} />
                        </span>
                      </div>

                      {/* Middle: Name + Category + Price */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <h4 style={{
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            color: '#0F172A',
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {dish.name}
                          </h4>
                          {dish.must_try && (
                            <span style={{ fontSize: '0.58rem', background: '#FEF3C7', color: '#D97706', padding: '1px 4px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>
                              ⭐ Best
                            </span>
                          )}
                        </div>

                        <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {catObj?.name || 'Main Course'}
                        </span>

                        <div style={{ marginTop: '3px' }}>
                          {renderDishPrice(dish, 'list')}
                        </div>
                      </div>

                      {/* Right: Actions + In-stock */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => onOpenEditDish(dish)}
                            style={{
                              padding: '5px 7px',
                              borderRadius: '6px',
                              border: '1px solid #E2E8F0',
                              background: '#F8FAFC',
                              color: '#0F172A',
                              cursor: 'pointer'
                            }}
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmDish(dish)}
                            style={{
                              padding: '5px 7px',
                              borderRadius: '6px',
                              border: '1px solid #FEE2E2',
                              background: '#FFF5F5',
                              color: '#DC2626',
                              cursor: 'pointer'
                            }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <button
                          onClick={() => onToggleAvailability && onToggleAvailability(dish.id, !isAvailable)}
                          style={{
                            background: isAvailable ? '#DCFCE7' : '#FEE2E2',
                            color: isAvailable ? '#15803D' : '#DC2626',
                            border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {isAvailable ? '✓ In Stock' : '✕ Sold Out'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ========================================================
              8. POLISHED PAGINATION BAR
             ======================================================== */}
          {filteredDishes.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 6px',
              flexWrap: 'wrap',
              gap: '10px',
              borderTop: '1px solid #E2E8F0',
              marginTop: '8px'
            }}>
              <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
                Showing{' '}
                <strong style={{ color: '#0F172A' }}>
                  {isAllPages ? 1 : Math.min(totalItems, (safeCurrentPage - 1) * effectivePageSize + 1)}
                </strong>
                –
                <strong style={{ color: '#0F172A' }}>
                  {isAllPages ? totalItems : Math.min(totalItems, safeCurrentPage * effectivePageSize)}
                </strong>
                {' '}of <strong style={{ color: '#0F172A' }}>{totalItems}</strong> dishes
              </span>

              {!isAllPages && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {/* Prev Button */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    style={{
                      padding: '6px 9px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: safeCurrentPage === 1 ? '#F8FAFC' : '#FFFFFF',
                      color: safeCurrentPage === 1 ? '#CBD5E1' : '#0F172A',
                      cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                    .map((p, idx, arr) => {
                      const isPrevGap = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {isPrevGap && <span style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.74rem' }}>...</span>}
                          <button
                            onClick={() => setCurrentPage(p)}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              border: p === safeCurrentPage ? '1px solid #0A2315' : '1px solid #E2E8F0',
                              background: p === safeCurrentPage ? '#0A2315' : '#FFFFFF',
                              color: p === safeCurrentPage ? '#FFFFFF' : '#0F172A',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    style={{
                      padding: '6px 9px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: safeCurrentPage === totalPages ? '#F8FAFC' : '#FFFFFF',
                      color: safeCurrentPage === totalPages ? '#CBD5E1' : '#0F172A',
                      cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Next Page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================
          7. FLOATING + ADD ACTION BUTTON (MOBILE ONLY)
         ======================================================== */}
      <button
        onClick={activeSubTab === 'combos' ? onOpenAddCombo : activeSubTab === 'categories' ? onOpenAddCategory : onOpenAddDish}
        disabled={dishQuota.isAtLimit}
        style={{
          position: 'fixed',
          bottom: '84px',
          right: '16px',
          background: dishQuota.isAtLimit ? '#64748B' : 'linear-gradient(135deg, #0A2315 0%, #062B1C 100%)',
          color: '#FFFFFF',
          border: '1.5px solid rgba(212, 175, 55, 0.4)',
          borderRadius: '30px',
          padding: '11px 20px',
          fontSize: '0.84rem',
          fontWeight: 900,
          boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 89,
          cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer'
        }}
      >
        <Plus size={16} color="#D4AF37" strokeWidth={3} />
        <span>
          {activeSubTab === 'combos' ? 'Add Combo' : activeSubTab === 'categories' ? 'Add Category' : 'Add Dish'}
        </span>
      </button>

      {/* ========================================================
          8. QUICK PRICE MODAL
         ======================================================== */}
      {quickPriceDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <form onSubmit={handleQuickPriceSubmit} style={{ background: '#FFFFFF', borderRadius: '18px', padding: '22px', maxWidth: '340px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 12px 0' }}>
              Quick Price: {quickPriceDish.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Full Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  required
                  value={quickPriceVal.price}
                  onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.84rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Half Price ({currencySymbol}) Optional
                </label>
                <input
                  type="number"
                  value={quickPriceVal.price_half}
                  onChange={(e) => setQuickPriceVal({ ...quickPriceVal, price_half: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.84rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => setQuickPriceDish(null)}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: '#0A2315', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                Save Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          9. DELETE CONFIRMATION MODALS
         ======================================================== */}
      {deleteConfirmDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Dish</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete <strong>'{deleteConfirmDish.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmDish(null)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteDish(deleteConfirmDish.id); setDeleteConfirmDish(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Category</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete category <strong>'{deleteConfirmCategory.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmCategory(null)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteCategory(deleteConfirmCategory.id); setDeleteConfirmCategory(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCombo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Delete Combo</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 18px 0' }}>
              Permanently delete combo <strong>'{deleteConfirmCombo.name}'</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmCombo(null)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onDeleteCombo(deleteConfirmCombo.id); setDeleteConfirmCombo(null); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
