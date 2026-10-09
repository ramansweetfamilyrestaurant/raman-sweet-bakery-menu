import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  QrCode, 
  Printer, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  ArrowLeft, 
  ShieldCheck, 
  Film, 
  AlertTriangle,
  Search,
  Download,
  Edit,
  Eye,
  Layers,
  Sparkles,
  Smartphone,
  Info,
  Lock,
  RefreshCw,
  FileText,
  CheckCircle,
  CheckCircle2,
  Tag,
  Palette,
  Utensils,
  ChevronDown,
  Share2,
  Globe,
  Sliders,
  MoreVertical,
  X,
  Maximize2
} from 'lucide-react';
import { generateQrToken } from '../../../utils/qrSecurity';
import { getAvailableSpaceTypesForBusiness } from '../../../utils/businessTaxonomy';
import { fetchCinemaScreens, fetchCinemaSeats } from '../../../api/client';
import QRCode from 'qrcode';

export default function QrGeneratorView({
  tableNumber,
  setTableNumber,
  totalTablesCount,
  onAddTable,
  onDeleteTable,
  onPrintQR,
  onPrintAllQRs,
  settingsForm,
  token,
  restaurantInfo,
  capabilities,
  onReturnToMenu,
  onBackToSetup,
  onUpgrade,
  onUpdateSpaceType
}) {
  const [activeTab, setActiveTab] = useState('standees'); // 'standees' | 'space-generator'
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [spaceFilter, setSpaceFilter] = useState('all');
  const [selectedStandeeId, setSelectedStandeeId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStandee, setEditingStandee] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [qrColor, setQrColor] = useState('#000000');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [cornerStyle, setCornerStyle] = useState('rounded');
  const [downloadFormat, setDownloadFormat] = useState('PNG');
  const [downloadResolution, setDownloadResolution] = useState('2048');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Generator form state
  const [genSpaceName, setGenSpaceName] = useState('Main Hall');
  const [genSpaceType, setGenSpaceType] = useState('table');
  const [genDescription, setGenDescription] = useState('');
  const [genQrType, setGenQrType] = useState('menu'); // 'menu' | 'ordering'
  const [genIdentifier, setGenIdentifier] = useState('1');

  const liveOrigin = window.location.origin;
  const activeSlug = settingsForm?.slug || '';
  const isDirectOrderingAvailable = capabilities?.direct_ordering_enabled !== false;

  // 1. Authoritative available physical space types for this business
  const availableSpaceTypes = useMemo(() => {
    return getAvailableSpaceTypesForBusiness(
      settingsForm?.business_type,
      settingsForm?.service_model,
      settingsForm
    );
  }, [
    settingsForm?.business_type,
    settingsForm?.service_model,
    settingsForm?.total_tables,
    settingsForm?.total_cabins,
    settingsForm?.total_rooms,
    settingsForm?.total_vip
  ]);

  const validPrefixIds = useMemo(() => availableSpaceTypes.map(s => s.id), [availableSpaceTypes]);

  // 2. Resolve current space prefix
  const rawPrefix = (
    settingsForm?.table_prefix || 
    (activeSlug ? localStorage.getItem(`touchqr_table_prefix_${activeSlug}`) : null) || 
    validPrefixIds[0] || 
    'table'
  ).toLowerCase();

  const currentPrefix = validPrefixIds.includes(rawPrefix) ? rawPrefix : (validPrefixIds[0] || 'table');
  const isCinema = currentPrefix === 'cinema_seat' || currentPrefix === 'cinema';

  const spaceConfig = useMemo(() => {
    const found = availableSpaceTypes.find(s => s.id === currentPrefix);
    if (found) return found;
    if (isCinema) return { singular: 'Cinema Seat', plural: 'Cinema Seats', badge: 'CINEMA SEAT', param: 'cinema' };
    if (currentPrefix === 'cabin') return { singular: 'Cabin', plural: 'Cabins', badge: 'CABIN NO.', param: 'cabin' };
    if (currentPrefix === 'room') return { singular: 'Room', plural: 'Rooms', badge: 'ROOM NO.', param: 'room' };
    if (currentPrefix === 'vip') return { singular: 'VIP Lounge', plural: 'VIP Lounges', badge: 'VIP LOUNGE', param: 'vip' };
    return { singular: 'Table', plural: 'Tables', badge: 'TABLE NO.', param: 'table' };
  }, [availableSpaceTypes, currentPrefix, isCinema]);

  // 3. Database-driven Cinema Inventory State
  const [cinemaScreens, setCinemaScreens] = useState([]);
  const [cinemaSeats, setCinemaSeats] = useState([]);
  const [loadingCinema, setLoadingCinema] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [selectedRowLabel, setSelectedRowLabel] = useState('');
  const [selectedSeatNum, setSelectedSeatNum] = useState('');

  useEffect(() => {
    if (isCinema && token) {
      setLoadingCinema(true);
      Promise.all([
        fetchCinemaScreens(token).catch(() => ({ success: false, screens: [] })),
        fetchCinemaSeats(token).catch(() => ({ success: false, seats: [] }))
      ]).then(([screensRes, seatsRes]) => {
        const screensList = (screensRes && screensRes.screens) ? screensRes.screens.filter(s => s.active !== false) : [];
        const seatsList = (seatsRes && seatsRes.seats) ? seatsRes.seats.filter(st => st.active !== false) : [];
        setCinemaScreens(screensList);
        setCinemaSeats(seatsList);

        if (screensList.length > 0) {
          const firstScreen = screensList[0];
          setSelectedScreenId(String(firstScreen.id));

          const screenSeats = seatsList.filter(st => String(st.screen_id) === String(firstScreen.id));
          const rows = [...new Set(screenSeats.map(st => st.row_label).filter(Boolean))].sort();
          if (rows.length > 0) {
            setSelectedRowLabel(rows[0]);
            const rowSeats = screenSeats.filter(st => st.row_label === rows[0]).map(st => String(st.seat_number));
            setSelectedSeatNum(rowSeats[0] || '');
          }
        }
      }).finally(() => {
        setLoadingCinema(false);
      });
    }
  }, [isCinema, token, activeSlug]);

  const currentScreenObj = cinemaScreens.find(s => String(s.id) === String(selectedScreenId)) || cinemaScreens[0];
  const screenNum = currentScreenObj ? String(currentScreenObj.screen_number) : '1';

  const totalCinemaSeatsCount = cinemaSeats.filter(st => st.active !== false).length;

  // 4. Space counts
  const spaceCounts = {
    table: Number(settingsForm?.total_tables) || 0,
    cabin: Number(settingsForm?.total_cabins) || 0,
    room: Number(settingsForm?.total_rooms) || 0,
    vip: Number(settingsForm?.total_vip) || 0,
    cinema_seat: totalCinemaSeatsCount
  };

  const currentCount = isCinema ? totalCinemaSeatsCount : (spaceCounts[currentPrefix] !== undefined ? spaceCounts[currentPrefix] : (totalTablesCount || 0));
  const hasTables = isCinema ? totalCinemaSeatsCount > 0 : currentCount > 0;

  const activeTableNum = isCinema 
    ? `S${screenNum}-${selectedRowLabel || 'A'}-${selectedSeatNum || '1'}`
    : (hasTables ? (tableNumber || genIdentifier || '1') : (genIdentifier || '1'));

  const secretKey = settingsForm?.qr_secret || `${settingsForm?.id || 1}_${activeSlug}_tq`;
  
  // Helper to generate full target URL with secure signature
  const buildQrUrl = useCallback((spaceTypeParam, identifier) => {
    const sig = generateQrToken(activeSlug, spaceTypeParam, identifier, secretKey);
    return `${liveOrigin}/${activeSlug}?${spaceTypeParam}=${encodeURIComponent(identifier)}&tkn=${sig}`;
  }, [activeSlug, secretKey, liveOrigin]);

  const currentTargetUrl = buildQrUrl(isCinema ? 'cinema' : spaceConfig.param, activeTableNum);
  const currentQrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentTargetUrl)}`;

  const activeGenSpaceConfig = useMemo(() => {
    const found = availableSpaceTypes.find(s => s.id === genSpaceType);
    if (found) return found;
    if (genSpaceType === 'cinema_seat' || genSpaceType === 'cinema') return { id: 'cinema_seat', label: '🎬 Cinema Seat', singular: 'Cinema Seat', plural: 'Cinema Seats', badge: 'CINEMA SEAT', param: 'cinema' };
    if (genSpaceType === 'cabin') return { id: 'cabin', label: '🛋️ Private Cabin', singular: 'Cabin', plural: 'Cabins', badge: 'CABIN NO.', param: 'cabin' };
    if (genSpaceType === 'room') return { id: 'room', label: '🏨 Hotel Room', singular: 'Room', plural: 'Rooms', badge: 'ROOM NO.', param: 'room' };
    if (genSpaceType === 'vip') return { id: 'vip', label: '👑 VIP Lounge', singular: 'VIP Lounge', plural: 'VIP Lounges', badge: 'VIP LOUNGE', param: 'vip' };
    if (genSpaceType === 'counter') return { id: 'counter', label: '🏪 Billing Counter', singular: 'Counter', plural: 'Counters', badge: 'COUNTER', param: 'table' };
    return { id: 'table', label: '🍽️ Dining Table', singular: 'Table', plural: 'Tables', badge: 'TABLE NO.', param: 'table' };
  }, [availableSpaceTypes, genSpaceType]);

  const genSpaceCount = useMemo(() => {
    if (genSpaceType === 'cinema_seat') return totalCinemaSeatsCount;
    if (genSpaceType === 'counter') return 1;
    return spaceCounts[genSpaceType] || 0;
  }, [genSpaceType, totalCinemaSeatsCount, spaceCounts]);

  const generatorTargetUrl = useMemo(() => {
    const param = (genSpaceType === 'cinema_seat' || genSpaceType === 'cinema') ? 'cinema' : activeGenSpaceConfig.param;
    return buildQrUrl(param, genIdentifier || '1');
  }, [genSpaceType, activeGenSpaceConfig, genIdentifier, activeSlug, secretKey, liveOrigin]);

  // 5. Standee Inventory Management (Dynamic synchronization with physical spaces)
  const defaultStandeesList = useMemo(() => {
    const list = [];
    const tablesCount = Number(settingsForm?.total_tables) || Number(totalTablesCount) || 10;
    const cabinsCount = Number(settingsForm?.total_cabins) || 0;
    const roomsCount = Number(settingsForm?.total_rooms) || 0;
    const vipCount = Number(settingsForm?.total_vip) || 0;

    for (let i = 1; i <= Math.min(tablesCount, 60); i++) {
      list.push({
        id: `standee-table-${i}`,
        name: `Table ${i} Standee`,
        spaceType: 'table',
        spaceLabel: `Main Hall · Table ${i}`,
        identifier: String(i),
        qrType: isDirectOrderingAvailable ? 'ordering' : 'menu',
        status: 'active',
        theme: 'emerald',
        message: 'Scan to browse menu & order',
        lastUpdated: 'Ready'
      });
    }

    for (let i = 1; i <= Math.min(cabinsCount, 20); i++) {
      list.push({
        id: `standee-cabin-${i}`,
        name: `Cabin ${i} Standee`,
        spaceType: 'cabin',
        spaceLabel: `Private Area · Cabin ${i}`,
        identifier: String(i),
        qrType: isDirectOrderingAvailable ? 'ordering' : 'menu',
        status: 'active',
        theme: 'gold',
        message: 'Private dining menu & ordering',
        lastUpdated: 'Ready'
      });
    }

    for (let i = 1; i <= Math.min(roomsCount, 30); i++) {
      list.push({
        id: `standee-room-${i}`,
        name: `Room ${i} Tent Card`,
        spaceType: 'room',
        spaceLabel: `Guest Rooms · Room ${i}`,
        identifier: String(i),
        qrType: 'menu',
        status: 'active',
        theme: 'minimal',
        message: 'Scan for 24/7 in-room dining',
        lastUpdated: 'Ready'
      });
    }

    for (let i = 1; i <= Math.min(vipCount, 15); i++) {
      list.push({
        id: `standee-vip-${i}`,
        name: `VIP Lounge ${i} Standee`,
        spaceType: 'vip',
        spaceLabel: `VIP Lounge · Suite ${i}`,
        identifier: String(i),
        qrType: isDirectOrderingAvailable ? 'ordering' : 'menu',
        status: 'active',
        theme: 'gold',
        message: 'Exclusive VIP Menu & Fast Service',
        lastUpdated: 'Ready'
      });
    }

    // Always include a Billing Counter Standee
    list.push({
      id: 'standee-counter-1',
      name: 'Counter Standee',
      spaceType: 'counter',
      spaceLabel: 'Billing Counter',
      identifier: 'Counter',
      qrType: 'menu',
      status: 'active',
      theme: 'emerald',
      message: 'Scan to view full menu & daily specials',
      lastUpdated: 'Ready'
    });

    return list;
  }, [
    settingsForm?.total_tables,
    settingsForm?.total_cabins,
    settingsForm?.total_rooms,
    settingsForm?.total_vip,
    totalTablesCount,
    isDirectOrderingAvailable
  ]);

  const [standees, setStandees] = useState(() => {
    if (activeSlug) {
      try {
        const saved = localStorage.getItem(`touchqr_standees_${activeSlug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return defaultStandeesList;
  });

  useEffect(() => {
    if (activeSlug && standees.length > 0) {
      try {
        localStorage.setItem(`touchqr_standees_${activeSlug}`, JSON.stringify(standees));
      } catch (e) {}
    }
  }, [standees, activeSlug]);

  // Active preview standee
  const activeStandee = useMemo(() => {
    if (selectedStandeeId) {
      const found = standees.find(s => s.id === selectedStandeeId);
      if (found) return found;
    }
    return standees[0] || {
      id: 'preview-default',
      name: `${spaceConfig.singular} 1 Standee`,
      spaceType: currentPrefix,
      spaceLabel: `Main Hall · ${spaceConfig.singular} 1`,
      identifier: '1',
      qrType: isDirectOrderingAvailable ? 'ordering' : 'menu',
      status: 'active',
      theme: 'emerald',
      message: 'Scan with your phone to view menu & order',
      lastUpdated: 'Ready'
    };
  }, [selectedStandeeId, standees, spaceConfig, currentPrefix, isDirectOrderingAvailable]);

  // Dedicated dynamic Target URL & cryptographic QR for the currently active Standee in preview
  const activeStandeeTargetUrl = useMemo(() => {
    if (!activeStandee) return currentTargetUrl;
    let param = 'table';
    if (activeStandee.spaceType === 'cinema_seat' || activeStandee.spaceType === 'cinema') param = 'cinema';
    else if (activeStandee.spaceType === 'cabin') param = 'cabin';
    else if (activeStandee.spaceType === 'room') param = 'room';
    else if (activeStandee.spaceType === 'vip') param = 'vip';
    else if (activeStandee.spaceType === 'counter') param = 'table';
    else {
      const matched = availableSpaceTypes.find(s => s.id === activeStandee.spaceType);
      param = matched?.param || 'table';
    }
    return buildQrUrl(param, activeStandee.identifier || '1');
  }, [activeStandee, buildQrUrl, availableSpaceTypes, currentTargetUrl]);

  // Native, ultra-sharp local QR generation via qrcode engine (0 network lag, 0 blur, 0 CORS)
  const [activeStandeeDataUrl, setActiveStandeeDataUrl] = useState('');
  const [generatorDataUrl, setGeneratorDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (activeStandeeTargetUrl) {
      QRCode.toDataURL(activeStandeeTargetUrl, {
        width: 1000,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark: (activeStandee?.theme === 'slate') ? '#0F172A' : (qrColor || '#000000'),
          light: '#FFFFFF'
        }
      }).then(url => {
        if (!cancelled) setActiveStandeeDataUrl(url);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [activeStandeeTargetUrl, qrColor, activeStandee?.theme]);

  useEffect(() => {
    let cancelled = false;
    if (generatorTargetUrl) {
      QRCode.toDataURL(generatorTargetUrl, {
        width: 1000,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark: qrColor || '#000000',
          light: '#FFFFFF'
        }
      }).then(url => {
        if (!cancelled) setGeneratorDataUrl(url);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [generatorTargetUrl, qrColor]);

  const activeStandeeQrImgUrl = activeStandeeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(activeStandeeTargetUrl)}`;
  const generatorQrImgUrl = generatorDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(generatorTargetUrl)}`;

  // Filtered Standees
  const filteredStandees = useMemo(() => {
    return standees.filter(st => {
      const matchesSearch = !searchQuery || 
        String(st.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        String(st.spaceLabel || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(st.identifier || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || st.status === statusFilter;
      const matchesSpace = spaceFilter === 'all' || st.spaceType === spaceFilter;

      return matchesSearch && matchesStatus && matchesSpace;
    });
  }, [standees, searchQuery, statusFilter, spaceFilter]);

  const totalStandeesCount = standees.length;
  const activeStandeesCount = standees.filter(s => s.status === 'active').length;
  const inactiveStandeesCount = totalStandeesCount - activeStandeesCount;

  // Handlers
  const handleSpaceTypeClick = (typeId) => {
    if (activeSlug) {
      localStorage.setItem(`touchqr_table_prefix_${activeSlug}`, typeId);
    }
    if (onUpdateSpaceType) {
      onUpdateSpaceType(typeId);
    }
  };

  const handleCopyLink = () => {
    const target = activeTab === 'space-generator' ? generatorTargetUrl : activeStandeeTargetUrl;
    navigator.clipboard.writeText(target);
    setCopied(true);
    showToast('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Download ONLY the crisp original QR Code (Square PNG for table stickers, menu inserts, acrylic stands)
  // Bulletproof, zero-block print engine using hidden iframe
  const handlePrintStandee = async (targetStandee = null) => {
    const isGenerator = activeTab === 'space-generator';
    const currentStandee = targetStandee || (isGenerator ? null : activeStandee);
    const identifierLabel = isGenerator ? genIdentifier : (currentStandee?.identifier || '1');
    const spaceType = isGenerator ? genSpaceType : (currentStandee?.spaceType || 'table');
    const targetUrl = isGenerator ? generatorTargetUrl : buildQrUrl(
      (spaceType === 'cinema_seat' || spaceType === 'cinema') ? 'cinema' : (spaceType === 'cabin' ? 'cabin' : spaceType === 'room' ? 'room' : spaceType === 'vip' ? 'vip' : 'table'),
      identifierLabel
    );

    const currentName = settingsForm?.name || restaurantInfo?.name || 'Raman Sweet Bakery & Family Restaurant';
    const currentTagline = settingsForm?.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu');
    const currentAddress = settingsForm?.address || restaurantInfo?.address || '';
    const currentPhone = settingsForm?.phone || restaurantInfo?.phone || '';
    const isCinemaMode = isGenerator ? isCinema : (spaceType === 'cinema_seat');
    const standeeMsg = isGenerator ? genDescription : (currentStandee?.message || '');
    const showWatermark = !settingsForm?.watermark_removal_enabled;

    // Accurate badge text
    let badgeText = '';
    if (spaceType === 'counter') {
      badgeText = 'BILLING COUNTER';
    } else if (isCinemaMode) {
      const match = String(identifierLabel).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i);
      badgeText = match ? `SCREEN ${match[1]} • ROW ${match[2].toUpperCase()} • SEAT ${match[3]}` : `CINEMA SEAT ${identifierLabel}`;
    } else {
      const rawType = String(spaceType).toUpperCase();
      const typeWord = rawType === 'CABIN' ? 'CABIN' : rawType === 'VIP' ? 'VIP LOUNGE' : rawType === 'ROOM' ? 'ROOM' : 'TABLE';
      badgeText = `${typeWord} NO. ${identifierLabel}`;
    }

    // High resolution pitch-black QR code
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 900,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    } catch (e) {
      console.warn('QRCode generation fallback:', e);
      qrDataUrl = isGenerator ? generatorQrImgUrl : activeStandeeQrImgUrl;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${currentName} - ${badgeText} QR Standee</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
            @page {
              size: auto;
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 24px;
              background-color: #F8FAFC;
              font-family: 'Plus Jakarta Sans', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .standee-card {
              width: 320px;
              padding: 30px 22px 24px 22px;
              border: 3.5px solid #D4AF37;
              border-radius: 26px;
              background: #FFFFFF;
              text-align: center;
              box-shadow: 0 10px 30px rgba(10,35,21,0.08);
              position: relative;
              box-sizing: border-box;
            }
            .inner-frame {
              position: absolute;
              top: 7px;
              left: 7px;
              right: 7px;
              bottom: 7px;
              border: 1.5px solid #E5C07B;
              border-radius: 20px;
              pointer-events: none;
            }
            .table-badge {
              display: inline-block;
              background: #0A2315;
              color: #DFBA67;
              padding: 6px 18px;
              border-radius: 22px;
              font-size: 0.82rem;
              font-weight: 800;
              letter-spacing: 0.5px;
              border: 1.5px solid #D4AF37;
              box-shadow: 0 3px 10px rgba(10,35,21,0.15);
              margin-bottom: 12px;
            }
            .logo-title {
              font-family: 'Playfair Display', Georgia, serif;
              font-size: 1.25rem;
              font-weight: 900;
              color: #0A2315;
              letter-spacing: -0.3px;
              line-height: 1.2;
              margin: 0 0 4px 0;
            }
            .gold-divider {
              color: #D4AF37;
              font-size: 0.72rem;
              letter-spacing: 3px;
              margin: 4px 0 6px 0;
            }
            .subtitle {
              font-size: 0.72rem;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              color: #15803D;
              margin-bottom: 14px;
            }
            .qr-box {
              background: #FFFFFF;
              padding: 14px;
              border-radius: 18px;
              border: 1.5px solid #E2E8F0;
              display: inline-block;
              margin-bottom: 12px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.06);
              position: relative;
            }
            .scan-pill {
              position: absolute;
              top: -11px;
              left: 50%;
              transform: translateX(-50%);
              background: #0A2315;
              color: #DFBA67;
              font-size: 0.62rem;
              font-weight: 900;
              padding: 2px 10px;
              border-radius: 10px;
              border: 1px solid #D4AF37;
              white-space: nowrap;
            }
            .qr-box img {
              width: 190px;
              height: 190px;
              display: block;
            }
            .instruction-en {
              font-size: 0.88rem;
              font-weight: 800;
              color: #0A2315;
              letter-spacing: 0.4px;
              margin-bottom: 2px;
            }
            .instruction-hi {
              font-size: 0.76rem;
              font-weight: 600;
              color: #64748B;
              margin-bottom: 8px;
            }
            .steps-bar {
              background: #FAF8F5;
              border: 1px solid #EAE5DF;
              border-radius: 10px;
              padding: 5px 8px;
              font-size: 0.66rem;
              font-weight: 800;
              color: #334155;
              margin-bottom: 6px;
            }
            .reassurance {
              font-size: 0.65rem;
              font-weight: 800;
              color: #059669;
              margin-bottom: 8px;
            }
            .greet-msg {
              font-size: 0.70rem;
              font-style: italic;
              color: #475569;
              margin-bottom: 8px;
              padding: 3px 8px;
              background: #FAF8F5;
              border-radius: 8px;
              border: 1px solid #EAE5DF;
            }
            .footer-info {
              border-top: 1px solid #F1F5F9;
              padding-top: 10px;
              font-size: 0.68rem;
              color: #94A3B8;
              line-height: 1.4;
            }
            @media print {
              body {
                background: none !important;
                padding: 0 !important;
              }
              .standee-card {
                box-shadow: none !important;
                border: 3.5px solid #D4AF37 !important;
                margin: 0 auto !important;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="inner-frame"></div>
            <div class="table-badge">✦ ${badgeText} ✦</div>
            <h1 class="logo-title">${currentName}</h1>
            <div class="gold-divider">── ◆ ──</div>
            <div class="subtitle">${currentTagline}</div>
            <div class="qr-box">
              <div class="scan-pill">${isCinemaMode ? '📷 SCAN FOR FOOD' : '📷 SCAN TO ORDER'}</div>
              <img src="${qrDataUrl}" alt="${badgeText} QR Code" />
            </div>
            <div class="instruction-en">📱 POINT CAMERA AT QR TO ORDER</div>
            <div class="instruction-hi">कैमरे से स्कैन करें और खाना ऑर्डर करें</div>
            <div class="steps-bar">① Open Camera &nbsp;➔&nbsp; ② Scan QR &nbsp;➔&nbsp; ③ Order Food</div>
            <div class="reassurance">✓ 100% Free • No App Required • Fast & Direct</div>
            ${standeeMsg ? `<div class="greet-msg">"${standeeMsg}"</div>` : ''}
            <div class="footer-info">
              ${currentAddress ? `<div>📍 ${currentAddress}</div>` : ''}
              ${currentPhone ? `<div style="font-weight: 700; color: #0A2315;">📞 Phone: ${currentPhone}</div>` : ''}
              ${showWatermark ? `<div style="margin-top: 3px; font-size: 0.62rem; color: #15803D; font-weight: 800;">⚡ Powered by TouchQR</div>` : ''}
            </div>
          </div>
        </body>
      </html>
    `;

    // Off-screen, zero-block, high-reliability print iframe
    const existingFrame = document.getElementById('touchqr-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'touchqr-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '800px';
    iframe.style.height = '1000px';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    showToast(`Opening Print Dialog for ${badgeText}...`);

    const triggerPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Print iframe error, attempting popup fallback:', err);
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(htmlContent);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 350);
        }
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 10000);
      }
    };

    setTimeout(triggerPrint, 350);
  };

  const handleDownloadPureQr = async () => {
    const isGenerator = activeTab === 'space-generator';
    const identifierLabel = isGenerator ? genIdentifier : (activeStandee?.identifier || '1');
    const targetUrl = isGenerator ? generatorTargetUrl : activeStandeeTargetUrl;
    const targetSize = Number(downloadResolution) || 2048;

    try {
      const pureDataUrl = await QRCode.toDataURL(targetUrl, {
        width: targetSize,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: (activeTab === 'standees' && activeStandee?.theme === 'slate') ? '#0F172A' : (qrColor || '#000000'),
          light: '#FFFFFF'
        }
      });

      const link = document.createElement('a');
      link.download = `${activeSlug}_${identifierLabel}_original_qr_${targetSize}x${targetSize}.png`;
      link.href = pureDataUrl;
      link.click();
      showToast(`✓ Original QR Code (${targetSize}x${targetSize}px) downloaded!`);
    } catch (e) {
      console.error('Error generating pure QR:', e);
      const a = document.createElement('a');
      a.href = isGenerator ? generatorQrImgUrl : activeStandeeQrImgUrl;
      a.download = `${activeSlug}_${identifierLabel}_qr.png`;
      a.click();
      showToast('QR Code downloaded!');
    }
  };

  const handleDownloadQr = async (format = 'PNG') => {
    const isGenerator = activeTab === 'space-generator';
    const identifierLabel = isGenerator ? genIdentifier : (activeStandee?.identifier || '1');
    const targetUrl = isGenerator ? generatorTargetUrl : activeStandeeTargetUrl;
    const currentName = settingsForm?.name || restaurantInfo?.name || 'Raman Sweet Bakery & Family Restaurant';
    const currentTagline = settingsForm?.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu');
    const currentAddress = settingsForm?.address || restaurantInfo?.address || '';
    const currentPhone = settingsForm?.phone || restaurantInfo?.phone || '';
    const isCinemaMode = isGenerator ? isCinema : (activeStandee?.spaceType === 'cinema_seat');
    const standeeMsg = isGenerator ? genDescription : activeStandee?.message;

    // Smart, accurate badge text (e.g. TABLE NO. 15, BILLING COUNTER, CABIN NO. 2)
    let badgeText = '';
    if (isGenerator) {
      if (genSpaceType === 'counter') {
        badgeText = 'BILLING COUNTER';
      } else if (isCinema) {
        const match = String(genIdentifier).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i);
        badgeText = match ? `SCREEN ${match[1]} • ROW ${match[2].toUpperCase()} • SEAT ${match[3]}` : `CINEMA SEAT ${genIdentifier}`;
      } else {
        const typeWord = (activeGenSpaceConfig?.singular || 'Table').toUpperCase();
        badgeText = `${typeWord} NO. ${genIdentifier}`;
      }
    } else {
      if (activeStandee?.spaceType === 'counter') {
        badgeText = 'BILLING COUNTER';
      } else if (activeStandee?.spaceType === 'cinema_seat') {
        badgeText = activeStandee?.spaceLabel || `CINEMA SEAT ${activeStandee?.identifier || '1'}`;
      } else {
        const rawType = (activeStandee?.spaceType || 'table').toUpperCase();
        const typeWord = rawType === 'CABIN' ? 'CABIN' : rawType === 'VIP' ? 'VIP LOUNGE' : rawType === 'ROOM' ? 'ROOM' : 'TABLE';
        badgeText = `${typeWord} NO. ${activeStandee?.identifier || identifierLabel}`;
      }
    }

    const isDarkTheme = (!isGenerator && activeStandee?.theme === 'slate');
    const effectiveQrColor = isDarkTheme ? '#0F172A' : (qrColor || '#000000');
    const showWatermark = !settingsForm?.watermark_removal_enabled;

    try {
      // 0. Ensure custom fonts are loaded so canvas doesn't default to Arial/Times New Roman
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {}
      }

      // 1. Generate ultra-crisp 1200x1200 native QR code locally (Level H error correction)
      const nativeQrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 1200,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark: effectiveQrColor,
          light: '#FFFFFF'
        }
      });

      // 2. Standard 2:3 physical acrylic standee print ratio (4" x 6" / A6 standard 300 DPI)
      // Base canvas size: 1200 x 1800 px (exact 2:3 ratio)
      const baseWidth = 1200;
      const baseHeight = 1800;

      const canvas = document.createElement('canvas');
      canvas.width = baseWidth;
      canvas.height = baseHeight;
      const ctx = canvas.getContext('2d');

      // Fill canvas background
      ctx.fillStyle = isDarkTheme ? '#0F172A' : '#FFFFFF';
      ctx.fillRect(0, 0, baseWidth, baseHeight);

      // Subtle textured gradient for luxury paper feel
      if (!isDarkTheme) {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, baseHeight);
        bgGrad.addColorStop(0, '#FFFFFF');
        bgGrad.addColorStop(0.4, '#FDFBF7');
        bgGrad.addColorStop(1, '#F8F5EE');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, baseWidth, baseHeight);
      }

      // 3. Double Royal Gold Foil Border
      const margin = 36;
      const cardW = baseWidth - margin * 2;
      const cardH = baseHeight - margin * 2;
      const outerRadius = 38;

      // Outer Gold Frame
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(margin, margin, cardW, cardH, outerRadius);
      } else {
        ctx.rect(margin, margin, cardW, cardH);
      }
      ctx.strokeStyle = isDarkTheme ? '#334155' : '#D4AF37';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Inner Gold Hairline Frame
      const innerMargin = margin + 14;
      const innerW = baseWidth - innerMargin * 2;
      const innerH = baseHeight - innerMargin * 2;
      const innerRadius = 26;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(innerMargin, innerMargin, innerW, innerH, innerRadius);
      } else {
        ctx.rect(innerMargin, innerMargin, innerW, innerH);
      }
      ctx.strokeStyle = isDarkTheme ? '#475569' : '#E5C07B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Four Ornate Gold Corner Diamonds
      const cornerInset = innerMargin + 18;
      const drawDiamond = (cx, cy, s) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s, cy);
        ctx.closePath();
        ctx.fillStyle = isDarkTheme ? '#94A3B8' : '#D4AF37';
        ctx.fill();
      };
      drawDiamond(cornerInset, cornerInset, 8);
      drawDiamond(baseWidth - cornerInset, cornerInset, 8);
      drawDiamond(cornerInset, baseHeight - cornerInset, 8);
      drawDiamond(baseWidth - cornerInset, baseHeight - cornerInset, 8);
      ctx.restore();

      // =========================================================================
      // SECTION 1: HEADER & RESTAURANT BRANDING (Y: 80 to 380)
      // =========================================================================
      // Top Table / Space Badge
      const badgeY = 82;
      const badgeH = 56;
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      const badgeTextUpper = `✦ ${badgeText.toUpperCase()} ✦`;
      const badgeMetrics = ctx.measureText(badgeTextUpper);
      const badgeW = Math.max(badgeMetrics.width + 72, 320);
      const badgeX = (baseWidth - badgeW) / 2;

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 28);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fillStyle = isDarkTheme ? '#1E293B' : '#0A2315';
      ctx.fill();
      ctx.strokeStyle = isDarkTheme ? '#475569' : '#D4AF37';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = isDarkTheme ? '#F8FAFC' : '#DFBA67';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeTextUpper, baseWidth / 2, badgeY + badgeH / 2);
      ctx.restore();

      // Restaurant Name (Playfair Luxury Serif)
      ctx.fillStyle = isDarkTheme ? '#FFFFFF' : '#0A2315';
      ctx.font = 'bold 50px "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // Text wrapping for name
      const nameWords = currentName.split(' ');
      let nameLine = '';
      const nameLines = [];
      for (let n = 0; n < nameWords.length; n++) {
        const testLine = nameLine + nameWords[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 900 && n > 0) {
          nameLines.push(nameLine.trim());
          nameLine = nameWords[n] + ' ';
        } else {
          nameLine = testLine;
        }
      }
      nameLines.push(nameLine.trim());

      let currentTextY = 195;
      for (let i = 0; i < nameLines.length; i++) {
        ctx.fillText(nameLines[i], baseWidth / 2, currentTextY);
        currentTextY += 58;
      }

      // Decorative Gold Divider with Center Diamond
      ctx.save();
      const divLineY = currentTextY - 6;
      ctx.strokeStyle = isDarkTheme ? '#475569' : '#D4AF37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseWidth / 2 - 140, divLineY);
      ctx.lineTo(baseWidth / 2 - 22, divLineY);
      ctx.moveTo(baseWidth / 2 + 22, divLineY);
      ctx.lineTo(baseWidth / 2 + 140, divLineY);
      ctx.stroke();
      drawDiamond(baseWidth / 2, divLineY, 7);
      ctx.restore();

      // Tagline
      ctx.fillStyle = isDarkTheme ? '#94A3B8' : '#15803D';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(currentTagline, baseWidth / 2, currentTextY + 28);

      // =========================================================================
      // SECTION 2: HERO QR PLAQUE (Y: 395 to 1120)
      // =========================================================================
      const qrPlaqueW = 680;
      const qrPlaqueH = 710;
      const qrPlaqueX = (baseWidth - qrPlaqueW) / 2;
      const qrPlaqueY = 395;

      // QR Plaque White Card with soft border and shadow
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(qrPlaqueX, qrPlaqueY, qrPlaqueW, qrPlaqueH, 32);
      } else {
        ctx.rect(qrPlaqueX, qrPlaqueY, qrPlaqueW, qrPlaqueH);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.09)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(qrPlaqueX, qrPlaqueY, qrPlaqueW, qrPlaqueH, 32);
      } else {
        ctx.rect(qrPlaqueX, qrPlaqueY, qrPlaqueW, qrPlaqueH);
      }
      ctx.strokeStyle = isDarkTheme ? '#475569' : '#E2E8F0';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // "SCAN TO ORDER" Banner INSIDE Plaque at top
      const scanBannerText = isCinemaMode ? '📷 SCAN FOR IN-SEAT FOOD' : '📷 SCAN TO ORDER & PAY';
      ctx.save();
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      const scanBannerW = ctx.measureText(scanBannerText).width + 48;
      const scanBannerH = 42;
      const scanBannerX = (baseWidth - scanBannerW) / 2;
      const scanBannerY = qrPlaqueY + 24;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(scanBannerX, scanBannerY, scanBannerW, scanBannerH, 21);
      } else {
        ctx.rect(scanBannerX, scanBannerY, scanBannerW, scanBannerH);
      }
      ctx.fillStyle = isDarkTheme ? '#1E293B' : '#0A2315';
      ctx.fill();
      ctx.strokeStyle = isDarkTheme ? '#475569' : '#D4AF37';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = isDarkTheme ? '#F8FAFC' : '#DFBA67';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(scanBannerText, baseWidth / 2, scanBannerY + scanBannerH / 2);
      ctx.restore();

      // Large 530x530 Crisp QR Code Image
      const qrImgSize = 530;
      const qrImgX = (baseWidth - qrImgSize) / 2;
      const qrImgY = scanBannerY + scanBannerH + 20;

      const qrImgEl = new Image();
      qrImgEl.src = nativeQrDataUrl;
      await new Promise((resolve) => {
        qrImgEl.onload = () => {
          ctx.drawImage(qrImgEl, qrImgX, qrImgY, qrImgSize, qrImgSize);
          resolve();
        };
        qrImgEl.onerror = resolve;
        setTimeout(resolve, 1500);
      });

      // Gold Camera Target Focus Corner Brackets ⌜ ⌝ ⌞ ⌟
      ctx.save();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      const bLen = 32;
      const bPad = 12;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(qrImgX - bPad, qrImgY - bPad + bLen);
      ctx.lineTo(qrImgX - bPad, qrImgY - bPad);
      ctx.lineTo(qrImgX - bPad + bLen, qrImgY - bPad);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(qrImgX + qrImgSize + bPad - bLen, qrImgY - bPad);
      ctx.lineTo(qrImgX + qrImgSize + bPad, qrImgY - bPad);
      ctx.lineTo(qrImgX + qrImgSize + bPad, qrImgY - bPad + bLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(qrImgX - bPad, qrImgY + qrImgSize + bPad - bLen);
      ctx.lineTo(qrImgX - bPad, qrImgY + qrImgSize + bPad);
      ctx.lineTo(qrImgX - bPad + bLen, qrImgY + qrImgSize + bPad);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(qrImgX + qrImgSize + bPad - bLen, qrImgY + qrImgSize + bPad);
      ctx.lineTo(qrImgX + qrImgSize + bPad, qrImgY + qrImgSize + bPad);
      ctx.lineTo(qrImgX + qrImgSize + bPad, qrImgY + qrImgSize + bPad - bLen);
      ctx.stroke();
      ctx.restore();

      // Subtle Scan instruction at bottom of plaque
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Point your phone camera here • No app required', baseWidth / 2, qrPlaqueY + qrPlaqueH - 26);

      // =========================================================================
      // SECTION 3: CALL TO ACTION & HINDI INSTRUCTIONS (Y: 1145 to 1250)
      // =========================================================================
      let curSectionY = 1160;
      ctx.fillStyle = isDarkTheme ? '#F1F5F9' : '#0A2315';
      ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(isCinemaMode ? '📱 POINT CAMERA AT QR TO ORDER' : '📱 POINT CAMERA AT QR TO ORDER & PAY', baseWidth / 2, curSectionY);

      curSectionY += 36;
      ctx.fillStyle = isDarkTheme ? '#94A3B8' : '#475569';
      ctx.font = 'bold 23px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(isCinemaMode ? 'कैमरा से स्कैन करें और सीट पर खाना मंगाएं' : 'कैमरे से स्कैन करें और स्वादिष्ट खाना ऑर्डर करें', baseWidth / 2, curSectionY);

      curSectionY += 32;
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 19px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Instant Digital Menu • Table Ordering • Cashless Payments', baseWidth / 2, curSectionY);

      // =========================================================================
      // SECTION 4: 3-STEP VISUAL INFOGRAPHIC CARDS (Y: 1280 to 1380)
      // =========================================================================
      const stepBoxW = 960;
      const stepBoxH = 88;
      const stepBoxX = (baseWidth - stepBoxW) / 2;
      const stepBoxY = 1275;

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(stepBoxX, stepBoxY, stepBoxW, stepBoxH, 20);
      } else {
        ctx.rect(stepBoxX, stepBoxY, stepBoxW, stepBoxH);
      }
      ctx.fillStyle = isDarkTheme ? 'rgba(255,255,255,0.06)' : '#FAF8F5';
      ctx.fill();
      ctx.strokeStyle = isDarkTheme ? '#334155' : '#EAE5DF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3 Step columns
      // Step 1
      const col1X = stepBoxX + 160;
      ctx.fillStyle = '#0A2315';
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('① OPEN CAMERA', col1X, stepBoxY + 36);
      ctx.fillStyle = '#64748B';
      ctx.font = '15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Open phone camera app', col1X, stepBoxY + 62);

      // Arrow 1
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('➔', stepBoxX + 325, stepBoxY + 48);

      // Step 2
      const col2X = stepBoxX + 480;
      ctx.fillStyle = '#0A2315';
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('② SCAN QR CODE', col2X, stepBoxY + 36);
      ctx.fillStyle = '#64748B';
      ctx.font = '15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Point at code on table', col2X, stepBoxY + 62);

      // Arrow 2
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('➔', stepBoxX + 635, stepBoxY + 48);

      // Step 3
      const col3X = stepBoxX + 800;
      ctx.fillStyle = '#0A2315';
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('③ BROWSE & ORDER', col3X, stepBoxY + 36);
      ctx.fillStyle = '#64748B';
      ctx.font = '15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Select food & enjoy', col3X, stepBoxY + 62);
      ctx.restore();

      // =========================================================================
      // SECTION 5: HOSPITALITY GREETING CARD (Y: 1390 to 1495)
      // =========================================================================
      const greetBoxW = 960;
      const greetBoxH = 82;
      const greetBoxX = (baseWidth - greetBoxW) / 2;
      const greetBoxY = 1385;

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(greetBoxX, greetBoxY, greetBoxW, greetBoxH, 16);
      } else {
        ctx.rect(greetBoxX, greetBoxY, greetBoxW, greetBoxH);
      }
      ctx.fillStyle = isDarkTheme ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = isDarkTheme ? '#334155' : '#EAE5DF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const msgToDisplay = standeeMsg || 'Welcome to our restaurant! Please scan the QR code to explore our delicious menu and place your order.';
      ctx.fillStyle = isDarkTheme ? '#CBD5E1' : '#334155';
      ctx.font = 'italic 20px "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(`"${msgToDisplay}"`, baseWidth / 2, greetBoxY + 34);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('✓ 100% Free • No App Download Required • Safe & Contactless', baseWidth / 2, greetBoxY + 60);
      ctx.restore();

      // =========================================================================
      // SECTION 6: FOOTER CONTACT & DETAILS (Y: 1515 to 1730)
      // =========================================================================
      const footerDividerY = 1510;
      ctx.save();
      ctx.strokeStyle = isDarkTheme ? '#334155' : '#D4AF37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(140, footerDividerY);
      ctx.lineTo(baseWidth / 2 - 20, footerDividerY);
      ctx.moveTo(baseWidth / 2 + 20, footerDividerY);
      ctx.lineTo(baseWidth - 140, footerDividerY);
      ctx.stroke();
      drawDiamond(baseWidth / 2, footerDividerY, 6);
      ctx.restore();

      let footerTextY = 1555;
      if (currentAddress) {
        ctx.fillStyle = isDarkTheme ? '#CBD5E1' : '#334155';
        ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`📍 ${currentAddress}`, baseWidth / 2, footerTextY);
        footerTextY += 40;
      }

      if (currentPhone) {
        ctx.fillStyle = isDarkTheme ? '#F8FAFC' : '#0A2315';
        ctx.font = 'bold 23px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`📞 Phone / WhatsApp: ${currentPhone}`, baseWidth / 2, footerTextY);
        footerTextY += 38;
      }

      ctx.fillStyle = isDarkTheme ? '#94A3B8' : '#64748B';
      ctx.font = '17px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Fresh Food Prepared Daily • Dine-In & Takeaway Available', baseWidth / 2, footerTextY);
      footerTextY += 34;

      if (showWatermark) {
        ctx.fillStyle = '#15803D';
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ TouchQR • Smart Contactless Dining Experience', baseWidth / 2, footerTextY);
      }

      // =========================================================================
      // SECTION 7: SCALING & EXPORT TO STANDARD PRINT SIZES
      // =========================================================================
      const resolutionMap = {
        '1024': 1200, // 1200 x 1800 px (4x6" standard)
        '2048': 1600, // 1600 x 2400 px (5x7" / A5 HD)
        '4096': 2400  // 2400 x 3600 px (8x12" / A4 Studio 300 DPI)
      };
      const targetWidth = resolutionMap[downloadResolution] || 1600;
      const targetHeight = Math.round(targetWidth * 1.5); // exact 2:3 ratio

      let finalCanvas = canvas;
      if (targetWidth !== baseWidth) {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.imageSmoothingEnabled = true;
        exportCtx.imageSmoothingQuality = 'high';
        exportCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
        finalCanvas = exportCanvas;
      }

      // Trigger Download
      const link = document.createElement('a');
      link.download = `${activeSlug}_${identifierLabel}_standee_${targetWidth}x${targetHeight}.${format.toLowerCase()}`;
      link.href = finalCanvas.toDataURL(format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg' ? 'image/jpeg' : 'image/png');
      link.click();
      showToast(`✓ Standee Card downloaded (${targetWidth}x${targetHeight}px PNG - Standard 4x6" Ratio)`);
    } catch (e) {
      console.error('Error rendering standee PNG:', e);
      const a = document.createElement('a');
      a.href = isGenerator ? generatorQrImgUrl : activeStandeeQrImgUrl;
      a.download = `${activeSlug}_${identifierLabel}_qr.png`;
      a.target = '_blank';
      a.click();
      showToast(`QR Code downloaded for ${identifierLabel}`);
    }
  };

  const handleToggleStandeeStatus = (standeeId) => {
    setStandees(prev => prev.map(s => {
      if (s.id === standeeId) {
        return { ...s, status: s.status === 'active' ? 'inactive' : 'active' };
      }
      return s;
    }));
  };

  const handleDeleteStandee = (standeeId) => {
    setStandees(prev => {
      const target = prev.find(s => s.id === standeeId);
      const next = prev.filter(s => s.id !== standeeId);
      if (target) {
        showToast(`Standee "${target.name}" removed successfully`);
      }
      return next;
    });
  };

  const handleSaveModalStandee = (formData) => {
    if (editingStandee) {
      setStandees(prev => prev.map(s => s.id === editingStandee.id ? { ...s, ...formData, lastUpdated: 'Just now' } : s));
    } else {
      const newStandee = {
        id: `standee-${Date.now()}`,
        ...formData,
        status: 'active',
        lastUpdated: 'Just now'
      };
      setStandees(prev => [newStandee, ...prev]);
      setSelectedStandeeId(newStandee.id);
    }
    setShowCreateModal(false);
    setEditingStandee(null);
  };

  const handleCreateStandeeFromGenerator = () => {
    const spaceDisplayLabel = genSpaceType === 'counter' 
      ? 'Billing Counter' 
      : `${genSpaceName} · ${activeGenSpaceConfig.singular} ${genIdentifier}`;
      
    // Prevent duplicate standee record
    const existingIndex = standees.findIndex(s => s.spaceType === genSpaceType && String(s.identifier) === String(genIdentifier));
    
    if (existingIndex >= 0) {
      const updated = [...standees];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qrType: genQrType,
        theme: qrColor === '#D97706' ? 'gold' : qrColor === '#0F172A' ? 'slate' : 'emerald',
        message: genDescription || updated[existingIndex].message,
        lastUpdated: 'Just now'
      };
      setStandees(updated);
      setSelectedStandeeId(updated[existingIndex].id);
      setActiveTab('standees');
      showToast(`✓ Standee updated for ${activeGenSpaceConfig.singular} ${genIdentifier}!`);
    } else {
      const newStandee = {
        id: `standee-gen-${Date.now()}`,
        name: `${activeGenSpaceConfig.singular} ${genIdentifier} Standee`,
        spaceType: genSpaceType,
        spaceLabel: spaceDisplayLabel,
        identifier: String(genIdentifier),
        qrType: genQrType,
        status: 'active',
        theme: qrColor === '#D97706' ? 'gold' : qrColor === '#0F172A' ? 'slate' : 'emerald',
        message: genDescription || 'Scan to view menu & place orders',
        lastUpdated: 'Just now'
      };
      setStandees(prev => [newStandee, ...prev]);
      setSelectedStandeeId(newStandee.id);
      setActiveTab('standees');
      showToast(`✓ Standee created for ${activeGenSpaceConfig.singular} ${genIdentifier}!`);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      maxWidth: '1180px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          background: '#064E3B',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(6, 78, 59, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.86rem',
          fontWeight: 700,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle size={18} color="#34D399" />
          <span>{toastMessage}</span>
        </div>
      )}
      {/* Responsive Styles */}
      <style>{`
        .touchqr-two-col-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr);
          gap: 16px;
          align-items: flex-start;
          width: 100%;
          box-sizing: border-box;
        }
        .touchqr-data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.82rem;
        }
        .touchqr-data-table th {
          background: #FAF8F5;
          color: #64748B;
          font-weight: 800;
          font-size: 0.70rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px 14px;
          border-bottom: 1px solid #EAE5DF;
          text-align: left;
        }
        .touchqr-data-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #F1F5F9;
          color: #0F172A;
          vertical-align: middle;
        }
        .touchqr-data-table tr:hover td {
          background: #FAF8F5;
        }
        .mobile-standees-list {
          display: none;
        }
        @media (max-width: 960px) {
          .touchqr-two-col-grid {
            grid-template-columns: 100% !important;
            gap: 14px !important;
          }
          .desktop-table-container {
            display: none !important;
          }
          .mobile-standees-list {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>

      {/* MASTER TOP HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        boxSizing: 'border-box',
        width: '100%',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBackToSetup && (
            <button
              type="button"
              onClick={() => onBackToSetup(isCinema ? 'cinema' : null)}
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#0F172A',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '0.78rem',
                fontWeight: 800
              }}
            >
              <ArrowLeft size={16} />
              <span>Settings</span>
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.20rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              {activeTab === 'standees' ? 'QR Standee Management' : 'Space QR Generator'}
            </h2>
            <p style={{ fontSize: '0.74rem', color: '#64748B', margin: 0 }}>
              {activeTab === 'standees'
                ? 'Create, customize and manage QR standees for your business.'
                : 'Create a unique QR code for any table, room, zone or space.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Segmented View Switcher */}
          <div style={{
            display: 'flex',
            background: '#FAF8F5',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid #EAE5DF'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('standees')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'standees' ? '#064E3B' : 'transparent',
                color: activeTab === 'standees' ? '#FFFFFF' : '#475569',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={14} />
              <span>Standees</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('space-generator')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'space-generator' ? '#064E3B' : 'transparent',
                color: activeTab === 'space-generator' ? '#FFFFFF' : '#475569',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <QrCode size={14} />
              <span>Space Generator</span>
            </button>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ECFDF5',
            color: '#059669',
            border: '1px solid #A7F3D0',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 800,
            flexShrink: 0
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
            <span>QR system ready</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAGE 1: QR STANDEE MANAGEMENT
         ========================================================================= */}
      {activeTab === 'standees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* TOP SUMMARY METRICS (3 Compact Cards) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #EAE5DF',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Standees
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                  {totalStandeesCount}
                </div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F1F5F9', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #EAE5DF',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Active Standees
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                  {activeStandeesCount}
                </div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>

            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #EAE5DF',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Inactive Standees
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#64748B', marginTop: '2px' }}>
                  {inactiveStandeesCount}
                </div>
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FAF8F5', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Info size={18} />
              </div>
            </div>
          </div>

          {/* HOW IT WORKS (Slim Informational Flow) */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #EAE5DF',
            padding: '12px 18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.78rem', flexShrink: 0 }}>
                1
              </div>
              <div>
                <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Scan QR Code</strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Customer scans via mobile camera</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.78rem', flexShrink: 0 }}>
                2
              </div>
              <div>
                <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>View Menu</strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Instantly opens digital menu & photos</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.78rem', flexShrink: 0 }}>
                3
              </div>
              <div>
                <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>Place Order</strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Add items and submit live table order</span>
              </div>
            </div>
          </div>

          {/* SEARCH + FILTER BAR */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #EAE5DF',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 260px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search standees by name, table or space..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.80rem',
                    fontWeight: 600,
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Status Filter Pills */}
              <div style={{ display: 'flex', background: '#FAF8F5', padding: '2px', borderRadius: '8px', border: '1px solid #EAE5DF' }}>
                {['all', 'active', 'inactive'].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: statusFilter === st ? '#064E3B' : 'transparent',
                      color: statusFilter === st ? '#FFFFFF' : '#64748B',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Space Type Filter Dropdown */}
              <select
                value={spaceFilter}
                onChange={(e) => setSpaceFilter(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#0F172A'
                }}
              >
                <option value="all">All Spaces</option>
                <option value="table">Tables</option>
                <option value="cabin">Cabins</option>
                <option value="room">Rooms</option>
                <option value="vip">VIP Lounges</option>
                <option value="counter">Counter</option>
              </select>

              {/* Primary Create Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingStandee(null);
                  setShowCreateModal(true);
                }}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#064E3B',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(6, 78, 59, 0.20)'
                }}
              >
                <Plus size={14} />
                <span>Create Standee</span>
              </button>
            </div>
          </div>

          {/* TWO-COLUMN WORKSPACE (Left: Table/List, Right: Preview/Actions) */}
          <div className="touchqr-two-col-grid">
            
            {/* LEFT: Standee Data Table / Mobile Cards */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #EAE5DF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>
                  Standee Inventory ({filteredStandees.length})
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Click row to select preview
                </span>
              </div>

              {/* Desktop Table */}
              <div className="desktop-table-container" style={{ overflowX: 'auto' }}>
                <table className="touchqr-data-table">
                  <thead>
                    <tr>
                      <th>STANDEE</th>
                      <th>SPACE / TABLE</th>
                      <th>QR TYPE</th>
                      <th>STATUS</th>
                      <th>LAST UPDATED</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStandees.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                          No standees match your search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredStandees.map(st => {
                        const isSelected = activeStandee.id === st.id;
                        return (
                          <tr
                            key={st.id}
                            onClick={() => setSelectedStandeeId(st.id)}
                            style={{
                              background: isSelected ? '#F0FDF4' : '#FFFFFF',
                              cursor: 'pointer'
                            }}
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FAF8F5', border: '1px solid #EAE5DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#064E3B' }}>
                                  <QrCode size={16} />
                                </div>
                                <strong style={{ fontWeight: 800, color: '#0F172A' }}>{st.name}</strong>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: '#475569', fontWeight: 600 }}>{st.spaceLabel}</span>
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: st.qrType === 'ordering' ? '#DCFCE7' : '#F1F5F9',
                                color: st.qrType === 'ordering' ? '#15803D' : '#475569',
                                border: st.qrType === 'ordering' ? '1px solid #BBF7D0' : '1px solid #E2E8F0'
                              }}>
                                {st.qrType === 'ordering' ? 'Ordering QR' : 'Menu QR'}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                color: st.status === 'active' ? '#059669' : '#94A3B8'
                              }}>
                                <span>{st.status === 'active' ? '●' : '○'}</span>
                                <span style={{ textTransform: 'capitalize' }}>{st.status}</span>
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{st.lastUpdated}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStandeeId(st.id);
                                  }}
                                  style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingStandee(st);
                                    setShowCreateModal(true);
                                  }}
                                  style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintStandee(st);
                                  }}
                                  style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', background: '#064E3B', color: '#FFF', fontSize: '0.70rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                  Print
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Single-Column List */}
              <div className="mobile-standees-list" style={{ padding: '12px' }}>
                {filteredStandees.map(st => {
                  const isSelected = activeStandee.id === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedStandeeId(st.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: isSelected ? '#F0FDF4' : '#FFFFFF',
                        border: isSelected ? '1.5px solid #064E3B' : '1px solid #EAE5DF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FAF8F5', border: '1px solid #EAE5DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#064E3B', flexShrink: 0 }}>
                          <QrCode size={20} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.84rem', color: '#0F172A', display: 'block' }}>{st.name}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{st.spaceLabel}</span>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '8px', background: st.qrType === 'ordering' ? '#DCFCE7' : '#F1F5F9', color: st.qrType === 'ordering' ? '#15803D' : '#475569' }}>
                              {st.qrType === 'ordering' ? 'Ordering QR' : 'Menu QR'}
                            </span>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: st.status === 'active' ? '#059669' : '#94A3B8' }}>
                              ● {st.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintStandee(st);
                          }}
                          style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#064E3B', color: '#FFF', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Print
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Standee Mockup Preview & Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Preview Header Card */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #EAE5DF',
                padding: '14px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.90rem', color: '#0F172A', fontWeight: 900 }}>
                      Standee Live Preview
                    </strong>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: activeStandee.status === 'active' ? '#059669' : '#94A3B8',
                      background: activeStandee.status === 'active' ? '#ECFDF5' : '#F1F5F9',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: activeStandee.status === 'active' ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                      textTransform: 'capitalize'
                    }}>
                      ● {activeStandee.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                    Real 1:1 tabletop acrylic standee & print preview
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTestModal(true)}
                  title="Test Live QR Scan"
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Smartphone size={13} color="#064E3B" />
                  <span>Test Scan</span>
                </button>
              </div>

              {/* 3D Realistic Standee Scene on Tabletop */}
              <div style={{
                background: 'linear-gradient(180deg, #F8FAFC 0%, #EDE9E3 100%)',
                borderRadius: '20px',
                border: '1px solid #E2E8F0',
                padding: '24px 16px 18px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)'
              }}>

                {/* Subtle Horizon Light Sheen */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '50px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)',
                  pointerEvents: 'none'
                }} />

                {/* The Acrylic Standee Card itself */}
                <div style={{
                  width: '100%',
                  maxWidth: '325px',
                  background: activeStandee.theme === 'slate' ? '#0F172A' : '#FFFFFF',
                  borderRadius: '24px',
                  border: activeStandee.theme === 'slate' ? '2px solid #334155' : '3px solid #D4AF37',
                  boxShadow: activeStandee.theme === 'slate'
                    ? '0 20px 40px rgba(15, 23, 42, 0.45)'
                    : '0 20px 40px rgba(10, 35, 21, 0.14)',
                  padding: '24px 18px 18px 18px',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 2
                }}>
                  {/* Inner Gold Hairline Frame */}
                  <div style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    right: '6px',
                    bottom: '6px',
                    borderRadius: '18px',
                    border: activeStandee.theme === 'slate' ? '1px solid #475569' : '1.5px solid #E5C07B',
                    pointerEvents: 'none'
                  }} />

                  {/* Acrylic Glare Reflection at Top Right Corner */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '110px',
                    height: '110px',
                    background: 'radial-gradient(circle at top right, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)',
                    borderRadius: '0 24px 0 0',
                    pointerEvents: 'none'
                  }} />

                  {/* Top Space Badge */}
                  <div style={{
                    display: 'inline-block',
                    background: activeStandee.theme === 'slate' ? '#1E293B' : '#0A2315',
                    color: activeStandee.theme === 'slate' ? '#F8FAFC' : '#DFBA67',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    padding: '5px 18px',
                    borderRadius: '20px',
                    letterSpacing: '1px',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    border: activeStandee.theme === 'slate' ? '1px solid #475569' : '1.5px solid #D4AF37',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                  }}>
                    ✦ {activeStandee.spaceType === 'counter'
                      ? 'BILLING COUNTER'
                      : activeStandee.spaceType === 'cinema_seat'
                        ? (activeStandee.spaceLabel || `CINEMA SEAT ${activeStandee.identifier}`)
                        : `${((activeStandee.spaceType || 'table').toUpperCase() === 'CABIN' ? 'CABIN' : (activeStandee.spaceType || 'table').toUpperCase() === 'VIP' ? 'VIP LOUNGE' : (activeStandee.spaceType || 'table').toUpperCase() === 'ROOM' ? 'ROOM' : 'TABLE')} NO. ${activeStandee.identifier || '1'}`} ✦
                  </div>

                  {/* Restaurant Name (Playfair Luxury Serif) */}
                  <h3 style={{
                    fontFamily: "'Playfair Display', serif, Georgia",
                    fontSize: '1.24rem',
                    fontWeight: 900,
                    color: activeStandee.theme === 'slate' ? '#FFFFFF' : '#0A2315',
                    margin: '0 0 4px 0',
                    lineHeight: 1.25
                  }}>
                    {settingsForm?.name || restaurantInfo?.name || 'Raman Sweet Bakery & Family Restaurant'}
                  </h3>

                  {/* Decorative Gold Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '2px 0 6px 0' }}>
                    <div style={{ width: '32px', height: '1px', background: activeStandee.theme === 'slate' ? '#475569' : '#D4AF37' }} />
                    <span style={{ fontSize: '0.64rem', color: activeStandee.theme === 'slate' ? '#94A3B8' : '#D4AF37' }}>◆</span>
                    <div style={{ width: '32px', height: '1px', background: activeStandee.theme === 'slate' ? '#475569' : '#D4AF37' }} />
                  </div>

                  {/* Tagline / Subtitle */}
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: activeStandee.theme === 'slate' ? '#94A3B8' : '#15803D',
                    marginBottom: '14px'
                  }}>
                    {settingsForm?.tagline || (activeStandee.spaceType === 'cinema_seat' ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu')}
                  </div>

                  {/* High Quality QR Container with Pill & Corner Target Marks */}
                  <div style={{
                    background: '#FFFFFF',
                    padding: '14px',
                    borderRadius: '18px',
                    border: activeStandee.theme === 'slate' ? '1px solid #475569' : '1.5px solid #E2E8F0',
                    position: 'relative',
                    display: 'inline-block',
                    marginBottom: '12px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
                  }}>
                    {/* Top mini pill tag */}
                    <div style={{
                      position: 'absolute',
                      top: '-11px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: activeStandee.theme === 'slate' ? '#1E293B' : '#0A2315',
                      color: activeStandee.theme === 'slate' ? '#F8FAFC' : '#DFBA67',
                      fontSize: '0.62rem',
                      fontWeight: 900,
                      padding: '2px 10px',
                      borderRadius: '10px',
                      border: activeStandee.theme === 'slate' ? '1px solid #475569' : '1px solid #D4AF37',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.4px'
                    }}>
                      {activeStandee.spaceType === 'cinema_seat' ? '📷 SCAN FOR FOOD' : '📷 SCAN TO ORDER'}
                    </div>

                    <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                      <img
                        src={activeStandeeQrImgUrl}
                        alt={`${activeStandee.name} QR Code`}
                        style={{ width: '160px', height: '160px', display: 'block' }}
                      />
                      {/* 4 Gold Focus Target Brackets */}
                      <span style={{ position: 'absolute', top: '-4px', left: '-4px', width: '12px', height: '12px', borderTop: '2.5px solid #D4AF37', borderLeft: '2.5px solid #D4AF37' }} />
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', borderTop: '2.5px solid #D4AF37', borderRight: '2.5px solid #D4AF37' }} />
                      <span style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '12px', height: '12px', borderBottom: '2.5px solid #D4AF37', borderLeft: '2.5px solid #D4AF37' }} />
                      <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '12px', height: '12px', borderBottom: '2.5px solid #D4AF37', borderRight: '2.5px solid #D4AF37' }} />
                    </div>
                  </div>

                  {/* Primary Scan Instruction */}
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 900,
                    color: activeStandee.theme === 'slate' ? '#F1F5F9' : '#0A2315',
                    letterSpacing: '0.4px',
                    marginBottom: '2px'
                  }}>
                    {activeStandee.spaceType === 'cinema_seat' ? '📱 POINT CAMERA AT QR TO ORDER' : '📱 POINT CAMERA AT QR TO ORDER & PAY'}
                  </div>

                  {/* Secondary Scan Instruction (Hindi) */}
                  <div style={{
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    color: activeStandee.theme === 'slate' ? '#94A3B8' : '#64748B',
                    marginBottom: '8px'
                  }}>
                    {activeStandee.spaceType === 'cinema_seat' ? 'कैमरा से स्कैन करें और सीट पर खाना मंगाएं' : 'कैमरे से स्कैन करें और खाना ऑर्डर करें'}
                  </div>

                  {/* 3-Step Visual Instruction Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    background: activeStandee.theme === 'slate' ? 'rgba(255,255,255,0.06)' : '#FAF8F5',
                    border: activeStandee.theme === 'slate' ? '1px solid #334155' : '1px solid #EAE5DF',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    color: activeStandee.theme === 'slate' ? '#E2E8F0' : '#334155',
                    marginBottom: '6px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <span>① Camera</span>
                    <span style={{ color: '#D4AF37' }}>➔</span>
                    <span>② Scan QR</span>
                    <span style={{ color: '#D4AF37' }}>➔</span>
                    <span>③ Order Food</span>
                  </div>

                  {/* Reassurance Note */}
                  <div style={{
                    fontSize: '0.62rem',
                    color: '#059669',
                    fontWeight: 800,
                    marginBottom: activeStandee.message ? '8px' : '10px'
                  }}>
                    ✓ 100% Free • No App Required • Fast & Direct
                  </div>

                  {/* Custom Message / Greeting Note */}
                  {activeStandee.message && (
                    <div style={{
                      fontSize: '0.70rem',
                      fontStyle: 'italic',
                      color: activeStandee.theme === 'slate' ? '#CBD5E1' : '#475569',
                      marginBottom: '10px',
                      padding: '4px 10px',
                      background: activeStandee.theme === 'slate' ? 'rgba(255,255,255,0.05)' : '#FAF8F5',
                      borderRadius: '8px',
                      border: activeStandee.theme === 'slate' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #EAE5DF'
                    }}>
                      "{activeStandee.message}"
                    </div>
                  )}

                  {/* Footer Divider & Live Contact Info */}
                  <div style={{
                    width: '100%',
                    borderTop: activeStandee.theme === 'slate' ? '1px solid #334155' : '1px solid #F1F5F9',
                    paddingTop: '8px',
                    fontSize: '0.66rem',
                    color: '#94A3B8',
                    lineHeight: 1.4
                  }}>
                    {settingsForm?.address || restaurantInfo?.address ? (
                      <div>{settingsForm?.address || restaurantInfo?.address}</div>
                    ) : null}
                    {settingsForm?.phone || restaurantInfo?.phone ? (
                      <div style={{ fontWeight: 600 }}>Phone: {settingsForm?.phone || restaurantInfo?.phone}</div>
                    ) : null}
                    {!settingsForm?.watermark_removal_enabled && (
                      <div style={{ marginTop: '3px', fontSize: '0.62rem', color: '#15803D', fontWeight: 800 }}>
                        ⚡ Powered by TouchQR Contactless Dining
                      </div>
                    )}
                  </div>
                </div>

                {/* Realistic Acrylic Stand Base (Pedestal Footing) */}
                <div style={{
                  width: '210px',
                  height: '14px',
                  background: 'linear-gradient(180deg, #E2E8F0 0%, #94A3B8 100%)',
                  borderRadius: '3px 3px 8px 8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                  margin: '-5px auto 4px auto',
                  border: '1px solid #64748B',
                  position: 'relative',
                  zIndex: 3
                }}>
                  {/* Acrylic Slot Line */}
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: '12%',
                    right: '12%',
                    height: '2px',
                    background: 'rgba(255,255,255,0.85)',
                    borderRadius: '1px'
                  }} />
                </div>

                {/* Ground Table Shadow */}
                <div style={{
                  width: '260px',
                  height: '12px',
                  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 75%)',
                  borderRadius: '50%',
                  margin: '0 auto',
                  zIndex: 1
                }} />
              </div>

              {/* DOWNLOAD & ACTION CONTROLS */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #EAE5DF',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    QR Code Style
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { id: '#000000', label: 'Pitch Black', badge: 'Black', color: '#000000' },
                      { id: '#0F172A', label: 'Luxury Slate', badge: 'Slate', color: '#0F172A' },
                      { id: '#92400E', label: 'Royal Gold', badge: 'Gold', color: '#92400E' },
                      { id: '#064E3B', label: 'Deep Emerald', badge: 'Green', color: '#064E3B' }
                    ].map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setQrColor(preset.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          border: qrColor === preset.id ? '2px solid #0A2315' : '1px solid #CBD5E1',
                          background: qrColor === preset.id ? '#F1F5F9' : '#FFFFFF',
                          color: '#0F172A',
                          cursor: 'pointer'
                        }}
                        title={preset.label}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: preset.color, display: 'inline-block' }} />
                        <span>{preset.badge}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Print & Export Quality
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { id: '1024', label: '1K' },
                      { id: '2048', label: '2K HD' },
                      { id: '4096', label: '4K Print' }
                    ].map(res => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => setDownloadResolution(res.id)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          border: downloadResolution === res.id ? '1.5px solid #064E3B' : '1px solid #CBD5E1',
                          background: downloadResolution === res.id ? '#ECFDF5' : '#FFFFFF',
                          color: downloadResolution === res.id ? '#064E3B' : '#64748B',
                          cursor: 'pointer'
                        }}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadQr('PNG')}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#064E3B',
                      color: '#FFFFFF',
                      fontSize: '0.80rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                    }}
                  >
                    <Download size={15} />
                    <span>Download Standee Poster ({downloadResolution === '4096' ? '2400x3500px' : downloadResolution === '1024' ? '1200x1750px' : '1800x2620px'} PNG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPureQr}
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '10px',
                      border: '1.5px solid #064E3B',
                      background: '#F0FDF4',
                      color: '#064E3B',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <QrCode size={15} />
                    <span>Download Original QR Code Only ({downloadResolution}x{downloadResolution}px PNG)</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => handlePrintStandee(activeStandee)}
                    style={{
                      flex: 1,
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Printer size={14} />
                    <span>Print Standee</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingStandee(activeStandee);
                      setShowCreateModal(true);
                    }}
                    style={{
                      flex: 1,
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Palette size={14} />
                    <span>Customize</span>
                  </button>
                </div>

                {/* Quick Link Copy & Verification */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: '#FAF8F5',
                  borderRadius: '8px',
                  border: '1px solid #EAE5DF',
                  marginTop: '2px'
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                    <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block' }}>Target Destination URL:</span>
                    <span style={{ fontSize: '0.70rem', color: '#0F172A', fontWeight: 600 }}>{activeStandeeTargetUrl}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      color: copied ? '#059669' : '#0F172A',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #EAE5DF',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Quick Actions
                </span>

                <div
                  onClick={() => {
                    setEditingStandee(null);
                    setShowCreateModal(true);
                  }}
                  style={{ padding: '8px 10px', borderRadius: '8px', background: '#FAF8F5', border: '1px solid #EAE5DF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}
                >
                  <Plus size={15} color="#064E3B" />
                  <span>Create New Standee</span>
                </div>

                <div
                  onClick={() => (onPrintAllQRs ? onPrintAllQRs(currentPrefix, isCinema ? cinemaSeats : null) : window.print())}
                  style={{ padding: '8px 10px', borderRadius: '8px', background: '#FAF8F5', border: '1px solid #EAE5DF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}
                >
                  <Printer size={15} color="#064E3B" />
                  <span>Bulk Print All ({totalStandeesCount}) Standees</span>
                </div>

                <div
                  onClick={() => setShowTemplatesModal(true)}
                  style={{ padding: '8px 10px', borderRadius: '8px', background: '#FAF8F5', border: '1px solid #EAE5DF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}
                >
                  <FileText size={15} color="#064E3B" />
                  <span>Standee Templates & Sizing</span>
                </div>

                <div
                  onClick={() => setShowGuideModal(true)}
                  style={{ padding: '8px 10px', borderRadius: '8px', background: '#FAF8F5', border: '1px solid #EAE5DF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}
                >
                  <Info size={15} color="#064E3B" />
                  <span>Standee Setup Guide</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 2: SPACE QR GENERATOR
         ========================================================================= */}
      {activeTab === 'space-generator' && (
        <div className="touchqr-two-col-grid">
          
          {/* LEFT: Step-Based Configuration Workspace */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* STEP 1: SELECT PHYSICAL SPACE TYPE */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: '#064E3B',
                  color: '#FFF',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  1
                </div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 900 }}>
                  Select Space Type
                </strong>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Available Physical Space Categories
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {availableSpaceTypes.map(item => {
                    const isSelected = genSpaceType === item.id;
                    const count = item.id === 'cinema_seat' ? totalCinemaSeatsCount : (spaceCounts[item.id] !== undefined ? spaceCounts[item.id] : 0);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setGenSpaceType(item.id);
                          handleSpaceTypeClick(item.id);
                          if (item.id === 'counter') {
                            setGenIdentifier('Counter');
                            setGenSpaceName('Billing Counter');
                          } else if (item.id === 'cinema_seat') {
                            if (screenNum && selectedRowLabel && selectedSeatNum) {
                              setGenIdentifier(`S${screenNum}-${selectedRowLabel}-${selectedSeatNum}`);
                            } else {
                              setGenIdentifier('S1-A-1');
                            }
                            setGenSpaceName('Multiplex Auditorium');
                          } else {
                            setGenIdentifier('1');
                            if (item.id === 'cabin') setGenSpaceName('Private Area');
                            else if (item.id === 'vip') setGenSpaceName('VIP Lounge');
                            else if (item.id === 'room') setGenSpaceName('Guest Rooms');
                            else setGenSpaceName('Main Hall');
                          }
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '1.5px solid #064E3B' : '1px solid #EAE5DF',
                          background: isSelected ? '#ECFDF5' : '#FAF8F5',
                          color: isSelected ? '#064E3B' : '#475569',
                          fontSize: '0.80rem',
                          fontWeight: isSelected ? 800 : 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{item.label}</span>
                        <span style={{
                          fontSize: '0.70rem',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '8px',
                          background: isSelected ? '#064E3B' : '#E2E8F0',
                          color: isSelected ? '#FFFFFF' : '#475569'
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STEP 2: SELECT CONFIGURED PHYSICAL SPACE */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: '#064E3B',
                    color: '#FFF',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    2
                  </div>
                  <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 900 }}>
                    Select Configured {activeGenSpaceConfig.singular}
                  </strong>
                </div>

                {/* Optional Contextual Add CTA */}
                {!isCinema && genSpaceType !== 'counter' && onAddTable && (
                  <button
                    type="button"
                    onClick={() => onAddTable((spaceCounts[genSpaceType] || 0) + 1, genSpaceType)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid #A7F3D0',
                      background: '#ECFDF5',
                      color: '#064E3B',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={13} />
                    <span>+ Add {activeGenSpaceConfig.singular}</span>
                  </button>
                )}
              </div>

              {/* Standard Spaces Grid (Tables, Cabins, VIP, Rooms) */}
              {genSpaceType !== 'cinema_seat' && genSpaceType !== 'counter' && (
                <div>
                  {genSpaceCount === 0 ? (
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      background: '#FAF8F5',
                      border: '1px dashed #CBD5E1',
                      textAlign: 'center'
                    }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#64748B' }}>
                        No {activeGenSpaceConfig.plural.toLowerCase()} currently configured in your restaurant profile.
                      </p>
                      {onAddTable && (
                        <button
                          type="button"
                          onClick={() => onAddTable(1, genSpaceType)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#064E3B',
                            color: '#FFF',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          + Add {activeGenSpaceConfig.singular} 1 Now
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                      {Array.from({ length: genSpaceCount }, (_, i) => String(i + 1)).map(num => {
                        const isSelected = String(genIdentifier) === String(num);
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setGenIdentifier(num)}
                            style={{
                              padding: '10px 8px',
                              borderRadius: '10px',
                              border: isSelected ? '2px solid #064E3B' : '1px solid #EAE5DF',
                              background: isSelected ? '#ECFDF5' : '#FFFFFF',
                              color: isSelected ? '#064E3B' : '#0F172A',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 800 : 600,
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 2px 6px rgba(6, 78, 59, 0.15)' : 'none'
                            }}
                          >
                            <div style={{ fontSize: '0.68rem', color: isSelected ? '#064E3B' : '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                              {activeGenSpaceConfig.singular}
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 900 }}>
                              {num}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Counter Mode */}
              {genSpaceType === 'counter' && (
                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#ECFDF5',
                  border: '1.5px solid #064E3B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.86rem', color: '#064E3B', display: 'block' }}>
                      🏪 Central Billing Counter
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#047857' }}>
                      General walk-in menu display standee (Browse Menu Only)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#064E3B', background: '#D1FAE5', padding: '2px 8px', borderRadius: '8px' }}>
                    Selected
                  </span>
                </div>
              )}

              {/* Cinema Seats Mode */}
              {genSpaceType === 'cinema_seat' && (
                <div>
                  {cinemaSeats.length === 0 ? (
                    <div style={{ padding: '20px', borderRadius: '12px', background: '#FAF8F5', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: '#64748B' }}>
                        No cinema auditorium seats configured yet.
                      </p>
                      {onBackToSetup && (
                        <button
                          type="button"
                          onClick={() => onBackToSetup('cinema')}
                          style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#064E3B', color: '#FFF', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Configure Cinema Seats ➔
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Screen
                        </label>
                        <select
                          value={selectedScreenId}
                          onChange={(e) => {
                            const sId = e.target.value;
                            setSelectedScreenId(sId);
                            const screenSeats = cinemaSeats.filter(st => String(st.screen_id) === String(sId));
                            const rows = [...new Set(screenSeats.map(st => st.row_label).filter(Boolean))].sort();
                            if (rows.length > 0) {
                              setSelectedRowLabel(rows[0]);
                              const rowSeats = screenSeats.filter(st => st.row_label === rows[0]).map(st => String(st.seat_number));
                              const firstSeat = rowSeats[0] || '1';
                              setSelectedSeatNum(firstSeat);
                              const scrObj = cinemaScreens.find(s => String(s.id) === String(sId));
                              const scrN = scrObj ? scrObj.screen_number : '1';
                              setGenIdentifier(`S${scrN}-${rows[0]}-${firstSeat}`);
                            }
                          }}
                          style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.78rem', fontWeight: 700 }}
                        >
                          {cinemaScreens.map(s => (
                            <option key={s.id} value={String(s.id)}>Screen {s.screen_number} ({s.name || 'Main'})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Row
                        </label>
                        <select
                          value={selectedRowLabel}
                          onChange={(e) => {
                            const rLabel = e.target.value;
                            setSelectedRowLabel(rLabel);
                            const rowSeats = cinemaSeats.filter(st => String(st.screen_id) === String(selectedScreenId) && st.row_label === rLabel).map(st => String(st.seat_number));
                            const firstSeat = rowSeats[0] || '1';
                            setSelectedSeatNum(firstSeat);
                            setGenIdentifier(`S${screenNum}-${rLabel}-${firstSeat}`);
                          }}
                          style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.78rem', fontWeight: 700 }}
                        >
                          {[...new Set(cinemaSeats.filter(st => String(st.screen_id) === String(selectedScreenId)).map(st => st.row_label).filter(Boolean))].sort().map(r => (
                            <option key={r} value={r}>Row {r}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Seat No.
                        </label>
                        <select
                          value={selectedSeatNum}
                          onChange={(e) => {
                            const sNum = e.target.value;
                            setSelectedSeatNum(sNum);
                            setGenIdentifier(`S${screenNum}-${selectedRowLabel}-${sNum}`);
                          }}
                          style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.78rem', fontWeight: 700 }}
                        >
                          {cinemaSeats.filter(st => String(st.screen_id) === String(selectedScreenId) && st.row_label === selectedRowLabel).map(st => String(st.seat_number)).sort((a, b) => Number(a) - Number(b)).map(stNum => (
                            <option key={stNum} value={stNum}>Seat {stNum}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live QR Preview & Download Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>

            {/* LIVE STANDEE PREVIEW LABEL */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live Standee Preview
              </span>
              <span style={{ fontSize: '0.70rem', color: '#047857', fontWeight: 800, background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                Physical Print Mockup
              </span>
            </div>

            {/* PHYSICAL STANDEE CARD (Exact Reference Match) */}
            <div style={{
              width: '100%',
              maxWidth: '330px',
              background: '#FFFFFF',
              borderRadius: '24px',
              border: '3px solid #D4AF37',
              boxShadow: '0 20px 40px rgba(10, 35, 21, 0.14)',
              padding: '24px 18px 18px 18px',
              textAlign: 'center',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              zIndex: 2
            }}>
              {/* Inner Gold Hairline Frame */}
              <div style={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                right: '6px',
                bottom: '6px',
                borderRadius: '18px',
                border: '1.5px solid #E5C07B',
                pointerEvents: 'none'
              }} />

              {/* Top Space Badge */}
              <div style={{
                display: 'inline-block',
                background: '#0A2315',
                color: '#DFBA67',
                fontSize: '0.74rem',
                fontWeight: 900,
                padding: '5px 18px',
                borderRadius: '20px',
                letterSpacing: '1px',
                marginBottom: '10px',
                textTransform: 'uppercase',
                border: '1.5px solid #D4AF37',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
              }}>
                ✦ {genSpaceType === 'counter'
                  ? 'BILLING COUNTER'
                  : isCinema
                    ? (String(genIdentifier).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i)
                        ? `SCREEN ${String(genIdentifier).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i)[1]} • ROW ${String(genIdentifier).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i)[2].toUpperCase()} • SEAT ${String(genIdentifier).match(/^S(\d+)-([A-Za-z]+)-(\d+)$/i)[3]}`
                        : `CINEMA SEAT ${genIdentifier}`)
                    : `${(activeGenSpaceConfig?.singular || 'Table').toUpperCase()} NO. ${genIdentifier}`} ✦
              </div>

              {/* Restaurant Name */}
              <h3 style={{
                fontFamily: "'Playfair Display', serif, Georgia",
                fontSize: '1.24rem',
                fontWeight: 900,
                color: '#0A2315',
                margin: '0 0 4px 0',
                lineHeight: 1.25
              }}>
                {settingsForm?.name || restaurantInfo?.name || 'Raman Sweet Bakery & Family Restaurant'}
              </h3>

              {/* Decorative Gold Divider */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '2px 0 6px 0' }}>
                <div style={{ width: '32px', height: '1px', background: '#D4AF37' }} />
                <span style={{ fontSize: '0.64rem', color: '#D4AF37' }}>◆</span>
                <div style={{ width: '32px', height: '1px', background: '#D4AF37' }} />
              </div>

              {/* Tagline / Subtitle */}
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#15803D',
                marginBottom: '14px'
              }}>
                {settingsForm?.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu')}
              </div>

              {/* QR Code Shield with [SCAN TO ORDER] Pill & Focus Brackets */}
              <div style={{
                background: '#FFFFFF',
                padding: '14px',
                borderRadius: '18px',
                border: '1.5px solid #E2E8F0',
                position: 'relative',
                display: 'inline-block',
                marginBottom: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-11px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#0A2315',
                  color: '#DFBA67',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '2px 10px',
                  borderRadius: '10px',
                  border: '1px solid #D4AF37',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.4px'
                }}>
                  {isCinema ? '📷 SCAN FOR FOOD' : '📷 SCAN TO ORDER'}
                </div>

                <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                  <img
                    src={generatorQrImgUrl}
                    alt={`${activeGenSpaceConfig.singular} ${genIdentifier} QR Code`}
                    style={{ width: '160px', height: '160px', display: 'block' }}
                  />
                  {/* 4 Gold Focus Target Brackets */}
                  <span style={{ position: 'absolute', top: '-4px', left: '-4px', width: '12px', height: '12px', borderTop: '2.5px solid #D4AF37', borderLeft: '2.5px solid #D4AF37' }} />
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', borderTop: '2.5px solid #D4AF37', borderRight: '2.5px solid #D4AF37' }} />
                  <span style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '12px', height: '12px', borderBottom: '2.5px solid #D4AF37', borderLeft: '2.5px solid #D4AF37' }} />
                  <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '12px', height: '12px', borderBottom: '2.5px solid #D4AF37', borderRight: '2.5px solid #D4AF37' }} />
                </div>
              </div>

              {/* Primary Scan Instruction */}
              <div style={{
                fontSize: '0.82rem',
                fontWeight: 900,
                color: '#0A2315',
                letterSpacing: '0.4px',
                marginBottom: '2px'
              }}>
                {isCinema ? '📱 POINT CAMERA AT QR TO ORDER' : '📱 POINT CAMERA AT QR TO ORDER & PAY'}
              </div>

              {/* Secondary Scan Instruction (Hindi) */}
              <div style={{
                fontSize: '0.70rem',
                fontWeight: 700,
                color: '#64748B',
                marginBottom: '8px'
              }}>
                {isCinema ? 'कैमरा से स्कैन करें और सीट पर खाना मंगाएं' : 'कैमरे से स्कैन करें और खाना ऑर्डर करें'}
              </div>

              {/* 3-Step Visual Instruction Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '12px',
                background: '#FAF8F5',
                border: '1px solid #EAE5DF',
                fontSize: '0.62rem',
                fontWeight: 800,
                color: '#334155',
                marginBottom: '6px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <span>① Camera</span>
                <span style={{ color: '#D4AF37' }}>➔</span>
                <span>② Scan QR</span>
                <span style={{ color: '#D4AF37' }}>➔</span>
                <span>③ Order Food</span>
              </div>

              {/* Reassurance Note */}
              <div style={{
                fontSize: '0.62rem',
                color: '#059669',
                fontWeight: 800,
                marginBottom: genDescription ? '8px' : '10px'
              }}>
                ✓ 100% Free • No App Required • Fast & Direct
              </div>

              {/* Custom Message */}
              {genDescription && (
                <div style={{
                  fontSize: '0.70rem',
                  fontStyle: 'italic',
                  color: '#475569',
                  marginBottom: '10px',
                  padding: '4px 10px',
                  background: '#FAF8F5',
                  borderRadius: '8px',
                  border: '1px solid #EAE5DF'
                }}>
                  "{genDescription}"
                </div>
              )}

              {/* Footer Divider & Live Contact Info */}
              <div style={{
                width: '100%',
                borderTop: '1px solid #F1F5F9',
                paddingTop: '8px',
                fontSize: '0.66rem',
                color: '#94A3B8',
                lineHeight: 1.4
              }}>
                {settingsForm?.address || restaurantInfo?.address ? (
                  <div>{settingsForm?.address || restaurantInfo?.address}</div>
                ) : null}
                {settingsForm?.phone || restaurantInfo?.phone ? (
                  <div style={{ fontWeight: 600 }}>Phone: {settingsForm?.phone || restaurantInfo?.phone}</div>
                ) : null}
                {!settingsForm?.watermark_removal_enabled && (
                  <div style={{ marginTop: '3px', fontSize: '0.62rem', color: '#15803D', fontWeight: 800 }}>
                    ⚡ Powered by TouchQR Contactless Dining
                  </div>
                )}
              </div>
            </div>

            {/* DOWNLOAD / PRINT ACTIONS */}
            <div style={{
              width: '100%',
              maxWidth: '350px',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Download & Print
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>Resolution:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { id: '1024', label: '1K' },
                    { id: '2048', label: '2K HD' },
                    { id: '4096', label: '4K Print' }
                  ].map(res => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setDownloadResolution(res.id)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: downloadResolution === res.id ? '1.5px solid #064E3B' : '1px solid #CBD5E1',
                        background: downloadResolution === res.id ? '#ECFDF5' : '#FFFFFF',
                        color: downloadResolution === res.id ? '#064E3B' : '#64748B',
                        cursor: 'pointer'
                      }}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadQr('PNG')}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#064E3B',
                    color: '#FFFFFF',
                    fontSize: '0.80rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                  }}
                >
                  <Download size={15} />
                  <span>Download Standee Poster ({downloadResolution === '4096' ? '2400x3500px' : downloadResolution === '1024' ? '1200x1750px' : '1800x2620px'} PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPureQr}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1.5px solid #064E3B',
                    background: '#F0FDF4',
                    color: '#064E3B',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <QrCode size={15} />
                  <span>Download Original QR Code Only ({downloadResolution}x{downloadResolution}px PNG)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handlePrintStandee({ spaceType: genSpaceType, identifier: genIdentifier, spaceLabel: genSpaceName, message: genDescription })}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={15} />
                <span>Print Standee Sticker</span>
              </button>

              <button
                type="button"
                onClick={handleCreateStandeeFromGenerator}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid #A7F3D0',
                  background: '#ECFDF5',
                  color: '#064E3B',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '2px'
                }}
              >
                <Plus size={15} />
                <span>Create Standee from this QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE / EDIT STANDEE MODAL
         ========================================================================= */}
      {showCreateModal && (
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
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE5DF', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                  {editingStandee ? 'Edit QR Standee' : 'Create New QR Standee'}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Configure table assignment, message and visual standee frame
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingStandee(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target;
                handleSaveModalStandee({
                  name: form.name.value,
                  spaceType: form.spaceType.value,
                  spaceLabel: `${form.spaceType.options[form.spaceType.selectedIndex].text} · ${form.identifier.value}`,
                  identifier: form.identifier.value,
                  qrType: form.qrType.value,
                  theme: form.theme.value,
                  message: form.message.value
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Standee Name *
                </label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingStandee?.name || 'Table 1 Standee'}
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Space Type
                  </label>
                  <select
                    name="spaceType"
                    defaultValue={editingStandee?.spaceType || 'table'}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                  >
                    {availableSpaceTypes.map(item => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                    <option value="counter">Billing Counter</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Identifier / Table No.
                  </label>
                  <input
                    name="identifier"
                    type="text"
                    defaultValue={editingStandee?.identifier || '1'}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  QR Type
                </label>
                <select
                  name="qrType"
                  defaultValue={editingStandee?.qrType || (isDirectOrderingAvailable ? 'ordering' : 'menu')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                >
                  <option value="menu">Menu QR (Browse Menu Only)</option>
                  {isDirectOrderingAvailable && <option value="ordering">Ordering QR (Live Table Ordering)</option>}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Standee Frame Theme
                </label>
                <select
                  name="theme"
                  defaultValue={editingStandee?.theme || 'emerald'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                >
                  <option value="emerald">TouchQR Emerald Green (Modern)</option>
                  <option value="gold">Royal Gold Double-Frame (Luxury)</option>
                  <option value="slate">Classic Dark Slate (Minimal)</option>
                  <option value="minimal">Clean Ivory (Subtle)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Custom Message
                </label>
                <input
                  name="message"
                  type="text"
                  defaultValue={editingStandee?.message || 'Scan to view menu & place orders'}
                  placeholder="e.g. WiFi: Guest_5G • Thank you for dining!"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingStandee(null);
                  }}
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)' }}
                >
                  {editingStandee ? 'Update Standee' : 'Create Standee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TEST QR CODE MODAL
         ========================================================================= */}
      {showTestModal && (
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
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '12px'
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                Live QR Test
              </strong>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#FAF8F5', padding: '14px', borderRadius: '16px', border: '1px solid #EAE5DF' }}>
              <img src={activeTab === 'space-generator' ? generatorQrImgUrl : activeStandeeQrImgUrl} alt="Test QR" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>

            <div style={{ fontSize: '0.74rem', color: '#64748B', wordBreak: 'break-all', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              {activeTab === 'space-generator' ? generatorTargetUrl : activeStandeeTargetUrl}
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleCopyLink}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
              >
                {copied ? '✓ Copied URL' : 'Copy Test URL'}
              </button>
              <a
                href={activeTab === 'space-generator' ? generatorTargetUrl : activeStandeeTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, height: '38px', borderRadius: '10px', background: '#064E3B', color: '#FFF', fontWeight: 800, fontSize: '0.78rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <ExternalLink size={14} />
                <span>Open in Tab</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TEMPLATES & SIZING MODAL
         ========================================================================= */}
      {showTemplatesModal && (
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
            maxWidth: '540px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE5DF', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  Standee Templates & Print Specifications
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Recommended physical dimensions for dining table QR hardware
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EAE5DF' }}>
                <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                  🪧 Acrylic Table Standee
                </strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  4" × 6" (A6 Size) vertical tent card.
                </span>
                <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800 }}>Ideal for Dine-in Tables & Cafes</span>
              </div>

              <div style={{ padding: '12px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EAE5DF' }}>
                <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                  🪵 Wooden Block Standee
                </strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  3.5" × 5" engraved or printed insert.
                </span>
                <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800 }}>Ideal for Premium Bars & Restros</span>
              </div>

              <div style={{ padding: '12px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EAE5DF' }}>
                <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                  🏷️ Waterproof Table Sticker
                </strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  70mm × 70mm round / square vinyl.
                </span>
                <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800 }}>Ideal for Fast-Food & Counters</span>
              </div>

              <div style={{ padding: '12px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EAE5DF' }}>
                <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                  🎬 Cinema Seat Sticker
                </strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  45mm × 45mm armrest vinyl sticker.
                </span>
                <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800 }}>Ideal for Multiplex Armrests</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTemplatesModal(false)}
              style={{ width: '100%', height: '38px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFF', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', marginTop: '6px' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SETUP GUIDE MODAL
         ========================================================================= */}
      {showGuideModal && (
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
            maxWidth: '500px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE5DF', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                QR Standee Placement Guide
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', color: '#334155', lineHeight: 1.45 }}>
              <div>
                <strong>1. Table Placement:</strong> Place standees upright in the center or right corner of dining tables so guests can scan from seated posture.
              </div>
              <div>
                <strong>2. Good Lighting:</strong> Avoid heavy glass shadows or harsh glare directly on the QR code matrix.
              </div>
              <div>
                <strong>3. Staff Training:</strong> Instruct captains and waiters to invite customers to scan the QR to browse digital menu with photos.
              </div>
              <div>
                <strong>4. Tamper Prevention:</strong> Use high-grade acrylic or laminated stickers to protect QR codes from food spills and cleaning sprays.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              style={{ width: '100%', height: '38px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFF', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', marginTop: '6px' }}
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
