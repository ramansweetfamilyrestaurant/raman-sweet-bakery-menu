import React from 'react';

export default function AnnouncementBar({ trialDays = 17, onStartTrial }) {
  return (
    <div className="km-announcement-bar">
      <div className="km-announcement-content">
        <span>🎁 <strong>{trialDays}-Day Free Trial</strong> · Zero Credit Card Required · Instant 60-Second Setup</span>
        <span 
          className="km-announcement-link" 
          onClick={onStartTrial}
        >
          Start Free Trial →
        </span>
      </div>
    </div>
  );
}
