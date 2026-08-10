import React from 'react';
import { QrCode, Printer, Plus, Trash2, ExternalLink, Copy, Check } from 'lucide-react';

export default function QrGeneratorView({
  tableNumber,
  setTableNumber,
  totalTablesCount,
  onAddTable,
  onDeleteTable,
  onPrintQR,
  onPrintAllQRs,
  settingsForm,
  onReturnToMenu
}) {
  const [copied, setCopied] = React.useState(false);
  const liveOrigin = window.location.origin;
  const activeTableNum = tableNumber || '1';
  const targetUrl = `${liveOrigin}/${settingsForm?.slug || 'raman-sweet-bakery'}?table=${activeTableNum}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            📱 Dining Table QR Standee Generator
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Generate gold-framed QR standees for dining tables and contactless menu scanning.
          </span>
        </div>

        <button onClick={onPrintAllQRs} className="adm-btn adm-btn-accent" style={{ fontWeight: 800 }}>
          <Printer size={16} /> Print All Table QRs ({totalTablesCount} Standees)
        </button>
      </div>

      {/* Control Strip & Table Stepper */}
      <div className="adm-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <strong style={{ fontSize: '0.95rem', color: 'var(--adm-primary)', display: 'block' }}>
            Dining Hall Configuration ({totalTablesCount} Total Tables)
          </strong>
          <span style={{ fontSize: '0.78rem', color: 'var(--adm-muted)' }}>
            Select a table number to preview or print its custom standee sticker.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onDeleteTable} className="adm-btn adm-btn-danger adm-btn-sm" title="Remove Last Table">
            <Trash2 size={15} /> Remove Table
          </button>
          <button onClick={onAddTable} className="adm-btn adm-btn-primary adm-btn-sm" title="Add New Table">
            <Plus size={15} /> Add Table
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Left Column: Table Selector & URL Controls */}
        <div className="adm-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adm-primary)', margin: 0 }}>
            Table Standee Selection
          </h3>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>
              SELECT TABLE NUMBER FOR PREVIEW:
            </label>
            <select
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--adm-radius-md)',
                border: '1px solid var(--adm-border)',
                fontSize: '0.95rem',
                fontWeight: 800,
                color: 'var(--adm-primary)',
                background: '#FFF'
              }}
            >
              {Array.from({ length: Math.max(totalTablesCount, 1) }, (_, i) => String(i + 1)).map(tNum => (
                <option key={tNum} value={tNum}>Table #{tNum}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--adm-muted)', display: 'block', marginBottom: '6px' }}>
              TABLE MENU DIRECT URL:
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
            <button onClick={() => onPrintQR(tableNumber)} className="adm-btn adm-btn-primary" style={{ padding: '12px', fontWeight: 800 }}>
              <Printer size={16} /> Print Table #{activeTableNum} QR Standee
            </button>
            <button onClick={() => onReturnToMenu && onReturnToMenu(settingsForm?.slug)} className="adm-btn adm-btn-secondary" style={{ padding: '10px', fontWeight: 700 }}>
              <ExternalLink size={15} /> Open Live Customer Menu Preview ➔
            </button>
          </div>
        </div>

        {/* Right Column: Live Gold-Framed Standee Preview Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
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
              TABLE NO. {activeTableNum}
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0A2315', margin: '0 0 4px 0' }}>
              {settingsForm?.name || 'Digital Menu'}
            </h3>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16A34A', display: 'block', marginBottom: '12px' }}>
              {settingsForm?.tagline || 'Scan QR Code for Digital Menu'}
            </span>

            <div style={{ background: '#FFF', padding: '12px', borderRadius: '14px', border: '1px solid #E2E8E3', display: 'inline-block', marginBottom: '12px' }}>
              <img src={qrImgUrl} alt="Table QR" style={{ width: '170px', height: '170px', display: 'block' }} />
            </div>

            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0A2315', marginBottom: '2px' }}>
              📱 SCAN FOR DIGITAL MENU & ORDER
            </div>
            <div style={{ fontSize: '0.78rem', color: '#68756D', fontWeight: 600 }}>
              स्कैन करें और डिजिटल मेन्यू देखें
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
