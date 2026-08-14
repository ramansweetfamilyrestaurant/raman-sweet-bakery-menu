import { initDb, query } from './db.js';

async function resetMenu() {
  console.log('Initializing DB and resetting demo menu data...');
  await initDb();

  // Clear existing dishes and categories
  await query('DELETE FROM dishes');
  await query('DELETE FROM categories');
  console.log('🗑️ Cleared old categories and dishes.');

  const categoriesData = [
    { name: 'CHAAT', name_hi: 'चाट', image: '/uploads/logo.jpg', sort_order: 1 },
    { name: 'SNACKS', name_hi: 'स्नैक्स', image: '/uploads/logo.jpg', sort_order: 2 },
    { name: 'MOMOS', name_hi: 'मोमोस', image: '/uploads/logo.jpg', sort_order: 3 },
    { name: 'CHINESE', name_hi: 'चाइनीज', image: '/uploads/logo.jpg', sort_order: 4 },
    { name: 'BURGER', name_hi: 'बर्गर', image: '/uploads/logo.jpg', sort_order: 5 },
    { name: 'ROLLS', name_hi: 'रोल्स', image: '/uploads/logo.jpg', sort_order: 6 },
    { name: 'SANDWICH', name_hi: 'सैंडविच', image: '/uploads/logo.jpg', sort_order: 7 },
    { name: 'PIZZA', name_hi: 'पिज्जा', image: '/uploads/logo.jpg', sort_order: 8 },
    { name: 'PANEER', name_hi: 'पनीर स्पेशल', image: '/uploads/logo.jpg', sort_order: 9 },
    { name: 'DAL', name_hi: 'दाल', image: '/uploads/logo.jpg', sort_order: 10 },
    { name: 'RICE', name_hi: 'राइस एवं बिरयानी', image: '/uploads/logo.jpg', sort_order: 11 },
    { name: 'ROTI & NAAN', name_hi: 'रोटी एवं पराठा', image: '/uploads/logo.jpg', sort_order: 12 },
    { name: 'SALADS', name_hi: 'सलाद', image: '/uploads/logo.jpg', sort_order: 13 },
    { name: 'NORTH INDIAN BREAKFAST', name_hi: 'नॉर्थ इंडियन नाश्ता', image: '/uploads/logo.jpg', sort_order: 14 }
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

  const dishesData = [
    // 1. CHAAT
    { category_id: catMap['CHAAT'], name: 'Aloo Tikki Chaat', name_hi: 'आलू टिक्की चाट', description: 'Crispy potato patties topped with sweet curd, spicy mint chutney & tamarind.', price: 60, badge: '⭐ Must Try' },
    { category_id: catMap['CHAAT'], name: 'Samosa Chaat', name_hi: 'समोसा चाट', description: 'Crushed samosa topped with chhole, yogurt, chutneys & sev.', price: 50 },
    { category_id: catMap['CHAAT'], name: 'Papdi Chaat', name_hi: 'पापड़ी चाट', description: 'Crunchy papdis layered with chickpeas, yogurt, chutneys & pomegranate.', price: 60 },

    // 2. SNACKS
    { category_id: catMap['SNACKS'], name: 'Samosa', name_hi: 'समोसा', description: 'Crispy spiced potato pastry served with mint & tamarind chutney.', price: 15 },
    { category_id: catMap['SNACKS'], name: 'Kachori', name_hi: 'कचौड़ी', description: 'Crispy stuffed dal kachori served hot.', price: 15 },
    { category_id: catMap['SNACKS'], name: 'Bread Pakoda', name_hi: 'ब्रेड पकोड़ा', description: 'Spiced potato stuffed bread fritters fried to perfection.', price: 25 },
    { category_id: catMap['SNACKS'], name: 'Veg Pakoda', name_hi: 'वेज पकोड़ा', description: 'Crispy mix vegetable fritters.', price: 60 },
    { category_id: catMap['SNACKS'], name: 'Paneer Pakoda', name_hi: 'पनीर पकोड़ा', description: 'Soft paneer cubes coated in spiced gram flour batter.', price: 90, badge: '⭐ Must Try' },

    // 3. MOMOS
    { category_id: catMap['MOMOS'], name: 'Steam Momo', name_hi: 'स्टीम मोमो', description: 'Soft steamed dumplings packed with fresh minced vegetables.', price: 70, price_half: 40 },
    { category_id: catMap['MOMOS'], name: 'Fried Momo', name_hi: 'फ्राई मोमो', description: 'Crispy deep-fried vegetable dumplings.', price: 80, price_half: 45 },
    { category_id: catMap['MOMOS'], name: 'Kurkure Momo', name_hi: 'कुरकुरे मोमो', description: 'Crunchy coated veg dumplings served with spicy schezwan dip.', price: 110, price_half: 60, badge: '⭐ Must Try' },
    { category_id: catMap['MOMOS'], name: 'Tandoori Momo', name_hi: 'तंदूरी मोमो', description: 'Marinated momos charred in tandoori spices.', price: 120, price_half: 70 },

    // 4. CHINESE
    { category_id: catMap['CHINESE'], name: 'Veg Chowmein', name_hi: 'वेज चाऊमीन', description: 'Classic stir-fried noodles with fresh vegetables.', price: 80, price_half: 50 },
    { category_id: catMap['CHINESE'], name: 'Hakka Noodles', name_hi: 'हक्का नूडल्स', description: 'Indo-Chinese style tossed noodles with peppers & cabbage.', price: 90, price_half: 55 },
    { category_id: catMap['CHINESE'], name: 'Schezwan Noodles', name_hi: 'सेजवान नूडल्स', description: 'Spicy & tangy schezwan sauce tossed noodles.', price: 100, price_half: 60 },
    { category_id: catMap['CHINESE'], name: 'Veg Fried Rice', name_hi: 'वेज फ्राइड राइस', description: 'Wok-tossed rice with finely chopped vegetables.', price: 90, price_half: 55 },
    { category_id: catMap['CHINESE'], name: 'Schezwan Fried Rice', name_hi: 'सेजवान फ्राइड राइस', description: 'Spicy schezwan fried rice with veggies.', price: 100, price_half: 60 },
    { category_id: catMap['CHINESE'], name: 'Paneer Fried Rice', name_hi: 'पनीर फ्राइड राइस', description: 'Wok-tossed fried rice studded with paneer cubes.', price: 120, price_half: 70 },
    { category_id: catMap['CHINESE'], name: 'Veg Manchurian', name_hi: 'वेज मंचूरियन', description: 'Crispy veggie balls in rich Manchurian gravy.', price: 110, price_half: 65 },
    { category_id: catMap['CHINESE'], name: 'Paneer Manchurian', name_hi: 'पनीर मंचूरियन', description: 'Golden paneer cubes tossed in savory Manchurian sauce.', price: 140, price_half: 80 },
    { category_id: catMap['CHINESE'], name: 'Chilli Paneer', name_hi: 'चिल्ली पनीर', description: 'Crispy paneer tossed with capsicum, onion & dark soy chili sauce.', price: 150, price_half: 90, badge: '⭐ Must Try' },

    // 5. BURGER
    { category_id: catMap['BURGER'], name: 'Veg Burger', name_hi: 'वेज बर्गर', description: 'Crispy veg patty burger with fresh lettuce & mayo.', price: 50 },
    { category_id: catMap['BURGER'], name: 'Cheese Burger', name_hi: 'चीज बर्गर', description: 'Classic veg burger loaded with melted cheese slice.', price: 70 },
    { category_id: catMap['BURGER'], name: 'Paneer Burger', name_hi: 'पनीर बर्गर', description: 'Thick grilled paneer patty burger with secret sauce.', price: 80, badge: '⭐ Must Try' },

    // 6. ROLLS
    { category_id: catMap['ROLLS'], name: 'Veg Roll', name_hi: 'वेज रोल', description: 'Soft kathi roll packed with sauteed vegetables & chutneys.', price: 60 },
    { category_id: catMap['ROLLS'], name: 'Paneer Roll', name_hi: 'पनीर रोल', description: 'Spiced cottage cheese filling wrapped in crispy paratha roll.', price: 90 },
    { category_id: catMap['ROLLS'], name: 'Laccha Paneer Roll', name_hi: 'लच्छा पनीर रोल', description: 'Multi-layered flaky laccha roll loaded with tandoori paneer.', price: 110, badge: '⭐ Must Try' },

    // 7. SANDWICH
    { category_id: catMap['SANDWICH'], name: 'Veg Sandwich', name_hi: 'वेज सैंडविच', description: 'Fresh cucumber, tomato & mint chutney sandwich.', price: 50 },
    { category_id: catMap['SANDWICH'], name: 'Grilled Sandwich', name_hi: 'ग्रिल्ड सैंडविच', description: 'Butter toasted sandwich with vegetables & herbs.', price: 70 },
    { category_id: catMap['SANDWICH'], name: 'Cheese Sandwich', name_hi: 'चीज सैंडविच', description: 'Loaded gooey cheese grilled sandwich.', price: 80, badge: '⭐ Must Try' },

    // 8. PIZZA
    { category_id: catMap['PIZZA'], name: 'Veg Pizza', name_hi: 'वेज पिज्जा', description: 'Fresh tomato sauce pizza topped with onion, capsicum & mozzarella cheese.', price: 140, badge: '⭐ Must Try' },
    { category_id: catMap['PIZZA'], name: 'Paneer Pizza', name_hi: 'पनीर पिज्जा', description: 'Loaded paneer & cheese pizza with Italian seasonings.', price: 180 },
    { category_id: catMap['PIZZA'], name: 'Paneer Cheese Roll', name_hi: 'पनीर चीज रोल', description: 'Delicious roll stuffed with paneer & melted cheese.', price: 120 },
    { category_id: catMap['PIZZA'], name: 'Masala Cheese Roll', name_hi: 'मसाला चीज रोल', description: 'Spicy Indian style cheese filled roll.', price: 110 },
    { category_id: catMap['PIZZA'], name: 'Pizza Sandwich', name_hi: 'पिज्जा सैंडविच', description: 'Fusion grilled sandwich filled with pizza toppings & cheese.', price: 100 },

    // 9. PANEER
    { category_id: catMap['PANEER'], name: 'Paneer Butter Masala', name_hi: 'पनीर बटर मसाला', description: 'Rich creamy tomato gravy with tender paneer cubes.', price: 190, price_half: 110, badge: '⭐ Must Try' },
    { category_id: catMap['PANEER'], name: 'Kadai Paneer', name_hi: 'कढ़ाई पनीर', description: 'Paneer tossed with capsicum, onion & fresh kadai spices.', price: 190, price_half: 110 },
    { category_id: catMap['PANEER'], name: 'Shahi Paneer', name_hi: 'शाही पनीर', description: 'Mughlai style rich cashew-cream gravy paneer.', price: 180, price_half: 100 },
    { category_id: catMap['PANEER'], name: 'Paneer Masala', name_hi: 'पनीर मसाला', description: 'Spiced onion-tomato gravy paneer delicacy.', price: 180, price_half: 100 },
    { category_id: catMap['PANEER'], name: 'Paneer Do Pyaza', name_hi: 'पनीर दो प्याजा', description: 'Paneer cooked with double onions & aromatic spices.', price: 190, price_half: 110 },
    { category_id: catMap['PANEER'], name: 'Mix Veg', name_hi: 'मिक्स वेज', description: 'Assorted garden fresh vegetables in home-style curry.', price: 140, price_half: 80 },

    // 10. DAL
    { category_id: catMap['DAL'], name: 'Dal Fry', name_hi: 'दाल फ्राई', description: 'Yellow lentils tempered with cumin, garlic & ghee.', price: 110, price_half: 65 },
    { category_id: catMap['DAL'], name: 'Dal Tadka', name_hi: 'दाल तड़का', description: 'Yellow dal topped with double red chili ghee tadka.', price: 130, price_half: 75 },
    { category_id: catMap['DAL'], name: 'Dal Makhani', name_hi: 'दाल मखनी', description: 'Slow-cooked black lentils in butter & rich cream.', price: 160, price_half: 95, badge: '⭐ Must Try' },

    // 11. RICE
    { category_id: catMap['RICE'], name: 'Plain Rice', name_hi: 'प्लेन राइस', description: 'Steamed long-grain basmati rice.', price: 70, price_half: 40 },
    { category_id: catMap['RICE'], name: 'Jeera Rice', name_hi: 'जीरा राइस', description: 'Fluffy basmati rice tossed with cumin seeds & ghee.', price: 90, price_half: 50 },
    { category_id: catMap['RICE'], name: 'Veg Biryani', name_hi: 'वेज बिरयानी', description: 'Aromatic basmati rice cooked with spiced vegetables.', price: 130, price_half: 75 },
    { category_id: catMap['RICE'], name: 'Paneer Biryani', name_hi: 'पनीर बिरयानी', description: 'Fragrant basmati rice layered with marinated paneer.', price: 160, price_half: 95, badge: '⭐ Must Try' },

    // 12. ROTI & NAAN
    { category_id: catMap['ROTI & NAAN'], name: 'Butter Roti', name_hi: 'बटर रोटी', description: 'Soft whole wheat tandoori roti brushed with butter.', price: 15 },
    { category_id: catMap['ROTI & NAAN'], name: 'Plain Roti', name_hi: 'प्लेन रोटी', description: 'Freshly baked tandoori wheat roti.', price: 12 },
    { category_id: catMap['ROTI & NAAN'], name: 'Laccha Paratha', name_hi: 'लच्छा पराठा', description: 'Multi-layered crispy tandoori wheat paratha.', price: 35 },
    { category_id: catMap['ROTI & NAAN'], name: 'Aloo Paratha', name_hi: 'आलू पराठा', description: 'Stuffed potato paratha served with butter.', price: 50 },
    { category_id: catMap['ROTI & NAAN'], name: 'Paneer Paratha', name_hi: 'पनीर पराठा', description: 'Rich paneer stuffed paratha baked in tandoor.', price: 70, badge: '⭐ Must Try' },

    // 13. SALADS
    { category_id: catMap['SALADS'], name: 'Green Salad', name_hi: 'ग्रीन सलाद', description: 'Fresh sliced cucumber, tomato, onion, carrot & lemon.', price: 50 },

    // 14. NORTH INDIAN BREAKFAST
    { category_id: catMap['NORTH INDIAN BREAKFAST'], name: 'Chhole Bhature', name_hi: 'छोले भटूरे', description: '2 Fluffy fried bhaturas served with spicy Punjabi chhole & pickle.', price: 90, badge: '⭐ Must Try' },
    { category_id: catMap['NORTH INDIAN BREAKFAST'], name: 'Kachori Chhole', name_hi: 'कचौड़ी छोले', description: 'Crispy dal kachoris served with flavorful chhole curry.', price: 50 }
  ];

  for (const d of dishesData) {
    await query(
      `INSERT INTO dishes (
        category_id, name, name_hi, description, image, price, price_half,
        portion, portion_half_label, portion_full_label, badge, available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        d.category_id, d.name, d.name_hi || '', d.description || '', '/uploads/logo.jpg', d.price, d.price_half || null,
        d.price_half ? 'Half / Full' : '', d.price_half ? 'Half' : '', d.price_half ? 'Full' : '', d.badge || '', 1
      ]
    );
  }

  console.log(`✅ Successfully seeded ${categoriesData.length} categories and ${dishesData.length} dishes!`);
  process.exit(0);
}

resetMenu().catch(err => {
  console.error('Error resetting menu:', err);
  process.exit(1);
});
