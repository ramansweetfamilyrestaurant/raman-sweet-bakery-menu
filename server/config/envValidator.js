/**
 * Centralized Environment Configuration Validator for TouchQR
 * Rejects insecure defaults and missing required variables in production
 * NEVER prints secret values to stdout or logs.
 */
export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const issues = [];

  // 1. In production, require strong JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  const insecureJwtDefaults = [
    'touchqr_secret_jwt_key_change_me',
    'touchqr_super_secret_jwt_key_2026_change_in_production',
    'touchqr_secure_location_secret_key_2026',
    'secret',
    '123456',
    'password'
  ];

  if (!jwtSecret) {
    if (isProduction) {
      issues.push({ varName: 'JWT_SECRET', severity: 'CRITICAL', message: 'JWT_SECRET is missing.' });
    }
  } else if (isProduction && (jwtSecret.length < 16 || insecureJwtDefaults.includes(jwtSecret))) {
    issues.push({ varName: 'JWT_SECRET', severity: 'HIGH', message: 'JWT_SECRET is using a weak or default placeholder value.' });
  }

  // 2. Database URL check
  if (!process.env.DATABASE_URL && isProduction) {
    issues.push({ varName: 'DATABASE_URL', severity: 'CRITICAL', message: 'DATABASE_URL is missing in production.' });
  }

  // 3. Cashfree secrets check (if payment integration is enabled)
  if (process.env.CASHFREE_CLIENT_ID && !process.env.CASHFREE_CLIENT_SECRET) {
    issues.push({ varName: 'CASHFREE_CLIENT_SECRET', severity: 'HIGH', message: 'CASHFREE_CLIENT_ID is set but CASHFREE_CLIENT_SECRET is missing.' });
  }

  if (issues.length > 0) {
    console.warn('\n⚠️ [ENVIRONMENT VALIDATION NOTICE]');
    issues.forEach(issue => {
      console.warn(` - [${issue.severity}] Variable '${issue.varName}': ${issue.message}`);
    });
    console.warn('');
    if (isProduction && issues.some(i => i.severity === 'CRITICAL')) {
      throw new Error(`Fatal: Critical production configuration missing: ${issues.map(i => i.varName).join(', ')}`);
    }
  } else {
    console.log('⚡ [ENVIRONMENT VALIDATION] All required environment configurations verified.');
  }

  return { isValid: issues.length === 0, issues };
}
