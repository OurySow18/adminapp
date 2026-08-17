// Fonctions et constantes pures utilisees par VendorDetails.jsx : formatage,
// normalisation de statuts et de produits. Extrait pour reduire la taille du
// composant et permettre de reutiliser/tester cette logique independamment
// du rendu React.
import { doc } from "firebase/firestore";
import { formatCatalogLabels } from "../../utils/catalogLabels";
import { format } from "date-fns";

export const PROTECTED_VENDOR_EMAIL = "monmarchegn@gmail.com";
export const BLOCKED_VENDOR_NOTIFY_EMAIL = "infos@monmarchegn.com";

// Echappe les valeurs injectees dans les templates HTML d'email (nom
// boutique, motif...) qui peuvent contenir du texte fourni par le vendeur.
// Sans ca, un vendeur pourrait injecter du HTML/liens dans les emails
// envoyes en son nom et a l'equipe admin.
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

export const formatDateTime = (value) => {
  if (!value) return "-";

  let date;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  } else if (
    typeof value === "object" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    date = new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6));
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  return format(date, "dd/MM/yyyy HH:mm:ss");
};

export const toTimeNumber = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  if (
    typeof value === "object" &&
    typeof value.seconds === "number"
  ) {
    const millis = value.seconds * 1000;
    if (typeof value.nanoseconds === "number") {
      return millis + Math.floor(value.nanoseconds / 1e6);
    }
    return millis;
  }
  return 0;
};

export const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getProductSortValue = (item) =>
  toTimeNumber(
    item?.updatedAt ??
      item?.blockedAt ??
      item?.timeStamp ??
      item?.createdAt ??
      item?.created_at
  );

export const isProductLike = (data) => {
  if (!data || typeof data !== "object") return false;
  return (
    data.name !== undefined ||
    data.title !== undefined ||
    data.product !== undefined ||
    data.description !== undefined ||
    data.price !== undefined ||
    data.stock !== undefined ||
    Array.isArray(data.images)
  );
};

export const getDocSegmentsFromProduct = (product) => {
  if (
    Array.isArray(product?.__docSegments) &&
    product.__docSegments.length >= 2 &&
    product.__docSegments.length % 2 === 0
  ) {
    return product.__docSegments;
  }

  if (typeof product?.__docPath === "string") {
    const segments = product.__docPath.split("/").filter(Boolean);
    if (segments.length >= 2 && segments.length % 2 === 0) {
      return segments;
    }
  }

  return null;
};

export const getPrimaryProductDocRef = (product, dbInstance) => {
  const segments = getDocSegmentsFromProduct(product);
  if (segments) {
    try {
      return doc(dbInstance, ...segments);
    } catch (err) {
      console.warn("Produit: chemin invalide, utilisation du fallback.", err);
    }
  }
  return doc(dbInstance, "vendor_products", product.id);
};

export const toStatusFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (
      [
        "true",
        "1",
        "oui",
        "yes",
        "active",
        "actif",
        "published",
        "enabled",
        "visible",
      ].includes(normalized)
    ) {
      return true;
    }
    if (["false", "0", "non", "no", "inactive", "bloque", "blocked"].includes(normalized)) {
      return false;
    }
  }
  return false;
};

export const getPartnerFlag = (vendor, profile) => {
  if (typeof vendor?.isPartner === "boolean") return vendor.isPartner;
  if (typeof vendor?.partner === "boolean") return vendor.partner;
  if (typeof profile?.isPartner === "boolean") return profile.isPartner;
  if (typeof profile?.partner === "boolean") return profile.partner;
  const fallback =
    vendor?.isPartner ??
    vendor?.partner ??
    profile?.isPartner ??
    profile?.partner;
  return toStatusFlag(fallback);
};

export const getProductLabel = (product) => {
  if (!product || typeof product !== "object") return "";
  return (
    product.name ||
    product.title ||
    product?.core?.title ||
    product?.draft?.core?.title ||
    product.product ||
    product.designation ||
    product.productName ||
    product.id ||
    ""
  );
};

export const getProductAvailabilityFlag = (product) => {
  const candidates = [
    product?.mm_status,
    product?.core?.mm_status,
    product?.draft?.core?.mm_status,
    product?.active,
    product?.isActive,
    product?.core?.active,
    product?.core?.isActive,
    product?.draft?.core?.active,
    product?.draft?.core?.isActive,
    product?.status,
    product?.core?.status,
    product?.draft?.core?.status,
  ];

  for (const value of candidates) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) continue;
      if (
        ["true", "1", "active", "approved", "published", "visible"].includes(
          normalized
        )
      ) {
        return true;
      }
      if (
        ["false", "0", "inactive", "archived", "blocked", "hidden"].includes(
          normalized
        )
      ) {
        return false;
      }
    }
  }

  return true;
};

export const parseStatusFlagOrNull = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (
      [
        "true",
        "1",
        "oui",
        "yes",
        "active",
        "actif",
        "approved",
        "published",
        "enabled",
        "visible",
      ].includes(normalized)
    ) {
      return true;
    }
    if (
      [
        "false",
        "0",
        "non",
        "no",
        "inactive",
        "inactif",
        "blocked",
        "bloque",
        "hidden",
        "archived",
      ].includes(normalized)
    ) {
      return false;
    }
  }
  return null;
};

export const formatProductTypes = (value) => formatCatalogLabels(value);

export const formatNullableBooleanLabel = (value) => {
  const parsed = parseStatusFlagOrNull(value);
  if (parsed === true) return "Oui";
  if (parsed === false) return "Non";
  return "Non renseigné";
};

export const formatOpsLabel = (key) =>
  ({
    productTypes: "Types de produits",
    canAssistDelivery: "Peut aider à la livraison",
    deliveryCollaborationDetails: "Détails collaboration livraison",
    openingHours: "Horaires d'ouverture",
    pickupAddresses: "Points de retrait",
    opsContact: "Contact opération",
  }[key] ||
    String(key || "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim() ||
    "-");

export const formatOpsValue = (key, value, fallbackProductTypes) => {
  if (key === "productTypes") {
    return formatProductTypes(value ?? fallbackProductTypes);
  }
  if (key === "canAssistDelivery") {
    return formatNullableBooleanLabel(value);
  }
  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean);
    return items.length ? items.join(", ") : "-";
  }
  if (typeof value === "string") {
    return value.trim() || "-";
  }
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return String(value);
};

export const getProfileSection = (vendor) => {
  if (!vendor || typeof vendor !== "object") return {};
  return vendor.profile || vendor.vendor || vendor || {};
};

export const getSection = (vendor, key) => {
  if (!vendor) return {};
  const profile = getProfileSection(vendor) || {};
  return profile?.[key] ?? vendor?.[key] ?? {};
};

export const sanitizeForFirestore = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    if (
      value instanceof Date ||
      typeof value?.toDate === "function" ||
      typeof value?.seconds === "number"
    ) {
      return value;
    }
    const output = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      const sanitizedValue = sanitizeForFirestore(nestedValue);
      if (sanitizedValue !== undefined) {
        output[key] = sanitizedValue;
      }
    });
    return output;
  }
  return value;
};

export const buildArchivedDocId = (sourcePath, fallback) => {
  const base = (sourcePath || fallback || "item").toString();
  const normalized = base
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return normalized || `item_${Date.now()}`;
};
