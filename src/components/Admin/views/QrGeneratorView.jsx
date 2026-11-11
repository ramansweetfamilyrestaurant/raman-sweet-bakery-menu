import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  QrCode, 
  Printer, 
  Check, 
  ShieldCheck, 
  Film, 
  AlertTriangle,
  Search,
  Download,
  Eye,
  Sparkles,
  RefreshCw,
  Palette,
  CheckCircle2,
  ChevronRight,
  Settings,
  HelpCircle,
  Trash2,
  Plus,
  X
} from 'lucide-react';
import { normalizeSpaceType, normalizeSpaceNumber, isValidHmacTokenFormat } from '../../../utils/qrSecurity';
import { fetchCinemaScreens, fetchCinemaSeats, generateQrTokensApi } from '../../../api/client';
import { 
  STANDEE_THEMES, 
  STANDEE_FRAMES, 
  generateStandeePrintDocument, 
  renderStandeeToCanvas 
} from '../../../utils/standeeTemplates';
import QRCode from 'qrcode';
import { resolveBusinessProfile } from '../../../utils/businessTaxonomy';

export default function QrGeneratorView({
  tableNumber,
  setTableNumber,
  totalTablesCount,
  onAddTable,
  onDeleteTable,
  onPrintQR,
  settingsForm,
  token,
  restaurantInfo,
  capabilities,
  onBackToSetup,
  onToggleSpaceActive,
  orders
}) {
  // Tenant Identity
  const activeSlug = settingsForm?.slug || restaurantInfo?.slug || '';
  const restaurantId = settingsForm?.id || restaurantInfo?.id || '';
  const currentName = settingsForm?.name || restaurantInfo?.name || 'Digital Menu';
  const liveOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Business Vertical & Cinema Detection
  const profile = resolveBusinessProfile(settingsForm || restaurantInfo || {});
  const rawBiz = String(settingsForm?.business_type || restaurantInfo?.business_type || '').trim().toLowerCase();
  const rawService = String(settingsForm?.service_model || restaurantInfo?.service_model || '').trim().toLowerCase();
  const effectiveBiz = String(profile?.business_type || 'restaurant').trim().toLowerCase();
  const effectiveService = String(profile?.service_model || 'dine_in').trim().toLowerCase();
  const isCinema = effectiveBiz === 'cinema_theatre' || effectiveService === 'cinema';
  const isHotel = effectiveBiz === 'hotel_resort' || effectiveService === 'hotel';

  // Appearance & Customization State (Smart defaults per business vertical)
  const defaultTheme = isCinema ? 'cinema_amber' : isHotel ? 'hotel_sapphire' : 'emerald';
  const defaultFrame = isCinema ? 'sticker' : isHotel ? 'tent_card' : 'acrylic';
  const [selectedTheme, setSelectedTheme] = useState(defaultTheme);
  const [selectedFrame, setSelectedFrame] = useState(defaultFrame);
  const [qrColor, setQrColor] = useState('#000000');
  const [showReassurance, setShowReassurance] = useState(true);

  // Sync default theme and frame if vertical changes or resolves asynchronously
  useEffect(() => {
    if (isCinema) {
      setSelectedTheme('cinema_amber');
      setSelectedFrame('sticker');
    } else if (isHotel) {
      setSelectedTheme('hotel_sapphire');
      setSelectedFrame('tent_card');
    }
  }, [isCinema, isHotel]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [showAddSpaceMenu, setShowAddSpaceMenu] = useState(false);

  // Close Add Space dropdown on outside click
  useEffect(() => {
    if (!showAddSpaceMenu) return;
    const handleOutsideClick = () => setShowAddSpaceMenu(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showAddSpaceMenu]);

  // Inactive / Paused Spaces Derivation
  const inactiveList = useMemo(() => {
    return String(settingsForm?.inactive_spaces ?? restaurantInfo?.inactive_spaces ?? '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }, [settingsForm?.inactive_spaces, restaurantInfo?.inactive_spaces]);

  // Cinema Screens & Seats State
  const [cinemaScreens, setCinemaScreens] = useState([]);
  const [cinemaSeats, setCinemaSeats] = useState([]);
  const [loadingCinema, setLoadingCinema] = useState(false);

  // Cryptographic Token Cache (In-memory only, keyed by canonical space key)
  const [tokenMap, setTokenMap] = useState({});
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  // Selection & Active Preview State
  const [selectedSpaceKeys, setSelectedSpaceKeys] = useState(new Set());
  const [activePreviewKey, setActivePreviewKey] = useState(null);
  const [mobileViewTab, setMobileViewTab] = useState('list'); // 'list' | 'preview'

  // Action / Progress State
  const [exportingPng, setExportingPng] = useState(false);
  const [printingBulk, setPrintingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [toastMessage, setToastMessage] = useState(null);

  // Quick Table Setup & Capacity State
  const [quickCount, setQuickCount] = useState(10);
  const [savingQuick, setSavingQuick] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);

  // Safe Permanent Deletion Modal State
  const [spaceToDelete, setSpaceToDelete] = useState(null);
  const [deletingSpace, setDeletingSpace] = useState(false);

  const handleConfirmDelete = async () => {
    if (!spaceToDelete || !onDeleteTable) return;
    setDeletingSpace(true);
    try {
      const spaceLabel = spaceToDelete.label || `Space ${spaceToDelete.spaceNumber}`;
      const success = await onDeleteTable(
        spaceToDelete.spaceNumber,
        spaceToDelete.spaceType || (isHotel ? 'room' : 'table')
      );
      if (success !== false) {
        showToast(`🗑️ ${spaceLabel} permanently removed.`);
      }
      setSpaceToDelete(null);
    } catch (err) {
      console.error('Failed to delete space:', err);
      showToast('⚠️ Failed to delete space. Please try again.');
    } finally {
      setDeletingSpace(false);
    }
  };

  const handleQuickSetSpaces = async (newCount) => {
    const count = Math.max(1, parseInt(newCount, 10) || 1);
    setSavingQuick(true);
    try {
      if (onAddTable) {
        await onAddTable(count, isHotel ? 'room' : 'table');
      }
      showToast(`✓ Configured ${count} ${isHotel ? 'guest rooms' : 'dining tables'}! Generating QR codes...`);
      setShowCountModal(false);
    } catch (err) {
      console.error('Failed to update space count:', err);
      alert('Failed to set count: ' + (err.message || 'Error'));
    } finally {
      setSavingQuick(false);
    }
  };

  // Hidden Canvas Ref for High-Resolution Export
  const canvasRef = useRef(null);

  // Track Tenant Context to Prevent Race Conditions
  const tenantContextRef = useRef({ slug: activeSlug, id: restaurantId, reqId: 0 });

  // --------------------------------------------------------------------------
  // 1. AUTHORITATIVE PHYSICAL-SPACE INVENTORY DERIVATION (PHASE 1)
  // --------------------------------------------------------------------------

  // Fetch Cinema Data when in Cinema Mode
  useEffect(() => {
    if (isCinema && token) {
      setLoadingCinema(true);
      Promise.all([
        fetchCinemaScreens(token).catch(() => ({ success: false, screens: [] })),
        fetchCinemaSeats(token).catch(() => ({ success: false, seats: [] }))
      ]).then(([screensRes, seatsRes]) => {
        const screensList = (screensRes?.screens || []).filter(s => s.active !== false);
        const seatsList = (seatsRes?.seats || []).filter(st => st.active !== false);
        setCinemaScreens(screensList);
        setCinemaSeats(seatsList);
      }).catch(err => {
        console.warn('Failed to load cinema seats:', err);
      }).finally(() => {
        setLoadingCinema(false);
      });
    } else {
      setCinemaScreens([]);
      setCinemaSeats([]);
    }
  }, [isCinema, token, activeSlug]);

  // Build the complete server-authoritative inventory directly from configuration
  const configuredSpaces = useMemo(() => {
    const spaces = [];

    if (isCinema) {
      // Cinema Seats: Authoritative DB Records Only
      if (Array.isArray(cinemaSeats) && cinemaSeats.length > 0) {
        cinemaSeats.forEach(seat => {
          if (seat.active === false) return;
          const sNum = seat.screen_number || '1';
          const rLabel = (seat.row_label || 'A').toUpperCase();
          const stNum = seat.seat_number || '1';
          const seatCode = `S${sNum}-${rLabel}-${stNum}`;
          const key = `cinema_seat:${seatCode}`;

          spaces.push({
            key,
            spaceType: 'cinema_seat',
            spaceNumber: seatCode,
            paramName: 'cinema',
            label: `Screen ${sNum} • Row ${rLabel} • Seat ${stNum}`,
            badge: `SCREEN ${sNum} • ROW ${rLabel} • SEAT ${stNum}`,
            category: 'cinema_seat',
            categoryLabel: 'Cinema Seats',
            icon: '🎬'
          });
        });
      }
    } else if (isHotel) {
      // Hotel Rooms: 1 .. total_rooms
      const roomsCount = Math.max(0, Number(settingsForm?.total_rooms ?? restaurantInfo?.total_rooms ?? 0));
      for (let i = 1; i <= roomsCount; i++) {
        const numStr = String(i);
        spaces.push({
          key: `room:${numStr}`,
          spaceType: 'room',
          spaceNumber: numStr,
          paramName: 'room',
          label: `Room ${i}`,
          badge: `ROOM NO. ${i}`,
          category: 'room',
          categoryLabel: 'Hotel Rooms',
          icon: '🏨'
        });
      }
    } else {
      // Dining Tables: 1 .. total_tables
      const tablesCount = Math.max(0, Number(settingsForm?.total_tables ?? restaurantInfo?.total_tables ?? totalTablesCount ?? 0));
      for (let i = 1; i <= tablesCount; i++) {
        const numStr = String(i);
        spaces.push({
          key: `table:${numStr}`,
          spaceType: 'table',
          spaceNumber: numStr,
          paramName: 'table',
          label: `Table ${i}`,
          badge: `TABLE NO. ${i}`,
          category: 'table',
          categoryLabel: 'Dining Tables',
          icon: '🍽️'
        });
      }

      // Private Cabins: 1 .. total_cabins
      const cabinsCount = Math.max(0, Number(settingsForm?.total_cabins ?? restaurantInfo?.total_cabins ?? 0));
      for (let i = 1; i <= cabinsCount; i++) {
        const numStr = String(i);
        spaces.push({
          key: `cabin:${numStr}`,
          spaceType: 'cabin',
          spaceNumber: numStr,
          paramName: 'cabin',
          label: `Cabin ${i}`,
          badge: `CABIN NO. ${i}`,
          category: 'cabin',
          categoryLabel: 'Private Cabins',
          icon: '🛋️'
        });
      }

      // VIP Lounges: 1 .. total_vip
      const vipCount = Math.max(0, Number(settingsForm?.total_vip ?? restaurantInfo?.total_vip ?? 0));
      for (let i = 1; i <= vipCount; i++) {
        const numStr = String(i);
        spaces.push({
          key: `vip:${numStr}`,
          spaceType: 'vip',
          spaceNumber: numStr,
          paramName: 'vip',
          label: `VIP Lounge ${i}`,
          badge: `VIP LOUNGE ${i}`,
          category: 'vip',
          categoryLabel: 'VIP Lounges',
          icon: '👑'
        });
      }


    }

    return spaces;
  }, [
    isCinema, 
    isHotel,
    totalTablesCount,
    effectiveBiz,
    cinemaSeats, 
    settingsForm?.total_tables, 
    settingsForm?.total_cabins, 
    settingsForm?.total_rooms, 
    settingsForm?.total_vip, 
    settingsForm?.counter_ordering_enabled,
    restaurantInfo?.total_tables, 
    restaurantInfo?.total_cabins, 
    restaurantInfo?.total_rooms, 
    restaurantInfo?.total_vip,
    restaurantInfo?.counter_ordering_enabled
  ]);

  // Set Default Active Preview Space
  useEffect(() => {
    if (configuredSpaces.length > 0) {
      if (!activePreviewKey || !configuredSpaces.some(s => s.key === activePreviewKey)) {
        setActivePreviewKey(configuredSpaces[0].key);
      }
    } else {
      setActivePreviewKey(null);
    }
  }, [configuredSpaces, activePreviewKey]);

  // --------------------------------------------------------------------------
  // 2. TENANT ISOLATION & IMMEDIATE CACHE PURGE (PHASE 7)
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Increment generation counter to discard responses from previous tenants
    tenantContextRef.current = {
      slug: activeSlug,
      id: restaurantId,
      reqId: tenantContextRef.current.reqId + 1
    };

    // Immediately purge token cache and selection upon tenant change
    setTokenMap({});
    setSelectedSpaceKeys(new Set());
    setTokenError(null);
  }, [activeSlug, restaurantId]);

  // --------------------------------------------------------------------------
  // 3. CRYPTOGRAPHIC TOKEN PREFETCH & VALIDATION (PHASE 4)
  // --------------------------------------------------------------------------
  const prefetchTokens = useCallback(async () => {
    if (!token || !activeSlug || configuredSpaces.length === 0) return;

    const currentReqId = tenantContextRef.current.reqId;
    setLoadingTokens(true);
    setTokenError(null);

    try {
      // Find spaces that need tokens
      const missingSpaces = configuredSpaces.filter(sp => {
        const existing = tokenMap[sp.key];
        return !existing || !isValidHmacTokenFormat(existing);
      });

      if (missingSpaces.length === 0) {
        setLoadingTokens(false);
        return;
      }

      // Batch requests in chunks of 50
      const chunkSize = 50;
      const newTokenEntries = {};

      for (let i = 0; i < missingSpaces.length; i += chunkSize) {
        if (tenantContextRef.current.reqId !== currentReqId) return; // Tenant changed

        const chunk = missingSpaces.slice(i, i + chunkSize);
        const payload = {
          spaces: chunk.map(sp => ({
            space_type: sp.spaceType,
            space_number: sp.spaceNumber
          }))
        };

        const res = await generateQrTokensApi(token, payload);
        if (tenantContextRef.current.reqId !== currentReqId) return;

        if (res?.items && Array.isArray(res.items)) {
          res.items.forEach(item => {
            if (item.canonical_space_type && item.canonical_space_number && item.token) {
              if (isValidHmacTokenFormat(item.token)) {
                const spaceKey = `${item.canonical_space_type}:${item.canonical_space_number}`;
                newTokenEntries[spaceKey] = item.token;
              }
            }
          });
        }
      }

      setTokenMap(prev => ({ ...prev, ...newTokenEntries }));
    } catch (err) {
      console.warn('QR token prefetch error:', err);
      setTokenError('Some secure QR tokens failed to load. Please click Refresh Tokens.');
    } finally {
      if (tenantContextRef.current.reqId === currentReqId) {
        setLoadingTokens(false);
      }
    }
  }, [token, activeSlug, configuredSpaces, tokenMap]);

  useEffect(() => {
    prefetchTokens();
  }, [prefetchTokens]);

  // --------------------------------------------------------------------------
  // 4. FILTERING & SEARCH
  // --------------------------------------------------------------------------
  const availableCategories = useMemo(() => {
    if (isCinema) {
      return [{ id: 'cinema_seat', label: 'Cinema Seats', icon: '🎬', count: configuredSpaces.length }];
    }
    if (isHotel) {
      const rCount = Math.max(0, Number(settingsForm?.total_rooms ?? restaurantInfo?.total_rooms ?? configuredSpaces.length));
      return [{ id: 'room', label: 'Guest Rooms', icon: '🏨', count: rCount }];
    }
    const tCount = Math.max(0, Number(settingsForm?.total_tables ?? restaurantInfo?.total_tables ?? totalTablesCount ?? 0));
    const cCount = Math.max(0, Number(settingsForm?.total_cabins ?? restaurantInfo?.total_cabins ?? 0));
    const vCount = Math.max(0, Number(settingsForm?.total_vip ?? restaurantInfo?.total_vip ?? 0));
    const isCabinsAllowed = Boolean(capabilities?.cabins_enabled);
    const isVipAllowed = Boolean(capabilities?.vip_enabled);

    return [
      { id: 'table', label: 'Dining Tables', icon: '🍽️', count: tCount },
      { id: 'cabin', label: isCabinsAllowed ? 'Private Cabins' : 'Private Cabins 🔒', icon: '🛋️', count: cCount },
      { id: 'vip', label: isVipAllowed ? 'VIP Lounges' : 'VIP Lounges 🔒', icon: '👑', count: vCount }
    ];
  }, [
    isCinema,
    isHotel,
    configuredSpaces.length,
    settingsForm?.total_tables,
    settingsForm?.total_cabins,
    settingsForm?.total_vip,
    settingsForm?.total_rooms,
    restaurantInfo?.total_tables,
    restaurantInfo?.total_cabins,
    restaurantInfo?.total_vip,
    restaurantInfo?.total_rooms,
    totalTablesCount
  ]);

  const filteredSpaces = useMemo(() => {
    return configuredSpaces.filter(sp => {
      // Category filter
      if (activeCategoryFilter !== 'all' && sp.category !== activeCategoryFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesLabel = sp.label.toLowerCase().includes(query);
        const matchesBadge = sp.badge.toLowerCase().includes(query);
        const matchesNum = sp.spaceNumber.toLowerCase().includes(query);
        return matchesLabel || matchesBadge || matchesNum;
      }
      return true;
    });
  }, [configuredSpaces, activeCategoryFilter, searchQuery]);

  // Multi-Selection Helpers
  const areAllFilteredSelected = filteredSpaces.length > 0 && filteredSpaces.every(sp => selectedSpaceKeys.has(sp.key));
  const selectedCount = selectedSpaceKeys.size;

  const handleToggleSelectAllFiltered = () => {
    const nextSet = new Set(selectedSpaceKeys);
    if (areAllFilteredSelected) {
      filteredSpaces.forEach(sp => nextSet.delete(sp.key));
    } else {
      filteredSpaces.forEach(sp => nextSet.add(sp.key));
    }
    setSelectedSpaceKeys(nextSet);
  };

  const handleToggleSpaceSelection = (spaceKey) => {
    const nextSet = new Set(selectedSpaceKeys);
    if (nextSet.has(spaceKey)) {
      nextSet.delete(spaceKey);
    } else {
      nextSet.add(spaceKey);
    }
    setSelectedSpaceKeys(nextSet);
  };

  // --------------------------------------------------------------------------
  // 5. ACTIVE PREVIEW DATA & QR DATA URL GENERATION
  // --------------------------------------------------------------------------
  const activeSpace = useMemo(() => {
    return configuredSpaces.find(s => s.key === activePreviewKey) || configuredSpaces[0] || null;
  }, [configuredSpaces, activePreviewKey]);

  const activeToken = activeSpace ? tokenMap[activeSpace.key] : null;
  const isActiveTokenReady = Boolean(activeToken && isValidHmacTokenFormat(activeToken));

  const activeTargetUrl = useMemo(() => {
    if (!activeSpace || !isActiveTokenReady) return '';
    return `${liveOrigin}/${activeSlug}?${activeSpace.paramName}=${encodeURIComponent(activeSpace.spaceNumber)}&tkn=${encodeURIComponent(activeToken)}`;
  }, [liveOrigin, activeSlug, activeSpace, activeToken, isActiveTokenReady]);

  const [activeQrDataUrl, setActiveQrDataUrl] = useState('');

  // Generate Local QR Data URL for active preview space
  useEffect(() => {
    if (!activeTargetUrl) {
      setActiveQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(activeTargetUrl, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: qrColor || '#000000', light: '#FFFFFF' }
    }).then(dataUrl => {
      if (!cancelled) setActiveQrDataUrl(dataUrl);
    }).catch(err => {
      console.warn('Failed to generate local preview QR:', err);
      if (!cancelled) setActiveQrDataUrl('');
    });
    return () => { cancelled = true; };
  }, [activeTargetUrl, qrColor]);

  // --------------------------------------------------------------------------
  // 6. SINGLE STANDEE PRINT & PNG EXPORT (PHASES 5 & 6)
  // --------------------------------------------------------------------------
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePrintSingleStandee = async () => {
    if (!activeSpace) return;
    if (!isActiveTokenReady || !activeTargetUrl) {
      alert(`Cannot print: Secure server signature is missing for ${activeSpace.label}. Please wait for token generation.`);
      return;
    }
    if (!activeQrDataUrl) {
      alert('Generating local QR code. Please try again in a moment.');
      return;
    }

    const htmlContent = generateStandeePrintDocument({
      cards: [{ space: activeSpace, qrDataUrl: activeQrDataUrl }],
      restaurant: settingsForm || restaurantInfo || {},
      themeId: selectedTheme,
      frameStyle: selectedFrame,
      showReassurance,
      isBulk: false
    });

    executeIframePrint(htmlContent, `${activeSlug}_${activeSpace.spaceNumber}_standee`);
  };

  const handleDownloadPng = async (resMultiplier = 1) => {
    if (!activeSpace || !isActiveTokenReady || !activeQrDataUrl) {
      alert(`Cannot export: Secure server signature is missing for ${activeSpace?.label || 'space'}.`);
      return;
    }

    setExportingPng(true);
    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      const targetWidth = 1200 * resMultiplier;
      const targetHeight = 1650 * resMultiplier;

      await renderStandeeToCanvas(canvas, {
        space: activeSpace,
        restaurant: settingsForm || restaurantInfo || {},
        themeId: selectedTheme,
        frameStyle: selectedFrame,
        qrDataUrl: activeQrDataUrl,
        targetWidth,
        targetHeight,
        showReassurance
      });

      const link = document.createElement('a');
      link.download = `${activeSlug}_${activeSpace.spaceNumber}_standee_${targetWidth}x${targetHeight}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast(`✓ Downloaded ${activeSpace.label} standee (High-Res 300 DPI PNG)`);
    } catch (err) {
      console.error('Failed to export PNG standee:', err);
      alert('Failed to generate standee PNG: ' + err.message);
    } finally {
      setExportingPng(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. BULK PRINT FOR SELECTED SPACES (PHASE 6)
  // --------------------------------------------------------------------------
  const handleBulkPrintSelected = async () => {
    const spacesToPrint = configuredSpaces.filter(sp => selectedSpaceKeys.has(sp.key));
    if (spacesToPrint.length === 0) {
      alert('Please select at least one space to print.');
      return;
    }

    // Verify all selected spaces have tokens
    const missingSpaces = spacesToPrint.filter(sp => !tokenMap[sp.key] || !isValidHmacTokenFormat(tokenMap[sp.key]));
    if (missingSpaces.length > 0) {
      alert(`Cannot print: Secure server signatures are missing for ${missingSpaces.length} space(s) (e.g. ${missingSpaces[0].label}). Please wait for token generation or click Refresh Tokens.`);
      return;
    }

    setPrintingBulk(true);
    setBulkProgress({ current: 0, total: spacesToPrint.length });

    try {
      // Generate QR data URLs locally in batches of 10
      const cards = [];
      const batchSize = 10;

      for (let i = 0; i < spacesToPrint.length; i += batchSize) {
        const batch = spacesToPrint.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (sp) => {
          const sig = tokenMap[sp.key];
          const targetUrl = `${liveOrigin}/${activeSlug}?${sp.paramName}=${encodeURIComponent(sp.spaceNumber)}&tkn=${encodeURIComponent(sig)}`;
          const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            width: 600,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: { dark: qrColor || '#000000', light: '#FFFFFF' }
          });
          return { space: sp, qrDataUrl };
        }));

        cards.push(...batchResults);
        setBulkProgress({ current: Math.min(i + batchSize, spacesToPrint.length), total: spacesToPrint.length });
      }

      const htmlContent = generateStandeePrintDocument({
        cards,
        restaurant: settingsForm || restaurantInfo || {},
        themeId: selectedTheme,
        frameStyle: selectedFrame,
        showReassurance,
        isBulk: true
      });

      executeIframePrint(htmlContent, `${activeSlug}_bulk_standees_${cards.length}`);
      showToast(`✓ Prepared ${cards.length} standees for printing`);
    } catch (err) {
      console.error('Bulk print generation failed:', err);
      alert('Bulk print failed: ' + err.message);
    } finally {
      setPrintingBulk(false);
    }
  };

  const executeIframePrint = (htmlContent, title) => {
    // 1. Clean up any existing print iframe
    const oldIframe = document.getElementById('touchqr-standee-print-frame');
    if (oldIframe && oldIframe.parentNode) {
      oldIframe.parentNode.removeChild(oldIframe);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'touchqr-standee-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // 2. Guaranteed single-flight guard: print dialog is opened at most once
    let hasPrinted = false;
    const triggerSinglePrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print trigger failed:', e);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }
    };

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // 3. Single deterministic trigger after document renders
    setTimeout(triggerSinglePrint, 400);
  };

  // --------------------------------------------------------------------------
  // 7.5 AUTHORITATIVE SPACE PLAN LIMITS & FEATURE LOCK VALIDATION
  // --------------------------------------------------------------------------
  const currentTablesCount = Math.max(0, Number(settingsForm?.total_tables ?? restaurantInfo?.total_tables ?? totalTablesCount ?? 0));
  const currentCabinsCount = Math.max(0, Number(settingsForm?.total_cabins ?? restaurantInfo?.total_cabins ?? 0));
  const currentVipCount = Math.max(0, Number(settingsForm?.total_vip ?? restaurantInfo?.total_vip ?? 0));
  const currentRoomsCount = Math.max(0, Number(settingsForm?.total_rooms ?? restaurantInfo?.total_rooms ?? 0));

  const isTablesEnabled = capabilities?.tables_enabled !== false && capabilities?.tables_enabled !== 0;
  const isCabinsEnabled = Boolean(capabilities?.cabins_enabled);
  const isVipEnabled = Boolean(capabilities?.vip_enabled);
  const isRoomsEnabled = capabilities?.rooms_enabled !== false && capabilities?.rooms_enabled !== 0;

  const maxTables = capabilities?.max_tables ?? 20;
  const maxCabins = capabilities?.max_cabins ?? 0;
  const maxVip = capabilities?.max_vip ?? 0;
  const maxRooms = capabilities?.max_rooms ?? 60;

  const handleAddSpaceCheck = (spaceType) => {
    if (spaceType === 'table') {
      if (!isTablesEnabled) {
        alert('Dining Tables are disabled in your current SaaS plan.');
        return;
      }
      if (currentTablesCount >= maxTables) {
        alert(`Plan Limit Reached: Your current SaaS plan allows a maximum of ${maxTables} dining tables. Please upgrade your SaaS plan to add more.`);
        return;
      }
      onAddTable(currentTablesCount + 1, 'table');
    } else if (spaceType === 'cabin') {
      if (!isCabinsEnabled) {
        alert('Private Cabins are not included in your current SaaS plan. Please upgrade to Pro Plan to unlock Private Cabins.');
        return;
      }
      if (currentCabinsCount >= maxCabins) {
        alert(`Plan Limit Reached: Your current SaaS plan allows a maximum of ${maxCabins} private cabins. Please upgrade to Enterprise to add more.`);
        return;
      }
      onAddTable(currentCabinsCount + 1, 'cabin');
    } else if (spaceType === 'vip') {
      if (!isVipEnabled) {
        alert('VIP Lounges are not included in your current SaaS plan. Please upgrade to Pro Plan to unlock VIP Lounges.');
        return;
      }
      if (currentVipCount >= maxVip) {
        alert(`Plan Limit Reached: Your current SaaS plan allows a maximum of ${maxVip} VIP lounges. Please upgrade to Enterprise to add more.`);
        return;
      }
      onAddTable(currentVipCount + 1, 'vip');
    } else if (spaceType === 'room') {
      if (!isRoomsEnabled) {
        alert('Guest Rooms are disabled in your current SaaS plan.');
        return;
      }
      if (currentRoomsCount >= maxRooms) {
        alert(`Plan Limit Reached: Your current SaaS plan allows a maximum of ${maxRooms} guest rooms. Please upgrade your SaaS plan to add more.`);
        return;
      }
      onAddTable(currentRoomsCount + 1, 'room');
    }
  };

  // --------------------------------------------------------------------------
  // 8. RENDER MASTER-DETAIL LAYOUT (PHASE 2)
  // --------------------------------------------------------------------------
  const theme = STANDEE_THEMES[selectedTheme] || STANDEE_THEMES.emerald;

  return (
    <div className="standee-workspace-wrapper">
      {/* Hidden Canvas for High-Resolution PNG Render */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* WORKSPACE HEADER */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        borderBottom: '1px solid #E2E8F0',
        paddingBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              QR Standee Management
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            {isHotel 
              ? 'Manage and print tamper-proof QR standees for your guest rooms.'
              : isCinema 
              ? 'Manage and print tamper-proof QR standees for your cinema screens and seats.'
              : 'Manage and print tamper-proof QR standees for your tables, cabins & lounges.'
            }
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={prefetchTokens}
            disabled={loadingTokens}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '0.80rem',
              fontWeight: 600,
              cursor: loadingTokens ? 'wait' : 'pointer'
            }}
            title="Refresh cryptographic signatures for all spaces"
          >
            <RefreshCw size={13} className={loadingTokens ? 'animate-spin' : ''} />
            <span>{loadingTokens ? 'Signing...' : 'Sync Tokens'}</span>
          </button>

          {isCinema && onBackToSetup && (
            <button
              type="button"
              onClick={() => onBackToSetup('cinema')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: '#475569',
                fontSize: '0.80rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Settings size={13} />
              <span>Cinema Setup</span>
            </button>
          )}
        </div>
      </div>

      {/* ERROR NOTICE IF TOKENS FAILED */}
      {tokenError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          color: '#991B1B',
          fontSize: '0.82rem',
          marginBottom: '16px'
        }}>
          <AlertTriangle size={16} />
          <span>{tokenError}</span>
          <button
            type="button"
            onClick={prefetchTokens}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#991B1B',
              fontWeight: 700,
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Retry Now
          </button>
        </div>
      )}

      {/* MOBILE SEGMENTED VIEW SWITCHER (< 768px) */}
      <div className="standee-mobile-tabs">
        <button
          type="button"
          onClick={() => setMobileViewTab('list')}
          className={`standee-mobile-tab-btn ${mobileViewTab === 'list' ? 'active' : ''}`}
        >
          <span>📋 Spaces ({configuredSpaces.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileViewTab('preview')}
          className={`standee-mobile-tab-btn ${mobileViewTab === 'preview' ? 'active' : ''}`}
        >
          <span>👁️ Standee {activeSpace ? `(${activeSpace.label})` : 'Preview'}</span>
        </button>
      </div>

      {/* MASTER-DETAIL RESPONSIVE GRID */}
      <div className="standee-workspace-grid">
        
        {/* ================================================================= */}
        {/* LEFT PANEL: CONFIGURED SPACES & INVENTORY MANAGEMENT              */}
        {/* ================================================================= */}
        <div className={`standee-inventory-panel ${mobileViewTab !== 'list' ? 'mobile-hidden' : ''}`}>
          {/* Capacity Hub & Spaces Overview Deck */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            {/* Header Title Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  Physical Spaces
                </span>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, background: '#0F172A', color: '#DFBA67', padding: '2px 8px', borderRadius: '12px' }}>
                  {configuredSpaces.length} Total
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                {selectedCount === 1 
                  ? '1 space selected' 
                  : selectedCount > 1 
                  ? `${selectedCount} spaces selected for bulk print` 
                  : 'Click card to live-preview'}
              </div>
            </div>

            {/* Search Input Bar */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                color="#64748B"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                placeholder={isHotel ? "Search rooms (e.g. Room 101)..." : isCinema ? "Search seats or screens..." : "Search tables, cabins, lounges..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="standee-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#E2E8F0',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                  title="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Category Filter Chips & Contextual Section Add Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flexWrap: 'nowrap', maxWidth: '100%', paddingBottom: '4px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('all')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '16px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: activeCategoryFilter === 'all' ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                    background: activeCategoryFilter === 'all' ? '#0F172A' : '#FFFFFF',
                    color: activeCategoryFilter === 'all' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  All ({configuredSpaces.length})
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 12px',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: activeCategoryFilter === cat.id ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                      background: activeCategoryFilter === cat.id ? '#0F172A' : '#FFFFFF',
                      color: activeCategoryFilter === cat.id ? '#FFFFFF' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label} ({cat.count})</span>
                  </button>
                ))}
              </div>

              {/* Contextual Single Add Button: Exclusively for Current Section with Plan Guard */}
              {!isCinema && onAddTable && (
                <div style={{ position: 'relative' }}>
                  {activeCategoryFilter === 'table' && (
                    <button
                      type="button"
                      onClick={() => handleAddSpaceCheck('table')}
                      disabled={savingQuick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: currentTablesCount >= maxTables ? '#94A3B8' : '#064E3B',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: savingQuick ? 'wait' : 'pointer',
                        boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                      }}
                      title={currentTablesCount >= maxTables ? `Max limit of ${maxTables} dining tables reached` : "Add 1 more Dining Table"}
                    >
                      <Plus size={14} /> {currentTablesCount >= maxTables ? `Limit Reached (${maxTables})` : 'Add Table'}
                    </button>
                  )}

                  {activeCategoryFilter === 'cabin' && (
                    <button
                      type="button"
                      onClick={() => handleAddSpaceCheck('cabin')}
                      disabled={savingQuick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: !isCabinsEnabled ? '#D97706' : (currentCabinsCount >= maxCabins ? '#94A3B8' : '#1E40AF'),
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: savingQuick ? 'wait' : 'pointer',
                        boxShadow: '0 2px 6px rgba(30, 64, 175, 0.25)'
                      }}
                      title={!isCabinsEnabled ? "Private Cabins locked in current plan. Upgrade to Pro." : (currentCabinsCount >= maxCabins ? `Max limit of ${maxCabins} cabins reached` : "Add 1 more Private Cabin")}
                    >
                      <Plus size={14} /> {!isCabinsEnabled ? '🔒 Unlock Cabins (Pro)' : (currentCabinsCount >= maxCabins ? `Limit Reached (${maxCabins})` : 'Add Cabin')}
                    </button>
                  )}

                  {activeCategoryFilter === 'vip' && (
                    <button
                      type="button"
                      onClick={() => handleAddSpaceCheck('vip')}
                      disabled={savingQuick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: !isVipEnabled ? '#D97706' : (currentVipCount >= maxVip ? '#94A3B8' : '#7C3AED'),
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: savingQuick ? 'wait' : 'pointer',
                        boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)'
                      }}
                      title={!isVipEnabled ? "VIP Lounges locked in current plan. Upgrade to Pro." : (currentVipCount >= maxVip ? `Max limit of ${maxVip} lounges reached` : "Add 1 more VIP Lounge")}
                    >
                      <Plus size={14} /> {!isVipEnabled ? '🔒 Unlock Lounges (Pro)' : (currentVipCount >= maxVip ? `Limit Reached (${maxVip})` : 'Add Lounge')}
                    </button>
                  )}

                  {activeCategoryFilter === 'room' && (
                    <button
                      type="button"
                      onClick={() => handleAddSpaceCheck('room')}
                      disabled={savingQuick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: currentRoomsCount >= maxRooms ? '#94A3B8' : '#064E3B',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: savingQuick ? 'wait' : 'pointer',
                        boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                      }}
                      title={currentRoomsCount >= maxRooms ? `Max limit of ${maxRooms} rooms reached` : "Add 1 more Guest Room"}
                    >
                      <Plus size={14} /> {currentRoomsCount >= maxRooms ? `Limit Reached (${maxRooms})` : 'Add Room'}
                    </button>
                  )}

                  {activeCategoryFilter === 'all' && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddSpaceMenu(prev => !prev);
                        }}
                        disabled={savingQuick}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#0F172A',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: savingQuick ? 'wait' : 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        <Plus size={14} /> Add Space ▾
                      </button>
                      {showAddSpaceMenu && (
                        <div
                          className="standee-add-dropdown"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isHotel ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddSpaceMenu(false);
                                handleAddSpaceCheck('room');
                              }}
                              style={{
                                width: '100%',
                                padding: '9px 14px',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: '#0F172A',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <span style={{ fontSize: '1rem', flexShrink: 0 }}>🏨</span>
                              <span>Add Room</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddSpaceMenu(false);
                                  handleAddSpaceCheck('table');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '9px 14px',
                                  textAlign: 'left',
                                  background: 'none',
                                  border: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>🍽️</span>
                                <span>Add Table</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddSpaceMenu(false);
                                  handleAddSpaceCheck('cabin');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '9px 14px',
                                  textAlign: 'left',
                                  background: 'none',
                                  border: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: isCabinsEnabled ? '#0F172A' : '#94A3B8',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>🛋️</span>
                                <span>{isCabinsEnabled ? 'Add Cabin' : 'Add Cabin 🔒 (Pro)'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddSpaceMenu(false);
                                  handleAddSpaceCheck('vip');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '9px 14px',
                                  textAlign: 'left',
                                  background: 'none',
                                  border: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: isVipEnabled ? '#0F172A' : '#94A3B8',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>👑</span>
                                <span>{isVipEnabled ? 'Add Lounge' : 'Add Lounge 🔒 (Pro)'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bulk Selection Toolbar */}
            {filteredSpaces.length > 0 && (
              <div className="standee-bulk-toolbar">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={areAllFilteredSelected}
                    onChange={handleToggleSelectAllFiltered}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Select All Filtered ({filteredSpaces.length})</span>
                </label>

                {selectedCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpaceKeys(new Set())}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '0.74rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                      title="Clear selection"
                    >
                      Clear
                    </button>
                    {selectedCount > 1 ? (
                      <button
                        type="button"
                        onClick={handleBulkPrintSelected}
                        disabled={printingBulk}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#0A2315',
                          color: '#DFBA67',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: printingBulk ? 'wait' : 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Printer size={14} />
                        <span>
                          {printingBulk 
                            ? `Generating (${bulkProgress.current}/${bulkProgress.total})...`
                            : `Bulk Print (${selectedCount})`
                          }
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleBulkPrintSelected}
                        disabled={printingBulk}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#0F172A',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: printingBulk ? 'wait' : 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Printer size={13} />
                        <span>
                          {printingBulk ? 'Generating...' : 'Print Selected (1)'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SPACES LIST */}
          <div className="standee-spaces-list">
            {configuredSpaces.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#ECFDF5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontSize: '1.4rem' }}>
                  {isHotel ? '🏨' : isCinema ? '🎬' : '🍽️'}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                  {isCinema ? 'Cinema Setup Required' : isHotel ? 'Generate Room QR Standees' : 'Generate Table QR Standees'}
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: '380px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
                  {isCinema
                    ? 'Cinema seat ordering requires configuring auditorium screens and seats in Cinema Setup.'
                    : isHotel
                    ? 'Enter your total number of guest rooms to instantly generate in-room QR standees with cryptographic signatures.'
                    : 'Enter your total number of dining tables to instantly generate unique QR standees for each table.'
                  }
                </p>

                {!isCinema ? (
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 12px', borderRadius: '12px', border: '1.5px solid #CBD5E1' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                        {isHotel ? 'Total Rooms:' : 'Total Tables:'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={quickCount}
                        onChange={(e) => setQuickCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.92rem', textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickSetSpaces(quickCount)}
                        disabled={savingQuick}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#064E3B',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {savingQuick ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        <span>{savingQuick ? 'Generating...' : `Generate ${quickCount} QRs`}</span>
                      </button>
                    </div>
                    {onBackToSetup && (
                      <button
                        type="button"
                        onClick={() => onBackToSetup(isHotel ? 'profile' : 'general')}
                        style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.76rem', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        Or configure in Business Settings
                      </button>
                    )}
                  </div>
                ) : (
                  onBackToSetup && (
                    <button
                      type="button"
                      onClick={() => onBackToSetup('cinema')}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#0F172A',
                        color: '#FFFFFF',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      🎬 Go to Cinema Setup
                    </button>
                  )
                )}
              </div>
            ) : filteredSpaces.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                {searchQuery ? (
                  <>No spaces match "{searchQuery}". <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#2563EB', textDecoration: 'underline', cursor: 'pointer' }}>Clear search</button></>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>
                      {activeCategoryFilter === 'cabin' ? '🛋️' : activeCategoryFilter === 'vip' ? '👑' : activeCategoryFilter === 'room' ? '🏨' : '🍽️'}
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: '#334155' }}>
                      No {activeCategoryFilter === 'cabin' ? 'Private Cabins' : activeCategoryFilter === 'vip' ? 'VIP Lounges' : activeCategoryFilter === 'room' ? 'Guest Rooms' : 'Dining Tables'} Configured
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', maxWidth: '300px' }}>
                      Click the "+ Add" button above to configure your first {activeCategoryFilter === 'cabin' ? 'private cabin' : activeCategoryFilter === 'vip' ? 'VIP lounge' : activeCategoryFilter === 'room' ? 'guest room' : 'dining table'}.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              filteredSpaces.map(sp => {
                const isSelectedForPrint = selectedSpaceKeys.has(sp.key);
                const isCurrentlyPreviewed = activePreviewKey === sp.key;
                const hasValidToken = Boolean(tokenMap[sp.key] && isValidHmacTokenFormat(tokenMap[sp.key]));
                const isSpaceInactive = inactiveList.includes(sp.key.toLowerCase());

                return (
                  <div
                    key={sp.key}
                    onClick={() => {
                      setActivePreviewKey(sp.key);
                      setMobileViewTab('preview');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isCurrentlyPreviewed ? '2px solid #0A2315' : '1px solid #E2E8F0',
                      background: isCurrentlyPreviewed ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      {/* Checkbox for selection with complete stopPropagation */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          margin: '-6px 0 -6px -4px',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelectedForPrint}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSpaceSelection(sp.key);
                          }}
                          style={{ cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0 }}
                        />
                      </div>

                      <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{sp.icon}</span>

                      {/* Info Column */}
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sp.label}
                          </span>
                          {isCurrentlyPreviewed && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 900,
                              background: '#0A2315',
                              color: '#DFBA67',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              PREVIEW
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: '2px', fontSize: '0.72rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sp.categoryLabel}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Dedicated 2-Row Stack (Active Button + Secured Token) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', flexShrink: 0 }}>
                      {/* Active / Inactive Pause Toggle */}
                      {onToggleSpaceActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSpaceActive(sp.key);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            border: isSpaceInactive ? '1px solid #FCD34D' : '1px solid #BBF7D0',
                            background: isSpaceInactive ? '#FFFBEB' : '#ECFDF5',
                            color: isSpaceInactive ? '#B45309' : '#059669',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                          title={isSpaceInactive ? 'Space is paused (offline). Click to Activate.' : 'Space is active (online). Click to Pause.'}
                        >
                          {isSpaceInactive ? '⏸️ Paused' : '🟢 Active'}
                        </button>
                      )}

                      {/* Cryptographic Signature Status */}
                      <div style={{ fontSize: '0.68rem', lineHeight: 1 }}>
                        {hasValidToken ? (
                          <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                            <ShieldCheck size={11} /> Secured
                          </span>
                        ) : loadingTokens ? (
                          <span style={{ color: '#D97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                            <RefreshCw size={11} className="animate-spin" /> Signing...
                          </span>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                            <AlertTriangle size={11} /> No Token
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT PANEL: LIVE STANDEE PREVIEW & EXPORT ACTIONS               */}
        {/* ================================================================= */}
        <div className={`standee-preview-panel ${mobileViewTab !== 'preview' ? 'mobile-hidden' : ''}`}>
          {/* Mobile Quick Back to List Button */}
          <div className="standee-mobile-back-row">
            <button
              type="button"
              onClick={() => setMobileViewTab('list')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ← Back to Spaces List
            </button>
          </div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Standee Preview
              </span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '2px 0 0 0' }}>
                {activeSpace ? activeSpace.label : configuredSpaces.length === 0 ? 'No Spaces Configured' : 'Select a Space'}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Token Status Indicator */}
              {isActiveTokenReady ? (
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <ShieldCheck size={14} /> Ready to Print
                </span>
              ) : activeSpace ? (
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <RefreshCw size={14} className="animate-spin" /> Fetching Token...
                </span>
              ) : (
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>
                  {configuredSpaces.length === 0 ? 'No Spaces' : 'Standby'}
                </span>
              )}

              {/* Safe Delete Active Space Button in Header */}
              {!isCinema && onDeleteTable && activeSpace && (
                <button
                  type="button"
                  onClick={() => setSpaceToDelete(activeSpace)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#64748B',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#FECACA';
                    e.currentTarget.style.color = '#DC2626';
                    e.currentTarget.style.background = '#FEF2F2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.color = '#64748B';
                    e.currentTarget.style.background = '#F8FAFC';
                  }}
                  title={`Delete ${activeSpace.label}`}
                >
                  <Trash2 size={12} />
                  <span>Delete Space</span>
                </button>
              )}
            </div>
          </div>

          {configuredSpaces.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              textAlign: 'center',
              background: '#F8FAFC',
              borderRadius: '16px',
              border: '2px dashed #CBD5E1',
              marginTop: '16px',
              minHeight: '380px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#ECFDF5',
                color: '#065F46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                marginBottom: '16px'
              }}>
                {isHotel ? '🏨' : isCinema ? '🎬' : '🍽️'}
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
                No Physical Spaces to Preview
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: '320px', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                You haven't created any {isHotel ? 'guest rooms' : isCinema ? 'cinema screens' : 'dining tables, cabins, or lounges'} yet. Create your first space to generate and preview standees.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMobileViewTab('list');
                  handleAddSpaceCheck(isHotel ? 'room' : 'table');
                }}
                disabled={savingQuick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0A2315',
                  color: '#DFBA67',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: savingQuick ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(10,35,21,0.2)'
                }}
              >
                <Plus size={16} /> Add First {isHotel ? 'Room' : isCinema ? 'Screen' : 'Table'}
              </button>
            </div>
          ) : (
            <>
              {/* REALISTIC STANDEE PREVIEW CONTAINER */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* The Acrylic Card Frame */}
            <div
              className="standee-preview-card-frame"
              style={{
                maxWidth: '280px',
                width: '100%',
                padding: '20px 14px 16px 14px',
                border: `${STANDEE_FRAMES[selectedFrame]?.borderWidth || '3.5px'} solid ${theme.cardBorder}`,
                borderRadius: STANDEE_FRAMES[selectedFrame]?.borderRadius || '24px',
                backgroundColor: theme.cardBg,
                textAlign: 'center',
                boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
                position: 'relative',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
            >
              {/* Acrylic Top-Right Glare */}
              {STANDEE_FRAMES[selectedFrame]?.hasGlare && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '90px',
                  height: '90px',
                  background: 'radial-gradient(circle at top right, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
                  borderRadius: '0 24px 0 0',
                  pointerEvents: 'none'
                }} />
              )}

              {/* Inner Frame */}
              {STANDEE_FRAMES[selectedFrame]?.hasInnerFrame && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  right: '6px',
                  bottom: '6px',
                  border: `1.5px solid ${theme.innerBorder}`,
                  borderRadius: '18px',
                  pointerEvents: 'none'
                }} />
              )}

              {/* Space Badge */}
              <div style={{
                display: 'inline-block',
                background: theme.badgeBg,
                color: theme.badgeText,
                padding: '3px 12px',
                borderRadius: '18px',
                fontSize: '0.68rem',
                fontWeight: 900,
                letterSpacing: '0.4px',
                border: `1.5px solid ${theme.badgeBorder}`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                marginBottom: '8px',
                maxWidth: '92%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box'
              }}>
                ✦ {activeSpace?.badge || 'NO SPACE SELECTED'} ✦
              </div>

              {/* Restaurant Name */}
              <h3 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '1.05rem',
                fontWeight: 900,
                color: theme.titleColor,
                lineHeight: 1.25,
                margin: '0 0 2px 0',
                padding: '0 4px',
                wordBreak: 'break-word'
              }}>
                {currentName}
              </h3>

              {/* Divider */}
              <div style={{ color: theme.dividerColor, fontSize: '0.62rem', letterSpacing: '2px', margin: '2px 0 4px 0' }}>
                ── ◆ ──
              </div>

              {/* Tagline */}
              <div style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                color: theme.subtitleColor,
                marginBottom: '10px',
                padding: '0 6px',
                wordBreak: 'break-word',
                lineHeight: 1.3
              }}>
                {settingsForm?.tagline || (
                  isCinema ? 'IN-SEAT FOOD ORDERING' :
                  isHotel ? 'IN-ROOM GUEST DINING' :
                  'SCAN QR CODE FOR DIGITAL MENU'
                )}
              </div>

              {/* QR Plaque Box */}
              <div style={{
                backgroundColor: theme.qrBoxBg,
                padding: '10px',
                borderRadius: '14px',
                border: `1.5px solid ${theme.qrBoxBorder}`,
                display: 'inline-block',
                marginBottom: '8px',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
              }}>
                {/* Pill */}
                <div style={{
                  position: 'absolute',
                  top: '-9px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: theme.pillBg,
                  color: theme.pillText,
                  border: `1px solid ${theme.pillBorder}`,
                  fontSize: '0.54rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap',
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {isCinema ? 'DELIVER TO SEAT' : isHotel ? 'IN-ROOM DINING' : 'SCAN TO ORDER'}
                </div>

                {activeQrDataUrl ? (
                  <img
                    src={activeQrDataUrl}
                    alt="Standee QR Code"
                    style={{ width: '150px', height: '150px', display: 'block' }}
                  />
                ) : activeSpace ? (
                  <div style={{
                    width: '150px',
                    height: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F1F5F9',
                    borderRadius: '8px',
                    color: '#64748B',
                    fontSize: '0.7rem',
                    gap: '6px'
                  }}>
                    <RefreshCw size={24} className="animate-spin" color="#94A3B8" />
                    <span>Signing Token...</span>
                  </div>
                ) : (
                  <div style={{
                    width: '150px',
                    height: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#F8FAFC',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: '8px',
                    color: '#64748B',
                    fontSize: '0.7rem',
                    gap: '6px',
                    padding: '8px',
                    boxSizing: 'border-box'
                  }}>
                    <QrCode size={28} color="#94A3B8" />
                    <span style={{ textAlign: 'center', fontSize: '0.66rem' }}>Configure tables to generate QR</span>
                  </div>
                )}
              </div>

              {/* Bilingual Instructions */}
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.instructionEn, marginBottom: '2px' }}>
                📱 POINT CAMERA AT QR TO ORDER
              </div>
              <div style={{ fontSize: '0.66rem', fontWeight: 600, color: theme.instructionHi, marginBottom: '6px' }}>
                {isCinema ? 'स्कैन करें और सीट पर मंगाएं' :
                  isHotel ? 'स्कैन करें और कमरे में खाना मंगाएं' :
                  'कैमरे से स्कैन करें और खाना ऑर्डर करें'}
              </div>

              {/* 3-Step Bar */}
              <div style={{
                background: theme.stepBg,
                border: `1px solid ${theme.stepBorder}`,
                color: theme.stepText,
                borderRadius: '20px',
                padding: '2.5px 6px',
                fontSize: '0.48rem',
                fontWeight: 700,
                marginBottom: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2.5px',
                maxWidth: '96%',
                boxSizing: 'border-box'
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '11px',
                    height: '11px',
                    minWidth: '11px',
                    borderRadius: '50%',
                    background: theme.isDark ? '#38BDF8' : '#0A2315',
                    color: theme.isDark ? '#0F172A' : '#DFBA67',
                    fontSize: '0.44rem',
                    fontWeight: 900,
                    lineHeight: '11px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>1</span>
                  <span>Open Camera</span>
                </span>
                <span style={{ opacity: 0.5, fontSize: '0.46rem', display: 'inline-flex', alignItems: 'center' }}>➔</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '11px',
                    height: '11px',
                    minWidth: '11px',
                    borderRadius: '50%',
                    background: theme.isDark ? '#38BDF8' : '#0A2315',
                    color: theme.isDark ? '#0F172A' : '#DFBA67',
                    fontSize: '0.44rem',
                    fontWeight: 900,
                    lineHeight: '11px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>2</span>
                  <span>Scan QR</span>
                </span>
                <span style={{ opacity: 0.5, fontSize: '0.46rem', display: 'inline-flex', alignItems: 'center' }}>➔</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '11px',
                    height: '11px',
                    minWidth: '11px',
                    borderRadius: '50%',
                    background: theme.isDark ? '#38BDF8' : '#0A2315',
                    color: theme.isDark ? '#0F172A' : '#DFBA67',
                    fontSize: '0.44rem',
                    fontWeight: 900,
                    lineHeight: '11px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>3</span>
                  <span>{isCinema ? 'Seat Delivery' : isHotel ? 'Room Delivery' : 'Order Food'}</span>
                </span>
              </div>

              {/* Reassurance */}
              {showReassurance && (
                <div style={{ fontSize: '0.58rem', fontWeight: 800, color: theme.accentColor, marginBottom: '6px' }}>
                  ⚡ Instant Digital Menu • No App Required
                </div>
              )}

              {/* Footer */}
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px', fontSize: '0.58rem', color: theme.isDark ? '#94A3B8' : '#64748B' }}>
                {settingsForm?.phone ? `Phone: ${settingsForm.phone}` : ''}
                {!settingsForm?.watermark_removal_enabled && (
                  <div style={{ color: theme.subtitleColor, fontWeight: 800, marginTop: '2px' }}>
                    ⚡ Powered by TouchQR
                  </div>
                )}
              </div>
            </div>

            {/* Stand Base Shadow */}
            <div style={{
              width: '220px',
              maxWidth: '80%',
              height: '10px',
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 70%)',
              borderRadius: '50%',
              marginTop: '8px'
            }} />
          </div>

          {/* APPEARANCE CUSTOMIZER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
            {/* Theme Selector */}
            <div className="standee-control-row">
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                Theme Palette
              </span>
              <div className="standee-control-buttons">
                {Object.values(STANDEE_THEMES).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTheme(t.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: selectedTheme === t.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                      background: selectedTheme === t.id ? '#F1F5F9' : '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Style */}
            <div className="standee-control-row">
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                Stand Style
              </span>
              <div className="standee-control-buttons">
                {Object.values(STANDEE_FRAMES).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFrame(f.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: selectedFrame === f.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                      background: selectedFrame === f.id ? '#F1F5F9' : '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* QR Color Picker */}
            <div className="standee-control-row">
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                QR Code Ink
              </span>
              <div className="standee-control-buttons">
                {[
                  { id: '#000000', label: 'Black' },
                  { id: '#0F172A', label: 'Slate' },
                  { id: '#92400E', label: 'Gold' },
                  { id: '#064E3B', label: 'Emerald' }
                ].map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setQrColor(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: qrColor === c.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                      background: qrColor === c.id ? '#F1F5F9' : '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.id, display: 'inline-block' }} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PRIMARY EXPORT BUTTONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
            <div className="standee-export-actions">
              {/* Single Print Button */}
              <button
                type="button"
                onClick={handlePrintSingleStandee}
                disabled={!isActiveTokenReady || !activeQrDataUrl}
                className="standee-export-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActiveTokenReady ? '#0A2315' : '#E2E8F0',
                  color: isActiveTokenReady ? '#DFBA67' : '#94A3B8',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: isActiveTokenReady ? 'pointer' : 'not-allowed'
                }}
                title={isActiveTokenReady ? 'Print Standee (A4 format with Save as PDF option)' : 'Waiting for secure server signature'}
              >
                <Printer size={16} />
                <span>Print Standee (A4)</span>
              </button>

              {/* PNG Download Button */}
              <button
                type="button"
                onClick={() => handleDownloadPng(1)}
                disabled={!isActiveTokenReady || !activeQrDataUrl || exportingPng}
                className="standee-export-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: isActiveTokenReady ? '#FFFFFF' : '#F8FAFC',
                  color: isActiveTokenReady ? '#0F172A' : '#94A3B8',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: isActiveTokenReady && !exportingPng ? 'pointer' : 'not-allowed'
                }}
                title={isActiveTokenReady ? 'Download High-Res 300 DPI PNG' : 'Waiting for secure server signature'}
              >
                <Download size={16} />
                <span>{exportingPng ? 'Exporting...' : 'Download PNG'}</span>
              </button>


            </div>

            {/* Print as PDF Note */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              color: '#64748B',
              background: '#F8FAFC',
              padding: '6px 10px',
              borderRadius: '6px'
            }}>
              <HelpCircle size={13} color="#059669" />
              <span>
                To save as PDF, click <strong>Print Standee</strong> and select <strong>Save as PDF</strong> in your browser's print dialog.
              </span>
            </div>
          </div>
        </>
      )}
    </div>

      </div>

      {/* ================================================================= */}
      {/* PERMANENT DELETION SAFETY CONFIRMATION MODAL                      */}
      {/* ================================================================= */}
      {spaceToDelete && (
        <div
          onClick={() => !deletingSpace && setSpaceToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #F1F5F9',
              background: '#FFF1F2'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#991B1B', margin: 0 }}>
                    Delete Physical Space?
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600 }}>
                    Permanent Action • Destroys Printed Standee
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !deletingSpace && setSpaceToDelete(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Space Target Identifier */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0'
              }}>
                <span style={{ fontSize: '1.4rem' }}>
                  {spaceToDelete.icon || '🍽️'}
                </span>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: '#0F172A', display: 'block' }}>
                    {spaceToDelete.label}
                  </strong>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                    {spaceToDelete.categoryLabel || 'Physical Space'}
                  </span>
                </div>
              </div>

              {/* Warning Callout */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                gap: '10px'
              }}>
                <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.78rem', color: '#991B1B', lineHeight: 1.45 }}>
                  <strong>Do you have a printed standee for this space?</strong>
                  <div style={{ marginTop: '4px' }}>
                    Deleting <strong>{spaceToDelete.label}</strong> will immediately and permanently revoke its cryptographic QR signature. If a customer scans the physical standee on this table, they will get a <strong>"Space Not Found"</strong> error.
                  </div>
                </div>
              </div>

              {/* Safe Alternative Callout */}
              {onToggleSpaceActive && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '0.74rem', color: '#166534', lineHeight: 1.4 }}>
                    <strong>💡 Safer Alternative:</strong> Just pause this space while not in use. Your physical QR standee stays valid.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleSpaceActive(spaceToDelete.key);
                      showToast(`Space status updated for ${spaceToDelete.label}`);
                      setSpaceToDelete(null);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #86EFAC',
                      background: '#FFFFFF',
                      color: '#15803D',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    ⏸️ Pause Instead
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '14px 20px',
              borderTop: '1px solid #F1F5F9',
              background: '#F8FAFC'
            }}>
              <button
                type="button"
                onClick={() => setSpaceToDelete(null)}
                disabled={deletingSpace}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingSpace}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: deletingSpace ? 'wait' : 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                }}
              >
                {deletingSpace ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
