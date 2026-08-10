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
            <h2 className="km-title-lg">Beautiful Table QR Standees & Instant Thermal Receipts</h2>
            <p className="km-subtitle">
              TouchQR comes pre-designed for real Indian restaurant tables. Print high-resolution QR standees for your dining tables and pair 2-inch/3-inch Bluetooth thermal receipt printers in seconds.
            </p>

            <div className="km-standee-features">
              <div className="km-standee-feat-item">
                <CheckCircle size={18} color="#10B981" />
                <div>
                  <strong>High-Resolution Table Standee PDF Downloads</strong>
                  <span>Download ready-to-print acrylic and wooden QR table standee designs directly from your owner dashboard.</span>
                </div>
              </div>

              <div className="km-standee-feat-item">
                <CheckCircle size={18} color="#10B981" />
                <div>
                  <strong>Bluetooth & USB Thermal KOT Receipts</strong>
                  <span>Prints 0.5s instant kitchen tickets on ESC/POS thermal printers without complex drivers.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Mockup Cards */}
          <div className="km-standee-visual-box">
            {/* Mockup 1: Acrylic Table Standee */}
            <div className="km-standee-card">
              <div className="km-standee-header">
                <QrCode size={18} color="#D4AF37" />
                <span>TABLE #05 STANDEE</span>
              </div>
              <div className="km-standee-qr-box">
                <div className="km-standee-qr-frame">
                  <span style={{ fontSize: '2.5rem' }}>📱</span>
                  <div className="km-standee-qr-badge">SCAN TO ORDER</div>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#FFF', marginTop: '10px' }}>
                  Royal Spice Family Restaurant
                </div>
                <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Scan with camera or WhatsApp</span>
              </div>
            </div>

            {/* Mockup 2: Thermal KOT Ticket */}
            <div className="km-receipt-card">
              <div className="km-receipt-header">
                <Printer size={16} color="#10B981" />
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
                  * Note: Less spicy, extra butter on roti
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
