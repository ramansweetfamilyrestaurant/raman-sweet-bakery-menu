import React, { useEffect } from 'react';
import LegalPageLayout from './LegalPageLayout';
import { ShieldCheck, Lock, Server, Key, FileText, Smartphone } from 'lucide-react';

export default function SecurityPolicy({ onOpenLogin, onStartTrial }) {
  useEffect(() => {
    document.title = 'TouchQR - Security & Data Protection';
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'overview', title: 'Security Architecture Overview' },
    { id: 'tenant-isolation', title: 'Multi-Tenant Data Isolation' },
    { id: 'data-encryption', title: 'Data Encryption (Transit & Rest)' },
    { id: 'payment-security', title: 'PCI-DSS Payment Gateway Compliance' },
    { id: 'access-control', title: 'Authentication & Access Controls' },
    { id: 'backup-recovery', title: 'Data Backup & Disaster Recovery' },
    { id: 'vulnerability', title: 'Vulnerability Management & Monitoring' },
    { id: 'reporting', title: 'Reporting Security Concerns' }
  ];

  return (
    <LegalPageLayout
      title="Security & Data Protection"
      categoryBadge="TRUST & COMPLIANCE"
      lastUpdated="August 10, 2026"
      tocItems={tocItems}
      onOpenLogin={onOpenLogin}
      onStartTrial={onStartTrial}
    >
      <section id="overview" className="km-legal-section">
        <h2 className="km-legal-h2">1. Security Architecture Overview</h2>
        <p className="km-legal-p">
          At <strong>TouchQR SaaS</strong>, protecting restaurant menu records, kitchen orders, billing data, and customer information is integral to our architecture. We implement defense-in-depth engineering practices to protect client data across transmission, processing, and storage.
        </p>
      </section>

      <section id="tenant-isolation" className="km-legal-section">
        <h2 className="km-legal-h2">2. Multi-Tenant Data Isolation</h2>
        <p className="km-legal-p">
          TouchQR utilizes strict database-level and application-level tenant scoping (`restaurant_id` / `restaurant_slug`). Menu items, sales records, customer reviews, and kitchen order tickets belong strictly to the authenticated restaurant tenant and cannot be accessed across account boundaries.
        </p>
      </section>

      <section id="data-encryption" className="km-legal-section">
        <h2 className="km-legal-h2">3. Data Encryption (In Transit & At Rest)</h2>
        <p className="km-legal-p">
          All web traffic between client browsers (smartphones, POS tablets, desktop PCs) and TouchQR servers is encrypted in transit using industry-standard TLS (Transport Layer Security / HTTPS). HTTP traffic is automatically redirected to secure HTTPS connections.
        </p>
      </section>

      <section id="payment-security" className="km-legal-section">
        <h2 className="km-legal-h2">4. PCI-DSS Payment Gateway Compliance</h2>
        <p className="km-legal-p">
          TouchQR integrates with PCI-DSS Level 1 compliant payment partners (e.g. Cashfree Payments). Sensitive financial credentials such as card numbers, CVVs, or banking passwords are handled directly by payment gateway infrastructure and are never stored on TouchQR database servers.
        </p>
      </section>

      <section id="access-control" className="km-legal-section">
        <h2 className="km-legal-h2">5. Authentication & Access Controls</h2>
        <ul className="km-legal-list">
          <li><strong>Salted Password Hashing:</strong> Owner admin passwords are cryptographically hashed using standard bcrypt algorithms. Plaintext passwords are never logged or stored.</li>
          <li><strong>JWT Session Management:</strong> Authenticated admin sessions utilize cryptographically signed JSON Web Tokens (JWT) with strict expiration limits.</li>
          <li><strong>Super Admin Scoping:</strong> Super Admin administrative access requires master security credentials.</li>
        </ul>
      </section>

      <section id="infrastructure" className="km-legal-section">
        <h2 className="km-legal-h2">6. Infrastructure & Cloud Storage</h2>
        <p className="km-legal-p">
          Dish photographs and static menu assets are served via secure cloud storage networks (such as Cloudflare R2 / AWS S3) with global CDN distribution, protecting static assets against tampering and ensuring 0.3-second menu load speeds.
        </p>
      </section>

      <section id="backups" className="km-legal-section">
        <h2 className="km-legal-h2">7. Data Backups & Reliability</h2>
        <p className="km-legal-p">
          Database snapshots and transactional logs are backed up periodically to prevent data loss resulting from hardware failure or accidental corruption. Instant LocalStorage state caching allows 0ms admin dashboard hydration upon browser reload.
        </p>
      </section>

      <section id="reporting" className="km-legal-section">
        <h2 className="km-legal-h2">8. Responsible Security Disclosure</h2>
        <p className="km-legal-p">
          We welcome vulnerability disclosures from security researchers and developers. If you discover a potential security flaw, please report it responsibly via our <a href="/contact" style={{ color: 'var(--km-green)', fontWeight: 700 }}>Contact & Security Team Page</a>. We review all security submissions promptly.
        </p>
      </section>
    </LegalPageLayout>
  );
}
