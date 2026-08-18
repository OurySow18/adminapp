// Fonctions pures utilisees par VendorProductDetails.jsx : formatage,
// libelles de champs/attributs, comparaison brouillon vs publie, detection
// d'URLs image. Extrait pour reduire la taille du composant ; aucune
// logique modifiee lors du deplacement.
import { doc } from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";

export const formatDateTime = (value) => {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? format(date, "dd/MM/yyyy HH:mm:ss") : "-";
  }
  if (value instanceof Date) {
    return format(value, "dd/MM/yyyy HH:mm:ss");
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : format(parsed, "dd/MM/yyyy HH:mm:ss");
};

export const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

export const safeDecode = (value, fallback = "") => {
  try {
    return decodeURIComponent(value || fallback);
  } catch (error) {
    return fallback;
  }
};

export const safeDocRef = (...segments) => {
  if (!Array.isArray(segments) || !segments.length) return null;
  const normalized = [];
  for (const segment of segments) {
    if (typeof segment !== "string") return null;
    const trimmed = segment.trim();
    if (!trimmed) return null;
    normalized.push(trimmed);
  }
  if (normalized.length % 2 !== 0) return null;
  try {
    return doc(db, ...normalized);
  } catch (error) {
    console.warn("VendorProductDetails: doc path invalide ignoré.", normalized, error);
    return null;
  }
};

export const toBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1";

export const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ATTRIBUTE_LABELS = {
  perishables: "Produit perissable",
  originCountry: "Pays d'origine",
  organic: "Produit bio",
  expirationDate: "Date limite",
  storage: "Conservation",
  unit: "Unite de vente",
  netWeight: "Poids net",
  ingredients: "Ingredients",
  allergens: "Allergenes",
  "nutrition.kcalPer100g": "Calories / 100g",
  volume: "Contenance",
  alcohol: "Degre d'alcool",
  gender: "Genre",
  material: "Matiere",
  fit: "Coupe",
  care: "Entretien",
  materialUpper: "Matiere (tige)",
  materialSole: "Matiere (semelle)",
  color: "Couleur",
  model: "Modele",
  os: "Systeme",
  storageGb: "Stockage (Go)",
  ramGb: "Memoire vive (Go)",
  batteryMah: "Batterie (mAh)",
  screenInch: "Ecran (\")",
  cameraMp: "Appareil photo (MP)",
  cpu: "Processeur",
  gpu: "Carte graphique",
  screenType: "Type d'ecran",
  sizeInch: "Diagonal (\")",
  panel: "Dalle",
  type: "Type",
  wireless: "Sans fil",
  codec: "Codecs",
  room: "Piece",
  requiresAssembly: "Montage requis",
  maxLoadKg: "Charge max (kg)",
  powerW: "Puissance (W)",
  energyClass: "Classe energetique",
  capacity: "Capacite",
  features: "Fonctionnalites",
  dishwasherSafe: "Compatible lave-vaisselle",
  skinType: "Type de peau",
  crueltyFree: "Non teste sur animaux",
  sport: "Discipline",
  level: "Niveau pratique",
  ageMin: "Age minimum",
  ageMax: "Age maximum",
  safetyMarks: "Normes / certifications",
  author: "Auteur",
  publisher: "Editeur",
  language: "Langue",
  pages: "Nombre de pages",
  format: "Format",
  isbn13: "ISBN-13",
  artist: "Artiste",
  tracks: "Nombre de pistes",
  platform: "Plateforme",
  pegi: "PEGI",
  compatibleMakes: "Marques compatibles",
  partNumber: "Reference piece",
  cordless: "Sans fil",
  voltageV: "Voltage (V)",
  animal: "Animal concerne",
  weight: "Poids / contenance",
  flavor: "Saveur",
  deliveryType: "Mode de livraison",
  durationDays: "Duree (jours)",
  ageMaxMonths: "Age maximum (mois)",
  ageMinMonths: "Age minimum (mois)",
  age_max_months: "Age maximum (mois)",
  age_min_months: "Age minimum (mois)",
  weightLimitKg: "Poids maximal (kg)",
  weight_limit_kg: "Poids maximal (kg)",
};

export const ATTRIBUTE_FIELD_LABELS = Object.fromEntries(
  Object.entries(ATTRIBUTE_LABELS).flatMap(([key, label]) => {
    const entries = [[key, label]];
    if (!key.startsWith("attributes.")) {
      entries.push([`attributes.${key}`, label]);
      entries.push([`core.attributes.${key}`, label]);
      entries.push([`draft.core.attributes.${key}`, label]);
    }
    return entries;
  })
);

export const FIELD_LABELS = {
  description: "Description",
  brandRelationship: "Relation marque",
  pricing: "Tarification",
  "pricing.basePrice": "Prix (HT)",
  "pricing.currency": "Devise",
  "pricing.taxes": "Taxes",
  stock: "Stock",
  "inventory.stock": "Stock",
  brand: "Marque",
  category: "Catégorie",
  categoryId: "Catégorie",
  topCategory: "Catégorie principale",
  status: "Statut",
  vm_status: "Statut vendeur",
  vmStatus: "Statut vendeur",
  mm_status: "Statut Monmarché",
  mmStatus: "Statut Monmarché",
  draft_status: "Modification en attente",
  draftStatus: "Modification en attente",
  rating: "Note",
  "rating.count": "Nombre d'avis",
  "rating.average": "Note moyenne",
  media: "Medias",
  "media.cover": "Medias > couverture",
  "media.gallery": "Medias > galerie",
  "media.byOption": "Medias > par option",
  "media.byOption.color": "Medias > par option > couleur",
  fulfillment: "Livraison",
  "fulfillment.shippedBy": "Expédié par",
  "fulfillment.deliveryOptions": "Options de livraison",
  "fulfillment.vendorDeliveryAreas": "Zones de livraison vendeur",
  "fulfillment.vendorShipping": "Expédition vendeur",
  "fulfillment.vendorShipping.localAreas": "Zones locales",
  "fulfillment.vendorShipping.nationalCarriers": "Transporteurs nationaux",
  "fulfillment.vendorShipping.internationalCarriers": "Transporteurs internationaux",
  "fulfillment.vendorShipping.pickupPoints": "Points de retrait",
  "fulfillment.deliveryNote": "Note de livraison",
  "fulfillment.leadTimeDays": "Délai de préparation",
  "fulfillment.weightGr": "Poids (g)",
  "fulfillment.dimensionsCm": "Dimensions (cm)",
  city: "Ville",
  fee: "Frais",
  minDelayDays: "Délai min. (jours)",
  maxDelayDays: "Délai max. (jours)",
  carrier: "Transporteur",
  serviceName: "Service",
  coverage: "Couverture",
  baseFee: "Frais de base",
  estimatedDays: "Délai estimé",
  notes: "Notes",
  label: "Libellé",
  address: "Adresse",
  hours: "Horaires",
  instructions: "Instructions",
  ...ATTRIBUTE_FIELD_LABELS,
};

export const SEGMENT_LABEL_OVERRIDES = {
  attributes: "Attributs",
  nutrition: "Nutrition",
  media: "Medias",
  cover: "Couverture",
  gallery: "Galerie",
  byoption: "Par option",
  color: "Couleur",
  fulfillment: "Livraison",
  vendorshipping: "Expédition vendeur",
  vendordeliveryareas: "Zones de livraison vendeur",
  localareas: "Zones locales",
  nationalcarriers: "Transporteurs nationaux",
  internationalcarriers: "Transporteurs internationaux",
  pickuppoints: "Points de retrait",
  deliveryoptions: "Options de livraison",
  shippedby: "Expédié par",
  deliverynote: "Note de livraison",
  leadtimedays: "Délai de préparation",
  mindelaydays: "Délai min. (jours)",
  maxdelaydays: "Délai max. (jours)",
  servicename: "Service",
  basefee: "Frais de base",
  estimateddays: "Délai estimé",
};

export const splitFieldPath = (path) =>
  typeof path === "string"
    ? path
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];

export const normalizeFieldPath = (path) => {
  if (typeof path !== "string") return "";
  return path
    .replace(/^draft\.core\./, "")
    .replace(/^core\./, "")
    .replace(/^draft\./, "");
};

export const humanizeSegment = (segment) => {
  if (!segment) return "";
  if (/^\d+$/.test(segment)) {
    return `#${Number(segment) + 1}`;
  }
  const normalized = segment.toLowerCase();
  if (SEGMENT_LABEL_OVERRIDES[normalized]) {
    return SEGMENT_LABEL_OVERRIDES[normalized];
  }
  return segment
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
};

export const getFieldLabel = (path) => {
  if (!path) return "-";
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const normalized = normalizeFieldPath(path);
  if (normalized && FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];
  const resolvedPath = normalized || path;
  const segments = splitFieldPath(resolvedPath);
  if (!segments.length) return "-";
  return segments.map(humanizeSegment).join(" > ");
};

export const getFieldPathHint = (path) => {
  const normalized = normalizeFieldPath(path);
  const segments = splitFieldPath(normalized || path);
  if (segments.length <= 1) return "";
  return segments
    .slice(0, -1)
    .map(humanizeSegment)
    .filter(Boolean)
    .join(" > ");
};

export const trimAttributeLabel = (value) => {
  if (typeof value !== "string") return value;
  const segments = value
    .split(">")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return value;
  return segments[segments.length - 1];
};

export const getAttributeLabel = (key) => {
  if (!key) return "-";
  const candidates = [
    FIELD_LABELS[key],
    FIELD_LABELS[`attributes.${key}`],
    FIELD_LABELS[`core.attributes.${key}`],
    FIELD_LABELS[`draft.core.attributes.${key}`],
    getFieldLabel(key),
    getFieldLabel(`attributes.${key}`),
  ];
  const label = candidates.find(
    (value) => typeof value === "string" && value.trim() && value !== "-"
  );
  if (!label) {
    const fallback = humanizeSegment(key);
    return fallback || key;
  }
  return trimAttributeLabel(label);
};

export const getNestedValue = (source, path) => {
  if (!source || typeof source !== "object") return undefined;
  if (
    typeof path === "string" &&
    Object.prototype.hasOwnProperty.call(source, path)
  ) {
    return source[path];
  }
  const segments = splitFieldPath(path);
  if (!segments.length) return undefined;
  const nestedValue = segments.reduce((cursor, segment) => {
    if (cursor === undefined || cursor === null) return undefined;
    if (typeof cursor !== "object") return undefined;
    return cursor[segment];
  }, source);
  if (nestedValue !== undefined) return nestedValue;

  for (let index = segments.length - 1; index > 0; index -= 1) {
    const joinedHead = segments.slice(0, index).join(".");
    const tailPath = segments.slice(index).join(".");
    if (Object.prototype.hasOwnProperty.call(source, joinedHead)) {
      const headValue = source[joinedHead];
      return tailPath ? getNestedValue(headValue, tailPath) : headValue;
    }
  }

  return undefined;
};

export const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const normalizeComparableValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue);
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeComparableValue(value[key]);
        return acc;
      }, {});
  }
  return value;
};

export const areValuesEqual = (left, right) => {
  if (left === right) return true;
  if (left === undefined && right === null) return true;
  if (left === null && right === undefined) return true;
  return (
    JSON.stringify(normalizeComparableValue(left)) ===
    JSON.stringify(normalizeComparableValue(right))
  );
};

export const collectChangedLeafPaths = (basePath, vendorValue, publishedValue) => {
  const normalizedBasePath = normalizeFieldPath(basePath);
  const changedPaths = [];

  const walk = (relativePath, vendorNode, publishedNode) => {
    if (areValuesEqual(vendorNode, publishedNode)) {
      return;
    }

    const hasObject = isPlainObject(vendorNode) || isPlainObject(publishedNode);
    const hasArray = Array.isArray(vendorNode) || Array.isArray(publishedNode);
    if (!hasObject && !hasArray) {
      if (!areValuesEqual(vendorNode, publishedNode)) {
        changedPaths.push(
          relativePath ? `${normalizedBasePath}.${relativePath}` : normalizedBasePath
        );
      }
      return;
    }

    const keys = hasArray
      ? new Set([
          ...(Array.isArray(vendorNode) ? vendorNode : []).map((_, index) => String(index)),
          ...(Array.isArray(publishedNode) ? publishedNode : []).map((_, index) => String(index)),
        ])
      : new Set([
          ...Object.keys(isPlainObject(vendorNode) ? vendorNode : {}),
          ...Object.keys(isPlainObject(publishedNode) ? publishedNode : {}),
        ]);
    keys.forEach((key) => {
      const nextVendorNode =
        vendorNode !== null && vendorNode !== undefined && typeof vendorNode === "object"
          ? vendorNode[key]
          : undefined;
      const nextPublishedNode =
        publishedNode !== null &&
        publishedNode !== undefined &&
        typeof publishedNode === "object"
          ? publishedNode[key]
          : undefined;
      walk(
        relativePath ? `${relativePath}.${key}` : key,
        nextVendorNode,
        nextPublishedNode
      );
    });
  };

  walk("", vendorValue, publishedValue);
  return changedPaths;
};

export const VALUE_LABELS = {
  platform: "Monmarché",
  vendor: "Vendeur",
  pickup: "Retrait",
  local_delivery: "Livraison locale",
  carrier: "Transporteur",
  digital: "Digital",
  active: "Actif",
  draft: "Brouillon",
  archived: "Archivé",
  standard: "Standard",
  reduced: "Réduit",
  exempt: "Exonéré",
};

export const getDisplayValue = (value) => {
  if (typeof value !== "string") return value;
  return VALUE_LABELS[value] || value;
};

export const hasRenderableValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(hasRenderableValue);
  if (isPlainObject(value)) {
    return Object.values(value).some(hasRenderableValue);
  }
  return true;
};

export const isLikelyImageUrl = (value = "", path = "") => {
  if (typeof value !== "string") return false;
  const candidate = value.trim().toLowerCase();
  if (!candidate.startsWith("http")) return false;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(candidate)) return true;
  if (candidate.includes("firebasestorage")) return true;
  if (!path) return false;
  const normalizedPath = path.toLowerCase();
  return (
    normalizedPath.includes("image") ||
    normalizedPath.includes("media") ||
    normalizedPath.includes("cover") ||
    normalizedPath.includes("gallery")
  );
};
