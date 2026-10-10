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
  HelpCircle
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

export default function QrGeneratorView({
  tableNumber,
  setTableNumber,
  totalTablesCount,
  onPrintQR,
  settingsForm,
  token,
  restaurantInfo,
  capabilities,
  onBackToSetup
}) {
  // Tenant Identity
  const activeSlug = settingsForm?.slug || restaurantInfo?.slug || '';
  const restaurantId = settingsForm?.id || restaurantInfo?.id || '';
  const currentName = settingsForm?.name || restaurantInfo?.name || 'Digital Menu';
  const liveOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Business Vertical & Cinema Detection
  const businessType = String(settingsForm?.business_type || restaurantInfo?.business_type || 'restaurant').toLowerCase();
  const isCinema = businessType === 'cinema' || Boolean(capabilities?.cinema_ordering_enabled);

  // Appearance & Customization State
  const [selectedTheme, setSelectedTheme] = useState('emerald');
  const [selectedFrame, setSelectedFrame] = useState('acrylic');
  const [qrColor, setQrColor] = useState('#000000');
  const [showReassurance, setShowReassurance] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');

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

  // Action / Progress State
  const [exportingPng, setExportingPng] = useState(false);
  const [printingBulk, setPrintingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [toastMessage, setToastMessage] = useState(null);

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
    } else {
      // Dining Tables: 1 .. total_tables
      const tablesCount = Math.max(0, Number(settingsForm?.total_tables ?? restaurantInfo?.total_tables ?? 0));
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
    cinemaSeats, 
    settingsForm?.total_tables, 
    settingsForm?.total_cabins, 
    settingsForm?.total_rooms, 
    settingsForm?.total_vip, 
    restaurantInfo?.total_tables, 
    restaurantInfo?.total_cabins, 
    restaurantInfo?.total_rooms, 
    restaurantInfo?.total_vip
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
    const cats = new Map();
    configuredSpaces.forEach(sp => {
      if (!cats.has(sp.category)) {
        cats.set(sp.category, { id: sp.category, label: sp.categoryLabel, icon: sp.icon, count: 0 });
      }
      cats.get(sp.category).count++;
    });
    return Array.from(cats.values());
  }, [configuredSpaces]);

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
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print trigger failed:', e);
      }
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 5000);
    }, 800);
  };

  // --------------------------------------------------------------------------
  // 8. RENDER MASTER-DETAIL LAYOUT (PHASE 2)
  // --------------------------------------------------------------------------
  const theme = STANDEE_THEMES[selectedTheme] || STANDEE_THEMES.emerald;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              QR Standee Management
            </h1>
            <span style={{
              background: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.74rem',
              fontWeight: 700
            }}>
              Server-Authoritative
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
            Manage physical dining standees with cryptographically signed QR codes. Changes in Setup reflect automatically.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={prefetchTokens}
            disabled={loadingTokens}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: loadingTokens ? 'wait' : 'pointer'
            }}
            title="Refresh server signatures for all spaces"
          >
            <RefreshCw size={14} className={loadingTokens ? 'animate-spin' : ''} />
            <span>{loadingTokens ? 'Signing...' : 'Sync Tokens'}</span>
          </button>

          {onBackToSetup && (
            <button
              type="button"
              onClick={() => onBackToSetup('general')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Settings size={14} />
              <span>Configure Spaces</span>
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

      {/* MASTER-DETAIL 2-COLUMN GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1.35fr) minmax(340px, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* ================================================================= */}
        {/* LEFT PANEL: CONFIGURED SPACES & INVENTORY MANAGEMENT              */}
        {/* ================================================================= */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          {/* Inventory Count & Search Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                Physical Spaces ({configuredSpaces.length})
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {selectedCount > 0 ? `${selectedCount} selected for bulk print` : 'Click card to preview'}
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by space name, number or seat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.84rem',
                  outline: 'none',
                  background: '#F8FAFC'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            {availableCategories.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: activeCategoryFilter === 'all' ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                    background: activeCategoryFilter === 'all' ? '#0F172A' : '#FFFFFF',
                    color: activeCategoryFilter === 'all' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer'
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
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: activeCategoryFilter === cat.id ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                      background: activeCategoryFilter === cat.id ? '#0F172A' : '#FFFFFF',
                      color: activeCategoryFilter === cat.id ? '#FFFFFF' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label} ({cat.count})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Bulk Selection Toolbar */}
            {filteredSpaces.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#F1F5F9',
                borderRadius: '8px'
              }}>
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
                      cursor: printingBulk ? 'wait' : 'pointer'
                    }}
                  >
                    <Printer size={14} />
                    <span>
                      {printingBulk 
                        ? `Generating (${bulkProgress.current}/${bulkProgress.total})...`
                        : `Bulk Print Selected (${selectedCount})`
                      }
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SPACES LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
            {configuredSpaces.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                <AlertTriangle size={36} color="#D97706" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  No Physical Spaces Configured
                </h3>
                <p style={{ fontSize: '0.84rem', margin: '0 0 16px 0' }}>
                  {isCinema
                    ? 'No cinema screens or seats found in database. Configure seats in Cinema Setup.'
                    : 'Set your total tables, cabins, rooms, or VIP spaces in Restaurant Setup to generate standees.'
                  }
                </p>
                {onBackToSetup && (
                  <button
                    type="button"
                    onClick={() => onBackToSetup('general')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0F172A',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Go to Restaurant Settings
                  </button>
                )}
              </div>
            ) : filteredSpaces.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                No spaces match "{searchQuery}". <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#2563EB', textDecoration: 'underline', cursor: 'pointer' }}>Clear search</button>
              </div>
            ) : (
              filteredSpaces.map(sp => {
                const isSelectedForPrint = selectedSpaceKeys.has(sp.key);
                const isCurrentlyPreviewed = activePreviewKey === sp.key;
                const hasValidToken = Boolean(tokenMap[sp.key] && isValidHmacTokenFormat(tokenMap[sp.key]));

                return (
                  <div
                    key={sp.key}
                    onClick={() => setActivePreviewKey(sp.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: isCurrentlyPreviewed ? '2px solid #0A2315' : '1px solid #E2E8F0',
                      background: isCurrentlyPreviewed ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Checkbox for bulk selection */}
                      <input
                        type="checkbox"
                        checked={isSelectedForPrint}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSpaceSelection(sp.key);
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />

                      <span style={{ fontSize: '1.2rem' }}>{sp.icon}</span>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A' }}>
                            {sp.label}
                          </span>
                          {isCurrentlyPreviewed && (
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              background: '#0A2315',
                              color: '#DFBA67',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              PREVIEWING
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                          {sp.categoryLabel}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Security / Token Status Badge */}
                      {hasValidToken ? (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#059669',
                          background: '#ECFDF5',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #A7F3D0'
                        }}>
                          <ShieldCheck size={12} />
                          <span>HMAC Secured</span>
                        </span>
                      ) : loadingTokens ? (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#D97706',
                          background: '#FFFBEB',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #FDE68A'
                        }}>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Signing...</span>
                        </span>
                      ) : (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#DC2626',
                          background: '#FEF2F2',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #FECACA'
                        }}>
                          <AlertTriangle size={12} />
                          <span>Missing Token</span>
                        </span>
                      )}

                      <ChevronRight size={16} color={isCurrentlyPreviewed ? '#0A2315' : '#CBD5E1'} />
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
        <div style={{
          position: 'sticky',
          top: '20px',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Standee Preview
              </span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '2px 0 0 0' }}>
                {activeSpace ? activeSpace.label : 'Select a Space'}
              </h3>
            </div>

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
            ) : (
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
            )}
          </div>

          {/* REALISTIC STANDEE PREVIEW CONTAINER */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}>
            {/* The Acrylic Card Frame */}
            <div style={{
              width: '280px',
              padding: '20px 14px 16px 14px',
              border: `${STANDEE_FRAMES[selectedFrame]?.borderWidth || '3.5px'} solid ${theme.cardBorder}`,
              borderRadius: STANDEE_FRAMES[selectedFrame]?.borderRadius || '24px',
              backgroundColor: theme.cardBg,
              textAlign: 'center',
              boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
              position: 'relative',
              boxSizing: 'border-box'
            }}>
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
                padding: '4px 14px',
                borderRadius: '18px',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.5px',
                border: `1.5px solid ${theme.badgeBorder}`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                marginBottom: '8px'
              }}>
                ✦ {activeSpace ? activeSpace.badge : 'TABLE NO. 1'} ✦
              </div>

              {/* Restaurant Name */}
              <h3 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '1.1rem',
                fontWeight: 900,
                color: theme.titleColor,
                lineHeight: 1.25,
                margin: '0 0 2px 0'
              }}>
                {currentName}
              </h3>

              {/* Divider */}
              <div style={{ color: theme.dividerColor, fontSize: '0.62rem', letterSpacing: '2px', margin: '2px 0 4px 0' }}>
                ── ◆ ──
              </div>

              {/* Tagline */}
              <div style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.subtitleColor,
                marginBottom: '10px'
              }}>
                {settingsForm?.tagline || (isCinema ? 'IN-SEAT FOOD ORDERING' : 'SCAN QR CODE FOR DIGITAL MENU')}
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
                  fontSize: '0.56rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  SCAN TO ORDER
                </div>

                {activeQrDataUrl ? (
                  <img
                    src={activeQrDataUrl}
                    alt="Standee QR Code"
                    style={{ width: '150px', height: '150px', display: 'block' }}
                  />
                ) : (
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
                    <QrCode size={28} color="#94A3B8" />
                    <span>Signing Token...</span>
                  </div>
                )}
              </div>

              {/* Bilingual Instructions */}
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: theme.instructionEn, marginBottom: '2px' }}>
                📱 POINT CAMERA AT QR TO ORDER
              </div>
              <div style={{ fontSize: '0.66rem', fontWeight: 600, color: theme.instructionHi, marginBottom: '6px' }}>
                {isCinema ? 'स्कैन करें और सीट पर खाना मंगाएं' : 'कैमरे से स्कैन करें और खाना ऑर्डर करें'}
              </div>

              {/* 3-Step Bar */}
              <div style={{
                background: theme.stepBg,
                border: `1px solid ${theme.stepBorder}`,
                color: theme.stepText,
                borderRadius: '6px',
                padding: '3px 4px',
                fontSize: '0.58rem',
                fontWeight: 800,
                marginBottom: '6px'
              }}>
                ① Open Camera &nbsp;➔&nbsp; ② Scan QR &nbsp;➔&nbsp; ③ Order Food
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
              height: '10px',
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 70%)',
              borderRadius: '50%',
              marginTop: '8px'
            }} />
          </div>

          {/* APPEARANCE CUSTOMIZER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
            {/* Theme Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                Theme Palette
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Object.values(STANDEE_THEMES).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTheme(t.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: selectedTheme === t.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                      background: selectedTheme === t.id ? '#F1F5F9' : '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer'
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Style */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                Stand Style
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Object.values(STANDEE_FRAMES).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFrame(f.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: selectedFrame === f.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                      background: selectedFrame === f.id ? '#F1F5F9' : '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer'
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* QR Color Picker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                QR Code Ink
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
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
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      border: qrColor === c.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                      background: qrColor === c.id ? '#F1F5F9' : '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer'
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
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Single Print Button */}
              <button
                type="button"
                onClick={handlePrintSingleStandee}
                disabled={!isActiveTokenReady || !activeQrDataUrl}
                style={{
                  flex: 1,
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
                style={{
                  flex: 1,
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
        </div>

      </div>
    </div>
  );
}
