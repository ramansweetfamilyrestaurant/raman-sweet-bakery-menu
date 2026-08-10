import React, { useState } from 'react';
import LegalHeader from './LegalHeader';
import LegalFooter from './LegalFooter';
import { ChevronDown, ChevronUp, Clock, ShieldCheck } from 'lucide-react';
import './LegalPage.css';

export default function LegalPageLayout({
  title,
  categoryBadge = "OFFICIAL POLICY",
  lastUpdated = "August 10, 2026",
  tocItems = [],
  children,
  onOpenLogin,
  onStartTrial
}) {
  const [tocExpanded, setTocExpanded] = useState(true);

  return (
    <div className="km-legal-wrapper">
      <LegalHeader onOpenLogin={onOpenLogin} />

      <main className="km-legal-container">
        {/* Title Header Card */}
        <div className="km-legal-title-card">
          <div className="km-legal-badge">
            <ShieldCheck size={13} color="#856404" />
            <span>{categoryBadge}</span>
          </div>
          <h1 className="km-legal-h1">{title}</h1>
          <div className="km-legal-meta">
            <Clock size={14} />
            <span>Last Updated: {lastUpdated}</span>
          </div>
        </div>

        {/* Table of Contents (if items provided) */}
        {tocItems && tocItems.length > 0 && (
          <div className="km-legal-toc">
            <button
              type="button"
              className="km-toc-toggle"
              onClick={() => setTocExpanded(!tocExpanded)}
              aria-label="Toggle Table of Contents"
            >
              <span>On this page ({tocItems.length} Sections)</span>
              {tocExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {tocExpanded && (
              <ul className="km-toc-list">
                {tocItems.map((item, idx) => (
                  <li key={idx} className="km-toc-item">
                    <a href={`#${item.id}`}>
                      {idx + 1}. {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Main Legal Content Body */}
        <div className="km-legal-content">
          {children}
        </div>
      </main>

      <LegalFooter onOpenLogin={onOpenLogin} onStartTrial={onStartTrial} />
    </div>
  );
}
