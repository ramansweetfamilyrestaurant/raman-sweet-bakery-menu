import React, { useEffect } from 'react';
import LegalPageLayout from './LegalPageLayout';

export default function TermsOfService({ onOpenLogin, onStartTrial }) {
  useEffect(() => {
    document.title = 'TouchQR - Terms of Service';
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'acceptance', title: 'Acceptance of Terms' },
    { id: 'about', title: 'About TouchQR SaaS' },
    { id: 'owner-accounts', title: 'Restaurant Owner Accounts' },
    { id: 'services', title: 'Digital Menu & QR Services' },
    { id: 'kot-features', title: 'Kitchen KOT & Thermal Printing' },
    { id: 'subscriptions', title: 'Subscription Plans & Pricing' },
    { id: 'free-trial', title: 'Free Trial Terms' },
    { id: 'billing', title: 'Billing & Automated Payments' },
    { id: 'acceptable-use', title: 'Acceptable Use Policy' },
    { id: 'ip-rights', title: 'Intellectual Property' },
    { id: 'availability', title: 'Service Availability & Uptime' },
    { id: 'liability', title: 'Limitation of Liability' },
    { id: 'changes', title: 'Changes to Terms' },
    { id: 'contact', title: 'Contact Support' }
  ];

  return (
    <LegalPageLayout
      title="Terms of Service"
      categoryBadge="AGREEMENT"
      lastUpdated="August 10, 2026"
      tocItems={tocItems}
      onOpenLogin={onOpenLogin}
      onStartTrial={onStartTrial}
    >
      <section id="acceptance" className="km-legal-section">
        <h2 className="km-legal-h2">1. Acceptance of Terms</h2>
        <p className="km-legal-p">
          By registering for, accessing, or using <strong>TouchQR SaaS</strong> ("Service"), you ("Restaurant Owner", "Subscriber", or "User") agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the Service.
        </p>
      </section>

      <section id="about" className="km-legal-section">
        <h2 className="km-legal-h2">2. About TouchQR SaaS</h2>
        <p className="km-legal-p">
          TouchQR is a B2B Software-as-a-Service (SaaS) platform designed for restaurants, sweet shops, cafes, and food outlets. The Service provides digital QR menu management, direct table QR ordering tools, real-time kitchen order tickets (KOT), automated thermal billing, and customer review enhancement features.
        </p>
      </section>

      <section id="owner-accounts" className="km-legal-section">
        <h2 className="km-legal-h2">3. Restaurant Owner Accounts</h2>
        <p className="km-legal-p">
          To use TouchQR, you must create a restaurant owner account. You agree to provide accurate, current, and complete information during registration and to keep your account credentials confidential. You are responsible for all activities occurring under your restaurant account.
        </p>
      </section>

      <section id="services" className="km-legal-section">
        <h2 className="km-legal-h2">4. Digital Menu & QR Services</h2>
        <p className="km-legal-p">
          TouchQR grants you a non-exclusive, non-transferable, revocable license to create and host digital menus, generate QR codes, and present your items to restaurant diners during the term of your active subscription.
        </p>
      </section>

      <section id="kot-features" className="km-legal-section">
        <h2 className="km-legal-h2">5. Kitchen KOT & Thermal Printing</h2>
        <p className="km-legal-p">
          Hardware integration features (such as USB or Bluetooth 2-inch/3-inch thermal printers) require compatible device hardware. While TouchQR supports standard thermal printing protocols, local device drivers and browser permissions remain the responsibility of the restaurant operator.
        </p>
      </section>

      <section id="subscriptions" className="km-legal-section">
        <h2 className="km-legal-h2">6. Subscription Plans & Pricing</h2>
        <p className="km-legal-p">
          TouchQR offers tiered SaaS subscription plans (such as Basic, Pro, and Enterprise). Current plan details, features, and pricing are displayed on our public website pricing table and inside the owner billing panel. Pricing is subject to change upon advance notification.
        </p>
      </section>

      <section id="free-trial" className="km-legal-section">
        <h2 className="km-legal-h2">7. Free Trial Terms</h2>
        <p className="km-legal-p">
          New accounts are eligible for a zero-risk 16-Day Free Trial without entering credit card details. Upon expiration of the free trial period, continued access to public digital menus and kitchen tools requires selecting an active subscription plan.
        </p>
      </section>

      <section id="billing" className="km-legal-section">
        <h2 className="km-legal-h2">8. Billing & Automated Payments</h2>
        <p className="km-legal-p">
          Subscription payments are processed periodically via authorized payment gateways (e.g. Cashfree Payments or UPI mandate). By activating a paid plan, you authorize automated recurring charges according to your selected billing cycle.
        </p>
      </section>

      <section id="acceptable-use" className="km-legal-section">
        <h2 className="km-legal-h2">9. Acceptable Use Policy</h2>
        <p className="km-legal-p">You agree not to:</p>
        <ul className="km-legal-list">
          <li>Upload illegal, defamatory, or fraudulent content or illegal food offerings.</li>
          <li>Attempt to breach tenant isolation or disrupt service performance for other restaurants.</li>
          <li>Reverse-engineer or scrape software code or API endpoints.</li>
        </ul>
      </section>

      <section id="ip-rights" className="km-legal-section">
        <h2 className="km-legal-h2">10. Intellectual Property</h2>
        <p className="km-legal-p">
          TouchQR retains all rights, title, and interest in the software platform, code, logos, and UI designs. Restaurant owners retain ownership of their proprietary menu text, dish images, and business trade names.
        </p>
      </section>

      <section id="availability" className="km-legal-section">
        <h2 className="km-legal-h2">11. Service Availability & Uptime</h2>
        <p className="km-legal-p">
          We endeavor to maintain high platform availability. However, service may occasionally be impacted by scheduled system maintenance, internet service provider outages, or third-party infrastructure events.
        </p>
      </section>

      <section id="liability" className="km-legal-section">
        <h2 className="km-legal-h2">12. Limitation of Liability</h2>
        <p className="km-legal-p">
          To the maximum extent permitted by applicable law, TouchQR SaaS shall not be liable for indirect, incidental, or consequential damages resulting from lost sales, kitchen delays, device incompatibilities, or service interruptions.
        </p>
      </section>

      <section id="changes" className="km-legal-section">
        <h2 className="km-legal-h2">13. Changes to Terms</h2>
        <p className="km-legal-p">
          We reserve the right to modify these Terms of Service at any time. Continued use of the platform following published modifications constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section id="contact" className="km-legal-section">
        <h2 className="km-legal-h2">14. Contact Support</h2>
        <p className="km-legal-p">
          For legal inquiries or account support, please visit our <a href="/contact" style={{ color: 'var(--km-green)', fontWeight: 700 }}>Contact Page</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
