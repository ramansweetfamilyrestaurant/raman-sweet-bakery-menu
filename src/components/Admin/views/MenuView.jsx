import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronUp, 
  Copy, 
  Store, 
  Check, 
  Tag,
  FolderPlus,
  LayoutGrid,
  List,
  Eye,
  SlidersHorizontal,
  UploadCloud,
  ShieldCheck,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Download,
  FileText,
  Upload
} from 'lucide-react';
import { resolveImageUrl, getDishImageUrl, getCategoryImageUrl, getComboImageUrl, hasCustomCategoryImage, hasCustomDishImage } from '../../../utils/imageHelper';
import { formatQuota } from '../../../utils/planCapabilities';
import { getCurrencySymbol, formatPriceNumber } from '../../../utils/currencyHelper';
import { createDish } from '../../../api/client';

export default function MenuView({
  token = '',
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
  onReorderCategories,
  onDeleteCategory,
  onOpenAddCategory,
  onOpenEditCategory,
  onOpenAddCombo,
  onOpenEditCombo,
  onDeleteCombo,
  onToggleComboAvailability,
  onToggleBadge,
  onRefreshData = null,
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
  const [dietFilter, setDietFilter] = useState('all'); // 'all', 'veg', 'nonveg', 'egg', 'must_try', 'special', 'available', 'sold_out'
  const [priceFilter, setPriceFilter] = useState('all'); // 'all', 'under_100', '100_250', 'above_250'
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showImageTipModal, setShowImageTipModal] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name_asc', 'price_asc', 'price_desc', 'instock_first'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showAddMenuDropdown, setShowAddMenuDropdown] = useState(false);
  const [showMobileAddDropdown, setShowMobileAddDropdown] = useState(false);
  const [openDishMenuId, setOpenDishMenuId] = useState(null);

  // Multi-Select Bulk Actions State
  const [selectedDishIds, setSelectedDishIds] = useState([]);
  const [inlinePriceDishId, setInlinePriceDishId] = useState(null);
  const [inlinePriceVal, setInlinePriceVal] = useState('');

  // Pagination state (default 12 per page matching the master reference)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const categoryScrollRef = useRef(null);

  const safeDishes = Array.isArray(dishes) ? dishes : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCombos = Array.isArray(combos) ? combos : [];
  const activeCategoryObj = safeCategories.find(c => String(c.id) === String(selectedCatFilter));

  const dishQuota = formatQuota(safeDishes.length, maxDishes);
  const catQuota = formatQuota(safeCategories.length, maxCategories);
  const comboQuota = formatQuota(safeCombos.length, maxCombos);

  // Dynamic currency resolver from restaurant settings or props
  const curr = getCurrencySymbol(restaurantInfo?.currency_symbol !== undefined ? restaurantInfo.currency_symbol : currencySymbol);

  // Dynamic live dish counts by filter criteria
  const counts = useMemo(() => {
    return {
      all: safeDishes.length,
      veg: safeDishes.filter(d => d.type === 'veg').length,
      nonveg: safeDishes.filter(d => d.type === 'nonveg').length,
      egg: safeDishes.filter(d => d.type === 'egg').length,
      must_try: safeDishes.filter(d => Boolean(d.must_try) || (typeof d.badge === 'string' && d.badge.toLowerCase().includes('must try'))).length,
      bestseller: safeDishes.filter(d => typeof d.badge === 'string' && (d.badge.toLowerCase().includes('bestseller') || d.badge.toLowerCase().includes('popular'))).length,
      special: safeDishes.filter(d => typeof d.badge === 'string' && (d.badge.toLowerCase().includes('special') || d.badge.toLowerCase().includes('chef'))).length,
      available: safeDishes.filter(d => d.is_available !== false && d.available !== false && d.available !== 0).length,
      sold_out: safeDishes.filter(d => d.is_available === false || d.available === false || d.available === 0).length,
      under_100: safeDishes.filter(d => (Number(d.price) || 0) <= 100).length
    };
  }, [safeDishes]);

  const activeFilterCount = (dietFilter !== 'all' ? 1 : 0) + (priceFilter !== 'all' ? 1 : 0) + (selectedCatFilter !== 'all' ? 1 : 0) + (sortBy !== 'recent' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || Boolean(search);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCatFilter, dietFilter, priceFilter, sortBy, pageSize]);

  // Close open menus on outside click / escape
  useEffect(() => {
    if (!openDishMenuId) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenDishMenuId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openDishMenuId]);

  // Scroll Category strip
  const handleScrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Filtered & Sorted dishes
  const filteredDishes = useMemo(() => {
    let list = safeDishes.filter(d => {
      const q = (search || '').toLowerCase().trim();
      const matchesSearch = !q || 
        (d.name || '').toLowerCase().includes(q) || 
        (d.name_hi || '').toLowerCase().includes(q) || 
        (d.description || '').toLowerCase().includes(q) || 
        (d.description_hi || '').toLowerCase().includes(q) || 
        (d.ingredients || '').toLowerCase().includes(q) ||
        (d.badge || '').toLowerCase().includes(q);
        
      const matchesCat = selectedCatFilter === 'all' || 
        String(d.category_id) === String(selectedCatFilter) ||
        (d.category_name && d.category_name.toLowerCase() === (activeCategoryObj?.name || '').toLowerCase()) ||
        (d.category && d.category.toLowerCase() === (activeCategoryObj?.name || '').toLowerCase());
      
      let matchesDiet = true;
      if (dietFilter === 'veg') matchesDiet = d.type === 'veg';
      if (dietFilter === 'nonveg') matchesDiet = d.type === 'nonveg';
      if (dietFilter === 'egg') matchesDiet = d.type === 'egg';
      if (dietFilter === 'must_try') {
        matchesDiet = Boolean(d.must_try) || (typeof d.badge === 'string' && d.badge.toLowerCase().includes('must try'));
      }
      if (dietFilter === 'bestseller') {
        matchesDiet = typeof d.badge === 'string' && (d.badge.toLowerCase().includes('bestseller') || d.badge.toLowerCase().includes('popular'));
      }
      if (dietFilter === 'special') {
        matchesDiet = typeof d.badge === 'string' && (d.badge.toLowerCase().includes('special') || d.badge.toLowerCase().includes('chef'));
      }
      if (dietFilter === 'available') matchesDiet = d.is_available !== false && d.available !== false && d.available !== 0;
      if (dietFilter === 'sold_out') matchesDiet = d.is_available === false || d.available === false || d.available === 0;

      let matchesPrice = true;
      const numP = Number(d.price) || 0;
      if (priceFilter === 'under_100') matchesPrice = numP <= 100;
      else if (priceFilter === '100_250') matchesPrice = numP > 100 && numP <= 250;
      else if (priceFilter === 'above_250') matchesPrice = numP > 250;

      return matchesSearch && matchesCat && matchesDiet && matchesPrice;
    });

    if (sortBy === 'price_asc') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'instock_first') {
      list.sort((a, b) => (b.is_available !== false && b.available !== false ? 1 : 0) - (a.is_available !== false && a.available !== false ? 1 : 0));
    }

    return list;
  }, [safeDishes, search, selectedCatFilter, dietFilter, priceFilter, sortBy, activeCategoryObj]);

  // Filtered categories for Categories Workspace
  const filteredCategories = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    if (!q) return safeCategories;
    return safeCategories.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.name_hi || '').toLowerCase().includes(q)
    );
  }, [safeCategories, search]);

  // Filtered combos for Combos Workspace
  const filteredCombos = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    if (!q) return safeCombos;
    return safeCombos.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.description || '').toLowerCase().includes(q) ||
      (c.badge || '').toLowerCase().includes(q)
    );
  }, [safeCombos, search]);

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

  // Bulk Actions Handlers
  const isAllVisibleSelected = paginatedDishes.length > 0 && paginatedDishes.every(d => selectedDishIds.includes(d.id));

  const toggleSelectDish = (id) => {
    setSelectedDishIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedDishes.map(d => d.id);
    if (isAllVisibleSelected) {
      setSelectedDishIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedDishIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkAvailability = async (isAvailable) => {
    if (selectedDishIds.length === 0 || !onToggleAvailability) return;
    for (const id of selectedDishIds) {
      await onToggleAvailability(id, isAvailable);
    }
    setSelectedDishIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedDishIds.length === 0 || !onDeleteDish) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedDishIds.length} selected dishes?`)) return;
    for (const id of selectedDishIds) {
      await onDeleteDish(id);
    }
    setSelectedDishIds([]);
  };

  const handleQuickPriceSubmit = (e) => {
    e.preventDefault();
    if (quickPriceDish && onUpdateQuickPrice) {
      onUpdateQuickPrice(quickPriceDish.id, quickPriceVal.price, quickPriceVal.price_half);
      setQuickPriceDish(null);
    }
  };

  const handleMoveCategory = (index, direction) => {
    if (!onReorderCategories) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= safeCategories.length) return;

    const reordered = [...safeCategories];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    onReorderCategories(reordered);
  };

  // Helper for category food emojis with comprehensive Indian & International coverage
  const getCategoryEmoji = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('pani puri') || n.includes('golgappa') || n.includes('golgapa') || n.includes('puchka')) return '🥣';
    if (n.includes('chaat') || n.includes('kachori') || n.includes('papdi') || n.includes('bhel') || n.includes('tikki')) return '🍲';
    if (n.includes('snack') || n.includes('fries') || n.includes('pakora') || n.includes('pakoda') || n.includes('samosa')) return '🍟';
    if (n.includes('momo') || n.includes('dimsum') || n.includes('dumpling')) return '🥟';
    if (n.includes('chinese') || n.includes('noodle') || n.includes('chowmein') || n.includes('manchurian') || n.includes('pasta')) return '🍜';
    if (n.includes('burger')) return '🍔';
    if (n.includes('sandwich') || n.includes('toast') || n.includes('sub')) return '🥪';
    if (n.includes('roll') || n.includes('wrap') || n.includes('kathi') || n.includes('frankie')) return '🌯';
    if (n.includes('pizza')) return '🍕';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('dal') || n.includes('daal') || n.includes('tadka') || n.includes('makhani') || n.includes('soup')) return '🥣';
    if (n.includes('rice') || n.includes('biryani') || n.includes('pulao') || n.includes('fried rice')) return '🍚';
    if (n.includes('roti') || n.includes('naan') || n.includes('paratha') || n.includes('kulcha') || n.includes('bread') || n.includes('poori') || n.includes('puri') || n.includes('bhatura') || n.includes('bhature')) return '🫓';
    if (n.includes('south') || n.includes('dosa') || n.includes('dosha') || n.includes('idli') || n.includes('vada') || n.includes('uttapam')) return '🥞';
    if (n.includes('salad') || n.includes('raita') || n.includes('papad')) return '🥗';
    if (n.includes('north') || n.includes('curry') || n.includes('gravy') || n.includes('sabzi') || n.includes('sabji') || n.includes('main course') || n.includes('thali')) return '🍛';
    if (n.includes('beverage') || n.includes('drink') || n.includes('shake') || n.includes('tea') || n.includes('chai') || n.includes('coffee') || n.includes('juice') || n.includes('lassi') || n.includes('soda') || n.includes('mocktail')) return '🥤';
    if (n.includes('sweet') || n.includes('dessert') || n.includes('cake') || n.includes('ice cream') || n.includes('mithai') || n.includes('gulab') || n.includes('rasgulla') || n.includes('jalebi') || n.includes('pastry') || n.includes('halwa')) return '🍰';
    if (n.includes('breakfast') || n.includes('morning')) return '🍳';
    if (n.includes('combo') || n.includes('meal') || n.includes('bundle')) return '🍱';
    return '🍽️';
  };

  // Helper for dish badge details (Must Try, Bestseller, Special)
  const getDishBadge = (dish) => {
    const b = (dish.badge || '').toLowerCase();
    const isMustTry = Boolean(dish.must_try) || b.includes('must try');
    const isBestseller = b.includes('bestseller') || b.includes('popular');
    const isSpecial = b.includes('special') || b.includes('chef');

    if (isMustTry) {
      return { text: 'Must Try', icon: '🔥', bg: 'linear-gradient(135deg, #FF6B00 0%, #EA580C 100%)', color: '#FFFFFF' };
    }
    if (isBestseller) {
      return { text: 'Bestseller', icon: '⭐', bg: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)', color: '#FFFFFF' };
    }
    if (isSpecial) {
      return { text: 'Special', icon: '✨', bg: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', color: '#FFFFFF' };
    }
    if (dish.badge && dish.badge.trim()) {
      return { text: dish.badge, icon: '🏷️', bg: '#0A2315', color: '#D4AF37' };
    }
    return null;
  };

  // Helper to format price: Clean standard price (e.g. ₹59) OR Portion segmented pill [ Full ₹160 | Half ₹95 ]
  const renderDishPrice = (dish, layout = 'card') => {
    const currentPrice = Number(dish.price) || 0;
    const rawOldPrice = Number(dish.original_price || dish.mrp || dish.old_price || dish.compare_at_price);
    const hasValidOldPrice = !isNaN(rawOldPrice) && rawOldPrice > currentPrice;
    const rawHalfPrice = Number(dish.price_half);
    const hasHalfPrice = !isNaN(rawHalfPrice) && rawHalfPrice > 0;

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', maxWidth: '100%', boxSizing: 'border-box' }}>
        {hasHalfPrice ? (
          /* Dual Portion Segmented Pill for dishes with Full/Half portions */
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            padding: layout === 'card' ? '2px 5px' : '3px 7px',
            gap: layout === 'card' ? '4px' : '6px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Full portion */}
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>Full</span>
              <strong style={{ fontSize: layout === 'card' ? '0.80rem' : '0.86rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                {curr}{currentPrice}
              </strong>
            </div>

            {/* Subtle vertical divider */}
            <span style={{ width: '1px', height: '9px', background: '#CBD5E1', display: 'inline-block' }} />

            {/* Half portion */}
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 600 }}>Half</span>
              <strong style={{ fontSize: layout === 'card' ? '0.78rem' : '0.82rem', fontWeight: 800, color: '#334155', lineHeight: 1 }}>
                {curr}{rawHalfPrice}
              </strong>
            </div>
          </div>
        ) : (
          /* Standard Single Item Price across all business types */
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px' }}>
            <strong style={{
              fontSize: layout === 'card' ? '0.86rem' : '0.88rem',
              fontWeight: 900,
              color: '#0F172A',
              lineHeight: 1,
              letterSpacing: '-0.01em'
            }}>
              {curr}{currentPrice}
            </strong>
          </div>
        )}

        {/* Struck-through Old/Original Price */}
        {hasValidOldPrice && (
          <span style={{
            fontSize: '0.68rem',
            color: '#94A3B8',
            textDecoration: 'line-through',
            fontWeight: 500
          }}>
            {curr}{rawOldPrice}
          </span>
        )}
      </div>
    );
  };

  // Real Mathematical Menu Health Score from actual catalog data
  const menuHealth = useMemo(() => {
    if (safeDishes.length === 0) {
      return {
        score: 0,
        dishesAdded: false,
        imagesUploaded: false,
        categoriesOrganized: false,
        readyForCustomers: false,
        statusText: 'Add dishes to start'
      };
    }

    const dishesAdded = safeDishes.length >= 1;
    const dishesWithImg = safeDishes.filter(d => hasCustomDishImage(d.image || d.image_url)).length;
    const imgRatio = dishesWithImg / safeDishes.length;
    const imagesUploaded = imgRatio >= 0.4;
    const categoriesOrganized = safeCategories.length >= 1;
    const readyForCustomers = safeDishes.some(
      d => d.is_available !== false && d.available !== false && d.available !== 0
    );

    let score = 0;
    if (safeDishes.length >= 10) score += 35;
    else score += Math.round((safeDishes.length / 10) * 35);

    score += Math.round(imgRatio * 35);

    if (safeCategories.length >= 3) score += 15;
    else if (safeCategories.length >= 1) score += 10;

    if (readyForCustomers) score += 15;

    return {
      score: Math.min(100, Math.max(10, score)),
      dishesAdded,
      imagesUploaded,
      categoriesOrganized,
      readyForCustomers,
      statusText: score >= 80 ? 'Your menu looks great!' : (score >= 50 ? 'Good progress!' : 'Needs more details')
    };
  }, [safeDishes, safeCategories]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: '160px'
    }}>
      {/* ========================================================
          1. DESKTOP PAGE HEADER ROW (WITH CURSIVE QUOTE & SPLIT CTA)
         ======================================================== */}
      <div className="desktop-only-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: '#261B14',
              color: '#4ADE80',
              fontSize: '0.64rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#4ADE80' }} />
              LIVE
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Menu & Catalog
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Create, manage and organize your dishes, categories and combos.
          </p>
        </div>

        {/* Center/Right: Cursive Quote + Split Add Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Cursive Handwriting Quote */}
          <div className="header-cursive-quote" style={{
            fontFamily: "'Brush Script MT', 'Dancing Script', 'Caveat', cursive, Georgia, serif",
            fontSize: '1.25rem',
            color: '#8C5338',
            fontStyle: 'italic',
            lineHeight: 1.1,
            textAlign: 'right'
          }}>
            Better Food<br />Happier Customers
          </div>

          {/* Split + Add Dish CTA */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 3px 10px rgba(10,35,21,0.25)' }}>
              <button
                onClick={activeSubTab === 'combos' ? onOpenAddCombo : activeSubTab === 'categories' ? onOpenAddCategory : onOpenAddDish}
                disabled={dishQuota.isAtLimit}
                style={{
                  padding: '11px 18px',
                  background: dishQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  border: 'none',
                  cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <span>
                  {activeSubTab === 'combos' ? 'Add Combo' : activeSubTab === 'categories' ? 'Add Category' : 'Add Dish'}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddMenuDropdown(!showAddMenuDropdown);
                }}
                style={{
                  padding: '11px 11px',
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

            {/* Dropdown Options with Backdrop */}
            {showAddMenuDropdown && (
              <>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddMenuDropdown(false);
                  }}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 999,
                    cursor: 'default'
                  }}
                />

                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                  padding: '6px',
                  zIndex: 1000,
                  minWidth: '170px'
                }}>
                  <button
                    onClick={() => { onOpenAddDish(); setShowAddMenuDropdown(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Plus size={14} color="#16A34A" />
                    <span>+ Add Dish</span>
                  </button>
                  <button
                    onClick={() => { onOpenAddCategory(); setShowAddMenuDropdown(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FolderPlus size={14} color="#0284C7" />
                    <span>+ Add Category</span>
                  </button>
                  <button
                    onClick={() => { onOpenAddCombo(); setShowAddMenuDropdown(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Package size={14} color="#9333EA" />
                    <span>+ Add Combo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          MOBILE HERO CARD (NEW SLEEK DARK CHARCOAL THEME)
         ======================================================== */}
      <div className="mobile-only-hero" style={{
        background: 'linear-gradient(145deg, #181310 0%, #090C0A 100%)',
        borderRadius: '20px',
        padding: '18px 16px',
        color: '#FFFFFF',
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '1.20rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Menu & Catalog
          </h2>
          <span style={{
            background: 'rgba(34, 197, 94, 0.2)',
            color: '#4ADE80',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            fontSize: '0.64rem',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '6px'
          }}>
            • LIVE
          </span>
        </div>

        <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: '0 0 14px 0', lineHeight: 1.3 }}>
          Create, manage and organize your dishes, categories and combos.
        </p>

        {/* 3 Metric Pills on Mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          <div
            onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
            style={{
              background: activeSubTab === 'dishes' ? '#3D271D' : 'rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '8px 6px',
              textAlign: 'center',
              border: activeSubTab === 'dishes' ? '1px solid #D97706' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF' }}>{safeDishes.length}</div>
            <div style={{ fontSize: '0.64rem', color: activeSubTab === 'dishes' ? '#FB923C' : '#94A3B8', fontWeight: 700, marginTop: '2px' }}>Dishes</div>
          </div>

          <div
            onClick={() => setActiveSubTab && setActiveSubTab('categories')}
            style={{
              background: activeSubTab === 'categories' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '8px 6px',
              textAlign: 'center',
              border: activeSubTab === 'categories' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF' }}>{safeCategories.length}</div>
            <div style={{ fontSize: '0.64rem', color: activeSubTab === 'categories' ? '#38BDF8' : '#94A3B8', fontWeight: 700, marginTop: '2px' }}>Categories</div>
          </div>

          <div
            onClick={() => setActiveSubTab && setActiveSubTab('combos')}
            style={{
              background: activeSubTab === 'combos' ? 'rgba(147, 51, 234, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '8px 6px',
              textAlign: 'center',
              border: activeSubTab === 'combos' ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFFFFF' }}>{safeCombos.length}</div>
            <div style={{ fontSize: '0.64rem', color: activeSubTab === 'combos' ? '#C084FC' : '#94A3B8', fontWeight: 700, marginTop: '2px' }}>Combos</div>
          </div>
        </div>

        {/* Mobile Split Action Button (+ Add Dish | ▼) */}
        <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <button
            onClick={activeSubTab === 'combos' ? onOpenAddCombo : activeSubTab === 'categories' ? onOpenAddCategory : onOpenAddDish}
            disabled={dishQuota.isAtLimit}
            style={{
              flex: 1,
              padding: '11px 14px',
              background: '#261B14',
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
            <Plus size={16} color="#FB923C" strokeWidth={3} />
            <span>
              {activeSubTab === 'combos' ? '+ Add Combo' : activeSubTab === 'categories' ? '+ Add Category' : '+ Add Dish'}
            </span>
          </button>
          <button
            onClick={() => setShowMobileAddDropdown(!showMobileAddDropdown)}
            style={{
              padding: '11px 12px',
              background: '#1A120D',
              color: '#FFFFFF',
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {/* Mobile Add Dropdown Modal with Backdrop */}
        {showMobileAddDropdown && (
          <>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowMobileAddDropdown(false);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(2px)',
                cursor: 'default'
              }}
            />

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
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
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
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
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
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
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
          </>
        )}
      </div>

      {/* ========================================================
          2. EXACT 4 SUMMARY CARDS ROW (PEACH, BLUE, PURPLE, AMBER)
         ======================================================== */}
      <div className="desktop-summary-cards" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px'
      }}>
        {/* Card 1: Total Dishes (Peach / Coral Theme) */}
        <div
          onClick={() => setActiveSubTab && setActiveSubTab('dishes')}
          style={{
            background: '#FFF7F5',
            borderRadius: '16px',
            border: '1px solid #FFE4DD',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#FFEDE8',
              color: '#EA580C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0
            }}>
              🍽️
            </div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                {safeDishes.length}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                Total Dishes
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              • Live
            </span>
            <span style={{ fontSize: '0.62rem', color: '#94A3B8', display: 'block' }}>Active catalog</span>
          </div>
        </div>

        {/* Card 2: Categories (Soft Blue Theme) */}
        <div
          onClick={() => setActiveSubTab && setActiveSubTab('categories')}
          style={{
            background: '#F0F8FF',
            borderRadius: '16px',
            border: '1px solid #E0F0FE',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#E0F2FE',
              color: '#0284C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <LayoutGrid size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                {safeCategories.length}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                Categories
              </div>
            </div>
          </div>

          <div>
            <span style={{
              fontSize: '0.68rem',
              color: '#16A34A',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              Active
            </span>
          </div>
        </div>

        {/* Card 3: Combos (Soft Purple Theme) */}
        <div
          onClick={() => setActiveSubTab && setActiveSubTab('combos')}
          style={{
            background: '#FAF5FF',
            borderRadius: '16px',
            border: '1px solid #F3E8FF',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#F3E8FF',
              color: '#9333EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Package size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                {safeCombos.length}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                Combos
              </div>
            </div>
          </div>

          <div>
            <span style={{
              fontSize: '0.68rem',
              color: '#16A34A',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              Active
            </span>
          </div>
        </div>

        {/* Card 4: Menu Views (Soft Amber Theme) */}
        <div style={{
          background: '#FFFDF0',
          borderRadius: '16px',
          border: '1px solid #FEF3C7',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#FEF9C3',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Eye size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                {Number(restaurantInfo?.scan_count || 0)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, marginTop: '2px' }}>
                Menu Views
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.70rem', color: '#D97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              • Realtime
            </span>
            <span style={{ fontSize: '0.62rem', color: '#94A3B8', display: 'block' }}>QR Scans</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. CATEGORIES CAROUSEL STRIP (WITH ARROWS & VIEW ALL)
         ======================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Categories
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => { setSelectedCatFilter('all'); setActiveSubTab && setActiveSubTab('categories'); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span>View all</span>
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => handleScrollCategories('left')}
              className="desktop-only-header"
              style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => handleScrollCategories('right')}
              className="desktop-only-header"
              style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable Category Cards */}
        <div ref={categoryScrollRef} className="no-scrollbar" style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          whiteSpace: 'nowrap',
          padding: '4px 2px 8px 2px',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}>
          {/* Tile 1: All Dishes (Dark brown background when active) */}
          <button
            onClick={() => { setSelectedCatFilter('all'); setActiveSubTab && setActiveSubTab('dishes'); }}
            className="category-square-tile"
            style={{
              width: '76px',
              minWidth: '76px',
              height: '80px',
              borderRadius: '16px',
              border: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '1.5px solid #261B14' : '1px solid #E2E8F0',
              background: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#261B14' : '#FFFFFF',
              color: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#FFFFFF' : '#0F172A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexShrink: 0
            }}
          >
            <div style={{ fontSize: '1.2rem', color: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#FFFFFF' : '#64748B' }}>
              <LayoutGrid size={18} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>
              All Dishes
            </span>
            <span style={{ fontSize: '0.64rem', color: selectedCatFilter === 'all' && activeSubTab === 'dishes' ? '#94A3B8' : '#64748B', fontWeight: 600 }}>
              {safeDishes.length}
            </span>
          </button>

          {/* Tile 2: Combos Tile */}
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('combos')}
            className="category-square-tile"
            style={{
              width: '76px',
              minWidth: '76px',
              height: '80px',
              borderRadius: '16px',
              border: activeSubTab === 'combos' ? '1.5px solid #9333EA' : '1px solid #E2E8F0',
              background: activeSubTab === 'combos' ? '#9333EA' : '#FFFFFF',
              color: activeSubTab === 'combos' ? '#FFFFFF' : '#0F172A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexShrink: 0
            }}
          >
            <div style={{ fontSize: '1.25rem' }}>🍱</div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>
              Combos
            </span>
            <span style={{ fontSize: '0.64rem', color: activeSubTab === 'combos' ? '#F3E8FF' : '#64748B', fontWeight: 600 }}>
              {safeCombos.length}
            </span>
          </button>

          {/* Dynamic Category Tiles */}
          {safeCategories.map(cat => {
            const count = safeDishes.filter(d => 
              String(d.category_id) === String(cat.id) ||
              (d.category_name && d.category_name.toLowerCase() === (cat.name || '').toLowerCase()) ||
              (d.category && d.category.toLowerCase() === (cat.name || '').toLowerCase())
            ).length;
            const isSelected = String(selectedCatFilter) === String(cat.id) && activeSubTab === 'dishes';
            const emoji = getCategoryEmoji(cat.name);

            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCatFilter(isSelected ? 'all' : cat.id); setActiveSubTab && setActiveSubTab('dishes'); }}
                className="category-square-tile"
                style={{
                  width: '76px',
                  minWidth: '76px',
                  height: '80px',
                  borderRadius: '16px',
                  border: isSelected ? '1.5px solid #261B14' : '1px solid #E2E8F0',
                  background: isSelected ? '#261B14' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#0F172A',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  padding: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  flexShrink: 0
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F8FAFC',
                  border: isSelected ? '1px solid rgba(255,255,255,0.4)' : '1px solid #E2E8F0',
                  flexShrink: 0
                }}>
                  <img
                    src={getCategoryImageUrl(cat.image)}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/images/default-category.webp';
                    }}
                  />
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '68px'
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
          4. SEARCH & PILL FILTERS SECTION (MATCHING MOBILE SCREENSHOT)
         ======================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Search Row + Filters Button */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 42px', gap: '8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients..."
              style={{
                width: '100%',
                padding: '10px 30px 10px 34px',
                borderRadius: '11px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '0.80rem',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: '#E2E8F0', border: 'none', borderRadius: '50%', width: '16px', height: '16px', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <X size={10} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            style={{
              width: '42px',
              height: '40px',
              borderRadius: '11px',
              border: activeFilterCount > 0 ? '1.5px solid #D97706' : '1px solid #E2E8F0',
              background: activeFilterCount > 0 ? '#FFFBEB' : '#FFFFFF',
              color: activeFilterCount > 0 ? '#D97706' : '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              flexShrink: 0,
              position: 'relative'
            }}
            title="Filter & Sort Options"
          >
            <SlidersHorizontal size={17} color={activeFilterCount > 0 ? '#D97706' : '#475569'} />
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#D97706',
                color: '#FFFFFF',
                fontSize: '0.60rem',
                fontWeight: 900,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(217,119,6,0.35)'
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Pills Row with Dynamic Live Counts */}
        <div className="no-scrollbar" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          overflowY: 'hidden',
          whiteSpace: 'nowrap',
          paddingBottom: '4px',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}>
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'veg', label: 'Veg', dot: '🟢', count: counts.veg },
            { id: 'nonveg', label: 'Non-Veg', dot: '🔴', count: counts.nonveg },
            { id: 'egg', label: 'Egg', dot: '🟡', count: counts.egg },
            { id: 'must_try', label: 'Must Try', icon: '🔥', count: counts.must_try },
            { id: 'bestseller', label: 'Bestseller', icon: '⭐', count: counts.bestseller },
            { id: 'special', label: 'Special', icon: '✨', count: counts.special },
            { id: 'available', label: 'In Stock', dot: '🟢', count: counts.available },
            { id: 'sold_out', label: 'Sold Out', dot: '🔴', count: counts.sold_out },
            { id: 'under_100', label: `Under ${curr}100`, count: counts.under_100 }
          ].map(chip => {
            const isActive = chip.id === 'under_100' ? (priceFilter === 'under_100') : (dietFilter === chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  if (chip.id === 'under_100') {
                    setPriceFilter(priceFilter === 'under_100' ? 'all' : 'under_100');
                  } else {
                    setDietFilter(chip.id);
                  }
                }}
                style={{
                  padding: '6px 11px',
                  borderRadius: '16px',
                  border: isActive ? '1px solid #261B14' : '1px solid #E2E8F0',
                  background: isActive ? '#261B14' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#475569',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                {chip.dot && <span style={{ fontSize: '0.68rem' }}>{chip.dot}</span>}
                {chip.icon && <span>{chip.icon}</span>}
                <span>{chip.label}</span>
                <span style={{
                  fontSize: '0.64rem',
                  opacity: isActive ? 0.9 : 0.65,
                  fontWeight: 600,
                  marginLeft: '2px'
                }}>
                  ({chip.count})
                </span>
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setDietFilter('all');
                setPriceFilter('all');
                setSelectedCatFilter('all');
                setSearch('');
                setSortBy('recent');
              }}
              style={{
                padding: '7px 12px',
                borderRadius: '20px',
                border: '1px dashed #EF4444',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <X size={12} />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          5. 3-COLUMN MASTER WORKSPACE (LEFT BANNER + CENTER CATALOG + RIGHT WIDGETS)
         ======================================================== */}
      {activeSubTab === 'dishes' ? (
        <div className="master-workspace-layout">
          
          {/* ========================================================
              COLUMN 1: PROMO / MOTIVATIONAL BANNER (LEFT)
             ======================================================== */}
          <div className="left-promo-banner" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Card 1: Promotional Card (Approved) */}
            <div style={{
              background: 'linear-gradient(180deg, #FDECE5 0%, #FDE4D8 100%)',
              borderRadius: '20px',
              border: '1px solid #FAD6C6',
              padding: '22px 18px 18px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(234, 88, 12, 0.04)'
            }}>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#1E1B18',
                  lineHeight: 1.22,
                  margin: '0 0 8px 0',
                  letterSpacing: '-0.02em'
                }}>
                  Everything your<br />menu needs.
                </h3>
                <p style={{
                  fontSize: '0.78rem',
                  color: '#655347',
                  margin: '0 0 16px 0',
                  lineHeight: 1.42,
                  fontWeight: 500
                }}>
                  Keep your products, categories and pricing organized and always up to date.
                </p>

                <button
                  onClick={onOpenAddDish}
                  style={{
                    padding: '9px 16px',
                    background: '#181512',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '11px',
                    fontSize: '0.80rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 10px rgba(24, 21, 18, 0.25)',
                    transition: 'transform 0.14s ease'
                  }}
                >
                  <span>+ Add Item</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Large Digital Menu 3D Product Visual (Occupies lower 42% with 20px gap) */}
              <div style={{
                width: '100%',
                height: '175px',
                marginTop: '20px',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.40)',
                border: '1px solid rgba(250, 214, 198, 0.60)'
              }}>
                <img
                  src="/images/promo-menu-banner.webp?v=2"
                  alt="TouchQR digital menu"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/default-dish.webp'; }}
                />
              </div>
            </div>

            {/* Card 2: Informational Card (How it works) */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.03)'
            }}>
              {/* Header with subtle green micro-accent */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h4 style={{
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  color: '#0F172A',
                  letterSpacing: '-0.01em',
                  margin: 0
                }}>
                  How it works
                </h4>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)'
                }} />
              </div>

              {/* Steps List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Step 01 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#0A2315',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(10, 35, 21, 0.15)'
                  }}>
                    01
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.25 }}>
                      Set up
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.40, marginTop: '2px' }}>
                      Organize your items, categories and pricing.
                    </div>
                  </div>
                </div>

                {/* Vertical Connector */}
                <div style={{
                  width: '2px',
                  height: '16px',
                  background: '#E2E8F0',
                  margin: '3px 0 3px 13px'
                }} />

                {/* Step 02 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#0A2315',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(10, 35, 21, 0.15)'
                  }}>
                    02
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.25 }}>
                      Share
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.40, marginTop: '2px' }}>
                      Let customers discover your digital menu.
                    </div>
                  </div>
                </div>

                {/* Vertical Connector */}
                <div style={{
                  width: '2px',
                  height: '16px',
                  background: '#E2E8F0',
                  margin: '3px 0 3px 13px'
                }} />

                {/* Step 03 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#0A2315',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(10, 35, 21, 0.15)'
                  }}>
                    03
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.25 }}>
                      Get orders
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.40, marginTop: '2px' }}>
                      Turn menu visits into easy customer orders.
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Signature */}
              <div style={{
                borderTop: '1px solid #F1F5F9',
                paddingTop: '12px',
                marginTop: '16px'
              }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
                  One smart menu.
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A', lineHeight: 1.3, marginTop: '2px' }}>
                  Endless possibilities.
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              COLUMN 2: DISHES CATALOG (CENTER)
             ======================================================== */}
          <div className="center-catalog-column" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            
            {/* Catalog Controls Header */}
            <div className="catalog-header-bar" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 2px',
              flexWrap: 'wrap',
              gap: '8px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <h3 style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {activeCategoryObj ? `${activeCategoryObj.name}` : `All Dishes`}
                <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600, marginLeft: '6px' }}>
                  ({filteredDishes.length})
                </span>
              </h3>

              <div className="catalog-actions-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {/* View Mode Segmented Switch [ ▦ Grid | ☰ List ] */}
                <div className="view-mode-toggle-group" style={{
                  display: 'inline-flex',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '9px',
                  padding: '2px',
                  gap: '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      borderRadius: '7px',
                      background: viewMode === 'grid' ? '#261B14' : 'transparent',
                      color: viewMode === 'grid' ? '#FFFFFF' : '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      transition: 'all 0.15s ease'
                    }}
                    title="Grid View"
                  >
                    <LayoutGrid size={12} />
                    <span>Grid</span>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      borderRadius: '7px',
                      background: viewMode === 'list' ? '#261B14' : 'transparent',
                      color: viewMode === 'list' ? '#FFFFFF' : '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      transition: 'all 0.15s ease'
                    }}
                    title="List View"
                  >
                    <List size={12} />
                    <span>List</span>
                  </button>
                </div>

                {/* Sort Dropdown Selector */}
                <div className="sort-select-wrapper" style={{ position: 'relative' }}>
                  <select
                    className="catalog-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      height: '28px',
                      padding: '0 22px 0 8px',
                      borderRadius: '9px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      maxWidth: '120px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                    title="Sort Dishes"
                  >
                    <option value="recent">⚡ Default</option>
                    <option value="name_asc">🔤 Name (A-Z)</option>
                    <option value="price_asc">💰 Price (Low)</option>
                    <option value="price_desc">💎 Price (High)</option>
                    <option value="instock_first">🟢 In-Stock First</option>
                  </select>
                  <ChevronDown className="catalog-sort-icon" size={11} color="#64748B" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            {/* 🚀 Floating / Sticky Bulk Actions Toolbar */}
            {selectedDishIds.length > 0 && (
              <div style={{
                position: 'sticky',
                top: '12px',
                zIndex: 800,
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                borderRadius: '12px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(10,35,21,0.3)',
                border: '1.5px solid #D4AF37',
                marginBottom: '14px',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#D4AF37', color: '#0A2315', fontWeight: 900, padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem' }}>
                    {selectedDishIds.length}
                  </span>
                  <strong style={{ fontSize: '0.82rem' }}>Dishes Selected</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleBulkAvailability(true)}
                    style={{ background: '#16A34A', color: '#FFFFFF', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <CheckCircle2 size={12} />
                    <span>In Stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkAvailability(false)}
                    style={{ background: '#DC2626', color: '#FFFFFF', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <AlertCircle size={12} />
                    <span>Sold Out</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#FCA5A5', border: '1px solid rgba(252,165,165,0.4)', padding: '5px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={12} />
                    <span>Delete ({selectedDishIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDishIds([])}
                    style={{ background: 'transparent', color: '#94A3B8', border: 'none', padding: '4px 6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear ✖
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredDishes.length === 0 ? (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid #E2E8F0',
                padding: '44px 20px',
                textAlign: 'center'
              }}>
                <Utensils size={34} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>No dishes found</h3>
                <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '0 0 16px 0' }}>Try clearing filters or add your first dish.</p>
                <button
                  onClick={onOpenAddDish}
                  style={{ padding: '9px 18px', borderRadius: '10px', background: '#0A2315', color: '#FFFFFF', border: 'none', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  + Add Dish
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW (Both Desktop & Mobile 2-col) */
              <div className="center-dish-grid">
                {paginatedDishes.map(dish => {
                  const isAvailable = dish.is_available !== false && dish.available !== false && dish.available !== 0;
                  const isVeg = dish.type === 'veg';
                  const isEgg = dish.type === 'egg';
                  const dishBadge = getDishBadge(dish);
                  const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                  return (
                    <div
                      key={dish.id}
                      className="dish-grid-card"
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: selectedDishIds.includes(dish.id) ? '2px solid #0A2315' : '1px solid #E2E8F0',
                        padding: '10px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box',
                        position: 'relative',
                        opacity: isAvailable ? 1 : 0.72
                      }}
                    >
                      <div>
                        {/* Image Container with unclipped 3-Dot floating overlay & Selection Checkbox */}
                        <div className="dish-grid-img-wrap" style={{
                          position: 'relative',
                          width: '100%',
                          height: '136px',
                          marginBottom: '8px'
                        }}>
                          {/* Clipped Rounded Food Image */}
                          <div style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '12px',
                            background: '#F8FAFC',
                            overflow: 'hidden',
                            border: '1px solid #F1F5F9'
                          }}>
                            <img
                              src={getDishImageUrl(dish.image || dish.image_url)}
                              alt={dish.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/default-dish.webp'; }}
                            />
                          </div>

                          {/* Dietary Stamp + Badge Pill */}
                          <div style={{ position: 'absolute', top: '6px', left: '6px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2, flexWrap: 'wrap', maxWidth: 'calc(100% - 65px)' }}>
                            <span style={{
                              width: '14px',
                              height: '14px',
                              background: '#FFFFFF',
                              border: `1.5px solid ${isVeg ? '#16A34A' : isEgg ? '#D97706' : '#DC2626'}`,
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                              flexShrink: 0
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : isEgg ? '#D97706' : '#DC2626' }} />
                            </span>

                            {dishBadge && (
                              <span style={{
                                background: dishBadge.bg,
                                color: dishBadge.color || '#FFFFFF',
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '5px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap'
                              }}>
                                <span>{dishBadge.icon}</span>
                                <span>{dishBadge.text}</span>
                              </span>
                            )}
                          </div>

                          {/* Selection Checkbox (Top Right before 3-dots) */}
                          <div style={{ position: 'absolute', top: '6px', right: '34px', zIndex: 10 }}>
                            <input
                              type="checkbox"
                              checked={selectedDishIds.includes(dish.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelectDish(dish.id);
                              }}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: 'pointer',
                                accentColor: '#0A2315'
                              }}
                              title="Select dish"
                            />
                          </div>

                          {/* 3-Dot Menu Container */}
                          <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: openDishMenuId === dish.id ? 100 : 10 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDishMenuId(openDishMenuId === dish.id ? null : dish.id);
                              }}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.94)',
                                border: '1px solid rgba(0,0,0,0.06)',
                                color: '#0F172A',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                boxShadow: '0 2px 5px rgba(0,0,0,0.12)'
                              }}
                              title="Actions"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {/* Dropdown Menu with Backdrop */}
                            {openDishMenuId === dish.id && (
                              <>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDishMenuId(null);
                                  }}
                                  style={{
                                    position: 'fixed',
                                    inset: 0,
                                    zIndex: 101,
                                    cursor: 'default'
                                  }}
                                />

                                <div style={{
                                  position: 'absolute',
                                  top: '30px',
                                  right: 0,
                                  background: '#FFFFFF',
                                  borderRadius: '12px',
                                  border: '1px solid #E2E8F0',
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                  padding: '5px',
                                  zIndex: 102,
                                  minWidth: '155px'
                                }}>
                                  <button
                                    onClick={() => { onOpenEditDish(dish); setOpenDishMenuId(null); }}
                                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#0F172A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <Edit3 size={12} color="#0F172A" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setQuickPriceDish(dish);
                                      setQuickPriceVal({ price: dish.price || '', price_half: dish.price_half || '' });
                                      setOpenDishMenuId(null);
                                    }}
                                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#0284C7', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <DollarSign size={12} color="#0284C7" />
                                    <span>Quick Price</span>
                                  </button>
                                  <button
                                    onClick={() => { onToggleAvailability(dish.id, !isAvailable); setOpenDishMenuId(null); }}
                                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: isAvailable ? '#D97706' : '#16A34A', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <CheckCircle2 size={12} color={isAvailable ? '#D97706' : '#16A34A'} />
                                    <span>{isAvailable ? 'Mark Sold Out' : 'Mark In Stock'}</span>
                                  </button>
                                  
                                  <div style={{ height: '1px', background: '#F1F5F9', margin: '3px 0' }} />

                                  {/* Quick Badge Toggles */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleBadge && onToggleBadge(dish, 'Must Try');
                                      setOpenDishMenuId(null);
                                    }}
                                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: (dish.badge || '').toLowerCase().includes('must try') || dish.must_try ? '#EA580C' : '#475569', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <span>🔥</span>
                                    <span>{(dish.badge || '').toLowerCase().includes('must try') || dish.must_try ? 'Remove Must Try' : 'Mark Must Try'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleBadge && onToggleBadge(dish, 'Bestseller');
                                      setOpenDishMenuId(null);
                                    }}
                                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: (dish.badge || '').toLowerCase().includes('bestseller') ? '#D97706' : '#475569', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <span>⭐</span>
                                    <span>{(dish.badge || '').toLowerCase().includes('bestseller') ? 'Remove Bestseller' : 'Mark Bestseller'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleBadge && onToggleBadge(dish, 'Special');
                                      setOpenDishMenuId(null);
                                    }}
                                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: (dish.badge || '').toLowerCase().includes('special') ? '#7C3AED' : '#475569', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <span>✨</span>
                                    <span>{(dish.badge || '').toLowerCase().includes('special') ? 'Remove Special' : 'Mark Special'}</span>
                                  </button>

                                  <div style={{ height: '1px', background: '#F1F5F9', margin: '3px 0' }} />
                                  <button
                                    onClick={() => { setDeleteConfirmDish(dish); setOpenDishMenuId(null); }}
                                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <Trash2 size={12} color="#DC2626" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Dish Name */}
                        <h4 style={{
                          fontSize: '0.80rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: '0 0 2px 0',
                          lineHeight: 1.25,
                          wordBreak: 'break-word',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }} title={dish.name}>
                          {dish.name}
                        </h4>

                        {/* Category */}
                        <span style={{
                          fontSize: '0.64rem',
                          color: '#64748B',
                          display: 'block',
                          marginBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {catObj?.name || dish.category_name || dish.category || 'General'}
                        </span>
                      </div>

                      {/* Footer: Segmented Price + In Stock Pill */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        paddingTop: '4px',
                        borderTop: '1px solid #F1F5F9',
                        flexWrap: 'wrap',
                        gap: '3px'
                      }}>
                        {renderDishPrice(dish, 'card')}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleAvailability && onToggleAvailability(dish.id, !isAvailable);
                          }}
                          style={{
                            background: isAvailable ? '#E6F9EE' : '#FEE2E2',
                            color: isAvailable ? '#15803D' : '#DC2626',
                            border: `1px solid ${isAvailable ? '#C6F6D5' : '#FECACA'}`,
                            padding: '2px 6px',
                            borderRadius: '5px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            userSelect: 'none',
                            flexShrink: 0
                          }}
                        >
                          <span>{isAvailable ? 'In Stock' : 'Sold Out'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW: DESKTOP TABLE & MOBILE LIST CARDS */
              <>
                {/* 1. DESKTOP TABLE VIEW (>768px) */}
                <div className="desktop-table-view" style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  width: '100%',
                  maxWidth: '100%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <table style={{ width: '100%', minWidth: '540px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 800, fontSize: '0.74rem' }}>
                        <th style={{ padding: '12px 10px', width: '36px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isAllVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0A2315' }}
                            title="Select all visible dishes"
                          />
                        </th>
                        <th style={{ padding: '12px 14px' }}>DISH</th>
                        <th style={{ padding: '12px 14px' }}>CATEGORY</th>
                        <th style={{ padding: '12px 14px' }}>PRICE (CLICK TO EDIT)</th>
                        <th style={{ padding: '12px 14px' }}>STATUS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDishes.map((dish, idx) => {
                        const isAvailable = dish.is_available !== false && dish.available !== false && dish.available !== 0;
                        const isVeg = dish.type === 'veg';
                        const isEgg = dish.type === 'egg';
                        const dishBadge = getDishBadge(dish);
                        const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                        return (
                          <tr 
                            key={dish.id} 
                            style={{ 
                              borderBottom: idx === paginatedDishes.length - 1 ? 'none' : '1px solid #F1F5F9',
                              background: selectedDishIds.includes(dish.id) ? '#F0FDF4' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '12px 10px', width: '36px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedDishIds.includes(dish.id)}
                                onChange={() => toggleSelectDish(dish.id)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0A2315' }}
                              />
                            </td>
                            <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img
                                src={getDishImageUrl(dish.image || dish.image_url)}
                                alt={dish.name}
                                style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E2E8F0' }}
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/default-dish.webp'; }}
                              />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    width: '12px',
                                    height: '12px',
                                    background: '#FFFFFF',
                                    border: `1.5px solid ${isVeg ? '#16A34A' : isEgg ? '#D97706' : '#DC2626'}`,
                                    borderRadius: '3px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : isEgg ? '#D97706' : '#DC2626' }} />
                                  </span>
                                  <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{dish.name}</strong>
                                  {dishBadge && (
                                    <span style={{
                                      background: dishBadge.bg,
                                      color: dishBadge.color || '#FFFFFF',
                                      fontSize: '0.58rem',
                                      fontWeight: 800,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}>
                                      <span>{dishBadge.icon}</span>
                                      <span>{dishBadge.text}</span>
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>{dish.description ? (dish.description.length > 35 ? `${dish.description.substring(0, 35)}...` : dish.description) : 'No description'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#475569', fontWeight: 600, fontSize: '0.80rem' }}>
                              {catObj?.name || dish.category_name || dish.category || 'General'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {inlinePriceDishId === dish.id ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0F172A' }}>{curr}</span>
                                  <input
                                    type="number"
                                    autoFocus
                                    value={inlinePriceVal}
                                    onChange={(e) => setInlinePriceVal(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (inlinePriceVal !== '' && Number(inlinePriceVal) >= 0) {
                                          onUpdateQuickPrice && onUpdateQuickPrice(dish.id, Number(inlinePriceVal), dish.price_half);
                                        }
                                        setInlinePriceDishId(null);
                                      } else if (e.key === 'Escape') {
                                        setInlinePriceDishId(null);
                                      }
                                    }}
                                    style={{
                                      width: '72px',
                                      padding: '3px 6px',
                                      borderRadius: '6px',
                                      border: '1.5px solid #0A2315',
                                      fontSize: '0.84rem',
                                      fontWeight: 800,
                                      outline: 'none'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (inlinePriceVal !== '' && Number(inlinePriceVal) >= 0) {
                                        onUpdateQuickPrice && onUpdateQuickPrice(dish.id, Number(inlinePriceVal), dish.price_half);
                                      }
                                      setInlinePriceDishId(null);
                                    }}
                                    style={{ background: '#16A34A', color: '#FFFFFF', border: 'none', borderRadius: '4px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    title="Save Price (Enter)"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setInlinePriceDishId(null)}
                                    style={{ background: '#E2E8F0', color: '#475569', border: 'none', borderRadius: '4px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                    title="Cancel (Esc)"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div 
                                  onClick={() => {
                                    setInlinePriceDishId(dish.id);
                                    setInlinePriceVal(dish.price || '');
                                  }}
                                  title="Click to edit price directly"
                                  style={{
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    transition: 'background 0.15s ease'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.background = '#F1F5F9'}
                                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  {renderDishPrice(dish, 'list')}
                                  <Edit3 size={11} color="#94A3B8" style={{ opacity: 0.6 }} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleAvailability && onToggleAvailability(dish.id, !isAvailable);
                                }}
                                style={{
                                  background: isAvailable ? '#E6F9EE' : '#FEE2E2',
                                  color: isAvailable ? '#15803D' : '#DC2626',
                                  border: `1px solid ${isAvailable ? '#C6F6D5' : '#FECACA'}`,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                {isAvailable ? 'In Stock' : 'Sold Out'}
                              </button>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  onClick={() => onOpenEditDish(dish)}
                                  style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '5px', borderRadius: '6px', cursor: 'pointer', color: '#0F172A' }}
                                  title="Edit"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmDish(dish)}
                                  style={{ background: '#FEE2E2', border: '1px solid #FECACA', padding: '5px', borderRadius: '6px', cursor: 'pointer', color: '#DC2626' }}
                                  title="Delete"
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

                {/* 2. MOBILE-NATIVE LIST VIEW (<=768px) */}
                <div className="mobile-list-view" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}>
                  {paginatedDishes.map((dish) => {
                    const isAvailable = dish.is_available !== false && dish.available !== false && dish.available !== 0;
                    const isVeg = dish.type === 'veg';
                    const isEgg = dish.type === 'egg';
                    const dishBadge = getDishBadge(dish);
                    const catObj = safeCategories.find(c => String(c.id) === String(dish.category_id));

                    return (
                      <div
                        key={dish.id}
                        className="mobile-dish-list-card"
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '14px',
                          border: selectedDishIds.includes(dish.id) ? '2px solid #0A2315' : '1px solid #E2E8F0',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          boxSizing: 'border-box',
                          width: '100%',
                          maxWidth: '100%',
                          minWidth: 0,
                          position: 'relative'
                        }}
                      >
                        {/* LEFT: Checkbox + Dish Image Thumbnail */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={selectedDishIds.includes(dish.id)}
                            onChange={() => toggleSelectDish(dish.id)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0A2315', flexShrink: 0 }}
                            title="Select dish"
                          />

                          <div style={{
                            position: 'relative',
                            width: '56px',
                            height: '56px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid #F1F5F9',
                            background: '#F8FAFC',
                            flexShrink: 0
                          }}>
                            <img
                              src={getDishImageUrl(dish.image || dish.image_url)}
                              alt={dish.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/default-dish.webp'; }}
                            />
                            {/* Dietary dot badge overlay on image */}
                            <span style={{
                              position: 'absolute',
                              top: '3px',
                              left: '3px',
                              width: '12px',
                              height: '12px',
                              background: '#FFFFFF',
                              border: `1.5px solid ${isVeg ? '#16A34A' : isEgg ? '#D97706' : '#DC2626'}`,
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              flexShrink: 0
                            }}>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isVeg ? '#16A34A' : isEgg ? '#D97706' : '#DC2626' }} />
                            </span>
                          </div>
                        </div>

                        {/* CENTER: Name + Category + Badge + Price */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <strong style={{
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              color: '#0F172A',
                              lineHeight: 1.25,
                              wordBreak: 'break-word',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical'
                            }} title={dish.name}>
                              {dish.name}
                            </strong>
                            {dishBadge && (
                              <span style={{
                                background: dishBadge.bg,
                                color: dishBadge.color || '#FFFFFF',
                                fontSize: '0.52rem',
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                {dishBadge.icon} {dishBadge.text}
                              </span>
                            )}
                          </div>

                          <span style={{
                            fontSize: '0.64rem',
                            color: '#64748B',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {catObj?.name || dish.category_name || dish.category || 'General'}
                          </span>

                          <div style={{ marginTop: '2px' }}>
                            {renderDishPrice(dish, 'list')}
                          </div>
                        </div>

                        {/* RIGHT: Actions (Edit, Delete) + Availability */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => onOpenEditDish(dish)}
                              style={{
                                background: '#F1F5F9',
                                border: '1px solid #E2E8F0',
                                width: '28px',
                                height: '28px',
                                borderRadius: '7px',
                                cursor: 'pointer',
                                color: '#0F172A',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0
                              }}
                              title="Edit Dish"
                            >
                              <Edit3 size={13} />
                            </button>

                            <button
                              onClick={() => setDeleteConfirmDish(dish)}
                              style={{
                                background: '#FEE2E2',
                                border: '1px solid #FECACA',
                                width: '28px',
                                height: '28px',
                                borderRadius: '7px',
                                cursor: 'pointer',
                                color: '#DC2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0
                              }}
                              title="Delete Dish"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleAvailability && onToggleAvailability(dish.id, !isAvailable);
                            }}
                            style={{
                              background: isAvailable ? '#E6F9EE' : '#FEE2E2',
                              color: isAvailable ? '#15803D' : '#DC2626',
                              border: `1px solid ${isAvailable ? '#C6F6D5' : '#FECACA'}`,
                              padding: '2px 6px',
                              borderRadius: '5px',
                              fontSize: '0.60rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              whiteSpace: 'nowrap',
                              userSelect: 'none'
                            }}
                          >
                            <span>{isAvailable ? '✓ In Stock' : '○ Sold Out'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* RIGHT COLUMN: QUICK ACTIONS + MENU HEALTH + PRO TIP WIDGETS */}
          <div className="right-widgets-column" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Widget 1: Quick Actions */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.15rem' }}>🧑‍🍳</span>
                <strong style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A' }}>Quick Actions</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {[
                  { label: '+ Add Dish', icon: Plus, color: '#16A34A', onClick: onOpenAddDish },
                  { label: 'Bulk Upload', icon: UploadCloud, color: '#0284C7', onClick: () => setShowBulkUploadModal(true) },
                  { label: 'Manage Categories', icon: FolderPlus, color: '#D97706', onClick: onOpenAddCategory },
                  { label: 'Create Combo', icon: Package, color: '#9333EA', onClick: onOpenAddCombo },
                  { 
                    label: 'View Menu', 
                    icon: Eye, 
                    color: '#475569', 
                    onClick: () => {
                      if (typeof onReturnToMenu === 'function') {
                        onReturnToMenu(restaurantInfo?.slug);
                      }
                    } 
                  }
                ].map((act, idx) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={idx}
                      onClick={act.onClick}
                      className="widget-action-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'transparent',
                        color: '#0F172A',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size={14} color={act.color} strokeWidth={2.5} />
                        <span>{act.label}</span>
                      </div>
                      <ChevronRight size={13} color="#94A3B8" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Widget 2: Menu Health */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.15rem' }}>🛡️</span>
                <div>
                  <strong style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', display: 'block' }}>Menu Health</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748B' }}>{menuHealth.statusText}</span>
                </div>
              </div>

              {/* Circular Ring Progress */}
              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <div style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  border: '6px solid #DCFCE7',
                  borderTopColor: menuHealth.score >= 75 ? '#16A34A' : '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  color: '#0F172A'
                }}>
                  {menuHealth.score}%
                </div>
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Dishes added', done: menuHealth.dishesAdded },
                  { label: 'Images uploaded', done: menuHealth.imagesUploaded },
                  { label: 'Categories organized', done: menuHealth.categoriesOrganized },
                  { label: 'Ready for customers', done: menuHealth.readyForCustomers }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: item.done ? '#0F172A' : '#64748B', fontWeight: 600 }}>
                    <span style={{ color: item.done ? '#16A34A' : '#94A3B8', fontSize: '0.76rem', fontWeight: 900 }}>
                      {item.done ? '✓' : '○'}
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 3: Pro Tip */}
            <div style={{
              background: '#FFFDF0',
              borderRadius: '18px',
              border: '1px solid #FEF3C7',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💡</span>
                <strong style={{ fontSize: '0.80rem', color: '#92400E', fontWeight: 800 }}>Pro Tip</strong>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#78350F', margin: 0, lineHeight: 1.35 }}>
                High-quality food images can make your digital menu more appealing.
              </p>
              <button
                type="button"
                onClick={() => setShowImageTipModal(true)}
                style={{
                  fontSize: '0.70rem',
                  color: '#92400E',
                  fontWeight: 800,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginTop: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Learn more</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'categories' ? (
        /* ========================================================
            CATEGORIES MANAGEMENT WORKSPACE (WHEN activeSubTab === 'categories')
           ======================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '14px 18px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>📁</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  All Categories ({safeCategories.length})
                </h3>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                Create, reorder and organize menu sections for your customers
              </span>
            </div>
            <button
              onClick={onOpenAddCategory}
              disabled={catQuota.isAtLimit}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                background: catQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                border: 'none',
                cursor: catQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FolderPlus size={15} color="#38BDF8" />
              <span>+ Add Category</span>
            </button>
          </div>

          {/* Categories Grid */}
          <div className="category-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            <style dangerouslySetInnerHTML={{__html: `
              @media (max-width: 640px) {
                .category-grid-responsive {
                  grid-template-columns: 1fr !important;
                  gap: 10px !important;
                }
                .hidden-xs {
                  display: none !important;
                }
              }
            `}} />
            {filteredCategories.map((cat, idx) => {
              const dishCount = safeDishes.filter(d => 
                String(d.category_id) === String(cat.id) ||
                (d.category_name && d.category_name.toLowerCase() === (cat.name || '').toLowerCase()) ||
                (d.category && d.category.toLowerCase() === (cat.name || '').toLowerCase())
              ).length;
              const emoji = getCategoryEmoji(cat.name);
              const isActive = cat.active !== false && cat.is_active !== false && cat.active !== 0 && cat.active !== 'false';

              return (
                <div
                  key={cat.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Row 1: Details (Left) & Active Switch (Right) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <img
                          src={getCategoryImageUrl(cat.image)}
                          alt={cat.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/images/default-category.webp';
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.name}
                        </h4>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
                          {dishCount} {dishCount === 1 ? 'dish' : 'dishes'}
                        </span>
                      </div>
                    </div>

                    {/* Status iOS Toggle switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <div
                        onClick={(e) => { e.stopPropagation(); onToggleCategoryActive && onToggleCategoryActive(cat.id, !isActive); }}
                        style={{
                          width: '34px',
                          height: '18px',
                          borderRadius: '9px',
                          background: isActive ? '#10B981' : '#CBD5E1',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0 2px'
                        }}
                        title={isActive ? 'Deactivate Category' : 'Activate Category'}
                      >
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          position: 'absolute',
                          left: isActive ? '18px' : '2px',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.18)'
                        }} />
                      </div>
                      <span className="hidden-xs" style={{ fontSize: '0.68rem', fontWeight: 800, color: isActive ? '#10B981' : '#64748B' }}>
                        {isActive ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Reorder Controls (Left) & Actions (Right) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '10px', width: '100%' }}>
                    {/* Reordering Up/Down controls */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); handleMoveCategory(idx, 'up'); }}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: idx === 0 ? '#F1F5F9' : '#FFFFFF',
                          color: idx === 0 ? '#94A3B8' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s'
                        }}
                        title="Move Up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === safeCategories.length - 1}
                        onClick={(e) => { e.stopPropagation(); handleMoveCategory(idx, 'down'); }}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          background: idx === safeCategories.length - 1 ? '#F1F5F9' : '#FFFFFF',
                          color: idx === safeCategories.length - 1 ? '#94A3B8' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: idx === safeCategories.length - 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s'
                        }}
                        title="Move Down"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>

                    {/* Actions (View Dishes, Edit, Delete) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => { setSelectedCatFilter(cat.id); setActiveSubTab('dishes'); }}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => onOpenEditCategory && onOpenEditCategory(cat)}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0284C7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmCategory(cat)}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeSubTab === 'combos' ? (
        /* ========================================================
            UPGRADED VALUE MEAL COMBOS WORKSPACE
           ======================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Combos Workspace Header Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #FAF5FF 0%, #FFFFFF 100%)',
            borderRadius: '18px',
            border: '1.5px solid #F3E8FF',
            padding: '16px 20px',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 6px rgba(147, 51, 234, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#F3E8FF',
                color: '#9333EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0
              }}>
                🍱
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                    Value Meal Combos
                  </h3>
                  <span style={{
                    background: '#9333EA',
                    color: '#FFFFFF',
                    fontSize: '0.64rem',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {safeCombos.length} Active
                  </span>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                  Multi-dish bundles to boost Average Order Value & customer savings.
                </span>
              </div>
            </div>

            <button
              onClick={onOpenAddCombo}
              disabled={comboQuota.isAtLimit}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                background: comboQuota.isAtLimit ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: comboQuota.isAtLimit ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 3px 10px rgba(10,35,21,0.2)'
              }}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <span>+ Add Combo</span>
            </button>
          </div>

          {/* Combos Empty State */}
          {filteredCombos.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E2E8F0',
              padding: '48px 20px',
              textAlign: 'center'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#FAF5FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 12px auto' }}>
                🍱
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>No combo meals created yet</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 18px 0', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                Bundle popular dishes together with special pricing to increase average ticket size.
              </p>
              <button
                onClick={onOpenAddCombo}
                style={{ padding: '10px 20px', borderRadius: '10px', background: '#0A2315', color: '#FFFFFF', border: 'none', fontSize: '0.80rem', fontWeight: 800, cursor: 'pointer' }}
              >
                + Create First Combo
              </button>
            </div>
          ) : (
            /* Combos Grid */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {filteredCombos.map(combo => {
                let parsedItems = [];
                try {
                  parsedItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (Array.isArray(combo.items) ? combo.items : []);
                } catch {
                  parsedItems = [];
                }
                const originalTotal = parsedItems.reduce((sum, item) => sum + (Number(item.original_price || item.price || 0) * Number(item.qty || 1)), 0);
                const comboPrice = Number(combo.price) || 0;
                const hasSavings = originalTotal > comboPrice;
                const savingsAmount = hasSavings ? originalTotal - comboPrice : 0;
                const isAvailable = combo.available !== 0 && combo.available !== false && combo.is_available !== false;
                const comboImg = combo.image || combo.image_url;

                return (
                  <div
                    key={combo.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '18px',
                      border: '1px solid #E2E8F0',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      transition: 'all 0.16s ease',
                      opacity: isAvailable ? 1 : 0.75
                    }}
                  >
                    {/* Top: Image / Banner & Badges */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: '140px',
                      background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
                      overflow: 'hidden'
                    }}>
                      <img
                        src={getComboImageUrl(comboImg)}
                        alt={combo.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/images/default-combo.webp?v=3';
                        }}
                      />

                      {/* Top Badges */}
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        right: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        zIndex: 2
                      }}>
                        {combo.badge ? (
                          <span style={{
                            background: '#9333EA',
                            color: '#FFFFFF',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '2.5px 8px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 6px rgba(147, 51, 234, 0.35)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em'
                          }}>
                            ⭐ {combo.badge}
                          </span>
                        ) : hasSavings ? (
                          <span style={{
                            background: '#16A34A',
                            color: '#FFFFFF',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '2.5px 8px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.35)'
                          }}>
                            ⚡ VALUE PACK
                          </span>
                        ) : <span />}

                        <span style={{
                          background: isAvailable ? 'rgba(220, 252, 231, 0.95)' : 'rgba(254, 226, 226, 0.95)',
                          color: isAvailable ? '#15803D' : '#DC2626',
                          border: `1px solid ${isAvailable ? '#BBF7D0' : '#FECACA'}`,
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          backdropFilter: 'blur(4px)'
                        }}>
                          {isAvailable ? 'In Stock' : 'Sold Out'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Title, Description & Included Items Chips */}
                    <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <h4 style={{
                          fontSize: '1rem',
                          fontWeight: 900,
                          color: '#0F172A',
                          margin: '0 0 4px 0',
                          lineHeight: 1.25
                        }}>
                          {combo.name}
                        </h4>
                        {combo.description && (
                          <p style={{
                            fontSize: '0.74rem',
                            color: '#64748B',
                            margin: 0,
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {combo.description}
                          </p>
                        )}
                      </div>

                      {/* Included Items Container */}
                      {parsedItems.length > 0 && (
                        <div style={{
                          background: '#F8FAFC',
                          border: '1px solid #F1F5F9',
                          borderRadius: '12px',
                          padding: '8px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Includes {parsedItems.length} {parsedItems.length === 1 ? 'Item' : 'Items'}:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {parsedItems.map((item, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.68rem',
                                  color: '#334155',
                                  background: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '6px',
                                  padding: '2px 6px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <span style={{ color: '#9333EA', fontWeight: 800 }}>{item.qty || 1}x</span>
                                <span>{item.dish_name || item.name || 'Dish'}</span>
                                {item.portion && item.portion !== 'full' && (
                                  <span style={{ fontSize: '0.60rem', color: '#64748B' }}>({item.portion})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pricing Row */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                        <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>
                          {curr}{formatPriceNumber(comboPrice)}
                        </strong>
                        {hasSavings && (
                          <>
                            <span style={{ fontSize: '0.80rem', color: '#94A3B8', textDecoration: 'line-through', fontWeight: 600 }}>
                              {curr}{formatPriceNumber(originalTotal)}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              color: '#15803D',
                              background: '#DCFCE7',
                              border: '1px solid #BBF7D0',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '6px'
                            }}>
                              Save {curr}{formatPriceNumber(savingsAmount)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Footer: Quick Stock Toggle + Edit & Delete Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderTop: '1px solid #F1F5F9',
                      background: '#FAFAFA'
                    }}>
                      <button
                        onClick={() => onToggleComboAvailability && onToggleComboAvailability(combo.id, !isAvailable)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '7px',
                          border: `1px solid ${isAvailable ? '#C6F6D5' : '#FECACA'}`,
                          background: isAvailable ? '#E6F9EE' : '#FEE2E2',
                          color: isAvailable ? '#15803D' : '#DC2626',
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isAvailable ? '#15803D' : '#DC2626' }} />
                        <span>{isAvailable ? 'In Stock' : 'Sold Out'}</span>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onOpenEditCombo(combo)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#0F172A',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}
                        >
                          <Edit3 size={12} color="#0F172A" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmCombo(combo)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: '1px solid #FEE2E2',
                            background: '#FFF5F5',
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Delete Combo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ========================================================
          6. BOTTOM PAGINATION ROW (MATCHING REFERENCE EXACTLY)
         ======================================================== */}
      {filteredDishes.length > 0 && activeSubTab === 'dishes' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 2px 0 2px',
          flexWrap: 'wrap',
          gap: '8px',
          borderTop: '1px solid #E2E8F0',
          marginTop: '6px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Left: Showing count */}
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
            Showing{' '}
            <strong style={{ color: '#0F172A' }}>
              {isAllPages ? 1 : Math.min(totalItems, (safeCurrentPage - 1) * effectivePageSize + 1)}
            </strong>
            –
            <strong style={{ color: '#0F172A' }}>
              {isAllPages ? totalItems : Math.min(totalItems, safeCurrentPage * effectivePageSize)}
            </strong>
            {' '}of <strong style={{ color: '#0F172A' }}>{totalItems}</strong>
          </span>

          {/* Center: Pagination numbers with dark brown active circle */}
          {!isAllPages && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: safeCurrentPage === 1 ? '#CBD5E1' : '#0F172A',
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronLeft size={13} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                .map((p, idx, arr) => {
                  const isPrevGap = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {isPrevGap && <span style={{ padding: '0 2px', color: '#94A3B8', fontSize: '0.70rem' }}>⋯</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: 'none',
                          background: p === safeCurrentPage ? '#261B14' : 'transparent',
                          color: p === safeCurrentPage ? '#FFFFFF' : '#0F172A',
                          fontSize: '0.72rem',
                          fontWeight: p === safeCurrentPage ? 900 : 600,
                          cursor: 'pointer'
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: safeCurrentPage === totalPages ? '#CBD5E1' : '#0F172A',
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* Right: Items per page selector */}
          <div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.70rem',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                height: '28px'
              }}
            >
              <option value={12}>12 / page</option>
              <option value={24}>24 / page</option>
              <option value={48}>48 / page</option>
              <option value="all">All ({filteredDishes.length})</option>
            </select>
          </div>
        </div>
      )}

      {/* ========================================================
          7. FLOATING + ADD ACTION BUTTON (MOBILE ONLY)
         ======================================================== */}
      <button
        className="mobile-floating-add-btn"
        onClick={activeSubTab === 'combos' ? onOpenAddCombo : activeSubTab === 'categories' ? onOpenAddCategory : onOpenAddDish}
        disabled={dishQuota.isAtLimit}
        style={{
          position: 'fixed',
          bottom: '76px',
          right: '14px',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: dishQuota.isAtLimit ? '#64748B' : 'linear-gradient(135deg, #0A2315 0%, #062B1C 100%)',
          color: '#FFFFFF',
          border: '1.5px solid #D4AF37',
          boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 89,
          cursor: dishQuota.isAtLimit ? 'not-allowed' : 'pointer'
        }}
        title={activeSubTab === 'combos' ? 'Add Combo' : activeSubTab === 'categories' ? 'Add Category' : 'Add Dish'}
      >
        <Plus size={22} color="#D4AF37" strokeWidth={3} />
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
                  Full Price ({curr})
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
                  Half Price ({curr}) Optional
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

      {/* ========================================================
          10. 🎛️ FILTER & SORT OPTIONS MODAL
         ======================================================== */}
      {showFilterModal && (
        <div
          onClick={() => setShowFilterModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderBottom: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#FFFBEB',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                    Filter & Sort Options
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'block' }}>
                    Custom catalog search & preferences
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* 1. Dietary Preference */}
              <div>
                <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  🥗 Dietary Preference
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: `All Items (${counts.all})`, icon: '🍽️' },
                    { id: 'veg', label: `Pure Veg (${counts.veg})`, icon: '🟢' },
                    { id: 'nonveg', label: `Non-Veg (${counts.nonveg})`, icon: '🔴' },
                    { id: 'egg', label: `Contains Egg (${counts.egg})`, icon: '🟡' }
                  ].map(opt => {
                    const isSel = (dietFilter === opt.id) || (opt.id === 'all' && ['all', 'available', 'sold_out', 'must_try', 'special'].includes(dietFilter));
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDietFilter(opt.id)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '12px',
                          border: isSel ? '1.5px solid #261B14' : '1px solid #E2E8F0',
                          background: isSel ? '#F8FAFC' : '#FFFFFF',
                          color: '#0F172A',
                          fontWeight: isSel ? 800 : 600,
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                        {isSel && <Check size={14} color="#16A34A" style={{ marginLeft: 'auto' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Stock & Availability Status */}
              <div>
                <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  📦 Inventory & Stock Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Items' },
                    { id: 'available', label: `In Stock (${counts.available}) 🟢` },
                    { id: 'sold_out', label: `Sold Out (${counts.sold_out}) 🔴` }
                  ].map(opt => {
                    const isSel = dietFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDietFilter(opt.id)}
                        style={{
                          padding: '9px 6px',
                          borderRadius: '12px',
                          border: isSel ? '1.5px solid #261B14' : '1px solid #E2E8F0',
                          background: isSel ? '#F8FAFC' : '#FFFFFF',
                          color: '#0F172A',
                          fontWeight: isSel ? 800 : 600,
                          fontSize: '0.74rem',
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Badges & Highlights */}
              <div>
                <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  ⭐ Highlights & Badges
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'must_try', label: `Must Try (${counts.must_try})`, icon: '🔥' },
                    { id: 'bestseller', label: `Bestseller (${counts.bestseller})`, icon: '⭐' },
                    { id: 'special', label: `Special (${counts.special})`, icon: '✨' }
                  ].map(opt => {
                    const isSel = dietFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDietFilter(isSel ? 'all' : opt.id)}
                        style={{
                          padding: '9px 6px',
                          borderRadius: '12px',
                          border: isSel ? '1.5px solid #D97706' : '1px solid #E2E8F0',
                          background: isSel ? '#FFFBEB' : '#FFFFFF',
                          color: isSel ? '#B45309' : '#0F172A',
                          fontWeight: isSel ? 800 : 600,
                          fontSize: '0.73rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Price Filter */}
              <div>
                <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  💰 Price Range
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'all', label: 'All Prices' },
                    { id: 'under_100', label: `< ${curr}100` },
                    { id: '100_250', label: `${curr}100 - ${curr}250` },
                    { id: 'above_250', label: `> ${curr}250` }
                  ].map(opt => {
                    const isSel = priceFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPriceFilter(opt.id)}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '10px',
                          border: isSel ? '1.5px solid #0284C7' : '1px solid #E2E8F0',
                          background: isSel ? '#F0F9FF' : '#FFFFFF',
                          color: isSel ? '#0369A1' : '#0F172A',
                          fontWeight: isSel ? 800 : 600,
                          fontSize: '0.72rem',
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Sort Order */}
              <div>
                <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  ⚡ Sort Order
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'recent', label: 'Default / Recent' },
                    { id: 'name_asc', label: 'Name (A to Z)' },
                    { id: 'price_asc', label: 'Price (Low to High)' },
                    { id: 'price_desc', label: 'Price (High to Low)' },
                    { id: 'instock_first', label: 'In Stock First 🟢' }
                  ].map(opt => {
                    const isSel = sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSortBy(opt.id)}
                        style={{
                          padding: '9px 10px',
                          borderRadius: '10px',
                          border: isSel ? '1.5px solid #261B14' : '1px solid #E2E8F0',
                          background: isSel ? '#F8FAFC' : '#FFFFFF',
                          color: '#0F172A',
                          fontWeight: isSel ? 800 : 600,
                          fontSize: '0.74rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <span>{opt.label}</span>
                        {isSel && <Check size={12} color="#16A34A" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              background: '#F8FAFC',
              borderBottomLeftRadius: '24px',
              borderBottomRightRadius: '24px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setDietFilter('all');
                  setPriceFilter('all');
                  setSortBy('recent');
                  setSelectedCatFilter('all');
                  setSearch('');
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Reset All
              </button>

              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#0A2315',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(10,35,21,0.2)'
                }}
              >
                Apply Filters ({filteredDishes.length} Items)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 BULK CSV DISH UPLOAD MODAL */}
      {showBulkUploadModal && (
        <BulkDishUploadModal
          token={token}
          categories={safeCategories}
          existingDishCount={safeDishes.length}
          maxDishes={maxDishes}
          currencySymbol={curr}
          onSuccess={() => {
            if (onRefreshData) onRefreshData();
            setShowBulkUploadModal(false);
          }}
          onClose={() => setShowBulkUploadModal(false)}
        />
      )}

      {/* 💡 WHY QUALITY IMAGES MATTER MODAL */}
      {showImageTipModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3500,
            background: 'rgba(10, 25, 16, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowImageTipModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '440px',
              padding: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>📸</span>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0F172A' }}>
                  Why quality images matter
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowImageTipModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.80rem', color: '#475569', lineHeight: 1.45 }}>
              High-quality food images can make your digital menu more appealing and help customers make decisions faster.
            </p>

            <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #E2E8F0' }}>
              <strong style={{ fontSize: '0.76rem', color: '#0F172A', fontWeight: 800 }}>Quick Photography Tips:</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontWeight: 900 }}>✓</span>
                <span>Use clear, natural lighting for vibrant dishes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontWeight: 900 }}>✓</span>
                <span>Use square (1:1) aspect ratio photos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#334155' }}>
                <span style={{ color: '#16A34A', fontWeight: 900 }}>✓</span>
                <span>Keep backgrounds clean and clutter-free</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowImageTipModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                background: '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================================
// REUSABLE BULK DISH CSV UPLOAD MODAL COMPONENT
// ========================================================
function BulkDishUploadModal({
  token,
  categories = [],
  existingDishCount = 0,
  maxDishes = 9999,
  currencySymbol = '₹',
  onSuccess,
  onClose
}) {
  const [csvFile, setCsvFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsingError, setParsingError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // Step 1: Download RFC 4180 CSV Template
  const handleDownloadTemplate = () => {
    const defaultCat = categories[0]?.name || 'Main Course';
    const headers = ['Dish Name', 'Category', 'Price', 'Half Price', 'Dietary Type (veg/nonveg/egg)', 'Description', 'Badge (Must Try/Bestseller/Special)', 'Ingredients', 'Portion'];
    const sampleRows = [
      ['Paneer Butter Masala', defaultCat, '240', '140', 'veg', 'Cottage cheese cubes simmered in rich creamy tomato gravy', 'Must Try', 'Paneer, Butter, Cream, Spices', 'Full'],
      ['Crispy Veg Burger', defaultCat, '120', '', 'veg', 'Crunchy vegetable patty with house sauce and fresh lettuce', 'Bestseller', 'Bun, Veg Patty, Lettuce, Sauce', 'Single'],
      ['Chicken Biryani', defaultCat, '280', '170', 'nonveg', 'Aromatic basmati rice cooked with tender spiced chicken pieces', 'Special', 'Basmati Rice, Chicken, Saffron, Spices', 'Full']
    ];
    const csvContent = '\uFEFF' + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...sampleRows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TouchQR_Menu_Bulk_Import_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust RFC 4180 CSV Line Parser
  const parseCSVLine = (text) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuote && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Parse uploaded file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setParsingError('');
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result || '';
        const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setParsingError('CSV file is empty or missing data rows.');
          setParsedRows([]);
          return;
        }

        // Header mapping
        const headerCols = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const nameIdx = headerCols.findIndex(h => h.includes('name') || h.includes('dish'));
        const catIdx = headerCols.findIndex(h => h.includes('cat'));
        const priceIdx = headerCols.findIndex(h => h.includes('price') && !h.includes('half'));
        const halfPriceIdx = headerCols.findIndex(h => h.includes('half'));
        const typeIdx = headerCols.findIndex(h => h.includes('type') || h.includes('diet'));
        const descIdx = headerCols.findIndex(h => h.includes('desc'));
        const badgeIdx = headerCols.findIndex(h => h.includes('badge') || h.includes('tag'));
        const ingIdx = headerCols.findIndex(h => h.includes('ingred'));
        const portionIdx = headerCols.findIndex(h => h.includes('portion'));

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

          const rawName = nameIdx !== -1 ? cols[nameIdx] : cols[0];
          const rawCat = catIdx !== -1 ? cols[catIdx] : (cols[1] || '');
          const rawPrice = priceIdx !== -1 ? cols[priceIdx] : cols[2];
          const rawHalf = halfPriceIdx !== -1 ? cols[halfPriceIdx] : '';
          const rawType = typeIdx !== -1 ? cols[typeIdx] : '';
          const rawDesc = descIdx !== -1 ? cols[descIdx] : '';
          const rawBadge = badgeIdx !== -1 ? cols[badgeIdx] : '';
          const rawIng = ingIdx !== -1 ? cols[ingIdx] : '';
          const rawPortion = portionIdx !== -1 ? cols[portionIdx] : '';

          if (!rawName || !rawPrice) continue;

          // Find category ID
          let matchedCat = categories.find(c => (c.name || '').toLowerCase() === rawCat.toLowerCase().trim());
          if (!matchedCat && categories.length > 0) {
            matchedCat = categories[0];
          }

          const parsedPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
          const parsedHalf = rawHalf ? parseFloat(rawHalf.replace(/[^0-9.]/g, '')) : null;
          let normType = (rawType || '').toLowerCase().trim();
          if (!['veg', 'nonveg', 'egg'].includes(normType)) {
            normType = normType.includes('non') ? 'nonveg' : (normType.includes('egg') ? 'egg' : 'veg');
          }

          if (!isNaN(parsedPrice) && parsedPrice >= 0 && matchedCat) {
            rows.push({
              name: rawName.trim(),
              category_id: matchedCat.id,
              category_name: matchedCat.name,
              price: parsedPrice,
              price_half: !isNaN(parsedHalf) && parsedHalf > 0 ? parsedHalf : null,
              type: normType,
              description: rawDesc.trim(),
              badge: rawBadge.trim(),
              ingredients: rawIng.trim(),
              portion: rawPortion.trim(),
              available: true
            });
          }
        }

        if (rows.length === 0) {
          setParsingError('No valid dishes could be extracted from this CSV. Please verify required columns (Dish Name, Category, Price).');
        } else if (existingDishCount + rows.length > maxDishes) {
          setParsingError(`Importing ${rows.length} dishes exceeds your current plan quota (${maxDishes} max dishes). Please reduce file size or upgrade plan.`);
        }
        setParsedRows(rows);
      } catch (err) {
        setParsingError('Error reading CSV: ' + err.message);
        setParsedRows([]);
      }
    };
    reader.readAsText(file);
  };

  // Run Bulk Import
  const handleStartImport = async () => {
    if (parsedRows.length === 0 || !token) return;
    setImporting(true);
    setProgress({ current: 0, total: parsedRows.length });
    let successCount = 0;
    let errorCount = 0;
    const errMessages = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const item = parsedRows[i];
      try {
        await createDish({
          category_id: item.category_id,
          name: item.name,
          price: item.price,
          price_half: item.price_half,
          type: item.type,
          description: item.description,
          badge: item.badge,
          ingredients: item.ingredients,
          portion: item.portion,
          available: true
        }, token);
        successCount++;
      } catch (err) {
        errorCount++;
        errMessages.push(`${item.name}: ${err.message || 'Failed'}`);
      }
      setProgress({ current: i + 1, total: parsedRows.length });
    }

    setImporting(false);
    setImportResults({ successCount, errorCount, errors: errMessages });
    if (successCount > 0) {
      setTimeout(() => {
        onSuccess && onSuccess();
      }, 1200);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3500,
      background: 'rgba(10, 25, 16, 0.70)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
      boxSizing: 'border-box'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAFBFD'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#E0F2FE',
              color: '#0284C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>Bulk Dish CSV Import</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748B' }}>
                Upload multiple dishes into your menu catalog at once
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Step 1: Download Template */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block', fontWeight: 800 }}>
                1. Download Sample CSV Template
              </strong>
              <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                Use our pre-formatted spreadsheet template with valid column headers
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Download size={13} color="#0284C7" />
              <span>Template.csv</span>
            </button>
          </div>

          {/* Step 2: Upload CSV File Area */}
          <div>
            <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block', fontWeight: 800, marginBottom: '6px' }}>
              2. Select or Drag & Drop CSV File
            </strong>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #CBD5E1',
                borderRadius: '14px',
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: csvFile ? '#F0FDF4' : '#FAFAFA',
                borderColor: csvFile ? '#86EFAC' : '#CBD5E1',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <FileText size={28} color={csvFile ? '#16A34A' : '#94A3B8'} />
                {csvFile ? (
                  <div>
                    <strong style={{ fontSize: '0.84rem', color: '#15803D', display: 'block' }}>{csvFile.name}</strong>
                    <span style={{ fontSize: '0.70rem', color: '#4ADE80' }}>Click to choose a different file</span>
                  </div>
                ) : (
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block' }}>Click to browse or drop CSV file</strong>
                    <span style={{ fontSize: '0.70rem', color: '#94A3B8' }}>Supports .csv files up to 5MB</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parsing Errors Banner */}
          {parsingError && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#B91C1C',
              fontSize: '0.74rem'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{parsingError}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && !importResults && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{
                padding: '8px 12px',
                background: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A' }}>
                  Preview: {parsedRows.length} Valid Dishes Detected
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                  Showing first {Math.min(parsedRows.length, 4)} rows
                </span>
              </div>
              <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr style={{ background: '#FAFBFD', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #F1F5F9' }}>
                      <th style={{ padding: '6px 10px' }}>Dish Name</th>
                      <th style={{ padding: '6px 10px' }}>Category</th>
                      <th style={{ padding: '6px 10px' }}>Price</th>
                      <th style={{ padding: '6px 10px' }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 4).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F8FAFC' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0F172A' }}>{row.name}</td>
                        <td style={{ padding: '6px 10px', color: '#64748B' }}>{row.category_name}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 800, color: '#0F172A' }}>{currencySymbol}{row.price}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            background: row.type === 'veg' ? '#DCFCE7' : (row.type === 'egg' ? '#FEF3C7' : '#FEE2E2'),
                            color: row.type === 'veg' ? '#15803D' : (row.type === 'egg' ? '#B45309' : '#DC2626')
                          }}>
                            {row.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {importing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#0F172A', fontWeight: 700 }}>
                <span>Importing dishes to catalog...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  transition: 'width 0.2s ease'
                }} />
              </div>
            </div>
          )}

          {/* Completion Status */}
          {importResults && (
            <div style={{
              background: importResults.successCount > 0 ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${importResults.successCount > 0 ? '#BBF7D0' : '#FECACA'}`,
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <CheckCircle2 size={20} color={importResults.successCount > 0 ? '#16A34A' : '#DC2626'} />
              <div>
                <strong style={{ fontSize: '0.84rem', color: importResults.successCount > 0 ? '#15803D' : '#991B1B', display: 'block' }}>
                  {importResults.successCount > 0 ? `Successfully imported ${importResults.successCount} dishes!` : 'Import failed'}
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  {importResults.errorCount > 0 ? `${importResults.errorCount} dishes had errors and were skipped.` : 'Your menu and public catalog have been refreshed.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          background: '#FAFBFD'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {importResults ? 'Close' : 'Cancel'}
          </button>
          {!importResults && (
            <button
              type="button"
              onClick={handleStartImport}
              disabled={importing || parsedRows.length === 0}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                background: (importing || parsedRows.length === 0) ? '#94A3B8' : '#0A2315',
                color: '#FFFFFF',
                fontSize: '0.80rem',
                fontWeight: 800,
                cursor: (importing || parsedRows.length === 0) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: (importing || parsedRows.length === 0) ? 'none' : '0 3px 10px rgba(10,35,21,0.2)'
              }}
            >
              <Upload size={13} />
              <span>{importing ? 'Importing...' : `Import ${parsedRows.length} Dishes`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
