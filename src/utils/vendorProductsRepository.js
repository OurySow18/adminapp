import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { ensureUniqueSlug } from "./slugUtils";
const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const BOOLEAN_TRUE_VALUES = new Set([
  "true",
  "1",
  "oui",
  "yes",
  "active",
  "actif",
  "published",
  "visible",
  "enabled",
]);

const BOOLEAN_FALSE_VALUES = new Set([
  "false",
  "0",
  "non",
  "no",
  "inactive",
  "inactif",
  "blocked",
  "hidden",
  "disabled",
]);

const toBooleanFlag = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return fallback;
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (BOOLEAN_TRUE_VALUES.has(normalized)) return true;
    if (BOOLEAN_FALSE_VALUES.has(normalized)) return false;
  }
  return fallback;
};

const splitPath = (path) =>
  typeof path === "string"
    ? path
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];

const normalizeDraftFieldPath = (path) => {
  if (typeof path !== "string") return "";
  return path
    .trim()
    .replace(/^draft\.core\./, "")
    .replace(/^core\./, "")
    .replace(/^draft\./, "");
};

const getValueAtPath = (source, path) => {
  if (!source || typeof source !== "object" || !path) return undefined;
  return splitPath(path).reduce((acc, segment) => {
    if (acc && typeof acc === "object") {
      return acc[segment];
    }
    return undefined;
  }, source);
};

const setValueAtPath = (target, path, value) => {
  if (!target || typeof target !== "object") return;
  const segments = splitPath(path);
  if (!segments.length) return;
  let cursor = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    if (!cursor[segment] || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });
};

const resolveFlagFromPaths = (raw, paths, fallback = false) => {
  for (const path of paths) {
    const candidate = getValueAtPath(raw, path);
    if (typeof candidate === "boolean") return candidate;
    if (candidate !== undefined && candidate !== null) {
      return toBooleanFlag(candidate, fallback);
    }
  }
  return fallback;
};

const extractVendorProductFlags = (raw = {}) => {
  const mmStatus = resolveFlagFromPaths(raw, [
    "mm_status",
    "mmStatus",
    "core.mm_status",
    "draft.core.mm_status",
  ]);
  const vmStatus = resolveFlagFromPaths(raw, [
    "vm_status",
    "vmStatus",
    "core.vm_status",
    "draft.core.vm_status",
  ]);
  const draftStatus = resolveFlagFromPaths(raw, [
    "draft_status",
    "draftStatus",
    "core.draft_status",
    "core.draftStatus",
    "draft.core.draft_status",
    "draft.core.draftStatus",
  ]);
  const draftChanges = Array.isArray(raw.draftChanges)
    ? raw.draftChanges
    : Array.isArray(raw.core?.draftChanges)
    ? raw.core.draftChanges
    : Array.isArray(raw.draft?.core?.draftChanges)
    ? raw.draft.core.draftChanges
    : [];

  return {
    mmStatus,
    vmStatus,
    draftStatus,
    draftChanges,
  };
};

const derivePrimaryFilterKey = (flags) => {
  if (flags.draftStatus && (flags.draftChanges?.length ?? 0) > 0) return "draft";
  if (flags.mmStatus === false) return "admin_inactive";
  if (flags.vmStatus === false) return "vendor_inactive";
  if (flags.mmStatus && flags.vmStatus) return "visible";
  return null;
};

const resolveDraftChangesList = (raw) => {
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.draftChanges)) return raw.draftChanges;
  if (Array.isArray(raw.core?.draftChanges)) return raw.core.draftChanges;
  if (Array.isArray(raw.draft?.core?.draftChanges)) return raw.draft.core.draftChanges;
  return [];
};

const getDraftSourceValue = (source, rawPath, normalizedPath) => {
  const candidates = [
    rawPath,
    normalizedPath ? `draft.core.${normalizedPath}` : null,
    normalizedPath ? `draft.${normalizedPath}` : null,
    normalizedPath ? `core.${normalizedPath}` : null,
    normalizedPath,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const value = getValueAtPath(source, candidate);
    if (value !== undefined) return value;
  }
  return undefined;
};

const buildPublicUpdatePayloadFromDraftChanges = (source, rawPaths) => {
  if (!source || typeof source !== "object") return {};
  const payload = {};
  const seen = new Set();

  rawPaths.forEach((rawPath) => {
    if (typeof rawPath !== "string" || !rawPath.trim()) return;
    const normalizedPath = normalizeDraftFieldPath(rawPath);
    if (!normalizedPath) return;
    if (seen.has(normalizedPath)) return;
    seen.add(normalizedPath);

    const value = getDraftSourceValue(source, rawPath.trim(), normalizedPath);
    if (value === undefined) return;
    setValueAtPath(payload, normalizedPath, value);
  });

  return payload;
};

export const VENDOR_PRODUCT_FILTERS = {
  visible: {
    label: "Visibles Monmarché",
    description: "mm_status et vm_status sont actifs.",
    predicate: (item) => toBooleanFlag(item?.mmStatus) && toBooleanFlag(item?.vmStatus),
  },
  admin_inactive: {
    label: "Masqués par l'admin",
    description: "mm_status est désactivé.",
    predicate: (item) => toBooleanFlag(item?.mmStatus) === false,
  },
  vendor_inactive: {
    label: "Désactivés par le vendeur",
    description: "vm_status est désactivé.",
    predicate: (item) => toBooleanFlag(item?.vmStatus) === false,
  },
  draft: {
    label: "Modifications à valider",
    description: "draft_status true avec des champs à vérifier.",
    predicate: (item) =>
      toBooleanFlag(item?.draftStatus) &&
      Array.isArray(item?.draftChanges) &&
      item.draftChanges.length > 0,
  },
};

export const VENDOR_PRODUCT_FILTER_ORDER = Object.keys(VENDOR_PRODUCT_FILTERS);

export const normalizeVendorProductFilterKey = (value) => {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toLowerCase();
  return VENDOR_PRODUCT_FILTER_ORDER.includes(candidate) ? candidate : null;
};

export const getVendorProductFilterLabel = (key) =>
  VENDOR_PRODUCT_FILTERS[key]?.label ?? "";

export const getVendorProductFilterDescription = (key) =>
  VENDOR_PRODUCT_FILTERS[key]?.description ?? "";

export const doesProductMatchFilter = (product, key) => {
  const predicate = VENDOR_PRODUCT_FILTERS[key]?.predicate;
  if (typeof predicate !== "function") return false;
  return Boolean(predicate(product));
};

const sanitizeProductPayload = (rawProduct) => {
  if (!rawProduct || typeof rawProduct !== "object") return {};
  const {
    __docPath,
    __scope,
    id,
    draftChanges,
    draft_status,
    ...rest
  } = rawProduct;
  const sanitized = {
    ...(typeof id === "string" ? { id } : {}),
    ...rest,
  };
  delete sanitized.draftChanges;
  delete sanitized.draft_status;
  if (sanitized.core) {
    delete sanitized.core?.draftChanges;
    delete sanitized.core?.draft_status;
  }
  if (sanitized.draft) {
    delete sanitized.draft;
  }
  return sanitized;
};

const createRowKey = (vendorId, productId) =>
  `${encodeURIComponent(vendorId || "_")}::${productId}`;

const SOURCE_PRIORITY = {
  public: 3,
  nested: 2,
  root: 1,
};

export const normalizeVendorProductDoc = (docSnap, extraMeta = {}) => {
  const data = docSnap.data() || {};
  const pathSegments = docSnap.ref.path.split("/").filter(Boolean);

  const fromPathVendor =
    pathSegments.length >= 4 && pathSegments[0] === "vendor_products"
      ? pathSegments[1]
      : undefined;

  const resolvedVendor =
    data.vendorId ??
    data.core?.vendorId ??
    data.draft?.core?.vendorId ??
    extraMeta.vendorIdFromPath ??
    fromPathVendor;

  const vendorId =
    extraMeta.source === "root"
      ? "_"
      : resolvedVendor ?? fromPathVendor ?? "_";

  const productId =
    data.core?.productId ??
    data.productId ??
    extraMeta.productId ??
    docSnap.id;

  const updatedAt =
    data.updatedAt ??
    data.core?.updatedAt ??
    data.draft?.core?.updatedAt ??
    data.timeStamp ??
    data.createdAt ??
    data.draft?.updatedAt ??
    null;

  return {
    id: createRowKey(vendorId, productId),
    vendorId,
    vendorDisplayId: resolvedVendor ?? fromPathVendor ?? "-",
    productId,
    raw: data,
    source: extraMeta.source ?? "root",
    pathSegments,
    docPath: docSnap.ref.path,
    updatedAt,
  };
};

export const mergeVendorProductEntry = (map, entry) => {
  const existing = map.get(entry.id);
  if (!existing) {
    map.set(entry.id, entry);
    return;
  }

  const existingPriority = SOURCE_PRIORITY[existing.source] ?? 0;
  const incomingPriority = SOURCE_PRIORITY[entry.source] ?? 0;

  if (incomingPriority > existingPriority) {
    map.set(entry.id, entry);
    return;
  }
  if (incomingPriority < existingPriority) {
    return;
  }

  const existingUpdated =
    existing.updatedAt && typeof existing.updatedAt.toMillis === "function"
      ? existing.updatedAt.toMillis()
      : null;
  const incomingUpdated =
    entry.updatedAt && typeof entry.updatedAt.toMillis === "function"
      ? entry.updatedAt.toMillis()
      : null;
  if ((incomingUpdated || 0) > (existingUpdated || 0)) {
    map.set(entry.id, entry);
  }
};

const resolveVendorProductTitle = (raw, productId) =>
  firstValue(
    raw.title,
    raw.name,
    raw.product,
    raw.core?.title,
    raw.draft?.core?.title,
    `Produit ${productId}`
  );

const resolveVendorProductPrice = (raw) =>
  firstValue(
    raw.price,
    raw.pricing?.basePrice,
    raw.core?.pricing?.basePrice,
    raw.draft?.core?.pricing?.basePrice
  );

const resolveVendorProductCurrency = (raw) =>
  firstValue(
    raw.pricing?.currency,
    raw.core?.pricing?.currency,
    raw.draft?.core?.pricing?.currency
  );

const resolveVendorProductStock = (raw) =>
  firstValue(
    raw.stock,
    raw.inventory?.stock,
    raw.core?.inventory?.stock,
    raw.draft?.core?.inventory?.stock
  );

const resolveVendorProductBlockedReason = (raw) =>
  firstValue(
    raw.blockedReason,
    raw.core?.blockedReason,
    raw.draft?.core?.blockedReason,
    "-"
  );

const resolveVendorProductCover = (raw) =>
  firstValue(
    raw.cover,
    raw.img,
    raw.image,
    Array.isArray(raw.images) ? raw.images[0] : undefined,
    raw.media?.cover,
    raw.core?.media?.cover,
    raw.draft?.core?.media?.cover,
    "/default-image.png"
  );

const resolveVendorProductVendorName = (raw, fallback) =>
  firstValue(
    raw.vendorName,
    raw.vendor?.name,
    raw.vendor?.displayName,
    raw.vendor?.companyName,
    raw.vendor?.profile?.displayName,
    raw.vendor?.profile?.company?.name,
    raw.profile?.displayName,
    raw.profile?.company?.name,
    raw.company?.name,
    raw.core?.vendorName,
    raw.core?.vendor?.name,
    raw.core?.vendor?.displayName,
    raw.core?.profile?.displayName,
    raw.core?.profile?.company?.name,
    raw.draft?.core?.vendorName,
    raw.draft?.core?.vendor?.name,
    raw.draft?.core?.vendor?.displayName,
    raw.draft?.core?.profile?.displayName,
    raw.draft?.core?.profile?.company?.name,
    fallback
  );

export const buildVendorProductRow = (entry) => {
  const {
    raw,
    vendorId,
    vendorDisplayId,
    productId,
    updatedAt,
    source,
    docPath,
    pathSegments,
  } = entry;

  const vendorIdFallback = vendorId === "_" ? "-" : vendorId;
  const resolvedVendorDisplayId =
    vendorDisplayId ??
    firstValue(
      raw.vendorId,
      raw.core?.vendorId,
      raw.draft?.core?.vendorId,
      vendorIdFallback
    ) ??
    vendorIdFallback;
  const vendorName = resolveVendorProductVendorName(
    raw,
    resolvedVendorDisplayId
  );

  const flags = extractVendorProductFlags(raw);
  const statusKey = derivePrimaryFilterKey(flags);
  const visibility = Boolean(flags.mmStatus && flags.vmStatus);

  return {
    id: entry.id,
    vendorId,
    vendorDisplayId: resolvedVendorDisplayId,
    vendorName,
    productId,
    title: resolveVendorProductTitle(raw, productId),
    status: statusKey,
    statusLabel: statusKey ? getVendorProductFilterLabel(statusKey) : "-",
    active: visibility,
    cover: resolveVendorProductCover(raw),
    price: resolveVendorProductPrice(raw),
    currency: resolveVendorProductCurrency(raw),
    stock: resolveVendorProductStock(raw),
    blockedReason: resolveVendorProductBlockedReason(raw),
    updatedAt,
    docPath,
    source,
    pathSegments,
    raw,
    mmStatus: flags.mmStatus,
    vmStatus: flags.vmStatus,
    draftStatus: flags.draftStatus,
    draftChanges: Array.isArray(flags.draftChanges)
      ? [...flags.draftChanges]
      : [],
    isVisibleOnMonmarche: visibility,
  };
};

const toTime = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const fetchVendorProductEntries = async () => {
  const aggregate = new Map();

  const rootSnapshot = await getDocs(collection(db, "vendor_products"));
  rootSnapshot.forEach((docSnap) => {
    const entry = normalizeVendorProductDoc(docSnap, { source: "root" });
    mergeVendorProductEntry(aggregate, entry);
  });

  const vendorSnapshots = await getDocs(collectionGroup(db, "products"));
  vendorSnapshots.forEach((docSnap) => {
    const segments = docSnap.ref.path.split("/").filter(Boolean);
    if (segments.length < 4 || segments[0] !== "vendor_products") {
      return;
    }
    const vendorIdFromPath = segments[segments.length - 3];
    const entry = normalizeVendorProductDoc(docSnap, {
      source: "nested",
      vendorIdFromPath,
    });
    mergeVendorProductEntry(aggregate, entry);
  });

  return Array.from(aggregate.values());
};

export const loadVendorProductRows = async () => {
  const entries = await fetchVendorProductEntries();
  const rows = entries.map(buildVendorProductRow);
  rows.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
  return rows;
};

export const loadPublicCatalogRows = async () => {
  const snapshot = await getDocs(collection(db, "products_public"));
  const entries = [];
  snapshot.forEach((docSnap) => {
    entries.push(normalizeVendorProductDoc(docSnap, { source: "public" }));
  });
  const rows = entries.map(buildVendorProductRow);
  rows.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
  return rows;
};

const normalizeLabel = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const resolveEntryVendorName = (entry) =>
  firstValue(
    entry?.raw?.vendorName,
    entry?.raw?.core?.vendorName,
    entry?.raw?.draft?.core?.vendorName,
    entry?.raw?.vendor?.name,
    entry?.raw?.vendor?.displayName,
    entry?.raw?.vendor?.company?.name,
    entry?.raw?.profile?.displayName,
    entry?.raw?.profile?.company?.name,
    entry?.raw?.company?.name,
    entry?.raw?.storeName,
    entry?.vendorDisplayId
  );

const resolveEntryVendorId = (entry) =>
  firstValue(
    entry?.vendorDisplayId,
    entry?.raw?.vendorId,
    entry?.raw?.core?.vendorId,
    entry?.raw?.draft?.core?.vendorId,
    entry?.raw?.vendor?.vendorId,
    entry?.raw?.vendor?.id
  );

export const createEmptyVendorProductStats = () => ({
  total: 0,
  byStatus: VENDOR_PRODUCT_FILTER_ORDER.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {}),
});

export const summarizeVendorProductRows = (rows = []) => {
  const stats = createEmptyVendorProductStats();
  for (const row of rows) {
    stats.total += 1;
    VENDOR_PRODUCT_FILTER_ORDER.forEach((key) => {
      if (doesProductMatchFilter(row, key)) {
        stats.byStatus[key] = (stats.byStatus[key] || 0) + 1;
      }
    });
  }
  return stats;
};

export const loadVendorProductStats = async (options = {}) => {
  const { excludeVendorIds = [], excludeVendorName = "" } = options;
  const excludedIds = new Set(
    Array.isArray(excludeVendorIds) ? excludeVendorIds : []
  );
  const excludedName = normalizeLabel(excludeVendorName);
  const entries = await fetchVendorProductEntries();
  const stats = createEmptyVendorProductStats();
  for (const entry of entries) {
    const entryVendorId = resolveEntryVendorId(entry);
    if (entryVendorId && excludedIds.has(entryVendorId)) {
      continue;
    }
    if (excludedName) {
      const vendorName = normalizeLabel(resolveEntryVendorName(entry));
      if (vendorName.includes(excludedName)) {
        continue;
      }
    }
    stats.total += 1;
    const flags = extractVendorProductFlags(entry.raw);
    const candidate = {
      mmStatus: flags.mmStatus,
      vmStatus: flags.vmStatus,
      draftStatus: flags.draftStatus,
      draftChanges: flags.draftChanges,
    };
    VENDOR_PRODUCT_FILTER_ORDER.forEach((key) => {
      if (doesProductMatchFilter(candidate, key)) {
        stats.byStatus[key] = (stats.byStatus[key] || 0) + 1;
      }
    });
  }
  return stats;
};

const toDocRef = (path) => {
  if (!path || typeof path !== "string") return null;
  const segments = path.split("/").filter(Boolean);
  if (segments.length % 2 !== 0) return null;
  return doc(db, ...segments);
};

const shouldIncludeVendorScopedRef = (value) =>
  value && value !== "_" && value !== "root";

const collectVendorProductRefs = async ({
  productId,
  vendorId,
  primaryDocPath,
}) => {
  if (typeof productId !== "string" || !productId) {
    throw new Error("Identifiant produit manquant pour la mise � jour.");
  }
  const refs = new Map();
  const registerRef = (ref, { requiresExisting = false } = {}) => {
    if (!ref) return;
    const existing = refs.get(ref.path);
    if (existing) {
      existing.requiresExisting =
        existing.requiresExisting && requiresExisting;
      return;
    }
    refs.set(ref.path, { ref, requiresExisting });
  };

  const primaryRef = toDocRef(primaryDocPath);
  if (primaryRef) {
    registerRef(primaryRef);
  }

  const rootRef = doc(db, "vendor_products", productId);
  registerRef(rootRef, {
    requiresExisting: primaryRef ? primaryRef.path !== rootRef.path : false,
  });

  if (shouldIncludeVendorScopedRef(vendorId)) {
    const vendorScopedRef = doc(
      db,
      "vendor_products",
      vendorId,
      "products",
      productId
    );
    registerRef(vendorScopedRef, {
      requiresExisting:
        !primaryRef || vendorScopedRef.path !== primaryRef.path,
    });
  }

  const refsToWrite = [];
  for (const entry of refs.values()) {
    if (entry.requiresExisting) {
      const snap = await getDoc(entry.ref);
      if (!snap.exists()) continue;
    }
    refsToWrite.push(entry.ref);
  }

  if (!refsToWrite.length) {
    throw new Error(
      "Aucune r�f�rence valide trouv�e pour mettre � jour le produit vendeur."
    );
  }

  return refsToWrite;
};

export const updateVendorProductAdminStatus = async ({
  productId,
  vendorId,
  enabled,
  primaryDocPath,
  productData,
}) => {
  if (typeof enabled !== "boolean") {
    throw new Error("Valeur de mm_status invalide.");
  }

  const vendorName = enabled
    ? resolveVendorProductVendorName(
        productData || {},
        firstValue(
          productData?.vendorDisplayId,
          productData?.vendorId,
          productData?.core?.vendorId,
          vendorId,
          "-"
        )
      )
    : null;

  const refsToWrite = await collectVendorProductRefs({
    productId,
    vendorId,
    primaryDocPath,
  });

  const timestamp = serverTimestamp();
  const sharedPayload = {
    mm_status: enabled,
    "core.mm_status": enabled,
    "draft.core.mm_status": enabled,
    updatedAt: timestamp,
    "core.updatedAt": timestamp,
    "draft.core.updatedAt": timestamp,
  };

  const writes = refsToWrite.map((ref) =>
    setDoc(ref, sharedPayload, { merge: true })
  );

  const publicRef = doc(db, "products_public", productId);
  const publicSnap = await getDoc(publicRef);
  const shouldHydrate = enabled && !publicSnap.exists();
  if (shouldHydrate && !productData) {
    throw new Error(
      "Impossible de publier le produit : donn�es source manquantes."
    );
  }
  if (shouldHydrate || publicSnap.exists()) {
    const basePayload = { mm_status: enabled };
    if (vendorName) {
      basePayload.vendorName = vendorName;
    }
    let sanitizedPayload = null;
    if (shouldHydrate) {
      sanitizedPayload = sanitizeProductPayload(productData);
      if (vendorName && !sanitizedPayload.vendorName) {
        sanitizedPayload.vendorName = vendorName;
      }
      if (!publicSnap.exists() || !publicSnap.data()?.slug) {
        const titleCandidate =
          sanitizedPayload.title ||
          sanitizedPayload.name ||
          productData?.title ||
          productData?.name ||
          productData?.core?.title ||
          productData?.core?.name;
        if (titleCandidate) {
          sanitizedPayload.slug = await ensureUniqueSlug(titleCandidate, productId);
        }
      }
    }
    const payload = shouldHydrate
      ? { ...sanitizedPayload, ...basePayload }
      : basePayload;
    writes.push(setDoc(publicRef, payload, { merge: true }));
  }

  await Promise.all(writes);
};

export const applyVendorProductDraftChanges = async ({
  productId,
  vendorId,
  primaryDocPath,
  productData,
}) => {
  if (!productData || typeof productData !== "object") {
    throw new Error("Donn�es produit indisponibles pour la validation.");
  }
  const draftChanges = resolveDraftChangesList(productData).filter(
    (field) => typeof field === "string" && field.trim().length > 0
  );
  if (!draftChanges.length) {
    throw new Error("Aucune modification � valider.");
  }

  const valuesPayload = buildPublicUpdatePayloadFromDraftChanges(
    productData,
    draftChanges
  );
  if (!Object.keys(valuesPayload).length) {
    throw new Error(
      "Impossible de construire la mise � jour � partir des modifications."
    );
  }

  const publicRef = doc(db, "products_public", productId);
  const publicSnap = await getDoc(publicRef);
  if (!publicSnap.exists()) {
    throw new Error(
      "Produit public introuvable. Impossible de valider une modification sans fiche publiee."
    );
  }

  let slugPayload = {};
  if (!publicSnap.data()?.slug) {
    const titleCandidate =
      valuesPayload?.title ||
      productData?.title ||
      productData?.name ||
      productData?.core?.title ||
      productData?.core?.name ||
      productData?.draft?.core?.title ||
      productData?.draft?.core?.name;
    if (titleCandidate) {
      const slug = await ensureUniqueSlug(titleCandidate, productId);
      if (slug) {
        slugPayload = { slug };
      }
    }
  }

  const refsToWrite = await collectVendorProductRefs({
    productId,
    vendorId,
    primaryDocPath,
  });
  const timestamp = serverTimestamp();
  const cleanupPayload = {
    draft_status: false,
    draftStatus: false,
    draftChanges: deleteField(),
    updatedAt: timestamp,
    "core.draft_status": false,
    "core.draftStatus": false,
    "core.draftChanges": deleteField(),
    "core.updatedAt": timestamp,
    "draft.core.draft_status": false,
    "draft.core.draftStatus": false,
    "draft.core.draftChanges": deleteField(),
    "draft.core.updatedAt": timestamp,
  };

  const batch = writeBatch(db);
  batch.set(publicRef, { ...valuesPayload, ...slugPayload }, { merge: true });
  refsToWrite.forEach((ref) => {
    batch.set(ref, cleanupPayload, { merge: true });
  });
  await batch.commit();
};

