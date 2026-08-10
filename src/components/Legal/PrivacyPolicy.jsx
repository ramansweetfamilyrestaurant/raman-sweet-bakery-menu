import React, { useEffect } from 'react';
import LegalPageLayout from './LegalPageLayout';

export default function PrivacyPolicy({ onOpenLogin, onStartTrial }) {
  useEffect(() => {
    document.title = 'TouchQR - Privacy Policy';
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'intro', title: 'Introduction' },
    { id: 'info-collected', title: 'Information We Collect' },
    { id: 'owner-account', title: 'Restaurant / Owner Account Information' },
    { id: 'customer-data', title: 'Customer & Restaurant Order Data' },
    { id: 'technical-info', title: 'Device and Technical Information' },
    { id: 'how-we-use', title: 'How We Use Information' },
    { id: 'payment-info', title: 'Payment & Subscription Billing' },
    { id: 'cookies', title: 'Cookies & Local Storage' },
    { id: 'data-sharing', title: 'Data Sharing & Third Parties' },
    { id: 'security', title: 'Data Security' },
    { id: 'retention', title: 'Data Retention' },
    { id: 'rights', title: 'User Rights & Account Deletion' },
    { id: 'children', title: "Children's Privacy" },
    { id: 'changes', title: 'Changes to This Policy' },
    { id: 'contact', title: 'Contact Us' }
  ];

  return (
    <LegalPageLayout
      title="Privacy Policy"
      categoryBadge="LEGAL DOCUMENT"
      lastUpdated="August 10, 2026"
      tocItems={tocItems}
      onOpenLogin={onOpenLogin}
      onStartTrial={onStartTrial}
    >
      <section id="intro" className="km-legal-section">
        <h2 className="km-legal-h2">1. Introduction</h2>
        <p className="km-legal-p">
          Welcome to <strong>TouchQR</strong> ("we", "us", "our", or "TouchQR SaaS"). TouchQR provides digital QR menus, direct table ordering systems, live Kitchen Order Ticket (KOT) management, and restaurant growth software tailored for Indian restaurant owners, cafes, food courts, and sweet shops.
        </p>
        <p className="km-legal-p">
          This Privacy Policy explains how we collect, use, store, process, and protect your information when you access or use the TouchQR platform, website, owner admin dashboard, or digital QR menu customer interface.
        </p>
      </section>

      <section id="info-collected" className="km-legal-section">
        <h2 className="km-legal-h2">2. Information We Collect</h2>
        <p className="km-legal-p">
          We collect information directly provided by restaurant owners during account setup, as well as data generated when customers browse digital menus or place orders.
        </p>
      </section>

      <section id="owner-account" className="km-legal-section">
        <h2 className="km-legal-h2">3. Restaurant / Owner Account Information</h2>
        <p className="km-legal-p">
          When a restaurant owner registers for a TouchQR account or starts a free trial, we collect:
        </p>
        <ul className="km-legal-list">
          <li>Restaurant business name, owner username, and contact phone number.</li>
          <li>Account authentication credentials (passwords stored via secure salted hashing).</li>
          <li>Restaurant menu data including categories, dish names, pricing, portions, and dish photographs.</li>
          <li>UPI payment details or Cashfree subscription identifiers for automated billing.</li>
        </ul>
      </section>

      <section id="customer-data" className="km-legal-section">
        <h2 className="km-legal-h2">4. Customer & Restaurant Order Data</h2>
        <p className="km-legal-p">
          When restaurant customers scan a table QR code to browse menus or place direct orders:
        </p>
        <ul className="km-legal-list">
          <li>Order details such as items selected, portion choices, table numbers, and special kitchen instructions.</li>
          <li>Customer phone numbers or WhatsApp contact details if optionally entered for order notifications.</li>
          <li>Customer star ratings submitted via the Smart Review Prompter tool.</li>
        </ul>
        <div className="km-legal-callout">
          <strong>Notice for Customers:</strong> TouchQR acts as a data processor on behalf of the respective restaurant owner. Individual restaurants manage their own customer interactions.
        </div>
      </section>

      <section id="technical-info" className="km-legal-section">
        <h2 className="km-legal-h2">5. Device and Technical Information</h2>
        <p className="km-legal-p">
          We automatically collect technical telemetry required to maintain high menu load speed (sub-0.3 second target):
        </p>
        <ul className="km-legal-list">
          <li>Browser type, device operating system, IP address, and network request timestamps.</li>
          <li>Thermal printer connection protocols (Bluetooth / USB printer statuses).</li>
        </ul>
      </section>

      <section id="how-we-use" className="km-legal-section">
        <h2 className="km-legal-h2">6. How We Use Information</h2>
        <p className="km-legal-p">We use collected data strictly to:</p>
        <ul className="km-legal-list">
          <li>Render high-speed digital menus and route KOT tickets to kitchen displays in real time.</li>
          <li>Process monthly or annual SaaS subscription plan renewals.</li>
          <li>Generate sales analytics, dish popularity insights, and revenue reports for restaurant owners.</li>
          <li>Provide customer support, WhatsApp order notifications, and technical troubleshooting.</li>
        </ul>
      </section>

      <section id="payment-info" className="km-legal-section">
        <h2 className="km-legal-h2">7. Payment & Subscription Billing</h2>
        <p className="km-legal-p">
          Subscription billing is processed via PCI-DSS compliant third-party payment gateways (such as Cashfree Payments). TouchQR does not store raw credit card numbers or banking PINs on its primary database servers.
        </p>
      </section>

      <section id="cookies" className="km-legal-section">
        <h2 className="km-legal-h2">8. Cookies & Local Storage</h2>
        <p className="km-legal-p">
          We use browser LocalStorage and essential session storage to maintain fast 0ms admin dashboard state hydration and customer cart states across page refreshes.
        </p>
      </section>

      <section id="data-sharing" className="km-legal-section">
        <h2 className="km-legal-h2">9. Data Sharing & Third Parties</h2>
        <p className="km-legal-p">
          We do not sell, rent, or trade restaurant owner data or customer records to third-party ad networks. Data is shared only with verified service providers strictly necessary to operate the service (e.g., payment gateways, SMS/WhatsApp gateways, Cloudflare R2 image storage).
        </p>
      </section>

      <section id="security" className="km-legal-section">
        <h2 className="km-legal-h2">10. Data Security</h2>
        <p className="km-legal-p">
          TouchQR implements technical and organizational safeguards including HTTPS encrypted transmission, database password hashing, and tenant-level access isolation to protect data against unauthorized access.
        </p>
      </section>

      <section id="retention" className="km-legal-section">
        <h2 className="km-legal-h2">11. Data Retention</h2>
        <p className="km-legal-p">
          Restaurant menu data, order history, and account records are retained while the restaurant's subscription remains active or as required by applicable tax and commercial laws in India.
        </p>
      </section>

      <section id="rights" className="km-legal-section">
        <h2 className="km-legal-h2">12. User Rights & Account Deletion</h2>
        <p className="km-legal-p">
          Restaurant owners may access, update, or export their menu data directly from the owner admin panel. To request complete account or data deletion, owners can contact our support team.
        </p>
      </section>

      <section id="children" className="km-legal-section">
        <h2 className="km-legal-h2">13. Children's Privacy</h2>
        <p className="km-legal-p">
          TouchQR is a commercial B2B SaaS software platform intended for commercial use by business entities and adult individuals. We do not knowingly collect personal data from minors under the age of 18.
        </p>
      </section>

      <section id="changes" className="km-legal-section">
        <h2 className="km-legal-h2">14. Changes to This Policy</h2>
        <p className="km-legal-p">
          We may update this Privacy Policy periodically. Significant updates will be communicated via notice on our website or within the owner dashboard prior to taking effect.
        </p>
      </section>

      <section id="contact" className="km-legal-section">
        <h2 className="km-legal-h2">15. Contact Us</h2>
        <p className="km-legal-p">
          If you have questions or concerns regarding this Privacy Policy or data handling, please submit a request via our <a href="/contact" style={{ color: 'var(--km-green)', fontWeight: 700 }}>Support Contact Page</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
