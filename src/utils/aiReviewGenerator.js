// Smart NLP AI Review Generator Engine
// Generates natural, authentic, human-sounding 1-5 star Google reviews tailored to specific business types without external API costs.

export const RESTO_TYPES = [
  { id: 'sweet_bakery', label: '🧁 Sweet & Bakery', icon: '🧁' },
  { id: 'sweet_shop', label: '🍬 Mithai & Sweet Shop', icon: '🍬' },
  { id: 'cafe', label: '☕ Cafe & Coffee Shop', icon: '☕' },
  { id: 'fast_food', label: '🍔 Fast Food & QSR', icon: '🍔' },
  { id: 'dhaba', label: '🍲 Highway Dhaba & Desi Rasoi', icon: '🍲' },
  { id: 'pure_veg', label: '🌿 Pure Veg & South Indian', icon: '🌿' },
  { id: 'biryani', label: '🍗 Biryani & Non-Veg Special', icon: '🍗' },
  { id: 'multi_cuisine', label: '🥘 Multi-Cuisine Restaurant', icon: '🥘' },
  { id: 'hotel_resort', label: '🏨 Hotel & Resort', icon: '🏨' },
  { id: 'cinema_theatre', label: '🎬 Cinema & Theatre', icon: '🎬' },
  { id: 'cloud_kitchen', label: '🛵 Cloud Kitchen & Takeaway', icon: '🛵' }
];

export const HIGHLIGHT_CHIPS = {
  sweet_bakery: [
    { id: 'fresh_sweets', label: '🍬 Fresh Sweets' },
    { id: 'tasty_snacks', label: '🧆 Tasty Snacks' },
    { id: 'fast_service', label: '⚡ Fast Service' },
    { id: 'hygienic', label: '🧹 Clean & Hygienic' },
    { id: 'polite_staff', label: '😊 Polite Staff' }
  ],
  sweet_shop: [
    { id: 'fresh_mithai', label: '🍬 Fresh Mithai' },
    { id: 'desi_ghee', label: '🧈 Pure Desi Ghee' },
    { id: 'crispy_samosa', label: '🥟 Hot Samosa & Chaat' },
    { id: 'clean_counter', label: '🧹 Clean & Hygienic' },
    { id: 'polite_staff', label: '😊 Polite Staff' }
  ],
  cafe: [
    { id: 'great_coffee', label: '☕ Great Coffee' },
    { id: 'chill_vibe', label: '🎵 Cozy Ambiance' },
    { id: 'tasty_bites', label: '🥪 Delicious Bites' },
    { id: 'quick_service', label: '⚡ Quick Service' },
    { id: 'good_hangout', label: '👥 Perfect Hangout' }
  ],
  fast_food: [
    { id: 'crispy_bites', label: '🍟 Crispy & Fresh' },
    { id: 'awesome_shakes', label: '🥤 Awesome Shakes' },
    { id: 'quick_service', label: '⚡ Lightning Fast' },
    { id: 'great_vibe', label: '🎵 Cool Vibe' },
    { id: 'good_value', label: '💰 Reasonable Price' }
  ],
  dhaba: [
    { id: 'desi_tadka', label: '🌶️ Authentic Desi Tadka' },
    { id: 'tandoori_roti', label: '🫓 Hot Tandoori Roti' },
    { id: 'dal_makhani', label: '🍲 Rich Dal Makhani' },
    { id: 'generous_quantity', label: '🍱 Generous Quantity' },
    { id: 'fast_service', label: '⚡ Quick Service' }
  ],
  pure_veg: [
    { id: 'pure_hygiene', label: '🟢 100% Pure Veg' },
    { id: 'crispy_dosa', label: '🥞 Delicious Dosa/Thali' },
    { id: 'authentic_flavour', label: '🍲 Authentic Taste' },
    { id: 'fast_service', label: '⚡ Fast Service' },
    { id: 'family_friendly', label: '👨‍👩‍👧‍👦 Family Friendly' }
  ],
  biryani: [
    { id: 'juicy_biryani', label: '🍗 Flavorful Biryani' },
    { id: 'rich_aroma', label: '🌶️ Rich Spices' },
    { id: 'tender_pieces', label: '🍖 Tender Pieces' },
    { id: 'fast_service', label: '⚡ Quick Service' },
    { id: 'generous_portion', label: '🍱 Generous Quantity' }
  ],
  multi_cuisine: [
    { id: 'delicious_food', label: '🥘 Delicious Food' },
    { id: 'family_ambiance', label: '👑 Family Ambiance' },
    { id: 'great_service', label: '⚡ Great Hospitality' },
    { id: 'rich_taste', label: '🍛 Authentic Gravies' },
    { id: 'clean_space', label: '🧹 Clean & Hygienic' }
  ],
  hotel_resort: [
    { id: 'comfortable_room', label: '🛏️ Comfortable Room' },
    { id: 'clean_maintained', label: '🧼 Clean & Well Maintained' },
    { id: 'great_hospitality', label: '🤝 Great Hospitality' },
    { id: 'food_room_service', label: '🍽️ Food & Room Service' },
    { id: 'ambience_facilities', label: '✨ Ambience & Facilities' }
  ],
  cinema_theatre: [
    { id: 'great_movie', label: '🎬 Great Movie Experience' },
    { id: 'comfortable_seats', label: '💺 Comfortable Seats' },
    { id: 'sound_screen_quality', label: '🔊 Sound & Screen Quality' },
    { id: 'food_beverages', label: '🍿 Food & Beverages' },
    { id: 'clean_theatre', label: '🧼 Clean Theatre' }
  ],
  cloud_kitchen: [
    { id: 'hot_delivery', label: '🔥 Hot & Fresh' },
    { id: 'neat_packing', label: '📦 Spill-proof Packing' },
    { id: 'good_portion', label: '🍱 Generous Portion' },
    { id: 'tasty_food', label: '🥘 Great Flavor' },
    { id: 'on_time', label: '⚡ Quick Turnaround' }
  ]
};

// Natural, human-written template pool with conversational variety (No exclamation marks)
const TEMPLATE_MATRIX = {
  sweet_bakery: {
    5: [
      "Visited {name} with family and had a great experience. The sweets were exceptionally fresh and authentic. The packaging was neat, and the counter was spotless.",
      "One of the best sweet shops and bakeries around. Tried their mithai and freshly baked items at {name}, both were top quality. Very courteous staff and fast billing.",
      "{name} was wonderful. The sweets were fresh, authentic, and soft. Loved the hygiene and prompt service. Highly recommended.",
      "Superb quality sweets and evening snacks at {name}. Everything tasted freshly made and well-balanced in sweetness. Very clean environment.",
      "A trusted sweet shop and bakery in town. {name} serves high quality mithai and savory snacks. Super clean setup and polite staff."
    ],
    4: [
      "Really good sweets and snacks at {name}. Fresh quality, clean environment, and good staff behavior. Will visit again.",
      "Tasty mithai and fresh items at {name}. Service was quick and packing was neat.",
      "Good experience overall at {name}. Fresh sweets, decent variety, and helpful counter staff."
    ],
    3: [
      "Average experience at {name}. Sweets were decent, service could be a bit faster."
    ]
  },
  sweet_shop: {
    5: [
      "Authentic taste and pure desi ghee sweets at {name}. Tried their fresh mithai and samosas, everything was piping hot and delicious. Very clean shop.",
      "Visited {name} today. Excellent quality sweets with genuine traditional flavor. Polite staff and very hygienic packing.",
      "Super fresh sweets and crispy snacks at {name}. You can easily tell the ingredients are pure. A trustworthy sweet shop for family occasions.",
      "Great variety of fresh sweets and namkeen at {name}. Fast counter service and high cleanliness standards. Definitely our go-to mithai spot."
    ],
    4: [
      "Good quality sweets at {name}. Fresh taste, neat packaging, and reasonable pricing.",
      "Tasty mithai and hot snacks at {name}. Service was prompt even during evening rush."
    ],
    3: [
      "Decent sweet shop at {name}. Sweets were satisfactory, but service took some time during peak hours."
    ]
  },
  cafe: {
    5: [
      "Loved the vibe at {name}. Great coffee, delicious snacks, and a cozy aesthetic. Perfect place to sit, work, or hang out with friends.",
      "A really nice cafe. {name} serves refreshing drinks and crispy quick bites. The music and ambiance are super chill, and service is quick.",
      "Great cafe experience at {name}. Loved the food presentation and fast turnaround. Staff was warm and welcoming. Definitely coming back soon."
    ],
    4: [
      "Nice cafe with pleasant ambiance at {name}. Coffee and snacks were tasty. Good spot to catch up with friends.",
      "Good quick bites and refreshing beverages at {name}. Clean seating and polite service."
    ],
    3: [
      "Decent cafe at {name}. Drinks were good, but wait time could be slightly improved."
    ]
  },
  fast_food: {
    5: [
      "Really good food and great vibe at {name}. Super crispy items, delicious shakes, and quick service. Recommended for quick bites.",
      "Great hangout spot. {name} serves fresh, tasty fast food at reasonable prices. Fast service and polite staff.",
      "Really enjoyed the food at {name}. Items were served hot and fresh, portion sizes were generous, and the staff was very friendly.",
      "Super quick service and delicious quick meals at {name}. Everything tasted fresh and well prepared. Great value for money."
    ],
    4: [
      "Really tasty fast food at {name}. Quick service and good quality snacks.",
      "Good quick bites and refreshing drinks at {name}. Fast service and clean counter."
    ],
    3: [
      "Okay experience at {name}. Food was average, service took a little time."
    ]
  },
  dhaba: {
    5: [
      "Authentic dhaba taste at {name}. The dal tadka and hot tandoori rotis were outstanding. Pure desi flavors, generous portions, and quick service.",
      "Superb desi dining experience at {name}. Food had that genuine rustic flavor, rich gravies, and was served piping hot. Great place to dine with family and friends.",
      "One of the best dhabas around. Hearty meals at {name}, excellent spice balance, and very prompt service. Value for money."
    ],
    4: [
      "Very tasty food with authentic desi tadka at {name}. Hot rotis and flavorful gravies. Good service.",
      "Good food and quick table service at {name}. A satisfying dhaba meal."
    ],
    3: [
      "Decent food at {name}. Taste was fine, service was acceptable during rush."
    ]
  },
  pure_veg: {
    5: [
      "Pure satisfaction at {name}. 100% fresh, hygienic, and authentic pure veg food. Amazing taste and very quick service.",
      "Great pure veg spot. {name} serves delicious thalis and South Indian dishes with top-tier cleanliness and warm hospitality.",
      "Visited {name} with family for lunch. The food was light, flavorful, and prepared with high hygiene standards. Courteous staff and quick table service.",
      "Outstanding vegetarian dining at {name}. Fresh ingredients, authentic traditional taste, and very clean dining area."
    ],
    4: [
      "Very good pure veg food at {name}. Hygienic preparation, authentic flavor, and nice service.",
      "Tasty vegetarian meals at {name}. Clean environment and polite staff."
    ],
    3: [
      "Fair vegetarian food at {name}. Taste was average."
    ]
  },
  biryani: {
    5: [
      "Unmatched flavor at {name}. Perfectly cooked, aromatic biryani with rich spices and generous portions. Fast service and clean hygiene.",
      "Superb biryani and non-veg specialities. {name} serves succulent, flavor-packed dishes. Highly recommended for food lovers.",
      "Had an amazing meal at {name}. The biryani was aromatic with tender, juicy pieces and authentic spices. Table service was prompt and polite.",
      "Top quality biryani and starters at {name}. Flavorful rice, authentic dum aroma, and very generous portions. Definitely ordering again soon."
    ],
    4: [
      "Really good biryani at {name}. Flavorful rice, tender pieces, and fast service.",
      "Tasty food with rich spices at {name}. Quick table service."
    ],
    3: [
      "Decent biryani at {name}. Flavor was okay."
    ]
  },
  multi_cuisine: {
    5: [
      "Exceptional dining experience at {name}. Delicious food, rich authentic gravies, and beautiful family ambiance. Courteous staff and fast service.",
      "Top-notch restaurant. {name} offers amazing food quality, quick hospitality, and great portion sizes. Best place to dine with family.",
      "Had a wonderful dinner here at {name} with friends. Every dish was freshly cooked, perfectly seasoned, and arrived quickly. Staff was attentive and courteous.",
      "Great ambience, delicious multi-cuisine spread, and high cleanliness standards at {name}. Very pleased with the overall experience."
    ],
    4: [
      "Great meal at {name}. Flavorful dishes, polite staff, and clean seating. Good overall value for money.",
      "Enjoyed the dinner at {name}. Good food taste, comfortable seating, and quick service."
    ],
    3: [
      "Decent dining experience at {name}. Food was okay, service was acceptable."
    ]
  },
  hotel_resort: {
    5: [
      "{name} provided an exceptional stay experience. The rooms were ultra-clean, comfortable, and well-maintained. Warm hospitality, polite staff, and excellent room service. Highly recommended.",
      "Wonderful stay at {name}. Beautiful ambience, spotless rooms, and top-tier hospitality. The staff was courteous and attentive to every need. Will definitely stay here again.",
      "Had a very pleasant and restful stay at {name}. The room amenities were top notch, check-in was smooth, and food delivery was prompt. Everything was well managed.",
      "Exceptional hospitality and peaceful environment at {name}. Everything from the linen to the room service was impeccable. Highly recommended for family stays."
    ],
    4: [
      "Very pleasant stay at {name}. Clean rooms, helpful staff, and good amenities. Overall a comfortable and relaxing experience.",
      "Great hospitality and comfortable accommodation at {name}. Prompt room service and peaceful atmosphere. Good value for money."
    ],
    3: [
      "Decent stay at {name}. Room was clean and location is good. Service and response time could be slightly improved."
    ]
  },
  cinema_theatre: {
    5: [
      "Fantastic movie experience at {name}. Crystal clear screen, immersive sound quality, and super comfortable seating. Clean theatre and great snacks. Highly recommended.",
      "One of the best cinemas in town. {name} offers top-notch picture quality, amazing Dolby sound, and plush comfortable seats. Very clean hall and quick snack service.",
      "Loved watching the show at {name}. The projection was sharp, audio clarity was superb, and snacks arrived right at our seat without delay. Great movie outing.",
      "Super comfortable seats and outstanding audiovisuals at {name}. Clean hall, well-managed queues, and great snack options."
    ],
    4: [
      "Enjoyed the show at {name}. Good screen and sound quality, comfortable seats, and clean premises. Nice food and beverage options.",
      "Great theatre experience at {name}. Good projection, nice audio clarity, and polite staff."
    ],
    3: [
      "Decent movie experience at {name}. Screen and sound were satisfactory. Seating and snack counter could be managed a bit better."
    ]
  },
  cloud_kitchen: {
    5: [
      "Ordered from {name} and the food was fantastic. Everything arrived piping hot, neatly packaged in spill-proof containers, and tasted freshly prepared.",
      "Superb food quality and reliable packaging from {name}. Portions were hearty, flavors were authentic, and preparation was very clean. Will definitely order again.",
      "Top-tier delivery kitchen. {name} delivers delicious food with consistent taste and neat packing. Highly recommended for home meals."
    ],
    4: [
      "Good food and neat packing from {name}. Hot delivery and nice portion size.",
      "Tasty food, well packed, and reasonable turnaround time at {name}."
    ],
    3: [
      "Food was decent and packaging was okay at {name}."
    ]
  }
};

const TYPE_KEY_ALIASES = {
  sweet_shop: 'sweet_shop',
  bakery_confectionery: 'sweet_bakery',
  bakery: 'sweet_bakery',
  cafe: 'cafe',
  fast_food_qsr: 'fast_food',
  dhaba: 'dhaba',
  cloud_kitchen: 'cloud_kitchen',
  pure_veg: 'pure_veg',
  biryani: 'biryani',
  hotel_resort: 'hotel_resort',
  hotel: 'hotel_resort',
  resort: 'hotel_resort',
  cinema_theatre: 'cinema_theatre',
  cinema: 'cinema_theatre',
  theatre: 'cinema_theatre',
  theater: 'cinema_theatre',
  restaurant: 'multi_cuisine',
  canteen_cafeteria: 'multi_cuisine',
  food_court: 'fast_food',
  veg_nonveg: 'multi_cuisine',
  non_veg: 'biryani'
};

export function getEffectiveReviewType(type, businessType = null) {
  const cleanType = type ? String(type).trim().toLowerCase() : '';
  const cleanBiz = businessType ? String(businessType).trim().toLowerCase() : '';
  
  if (cleanType && (TEMPLATE_MATRIX[cleanType] || TYPE_KEY_ALIASES[cleanType])) {
    return TEMPLATE_MATRIX[cleanType] ? cleanType : TYPE_KEY_ALIASES[cleanType];
  }
  const candidate = businessType || type;
  if (!candidate) return 'multi_cuisine';
  const clean = String(candidate).trim().toLowerCase();
  if (TEMPLATE_MATRIX[clean]) return clean;
  if (TYPE_KEY_ALIASES[clean]) return TYPE_KEY_ALIASES[clean];
  return 'multi_cuisine';
}

/**
 * Strips leading emoji symbols from highlight chips to keep text completely human and natural.
 */
function cleanChipLabel(label) {
  if (!label || typeof label !== 'string') return '';
  return label.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s\-_•]+/gu, '').trim();
}

/**
 * Resolves venue-aware review profile containing custom question, highlights, placeholder, and CTA text.
 */
export function getCustomerReviewProfile(businessType, restoType) {
  const effectiveType = getEffectiveReviewType(restoType, businessType);

  if (effectiveType === 'hotel_resort') {
    return {
      typeKey: 'hotel_resort',
      title: 'Customer Rating & Google Review',
      question: 'How was your stay with us?',
      highlights: HIGHLIGHT_CHIPS.hotel_resort,
      placeholder: 'Tell us what you enjoyed about your stay...',
      ctaText: 'Rate Your Stay',
      aiContext: 'hotel',
      defaultChips: ['🛏️ Comfortable Room', '🧼 Clean & Well Maintained']
    };
  }

  if (effectiveType === 'cinema_theatre') {
    return {
      typeKey: 'cinema_theatre',
      title: 'Customer Rating & Google Review',
      question: 'How was your movie experience?',
      highlights: HIGHLIGHT_CHIPS.cinema_theatre,
      placeholder: 'Tell us what you enjoyed about the movie experience...',
      ctaText: 'Rate Your Movie Experience',
      aiContext: 'cinema',
      defaultChips: ['🎬 Great Movie Experience', '🔊 Sound & Screen Quality']
    };
  }

  if (effectiveType === 'sweet_bakery') {
    return {
      typeKey: 'sweet_bakery',
      title: 'Customer Rating & Google Review',
      question: 'How was your bakery & sweets experience today?',
      highlights: HIGHLIGHT_CHIPS.sweet_bakery,
      placeholder: 'Mention a sweet, pastry or snack (e.g. Kaju Katli, Truffle Cake was awesome...)',
      ctaText: 'Rate Your Experience',
      aiContext: 'bakery',
      defaultChips: ['🍬 Fresh Sweets', '🧹 Clean & Hygienic']
    };
  }

  if (effectiveType === 'sweet_shop') {
    return {
      typeKey: 'sweet_shop',
      title: 'Customer Rating & Google Review',
      question: 'How was your sweets & mithai experience today?',
      highlights: HIGHLIGHT_CHIPS.sweet_shop,
      placeholder: 'Mention a sweet or snack (e.g. Kaju Katli, Rasgulla, Samosa was awesome...)',
      ctaText: 'Rate Your Experience',
      aiContext: 'sweet_shop',
      defaultChips: ['🍬 Fresh Mithai', '🧹 Clean & Hygienic']
    };
  }

  if (effectiveType === 'cafe') {
    return {
      typeKey: 'cafe',
      title: 'Customer Rating & Google Review',
      question: 'How was your cafe experience today?',
      highlights: HIGHLIGHT_CHIPS.cafe,
      placeholder: 'Mention a coffee, shake, or bite (e.g. Cold Coffee, Grilled Sandwich...)',
      ctaText: 'Rate Your Experience',
      aiContext: 'cafe',
      defaultChips: ['☕ Great Coffee', '🎵 Cozy Ambiance']
    };
  }

  if (effectiveType === 'fast_food') {
    return {
      typeKey: 'fast_food',
      title: 'Customer Rating & Google Review',
      question: 'How was your quick bite & snacks today?',
      highlights: HIGHLIGHT_CHIPS.fast_food,
      placeholder: 'Mention a favorite snack or burger (e.g. Crispy Burger, Cold Coffee...)',
      ctaText: 'Rate Your Experience',
      aiContext: 'fast_food',
      defaultChips: ['🍟 Crispy & Fresh', '⚡ Lightning Fast']
    };
  }

  if (effectiveType === 'dhaba') {
    return {
      typeKey: 'dhaba',
      title: 'Customer Rating & Google Review',
      question: 'How was your desi dhaba meal today?',
      highlights: HIGHLIGHT_CHIPS.dhaba,
      placeholder: 'Mention a dish (e.g. Dal Makhani, Paneer Tikka, Tandoori Roti...)',
      ctaText: 'Rate Your Meal',
      aiContext: 'dhaba',
      defaultChips: ['🌶️ Authentic Desi Tadka', '🫓 Hot Tandoori Roti']
    };
  }

  if (effectiveType === 'pure_veg') {
    return {
      typeKey: 'pure_veg',
      title: 'Customer Rating & Google Review',
      question: 'How was your pure vegetarian meal today?',
      highlights: HIGHLIGHT_CHIPS.pure_veg,
      placeholder: 'Mention a dish (e.g. Special Thali, Masala Dosa was awesome...)',
      ctaText: 'Rate Your Dining Experience',
      aiContext: 'pure_veg',
      defaultChips: ['🟢 100% Pure Veg', '🥞 Delicious Dosa/Thali']
    };
  }

  if (effectiveType === 'biryani') {
    return {
      typeKey: 'biryani',
      title: 'Customer Rating & Google Review',
      question: 'How was your biryani & meal today?',
      highlights: HIGHLIGHT_CHIPS.biryani,
      placeholder: 'Mention a dish (e.g. Dum Biryani, Chicken Tikka was awesome...)',
      ctaText: 'Rate Your Dining Experience',
      aiContext: 'biryani',
      defaultChips: ['🍗 Flavorful Biryani', '⚡ Quick Service']
    };
  }

  if (effectiveType === 'cloud_kitchen') {
    return {
      typeKey: 'cloud_kitchen',
      title: 'Customer Rating & Google Review',
      question: 'How was your meal and delivery today?',
      highlights: HIGHLIGHT_CHIPS.cloud_kitchen,
      placeholder: 'Mention an item (e.g. packaging was neat, food was hot...)',
      ctaText: 'Rate Your Order',
      aiContext: 'cloud_kitchen',
      defaultChips: ['🔥 Hot & Fresh', '📦 Spill-proof Packing']
    };
  }

  // Default: Restaurant Profile
  const chips = HIGHLIGHT_CHIPS[effectiveType] || HIGHLIGHT_CHIPS.multi_cuisine;
  return {
    typeKey: effectiveType,
    title: 'Customer Rating & Google Review',
    question: 'How was your dining experience today?',
    highlights: chips,
    placeholder: 'Mention a dish (e.g. Paneer Butter Masala was awesome...)',
    ctaText: 'Rate Your Dining Experience',
    aiContext: 'restaurant',
    defaultChips: chips.slice(0, 2).map(c => c.label)
  };
}

/**
 * Generates natural, authentic, human-written reviews tailored to venue type, rating, and highlights.
 * Strips all exclamation marks (!) for a calm, real human conversational tone.
 */
export function generateSmartReview({
  restoName = 'Restaurant',
  restoType = 'multi_cuisine',
  businessType = null,
  rating = 5,
  selectedChips = [],
  customNote = ''
}) {
  const profile = getCustomerReviewProfile(businessType, restoType);
  const typeKey = profile.typeKey;
  const ratingKey = rating >= 4 ? rating : 3;
  const pool = TEMPLATE_MATRIX[typeKey]?.[ratingKey] || TEMPLATE_MATRIX.multi_cuisine[ratingKey] || TEMPLATE_MATRIX.multi_cuisine[5];
  
  // Pick template based on variety hash
  const templateIdx = Math.abs(restoName.length + (selectedChips.length * 3)) % pool.length;
  let text = pool[templateIdx].replace(/{name}/g, restoName);

  // Weave clean highlight chips naturally into human phrasing (no emojis in prose!)
  if (selectedChips && selectedChips.length > 0) {
    const cleanTags = selectedChips.map(cleanChipLabel).filter(Boolean);
    if (cleanTags.length > 0) {
      const joinedTags = cleanTags.length === 1 
        ? cleanTags[0].toLowerCase() 
        : `${cleanTags.slice(0, -1).map(t => t.toLowerCase()).join(', ')} and ${cleanTags[cleanTags.length - 1].toLowerCase()}`;

      // Pick a natural connector variation based on tags length
      const connectors = [
        `Loved the ${joinedTags}.`,
        `Really liked the ${joinedTags}.`,
        `Special appreciation for the ${joinedTags}.`,
        `The ${joinedTags} stood out.`
      ];
      const connector = connectors[cleanTags.length % connectors.length];

      // Avoid double periods and append smoothly
      if (!text.endsWith('.')) text += '.';
      text += ` ${connector}`;
    }
  }

  // Add custom customer note naturally
  const trimmedNote = customNote ? customNote.trim() : '';
  if (trimmedNote) {
    const formattedNote = trimmedNote.charAt(0).toUpperCase() + trimmedNote.slice(1);
    if (!text.endsWith('.')) text += '.';
    text += ` ${formattedNote}${formattedNote.endsWith('.') ? '' : '.'}`;
  }

  // Final cleanup: Replace any exclamation marks with standard periods for a natural human review
  text = text.replace(/!+/g, '.');
  // Collapse duplicate dots like '..' into single '.'
  text = text.replace(/\.{2,}/g, '.').trim();

  return text;
}
