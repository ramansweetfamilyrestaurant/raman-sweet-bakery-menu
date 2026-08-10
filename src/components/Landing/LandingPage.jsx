import React from 'react';
import AnnouncementBar from './components/AnnouncementBar';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustStats from './components/TrustStats';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import ProductShowcase from './components/ProductShowcase';
import Pricing from './components/Pricing';
import Comparison from './components/Comparison';
import TrialCTA from './components/TrialCTA';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import OwnerLoginModal from './components/OwnerLoginModal';
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
      />

      {/* Conversion Hero Section */}
      <Hero 
        trialDays={trialDays} 
        onStartTrial={() => handleStartTrial('')} 
        onLiveDemo={handleLiveDemo} 
      />

      {/* Trust & Social Proof Strip */}
      <TrustStats trialDays={trialDays} />

      {/* "Why KhanaMaster" Core Features */}
      <Features />

      {/* How It Works (3-Step Workflow) */}
      <HowItWorks />

      {/* Large Product Showcase Sections */}
      <ProductShowcase />

      {/* Dynamic Database SaaS Pricing */}
      <Pricing 
        publicPlans={publicPlans} 
        trialDays={trialDays} 
        onSelectPlan={(key) => handleStartTrial(key)} 
      />

      {/* Plan Feature Comparison Table */}
      <Comparison />

      {/* High-Conversion Pre-FAQ Trial CTA Banner */}
      <TrialCTA 
        trialDays={trialDays} 
        onStartTrial={() => handleStartTrial('')} 
      />

      {/* Accordion FAQ */}
      <FAQ trialDays={trialDays} />

      {/* SaaS Footer */}
      <Footer 
        onOpenLogin={() => setShowLoginModal(true)} 
        onStartTrial={() => handleStartTrial('')} 
      />

      {/* Mobile-Only Sticky Floating Bottom CTA Bar */}
      <div className="km-mobile-sticky-bar">
        <button 
          className="km-btn-primary km-btn-gold" 
          onClick={() => handleStartTrial('')}
          style={{ width: '100%', height: '48px', fontSize: '0.9rem', fontWeight: 900 }}
        >
          🚀 Start {trialDays}-Day Free Trial →
        </button>
      </div>

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
