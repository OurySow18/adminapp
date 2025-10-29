/* =========================
   📦 CATALOG TYPES (TS)
   ========================= */

/** Catégories racines */
export type TopCategory =
  | 'grocery'     // Alimentaire & boissons
  | 'fashion'     // Mode & accessoires
  | 'electronics' // Électronique
  | 'home'        // Maison & cuisine
  | 'beauty'      // Beauté & santé
  | 'sports'      // Sports & loisirs
  | 'media'       // Livres, musique, vidéo, jeux
  | 'auto'        // Auto & pièces
  | 'diy'         // Bricolage & outils
  | 'pet'         // Animaux
  | 'services';   // Services & digitaux

/** Identifiants de catégories “feuilles” (discriminants). Ajoute-en au besoin. */
export type CategoryId =
  // Grocery
  | 'grocery_fresh'            // frais (fruits, légumes, viande…)
  | 'grocery_packaged'         // paquetés (pâtes, conserves…)
  | 'grocery_beverage'         // boissons
  // Fashion
  | 'fashion_shirt'
  | 'fashion_pants'
  | 'fashion_shoes'
  | 'fashion_accessory'
  // Electronics
  | 'electronics_phone'
  | 'electronics_laptop'
  | 'electronics_tv'
  | 'electronics_audio'
  // Home
  | 'home_furniture'
  | 'home_appliance_small'
  | 'home_kitchenware'
  // Beauty
  | 'beauty_cosmetic'
  | 'beauty_personalcare'
  // Sports
  | 'sports_equipment'
  | 'toys_generic'
  // Media
  | 'books_book'
  | 'media_music'
  | 'media_videogame'
  // Auto / DIY / Pet / Services
  | 'auto_part'
  | 'diy_tool'
  | 'pet_product'
  | 'service_digital';

/* ---------- Tronc commun produit ---------- */
// utils monnaie (optionnel)
export const CURRENCY_META: Record<string,{decimals:number; label:string}> = {
  EUR:{decimals:2,label:'EUR'},
  USD:{decimals:2,label:'USD'},
  GBP:{decimals:2,label:'GBP'},
  GNF:{decimals:0,label:'GNF'}, // Franc guinéen : sans décimales
  XOF:{decimals:0,label:'CFA (XOF)'}, // UEMOA
  XAF:{decimals:0,label:'CFA (XAF)'}, // CEMAC
}
export type CurrencyCode = keyof typeof CURRENCY_META;
export type Currency = 'EUR' | 'USD' | 'GBP' | 'GNF';

export interface ProductCore {
  productId: string;
  vendorId: string;           // boutique / vendeur
  title: string;
  description?: string;
  brand?: string;
  tags?: string[];

  categoryId: CategoryId;     // discriminant
  topCategory: TopCategory;

  media: {
    cover: string;
    gallery?: string[];
    byOption?: {
      // ex: images par couleur
      color?: Record<string, string[]>;
      // possibilité d’ajouter d’autres axes si besoin
    };
  };

  pricing: {
    basePrice?: number;       // prix de base (fallback)
    currency: Currency;
    taxClass?: 'standard' | 'reduced' | 'exempt';
  };

  identifiers?: {
    sku?: string;
    gtin?: string;            // EAN / UPC
    mpn?: string;             // référence fabricant
    isbn?: string;            // livres
  };

  fulfillment?: {
    // marketplace ou vendeur
    shippedBy?: 'vendor' | 'platform';
    deliveryOptions?: Array<'pickup' | 'local_delivery' | 'carrier' | 'digital'>;
    leadTimeDays?: number;    // délai préparation
    weightGr?: number;
    dimensionsCm?: { w: number; h: number; d: number };
    coldChain?: boolean;      // alimentaire
  };

  status: 'draft' | 'active' | 'archived';

  createdAt: any;
  updatedAt: any;
}

/* ---------- Variantes génériques ---------- */

export type OptionId = 'color' | 'size' | 'weight' | 'volume' | (string & {});
export interface ProductOption {
  id: OptionId;               // ex: 'color'
  name: string;               // ex: 'Couleur'
  values: Array<{ id: string; label: string; swatchHex?: string }>;
}

export interface Variant {
  vid: string;                // SKU variante
  options: Record<OptionId, string>;   // { color:'navy', size:'m' }
  price?: number;             // override par variante
  compareAtPrice?: number;    // prix barré
  stock?: number;             // stock de cette variante
  imageKeys?: string[];       // ex: ['navy'] → media.byOption.color['navy']
  barcode?: string;
  sku?: string;  
  attributes?: Record<string, any>; // attributs techniques supplémentaires
}

/** Bloc variantes pour tout produit varianté */
export interface VariantBlock {
  options: ProductOption[];   // axes (couleur, taille…)
  variants: Variant[];        // SKUs
}

/* ---------- Attributs spécifiques par catégorie ---------- */
/** (champs “métier” qui pilotent ton UI et ta recherche) */

export interface AttrGroceryFresh {
  perishables: true;
  originCountry?: string;
  organic?: boolean;
  expirationDate?: string;    // ISO
  storage?: 'chilled' | 'frozen' | 'ambient';
  unit?: 'kg' | 'piece' | 'bunch';
}

export interface AttrGroceryPackaged {
  perishables?: false;
  netWeight?: string;         // '500g'
  ingredients?: string;
  allergens?: string[];
  nutrition?: { kcalPer100g?: number; fat?: number; sugar?: number; salt?: number };
  expirationDate?: string;
  organic?: boolean;
}

export interface AttrGroceryBeverage {
  volume?: string;            // '750ml'
  alcohol?: number;           // % vol
  originCountry?: string;
  organic?: boolean;
}

export interface AttrFashionClothing {
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  material?: string;          // '100% coton'
  fit?: 'regular' | 'slim' | 'oversized';
  care?: string;              // lavage, repassage
}

export interface AttrFashionShoes {
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  materialUpper?: string;
  materialSole?: string;
}

export interface AttrElectronicsPhone {
  model?: string;
  os?: string;
  storageGb?: number;
  ramGb?: number;
  batteryMah?: number;
  screenInch?: number;
  cameraMp?: number;
  connectivity?: Array<'5G'|'4G'|'WiFi'|'BT'|'NFC'>;
}

export interface AttrElectronicsLaptop {
  cpu?: string;
  gpu?: string;
  ramGb?: number;
  storageGb?: number;
  screenInch?: number;
  screenType?: 'IPS'|'OLED'|'TN';
  os?: string;
}

export interface AttrHomeFurniture {
  room?: 'living'|'bedroom'|'kitchen'|'bathroom'|'office'|'outdoor';
  material?: string;
  color?: string;
  requiresAssembly?: boolean;
  maxLoadKg?: number;
}

export interface AttrHomeApplianceSmall {
  powerW?: number;
  energyClass?: string;       // ex: 'A++'
  capacity?: string;          // '1.7L'
  features?: string[];
}

export interface AttrBeautyCosmetic {
  skinType?: Array<'normal'|'dry'|'oily'|'combination'|'sensitive'>;
  volume?: string;            // '50ml'
  ingredients?: string;
  crueltyFree?: boolean;
}

export interface AttrSportsEquipment {
  sport?: string;             // 'football', 'yoga'…
  level?: 'beginner'|'intermediate'|'pro';
  material?: string;
}

export interface AttrBook {
  author?: string;
  publisher?: string;
  language?: string;
  pages?: number;
  format?: 'paperback'|'hardcover'|'ebook'|'audiobook';
  isbn13?: string;
}

export interface AttrMediaMusic {
  artist?: string;
  format?: 'cd'|'vinyl'|'digital';
  tracks?: number;
}

export interface AttrToy {
  ageMin?: number;
  ageMax?: number;
  material?: string;
  safetyMarks?: string[];     // CE, EN71…
}

export interface AttrAutoPart {
  compatibleMakes?: string[]; // ['BMW','VW'…]
  partNumber?: string;
}

export interface AttrDiyTool {
  powerW?: number;
  cordless?: boolean;
  voltageV?: number;
}

export interface AttrPetProduct {
  animal?: 'dog'|'cat'|'bird'|'fish'|'rodent'|'other';
  weight?: string;            // '2kg'
  flavor?: string;
}

export interface AttrServiceDigital {
  deliveryType: 'download'|'code'|'subscription';
  durationDays?: number;
}

/* ---------- Cartes produit discriminées par categoryId ---------- */

type ProductGroceryFresh     = ProductCore & { categoryId:'grocery_fresh'    ; topCategory:'grocery'    ; attributes: AttrGroceryFresh     ; variants?: VariantBlock };
type ProductGroceryPackaged  = ProductCore & { categoryId:'grocery_packaged' ; topCategory:'grocery'    ; attributes: AttrGroceryPackaged  ; variants?: VariantBlock };
type ProductGroceryBeverage  = ProductCore & { categoryId:'grocery_beverage' ; topCategory:'grocery'    ; attributes: AttrGroceryBeverage  ; variants?: VariantBlock };

type ProductFashionShirt     = ProductCore & { categoryId:'fashion_shirt'    ; topCategory:'fashion'    ; attributes: AttrFashionClothing  ; variants: VariantBlock };
type ProductFashionPants     = ProductCore & { categoryId:'fashion_pants'    ; topCategory:'fashion'    ; attributes: AttrFashionClothing  ; variants: VariantBlock };
type ProductFashionShoes     = ProductCore & { categoryId:'fashion_shoes'    ; topCategory:'fashion'    ; attributes: AttrFashionShoes     ; variants: VariantBlock };
type ProductFashionAccessory = ProductCore & { categoryId:'fashion_accessory'; topCategory:'fashion'    ; attributes: Record<string,any>   ; variants?: VariantBlock };

type ProductElectronicsPhone = ProductCore & { categoryId:'electronics_phone'; topCategory:'electronics'; attributes: AttrElectronicsPhone ; variants?: VariantBlock };
type ProductElectronicsLaptop= ProductCore & { categoryId:'electronics_laptop';topCategory:'electronics'; attributes: AttrElectronicsLaptop; variants?: VariantBlock };
type ProductElectronicsTv    = ProductCore & { categoryId:'electronics_tv'   ; topCategory:'electronics'; attributes: { sizeInch?:number; panel?:'LCD'|'OLED'|'QLED'; os?:string }; variants?: VariantBlock };
type ProductElectronicsAudio = ProductCore & { categoryId:'electronics_audio'; topCategory:'electronics'; attributes: { type?:'headphones'|'speaker'|'amp'; wireless?:boolean; codec?:string[] }; variants?: VariantBlock };

type ProductHomeFurniture    = ProductCore & { categoryId:'home_furniture'   ; topCategory:'home'       ; attributes: AttrHomeFurniture    ; variants?: VariantBlock };
type ProductHomeApplianceSm  = ProductCore & { categoryId:'home_appliance_small';topCategory:'home'    ; attributes: AttrHomeApplianceSmall; variants?: VariantBlock };
type ProductHomeKitchenware  = ProductCore & { categoryId:'home_kitchenware' ; topCategory:'home'       ; attributes: { material?:string; dishwasherSafe?:boolean }; variants?: VariantBlock };

type ProductBeautyCosmetic   = ProductCore & { categoryId:'beauty_cosmetic'  ; topCategory:'beauty'     ; attributes: AttrBeautyCosmetic   ; variants?: VariantBlock };
type ProductBeautyCare       = ProductCore & { categoryId:'beauty_personalcare';topCategory:'beauty'   ; attributes: AttrBeautyCosmetic   ; variants?: VariantBlock };

type ProductSportsEquip      = ProductCore & { categoryId:'sports_equipment' ; topCategory:'sports'     ; attributes: AttrSportsEquipment  ; variants?: VariantBlock };
type ProductToysGeneric      = ProductCore & { categoryId:'toys_generic'     ; topCategory:'sports'     ; attributes: AttrToy              ; variants?: VariantBlock };

type ProductBook             = ProductCore & { categoryId:'books_book'       ; topCategory:'media'      ; attributes: AttrBook             ; variants?: never };
type ProductMediaMusic       = ProductCore & { categoryId:'media_music'      ; topCategory:'media'      ; attributes: AttrMediaMusic       ; variants?: never };
type ProductMediaVideogame   = ProductCore & { categoryId:'media_videogame'  ; topCategory:'media'      ; attributes: { platform?:string; pegi?:number }; variants?: VariantBlock };

type ProductAutoPart         = ProductCore & { categoryId:'auto_part'        ; topCategory:'auto'       ; attributes: AttrAutoPart         ; variants?: VariantBlock };
type ProductDiyTool          = ProductCore & { categoryId:'diy_tool'         ; topCategory:'diy'        ; attributes: AttrDiyTool          ; variants?: VariantBlock };
type ProductPet              = ProductCore & { categoryId:'pet_product'      ; topCategory:'pet'        ; attributes: AttrPetProduct       ; variants?: VariantBlock };

type ProductServiceDigital   = ProductCore & { categoryId:'service_digital'  ; topCategory:'services'   ; attributes: AttrServiceDigital   ; variants?: never };

/** Union principale : tous les produits possibles */
export type Product =
  | ProductGroceryFresh | ProductGroceryPackaged | ProductGroceryBeverage
  | ProductFashionShirt | ProductFashionPants | ProductFashionShoes | ProductFashionAccessory
  | ProductElectronicsPhone | ProductElectronicsLaptop | ProductElectronicsTv | ProductElectronicsAudio
  | ProductHomeFurniture | ProductHomeApplianceSm | ProductHomeKitchenware
  | ProductBeautyCosmetic | ProductBeautyCare
  | ProductSportsEquip | ProductToysGeneric
  | ProductBook | ProductMediaMusic | ProductMediaVideogame
  | ProductAutoPart | ProductDiyTool | ProductPet
  | ProductServiceDigital;

/* ---------- Aides runtime pour générer les formulaires ---------- */

export type FieldKind =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date';

export interface FieldSpec {
  key: string;               // chemin dans attributes, ex: 'material' ou 'nutrition.kcalPer100g'
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: Array<{ value: any; label: string }>;
  help?: string;
}

export interface CategorySpec {
  categoryId: CategoryId;
  topCategory: TopCategory;
  label: string;
  defaultOptions?: ProductOption[];  // préconfig variantes (ex: taille/couleur)
  attributeFields: FieldSpec[];      // pour construire le formulaire
}

/** Catalogue minimal – ajoute/affine selon tes besoins UI */
export const CATEGORY_SPECS: Record<CategoryId, CategorySpec> = {
  // Grocery
  grocery_fresh: {
    categoryId: 'grocery_fresh',
    topCategory: 'grocery',
    label: 'Frais',
    attributeFields: [
      { key:'perishables', label:'Périssable', kind:'boolean', required:true },
      { key:'originCountry', label:'Origine', kind:'text' },
      { key:'organic', label:'Bio', kind:'boolean' },
      { key:'expirationDate', label:'DLUO/DLC', kind:'date' },
      { key:'storage', label:'Conservation', kind:'select', options:[
        {value:'chilled',label:'Frais'},{value:'frozen',label:'Surgelé'},{value:'ambient',label:'Ambiant'}
      ]},
      { key:'unit', label:'Unité', kind:'select', options:[
        {value:'kg',label:'Kg'}, {value:'piece', label:'Pièce'}, {value:'bunch',label:'Botte'}
      ] }
    ]
  },
  grocery_packaged: {
    categoryId: 'grocery_packaged',
    topCategory: 'grocery',
    label: 'Épicerie',
    attributeFields: [
      { key:'netWeight', label:'Poids net', kind:'text', help:'ex: 500g' },
      { key:'ingredients', label:'Ingrédients', kind:'textarea' },
      { key:'allergens', label:'Allergènes', kind:'multiselect' },
      { key:'nutrition.kcalPer100g', label:'kcal/100g', kind:'number' },
      { key:'expirationDate', label:'DLUO', kind:'date' },
      { key:'organic', label:'Bio', kind:'boolean' },
    ]
  },
  grocery_beverage: {
    categoryId: 'grocery_beverage',
    topCategory: 'grocery',
    label: 'Boissons',
    attributeFields: [
      { key:'volume', label:'Volume', kind:'text', help:'ex: 750ml' },
      { key:'alcohol', label:'Alcool % vol', kind:'number' },
      { key:'originCountry', label:'Origine', kind:'text' },
      { key:'organic', label:'Bio', kind:'boolean' },
    ]
  },

  // Fashion
  fashion_shirt: {
    categoryId: 'fashion_shirt',
    topCategory: 'fashion',
    label: 'Chemise',
    defaultOptions: [
      { id:'color', name:'Couleur', values:[] },
      { id:'size',  name:'Taille', values:[
        {id:'s',label:'S'},{id:'m',label:'M'},{id:'l',label:'L'},{id:'xl',label:'XL'},{id:'xxl',label:'XXL'}
      ]},
    ],
    attributeFields: [
      { key:'gender', label:'Genre', kind:'select', options:[
        {value:'men',label:'Homme'},{value:'women',label:'Femme'},{value:'unisex',label:'Unisexe'},{value:'kids',label:'Enfant'}
      ]},
      { key:'material', label:'Matière', kind:'text' },
      { key:'fit', label:'Coupe', kind:'select', options:[
        {value:'regular',label:'Regular'},{value:'slim',label:'Slim'},{value:'oversized',label:'Oversize'}
      ]},
      { key:'care', label:'Entretien', kind:'text' },
    ]
  },
  fashion_pants: {
    categoryId: 'fashion_pants',
    topCategory: 'fashion',
    label: 'Pantalon',
    defaultOptions: [
      { id:'color', name:'Couleur', values:[] },
      { id:'size',  name:'Taille', values:[
        {id:'28',label:'28'},{id:'30',label:'30'},{id:'32',label:'32'},{id:'34',label:'34'},{id:'36',label:'36'}
      ]},
    ],
    attributeFields: [
      { key:'gender', label:'Genre', kind:'select', options:[
        {value:'men',label:'Homme'},{value:'women',label:'Femme'},{value:'unisex',label:'Unisexe'}
      ]},
      { key:'material', label:'Matière', kind:'text' },
      { key:'fit', label:'Coupe', kind:'select', options:[
        {value:'regular',label:'Regular'},{value:'slim',label:'Slim'}
      ]},
      { key:'care', label:'Entretien', kind:'text' },
    ]
  },
  fashion_shoes: {
    categoryId: 'fashion_shoes',
    topCategory: 'fashion',
    label: 'Chaussures',
    defaultOptions: [
      { id:'color', name:'Couleur', values:[] },
      { id:'size',  name:'Pointure', values:[
        {id:'38',label:'38'},{id:'39',label:'39'},{id:'40',label:'40'},{id:'41',label:'41'},{id:'42',label:'42'},{id:'43',label:'43'}
      ]},
    ],
    attributeFields: [
      { key:'gender', label:'Genre', kind:'select', options:[
        {value:'men',label:'Homme'},{value:'women',label:'Femme'},{value:'unisex',label:'Unisexe'}
      ]},
      { key:'materialUpper', label:'Tige', kind:'text' },
      { key:'materialSole',  label:'Semelle', kind:'text' },
    ]
  },
  fashion_accessory: {
    categoryId: 'fashion_accessory',
    topCategory: 'fashion',
    label: 'Accessoire',
    attributeFields: [
      { key:'material', label:'Matière', kind:'text' },
      { key:'color', label:'Couleur', kind:'text' },
    ]
  },

  // Electronics
  electronics_phone: {
    categoryId: 'electronics_phone',
    topCategory: 'electronics',
    label: 'Smartphone',
    attributeFields: [
      { key:'model', label:'Modèle', kind:'text', required:true },
      { key:'os', label:'OS', kind:'text' },
      { key:'storageGb', label:'Stockage (Go)', kind:'number' },
      { key:'ramGb', label:'RAM (Go)', kind:'number' },
      { key:'batteryMah', label:'Batterie (mAh)', kind:'number' },
      { key:'screenInch', label:'Écran (")', kind:'number' },
      { key:'cameraMp', label:'Caméra (MP)', kind:'number' },
    ]
  },
  electronics_laptop: {
    categoryId: 'electronics_laptop',
    topCategory: 'electronics',
    label: 'Ordinateur portable',
    attributeFields: [
      { key:'cpu', label:'CPU', kind:'text' },
      { key:'gpu', label:'GPU', kind:'text' },
      { key:'ramGb', label:'RAM (Go)', kind:'number' },
      { key:'storageGb', label:'Stockage (Go)', kind:'number' },
      { key:'screenInch', label:'Écran (")', kind:'number' },
      { key:'screenType', label:'Type écran', kind:'select', options:[
        {value:'IPS',label:'IPS'},{value:'OLED',label:'OLED'},{value:'TN',label:'TN'}
      ]},
      { key:'os', label:'OS', kind:'text' },
    ]
  },
  electronics_tv: {
    categoryId: 'electronics_tv',
    topCategory: 'electronics',
    label: 'Téléviseur',
    attributeFields: [
      { key:'sizeInch', label:'Taille (")', kind:'number' },
      { key:'panel', label:'Dalle', kind:'select', options:[
        {value:'LCD',label:'LCD'},{value:'OLED',label:'OLED'},{value:'QLED',label:'QLED'}
      ]},
      { key:'os', label:'OS', kind:'text' },
    ]
  },
  electronics_audio: {
    categoryId: 'electronics_audio',
    topCategory: 'electronics',
    label: 'Audio',
    attributeFields: [
      { key:'type', label:'Type', kind:'select', options:[
        {value:'headphones',label:'Casque'},{value:'speaker',label:'Enceinte'},{value:'amp',label:'Ampli'}
      ]},
      { key:'wireless', label:'Sans fil', kind:'boolean' },
      { key:'codec', label:'Codec', kind:'multiselect' },
    ]
  },

  // Home
  home_furniture: {
    categoryId: 'home_furniture',
    topCategory: 'home',
    label: 'Meuble',
    attributeFields: [
      { key:'room', label:'Pièce', kind:'select', options:[
        {value:'living',label:'Salon'},{value:'bedroom',label:'Chambre'},{value:'kitchen',label:'Cuisine'},{value:'office',label:'Bureau'}
      ]},
      { key:'material', label:'Matériau', kind:'text' },
      { key:'color', label:'Couleur', kind:'text' },
      { key:'requiresAssembly', label:'Montage requis', kind:'boolean' },
      { key:'maxLoadKg', label:'Charge max (kg)', kind:'number' },
    ]
  },
  home_appliance_small: {
    categoryId: 'home_appliance_small',
    topCategory: 'home',
    label: 'Petit électroménager',
    attributeFields: [
      { key:'powerW', label:'Puissance (W)', kind:'number' },
      { key:'energyClass', label:'Classe énergie', kind:'text' },
      { key:'capacity', label:'Capacité', kind:'text' },
      { key:'features', label:'Fonctions', kind:'multiselect' },
    ]
  },
  home_kitchenware: {
    categoryId: 'home_kitchenware',
    topCategory: 'home',
    label: 'Ustensiles',
    attributeFields: [
      { key:'material', label:'Matériau', kind:'text' },
      { key:'dishwasherSafe', label:'Lave-vaisselle', kind:'boolean' },
    ]
  },

  // Beauty
  beauty_cosmetic: {
    categoryId: 'beauty_cosmetic',
    topCategory: 'beauty',
    label: 'Cosmétique',
    attributeFields: [
      { key:'skinType', label:'Type de peau', kind:'multiselect' },
      { key:'volume', label:'Volume', kind:'text' },
      { key:'ingredients', label:'Ingrédients', kind:'textarea' },
      { key:'crueltyFree', label:'Cruelty-free', kind:'boolean' },
    ]
  },
  beauty_personalcare: {
    categoryId: 'beauty_personalcare',
    topCategory: 'beauty',
    label: 'Soin & hygiène',
    attributeFields: [
      { key:'volume', label:'Contenance', kind:'text' },
      { key:'ingredients', label:'Ingrédients', kind:'textarea' },
    ]
  },

  // Sports / Toys
  sports_equipment: {
    categoryId: 'sports_equipment',
    topCategory: 'sports',
    label: 'Équipement sportif',
    attributeFields: [
      { key:'sport', label:'Sport', kind:'text' },
      { key:'level', label:'Niveau', kind:'select', options:[
        {value:'beginner',label:'Débutant'},{value:'intermediate',label:'Intermédiaire'},{value:'pro',label:'Pro'}
      ]},
      { key:'material', label:'Matériau', kind:'text' },
    ]
  },
  toys_generic: {
    categoryId: 'toys_generic',
    topCategory: 'sports',
    label: 'Jouet',
    attributeFields: [
      { key:'ageMin', label:'Âge min', kind:'number' },
      { key:'ageMax', label:'Âge max', kind:'number' },
      { key:'material', label:'Matériau', kind:'text' },
      { key:'safetyMarks', label:'Normes', kind:'multiselect' },
    ]
  },

  // Media
  books_book: {
    categoryId: 'books_book',
    topCategory: 'media',
    label: 'Livre',
    attributeFields: [
      { key:'author', label:'Auteur', kind:'text', required:true },
      { key:'publisher', label:'Éditeur', kind:'text' },
      { key:'language', label:'Langue', kind:'text' },
      { key:'pages', label:'Pages', kind:'number' },
      { key:'format', label:'Format', kind:'select', options:[
        {value:'paperback',label:'Poche'},{value:'hardcover',label:'Relié'},{value:'ebook',label:'eBook'},{value:'audiobook',label:'Audio'}
      ]},
      { key:'isbn13', label:'ISBN-13', kind:'text' },
    ]
  },
  media_music: {
    categoryId: 'media_music',
    topCategory: 'media',
    label: 'Musique',
    attributeFields: [
      { key:'artist', label:'Artiste', kind:'text' },
      { key:'format', label:'Format', kind:'select', options:[
        {value:'cd',label:'CD'},{value:'vinyl',label:'Vinyle'},{value:'digital',label:'Digital'}
      ]},
      { key:'tracks', label:'Pistes', kind:'number' },
    ]
  },
  media_videogame: {
    categoryId: 'media_videogame',
    topCategory: 'media',
    label: 'Jeu vidéo',
    attributeFields: [
      { key:'platform', label:'Plateforme', kind:'text' },
      { key:'pegi', label:'PEGI', kind:'number' },
    ]
  },

  // Auto / DIY / Pet / Services
  auto_part: {
    categoryId: 'auto_part',
    topCategory: 'auto',
    label: 'Pièce auto',
    attributeFields: [
      { key:'compatibleMakes', label:'Marques compatibles', kind:'multiselect' },
      { key:'partNumber', label:'Réf. pièce', kind:'text' },
    ]
  },
  diy_tool: {
    categoryId: 'diy_tool',
    topCategory: 'diy',
    label: 'Outil',
    attributeFields: [
      { key:'powerW', label:'Puissance (W)', kind:'number' },
      { key:'cordless', label:'Sans fil', kind:'boolean' },
      { key:'voltageV', label:'Voltage (V)', kind:'number' },
    ]
  },
  pet_product: {
    categoryId: 'pet_product',
    topCategory: 'pet',
    label: 'Animalerie',
    attributeFields: [
      { key:'animal', label:'Animal', kind:'select', options:[
        {value:'dog',label:'Chien'},{value:'cat',label:'Chat'},{value:'bird',label:'Oiseau'},{value:'fish',label:'Poisson'},{value:'rodent',label:'Rongeur'},{value:'other',label:'Autre'}
      ]},
      { key:'weight', label:'Poids / contenance', kind:'text' },
      { key:'flavor', label:'Saveur', kind:'text' },
    ]
  },
  service_digital: {
    categoryId: 'service_digital',
    topCategory: 'services',
    label: 'Service / numérique',
    attributeFields: [
      { key:'deliveryType', label:'Livraison', kind:'select', required:true, options:[
        {value:'download',label:'Téléchargement'},{value:'code',label:'Code'},{value:'subscription',label:'Abonnement'}
      ]},
      { key:'durationDays', label:'Durée (jours)', kind:'number' },
    ]
  },
};

/* ---------- Utils ---------- */

export function isVariantProduct(p: Product): p is Product & { variants: VariantBlock } {
  return 'variants' in p && !!(p as any).variants;
}

export function specFor(categoryId: CategoryId) {
  return CATEGORY_SPECS[categoryId];
} 

/** Produit cartésien des options (ex: color × size) */
export function cartesianVariants(optionDefs: ProductOption[]): Array<Record<OptionId, string>> {
  if (!optionDefs.length) return []
  const [first, ...rest] = optionDefs
  const head = first.values.map(v => ({ [first.id]: v.id })) as Array<Record<OptionId, string>>
  return rest.reduce((acc, opt) => {
    const out: Array<Record<OptionId, string>> = []
    for (const a of acc) for (const v of opt.values) out.push({ ...a, [opt.id]: v.id })
    return out
  }, head)
}

/** Crée les variantes (SKU) à partir des options, avec valeurs par défaut */
export function createVariantsFromOptions(
  optionDefs: ProductOption[],
  defaults: { price?: number; stock?: number } = {}
): Variant[] {
  const combos = cartesianVariants(optionDefs)
  return combos.map((opt) => {
    const vid = Object.values(opt).join('_')
    return {
      vid,
      options: opt,
      price: defaults.price,
      stock: defaults.stock ?? 0,
      imageKeys: opt.color ? [opt.color] : undefined,
    }
  })
}

/** Construit une matrice 2D (rows=rowKey, cols=colKey) pour un rendu tableau */
export function buildVariantMatrix(
  variants: Variant[],
  rowKey: OptionId = 'size',
  colKey: OptionId = 'color'
) {
  const rows = uniq(variants.map(v => v.options[rowKey]).filter(Boolean))
  const cols = uniq(variants.map(v => v.options[colKey]).filter(Boolean))
  const map: Record<string, Record<string, Variant | undefined>> = {}
  for (const r of rows) {
    map[r] = {}
    for (const c of cols) {
      map[r][c] = variants.find(v => v.options[rowKey] === r && v.options[colKey] === c)
    }
  }
  return { rows, cols, map }
}

/** Met à jour les valeurs d’une option et régénère proprement les variantes */
export function updateOptionValues(
  optionDefs: ProductOption[],
  optionId: OptionId,
  values: ProductOption['values'],
  basePrice?: number
){
  const next = optionDefs.map(o => (o.id === optionId ? { ...o, values } : o))
  const variants = createVariantsFromOptions(next, { price: basePrice })
  return { options: next, variants }
}

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr))
