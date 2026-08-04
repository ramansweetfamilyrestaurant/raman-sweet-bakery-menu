import pg from 'pg';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function main() {
  console.log('Connecting to new Neon DB...');
  await pool.query('SELECT 1');
  console.log('⚡ Connected!');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      name_hi VARCHAR(255),
      image VARCHAR(1000),
      sort_order INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dishes (
      id SERIAL PRIMARY KEY,
      category_id INT REFERENCES categories(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      name_hi VARCHAR(255),
      description TEXT,
      description_hi TEXT,
      image VARCHAR(1000),
      price DECIMAL(10, 2) NOT NULL,
      price_half DECIMAL(10, 2),
      portion VARCHAR(100),
      portion_half_label VARCHAR(100),
      portion_full_label VARCHAR(100),
      badge VARCHAR(100),
      ingredients VARCHAR(500),
      taste_profile VARCHAR(100),
      available BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('📋 Tables created!');

  const data = JSON.parse(fs.readFileSync('server/exported_menu_data.json', 'utf8'));
  
  await pool.query('DELETE FROM dishes');
  await pool.query('DELETE FROM categories');

  const catIdMap = {};
  for (const cat of data.categories) {
    const res = await pool.query(
      'INSERT INTO categories (name, name_hi, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [cat.name, cat.name_hi || '', cat.image || '/uploads/logo.jpg', cat.sort_order || 0]
    );
    catIdMap[cat.id] = res.rows[0].id;
  }

  for (const d of data.dishes) {
    const newCatId = catIdMap[d.category_id];
    await pool.query(
      `INSERT INTO dishes (
        category_id, name, name_hi, description, description_hi, image, price, price_half,
        portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        newCatId, d.name, d.name_hi || '', d.description || '', d.description_hi || '', d.image || '/uploads/logo.jpg', d.price, d.price_half || null,
        d.portion || '', d.portion_half_label || '', d.portion_full_label || '', d.badge || '', d.ingredients || '', d.taste_profile || '', d.available !== false
      ]
    );
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('admin123', salt);
  await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING', ['admin', hash]);

  console.log(`✅ Successfully populated ${data.categories.length} categories and ${data.dishes.length} dishes to new Neon Postgres DB!`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
