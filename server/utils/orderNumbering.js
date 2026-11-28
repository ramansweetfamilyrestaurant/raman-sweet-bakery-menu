/**
 * Atomic per-business Order Number (`order_number`: 1, 2, 3...) and
 * IST-midnight daily Takeaway Token (`token_number`: TK-01, TK-02...) allocator.
 * Must be invoked inside an active DB transaction (`txQuery`).
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstStartOfDayUtcIso(now = new Date()) {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  istNow.setUTCHours(0, 0, 0, 0);
  return new Date(istNow.getTime() - IST_OFFSET_MS).toISOString();
}

async function runWithPgSavepoint(txQuery, dbType, spName, fn, onError) {
  if (dbType === 'postgres') {
    await txQuery(`SAVEPOINT ${spName}`);
    try {
      const val = await fn();
      await txQuery(`RELEASE SAVEPOINT ${spName}`);
      return val;
    } catch (err) {
      if (err && (err.code === '40P01' || err.code === '40001')) throw err;
      try { await txQuery(`ROLLBACK TO SAVEPOINT ${spName}`); } catch (_) { }
      try { await txQuery(`RELEASE SAVEPOINT ${spName}`); } catch (_) { }
      return onError ? await onError(err) : null;
    }
  }
  try {
    return await fn();
  } catch (err) {
    return onError ? await onError(err) : null;
  }
}

export async function allocateRestaurantOrderNumbers(txQuery, restaurantId, { isTakeaway = false, now = new Date(), dbType = 'sqlite' } = {}) {
  const targetId = Number(restaurantId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error(`Invalid restaurantId for order number allocation: ${restaurantId}`);
  }

  const rowLockClause = dbType === 'postgres' ? ' FOR UPDATE' : '';
  const currentSeq = await runWithPgSavepoint(
    txQuery,
    dbType,
    'order_seq_sp',
    async () => {
      const seqRows = await txQuery(
        `SELECT COALESCE(order_seq_counter, 0) AS seq FROM restaurants WHERE id = $1${rowLockClause}`,
        [targetId]
      );
      const list = seqRows?.rows || seqRows || [];
      return list[0]?.seq ? Number(list[0].seq) : 0;
    },
    async () => {
      await runWithPgSavepoint(txQuery, dbType, 'order_seq_alt_sp', async () => {
        await txQuery(dbType === 'postgres'
          ? 'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS order_seq_counter INT DEFAULT 0'
          : 'ALTER TABLE restaurants ADD COLUMN order_seq_counter INTEGER DEFAULT 0');
      });
      return 0;
    }
  );

  const maxOrderNum = await runWithPgSavepoint(
    txQuery,
    dbType,
    'order_num_sp',
    async () => {
      const maxRows = await txQuery(
        'SELECT COALESCE(MAX(order_number), 0) AS max_num FROM orders WHERE restaurant_id = $1',
        [targetId]
      );
      const list = maxRows?.rows || maxRows || [];
      return list[0]?.max_num ? Number(list[0].max_num) : 0;
    },
    async () => {
      await runWithPgSavepoint(txQuery, dbType, 'order_num_alt_sp', async () => {
        await txQuery(dbType === 'postgres'
          ? 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INT DEFAULT NULL'
          : 'ALTER TABLE orders ADD COLUMN order_number INTEGER DEFAULT NULL');
      });
      return 0;
    }
  );

  const orderNumber = Math.max(Number(currentSeq) || 0, Number(maxOrderNum) || 0) + 1;
  await runWithPgSavepoint(txQuery, dbType, 'order_seq_upd_sp', async () => {
    await txQuery('UPDATE restaurants SET order_seq_counter = $1 WHERE id = $2', [orderNumber, targetId]);
  });

  let tokenNumber = null;
  let tokenDisplay = null;
  if (isTakeaway) {
    const todayIstIso = getIstStartOfDayUtcIso(now);
    const maxToken = await runWithPgSavepoint(
      txQuery,
      dbType,
      'order_tok_sp',
      async () => {
        const tokenRows = await txQuery(
          'SELECT MAX(token_number) AS max_token FROM orders WHERE restaurant_id = $1 AND created_at >= $2',
          [targetId, todayIstIso]
        );
        const tList = tokenRows?.rows || tokenRows || [];
        return tList[0]?.max_token ? Number(tList[0].max_token) : 0;
      },
      async () => 0
    );
    tokenNumber = (Number(maxToken) || 0) + 1;
    tokenDisplay = `TK-${String(tokenNumber).padStart(2, '0')}`;
  }

  return { orderNumber, tokenNumber, tokenDisplay };
}
