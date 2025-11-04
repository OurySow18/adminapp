import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  getVendorProductStatusLabel,
  isVendorProductStatus,
  normalizeVendorProductStatus,
  resolveVendorProductActiveFlag,
  resolveVendorProductStatus,
  VENDOR_PRODUCT_STATUS_VALUES,
} from "./vendorProductStatus";

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const toTruthyBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "oui" ||
      normalized === "yes" ||
      normalized === "active" ||
      normalized === "actif" ||
      normalized === "published"
    ) {
      return true;
    }
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "non" ||
      normalized === "no" ||
      normalized === "inactive" ||
      normalized === "inactif" ||
      normalized === "blocked"
    ) {
      return false;
    }
  }
  return false;
};

const resolvePublicPublicationFlags = (raw, source, pathSegments = []) => {
  const isPublicSource =
    source === "public" ||
    (Array.isArray(pathSegments) &&
      pathSegments.some(
        (segment) => segment?.toLowerCase?.() === "products_public"
      ));

  if (!isPublicSource) {
    return {
      isPublicSource: false,
      publicStatusFlag: false,
      publicMmStatusFlag: false,
      publicActive: false,
    };
  }

  const statusCandidate = firstValue(
    raw.status,
    raw.active,
    raw.isActive,
    raw?.core?.status,
    raw?.core?.active
  );
  const mmCandidate = firstValue(raw.mm_status, raw.mmStatus);

  const publicStatusFlag = toTruthyBoolean(statusCandidate);
  const publicMmStatusFlag = toTruthyBoolean(mmCandidate);

  return {
    isPublicSource: true,
    publicStatusFlag,
    publicMmStatusFlag,
    publicActive: publicStatusFlag && publicMmStatusFlag,
  };
};

const sanitizeProductPayload = (rawProduct) => {
  if (!rawProduct || typeof rawProduct !== "object") return {};
  const {
    __docPath,
    __scope,
    id,
    ...rest
  } = rawProduct;
  return {
    ...(typeof id === "string" ? { id } : {}),
    ...rest,
  };
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

  const publicFlags = resolvePublicPublicationFlags(raw, source, pathSegments);
  const active = resolveVendorProductActiveFlag(raw, {
    source,
    pathSegments,
    publicStatusFlag: publicFlags.publicStatusFlag,
    publicMmStatusFlag: publicFlags.publicMmStatusFlag,
  });
  const status = resolveVendorProductStatus(raw, "unknown", {
    pathSegments,
    active,
    source,
    publicActive: publicFlags.publicActive,
    publicStatusFlag: publicFlags.publicStatusFlag,
    publicMmStatusFlag: publicFlags.publicMmStatusFlag,
  });

  return {
    id: entry.id,
    vendorId,
    vendorDisplayId: resolvedVendorDisplayId,
    vendorName,
    productId,
    title: resolveVendorProductTitle(raw, productId),
    status,
    statusLabel: getVendorProductStatusLabel(status),
    active,
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
    publicStatusFlag: publicFlags.publicStatusFlag,
    publicMmStatusFlag: publicFlags.publicMmStatusFlag,
    publicActive: publicFlags.publicActive,
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

export const createEmptyVendorProductStats = () => ({
  total: 0,
  byStatus: VENDOR_PRODUCT_STATUS_VALUES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {}),
});

export const summarizeVendorProductRows = (rows) => {
  const stats = createEmptyVendorProductStats();
  for (const row of rows) {
    stats.total += 1;
    const normalized = normalizeVendorProductStatus(row.status);
    const status =
      normalized ?? (isVendorProductStatus(row.status) ? row.status : "unknown");
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
  }
  return stats;
};

export const loadVendorProductStats = async () => {
  const entries = await fetchVendorProductEntries();
  const stats = createEmptyVendorProductStats();
  for (const entry of entries) {
    stats.total += 1;
    const publicFlags = resolvePublicPublicationFlags(
      entry.raw,
      entry.source,
      entry.pathSegments
    );
    const active = resolveVendorProductActiveFlag(entry.raw, {
      source: entry.source,
      pathSegments: entry.pathSegments,
      publicStatusFlag: publicFlags.publicStatusFlag,
      publicMmStatusFlag: publicFlags.publicMmStatusFlag,
    });
    const status = resolveVendorProductStatus(entry.raw, "unknown", {
      pathSegments: entry.pathSegments,
      active,
      source: entry.source,
      publicActive: publicFlags.publicActive,
      publicStatusFlag: publicFlags.publicStatusFlag,
      publicMmStatusFlag: publicFlags.publicMmStatusFlag,
    });
    const normalized =
      normalizeVendorProductStatus(status) ??
      (isVendorProductStatus(status) ? status : "unknown");
    stats.byStatus[normalized] = (stats.byStatus[normalized] || 0) + 1;
  }
  return stats;
};

const buildStatusUpdatePayload = (status, reason) => {
  const normalized = normalizeVendorProductStatus(status) ?? status;
  const active = normalized === "published";
  const blocked = normalized === "blocked";
  const timestamp = serverTimestamp();
  const updates = {
    status: normalized,
    lifecycleStatus: normalized,
    workflowStatus: normalized,
    state: normalized,
    active,
    isActive: active,
    blocked,
    isBlocked: blocked,
    updatedAt: timestamp,
    "core.status": normalized,
    "core.lifecycleStatus": normalized,
    "core.workflowStatus": normalized,
    "core.state": normalized,
    "core.active": active,
    "core.isActive": active,
    "core.blocked": blocked,
    "core.isBlocked": blocked,
    "core.updatedAt": timestamp,
  };

  if (blocked) {
    const reasonValue = reason?.trim?.() || "Bloque manuellement";
    updates.blockedReason = reasonValue;
    updates["core.blockedReason"] = reasonValue;
  } else {
    updates.blockedReason = deleteField();
    updates["core.blockedReason"] = deleteField();
  }

  return updates;
};

const toDocRef = (path) => {
  if (!path || typeof path !== "string") return null;
  const segments = path.split("/").filter(Boolean);
  if (segments.length % 2 !== 0) return null;
  return doc(db, ...segments);
};

const shouldIncludeVendorScopedRef = (value) =>
  value && value !== "_" && value !== "root";

export const transitionVendorProductStatus = async ({
  productId,
  vendorId,
  targetStatus,
  reason,
  primaryDocPath,
  scope,
  productData,
}) => {
  const normalized = normalizeVendorProductStatus(targetStatus);
  if (!normalized || !isVendorProductStatus(normalized)) {
    throw new Error(
      `Statut "${targetStatus}" invalide. Valeurs autorisees: ${VENDOR_PRODUCT_STATUS_VALUES.join(
        ", "
      )}`
    );
  }

  if (typeof productId !== "string" || productId.length === 0) {
    throw new Error("Identifiant produit manquant pour la mise a jour.");
  }

  const updates = buildStatusUpdatePayload(normalized, reason);

  const refs = new Map();
  const registerRef = (ref) => {
    if (ref) {
      refs.set(ref.path, ref);
    }
  };

  registerRef(toDocRef(primaryDocPath));
  registerRef(doc(db, "vendor_products", productId));

  if (shouldIncludeVendorScopedRef(vendorId)) {
    registerRef(doc(db, "vendor_products", vendorId, "products", productId));
  }

  const publicRef = doc(db, "products_public", productId);
  let includePublicWrite = false;
  let hydratePublicDoc = false;

  if (normalized === "published") {
    includePublicWrite = true;
    hydratePublicDoc = true;
  } else if (scope === "public") {
    includePublicWrite = true;
  } else {
    const publicSnapshot = await getDoc(publicRef);
    includePublicWrite = publicSnapshot.exists();
  }

  if (includePublicWrite) {
    registerRef(publicRef);
  }

  const sanitizedProduct =
    hydratePublicDoc && productData
      ? sanitizeProductPayload(productData)
      : null;

  const writePromises = [];
  refs.forEach((ref) => {
    const isPublic = ref.path.startsWith("products_public/");
    let payload = updates;

    if (isPublic) {
      const publicPayload = {
        ...updates,
        mm_status: normalized === "published",
      };

      payload =
        hydratePublicDoc && sanitizedProduct
          ? {
              ...sanitizedProduct,
              ...publicPayload,
              mm_status: normalized === "published",
            }
          : publicPayload;
    }

    writePromises.push(setDoc(ref, payload, { merge: true }));
  });

  await Promise.all(writePromises);
};
