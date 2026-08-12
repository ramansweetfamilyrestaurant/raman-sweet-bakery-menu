import { initDb, query } from '../server/db.js';

async function testUpdate() {
  try {
    await initDb();
    const res = await query(`
      UPDATE saas_plans
      SET name = $1, price = $2, badge = $3, description = $4,
          max_dishes = $5, max_categories = $6, max_combos = $7, max_tables = $8, max_staff_accounts = $9, order_retention_days = $10,
          modifiers_enabled = $11, staff_roles_enabled = $12, whatsapp_ordering_enabled = $13, direct_ordering_enabled = $14,
          audio_alarm_enabled = $15, order_status_whatsapp_enabled = $16, kds_enabled = $17, bluetooth_kot_enabled = $18,
          google_reviews_enabled = $19, ai_review_enabled = $20, stories_enabled = $21, gst_invoice_enabled = $22,
          analytics_export_enabled = $23, multi_language_enabled = $24, watermark_removal_enabled = $25, custom_domain_enabled = $26,
          dual_printer_enabled = $27
      WHERE key = $28
    `, [
      'Basic Starter Plan', 499, '⚡ BASIC', '', 9999, 9999, 3, 9999, 9999, 365,
      1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'basic'
    ]);
    console.log('Update success:', res);
  } catch (err) {
    console.error('Update error detail:', err);
  }
}

testUpdate();
