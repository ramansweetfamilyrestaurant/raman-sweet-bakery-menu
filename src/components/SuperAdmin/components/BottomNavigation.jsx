import React from 'react';
import { LayoutDashboard, Store, Settings, UserCircle } from 'lucide-react';

export default function BottomNavigation({ activeView, setActiveView }) {
  const tabs = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'tenants', label: 'Restaurants', icon: Store },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <nav className="sa-mobile-nav">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`sa-mobile-nav-item ${activeView === tab.id ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
