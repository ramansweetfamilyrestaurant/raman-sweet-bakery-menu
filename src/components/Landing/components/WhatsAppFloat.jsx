import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppFloat() {
  const [supportPhone, setSupportPhone] = useState('919876543210');

  useEffect(() => {
    fetch('/api/keys')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) {
          setSupportPhone(data.support_whatsapp);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenWhatsApp = () => {
    const cleanPhone = supportPhone.replace(/[^0-9]/g, '') || '919876543210';
    const waText = encodeURIComponent('Hi TouchQR Team 👋 I want to know more about TouchQR digital menu for my restaurant.');
    window.open(`https://wa.me/${cleanPhone}?text=${waText}`, '_blank');
  };

  return (
    <div className="km-whatsapp-float" onClick={handleOpenWhatsApp} title="Chat with TouchQR Support">
      <div className="km-whatsapp-pulse" />
      <div className="km-whatsapp-icon">
        <MessageCircle size={24} color="#FFFFFF" />
      </div>
      <span className="km-whatsapp-tooltip">Chat with Us 👋</span>
    </div>
  );
}
