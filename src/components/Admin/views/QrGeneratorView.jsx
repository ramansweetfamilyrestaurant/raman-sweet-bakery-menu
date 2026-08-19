import React from 'react';
import { QrCode, Printer, Plus, Trash2, ExternalLink, Copy, Check, ArrowLeft } from 'lucide-react';

export default function QrGeneratorView({
  tableNumber,
  setTableNumber,
  totalTablesCount,
  onAddTable,
  onDeleteTable,
  onPrintQR,
  onPrintAllQRs,
  settingsForm,
  onReturnToMenu,
  onBackToSetup,
  onUpdateSpaceType
}) {
  const [copied, setCopied] = React.useState(false);
  const liveOrigin = window.location.origin;
  const hasTables = totalTablesCount > 0;
  const activeTableNum = hasTables ? (tableNumber || '1') : '';
  const activeSlug = settingsForm?.slug || '';
  const targetUrl = hasTables 
    ? `${liveOrigin}/${activeSlug}?table=${activeTableNum}`
    : `${liveOrigin}/${activeSlug}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

  const [localPrefix, setLocalPrefix] = React.useState(() => {
    return settingsForm?.table_prefix || (settingsForm?.slug ? localStorage.getItem(`touchqr_table_prefix_${settingsForm.slug}`) : null) || 'table';
  });

  React.useEffect(() => {
    if (settingsForm?.table_prefix) {
      setLocalPrefix(settingsForm.table_prefix);
    }
  }, [settingsForm?.table_prefix]);

  const currentPrefix = (localPrefix || settingsForm?.table_prefix || 'table').toLowerCase();

  const getSpaceConfig = (type) => {
    const t = String(type || 'table').toLowerCase();
    if (t === 'cabin') return { singular: 'Cabin', plural: 'Cabins', badge: 'CABIN NO.' };
    if (t === 'room') return { singular: 'Room', plural: 'Rooms', badge: 'ROOM NO.' };
    if (t === 'vip') return { singular: 'VIP Lounge', plural: 'VIP Lounges', badge: 'VIP LOUNGE' };
    return { singular: 'Table', plural: 'Tables', badge: 'TABLE NO.' };
  };

  const spaceConfig = getSpaceConfig(currentPrefix);

  const handleSpaceTypeClick = (typeId) => {
    setLocalPrefix(typeId);
    if (settingsForm?.slug) {
      localStorage.setItem(`touchqr_table_prefix_${settingsForm.slug}`, typeId);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBackToSetup && (
            <button onClick={onBackToSetup} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ fontWeight: 800 }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
              📱 QR Standee & Table Sticker Generator
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
              Generate gold-framed QR standees for Tables, Private Cabins, and Hotel Rooms.
            </span>
          </div>
        </div>

        <button
          onClick={onPrintAllQRs}
          disabled={!hasTables}
          className="adm-btn adm-btn-accent"
          style={{ fontWeight: 800, opacity: !hasTables ? 0.5 : 1, cursor: !hasTables ? 'not-allowed' : 'pointer' }}
        >
          <Printer size={16} /> Print All {spaceConfig.plural} ({totalTablesCount} Standees)
        </button>
      </div>

      {/* Space Type Selector Strip */}
      <div className="adm-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            SELECT DINING / SERVICE SPACE TYPE:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'table', label: '🍽️ Dining Table' },
              { id: 'cabin', label: '🛋️ Private Cabin' },
              { id: 'room', label: '🏨 Hotel Room' },
              { id: 'vip', label: '👑 VIP Lounge' }
            ].map(item => {
              const isActive = currentPrefix === item.id;
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
                    boxShadow: isActive ? '0 2px 8px rgba(10,35,21,0.15)' : 'none'
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Capacity Stepper Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--adm-border)', paddingTop: '14px' }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--adm-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Total {spaceConfig.plural}:</span>
              <span style={{ background: hasTables ? 'var(--adm-primary)' : '#9CA3AF', color: '#FFFFFF', padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.82rem', fontWeight: 900 }}>
                {totalTablesCount} Total {totalTablesCount === 1 ? spaceConfig.singular : spaceConfig.plural}
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
              onClick={() => onDeleteTable && onDeleteTable(tableNumber || totalTablesCount)}
              disabled={!hasTables}
              className="adm-btn adm-btn-danger adm-btn-sm"
              title={`Remove ${spaceConfig.singular}`}
              style={{ opacity: !hasTables ? 0.5 : 1, cursor: !hasTables ? 'not-allowed' : 'pointer' }}
            >
              <Trash2 size={15} /> Remove {spaceConfig.singular}
            </button>

            <button
              onClick={() => onAddTable && onAddTable()}
              className="adm-btn adm-btn-primary adm-btn-sm"
              title={`Add Next ${spaceConfig.singular}`}
            >
              <Plus size={15} /> Add {spaceConfig.singular}
            </button>
          </div>
        </div>

        {/* Quick Batch Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid var(--adm-border)', paddingTop: '10px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--adm-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
            Quick Set:
          </span>
          {[5, 10, 15, 20, 30].map(count => (
            <button
              key={count}
              type="button"
              onClick={() => onAddTable && onAddTable(count)}
              className="adm-btn adm-btn-secondary adm-btn-sm"
              style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800 }}
            >
              Set {count} {spaceConfig.plural}
            </button>
          ))}
        </div>
      </div>

      {/* Main Preview Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Left Column: Space Selector & URL Controls */}
        <div className="adm-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adm-primary)', margin: 0 }}>
            {spaceConfig.singular} Standee Selection
          </h3>

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
                Array.from({ length: totalTablesCount }, (_, i) => String(i + 1)).map(tNum => (
                  <option key={tNum} value={tNum}>{spaceConfig.singular} {tNum}</option>
                ))
              ) : (
                <option value="">No {spaceConfig.plural.toLowerCase()} configured</option>
              )}
            </select>
          </div>

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
              onClick={() => onPrintQR(tableNumber)}
              disabled={!hasTables}
              className="adm-btn adm-btn-primary"
              style={{ padding: '12px', fontWeight: 800, opacity: !hasTables ? 0.5 : 1, cursor: !hasTables ? 'not-allowed' : 'pointer' }}
            >
              <Printer size={16} /> {hasTables ? `Print ${spaceConfig.singular} ${activeTableNum} QR Standee` : `No ${spaceConfig.plural} to Print`}
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
                fontSize: '0.95rem',
                fontWeight: 800,
                border: '1.5px solid #D4AF37',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                {spaceConfig.badge} {activeTableNum}
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0A2315', margin: '0 0 4px 0' }}>
                {settingsForm?.name || 'Digital Menu'}
              </h3>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16A34A', display: 'block', marginBottom: '12px' }}>
                {settingsForm?.tagline || 'Scan QR Code for Digital Menu'}
              </span>

              <div style={{ background: '#FFF', padding: '12px', borderRadius: '14px', border: '1px solid #E2E8E3', display: 'inline-block', marginBottom: '12px' }}>
                <img src={qrImgUrl} alt={`${spaceConfig.singular} QR`} style={{ width: '170px', height: '170px', display: 'block' }} />
              </div>

              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0A2315', marginBottom: '2px' }}>
                📱 SCAN FOR DIGITAL MENU & ORDER
              </div>
              <div style={{ fontSize: '0.78rem', color: '#68756D', fontWeight: 600, marginBottom: '6px' }}>
                स्कैन करें और डिजिटल मेन्यू देखें
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
                🍽️
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--adm-primary)' }}>
                No {spaceConfig.plural} Configured
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--adm-muted)', lineHeight: 1.5, maxWidth: '240px' }}>
                You currently have <strong>0 {spaceConfig.plural.toLowerCase()}</strong>. Click <strong>+ Add {spaceConfig.singular}</strong> to generate your first custom QR standee!
              </p>
              <button
                onClick={() => onAddTable && onAddTable(1)}
                className="adm-btn adm-btn-primary"
                style={{ marginTop: '8px', padding: '10px 18px', fontWeight: 800 }}
              >
                <Plus size={16} /> Add {spaceConfig.singular} 1 Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
