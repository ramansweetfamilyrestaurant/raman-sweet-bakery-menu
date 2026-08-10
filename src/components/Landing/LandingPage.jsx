import React from 'react';
import AnnouncementBar from './components/AnnouncementBar';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustStats from './components/TrustStats';
import CategoryStrip from './components/CategoryStrip';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import StandeePreview from './components/StandeePreview';
import ProductShowcase from './components/ProductShowcase';
import Pricing from './components/Pricing';
import Comparison from './components/Comparison';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import OwnerLoginModal from './components/OwnerLoginModal';
import StickyMobileBar from './components/StickyMobileBar';
import WhatsAppFloat from './components/WhatsAppFloat';
import './styles/LandingPage.css';

export default function LandingPage({
  publicPlans = [],
  trialDays = 17,
  showLoginModal = false,
  setShowLoginModal = () => {},
  loginMode = 'login',
  setLoginMode = () => {},
  loginSlugInput = '',
  setLoginSlugInput = () => {},
  adminUsernameInput = '',
  setAdminUsernameInput = () => {},
  adminPasswordInput = '',
  setAdminPasswordInput = () => {},
  newPasswordInput = '',
  setNewPasswordInput = () => {},
  loginErrMessage = '',
  setLoginErrMessage = () => {},
  successMessage = '',
  setSuccessMessage = () => {},
  loginLoading = false,
  onSubmitLogin = () => {},
  onSubmitResetPassword = () => {}
}) {
  const [platformLogoUrl, setPlatformLogoUrl] = React.useState('');

  React.useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.platform_logo_url) {
          setPlatformLogoUrl(data.platform_logo_url);
        }
      })
      .catch(() => {});
  }, []);

  const handleStartTrial = (planKey = '') => {
    const url = planKey ? `/register?plan=${planKey}` : '/register';
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleLiveDemo = () => {
    window.open('/raman-sweet-bakery', '_blank');
  };

  return (
    <div className="km-landing-wrapper">
      {/* Top Announcement Bar */}
      <AnnouncementBar 
        trialDays={trialDays} 
        onStartTrial={() => handleStartTrial('')} 
      />

      {/* Sticky Navigation Bar */}
      <Navbar 
        onOpenLogin={() => setShowLoginModal(true)} 
        onStartTrial={() => handleStartTrial('')} 
        logoUrl={platformLogoUrl}
      />

      {/* Conversion Hero Section */}
      <Hero 
        trialDays={trialDays} 
        onStartTrial={() => handleStartTrial('')} 
        onLiveDemo={handleLiveDemo} 
      />

      {/* Trust & Social Proof Strip */}
      <TrustStats trialDays={trialDays} />

      {/* Indian Food Business Category Badge Strip */}
      <CategoryStrip />

      {/* "Why TouchQR" Core Features */}
      <Features />

      {/* How It Works (3-Step Workflow) */}
      <HowItWorks />

      {/* Table QR Standee & Thermal KOT Hardware Preview */}
      <StandeePreview />

      {/* Product Showcase Sections (Mobile Tab Switcher Enabled) */}
      <ProductShowcase />

      {/* Dynamic Database SaaS Pricing */}
      <Pricing 
        publicPlans={publicPlans} 
        trialDays={trialDays} 
        onSelectPlan={(key) => handleStartTrial(key)} 
      />

      {/* Plan Feature Comparison Table */}
      <Comparison />

      {/* Accordion FAQ */}
      <FAQ trialDays={trialDays} />

      {/* SaaS Footer */}
      <Footer 
        logoUrl={logoUrl}
        onOpenLogin={() => setShowLoginModal(true)} 
        onStartTrial={() => handleStartTrial('')} 
      />

      {/* High-Conversion Sticky Mobile Action Bar (< 768px) */}
      <StickyMobileBar 
        onOpenLogin={() => setShowLoginModal(true)} 
        onStartTrial={() => handleStartTrial('')} 
      />

      {/* Floating WhatsApp Quick-Chat Widget */}
      <WhatsAppFloat />

      {/* Owner Login & Password Reset Dialog Modal */}
      <OwnerLoginModal
        show={showLoginModal}
        onClose={() => { setShowLoginModal(false); setLoginMode('login'); }}
        mode={loginMode}
        setMode={setLoginMode}
        usernameInput={loginMode === 'forgot' ? loginSlugInput : adminUsernameInput}
        setUsernameInput={loginMode === 'forgot' ? setLoginSlugInput : setAdminUsernameInput}
        passwordInput={adminPasswordInput}
        setPasswordInput={setAdminPasswordInput}
        newPasswordInput={newPasswordInput}
        setNewPasswordInput={setNewPasswordInput}
        errMessage={loginErrMessage}
        setErrMessage={setLoginErrMessage}
        successMessage={successMessage}
        setSuccessMessage={setSuccessMessage}
        loading={loginLoading}
        onSubmitLogin={onSubmitLogin}
        onSubmitResetPassword={onSubmitResetPassword}
      />
    </div>
  );
}
