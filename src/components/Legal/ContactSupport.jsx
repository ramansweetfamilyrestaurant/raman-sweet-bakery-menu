import React, { useState, useEffect } from 'react';
import LegalPageLayout from './LegalPageLayout';
import { Mail, Phone, MessageSquare, Clock, CheckCircle, Send } from 'lucide-react';

export default function ContactSupport({ onOpenLogin, onStartTrial }) {
  const [supportPhone, setSupportPhone] = useState('919876543210');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'TouchQR - Contact & Support';
    window.scrollTo(0, 0);

    fetch('/api/keys')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) {
          setSupportPhone(data.support_whatsapp);
        }
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    restaurantName: '',
    subject: 'General Support',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) return;

    setLoading(true);

    // 1. Post to backend contact API if available
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch (err) {
      // Proceed even if backend API route is silent
    }

    // 2. Build WhatsApp support inquiry URL
    const targetPhone = supportPhone.replace(/[^0-9]/g, '') || '919876543210';
    const waText = `*New TouchQR Support Request*\n\n` +
      `👤 *Name:* ${formData.name}\n` +
      `📞 *Phone:* ${formData.phone}\n` +
      `🏪 *Restaurant:* ${formData.restaurantName || 'N/A'}\n` +
      `📌 *Topic:* ${formData.subject}\n\n` +
      `💬 *Message:* ${formData.message}`;

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(waText)}`;

    setSubmitted(true);
    setLoading(false);

    // Auto-open WhatsApp chat with support team
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 400);
  };

  return (
    <LegalPageLayout
      title="Contact TouchQR Support"
      categoryBadge="HELP CENTER"
      lastUpdated="August 10, 2026"
      onOpenLogin={onOpenLogin}
      onStartTrial={onStartTrial}
    >
      <section className="km-legal-section">
        <h2 className="km-legal-h2">How Can We Help You Today?</h2>
        <p className="km-legal-p">
          Whether you need assistance setting up your digital QR menu, configuring Bluetooth thermal printers, managing live KOT orders, or updating your subscription plan, our dedicated support team is here to assist your restaurant.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '24px 0' }}>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#D4AF37', marginBottom: '8px' }}><Phone size={20} /></div>
            <strong style={{ display: 'block', color: 'var(--km-text)', fontSize: '0.95rem' }}>Phone & WhatsApp Support</strong>
            <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Priority assistance for active Pro & Enterprise subscribers.</span>
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#10B981', marginBottom: '8px' }}><Clock size={20} /></div>
            <strong style={{ display: 'block', color: 'var(--km-text)', fontSize: '0.95rem' }}>Support Hours</strong>
            <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Monday to Saturday: 9:00 AM – 9:00 PM IST.</span>
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#6366F1', marginBottom: '8px' }}><MessageSquare size={20} /></div>
            <strong style={{ display: 'block', color: 'var(--km-text)', fontSize: '0.95rem' }}>Instant Menu Setup</strong>
            <span style={{ fontSize: '0.84rem', color: 'var(--km-muted)' }}>Start your 17-day free trial instantly without waiting.</span>
          </div>
        </div>

        {/* Contact Form Container */}
        <div style={{ background: 'var(--km-white)', border: '1.5px solid var(--km-border)', borderRadius: '16px', padding: '24px', marginTop: '32px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.03)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--km-green)', margin: '0 0 16px 0' }}>
            Send Us a Support Message
          </h3>

          {submitted ? (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#065F46' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 8px auto', display: 'block', color: '#10B981' }} />
              <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: '4px' }}>Support Request Received!</strong>
              <p style={{ fontSize: '0.88rem', margin: 0 }}>
                Thank you for contacting TouchQR. A customer support representative will review your message and reach out to your registered phone number shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--km-text)', marginBottom: '4px' }}>Your Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--km-text)', marginBottom: '4px' }}>Phone / WhatsApp Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--km-text)', marginBottom: '4px' }}>Restaurant Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Royal Spice Restaurant"
                  value={formData.restaurantName}
                  onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--km-text)', marginBottom: '4px' }}>Topic / Category</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.88rem', background: '#FFF' }}
                >
                  <option value="General Support">General Support</option>
                  <option value="Account & Login">Account & Owner Login</option>
                  <option value="Billing & Subscription">Billing & Subscription</option>
                  <option value="Menu Setup & QR Codes">Menu Setup & QR Codes</option>
                  <option value="Live Kitchen KOT & Printers">Live Kitchen KOT & Thermal Printers</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--km-text)', marginBottom: '4px' }}>Message Details *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="How can our support team assist your restaurant?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'var(--km-green)',
                  color: 'var(--km-gold)',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Send size={16} /> Submit Support Request
              </button>
            </form>
          )}
        </div>
      </section>
    </LegalPageLayout>
  );
}
