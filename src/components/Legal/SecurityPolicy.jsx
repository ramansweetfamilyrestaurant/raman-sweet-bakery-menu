import React, { useEffect } from 'react';
import LegalPageLayout from './LegalPageLayout';
import { ShieldCheck, Lock, Server, Key, FileText, Smartphone } from 'lucide-react';

export default function SecurityPolicy({ onOpenLogin, onStartTrial }) {
  useEffect(() => {
    document.title = 'KhanaMaster - Security & Data Protection';
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'overview', title: 'Security Overview' },
    { id: 'tenant-isolation', title: 'Restaurant Tenant Isolation' },
    { id: 'authentication', title: 'Authentication & Access Control' },
    { id: 'transport', title: 'Encrypted Transport & Data In Transit' },
    { id: 'payments', title: 'Payment Gateway Security' },
    { id: 'infrastructure', title: 'Infrastructure & Cloud Storage' },
    { id: 'backups', title: 'Data Backups & Reliability' },
    { id: 'reporting', title: 'Responsible Security Disclosure' }
  ];

  return (
    <LegalPageLayout
      title="Security & Data Protection"
      categoryBadge="TECHNICAL GUARANTEES"
      lastUpdated="August 10, 2026"
      tocItems={tocItems}
      onOpenLogin={onOpenLogin}
      onStartTrial={onStartTrial}
    >
      <section id="overview" className="km-legal-section">
        <h2 className="km-legal-h2">1. Security Overview</h2>
        <p className="km-legal-p">
          At <strong>KhanaMaster SaaS</strong>, protecting restaurant menu records, kitchen orders, billing data, and customer information is integral to our architecture. We implement defense-in-depth engineering practices to protect client data across transmission, processing, and storage.
        </p>
      </section>

      <section id="tenant-isolation" className="km-legal-section">
        <h2 className="km-legal-h2">2. Restaurant Tenant Isolation</h2>
        <p className="km-legal-p">
          Each restaurant operates within its own strict tenant context. Database queries, menu assets, and order channels are scoped to unique restaurant identifiers, ensuring that data from one establishment cannot be viewed, accessed, or modified by another restaurant account.
        </p>
        <div className="km-legal-callout">
          <strong>Architecture Guarantee:</strong> Multi-tenant isolation is enforced at the database model and API routing layer.
        </div>
      </section>

      <section id="authentication" className="km-legal-section">
        <h2 className="km-legal-h2">3. Authentication & Access Control</h2>
        <p className="km-legal-p">
          Admin access requires authenticated session tokens. Key measures include:
        </p>
        <ul className="km-legal-list">
          <li>Cryptographic password hashing (Bcrypt / PBKDF2 standard algorithms).</li>
          <li>Token-based authorization for administrative REST API routes.</li>
          <li>Super Admin master governance channels isolated from individual restaurant scopes.</li>
        </ul>
      </section>

      <section id="transport" className="km-legal-section">
        <h2 className="km-legal-h2">4. Encrypted Transport & Data In Transit</h2>
        <p className="km-legal-p">
          All web traffic between client browsers (smartphones, POS tablets, desktop PCs) and KhanaMaster servers is encrypted in transit using industry-standard TLS (Transport Layer Security / HTTPS). HTTP traffic is automatically redirected to secure HTTPS connections.
        </p>
      </section>

      <section id="payments" className="km-legal-section">
        <h2 className="km-legal-h2">5. Payment Gateway Security</h2>
        <p className="km-legal-p">
          KhanaMaster integrates with PCI-DSS Level 1 compliant payment partners (e.g. Cashfree Payments). Sensitive financial credentials such as card numbers, CVVs, or banking passwords are handled directly by payment gateway infrastructure and are never stored on KhanaMaster database servers.
        </p>
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
