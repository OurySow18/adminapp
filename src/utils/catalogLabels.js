const TOP_CATEGORY_LABELS = {
  grocery: "Alimentaire & boissons",
  fashion: "Mode & accessoires",
  baby: "Bébé & puériculture",
  electronics: "Électronique",
  home: "Maison & cuisine",
  beauty: "Beauté & santé",
  sports: "Sports & loisirs",
  media: "Livres, musique, vidéo, jeux",
  auto: "Auto & pièces",
  diy: "Bricolage & outils",
  pet: "Animaux",
  services: "Services & digitaux",
};

const CATEGORY_LABELS = {
  grocery_fresh: "Frais",
  grocery_packaged: "Épicerie",
  grocery_beverage: "Boissons",
  fashion_shirt: "Chemise",
  fashion_pants: "Pantalon",
  fashion_underwear: "Sous-vêtements",
  fashion_socks: "Chaussettes",
  fashion_shoes: "Chaussures",
  fashion_accessory: "Accessoire",
  baby_clothing: "Vêtements bébé",
  baby_care: "Soin & hygiène bébé",
  baby_diapering: "Change & couches",
  baby_food: "Alimentation bébé",
  baby_gear: "Puériculture & mobilité",
  electronics_phone: "Smartphone",
  electronics_laptop: "Ordinateur portable",
  electronics_tv: "Téléviseur",
  electronics_audio: "Audio",
  home_furniture: "Meuble",
  home_appliance_small: "Petit électroménager",
  home_appliance_major: "Gros électroménager",
  home_kitchenware: "Ustensiles",
  beauty_cosmetic: "Cosmétique",
  beauty_personalcare: "Soin & hygiène",
  beauty_fragrance: "Parfum & fragrances",
  sports_equipment: "Équipement sportif",
  toys_generic: "Jouet",
  books_book: "Livre",
  media_music: "Musique",
  media_videogame: "Jeu vidéo",
  auto_part: "Pièce auto",
  diy_tool: "Outil",
  pet_product: "Animalerie",
  service_digital: "Service / numérique",
};

const hasLabel = (map, value) =>
  typeof value === "string" &&
  value.trim() &&
  Object.prototype.hasOwnProperty.call(map, value);

const humanizeCatalogKey = (value) => {
  if (typeof value !== "string" || !value.trim()) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
};

export const getTopCategoryLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) return "-";
  return TOP_CATEGORY_LABELS[value] || humanizeCatalogKey(value);
};

export const getCategoryLabel = (value) => {
  if (typeof value !== "string" || !value.trim()) return "-";
  return CATEGORY_LABELS[value] || humanizeCatalogKey(value);
};

export const getCatalogLabel = (value) => {
  if (hasLabel(CATEGORY_LABELS, value)) return CATEGORY_LABELS[value];
  if (hasLabel(TOP_CATEGORY_LABELS, value)) return TOP_CATEGORY_LABELS[value];
  return humanizeCatalogKey(value);
};

export const TOP_CATEGORY_OPTIONS = Object.keys(TOP_CATEGORY_LABELS);

export { CATEGORY_LABELS, TOP_CATEGORY_LABELS };
