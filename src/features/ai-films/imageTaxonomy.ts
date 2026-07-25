export type ImageTaxonomySeed = {
  sourceFilename: string;
  canonicalFilename: string;
  category: string;
  subcategory: string;
  tags: string[];
  description: string;
};

/**
 * Initial D3VONN.IO AI Film Studio visual taxonomy.
 * Source: Devonn_Image_Category_Map.pdf, canonized after the completed media dump.
 */
export const aiFilmImageTaxonomy: ImageTaxonomySeed[] = [
  {
    sourceFilename: '1000004216.jpeg',
    canonicalFilename: 'd3vonn_symbol_eye-sigil_gold-mech_v001.jpg',
    category: 'SYMBOLS',
    subcategory: 'Eye_Sigil',
    tags: ['sovereign-signal', 'genesis-wave', 'eye-sigil', 'gold', 'mechanical'],
    description: 'Gold mechanical eye-ring signal motif.',
  },
  {
    sourceFilename: '1000004219.jpeg',
    canonicalFilename: 'd3vonn_symbol_eye-sigil_orbital-jewel_v001.jpg',
    category: 'SYMBOLS',
    subcategory: 'Eye_Sigil',
    tags: ['sovereign-signal', 'eye-sigil', 'orbital', 'jewel', 'portal'],
    description: 'Eye sigil surrounded by jeweled orbital rings.',
  },
  {
    sourceFilename: '1000004388.jpeg',
    canonicalFilename: 'd3vonn_world_ceremonial-hall_v001.jpg',
    category: 'VISUAL_REFERENCES',
    subcategory: 'World_Scene',
    tags: ['ceremonial-hall', 'worldbuilding', 'group-scene', 'central-figure'],
    description: 'Ceremonial fantasy hall and ensemble world-scene reference.',
  },
  {
    sourceFilename: '1000005012.png',
    canonicalFilename: 'd3vonn_brand_logo_kwame-fuze-electronics_v001.png',
    category: 'BRAND',
    subcategory: 'Logos',
    tags: ['kwame-fuze-electronics', 'logo', 'brand'],
    description: 'KWAME FUZE Electronics logo asset.',
  },
  {
    sourceFilename: '1000006370.png',
    canonicalFilename: 'd3vonn_brand_promo_audio-wave_v001.png',
    category: 'BRAND',
    subcategory: 'DevonnAI_Promo',
    tags: ['d3vonn', 'devonn-ai', 'promo', 'audio-wave'],
    description: 'Devonn.ai promotional audio-wave card.',
  },
  {
    sourceFilename: '1000006394.jpeg',
    canonicalFilename: 'd3vonn_set_library_grand-archive_v001.jpg',
    category: 'SET_REFERENCES',
    subcategory: 'Library',
    tags: ['library', 'grand-archive', 'knowledge-temple', 'investigation'],
    description: 'Grand archive library environment reference.',
  },
  {
    sourceFilename: '1000006396.jpeg',
    canonicalFilename: 'd3vonn_set_library_purple-vault_v001.jpg',
    category: 'SET_REFERENCES',
    subcategory: 'Library',
    tags: ['library', 'purple-vault', 'archive', 'knowledge-temple'],
    description: 'Purple-vault library environment reference.',
  },
  {
    sourceFilename: '1000007725.jpeg',
    canonicalFilename: 'd3vonn_wardrobe_beige-graphic-set_v001.jpg',
    category: 'WARDROBE',
    subcategory: 'Fits',
    tags: ['wardrobe', 'beige', 'graphic-tee', 'streetwear'],
    description: 'Beige graphic shirt and trouser wardrobe reference.',
  },
  {
    sourceFilename: '1000007726.jpeg',
    canonicalFilename: 'd3vonn_wardrobe_red-hiphop-set_v001.jpg',
    category: 'WARDROBE',
    subcategory: 'Fits',
    tags: ['wardrobe', 'red', 'hiphop', 'streetwear'],
    description: 'Red HipHop coordinated wardrobe reference.',
  },
  {
    sourceFilename: '1000008296.jpeg',
    canonicalFilename: 'd3vonn_cosmic_orion-belt-size-compare_v001.jpg',
    category: 'COSMIC',
    subcategory: 'Stars',
    tags: ['orion-belt', 'alnitak', 'alnilam', 'mintaka', 'astronomy'],
    description: 'Orion Belt star-size comparison reference.',
  },
  {
    sourceFilename: '1000008302.jpeg',
    canonicalFilename: 'd3vonn_cosmic_constellation-wheel_v001.jpg',
    category: 'COSMIC',
    subcategory: 'Zodiac_Charts',
    tags: ['zodiac', 'constellations', 'star-map', 'cosmic'],
    description: 'Zodiac and constellation wheel reference.',
  },
  {
    sourceFilename: '1000010478.jpeg',
    canonicalFilename: 'd3vonn_myth_egypt_anubis-poster_v001.jpg',
    category: 'MYTHOLOGY',
    subcategory: 'Egypt/Anubis',
    tags: ['egypt', 'anubis', 'poster', 'archetype'],
    description: 'Poster-style Anubis archetype reference.',
  },
  {
    sourceFilename: '1000010479.jpeg',
    canonicalFilename: 'd3vonn_myth_egypt_anubis-warrior_v001.jpg',
    category: 'MYTHOLOGY',
    subcategory: 'Egypt/Anubis',
    tags: ['egypt', 'anubis', 'warrior', 'fullbody'],
    description: 'Full-body Anubis warrior reference.',
  },
  {
    sourceFilename: '1000010481.jpeg',
    canonicalFilename: 'd3vonn_myth_egypt_anubis-throne_v001.jpg',
    category: 'MYTHOLOGY',
    subcategory: 'Egypt/Anubis',
    tags: ['egypt', 'anubis', 'throne', 'deity'],
    description: 'Seated Egyptian deity and throne reference.',
  },
  {
    sourceFilename: '1000010220.jpeg',
    canonicalFilename: 'd3vonn_entity_shadow-feminine_dark-angel_v001.jpg',
    category: 'ENTITIES',
    subcategory: 'Shadow_Feminine',
    tags: ['shadow-feminine', 'dark-angel', 'entity', 'adversary'],
    description: 'Dark feminine shadow-entity reference.',
  },
  {
    sourceFilename: '1000004486.jpeg',
    canonicalFilename: 'd3vonn_admin_payment_transfer-timeline_v001.jpg',
    category: 'ADMIN',
    subcategory: 'Payments',
    tags: ['admin', 'payment', 'transfer', 'production-record'],
    description: 'Payment transfer timeline retained as production administration evidence.',
  },
];

export const aiFilmImageCategories = Array.from(
  new Set(aiFilmImageTaxonomy.map((asset) => asset.category)),
);
