import React, { useState, useEffect, useMemo } from 'react';
import { QrCode, Printer, Plus, Trash2, ExternalLink, Copy, Check, ArrowLeft, ShieldCheck, Film, AlertTriangle } from 'lucide-react';
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
  onReturnToMenu,
  onBackToSetup,
  onUpdateSpaceType
}) {
  const [copied, setCopied] = useState(false);
  const liveOrigin = window.location.origin;
  const activeSlug = settingsForm?.slug || '';

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

  // 2. Resolve current space prefix, ensuring it is valid for this business
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
          } else {
            setSelectedRowLabel('');
            setSelectedSeatNum('');
          }
        }
      }).finally(() => {
        setLoadingCinema(false);
      });
    }
  }, [isCinema, token, activeSlug]);

  const handleScreenChange = (screenId) => {
    setSelectedScreenId(screenId);
    const screenSeats = cinemaSeats.filter(st => String(st.screen_id) === String(screenId));
    const rows = [...new Set(screenSeats.map(st => st.row_label).filter(Boolean))].sort();
    if (rows.length > 0) {
      setSelectedRowLabel(rows[0]);
      const rowSeats = screenSeats.filter(st => st.row_label === rows[0]).map(st => String(st.seat_number));
      setSelectedSeatNum(rowSeats[0] || '');
    } else {
      setSelectedRowLabel('');
      setSelectedSeatNum('');
    }
  };

  const handleRowChange = (rowLabel) => {
    setSelectedRowLabel(rowLabel);
    const rowSeats = cinemaSeats
      .filter(st => String(st.screen_id) === String(selectedScreenId) && st.row_label === rowLabel)
      .map(st => String(st.seat_number));
    setSelectedSeatNum(rowSeats[0] || '');
  };

  const currentScreenObj = cinemaScreens.find(s => String(s.id) === String(selectedScreenId)) || cinemaScreens[0];
  const screenNum = currentScreenObj ? String(currentScreenObj.screen_number) : '1';

  const availableRows = useMemo(() => {
    if (!selectedScreenId) return [];
    const screenSeats = cinemaSeats.filter(st => String(st.screen_id) === String(selectedScreenId));
    return [...new Set(screenSeats.map(st => st.row_label).filter(Boolean))].sort();
  }, [cinemaSeats, selectedScreenId]);

  const availableSeatsForRow = useMemo(() => {
    if (!selectedScreenId || !selectedRowLabel) return [];
    return cinemaSeats
      .filter(st => String(st.screen_id) === String(selectedScreenId) && st.row_label === selectedRowLabel)
      .map(st => String(st.seat_number))
      .sort((a, b) => Number(a) - Number(b));
  }, [cinemaSeats, selectedScreenId, selectedRowLabel]);

  // Validate that the selected cinema seat physically exists in DB
  const matchingSeatInDb = cinemaSeats.find(st => 
    String(st.screen_id) === String(selectedScreenId) && 
    st.row_label === selectedRowLabel && 
    String(st.seat_number) === String(selectedSeatNum)
  );

  const isCinemaSeatValid = isCinema ? (Boolean(matchingSeatInDb) && Boolean(currentScreenObj)) : false;
  const totalCinemaSeatsCount = cinemaSeats.filter(st => st.active !== false).length;

  // 4. Counts per Space Type
  const spaceCounts = {
    table: Number(settingsForm?.total_tables) || 0,
    cabin: Number(settingsForm?.total_cabins) || 0,
    room: Number(settingsForm?.total_rooms) || 0,
    vip: Number(settingsForm?.total_vip) || 0,
    cinema_seat: totalCinemaSeatsCount
  };

  const currentCount = isCinema ? totalCinemaSeatsCount : (spaceCounts[currentPrefix] !== undefined ? spaceCounts[currentPrefix] : (totalTablesCount || 0));
  const hasTables = isCinema ? isCinemaSeatValid : currentCount > 0;

  const activeTableNum = isCinema 
    ? (isCinemaSeatValid ? `S${screenNum}-${selectedRowLabel}-${selectedSeatNum}` : '')
    : (hasTables ? (tableNumber || '1') : '');

  const secretKey = settingsForm?.qr_secret || `${settingsForm?.id || 1}_${activeSlug}_tq`;
  const qrSig = hasTables ? generateQrToken(activeSlug, isCinema ? 'cinema_seat' : spaceConfig.param, activeTableNum, secretKey) : '';

  const targetUrl = hasTables 
    ? (isCinema 
        ? `${liveOrigin}/${activeSlug}?cinema=${encodeURIComponent(activeTableNum)}&tkn=${qrSig}`
        : `${liveOrigin}/${activeSlug}?${spaceConfig.param}=${activeTableNum}&tkn=${qrSig}`)
    : `${liveOrigin}/${activeSlug}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

  const handleSpaceTypeClick = (typeId) => {
    if (activeSlug) {
      localStorage.setItem(`touchqr_table_prefix_${activeSlug}`, typeId);
    }
    if (onUpdateSpaceType) {
      onUpdateSpaceType(typeId);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBulkPrintDisabled = isCinema ? totalCinemaSeatsCount === 0 : currentCount === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBackToSetup && (
            <button onClick={() => onBackToSetup(isCinema ? 'cinema' : null)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ fontWeight: 800 }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
              📱 QR Standee & Space QR Generator
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
              Generate secure QR codes for your configured physical spaces.
            </span>
          </div>
        </div>

        <button
          onClick={() => onPrintAllQRs && onPrintAllQRs(currentPrefix, isCinema ? cinemaSeats : null)}
          disabled={isBulkPrintDisabled}
          className="adm-btn adm-btn-accent"
          style={{ fontWeight: 800, opacity: isBulkPrintDisabled ? 0.5 : 1, cursor: isBulkPrintDisabled ? 'not-allowed' : 'pointer' }}
        >
          <Printer size={16} /> Print All {spaceConfig.plural} ({isCinema ? totalCinemaSeatsCount : currentCount} Standees)
        </button>
      </div>

      {/* Space Type Selector Strip (Strictly Filtered by Business Type + Service Model) */}
      <div className="adm-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            SELECT DINING / SERVICE SPACE TYPE:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {availableSpaceTypes.map(item => {
              const isActive = currentPrefix === item.id;
              const count = spaceCounts[item.id] || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSpaceTypeClick(item.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    border: isActive ? '2px solid var(--adm-primary)' : '1px solid var(--adm-border)',
                    background: isActive ? 'var(--adm-primary)' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : 'var(--adm-text)',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 8px rgba(10,35,21,0.15)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--adm-surface-subtle)',
                    color: isActive ? '#FFFFFF' : 'var(--adm-muted)',
                    fontWeight: 900
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Capacity Stepper Strip (Hidden for Cinema) */}
        {!isCinema && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--adm-border)', paddingTop: '14px' }}>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--adm-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Total {spaceConfig.plural}:</span>
                <span style={{ background: hasTables ? 'var(--adm-primary)' : '#9CA3AF', color: '#FFFFFF', padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.82rem', fontWeight: 900 }}>
                  {currentCount} Total {currentCount === 1 ? spaceConfig.singular : spaceConfig.plural}
                </span>
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--adm-muted)' }}>
                {hasTables 
                  ? `Manage total ${spaceConfig.plural.toLowerCase()} or generate instant custom QR stickers.`
                  : `Click "+ Add ${spaceConfig.singular}" below to configure your spaces.`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => onDeleteTable && onDeleteTable(tableNumber || currentCount, currentPrefix)}
                disabled={!hasTables}
                className="adm-btn adm-btn-danger adm-btn-sm"
                title={`Remove ${spaceConfig.singular}`}
                style={{ opacity: !hasTables ? 0.5 : 1, cursor: !hasTables ? 'not-allowed' : 'pointer' }}
              >
                <Trash2 size={15} /> Remove {spaceConfig.singular}
              </button>

              <button
                onClick={() => onAddTable && onAddTable(null, currentPrefix)}
                className="adm-btn adm-btn-primary adm-btn-sm"
                title={`Add Next ${spaceConfig.singular}`}
              >
                <Plus size={15} /> Add {spaceConfig.singular}
              </button>
            </div>
          </div>
        )}

        {/* Quick Batch Presets (Hidden for Cinema) */}
        {!isCinema && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid var(--adm-border)', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
              Quick Set:
            </span>
            {[5, 10, 15, 20, 30].map(count => (
              <button
                key={count}
                type="button"
                onClick={() => onAddTable && onAddTable(count, currentPrefix)}
                className="adm-btn adm-btn-secondary adm-btn-sm"
                style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800 }}
              >
                Set {count} {spaceConfig.plural}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Preview Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Left Column: Space Selector & URL Controls */}
        <div className="adm-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adm-primary)', margin: 0 }}>
            {spaceConfig.singular} QR Selection
          </h3>

          {isCinema ? (
            <div>
              {loadingCinema ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--adm-muted)', fontSize: '0.85rem' }}>
                  ⏳ Loading configured auditorium screens and seats from database...
                </div>
              ) : cinemaScreens.length === 0 ? (
                <div style={{ padding: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🎬</div>
                  <strong style={{ display: 'block', color: '#991B1B', fontSize: '0.9rem', marginBottom: '4px' }}>
                    No Cinema Screens Configured Yet
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#B91C1C', display: 'block', marginBottom: '12px' }}>
                    Please add screens and seats in Cinema Management before generating seat QR codes.
                  </span>
                  {onBackToSetup && (
                    <button onClick={() => onBackToSetup('cinema')} className="adm-btn adm-btn-primary adm-btn-sm" style={{ fontWeight: 800 }}>
                      Go to Cinema Management ➔
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
                        SCREEN:
                      </label>
                      <select
                        value={selectedScreenId}
                        onChange={(e) => handleScreenChange(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--adm-border)', fontWeight: 800 }}
                      >
                        {cinemaScreens.map(s => (
                          <option key={s.id} value={s.id}>Screen {s.screen_number} {s.name ? `(${s.name})` : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
                        ROW:
                      </label>
                      <select
                        value={selectedRowLabel}
                        onChange={(e) => handleRowChange(e.target.value)}
                        disabled={availableRows.length === 0}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--adm-border)', fontWeight: 800 }}
                      >
                        {availableRows.length > 0 ? (
                          availableRows.map(r => (
                            <option key={r} value={r}>Row {r}</option>
                          ))
                        ) : (
                          <option value="">No rows</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '4px' }}>
                        SEAT:
                      </label>
                      <select
                        value={selectedSeatNum}
                        onChange={(e) => setSelectedSeatNum(e.target.value)}
                        disabled={availableSeatsForRow.length === 0}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--adm-border)', fontWeight: 800 }}
                      >
                        {availableSeatsForRow.length > 0 ? (
                          availableSeatsForRow.map(sn => (
                            <option key={sn} value={sn}>Seat {sn}</option>
                          ))
                        ) : (
                          <option value="">No seats</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {!isCinemaSeatValid && (
                    <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '0.78rem', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={15} color="#D97706" />
                      <span>This cinema seat is not configured in the database inventory.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>
                SELECT {spaceConfig.singular.toUpperCase()} FOR PREVIEW:
              </label>
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                disabled={!hasTables}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--adm-radius-md)',
                  border: '1px solid var(--adm-border)',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: 'var(--adm-primary)',
                  background: '#FFF',
                  opacity: !hasTables ? 0.6 : 1
                }}
              >
                {hasTables ? (
                  Array.from({ length: currentCount }, (_, i) => String(i + 1)).map(tNum => (
                    <option key={tNum} value={tNum}>{spaceConfig.singular} {tNum}</option>
                  ))
                ) : (
                  <option value="">No {spaceConfig.plural.toLowerCase()} configured</option>
                )}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>
              {hasTables ? `${spaceConfig.singular.toUpperCase()} MENU DIRECT URL:` : 'GENERAL RESTAURANT MENU URL:'}
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                readOnly
                value={targetUrl}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.78rem', background: 'var(--adm-surface-subtle)' }}
              />
              <button onClick={handleCopyLink} className="adm-btn adm-btn-secondary adm-btn-sm">
                {copied ? <Check size={14} color="var(--adm-success)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={() => onPrintQR(activeTableNum, currentPrefix)}
              disabled={!hasTables}
              className="adm-btn adm-btn-primary"
              style={{ padding: '12px', fontWeight: 800, opacity: !hasTables ? 0.5 : 1, cursor: !hasTables ? 'not-allowed' : 'pointer' }}
            >
              <Printer size={16} /> {hasTables ? `Print ${spaceConfig.singular} (${activeTableNum}) QR Standee` : `No ${spaceConfig.plural} to Print`}
            </button>
            <button onClick={() => onReturnToMenu && onReturnToMenu(settingsForm?.slug)} className="adm-btn adm-btn-secondary" style={{ padding: '10px', fontWeight: 700 }}>
              <ExternalLink size={15} /> Open Live Customer Menu Preview ➔
            </button>
          </div>
        </div>

        {/* Right Column: Live Gold-Framed Standee Preview Canvas or Empty State */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {hasTables ? (
            <div style={{
              width: '320px',
              padding: '24px 20px',
              borderRadius: '20px',
              border: '3px double #D4AF37',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%)',
              textAlign: 'center',
              boxShadow: 'var(--adm-shadow-md)',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'inline-block',
                background: '#0A2315',
                color: '#D4AF37',
                padding: '4px 18px',
                borderRadius: '9999px',
                fontSize: isCinema ? '0.82rem' : '0.95rem',
                fontWeight: 800,
                border: '1.5px solid #D4AF37',
                letterSpacing: isCinema ? '0.5px' : '1px',
                marginBottom: '12px'
              }}>
                {isCinema 
                  ? `🎬 SCREEN ${screenNum} • ROW ${selectedRowLabel} • SEAT ${selectedSeatNum}`
                  : `${spaceConfig.badge} ${activeTableNum}`}
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0A2315', margin: '0 0 4px 0' }}>
                {settingsForm?.name || 'Digital Menu'}
              </h3>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16A34A', display: 'block', marginBottom: '12px' }}>
                {settingsForm?.tagline || (isCinema ? 'In-Seat Food Ordering' : 'Scan QR Code for Digital Menu')}
              </span>

              <div style={{ background: '#FFF', padding: '12px', borderRadius: '14px', border: '1px solid #E2E8E3', display: 'inline-block', marginBottom: '12px' }}>
                <img src={qrImgUrl} alt={`${spaceConfig.singular} QR`} style={{ width: '170px', height: '170px', display: 'block' }} />
              </div>

              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0A2315', marginBottom: '2px' }}>
                {isCinema ? '📱 SCAN FOR IN-SEAT FOOD ORDERING' : '📱 SCAN FOR DIGITAL MENU & ORDER'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#68756D', fontWeight: 600, marginBottom: '6px' }}>
                {isCinema ? 'स्कैन करें और सीट पर खाना मंगाएं' : 'स्कैन करें और डिजिटल मेन्यू देखें'}
              </div>
              {(settingsForm?.address || settingsForm?.phone) && (
                <div style={{ fontSize: '0.68rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '4px' }}>
                  {settingsForm.address || ''} {settingsForm.phone ? `• Phone: ${settingsForm.phone}` : ''}
                </div>
              )}
              {!settingsForm?.watermark_removal_enabled && (
                <div style={{ fontSize: '0.64rem', color: '#15803D', fontWeight: 800, marginTop: '4px' }}>
                  ⚡ Powered by TouchQR
                </div>
              )}
            </div>
          ) : (
            <div style={{
              width: '320px',
              minHeight: '420px',
              padding: '32px 20px',
              borderRadius: '20px',
              border: '2px dashed #CBD5E1',
              background: '#FFFFFF',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: 'var(--adm-shadow-sm)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--adm-surface-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                border: '1.5px solid var(--adm-border)'
              }}>
                {isCinema ? '🎬' : '🍽️'}
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--adm-primary)' }}>
                No {spaceConfig.plural} Configured
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--adm-muted)', lineHeight: 1.5, maxWidth: '240px' }}>
                {isCinema 
                  ? 'You currently have 0 active cinema seats. Please configure auditorium screens and seats in Cinema Management.'
                  : `You currently have 0 ${spaceConfig.plural.toLowerCase()}. Click + Add ${spaceConfig.singular} to generate your first custom QR standee!`}
              </p>
              {!isCinema && (
                <button
                  onClick={() => onAddTable && onAddTable(1, currentPrefix)}
                  className="adm-btn adm-btn-primary"
                  style={{ marginTop: '8px', padding: '10px 18px', fontWeight: 800 }}
                >
                  <Plus size={16} /> Add {spaceConfig.singular} 1 Now
                </button>
              )}
              {isCinema && onBackToSetup && (
                <button
                  onClick={() => onBackToSetup('cinema')}
                  className="adm-btn adm-btn-primary"
                  style={{ marginTop: '8px', padding: '10px 18px', fontWeight: 800 }}
                >
                  Go to Cinema Management ➔
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

