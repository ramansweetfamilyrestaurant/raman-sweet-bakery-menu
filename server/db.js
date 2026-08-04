import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;

const dbFilePath = path.resolve('menu.db');

async function initDb() {
  if (process.env.DATABASE_URL) {
    try {
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
      });
      await pool.query('SELECT 1');
      pgPool = pool;
      dbType = 'postgres';
      console.log('⚡ Connected to PostgreSQL Database');
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed. Falling back to SQLite database:', err.message);
      dbType = 'sqlite';
    }
  }

  if (dbType === 'sqlite') {
    sqliteDb = new Database(dbFilePath);
    sqliteDb.pragma('foreign_keys = ON');
    console.log('⚡ Connected to SQLite Database at:', dbFilePath);
  }

  await createTables();
  await seedData();
}

async function createTables() {
  if (dbType === 'postgres') {
    await pgPool.query(`
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
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_hi TEXT,
        image TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        name_hi TEXT,
        description TEXT,
        description_hi TEXT,
        image TEXT,
        price REAL NOT NULL,
        price_half REAL,
        portion TEXT,
        portion_half_label TEXT,
        portion_full_label TEXT,
        badge TEXT,
        ingredients TEXT,
        taste_profile TEXT,
        available INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

async function seedData() {
  const catCheck = await query('SELECT COUNT(*) as count FROM categories');
  const count = parseInt(catCheck[0]?.count || 0, 10);

  if (count === 0) {
    console.log('🌱 Seeding authentic real menu data for Raman Sweet Bakery & Family Restaurant...');

    // Categories
    const categoriesData = [
      { name: 'Pure Desi Ghee Sweets', name_hi: 'शुद्ध देसी घी की मिठाइयां', image: '/uploads/sweets_hero.jpg', sort_order: 1 },
      { name: 'Artisanal Bakery & Cakes', name_hi: 'ताजा बेकरी एवं केक्स', image: '/uploads/bakery_hero.jpg', sort_order: 2 },
      { name: 'North Indian Royal Feast', name_hi: 'उत्तरी भारतीय शाही व्यंजन', image: '/uploads/north_indian_thali.jpg', sort_order: 3 },
      { name: 'South Indian Delights', name_hi: 'दक्षिण भारतीय डोसा एवं इडली', image: '/uploads/masala_dosa.jpg', sort_order: 4 },
      { name: 'Street Food & Chaat', name_hi: 'चटपटी दिल्ली चाट', image: '/uploads/logo.jpg', sort_order: 5 },
      { name: 'Beverages & Heritage Chai', name_hi: 'पेय पदार्थ एवं कुल्हड़ चाय', image: '/uploads/logo.jpg', sort_order: 6 }
    ];

    const catMap = {};
    for (const cat of categoriesData) {
      const res = await query(
        'INSERT INTO categories (name, name_hi, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
        [cat.name, cat.name_hi, cat.image, cat.sort_order]
      );
      const newId = res[0]?.id || res.lastInsertRowid;
      catMap[cat.name] = newId;
    }

    // Comprehensive Real Dishes Data
    const dishesData = [
      // 1. Sweets
      {
        category_id: catMap['Pure Desi Ghee Sweets'],
        name: 'Desi Ghee Motichoor Ladoo',
        name_hi: 'देसी घी मोतीचूर लड्डू',
        description: 'Melt-in-your-mouth gram flour pearls fried in 100% pure cow ghee, infused with saffron & cardamom.',
        description_hi: '100% शुद्ध गाय के देसी घी में बने केसरिया मोतीचूर लड्डू।',
        image: '/uploads/sweets_hero.jpg',
        price: 290,
        price_half: 150,
        portion: 'Available in 250g / 500g',
        portion_half_label: '250g',
        portion_full_label: '500g',
        badge: 'Traditional',
        ingredients: 'Gram Flour, Pure Ghee, Saffron, Pistachio',
        taste_profile: 'Rich & Sweet'
      },
      {
        category_id: catMap['Pure Desi Ghee Sweets'],
        name: 'Signature Kaju Katli',
        name_hi: 'सिग्नेचर काजू कतली',
        description: 'Premium Goa cashew nut fudge topped with fine edible silver leaf. Pure cashew richness.',
        description_hi: 'प्रीमियम गोवा काजू से बनी बिना मिलावट वाली शुद्ध काजू बर्फी।',
        image: '/uploads/kaju_katli.jpg',
        price: 540,
        price_half: 280,
        portion: 'Available in 250g / 500g',
        portion_half_label: '250g',
        portion_full_label: '500g',
        badge: '⭐ Must Try',
        ingredients: 'Goa Cashews, Sugar, Silver Foil',
        taste_profile: 'Nutty & Delicate'
      },
      {
        category_id: catMap['Pure Desi Ghee Sweets'],
        name: 'Royal Kesariya Gulab Jamun',
        name_hi: 'रॉयल केसरिया गुलाब जामुन',
        description: 'Golden fried khoya dumplings soaked in warm saffron-rose sugar syrup.',
        description_hi: 'देसी घी में तले हुए मावा गुलाब जामुन चाशनी के साथ।',
        image: '/uploads/gulab_jamun.jpg',
        price: 150,
        price_half: 80,
        portion: 'Available in 2 Pcs / 4 Pcs',
        portion_half_label: '2 Pcs',
        portion_full_label: '4 Pcs',
        badge: '🔥 Bestseller',
        ingredients: 'Pure Khoya, Saffron, Rose Water, Cardamom',
        taste_profile: 'Soft & Warm Sweetness'
      },
      {
        category_id: catMap['Pure Desi Ghee Sweets'],
        name: 'Special Royal Rasmalai',
        name_hi: 'स्पेशल रॉयल रसमलाई',
        description: 'Soft cottage cheese patties soaked in saffron-cardamom flavoured condensed milk, topped with pistachios.',
        description_hi: 'केसर और इलायची के गाढ़े दूध में डूबी नरम छेने की रसमलाई।',
        image: '/uploads/gulab_jamun.jpg',
        price: 210,
        price_half: 110,
        portion: 'Available in 2 Pcs / 4 Pcs',
        portion_half_label: '2 Pcs',
        portion_full_label: '4 Pcs',
        badge: 'Chef Special',
        ingredients: 'Fresh Chhena, Saffron Milk, Almonds, Pistachios',
        taste_profile: 'Melt-in-mouth Creamy'
      },
      {
        category_id: catMap['Pure Desi Ghee Sweets'],
        name: 'Desi Ghee Milk Cake',
        name_hi: 'देसी घी मिल्क केक',
        description: 'Traditional slow-caramelized milk fudge cooked with pure ghee & cardamom.',
        description_hi: 'पारंपरिक विधि से बना दानेदार मिल्क केक।',
        image: '/uploads/sweets_hero.jpg',
        price: 310,
        price_half: 160,
        portion: 'Available in 250g / 500g',
        portion_half_label: '250g',
        portion_full_label: '500g',
        badge: 'Fresh Daily',
        ingredients: 'Whole Milk, Pure Ghee, Sugar',
        taste_profile: 'Caramelized Sweet'
      },
      {
        category_id: catMap['Pure Desi Ghee Sweets'],
        name: 'Special Dhoda Barfi',
        name_hi: 'स्पेशल ढोढा बर्फी',
        description: 'Rich Punjabi style germinated wheat & milk sweet studded with almonds & cashew bits.',
        description_hi: 'मेवे और शुद्ध देसी घी से भरपूर ढोढा बर्फी।',
        image: '/uploads/sweets_hero.jpg',
        price: 270,
        price_half: 140,
        portion: 'Available in 250g / 500g',
        portion_half_label: '250g',
        portion_full_label: '500g',
        badge: 'Heritage',
        ingredients: 'Sprouted Wheat, Milk, Nuts, Ghee',
        taste_profile: 'Chewy & Rich'
      },

      // 2. Bakery
      {
        category_id: catMap['Artisanal Bakery & Cakes'],
        name: 'Belgian Dark Chocolate Truffle Cake',
        name_hi: 'बेल्जियम डार्क चॉकलेट ट्रफल केक',
        description: 'Rich 55% dark chocolate ganache layered over moist chocolate sponge.',
        description_hi: 'प्रीमियम डार्क चॉकलेट ट्रफल केक।',
        image: '/uploads/bakery_hero.jpg',
        price: 980,
        price_half: 550,
        portion: 'Available in 500g / 1kg',
        portion_half_label: '500g',
        portion_full_label: '1kg',
        badge: '🔥 Bestseller',
        ingredients: 'Dark Belgian Chocolate, Cocoa, Fresh Cream',
        taste_profile: 'Rich Dark Chocolate'
      },
      {
        category_id: catMap['Artisanal Bakery & Cakes'],
        name: 'Fresh Exotic Fruit Gateau Cake',
        name_hi: 'फ्रेश फ्रूट गेटो केक',
        description: 'Soft vanilla sponge layered with whipped cream & topped with fresh seasonal fruits.',
        description_hi: 'ताजे फलों और व्हिप्ड क्रीम से सजा सॉफ्ट वैनिला केक।',
        image: '/uploads/bakery_hero.jpg',
        price: 880,
        price_half: 490,
        portion: 'Available in 500g / 1kg',
        portion_half_label: '500g',
        portion_full_label: '1kg',
        badge: 'Fresh Daily',
        ingredients: 'Vanilla Sponge, Cream, Fresh Kiwi, Strawberry',
        taste_profile: 'Fruity & Light'
      },
      {
        category_id: catMap['Artisanal Bakery & Cakes'],
        name: 'Flaky Tandoori Paneer Patty',
        name_hi: 'तंदूरी पनीर पैटी',
        description: 'Golden flaky puff pastry stuffed with tandoori spiced cottage cheese & capsicum.',
        description_hi: 'मसालेदार पनीर स्टफिंग वाली कुरकुरी बेक्ड पैटी।',
        image: '/uploads/bakery_hero.jpg',
        price: 50,
        price_half: null,
        portion: '1 Pc • Hot Baked',
        badge: 'Snack Special',
        ingredients: 'Puff Pastry, Spiced Paneer, Bell Peppers',
        taste_profile: 'Crispy & Savory'
      },
      {
        category_id: catMap['Artisanal Bakery & Cakes'],
        name: 'Atta Biscuits & Elaichi Nankhatai',
        name_hi: 'आटा बिस्कुट एवं इलायची नानखटाई',
        description: 'Traditional desi ghee baked bakery cookies infused with cardamom.',
        description_hi: 'शुद्ध देसी घी में पके खस्ता नानखटाई बिस्कुट।',
        image: '/uploads/bakery_hero.jpg',
        price: 210,
        price_half: 110,
        portion: 'Available in 250g / 500g',
        portion_half_label: '250g',
        portion_full_label: '500g',
        badge: 'Teatime Special',
        ingredients: 'Wheat Flour, Desi Ghee, Cardamom',
        taste_profile: 'Crispy & Aromatic'
      },

      // 3. North Indian
      {
        category_id: catMap['North Indian Royal Feast'],
        name: 'Royal Shahi Paneer Butter Masala',
        name_hi: 'रॉयल शाही पनीर',
        description: 'Fresh malai cottage cheese cubes simmered in a velvety tomato, cashew & cultured butter gravy.',
        description_hi: 'काजू मलाई की गाढ़ी ग्रेवी में बने मखमली शाही पनीर।',
        image: '/uploads/paneer_masala.jpg',
        price: 260,
        price_half: 160,
        portion: 'Available in Half (200ml) / Full (350ml)',
        portion_half_label: 'Half (200ml)',
        portion_full_label: 'Full (350ml)',
        badge: '⭐ Must Try',
        ingredients: 'Fresh Paneer, Tomatoes, Cashew Paste, Cream',
        taste_profile: 'Mild & Creamy'
      },
      {
        category_id: catMap['North Indian Royal Feast'],
        name: 'Handi Dal Makhani Special',
        name_hi: 'हांडी दाल मखनी',
        description: 'Overnight slow-cooked black lentils enriched with cultured white butter & fresh cream.',
        description_hi: 'रात भर मंदी आंच पर पकी मक्खन और मलाई वाली दाल मखनी।',
        image: '/uploads/north_indian_thali.jpg',
        price: 230,
        price_half: 140,
        portion: 'Available in Half (200ml) / Full (350ml)',
        portion_half_label: 'Half (200ml)',
        portion_full_label: 'Full (350ml)',
        badge: '🔥 Bestseller',
        ingredients: 'Black Urad Dal, Cream, White Butter, Garlic',
        taste_profile: 'Creamy & Smoky'
      },
      {
        category_id: catMap['North Indian Royal Feast'],
        name: 'Amritsari Kulcha with Chole',
        name_hi: 'अमृतसरी कुलचा छोले',
        description: 'Crispy tandoori stuffed bread served with spicy Amritsari chole & imli chutney.',
        description_hi: 'मसालेदार आलू पनीर भरा तंदूरी कुलचा एवं छोले।',
        image: '/uploads/north_indian_thali.jpg',
        price: 195,
        price_half: 120,
        portion: 'Available in Half (1 Kulcha) / Full (2 Kulchas)',
        portion_half_label: '1 Kulcha',
        portion_full_label: '2 Kulchas',
        badge: 'Punjabi Special',
        ingredients: 'Spiced Potato Paneer, Chickpeas, Desi Butter',
        taste_profile: 'Crispy & Tangy'
      },
      {
        category_id: catMap['North Indian Royal Feast'],
        name: 'Special Royal Maharaja Thali',
        name_hi: 'स्पेशल रॉयल महाराजा थाली',
        description: 'Complete royal feast: Shahi Paneer, Dal Makhani, Mix Veg, Jeera Rice, 2 Butter Naan, Raita & Gulab Jamun.',
        description_hi: 'शाही पनीर, दाल मखनी, मिक्स वेज, जीरा राइस, 2 बटर नान, रायता एवं गुलाब जामुन।',
        image: '/uploads/north_indian_thali.jpg',
        price: 320,
        price_half: null,
        portion: 'Full Thali Meal • Serves 1',
        badge: 'Royal Special',
        ingredients: 'Paneer, Dal Makhani, Tandoori Naan, Jeera Rice, Sweets',
        taste_profile: 'Full Royal Meal'
      },
      {
        category_id: catMap['North Indian Royal Feast'],
        name: 'Kadhai Paneer Special',
        name_hi: 'कढ़ाई पनीर स्पेशल',
        description: 'Cottage cheese tossed with bell peppers & crushed coriander in spicy tomato gravy.',
        description_hi: 'शिमला मिर्च और साबुत धनिया मसालों के साथ भुना कढ़ाई पनीर।',
        image: '/uploads/paneer_masala.jpg',
        price: 270,
        price_half: 170,
        portion: 'Available in Half (200ml) / Full (350ml)',
        portion_half_label: 'Half (200ml)',
        portion_full_label: 'Full (350ml)',
        badge: 'Medium Spiced',
        ingredients: 'Paneer, Capsicum, Whole Coriander, Onion Gravy',
        taste_profile: 'Spiced & Tangy'
      },

      // 4. South Indian
      {
        category_id: catMap['South Indian Delights'],
        name: 'Mysuru Butter Masala Dosa',
        name_hi: 'मैसूर बटर मसाला डोसा',
        description: 'Crispy rice crepe smeared with fiery red garlic-chilli chutney, potato masala & pure butter.',
        description_hi: 'मक्खन में बना मसालेदार आलू स्टफ्ड मैसूर डोसा।',
        image: '/uploads/masala_dosa.jpg',
        price: 160,
        price_half: null,
        portion: '1 Large Dosa • Serves 1',
        badge: '🔥 Bestseller',
        ingredients: 'Rice Crepe, Potato Masala, Mysore Red Chutney, Butter',
        taste_profile: 'Crispy & Spicy'
      },
      {
        category_id: catMap['South Indian Delights'],
        name: 'Steamed Fluffy Idli with Sambar',
        name_hi: 'इडली सांभर (2 पीस / 4 पीस)',
        description: 'Soft steamed rice cakes served with hot lentil sambar & coconut chutney.',
        description_hi: 'गरमा गरम इडली सांभर और नारियल की चटनी।',
        image: '/uploads/masala_dosa.jpg',
        price: 160,
        price_half: 95,
        portion: 'Available in Half (2 Pcs) / Full (4 Pcs)',
        portion_half_label: '2 Pcs',
        portion_full_label: '4 Pcs',
        badge: 'Light & Healthy',
        ingredients: 'Fermented Rice Batter, Toor Dal, Coconut',
        taste_profile: 'Soft & Authentic'
      },
      {
        category_id: catMap['South Indian Delights'],
        name: 'Crispy Rava Onion Masala Dosa',
        name_hi: 'रवा अनियन मसाला डोसा',
        description: 'Lacy semolina crepe studded with chopped onions, green chillies & potato masala.',
        description_hi: 'प्याज और हरी मिर्च वाला कुरकुरा रवा डोसा।',
        image: '/uploads/masala_dosa.jpg',
        price: 175,
        price_half: null,
        portion: '1 Large Dosa • Serves 1',
        badge: 'Chef Special',
        ingredients: 'Semolina, Onions, Potato Masala, Butter',
        taste_profile: 'Super Crispy'
      },

      // 5. Street Food & Chaat
      {
        category_id: catMap['Street Food & Chaat'],
        name: 'Special Dahi Bhalla Chaat',
        name_hi: 'विशेष दही भल्ला चाट',
        description: 'Soft lentil dumplings topped with chilled sweet curd, saunth & mint chutneys.',
        description_hi: 'मीठे दही, सौंठ और हरी चटनी वाला नरम दही भल्ला।',
        image: '/uploads/logo.jpg',
        price: 110,
        price_half: null,
        portion: '1 Plate • Serves 1',
        badge: 'Chaat Special',
        ingredients: 'Urad Dal Vada, Sweet Curd, Tamarind Chutney, Roasted Cumin',
        taste_profile: 'Cool & Tangy'
      },
      {
        category_id: catMap['Street Food & Chaat'],
        name: 'Crispy Raj Kachori Special',
        name_hi: 'राज कचौरी स्पेशल',
        description: 'Giant crispy puri stuffed with boiled sprouts, bhalla, sweet curd & pomegranates.',
        description_hi: 'अनार, दही और चटनी से भरी शाही राज कचौरी।',
        image: '/uploads/logo.jpg',
        price: 135,
        price_half: null,
        portion: '1 Large Pc • Serves 1-2',
        badge: '⭐ Must Try',
        ingredients: 'Crispy Puri, Sprouts, Curd, Chutneys, Sev',
        taste_profile: 'Crunchy & Sweet Spiced'
      },
      {
        category_id: catMap['Street Food & Chaat'],
        name: 'Desi Ghee Aloo Tikki Chaat',
        name_hi: 'देसी घी आलू टिक्की चाट',
        description: 'Crispy pan-fried potato patties made in desi ghee, topped with spicy chole & curd.',
        description_hi: 'देसी घी में सिंकी कुरकुरी आलू टिक्की और छोले।',
        image: '/uploads/logo.jpg',
        price: 90,
        price_half: null,
        portion: '2 Tikkis • Serves 1',
        badge: '🔥 Bestseller',
        ingredients: 'Potatoes, Pure Ghee, Chole, Chutneys',
        taste_profile: 'Crispy & Flavorful'
      },

      // 6. Beverages
      {
        category_id: catMap['Beverages & Heritage Chai'],
        name: 'Kesar Badam Milk (Cold)',
        name_hi: 'केसर बादाम मिल्क (ठंडा)',
        description: 'Chilled full-cream milk slow-boiled with real saffron, crushed almonds & cardamom.',
        description_hi: 'केसर, इलायची और पिसे हुए बादाम वाला ठंडा दूध।',
        image: '/uploads/logo.jpg',
        price: 90,
        price_half: null,
        portion: '250ml Glass • Chilled',
        badge: '⭐ Must Try',
        ingredients: 'Whole Milk, Saffron, Almonds, Cardamom',
        taste_profile: 'Rich & Refreshing'
      },
      {
        category_id: catMap['Beverages & Heritage Chai'],
        name: 'Special Kulhad Masala Chai',
        name_hi: 'विशेष कुल्हड़ मसाला चाय',
        description: 'Brewed with fresh ginger, cardamom & secret spices, served hot in an earthen clay pot.',
        description_hi: 'अदरक और इलायची की कड़क कुल्हड़ चाय।',
        image: '/uploads/logo.jpg',
        price: 45,
        price_half: null,
        portion: '1 Clay Kulhad • Hot',
        badge: 'Heritage',
        ingredients: 'Assam Tea Leaves, Ginger, Cardamom, Milk',
        taste_profile: 'Aromatic & Spiced'
      }
    ];

    for (const d of dishesData) {
      await query(
        `INSERT INTO dishes (
          category_id, name, name_hi, description, description_hi, image, price, price_half,
          portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          d.category_id, d.name, d.name_hi || '', d.description || '', d.description_hi || '', d.image, d.price, d.price_half || null,
          d.portion || '', d.portion_half_label || '', d.portion_full_label || '', d.badge || '', d.ingredients || '', d.taste_profile || ''
        ]
      );
    }
  }

  // Ensure Admin user exists
  const adminCheck = await query('SELECT COUNT(*) as count FROM admins');
  const adminCount = parseInt(adminCheck[0]?.count || 0, 10);
  if (adminCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    await query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('🔐 Created default admin account: admin / admin123');
  }
}

async function query(text, params = []) {
  if (dbType === 'postgres') {
    const res = await pgPool.query(text, params);
    return res.rows;
  } else {
    let sql = text;
    let paramIndex = 1;

    // Convert $1, $2 parameter placeholders to SQLite ?
    sql = sql.replace(/\$(\d+)/g, () => '?');

    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(params);
    } else if (sql.trim().toUpperCase().startsWith('INSERT') && sql.toUpperCase().includes('RETURNING')) {
      const sqlNoReturning = sql.replace(/RETURNING\s+\w+/i, '');
      const stmtNoRet = sqliteDb.prepare(sqlNoReturning);
      const info = stmtNoRet.run(params);
      return [{ id: info.lastInsertRowid }];
    } else {
      return stmt.run(params);
    }
  }
}

export { initDb, query };
