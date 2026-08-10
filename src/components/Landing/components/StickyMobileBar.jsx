import React, { useState, useEffect } from 'react';
import { Sparkles, KeyRound } from 'lucide-react';

export default function StickyMobileBar({ onOpenLogin, onStartTrial }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky bar after scrolling down past 350px (Hero fold)
      if (window.scrollY > 350) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="km-sticky-mobile-bar">
      <button 
        onClick={onOpenLogin} 
        className="km-sticky-btn-login"
        aria-label="Owner Login"
      >
        <KeyRound size={15} />
        <span>Login</span>
      </button>

      <button 
        onClick={() => onStartTrial('')} 
        className="km-sticky-btn-trial"
        aria-label="Start Free Trial"
      >
        <Sparkles size={16} />
        <span>Start 17-Day Free Trial</span>
      </button>
    </div>
  );
}
