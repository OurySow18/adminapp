import { doc } from "firebase/firestore";

export const CITIES_CONFIG_COLLECTION = "app_config";
export const CITIES_CONFIG_DOC_ID = "cities";

export const GUINEA_CITIES_SEED = [
  { city: "Conakry", region: "Conakry", type: "Capitale" },
  { city: "Boke", region: "Boke", type: "Chef-lieu de prefecture" },
  { city: "Boffa", region: "Boke", type: "Chef-lieu de prefecture" },
  { city: "Fria", region: "Boke", type: "Chef-lieu de prefecture" },
  { city: "Gaoual", region: "Boke", type: "Chef-lieu de prefecture" },
  { city: "Koundara", region: "Boke", type: "Chef-lieu de prefecture" },
  { city: "Kindia", region: "Kindia", type: "Chef-lieu de prefecture" },
  { city: "Coyah", region: "Kindia", type: "Chef-lieu de prefecture" },
  { city: "Dubreka", region: "Kindia", type: "Chef-lieu de prefecture" },
  { city: "Forecariah", region: "Kindia", type: "Chef-lieu de prefecture" },
  { city: "Telemele", region: "Kindia", type: "Chef-lieu de prefecture" },
  { city: "Mamou", region: "Mamou", type: "Chef-lieu de prefecture" },
  { city: "Dalaba", region: "Mamou", type: "Chef-lieu de prefecture" },
  { city: "Pita", region: "Mamou", type: "Chef-lieu de prefecture" },
  { city: "Labe", region: "Labe", type: "Chef-lieu de prefecture" },
  { city: "Koubia", region: "Labe", type: "Chef-lieu de prefecture" },
  { city: "Lelouma", region: "Labe", type: "Chef-lieu de prefecture" },
  { city: "Mali", region: "Labe", type: "Chef-lieu de prefecture" },
  { city: "Tougue", region: "Labe", type: "Chef-lieu de prefecture" },
  { city: "Faranah", region: "Faranah", type: "Chef-lieu de prefecture" },
  { city: "Dabola", region: "Faranah", type: "Chef-lieu de prefecture" },
  { city: "Dinguiraye", region: "Faranah", type: "Chef-lieu de prefecture" },
  { city: "Kissidougou", region: "Faranah", type: "Chef-lieu de prefecture" },
  { city: "Kankan", region: "Kankan", type: "Chef-lieu de prefecture" },
  { city: "Kerouane", region: "Kankan", type: "Chef-lieu de prefecture" },
  { city: "Kouroussa", region: "Kankan", type: "Chef-lieu de prefecture" },
  { city: "Mandiana", region: "Kankan", type: "Chef-lieu de prefecture" },
  { city: "Siguiri", region: "Kankan", type: "Chef-lieu de prefecture" },
  { city: "Nzerekore", region: "Nzerekore", type: "Chef-lieu de prefecture" },
  { city: "Beyla", region: "Nzerekore", type: "Chef-lieu de prefecture" },
  { city: "Gueckedou", region: "Nzerekore", type: "Chef-lieu de prefecture" },
  { city: "Lola", region: "Nzerekore", type: "Chef-lieu de prefecture" },
  { city: "Macenta", region: "Nzerekore", type: "Chef-lieu de prefecture" },
  { city: "Yomou", region: "Nzerekore", type: "Chef-lieu de prefecture" },
];

export const getCitiesConfigRef = (db) =>
  doc(db, CITIES_CONFIG_COLLECTION, CITIES_CONFIG_DOC_ID);

export const slugifyCityValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "city";

export const buildCityItemId = (city, region) =>
  `${slugifyCityValue(city)}-${slugifyCityValue(region)}`;

const sanitizeString = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

export const sortCityItems = (items) =>
  [...items].sort((left, right) => {
    const byCity = String(left.city || "").localeCompare(String(right.city || ""), "fr");
    if (byCity !== 0) return byCity;
    return String(left.region || "").localeCompare(String(right.region || ""), "fr");
  });

export const normalizeCityItem = (item = {}) => {
  const city = sanitizeString(item.city);
  const region = sanitizeString(item.region);
  const type = sanitizeString(item.type, "Chef-lieu de prefecture") || "Chef-lieu de prefecture";
  const id = sanitizeString(item.id) || buildCityItemId(city, region);

  return {
    id,
    city,
    region,
    type,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
};

export const normalizeCitiesDocument = (data = {}) => {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems
    .map((item) => normalizeCityItem(item))
    .filter((item) => item.city && item.region);

  return {
    items: sortCityItems(items),
    updatedAt: data.updatedAt || null,
  };
};

export const findCityById = (items, id) =>
  items.find((item) => item.id === id) || null;
