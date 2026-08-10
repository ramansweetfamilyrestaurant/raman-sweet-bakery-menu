import React from 'react';
import { QrCode, Printer, CheckCircle, Sparkles } from 'lucide-react';

export default function StandeePreview() {
  return (
    <section className="km-standee-section">
      <div className="km-container">
        <div className="km-standee-grid">
          {/* Left Text */}
          <div>
            <div className="km-badge">
              <Sparkles size={14} color="#D4AF37" />
              <span>HARDWARE & STANDEES READY</span>
            </div>
            <h2 className="km-title-lg">Table QR Standees & Bluetooth KOT Receipts</h2>
            <p className="km-subtitle">
              Print ready-to-use QR standees for your dining tables and pair 2-inch or 3-inch Bluetooth thermal printers in 1 tap.
            </p>

            <div className="km-standee-features">
              <div className="km-standee-feat-item">
                <CheckCircle size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong>Ready-to-Print Standee PDFs</strong>
                  <span>Download pre-designed acrylic & wooden QR standees directly from your dashboard.</span>
                </div>
              </div>

              <div className="km-standee-feat-item">
                <CheckCircle size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong>0.5s ESC/POS Thermal Receipts</strong>
                  <span>Auto-prints instant kitchen order tickets on Bluetooth & USB thermal receipt printers.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Mockup Cards */}
          <div className="km-standee-visual-box">
            {/* Mockup 1: Acrylic Table Standee */}
            <div className="km-standee-card">
              <div className="km-standee-header">
                <QrCode size={16} color="#D4AF37" />
                <span>TABLE #05 STANDEE</span>
              </div>
              <div className="km-standee-qr-box">
                <div className="km-standee-qr-frame">
                  {/* Clean SVG QR Code Graphic */}
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0A2315" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <path d="M14 14h3v3h-3z"></path>
                    <path d="M18 18h3v3h-3z"></path>
                    <path d="M14 18h.01"></path>
                    <path d="M18 14h.01"></path>
                  </svg>
                  <div className="km-standee-qr-badge">SCAN TO ORDER</div>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#FFF', marginTop: '10px' }}>
                  Royal Spice Restaurant
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Scan with camera or WhatsApp</span>
              </div>
            </div>

            {/* Mockup 2: Thermal KOT Ticket */}
            <div className="km-receipt-card">
              <div className="km-receipt-header">
                <Printer size={15} color="#10B981" />
                <span>THERMAL KOT RECEIPT</span>
              </div>
              <div className="km-receipt-body">
                <div className="km-receipt-line">
                  <span>KOT #104 • Table #5</span>
                  <strong>10:42 AM</strong>
                </div>
                <div className="km-receipt-divider" />
                <div className="km-receipt-item">
                  <span>1x Paneer Butter Masala</span>
                  <strong>FULL</strong>
                </div>
                <div className="km-receipt-item">
                  <span>4x Butter Tandoori Roti</span>
                  <strong>HOT</strong>
                </div>
                <div className="km-receipt-note">
                  * Note: Less spicy, extra butter
                </div>
                <div className="km-receipt-footer">
                  ⚡ PRINTED IN 0.5 SECONDS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
