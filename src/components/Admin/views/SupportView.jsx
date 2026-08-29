import React, { useState, useMemo } from 'react';
import { 
  Headphones, 
  Search, 
  MessageCircle, 
  BookOpen, 
  Send, 
  ArrowLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShoppingBag, 
  Utensils, 
  QrCode, 
  Tv, 
  CreditCard, 
  BarChart2, 
  Settings, 
  Printer, 
  ExternalLink, 
  FileText, 
  X, 
  ShieldCheck,
  CheckCheck,
  HelpCircle,
  Phone,
  Sparkles
} from 'lucide-react';
import { resolveTenantCapabilities } from '../../../utils/planCapabilities';

export default function SupportView({
  restaurantInfo = {},
  settingsForm = {},
  capabilities = {},
  token,
  onNavigate,
  onBackToDashboard,
  onBackToSettings
}) {
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'orders' | 'menu' | 'qr' | 'kds' | 'billing' | 'analytics' | 'settings'

  // Selected Troubleshooting Guide Modal State
  const [activeGuide, setActiveGuide] = useState(null);

  // Contact Support Form State
  const [supportSubject, setSupportSubject] = useState('');
  const [supportCategory, setSupportCategory] = useState('orders');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSuccessToast, setSupportSuccessToast] = useState('');

  // Support WhatsApp Number from Restaurant or System Config
  const supportWhatsapp = settingsForm?.support_whatsapp || restaurantInfo?.support_whatsapp || '919876543210';
  const cleanWhatsappNumber = supportWhatsapp.replace(/[^0-9]/g, '');

  // Support Tickets History (Persisted in localStorage per restaurant slug)
  const businessSlug = settingsForm?.slug || restaurantInfo?.slug || 'default';
  const storageKey = `touchqr_support_tickets_${businessSlug}`;

  const [supportTickets, setSupportTickets] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load support tickets from storage:', e);
    }
    return [
      {
        id: 'TICK-1082',
        subject: 'Thermal printer auto-print configuration query',
        category: 'Hardware & Printers',
        status: 'Resolved',
        created: '2 days ago',
        updated: 'Yesterday, 03:30 PM'
      }
    ];
  });

  const handleCreateTicket = (e) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) {
      alert('Please enter both a subject and a description for your support request.');
      return;
    }

    setSupportSubmitting(true);

    setTimeout(() => {
      const newTicket = {
        id: `TICK-${Math.floor(1000 + Math.random() * 9000)}`,
        subject: supportSubject.trim(),
        category: supportCategory,
        status: 'Open',
        created: 'Just now',
        updated: 'Just now',
        description: supportMessage.trim()
      };

      const updated = [newTicket, ...supportTickets];
      setSupportTickets(updated);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to persist ticket:', err);
      }

      setSupportSubject('');
      setSupportMessage('');
      setSupportSubmitting(false);
      setSupportSuccessToast(`✓ Support Request #${newTicket.id} submitted successfully! Our team will contact you.`);
      setTimeout(() => setSupportSuccessToast(''), 5000);
    }, 600);
  };

  // Troubleshooting Guides Definition
  const troubleshootingGuides = [
    {
      id: 'trouble-orders',
      category: 'orders',
      icon: <ShoppingBag size={18} color="#EA580C" />,
      title: 'Orders not appearing in dashboard',
      subtitle: 'Check ordering toggle, connection status and siren sound alerts',
      steps: [
        '1. Verify that Direct Ordering is enabled in Settings > Orders & Devices.',
        '2. Confirm your device has an active internet connection (check the green "Online" badge in the sidebar).',
        '3. Tap "Test Siren" in audio settings to ensure browser audio autoplay permissions are granted.',
        '4. If using Table Presence verification, check if customers are scanning within the configured GPS geofence.'
      ],
      actionLabel: 'Go to Orders',
      actionTab: 'orders'
    },
    {
      id: 'trouble-qr',
      category: 'qr',
      icon: <QrCode size={18} color="#059669" />,
      title: 'QR codes not scanning or loading wrong menu',
      subtitle: 'Verify QR configuration, table pairing, and business slug',
      steps: [
        '1. Open the QR Standees manager from the Marketing / QR tab.',
        '2. Ensure your restaurant slug matches your active storefront URL.',
        '3. If you recently updated table numbers, download and print the latest SVG/PNG standees.',
        '4. Test scanning with a phone camera to confirm it routes to the correct ordering space.'
      ],
      actionLabel: 'Go to QR Manager',
      actionTab: 'qr-generator'
    },
    {
      id: 'trouble-printer',
      category: 'settings',
      icon: <Printer size={18} color="#064E3B" />,
      title: 'Thermal receipt printer not printing automatically',
      subtitle: 'Check printer connection, browser print dialog, and paper status',
      steps: [
        '1. In Settings > Orders & Devices, verify that "Thermal Auto-Print" is toggled ON.',
        '2. Check that your 58mm or 80mm ESC/POS USB or Bluetooth printer is powered on with paper loaded.',
        '3. Ensure your browser is not blocking popups or automatic print prompts.',
        '4. Print a test slip from the Orders page to verify formatting.'
      ],
      actionLabel: 'Open Printer Settings',
      actionTab: 'settings',
      actionDrawer: 'orders-devices'
    },
    {
      id: 'trouble-billing',
      category: 'billing',
      icon: <CreditCard size={18} color="#D97706" />,
      title: 'Billing, subscription, or payment mandate issue',
      subtitle: 'Check subscription renewal date, mandate status and Cashfree invoices',
      steps: [
        '1. Navigate to Settings > Billing & Subscription to view your current active plan.',
        '2. Verify that your Cashfree recurring mandate is active and that your payment method has not expired.',
        '3. Invoices are automatically generated and downloadable directly from the Billing page.',
        '4. If your plan needs an upgrade for KDS or AI features, click "Upgrade Plan".'
      ],
      actionLabel: 'Open Billing',
      actionTab: 'settings',
      actionDrawer: 'subscription'
    },
    {
      id: 'trouble-kds',
      category: 'kds',
      icon: <Tv size={18} color="#DC2626" />,
      title: 'KDS kitchen display not updating or locked',
      subtitle: 'Check KDS PIN, kitchen audio permissions and real-time sync',
      steps: [
        '1. Confirm that your kitchen tablet is logged into the Standalone KDS display using your 4-digit PIN.',
        '2. If you forgot your KDS PIN, view or change it in Settings > Security & Credentials.',
        '3. Tap anywhere on the kitchen display to unlock real-time chime sounds on incoming tickets.',
        '4. Kitchen tickets update in zero-latency real time as soon as admin marks an order accepted.'
      ],
      actionLabel: 'View Security & KDS PIN',
      actionTab: 'settings',
      actionDrawer: 'security'
    }
  ];

  // Popular Knowledge Base Guides
  const popularGuides = [
    {
      id: 'guide-start',
      category: 'settings',
      icon: <BookOpen size={18} color="#064E3B" />,
      title: 'Getting Started with TouchQR',
      desc: 'Complete walkthrough on setting up your restaurant profile, logo, address, and tables.',
      actionTab: 'settings',
      actionDrawer: 'profile'
    },
    {
      id: 'guide-menu',
      category: 'menu',
      icon: <Utensils size={18} color="#EA580C" />,
      title: 'Managing Dishes, Categories & Combos',
      desc: 'How to add high-resolution dish photos, mark items Sold Out, and configure value meal combos.',
      actionTab: 'dishes'
    },
    {
      id: 'guide-qr',
      category: 'qr',
      icon: <QrCode size={18} color="#059669" />,
      title: 'Setting Up Table & Space QR Standees',
      desc: 'Generate printable acrylic standees with customized table numbers and brand themes.',
      actionTab: 'qr-generator'
    },
    {
      id: 'guide-orders',
      category: 'orders',
      icon: <ShoppingBag size={18} color="#D97706" />,
      title: 'Accepting, Preparing & Serving Orders',
      desc: 'Manage live counter orders, kitchen tickets, waiter calls, and counter bill completions.',
      actionTab: 'orders'
    },
    {
      id: 'guide-analytics',
      category: 'analytics',
      icon: <BarChart2 size={18} color="#0284C7" />,
      title: 'Reading Sales & Performance Analytics',
      desc: 'Understand gross sales, average order value (AOV), peak hours, and export CSV/Excel reports.',
      actionTab: 'analytics'
    },
    {
      id: 'guide-billing',
      category: 'billing',
      icon: <CreditCard size={18} color="#7C3AED" />,
      title: 'Managing Subscription Plans & Invoices',
      desc: 'Understand features across Basic, Pro, and Enterprise tiers with Cashfree automatic billing.',
      actionTab: 'settings',
      actionDrawer: 'subscription'
    }
  ];

  // Filtered Troubleshooting & Guides by search and category
  const filteredTroubleshooting = useMemo(() => {
    return troubleshootingGuides.filter(g => {
      if (activeCategory !== 'all' && g.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return g.title.toLowerCase().includes(q) || g.subtitle.toLowerCase().includes(q);
      }
      return true;
    });
  }, [troubleshootingGuides, activeCategory, searchQuery]);

  const filteredPopularGuides = useMemo(() => {
    return popularGuides.filter(g => {
      if (activeCategory !== 'all' && g.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return g.title.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q);
      }
      return true;
    });
  }, [popularGuides, activeCategory, searchQuery]);

  const handleOpenWhatsApp = () => {
    const restoName = restaurantInfo?.name || settingsForm?.name || 'My Restaurant';
    const msg = encodeURIComponent(`Hello TouchQR Support Team, I am an admin of "${restoName}". I need assistance with my TouchQR dashboard.`);
    window.open(`https://wa.me/${cleanWhatsappNumber}?text=${msg}`, '_blank');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      maxWidth: '1240px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
      paddingBottom: '120px',
      overflowX: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Responsive Styles */}
      <style>{`
        .support-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr);
          gap: 16px;
          align-items: flex-start;
          width: 100%;
          box-sizing: border-box;
        }
        .support-fast-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .support-fast-card {
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #EAE5DF;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .support-fast-card:hover {
          border-color: #CBD5E1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .support-chip-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.76rem;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #EAE5DF;
          background: #FAF8F5;
          color: #64748B;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .support-chip-btn.active {
          background: #064E3B;
          color: #FFFFFF;
          border-color: #064E3B;
          box-shadow: 0 2px 6px rgba(6, 78, 59, 0.20);
        }
        .support-list-item {
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #EAE5DF;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .support-list-item:hover {
          border-color: #CBD5E1;
          box-shadow: 0 3px 8px rgba(0,0,0,0.03);
          background: #FDFBF7;
        }
        .support-header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #EAE5DF;
          padding: 16px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          box-sizing: border-box;
          width: 100%;
          flex-wrap: wrap;
          gap: 12px;
        }
        @media (max-width: 960px) {
          .support-page-grid {
            grid-template-columns: 100% !important;
            gap: 14px !important;
          }
          .support-fast-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
        @media (max-width: 640px) {
          .support-header-container {
            padding: 12px 14px !important;
            gap: 10px !important;
          }
        }
      `}</style>

      {/* Global Toast Message */}
      {supportSuccessToast && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '14px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ECFDF5',
          color: '#059669',
          border: '1px solid #A7F3D0'
        }}>
          <span>{supportSuccessToast}</span>
          <button
            type="button"
            onClick={() => setSupportSuccessToast('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================================================
          PAGE HEADER
         ========================================================================= */}
      <div className="support-header-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          {(onBackToSettings || onBackToDashboard) && (
            <button
              type="button"
              onClick={onBackToSettings || onBackToDashboard}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '8px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#0F172A',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '0.76rem',
                fontWeight: 800
              }}
            >
              <ArrowLeft size={15} />
              <span>{onBackToSettings ? 'Settings' : 'Dashboard'}</span>
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '1.12rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Headphones size={17} color="#064E3B" style={{ flexShrink: 0 }} />
              <span>Help & Support</span>
            </h2>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              How can we help you run your business smoothly?
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '20px',
            background: '#ECFDF5',
            color: '#059669',
            border: '1px solid #A7F3D0',
            fontSize: '0.74rem',
            fontWeight: 800
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669' }} />
            <span>Support Available</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN SUPPORT SEARCH & CATEGORY CHIPS
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '16px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Search Field */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={17} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help articles, guides and troubleshooting..."
            style={{
              width: '100%',
              height: '44px',
              borderRadius: '12px',
              border: '1.5px solid #E2E8F0',
              padding: '0 14px 0 40px',
              fontSize: '0.84rem',
              color: '#0F172A',
              background: '#FAF8F5',
              outline: 'none',
              boxSizing: 'border-box',
              fontWeight: 600
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'orders', label: 'Orders' },
            { id: 'menu', label: 'Menu' },
            { id: 'qr', label: 'QR Codes' },
            { id: 'kds', label: 'KDS' },
            { id: 'billing', label: 'Billing' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'settings', label: 'Settings' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`support-chip-btn ${activeCategory === cat.id ? 'active' : ''}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SECTION 1 — GET HELP FAST (3 CARDS)
         ========================================================================= */}
      <div className="support-fast-grid">
        {/* Card 1: WhatsApp Support */}
        <div className="support-fast-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 900, display: 'block' }}>
                WhatsApp Support
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4 }}>
                Chat directly with TouchQR support for fast assistance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: 'none',
              background: '#16A34A',
              color: '#FFFFFF',
              fontSize: '0.78rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
            }}
          >
            <span>Chat on WhatsApp</span>
            <ExternalLink size={13} />
          </button>
        </div>

        {/* Card 2: Help Center */}
        <div className="support-fast-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 900, display: 'block' }}>
                Setup Guides & FAQs
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4 }}>
                Browse setup guides, printer setups, and common answers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('support-popular-guides');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FAF8F5',
              color: '#0F172A',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%'
            }}
          >
            <span>Browse Guides</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Card 3: Contact Support */}
        <div className="support-fast-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Headphones size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 900, display: 'block' }}>
                Contact Support
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748B', lineHeight: 1.4 }}>
                Send us a direct support ticket from your business account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('support-contact-form');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: 'none',
              background: '#064E3B',
              color: '#FFFFFF',
              fontSize: '0.78rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
            }}
          >
            <span>Submit Request</span>
            <Send size={13} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN TWO-COLUMN WORKSPACE (Guides & Troubleshooting | Form & Tickets)
         ========================================================================= */}
      <div className="support-page-grid">
        
        {/* LEFT COLUMN: TROUBLESHOOTING & POPULAR GUIDES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SECTION 2 — QUICK TROUBLESHOOTING */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', display: 'block' }}>
                  Quick Troubleshooting
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Step-by-step resolution for common restaurant operational questions
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTroubleshooting.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
                  No troubleshooting guides matching "{searchQuery}".
                </div>
              ) : (
                filteredTroubleshooting.map(guide => (
                  <div
                    key={guide.id}
                    className="support-list-item"
                    onClick={() => setActiveGuide(guide)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {guide.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {guide.title}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {guide.subtitle}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#064E3B', fontSize: '0.74rem', fontWeight: 800, flexShrink: 0 }}>
                      <span>View Guide</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 3 — POPULAR GUIDES */}
          <div id="support-popular-guides" style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div>
              <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', display: 'block' }}>
                Popular Guides & Knowledge Base
              </strong>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Master menu customization, QR standees, ordering, and reporting
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredPopularGuides.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.78rem', color: '#64748B' }}>
                  No guides matching "{searchQuery}".
                </div>
              ) : (
                filteredPopularGuides.map(guide => (
                  <div
                    key={guide.id}
                    className="support-list-item"
                    onClick={() => {
                      if (guide.actionTab && onNavigate) {
                        onNavigate(guide.actionTab, guide.actionDrawer || null);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {guide.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 800, display: 'block' }}>
                          {guide.title}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', lineHeight: 1.35 }}>
                          {guide.desc}
                        </span>
                      </div>
                    </div>

                    <ChevronRight size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CONTACT SUPPORT FORM, WHATSAPP CARD, TICKETS & SYSTEM STATUS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SECTION 4 — CONTACT SUPPORT FORM */}
          <div id="support-contact-form" style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div>
              <strong style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', display: 'block' }}>
                Need personal help?
              </strong>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Tell us what is happening and our support team will help.
              </span>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="e.g. Issue with QR standee download"
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '0.80rem',
                    color: '#0F172A',
                    background: '#FAF8F5',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Category
                </label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '0.80rem',
                    color: '#0F172A',
                    background: '#FAF8F5',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="orders">Orders & KDS</option>
                  <option value="menu">Menu & Pricing</option>
                  <option value="qr">QR Standees</option>
                  <option value="billing">Billing & Payments</option>
                  <option value="printers">Printers & Hardware</option>
                  <option value="other">General / Account</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Describe what is happening in detail..."
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '8px 12px',
                    fontSize: '0.80rem',
                    color: '#0F172A',
                    background: '#FAF8F5',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={supportSubmitting}
                style={{
                  height: '40px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#064E3B',
                  color: '#FFFFFF',
                  fontSize: '0.80rem',
                  fontWeight: 900,
                  cursor: supportSubmitting ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)'
                }}
              >
                {supportSubmitting ? (
                  <span>Submitting request...</span>
                ) : (
                  <>
                    <span>Send Support Request</span>
                    <Send size={13} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* SECTION 5 — WHATSAPP SUPPORT DIRECT CARD */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageCircle size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.84rem', color: '#0F172A', fontWeight: 900, display: 'block' }}>
                  Direct WhatsApp Chat
                </strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B', display: 'block' }}>
                  Available for priority merchant support
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#16A34A',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <span>Open</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {/* SECTION 6 — YOUR RECENT SUPPORT REQUESTS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <strong style={{ fontSize: '0.90rem', fontWeight: 900, color: '#0F172A' }}>
              Your Support Requests
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {supportTickets.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.76rem', color: '#64748B', background: '#FAF8F5', borderRadius: '10px' }}>
                  No support conversations yet.
                </div>
              ) : (
                supportTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#FAF8F5',
                      border: '1px solid #EAE5DF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ticket.subject}
                      </strong>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: ticket.status === 'Resolved' ? '#ECFDF5' : '#FEF3C7',
                        color: ticket.status === 'Resolved' ? '#059669' : '#D97706',
                        flexShrink: 0
                      }}>
                        {ticket.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94A3B8' }}>
                      <span>ID: {ticket.id}</span>
                      <span>{ticket.created}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 7 — TOUCHQR SYSTEM STATUS */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <strong style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#064E3B" />
              <span>TouchQR System Status</span>
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>● Live Orders & POS:</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>Operational</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>● Menu Storefront:</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>Operational</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>● QR Services:</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>Operational</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>● Billing & Invoicing:</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>Operational</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          FOCUSED TROUBLESHOOTING GUIDE MODAL
         ========================================================================= */}
      {activeGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeGuide.icon}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0F172A' }}>
                    {activeGuide.title}
                  </h3>
                  <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                    Resolution Guide · Category: {activeGuide.category.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveGuide(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', background: '#FAF8F5', border: '1px solid #EAE5DF', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <strong style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 800 }}>
                Recommended Steps:
              </strong>
              {activeGuide.steps.map((step, idx) => (
                <div key={idx} style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.45 }}>
                  {step}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setActiveGuide(null)}
                style={{ flex: 1, height: '38px', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer' }}
              >
                Close
              </button>

              {activeGuide.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    const actionTab = activeGuide.actionTab;
                    const actionDrawer = activeGuide.actionDrawer;
                    setActiveGuide(null);
                    if (actionTab && onNavigate) onNavigate(actionTab, actionDrawer);
                  }}
                  style={{ flex: 1.4, height: '38px', borderRadius: '10px', border: 'none', background: '#064E3B', color: '#FFFFFF', fontWeight: 900, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(6, 78, 59, 0.25)' }}
                >
                  {activeGuide.actionLabel} →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
