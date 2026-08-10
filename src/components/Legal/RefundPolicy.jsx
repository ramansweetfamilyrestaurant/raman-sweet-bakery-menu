import React, { useEffect } from 'react';
import LegalPageLayout from './LegalPageLayout';

export default function RefundPolicy({ onOpenLogin, onStartTrial }) {
  useEffect(() => {
    document.title = 'TouchQR - Refund & Cancellation Policy';
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'free-trial', title: '17-Day Free Trial Policy' },
    { id: 'subscription-billing', title: 'Subscription Billing Cycle' },
    { id: 'cancellation', title: 'Account Cancellation Requests' },
    { id: 'refund-eligibility', title: 'Refund Eligibility' },
    { id: 'non-refundable', title: 'Non-Refundable Circumstances' },
    { id: 'duplicate-charges', title: 'Duplicate Charges & Billing Errors' },
    { id: 'gateway-issues', title: 'Payment Gateway Failures' },
    { id: 'request-process', title: 'How to Submit a Refund Request' },
    { id: 'contact', title: 'Support Contact' }
  ];

  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      categoryBadge="BILLING POLICY"
      lastUpdated="August 10, 2026"
      tocItems={tocItems}
      onOpenLogin={onOpenLogin}
      onStartTrial={onStartTrial}
    >
      <section id="free-trial" className="km-legal-section">
        <h2 className="km-legal-h2">1. 17-Day Free Trial Policy</h2>
        <p className="km-legal-p">
          TouchQR provides a <strong>17-Day Free Trial</strong> for all new restaurant accounts. No credit card, debit card, or payment details are required to begin the trial. This allows restaurant operators to thoroughly evaluate digital menu creation, live kitchen KOT, thermal printing, and smart review tools risk-free prior to financial commitment.
        </p>
      </section>

      <section id="subscription-billing" className="km-legal-section">
        <h2 className="km-legal-h2">2. Subscription Billing Cycle</h2>
        <p className="km-legal-p">
          TouchQR subscriptions (Basic, Pro, Enterprise) operate on a prepaid monthly or annual recurring cycle. Subscriptions are activated upon user confirmation and successful payment authorization via Cashfree Payments or UPI mandates.
        </p>
      </section>

      <section id="cancellation" className="km-legal-section">
        <h2 className="km-legal-h2">3. Account Cancellation Requests</h2>
        <p className="km-legal-p">
          Restaurant owners may cancel their recurring SaaS subscription at any time from the owner billing dashboard or by submitting a cancellation request to customer support. Upon cancellation, your account will remain accessible until the conclusion of the current paid billing period.
        </p>
      </section>

      <section id="refund-eligibility" className="km-legal-section">
        <h2 className="km-legal-h2">4. Refund Eligibility</h2>
        <p className="km-legal-p">
          Because TouchQR offers an unrestricted 17-day free trial, subscription payments are generally non-refundable once a billing cycle commences. However, refund requests are evaluated fairly on a case-by-case basis under the following eligible circumstances:
        </p>
        <ul className="km-legal-list">
          <li>Duplicate billing or technical system overcharges resulting from payment gateway errors.</li>
          <li>Inability to access core software services caused by verified server downtime exceeding 72 consecutive hours.</li>
          <li>Unauthorized payment transactions reported within 7 days of the billing statement date.</li>
        </ul>
      </section>

      <section id="non-refundable" className="km-legal-section">
        <h2 className="km-legal-h2">5. Non-Refundable Circumstances</h2>
        <p className="km-legal-p">Refunds will not be issued for:</p>
        <ul className="km-legal-list">
          <li>Partial month usage following voluntary account cancellation.</li>
          <li>Lack of restaurant hardware compatibility (e.g., non-standard printer models).</li>
          <li>Accounts suspended due to violations of our Acceptable Use Policy.</li>
        </ul>
      </section>

      <section id="duplicate-charges" className="km-legal-section">
        <h2 className="km-legal-h2">6. Duplicate Charges & Billing Errors</h2>
        <p className="km-legal-p">
          If you believe your bank account or UPI handle was charged multiple times for a single subscription period, notify support immediately with payment transaction reference numbers. Verified duplicate charges are refunded in full back to the original payment source within 5 to 7 business days.
        </p>
      </section>

      <section id="gateway-issues" className="km-legal-section">
        <h2 className="km-legal-h2">7. Payment Gateway Failures</h2>
        <p className="km-legal-p">
          Payments that fail or remain pending at the banking gateway level will auto-reverse according to your bank's standard processing timeframe (typically 24 to 48 hours).
        </p>
      </section>

      <section id="request-process" className="km-legal-section">
        <h2 className="km-legal-h2">8. How to Submit a Refund Request</h2>
        <p className="km-legal-p">To request a billing review or refund:</p>
        <ol className="km-legal-list">
          <li>Gather your registered restaurant username, registered phone number, and payment ID.</li>
          <li>Submit a request through our official <a href="/contact" style={{ color: 'var(--km-green)', fontWeight: 700 }}>Contact Page</a>.</li>
          <li>Our billing team will inspect transaction logs and respond within 24 to 48 business hours.</li>
        </ol>
      </section>

      <section id="contact" className="km-legal-section">
        <h2 className="km-legal-h2">9. Support Contact</h2>
        <p className="km-legal-p">
          For any billing or subscription assistance, please reach out to our dedicated team via the <a href="/contact" style={{ color: 'var(--km-green)', fontWeight: 700 }}>TouchQR Support Center</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
