import {
  Home,
  ShoppingBag,
  Utensils,
  BarChart2,
  Users,
  Tag,
  QrCode,
  CreditCard,
  Star,
  Bell,
  Settings,
  MoreHorizontal
} from 'lucide-react';

/**
 * TouchQR Centralized Admin Navigation Configuration
 * Single source of truth for desktop sidebar, mobile drawer, and bottom navigation.
 */
export const ADMIN_NAVIGATION_ITEMS = Object.freeze([
  {
    id: 'home',
    label: 'Dashboard',
    bottomNavLabel: 'Home',
    icon: Home,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: true,
    matchTabs: ['home']
  },
  {
    id: 'orders',
    label: 'Orders',
    bottomNavLabel: 'Orders',
    icon: ShoppingBag,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: true,
    hasBadge: true,
    matchTabs: ['orders', 'floor-map', 'service-requests']
  },
  {
    id: 'dishes',
    label: 'Menu',
    bottomNavLabel: 'Menu',
    icon: Utensils,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: true,
    matchTabs: ['dishes', 'categories', 'combos']
  },
  {
    id: 'analytics',
    label: 'Analytics',
    bottomNavLabel: 'Analytics',
    icon: BarChart2,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: true,
    matchTabs: ['analytics']
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: false,
    highlight: true,
    matchTabs: ['customers']
  },
  {
    id: 'offers',
    label: 'Offers & Deals',
    icon: Tag,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: false,
    highlight: true,
    matchTabs: ['offers']
  },
  {
    id: 'qr-generator',
    label: 'QR Standees',
    icon: QrCode,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: false,
    matchTabs: ['qr-generator']
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: false,
    matchTabs: ['billing', 'subscription']
  },
  {
    id: 'review',
    label: 'Reviews & Feedback',
    icon: Star,
    showInDesktopSidebar: false,
    showInMobileDrawer: true,
    showInBottomNav: false,
    matchTabs: ['review']
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    showInDesktopSidebar: false,
    showInMobileDrawer: true,
    showInBottomNav: false,
    matchTabs: ['notifications']
  },
  {
    id: 'settings',
    label: 'Settings',
    bottomNavLabel: 'More',
    icon: Settings,
    bottomNavIcon: MoreHorizontal,
    showInDesktopSidebar: true,
    showInMobileDrawer: true,
    showInBottomNav: true,
    matchTabs: ['settings']
  }
]);

export const DESKTOP_SIDEBAR_ITEMS = ADMIN_NAVIGATION_ITEMS.filter(
  item => item.showInDesktopSidebar
);

export const MOBILE_DRAWER_ITEMS = ADMIN_NAVIGATION_ITEMS.filter(
  item => item.showInMobileDrawer
);

export const BOTTOM_NAV_ITEMS = ADMIN_NAVIGATION_ITEMS.filter(
  item => item.showInBottomNav
);

/**
 * Determine whether a navigation item is currently active.
 * Handles sub-routes (e.g. floor-map -> orders, categories -> dishes, subscription -> billing).
 * On mobile bottom bar, 'settings' also highlights when on qr-generator or review.
 */
export function isNavItemActive(item, activeTab, surface = 'desktop') {
  if (!item || !activeTab) return false;
  if (surface === 'bottomNav' && item.id === 'settings') {
    return ['settings', 'qr-generator', 'review'].includes(activeTab);
  }
  if (item.matchTabs && Array.isArray(item.matchTabs)) {
    return item.matchTabs.includes(activeTab);
  }
  return activeTab === item.id;
}
