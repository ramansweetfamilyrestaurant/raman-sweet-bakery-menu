import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function FAQ({ trialDays = 16 }) {
  const [openIndex, setOpenIndex] = useState(0);

  const faqItems = [
    {
      q: `What is included in the ${trialDays}-Day Free Trial?`,
      a: `You get full access to all SaaS features for ${trialDays} days, including Digital QR Menu & Catalog Creation, Multi-Space Ordering (Tables, Rooms, Seats, Counters), ⭐ Smart AI Google Reviews Booster, Live Dispatch Siren Alarm, and Thermal Printing. No credit card required!`
    },
    {
      q: 'Do customers need to download an app to scan the QR Code?',
      a: 'No app download is required! Customers simply scan the QR code on a dining table, hotel room standee, cinema seat, or counter using their smartphone camera, and your digital catalog loads in less than 0.3 seconds.'
    },
    {
      q: 'Does TouchQR work for Hotels, Cinemas, and Bakeries too?',
      a: 'Yes! TouchQR is natively engineered for multi-business operations. You can configure Dine-in Tables, Hotel Guest Rooms (24x7 in-room dining), Cinema Audi Seats (concession delivery), or Express Counters with portion or weight-based pricing (250g, 500g, 1kg).'
    },
    {
      q: 'How does Live Ordering & Kitchen/Dispatch KOT work?',
      a: 'When an order is placed, it immediately triggers an audio siren alert on your kitchen, room service, or concession dispatch screen and auto-prints a thermal receipt with complete itemization.'
    },
    {
      q: 'Can I connect Bluetooth or USB Thermal Receipt Printers?',
      a: 'Yes! TouchQR supports 2-inch and 3-inch Bluetooth and USB thermal printers directly from mobile phones or desktop PCs for instant 0.5-second order chits & GST billing.'
    },
    {
      q: 'Can I change or upgrade my plan anytime?',
      a: 'Absolutely. You can upgrade, downgrade, or switch between Basic, Pro, and Enterprise plans at any time directly from your owner dashboard.'
    }
  ];

  return (
    <section id="faq" className="km-faq-section">
      <div className="km-container">
        <div className="km-section-header">
          <div className="km-badge">
            <span>❓ FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="km-title-lg">Everything You Need to Know</h2>
          <p className="km-subtitle">
            Got questions? We have answers. If you need further help, feel free to contact our team.
          </p>
        </div>

        <div className="km-faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`km-faq-item ${isOpen ? 'active' : ''}`}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <div className="km-faq-question">
                  <span>{item.q}</span>
                  {isOpen ? <Minus size={18} color="#D4AF37" /> : <Plus size={18} color="#64748B" />}
                </div>

                {isOpen && (
                  <div className="km-faq-answer">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
