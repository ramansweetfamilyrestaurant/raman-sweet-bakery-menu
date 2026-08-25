// Canonical Luxury Brand Theme Registry for TouchQR
export const CUSTOMER_MENU_THEMES = {
  gold: {
    id: 'gold',
    key: 'gold',
    name: 'Gold & Forest Green',
    color: '#0A2315',
    accent: '#D4AF37',
    desc: 'Taj / Oberoi Luxury',
    headerGradient: 'linear-gradient(180deg, #0A2315 0%, #123722 100%)',
    bgApp: '#F6F4EE',
    primary: '#0A2315'
  },
  emerald: {
    id: 'emerald',
    key: 'emerald',
    name: 'Emerald Mint',
    color: '#064E3B',
    accent: '#34D399',
    desc: 'Fresh & Eco Bistro',
    headerGradient: 'linear-gradient(180deg, #064E3B 0%, #047857 100%)',
    bgApp: '#F0FDF4',
    primary: '#064E3B'
  },
  crimson: {
    id: 'crimson',
    key: 'crimson',
    name: 'Crimson Ruby',
    color: '#881337',
    accent: '#FB7185',
    desc: 'Royal Fine-Dine',
    headerGradient: 'linear-gradient(180deg, #881337 0%, #9F1239 100%)',
    bgApp: '#FFF1F2',
    primary: '#881337'
  },
  navy: {
    id: 'navy',
    key: 'navy',
    name: 'Midnight Navy',
    color: '#0F172A',
    accent: '#60A5FA',
    desc: 'Sleek Modern Lounge',
    headerGradient: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
    bgApp: '#F8FAFC',
    primary: '#0F172A'
  },
  amber: {
    id: 'amber',
    key: 'amber',
    name: 'Royal Amber',
    color: '#451A03',
    accent: '#FBBF24',
    desc: 'Artisan Bakery & Cafe',
    headerGradient: 'linear-gradient(180deg, #451A03 0%, #78350F 100%)',
    bgApp: '#FFFBEB',
    primary: '#451A03'
  },
  purple: {
    id: 'purple',
    key: 'purple',
    name: 'Imperial Velvet',
    color: '#3B0764',
    accent: '#C084FC',
    desc: 'VIP Lounge & Bar',
    headerGradient: 'linear-gradient(180deg, #3B0764 0%, #581C87 100%)',
    bgApp: '#FAF5FF',
    primary: '#3B0764'
  },
  rose: {
    id: 'rose',
    key: 'rose',
    name: 'Champagne Rose',
    color: '#4C0519',
    accent: '#F472B6',
    desc: 'Chic Patisserie',
    headerGradient: 'linear-gradient(180deg, #4C0519 0%, #831843 100%)',
    bgApp: '#FDF2F8',
    primary: '#4C0519'
  },
  dark: {
    id: 'dark',
    key: 'dark',
    name: 'Obsidian Cyber',
    color: '#020617',
    accent: '#22D3EE',
    desc: 'Neon Cyber GastroPub',
    headerGradient: 'linear-gradient(180deg, #020617 0%, #0F172A 100%)',
    bgApp: '#0F172A',
    primary: '#020617'
  }
};

export const THEME_LIST = Object.values(CUSTOMER_MENU_THEMES);
export const DEFAULT_THEME = 'gold';

export function resolveTheme(themeInput) {
  if (!themeInput) return CUSTOMER_MENU_THEMES.gold;
  const key = String(themeInput).toLowerCase().trim();
  if (CUSTOMER_MENU_THEMES[key]) {
    return CUSTOMER_MENU_THEMES[key];
  }
  if (key === 'cyber') return CUSTOMER_MENU_THEMES.dark;
  if (key === 'default') return CUSTOMER_MENU_THEMES.gold;
  return CUSTOMER_MENU_THEMES.gold;
}

export function isValidTheme(themeKey) {
  if (!themeKey) return false;
  const key = String(themeKey).toLowerCase().trim();
  return Boolean(CUSTOMER_MENU_THEMES[key] || key === 'cyber' || key === 'default');
}
