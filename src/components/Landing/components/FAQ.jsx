import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function FAQ({ trialDays = 17 }) {
  const [openIndex, setOpenIndex] = useState(0);

  const faqItems = [
    {
      q: `What is included in the ${trialDays}-Day Free Trial?`,
      a: `You get full access to all SaaS features for ${trialDays} days, including Digital QR Menu Creation, Direct Table Ordering, ⭐ Smart AI Google Reviews Booster, Live Kitchen Siren Alarm, and Thermal Printing. No credit card is required to sign up!`
    },
    {
      q: 'Do customers need to download an app to use the QR Menu?',
      a: 'No app download is required! Customers simply scan your Table QR code using their smartphone camera, and your instant digital menu loads in less than 0.3 seconds.'
    },
    {
      q: 'How does Table QR Ordering work?',
      a: 'When a customer scans a table QR code and places an order, the itemized order details immediately sound a loud siren alarm in your kitchen dashboard and auto-print a KOT receipt.'
    },
    {
      q: 'Can I use WhatsApp Ordering & Confirmations?',
      a: 'Yes! Automated order updates, digital bills, and customer receipts can be sent directly to your customers via WhatsApp.'
    },
    {
      q: 'Can I connect a Thermal Receipt Printer?',
      a: 'Yes! KhanaMaster supports 2-inch and 3-inch Bluetooth and USB thermal printers directly from mobile phones or desktop PCs for 0.5-second instant KOT & GST billing.'
    },
    {
      q: 'Does KhanaMaster support Kitchen Orders (KOT)?',
      a: 'Yes! Live KOT management is built-in with kitchen siren ringtones, table floor map views, and item status tracking.'
    },
    {
      q: 'Can I upgrade or change my plan later?',
      a: 'Absolutely. You can upgrade, downgrade, or switch between Basic, Pro, and Enterprise plans at any time from your owner dashboard.'
    },
    {
      q: 'What happens after the free trial ends?',
      a: `After ${trialDays} days, you can choose to activate your plan via UPI or Cashfree automated billing to keep your digital menu live without interruption.`
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
