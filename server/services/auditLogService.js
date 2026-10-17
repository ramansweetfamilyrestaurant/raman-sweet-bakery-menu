/**
 * TouchQR — Super Admin Audit Log Service
 * Step 4: Backend Pagination & Server-Side Filtering
 *
 * Provides safe parameter validation, deterministic SQL query building,
 * category condition synchronization, and robust execution with legacy backward compatibility.
 */

export const MAX_AUDIT_PAGE_SIZE = 100;
export const DEFAULT_AUDIT_PAGE_SIZE = 50;
export const LEGACY_DEFAULT_LIMIT = 150;

/**
 * SQL conditions for category mapping.
 * Strictly aligned with Step 1 getCategory() and computeAuditStats():
 * 1. Security
 * 2. VIP & Grants
 * 3. Billing & Cashfree Webhooks
 * 4. Shop / Tenant Lifecycle
 * 5. System (Fallback)
 */
export const CATEGORY_SQL_DEFINITIONS = {
  security: `(
    LOWER(a.action) LIKE '%security%' OR 
    LOWER(a.action) LIKE '%login%' OR 
    LOWER(a.action) LIKE '%logout%' OR 
    LOWER(a.action) LIKE '%credential%' OR 
    LOWER(a.action) LIKE '%password%' OR 
    LOWER(a.action) LIKE '%impersonat%'
  )`,
  vipRaw: `(
    LOWER(a.action) LIKE '%vip%' OR 
    LOWER(a.action) LIKE '%grant%' OR 
    LOWER(a.action) LIKE '%complimentary%' OR 
    LOWER(a.action) LIKE '%admin_granted%' OR 
    LOWER(a.action) LIKE '%free_access%' OR 
    LOWER(a.action) LIKE '%admin_access%'
  )`,
  billingRaw: `(
    LOWER(a.action) LIKE '%cashfree%' OR 
    LOWER(a.action) LIKE '%payment%' OR 
    LOWER(a.action) LIKE '%sub_%' OR 
    LOWER(a.action) LIKE '%subscription%' OR 
    LOWER(a.action) LIKE '%plan%' OR 
    LOWER(a.action) LIKE '%cancel%' OR 
    LOWER(a.action) LIKE '%renew%' OR 
    LOWER(a.action) LIKE '%refund%' OR 
    LOWER(a.action) LIKE '%debit%' OR 
    LOWER(a.action) LIKE '%pre_debit%' OR 
    LOWER(a.action) LIKE '%invoice%' OR 
    LOWER(a.action) LIKE '%checkout%' OR 
    LOWER(a.action) LIKE '%mandate%' OR 
    LOWER(a.action) LIKE '%webhook%' OR 
    LOWER(a.action) LIKE '%billing%'
  )`,
  tenantRaw: `(
    LOWER(a.action) LIKE '%tenant%' OR 
    LOWER(a.action) LIKE '%restaurant%' OR 
    LOWER(a.action) LIKE '%activat%' OR 
    LOWER(a.action) LIKE '%suspend%' OR 
    LOWER(a.action) LIKE '%delete%' OR 
    LOWER(a.action) LIKE '%register%' OR 
    LOWER(a.action) LIKE '%owner_email%' OR 
    LOWER(a.action) LIKE '%category%' OR 
    LOWER(a.action) LIKE '%dish%' OR 
    LOWER(a.action) LIKE '%combo%' OR 
    LOWER(a.action) LIKE '%settings%'
  )`
};

// Derived composite category conditions matching Step 1 precedence
export const getCategorySqlCondition = (category) => {
  const { security, vipRaw, billingRaw, tenantRaw } = CATEGORY_SQL_DEFINITIONS;
  switch (category) {
    case 'security':
      return security;
    case 'vip':
      return `(NOT ${security} AND ${vipRaw})`;
    case 'billing':
      return `(NOT ${security} AND NOT ${vipRaw} AND ${billingRaw})`;
    case 'tenant':
      return `(NOT ${security} AND NOT ${vipRaw} AND NOT ${billingRaw} AND ${tenantRaw})`;
    case 'system':
      return `(NOT ${security} AND NOT ${vipRaw} AND NOT ${billingRaw} AND NOT ${tenantRaw})`;
    default:
      return null;
  }
};

/**
 * Normalizes actor role filter into parameterized SQL matching Step 2 rules.
 * Maps 'admin', 'restaurant_admin', 'tenant_admin' to admin group.
 * Prevents merging between Super Admin, Restaurant Admin, and System Worker.
 */
export const getActorRoleSqlCondition = (actor, paramIndex) => {
  if (!actor || actor === 'all') return { sql: null, params: [] };
  const raw = String(actor).trim().toLowerCase();
  if (raw === 'admin' || raw === 'restaurant_admin' || raw === 'tenant_admin' || raw === 'resto_admin') {
    return {
      sql: `LOWER(a.actor_role) IN ('admin', 'restaurant_admin', 'tenant_admin', 'resto_admin')`,
      params: []
    };
  }
  if (raw === 'superadmin' || raw === 'super_admin') {
    return {
      sql: `LOWER(a.actor_role) IN ('superadmin', 'super_admin')`,
      params: []
    };
  }
  if (raw === 'payment_gateway' || raw === 'cashfree' || raw === 'gateway') {
    return {
      sql: `LOWER(a.actor_role) IN ('payment_gateway', 'cashfree', 'gateway')`,
      params: []
    };
  }
  if (raw === 'system' || raw === 'system_worker' || raw === 'worker') {
    return {
      sql: `(LOWER(a.actor_role) IN ('system', 'system_worker', 'worker') OR a.actor_role IS NULL)`,
      params: []
    };
  }
  return {
    sql: `LOWER(a.actor_role) = $${paramIndex}`,
    params: [raw]
  };
};

/**
 * Validates and sanitizes raw query parameters.
 * Returns { valid: true, isLegacy: boolean, params: object } or { valid: false, status: 400, error: string }
 */
export const validateAuditLogParams = (rawQuery = {}) => {
  const hasPaginationParam = rawQuery.page !== undefined || rawQuery.limit !== undefined || rawQuery.paginated === 'true';
  const hasFilterParam = Boolean(
    (rawQuery.category && rawQuery.category !== 'all') ||
    (rawQuery.search && rawQuery.search.trim()) ||
    (rawQuery.q && rawQuery.q.trim()) ||
    (rawQuery.actor && rawQuery.actor !== 'all') ||
    (rawQuery.actor_role && rawQuery.actor_role !== 'all') ||
    (rawQuery.restaurant_id !== undefined && rawQuery.restaurant_id !== '' && rawQuery.restaurant_id !== 'all') ||
    (rawQuery.tenant_id !== undefined && rawQuery.tenant_id !== '' && rawQuery.tenant_id !== 'all') ||
    rawQuery.start_date ||
    rawQuery.end_date
  );

  const isLegacy = !hasPaginationParam && !hasFilterParam;

  // 1. Page validation
  let page = 1;
  if (rawQuery.page !== undefined && rawQuery.page !== null && rawQuery.page !== '') {
    const p = Number(rawQuery.page);
    if (!Number.isInteger(p) || p < 1) {
      return { valid: false, status: 400, error: 'Invalid page parameter. Must be an integer >= 1.' };
    }
    page = p;
  }

  // 2. Limit validation
  let limit = isLegacy ? LEGACY_DEFAULT_LIMIT : DEFAULT_AUDIT_PAGE_SIZE;
  if (rawQuery.limit !== undefined && rawQuery.limit !== null && rawQuery.limit !== '') {
    const l = Number(rawQuery.limit);
    if (!Number.isInteger(l) || l < 1) {
      return { valid: false, status: 400, error: 'Invalid limit parameter. Must be an integer >= 1.' };
    }
    limit = Math.min(l, MAX_AUDIT_PAGE_SIZE);
  }

  // 3. Category validation
  let category = null;
  if (rawQuery.category && rawQuery.category !== 'all') {
    const cat = String(rawQuery.category).trim().toLowerCase();
    if (!['security', 'vip', 'billing', 'tenant', 'system'].includes(cat)) {
      return { valid: false, status: 400, error: `Invalid category filter: '${rawQuery.category}'. Must be one of security, vip, billing, tenant, system.` };
    }
    category = cat;
  }

  // 4. Actor role validation
  let actor = null;
  const rawActor = rawQuery.actor || rawQuery.actor_role;
  if (rawActor && rawActor !== 'all') {
    actor = String(rawActor).trim().toLowerCase();
  }

  // 5. Restaurant / Tenant ID validation
  let restaurantId = undefined; // undefined = no filter
  const rawRestoId = rawQuery.restaurant_id !== undefined ? rawQuery.restaurant_id : rawQuery.tenant_id;
  if (rawRestoId !== undefined && rawRestoId !== null && rawRestoId !== '' && rawRestoId !== 'all') {
    const trimmed = String(rawRestoId).trim().toLowerCase();
    if (trimmed === 'null' || trimmed === 'platform' || trimmed === 'system' || trimmed === '0') {
      restaurantId = null; // Filter for platform-level logs with restaurant_id IS NULL
    } else {
      const rid = Number(trimmed);
      if (!Number.isInteger(rid) || rid < 1) {
        return { valid: false, status: 400, error: 'Invalid restaurant_id parameter. Must be a positive integer or "platform".' };
      }
      restaurantId = rid;
    }
  }

  // 6. Search text
  let search = null;
  const rawSearch = rawQuery.search || rawQuery.q;
  if (rawSearch && typeof rawSearch === 'string' && rawSearch.trim()) {
    search = rawSearch.trim();
  }

  // 7. Start date and End date validation
  let startDate = null;
  let endDate = null;
  if (rawQuery.start_date) {
    const d = new Date(rawQuery.start_date);
    if (isNaN(d.getTime())) {
      return { valid: false, status: 400, error: 'Invalid start_date format. Must be a valid date or ISO timestamp.' };
    }
    // If date-only format (YYYY-MM-DD), set to beginning of UTC day
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawQuery.start_date).trim())) {
      startDate = new Date(`${String(rawQuery.start_date).trim()}T00:00:00.000Z`);
    } else {
      startDate = d;
    }
  }

  if (rawQuery.end_date) {
    const d = new Date(rawQuery.end_date);
    if (isNaN(d.getTime())) {
      return { valid: false, status: 400, error: 'Invalid end_date format. Must be a valid date or ISO timestamp.' };
    }
    // If date-only format (YYYY-MM-DD), set to end of UTC day
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawQuery.end_date).trim())) {
      endDate = new Date(`${String(rawQuery.end_date).trim()}T23:59:59.999Z`);
    } else {
      endDate = d;
    }
  }

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    return { valid: false, status: 400, error: 'start_date cannot be after end_date.' };
  }

  return {
    valid: true,
    isLegacy,
    params: {
      page,
      limit,
      category,
      actor,
      restaurantId,
      search,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null
    }
  };
};

/**
 * Builds parameterized SQL queries for data stream, total matching count, and category stats.
 */
export const buildAuditLogQuery = (params) => {
  const conditions = [];
  const queryParams = [];

  // Helper to push param and return $index
  const addParam = (val) => {
    queryParams.push(val);
    return `$${queryParams.length}`;
  };

  // 1. Restaurant / Tenant ID filter
  const effectiveRestoId = params.restaurantId !== undefined ? params.restaurantId : params.restaurant_id;
  if (effectiveRestoId === null) {
    conditions.push('a.restaurant_id IS NULL');
  } else if (effectiveRestoId !== undefined) {
    const p = addParam(typeof effectiveRestoId === 'string' ? Number(effectiveRestoId) : effectiveRestoId);
    conditions.push(`a.restaurant_id = ${p}`);
  }

  // 2. Category filter
  if (params.category) {
    const catSql = getCategorySqlCondition(params.category);
    if (catSql) {
      conditions.push(catSql);
    }
  }

  // 3. Actor filter
  if (params.actor) {
    const actorRes = getActorRoleSqlCondition(params.actor, queryParams.length + 1);
    if (actorRes.sql) {
      conditions.push(actorRes.sql);
      if (actorRes.params.length > 0) {
        queryParams.push(...actorRes.params);
      }
    }
  }

  // 4. Search query
  if (params.search) {
    const p = addParam(`%${params.search.toLowerCase()}%`);
    conditions.push(`(
      LOWER(a.action) LIKE ${p} OR 
      LOWER(COALESCE(a.details, '')) LIKE ${p} OR 
      LOWER(COALESCE(a.actor_role, '')) LIKE ${p} OR 
      LOWER(COALESCE(r.name, '')) LIKE ${p} OR 
      CAST(COALESCE(a.restaurant_id, 0) AS TEXT) LIKE ${p}
    )`);
  }

  // 5. Date boundaries
  if (params.startDate) {
    const p = addParam(params.startDate);
    conditions.push(`a.created_at >= ${p}`);
  }
  if (params.endDate) {
    const p = addParam(params.endDate);
    conditions.push(`a.created_at <= ${p}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Data query with deterministic order:
  // Stable primary sort: created_at DESC; stable secondary sort: id DESC
  const offset = (params.page - 1) * params.limit;
  const limitParam = addParam(params.limit);
  const offsetParam = addParam(offset);

  const dataSql = `
    SELECT 
      a.id,
      a.restaurant_id,
      a.actor_role,
      a.action,
      a.details,
      a.created_at,
      r.name AS restaurant_name,
      r.logo AS restaurant_logo
    FROM audit_logs a
    LEFT JOIN restaurants r ON r.id = a.restaurant_id
    ${whereClause}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  // Count query for pagination (uses the exact same filter parameters, without limit and offset)
  const countParams = queryParams.slice(0, queryParams.length - 2);
  const countSql = `
    SELECT COUNT(*) AS total
    FROM audit_logs a
    LEFT JOIN restaurants r ON r.id = a.restaurant_id
    ${whereClause}
  `;

  // Stats query: platform-wide totals (or scoped to restaurant_id if restaurant filter is set)
  // ANSI-standard COUNT(CASE WHEN ... THEN 1 END) works identically on PostgreSQL and SQLite
  const statsConditions = [];
  const statsParams = [];
  if (params.restaurantId === null) {
    statsConditions.push('a.restaurant_id IS NULL');
  } else if (params.restaurantId !== undefined) {
    statsParams.push(params.restaurantId);
    statsConditions.push(`a.restaurant_id = $${statsParams.length}`);
  }
  const statsWhere = statsConditions.length > 0 ? `WHERE ${statsConditions.join(' AND ')}` : '';

  const { security, vipRaw, billingRaw, tenantRaw } = CATEGORY_SQL_DEFINITIONS;
  const secCond = security;
  const vipCond = `(NOT ${secCond} AND ${vipRaw})`;
  const billCond = `(NOT ${secCond} AND NOT ${vipRaw} AND ${billingRaw})`;
  const tenantCond = `(NOT ${secCond} AND NOT ${vipRaw} AND NOT ${billingRaw} AND ${tenantRaw})`;
  const systemCond = `(NOT ${secCond} AND NOT ${vipRaw} AND NOT ${billingRaw} AND NOT ${tenantCond})`;

  const statsSql = `
    SELECT 
      COUNT(*) AS total,
      COUNT(CASE WHEN ${secCond} THEN 1 END) AS security,
      COUNT(CASE WHEN ${vipCond} THEN 1 END) AS vip,
      COUNT(CASE WHEN ${billCond} THEN 1 END) AS billing,
      COUNT(CASE WHEN ${tenantCond} THEN 1 END) AS tenant,
      COUNT(CASE WHEN ${systemCond} THEN 1 END) AS system
    FROM audit_logs a
    ${statsWhere}
  `;

  return {
    dataSql,
    dataParams: queryParams,
    countSql,
    countParams,
    statsSql,
    statsParams,
    whereClause
  };
};

/**
 * Orchestrates validation and execution of audit log queries.
 *
 * @param {Function} queryFn - Async database query executor
 * @param {object} rawQuery - Express req.query object
 * @returns {Promise<Array|object>} Array for legacy unpaginated calls, object for paginated calls
 */
export const fetchPlatformAuditLogs = async (queryFn, rawQuery = {}) => {
  const validation = validateAuditLogParams(rawQuery);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.status = validation.status;
    throw err;
  }

  const { isLegacy, params } = validation;
  const { dataSql, dataParams, countSql, countParams, statsSql, statsParams } = buildAuditLogQuery(params);

  // Execute data query
  const logs = await queryFn(dataSql, dataParams);
  const logRows = Array.isArray(logs) ? logs : [];

  // If legacy call without pagination or filters, return rows array for backward compatibility
  if (isLegacy) {
    return logRows;
  }

  // Execute count and stats queries
  const [countRes, statsRes] = await Promise.all([
    queryFn(countSql, countParams),
    queryFn(statsSql, statsParams)
  ]);

  const total = parseInt((countRes && countRes[0]?.total) || 0, 10);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const hasNextPage = params.page < totalPages;
  const hasPrevPage = params.page > 1;

  const statsRow = statsRes && statsRes[0] ? statsRes[0] : null;
  const stats = {
    total: parseInt(statsRow?.total || 0, 10),
    security: parseInt(statsRow?.security || 0, 10),
    billing: parseInt(statsRow?.billing || 0, 10),
    tenant: parseInt(statsRow?.tenant || 0, 10),
    vip: parseInt(statsRow?.vip || 0, 10),
    system: parseInt(statsRow?.system || 0, 10)
  };

  return {
    logs: logRows,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      currentPageCount: logRows.length
    },
    stats
  };
};
