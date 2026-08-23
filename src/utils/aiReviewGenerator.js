// Smart NLP AI Review Generator Engine
// Generates natural, high-converting 1-5 star Google reviews tailored to specific restaurant types without external API costs.

export const RESTO_TYPES = [
  { id: 'sweet_bakery', label: '🧁 Sweet & Bakery', icon: '🧁' },
  { id: 'multi_cuisine', label: '🍲 Multi-Cuisine Restaurant', icon: '🍲' },
  { id: 'fast_food', label: '🍔 Fast Food & Cafe', icon: '🍔' },
  { id: 'pure_veg', label: '🌿 Pure Veg & South Indian', icon: '🌿' },
  { id: 'biryani', label: '🍗 Biryani & Non-Veg Special', icon: '🍗' }
];

export const HIGHLIGHT_CHIPS = {
  sweet_bakery: [
    { id: 'fresh_sweets', label: '🍬 Fresh Sweets' },
    { id: 'tasty_snacks', label: '🧆 Tasty Snacks' },
    { id: 'fast_service', label: '⚡ Fast Service' },
    { id: 'hygienic', label: '🧹 Clean & Hygienic' },
    { id: 'polite_staff', label: '😊 Polite Staff' }
  ],
  multi_cuisine: [
    { id: 'delicious_food', label: '🥘 Delicious Food' },
    { id: 'family_ambiance', label: '👑 Family Ambiance' },
    { id: 'great_service', label: '⚡ Great Hospitality' },
    { id: 'rich_taste', label: '🍛 Authentic Gravies' },
    { id: 'clean_space', label: '🧹 Clean & Hygienic' }
  ],
  fast_food: [
    { id: 'crispy_bites', label: '🍟 Crispy & Fresh' },
    { id: 'awesome_shakes', label: '🥤 Awesome Shakes' },
    { id: 'quick_service', label: '⚡ Lightning Fast' },
    { id: 'great_vibe', label: '🎵 Cool Vibe' },
    { id: 'good_value', label: '💰 Reasonable Price' }
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
    { id: 'fast_service', label: '⚡ Quick Service' },
    { id: 'generous_portion', label: '🍱 Generous Quantity' },
    { id: 'hygienic', label: '🧹 Clean & Hygienic' }
  ]
};

const TEMPLATE_MATRIX = {
  sweet_bakery: {
    5: [
      "{name} is absolute perfection! The sweets are ultra-fresh, authentic, and melt in the mouth. Loved the hygiene and prompt service. Highly recommended!",
      "Hands down the best sweet shop & bakery in town! {name} serves high quality mithai and savory snacks. Super clean setup & polite staff."
    ],
    4: [
      "Really good sweets and snacks at {name}. Fresh quality, clean environment, and good staff behavior. Will visit again!",
      "Tasty mithai and fresh items. Service was quick and packing was neat."
    ],
    3: [
      "Average experience at {name}. Sweets were decent, service could be a bit faster."
    ]
  },
  multi_cuisine: {
    5: [
      "Exceptional dining experience at {name}! Delicious food, rich authentic gravies, and beautiful family ambiance. Courteous staff and fast service!",
      "Top-notch restaurant! {name} offers amazing food quality, quick hospitality, and great portion sizes. Best place to dine with family!"
    ],
    4: [
      "Great meal at {name}! Flavorful dishes, polite staff, and clean seating. Good overall value for money.",
      "Enjoyed the dinner at {name}. Good food taste, comfortable seating, and quick service."
    ],
    3: [
      "Decent dining experience at {name}. Food was okay, service was acceptable."
    ]
  },
  fast_food: {
    5: [
      "Awesome food and great vibe at {name}! Super crispy items, delicious shakes, and lightning-fast service. 10/10 recommended for quick bites!",
      "Best hangout spot! {name} serves fresh, mouth-watering fast food at reasonable prices. Super fast service and polite staff!"
    ],
    4: [
      "Really tasty fast food at {name}. Quick service and good quality snacks.",
      "Good quick bites and refreshing drinks. Fast service and clean counter."
    ],
    3: [
      "Okay experience at {name}. Food was average, service took a little time."
    ]
  },
  pure_veg: {
    5: [
      "Pure satisfaction at {name}! 100% fresh, hygienic, and authentic pure veg food. Amazing taste and very quick service!",
      "Best pure veg spot! {name} serves delicious thalis and South Indian dishes with top-tier cleanliness and warm hospitality."
    ],
    4: [
      "Very good pure veg food at {name}. Hygienic preparation, authentic flavor, and nice service.",
      "Tasty vegetarian meals. Clean environment and polite staff."
    ],
    3: [
      "Fair vegetarian food at {name}. Taste was average."
    ]
  },
  biryani: {
    5: [
      "Unmatched flavor at {name}! Perfectly cooked, aromatic biryani with rich spices and generous portions. Fast service & clean hygiene!",
      "Best biryani & non-veg specialities! {name} serves succulent, flavor-packed dishes. Highly recommended for food lovers!"
    ],
    4: [
      "Really good biryani at {name}. Flavorful rice, tender pieces, and fast service.",
      "Tasty food with rich spices. Quick table service."
    ],
    3: [
      "Decent biryani at {name}. Flavor was okay."
    ]
  }
};

const TYPE_KEY_ALIASES = {
  bakery_confectionery: 'sweet_bakery',
  sweet_shop: 'sweet_bakery',
  bakery: 'sweet_bakery',
  fast_food_qsr: 'fast_food',
  cafe: 'fast_food',
  restaurant: 'multi_cuisine',
  hotel_resort: 'multi_cuisine',
  cinema_theatre: 'fast_food',
  dhaba: 'multi_cuisine',
  canteen_cafeteria: 'multi_cuisine',
  veg_nonveg: 'multi_cuisine',
  non_veg: 'multi_cuisine'
};

export function getEffectiveReviewType(type) {
  if (!type) return 'multi_cuisine';
  const clean = String(type).trim().toLowerCase();
  if (TEMPLATE_MATRIX[clean]) return clean;
  if (TYPE_KEY_ALIASES[clean]) return TYPE_KEY_ALIASES[clean];
  return 'multi_cuisine';
}

export function generateSmartReview({ restoName = 'Restaurant', restoType = 'multi_cuisine', businessType = null, rating = 5, selectedChips = [], customNote = '' }) {
  const rawKey = businessType || restoType;
  const typeKey = getEffectiveReviewType(rawKey);
  const ratingKey = rating >= 4 ? rating : 3;
  const pool = TEMPLATE_MATRIX[typeKey][ratingKey] || TEMPLATE_MATRIX[typeKey][5];
  
  // Pick template based on restoName length hash for consistent variety
  const templateIdx = (restoName.length + (selectedChips.length * 3)) % pool.length;
  let text = pool[templateIdx].replace(/{name}/g, restoName);

  // Add selected chip highlights
  if (selectedChips && selectedChips.length > 0) {
    text += ` Special mention for ${selectedChips.join(' and ').toLowerCase()}.`;
  }

  // Add custom customer note
  const trimmedNote = customNote ? customNote.trim() : '';
  if (trimmedNote) {
    const formattedNote = trimmedNote.charAt(0).toUpperCase() + trimmedNote.slice(1);
    text += ` ${formattedNote}${formattedNote.endsWith('.') ? '' : '.'}`;
  }

  return text;
}
