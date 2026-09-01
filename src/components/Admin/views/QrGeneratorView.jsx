import React, { useState, useEffect, useMemo } from 'react';
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
  const [qrColor, setQrColor] = useState('#064E3B');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [cornerStyle, setCornerStyle] = useState('rounded');
  const [downloadFormat, setDownloadFormat] = useState('PNG');
  const [downloadResolution, setDownloadResolution] = useState('2048');

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
  const buildQrUrl = (spaceTypeParam, identifier) => {
    const sig = generateQrToken(activeSlug, spaceTypeParam, identifier, secretKey);
    return `${liveOrigin}/${activeSlug}?${spaceTypeParam}=${encodeURIComponent(identifier)}&tkn=${sig}`;
  };

  const currentTargetUrl = buildQrUrl(isCinema ? 'cinema' : spaceConfig.param, activeTableNum);
  const currentQrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentTargetUrl)}`;

  // 5. Standee Inventory Management (Dynamic synchronization with physical spaces)
  const defaultStandeesList = useMemo(() => {
    const list = [];
    const tablesCount = Number(settingsForm?.total_tables) || 0;
    const cabinsCount = Number(settingsForm?.total_cabins) || 0;
    const roomsCount = Number(settingsForm?.total_rooms) || 0;
    const vipCount = Number(settingsForm?.total_vip) || 0;

    for (let i = 1; i <= Math.min(tablesCount, 40); i++) {
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
        lastUpdated: '24 May 2026, 10:30 AM'
      });
    }

    for (let i = 1; i <= Math.min(cabinsCount, 10); i++) {
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
        lastUpdated: '24 May 2026, 10:15 AM'
      });
    }

    for (let i = 1; i <= Math.min(roomsCount, 10); i++) {
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
        lastUpdated: '24 May 2026, 09:45 AM'
      });
    }

    for (let i = 1; i <= Math.min(vipCount, 5); i++) {
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
        lastUpdated: '24 May 2026, 09:30 AM'
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
      lastUpdated: '24 May 2026, 09:00 AM'
    });

    return list;
  }, [
    settingsForm?.total_tables,
    settingsForm?.total_cabins,
    settingsForm?.total_rooms,
    settingsForm?.total_vip,
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
      lastUpdated: 'Today'
    };
  }, [selectedStandeeId, standees, spaceConfig, currentPrefix, isDirectOrderingAvailable]);

  // Filtered Standees
  const filteredStandees = useMemo(() => {
    return standees.filter(st => {
      const matchesSearch = !searchQuery || 
        st.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        st.spaceLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.identifier.toLowerCase().includes(searchQuery.toLowerCase());
      
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
    navigator.clipboard.writeText(currentTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = (format = 'PNG') => {
    const a = document.createElement('a');
    a.href = currentQrImgUrl;
    a.download = `${activeSlug}_${activeStandee.identifier}_qr.${format.toLowerCase()}`;
    a.target = '_blank';
    a.click();
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
    if (window.confirm('Are you sure you want to remove this standee?')) {
      setStandees(prev => prev.filter(s => s.id !== standeeId));
    }
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
    const newStandee = {
      id: `standee-gen-${Date.now()}`,
      name: `${genSpaceName} ${genIdentifier} Standee`,
      spaceType: genSpaceType,
      spaceLabel: `${genSpaceName} · ${genIdentifier}`,
      identifier: genIdentifier,
      qrType: genQrType,
      status: 'active',
      theme: qrColor === '#D97706' ? 'gold' : qrColor === '#0F172A' ? 'slate' : 'emerald',
      message: genDescription || 'Scan to view menu & place orders',
      lastUpdated: 'Just now'
    };
    setStandees(prev => [newStandee, ...prev]);
    setSelectedStandeeId(newStandee.id);
    setActiveTab('standees');
    alert(`✓ Standee created for ${genSpaceName} (${genIdentifier}) and added to your Standee Management!`);
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
                                    onPrintQR(st.identifier, st.spaceType);
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
                            onPrintQR(st.identifier, st.spaceType);
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Standee Realistic Mockup Card */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #EAE5DF',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxSizing: 'border-box'
              }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 800 }}>
                    Standee Live Preview
                  </strong>
                  <span style={{ fontSize: '0.70rem', color: '#059669', fontWeight: 800, background: '#ECFDF5', padding: '2px 8px', borderRadius: '10px' }}>
                    ● {activeStandee.status}
                  </span>
                </div>

                {/* The Acrylic / Gold Standee Mockup */}
                <div style={{
                  width: '100%',
                  maxWidth: '290px',
                  borderRadius: '18px',
                  border: activeStandee.theme === 'gold' ? '3px double #D97706' : activeStandee.theme === 'slate' ? '2px solid #0F172A' : '2px solid #064E3B',
                  background: activeStandee.theme === 'slate' ? '#0F172A' : 'linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%)',
                  color: activeStandee.theme === 'slate' ? '#FFFFFF' : '#0F172A',
                  padding: '20px 16px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                  boxSizing: 'border-box',
                  marginBottom: '14px'
                }}>
                  {/* Space Badge */}
                  <div style={{
                    display: 'inline-block',
                    background: activeStandee.theme === 'slate' ? '#1E293B' : '#064E3B',
                    color: activeStandee.theme === 'gold' ? '#F59E0B' : '#FFFFFF',
                    padding: '4px 14px',
                    borderRadius: '20px',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    marginBottom: '8px'
                  }}>
                    {activeStandee.spaceLabel.toUpperCase()}
                  </div>

                  <h4 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: 900, color: activeStandee.theme === 'slate' ? '#FFFFFF' : '#064E3B' }}>
                    {settingsForm?.name || restaurantInfo?.name || 'TouchQR Restaurant'}
                  </h4>
                  <span style={{ fontSize: '0.70rem', color: activeStandee.theme === 'slate' ? '#94A3B8' : '#64748B', display: 'block', marginBottom: '10px' }}>
                    {activeStandee.qrType === 'ordering' ? '📱 Scan to View Menu & Order' : '📖 Scan to View Digital Menu'}
                  </span>

                  {/* QR Image Box */}
                  <div style={{
                    background: '#FFFFFF',
                    padding: '10px',
                    borderRadius: '12px',
                    border: '1px solid #EAE5DF',
                    display: 'inline-block',
                    marginBottom: '10px'
                  }}>
                    <img
                      src={currentQrImgUrl}
                      alt="Standee QR"
                      style={{ width: '150px', height: '150px', display: 'block' }}
                    />
                  </div>

                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: activeStandee.theme === 'slate' ? '#F1F5F9' : '#0F172A', marginBottom: '2px' }}>
                    {activeStandee.message || 'Thank you for dining with us!'}
                  </div>

                  <div style={{ fontSize: '0.62rem', color: activeStandee.theme === 'slate' ? '#64748B' : '#94A3B8', marginTop: '6px', borderTop: activeStandee.theme === 'slate' ? '1px solid #334155' : '1px solid #EAE5DF', paddingTop: '4px' }}>
                    ⚡ Powered by TouchQR
                  </div>
                </div>

                {/* Actions below Preview */}
                <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
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

                  <button
                    type="button"
                    onClick={() => onPrintQR(activeStandee.identifier, activeStandee.spaceType)}
                    style={{
                      flex: 1,
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#064E3B',
                      color: '#FFFFFF',
                      fontSize: '0.76rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                    }}
                  >
                    <Printer size={14} />
                    <span>Print Standee</span>
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
                  onClick={() => onPrintAllQRs(currentPrefix, isCinema ? cinemaSeats : null)}
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

            {/* STEP 1: SPACE DETAILS */}
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
                  Space Details
                </strong>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Space / Zone Name *
                </label>
                <input
                  type="text"
                  value={genSpaceName}
                  onChange={(e) => setGenSpaceName(e.target.value)}
                  placeholder="e.g. Main Hall, Dining Terrace, VIP Lounge"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    background: '#FFFFFF',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Space Type (Adapted to your Business Model)
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {availableSpaceTypes.map(item => {
                    const isSelected = genSpaceType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setGenSpaceType(item.id);
                          handleSpaceTypeClick(item.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #064E3B' : '1px solid #EAE5DF',
                          background: isSelected ? '#ECFDF5' : '#FAF8F5',
                          color: isSelected ? '#064E3B' : '#475569',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 800 : 600,
                          cursor: 'pointer'
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={genDescription}
                  onChange={(e) => setGenDescription(e.target.value)}
                  placeholder="e.g. Near Window, Ground Floor Family Section"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#0F172A',
                    background: '#FFFFFF',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* STEP 2: QR TYPE (Plan-Aware) */}
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
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#064E3B', color: '#FFF', fontSize: '0.74rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  2
                </div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 900 }}>
                  QR Type & Experience
                </strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Menu QR Card */}
                <div
                  onClick={() => setGenQrType('menu')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: genQrType === 'menu' ? '2px solid #064E3B' : '1px solid #EAE5DF',
                    background: genQrType === 'menu' ? '#F0FDF4' : '#FAF8F5',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800 }}>MENU QR</strong>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: '6px' }}>Available</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    View digital menu, dish photos & business information without ordering.
                  </span>
                </div>

                {/* Ordering QR Card (Plan-Aware) */}
                <div
                  onClick={() => {
                    if (isDirectOrderingAvailable) {
                      setGenQrType('ordering');
                    } else if (onUpgrade) {
                      onUpgrade();
                    }
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: genQrType === 'ordering' ? '2px solid #064E3B' : '1px solid #EAE5DF',
                    background: genQrType === 'ordering' ? '#F0FDF4' : '#FAF8F5',
                    cursor: 'pointer',
                    position: 'relative',
                    opacity: isDirectOrderingAvailable ? 1 : 0.85,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800 }}>ORDERING QR</strong>
                    {isDirectOrderingAvailable ? (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: '6px' }}>Live Order</span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#D97706', background: '#FEF3C7', padding: '1px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Lock size={10} /> Pro Plan
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.35, display: 'block' }}>
                    Direct ordering experience. Customers add items and send tickets directly to kitchen.
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 3: SPACE IDENTIFIER */}
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
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#064E3B', color: '#FFF', fontSize: '0.74rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  3
                </div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 900 }}>
                  Space Identifier
                </strong>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Table / Space Identifier
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={genIdentifier}
                    onChange={(e) => setGenIdentifier(e.target.value)}
                    placeholder="e.g. MH-01, Table 1, Room 204"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = parseInt(genIdentifier) || 0;
                      setGenIdentifier(String(num + 1));
                    }}
                    style={{ padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FAF8F5', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    + Next
                  </button>
                </div>
                <span style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Used to identify this space in orders, receipts and kitchen display operations.
                </span>
              </div>
            </div>

            {/* STEP 4: QR APPEARANCE */}
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
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#064E3B', color: '#FFF', fontSize: '0.74rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  4
                </div>
                <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 900 }}>
                  QR Appearance & Styling
                </strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* QR Color Picker */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    QR Color
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { label: 'Forest Green', hex: '#064E3B' },
                      { label: 'Charcoal Black', hex: '#0F172A' },
                      { label: 'Royal Gold', hex: '#D97706' }
                    ].map(col => (
                      <div
                        key={col.hex}
                        onClick={() => setQrColor(col.hex)}
                        title={col.label}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: col.hex,
                          cursor: 'pointer',
                          border: qrColor === col.hex ? '3px solid #FFFFFF' : '2px solid transparent',
                          boxShadow: qrColor === col.hex ? '0 0 0 2px #064E3B' : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Include Logo Toggle */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    TouchQR Logo Branding
                  </label>
                  <button
                    type="button"
                    onClick={() => setIncludeLogo(!includeLogo)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: includeLogo ? '#ECFDF5' : '#FAF8F5',
                      color: includeLogo ? '#059669' : '#64748B',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {includeLogo ? '✓ Branding Active' : '○ Disabled'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Live QR Preview & Download Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* LIVE QR PREVIEW CARD */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                QR Code Preview
              </span>

              {/* QR Container */}
              <div style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: '16px',
                border: '2px solid #EAE5DF',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                marginBottom: '12px'
              }}>
                <img
                  src={currentQrImgUrl}
                  alt="Generated Space QR"
                  style={{ width: '180px', height: '180px', display: 'block' }}
                />
              </div>

              <div style={{
                display: 'inline-block',
                background: '#064E3B',
                color: '#FFFFFF',
                padding: '3px 12px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 900,
                marginBottom: '4px'
              }}>
                {genSpaceName.toUpperCase()} · {genIdentifier}
              </div>

              <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                {settingsForm?.name || restaurantInfo?.name || 'TouchQR Restaurant'}
              </h4>
              <span style={{ fontSize: '0.70rem', color: '#64748B', marginBottom: '12px', display: 'block' }}>
                Scan with your smartphone camera to test
              </span>

              {/* Test Button */}
              <div style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowTestModal(true)}
                  style={{
                    flex: 1,
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FAF8F5',
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
                  <Eye size={14} />
                  <span>Test QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    flex: 1,
                    height: '36px',
                    borderRadius: '8px',
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
                  {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* DOWNLOAD / PRINT ACTIONS */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Download & Print
              </span>

              <button
                type="button"
                onClick={() => handleDownloadQr('PNG')}
                style={{
                  width: '100%',
                  height: '40px',
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
                <span>Download QR Code (PNG)</span>
              </button>

              <button
                type="button"
                onClick={() => onPrintQR(genIdentifier, genSpaceType)}
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
                  marginTop: '4px'
                }}
              >
                <Sparkles size={14} color="#059669" />
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
              <img src={currentQrImgUrl} alt="Test QR" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>

            <div style={{ fontSize: '0.74rem', color: '#64748B', wordBreak: 'break-all', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              {currentTargetUrl}
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
                href={currentTargetUrl}
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
