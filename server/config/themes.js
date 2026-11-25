// Canonical server-side theme registry & plan access helpers

export const VALID_THEME_KEYS = [
  'gold',
  'emerald',
  'crimson',
  'navy',
  'amber',
  'purple',
  'rose',
  'dark'
];

export const DEFAULT_THEME_KEY = 'gold';

export function isValidThemeKey(themeInput) {
  if (!themeInput || typeof themeInput !== 'string') return false;
  const key = themeInput.toLowerCase().trim();
  return VALID_THEME_KEYS.includes(key) || key === 'cyber' || key === 'default';
}

export function resolveThemeKey(themeInput) {
  if (!themeInput || typeof themeInput !== 'string') return DEFAULT_THEME_KEY;
  const key = themeInput.toLowerCase().trim();
  if (key === 'cyber') return 'dark';
  if (key === 'default') return 'gold';
  return VALID_THEME_KEYS.includes(key) ? key : DEFAULT_THEME_KEY;
}

export function classifyPlanTier(planTier) {
  const tierKey = String(planTier || 'pro').toLowerCase().trim();
  const isUnlimitedPlan =
    tierKey.includes('enterprise') ||
    tierKey.includes('vip') ||
    tierKey === 'vip_ultra' ||
    tierKey === 'vip_ultra_plan';
  const isBasicPlan =
    !isUnlimitedPlan &&
    (tierKey === 'basic' || tierKey.endsWith('_basic') || tierKey.endsWith('basic'));
  return { tierKey, isUnlimitedPlan, isBasicPlan };
}

export function resolvePlanAllowedThemes(planRow, planTier) {
  if (planRow?.allowed_themes && String(planRow.allowed_themes).trim()) {
    return String(planRow.allowed_themes).trim();
  }
  const { isUnlimitedPlan, isBasicPlan } = classifyPlanTier(planTier);
  if (isBasicPlan) return 'gold';
  if (!isUnlimitedPlan) return 'gold,emerald,crimson,navy';
  return 'ALL';
}

export function isThemeAllowedForPlan(themeInput, allowedThemesStr) {
  const targetKey = resolveThemeKey(themeInput);
  if (!allowedThemesStr) return true;
  const normalizedStr = String(allowedThemesStr).trim();
  if (!normalizedStr || normalizedStr.toUpperCase() === 'ALL') return true;
  const allowedList = normalizedStr
    .split(',')
    .map(item => item.trim())
    .filter(item => item !== '' && isValidThemeKey(item))
    .map(item => resolveThemeKey(item));
  if (allowedList.length === 0) return targetKey === DEFAULT_THEME_KEY;
  return allowedList.includes(targetKey);
}
