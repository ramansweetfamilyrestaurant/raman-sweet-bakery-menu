const { query } = require('./db');

async function fix() {
  try {
    console.log('🚀 Step 1: Decoupling SuperAdmin from restaurant_id = 1...');
    const superResult = await query(`
      UPDATE admins 
      SET restaurant_id = NULL 
      WHERE role = 'superadmin' 
      RETURNING id, username, role, restaurant_id
    `);
    console.log('✅ SuperAdmin updated:', superResult);

    console.log('🚀 Step 2: Backfilling NULL business_type & service_model across all shops...');
    
    // Specific name-based intelligent mapping
    await query(`
      UPDATE restaurants 
      SET business_type = 'sweet_shop', service_model = 'dine_in' 
      WHERE (LOWER(name) LIKE '%sweet%' OR LOWER(name) LIKE '%mithai%') 
        AND (business_type IS NULL OR business_type = 'restaurant')
        AND id != 1
    `);

    await query(`
      UPDATE restaurants 
      SET business_type = 'bakery_confectionery', service_model = 'dine_in' 
      WHERE (LOWER(name) LIKE '%bakery%' OR LOWER(name) LIKE '%cake%') 
        AND (business_type IS NULL OR business_type = 'hotel_resort')
    `);

    await query(`
      UPDATE restaurants 
      SET business_type = 'cafe', service_model = 'dine_in' 
      WHERE (LOWER(name) LIKE '%cafe%' OR LOWER(name) LIKE '%coffee%') 
        AND business_type IS NULL
    `);

    await query(`
      UPDATE restaurants 
      SET business_type = 'dhaba', service_model = 'dine_in' 
      WHERE LOWER(name) LIKE '%dhaba%' 
        AND business_type IS NULL
    `);

    await query(`
      UPDATE restaurants 
      SET business_type = 'hotel_resort', service_model = 'hotel' 
      WHERE (LOWER(name) LIKE '%hotel%' OR LOWER(name) LIKE '%resort%') 
        AND business_type IS NULL
    `);

    await query(`
      UPDATE restaurants 
      SET business_type = 'cinema_theatre', service_model = 'cinema' 
      WHERE (LOWER(name) LIKE '%cinema%' OR LOWER(name) LIKE '%theatre%' OR LOWER(name) LIKE '%multiplex%') 
        AND business_type IS NULL
    `);

    // Backfill any remaining NULL business_type with default 'restaurant' and 'dine_in'
    const fallbackRes = await query(`
      UPDATE restaurants 
      SET business_type = 'restaurant', 
          service_model = COALESCE(service_model, 'dine_in')
      WHERE business_type IS NULL
      RETURNING id
    `);
    console.log(`✅ Backfilled ${fallbackRes.length} shops with default 'restaurant'`);

    // Verify all business_types now
    const stats = await query(`
      SELECT business_type, service_model, COUNT(*) as count 
      FROM restaurants 
      GROUP BY business_type, service_model 
      ORDER BY count DESC
    `);
    console.log('📊 Current Business Distribution:', stats);

    // Verify Admins
    const admins = await query(`
      SELECT id, username, role, restaurant_id 
      FROM admins 
      ORDER BY id ASC 
      LIMIT 10
    `);
    console.log('👤 Admins snapshot:', admins);

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

fix();
