import "./vendorDetails.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  getVendorStatusLabel,
  resolveVendorStatus,
} from "../../utils/vendorStatus";
import { format } from "date-fns";


const formatDateTime = (value) => {
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

const toTimeNumber = (value) => {
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

const getProductSortValue = (item) =>
  toTimeNumber(
    item?.updatedAt ??
      item?.blockedAt ??
      item?.timeStamp ??
      item?.createdAt ??
      item?.created_at
  );

const isProductLike = (data) => {
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

const getDocSegmentsFromProduct = (product) => {
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

const getPrimaryProductDocRef = (product, dbInstance) => {
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

const toStatusFlag = (value) => {
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

const getPartnerFlag = (vendor, profile) => {
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

const getProductLabel = (product) => {
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

const getProfileSection = (vendor) => {
  if (!vendor || typeof vendor !== "object") return {};
  return vendor.profile || vendor.vendor || vendor || {};
};

const getSection = (vendor, key) => {
  if (!vendor) return {};
  const profile = getProfileSection(vendor) || {};
  return profile?.[key] ?? vendor?.[key] ?? {};
};

const PROTECTED_VENDOR_EMAIL = "monmarchegn@gmail.com";

const sanitizeForFirestore = (value) => {
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

const buildArchivedDocId = (sourcePath, fallback) => {
  const base = (sourcePath || fallback || "item").toString();
  const normalized = base
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return normalized || `item_${Date.now()}`;
};

const VendorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dialogReason, setDialogReason] = useState("");
  const [dialogValidationError, setDialogValidationError] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [approvalLocation, setApprovalLocation] = useState(null);
  const [locationFallback, setLocationFallback] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [locationMessage, setLocationMessage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [partnerConfirm, setPartnerConfirm] = useState({
    open: false,
    enabled: false,
  });

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "vendors", id),
      (snap) => {
        if (snap.exists()) {
          setVendor({ id: snap.id, ...snap.data() });
        } else {
          setVendor(null);
          setError("Vendeur introuvable.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Erreur de récupération du vendeur:", err);
        setError("Impossible de charger ce vendeur.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [id]);

  useEffect(() => {
    setApprovalLocation(null);
    setLocationError(null);
    setLocationMessage(null);
    setFetchingLocation(false);
  }, [id]);

  const profile = useMemo(() => (vendor ? getProfileSection(vendor) : {}), [vendor]);
  const company = useMemo(() => getSection(vendor, "company"), [vendor]);
  const legal = useMemo(() => getSection(vendor, "legal"), [vendor]);
  const bank = useMemo(() => getSection(vendor, "bank"), [vendor]);
  const ops = useMemo(() => getSection(vendor, "ops"), [vendor]);
  const food = useMemo(() => getSection(vendor, "food"), [vendor]);
  const consent = useMemo(() => getSection(vendor, "consent"), [vendor]);
  const requiredDocs = useMemo(() => {
    const docs = profile?.requiredDocs ?? vendor?.requiredDocs ?? [];
    return Array.isArray(docs) ? docs : [];
  }, [profile, vendor]);

  const REQUIRED_DOC_LABELS = {
    repId: "Pièce d'identité du représentant",
    gewerbe: "Enregistrement commerce",
    handelsregister: "Extrait registre de commerce",
    ifsg: "Certificat IFSG",
    haccp: "Plan HACCP",
    liability: "Assurance responsabilité civile",
    foodRegistration: "Enregistrement établissement alimentaire",
  };

  const normalizedStatus = useMemo(
    () => (vendor ? resolveVendorStatus(vendor, "draft") : "draft"),
    [vendor]
  );

  const logoUrl = useMemo(() => {
    const profileSection = getProfileSection(vendor);
    const companySection = company || vendor?.company;
    return (
      profileSection?.logo ||
      profileSection?.company?.logoUrl ||
      companySection?.logoUrl ||
      vendor?.logo ||
      vendor?.companyLogo ||
      null
    );
  }, [vendor, company]);

  const coverUrl = useMemo(() => {
    const profileSection = getProfileSection(vendor);
    const companySection = company || vendor?.company;
    return (
      profileSection?.company?.coverUrl ||
      companySection?.coverUrl ||
      vendor?.coverUrl ||
      vendor?.companyCover ||
      null
    );
  }, [vendor, company]);

  const vendorStatus = vendor
    ? getVendorStatusLabel(normalizedStatus)
    : "-";
  const isBlocked = normalizedStatus === "blocked";
  const isApproved = normalizedStatus === "approved";
  const normalizedVendorEmail = useMemo(() => {
    const candidates = [
      company?.email,
      vendor?.email,
      vendor?.contactEmail,
      vendor?.profile?.email,
      vendor?.profile?.company?.email,
      vendor?.company?.email,
    ];
    const email = candidates.find(
      (value) => typeof value === "string" && value.trim()
    );
    return email ? email.trim().toLowerCase() : "";
  }, [company, vendor]);
  const isProtectedVendor = normalizedVendorEmail === PROTECTED_VENDOR_EMAIL;

  const fallbackDisplayName =
    vendor?.displayName ||
    company?.name ||
    vendor?.name ||
    vendor?.companyName ||
    "Vendeur";


  const vendorIdentifiers = useMemo(() => {
    if (!vendor) return [];
    const identifiers = new Set();
    const push = (value) => {
      if (value === undefined || value === null) return;
      const stringValue = String(value).trim();
      if (stringValue) {
        identifiers.add(stringValue);
      }
    };

    push(vendor.id);
    push(vendor.uid);
    push(vendor.userId);
    push(vendor.vendorId);
    push(vendor.ownerId);
    push(vendor.accountId);
    push(vendor.profile?.uid);
    push(vendor.profile?.vendorId);
    push(vendor.profile?.userId);
    push(vendor.profile?.ownerId);
    push(profile?.uid);
    push(profile?.vendorId);
    push(profile?.userId);
    push(profile?.ownerId);
    push(profile?.id);

    return Array.from(identifiers);
  }, [vendor, profile]);

  const vendorIdSet = useMemo(
    () => new Set(vendorIdentifiers),
    [vendorIdentifiers]
  );

  const matchesVendorProduct = useCallback(
    (product) => {
      if (!product || vendorIdSet.size === 0) return false;
      const candidates = [];
      const push = (value) => {
        if (value === undefined || value === null) return;
        const stringValue = String(value).trim();
        if (stringValue) {
          candidates.push(stringValue);
        }
      };

      const candidateKeys = [
        "vendorId",
        "vendor_id",
        "vendorID",
        "vendorUid",
        "vendorUID",
        "uid",
        "userId",
        "ownerId",
        "owner_id",
        "createdBy",
        "createdByUid",
        "supplierId",
        "sellerId",
        "shopId",
        "merchantId",
      ];

      candidateKeys.forEach((key) => push(product?.[key]));

      push(product?.core?.vendorId);
      push(product?.draft?.core?.vendorId);

      if (Array.isArray(product?.core?.vendorIds)) {
        product.core.vendorIds.forEach((value) => push(value));
      }
      if (Array.isArray(product?.draft?.core?.vendorIds)) {
        product.draft.core.vendorIds.forEach((value) => push(value));
      }

      if (typeof product?.vendor === "string") {
        push(product.vendor);
      } else if (product?.vendor && typeof product.vendor === "object") {
        push(product.vendor.id);
        push(product.vendor.uid);
        push(product.vendor.vendorId);
        push(product.vendor.userId);
        push(product.vendor.ownerId);
      }

      if (Array.isArray(product?.vendorIds)) {
        product.vendorIds.forEach((value) => push(value));
      }

      return candidates.some((value) => vendorIdSet.has(value));
    },
    [vendorIdSet]
  );

  const fetchProductsForVendor = useCallback(async () => {
    if (vendorIdentifiers.length === 0) return [];

    const seenById = new Map();

    const addSnapshotDocs = (snapshot, extraMeta = {}) => {
      snapshot?.forEach((docSnap) => {
        const rawData = docSnap.data();
        if (!rawData) return;

        const data = { id: docSnap.id, ...rawData };
        const pathSegments = docSnap.ref.path.split("/").filter(Boolean);

        const vendorFromCore =
          rawData?.vendorId ??
          rawData?.core?.vendorId ??
          rawData?.draft?.core?.vendorId ??
          extraMeta.vendorIdFromPath ??
          (pathSegments.length >= 2 ? pathSegments[1] : undefined);

        if (!data.vendorId && vendorFromCore) {
          data.vendorId = vendorFromCore;
        }

        if (!data.title && rawData?.core?.title) {
          data.title = rawData.core.title;
        }
        if (!data.name && rawData?.core?.title) {
          data.name = rawData.core.title;
        }

        if (!data.status && rawData?.core?.status) {
          data.status = rawData.core.status;
        } else if (!data.status && rawData?.draft?.core?.status) {
          data.status = rawData.draft.core.status;
        }

        if (typeof data.blocked !== "boolean" && typeof rawData?.core?.blocked === "boolean") {
          data.blocked = rawData.core.blocked;
        } else if (typeof data.blocked !== "boolean" && typeof rawData?.draft?.core?.blocked === "boolean") {
          data.blocked = rawData.draft.core.blocked;
        }

        if (typeof data.active !== "boolean" && typeof rawData?.core?.active === "boolean") {
          data.active = rawData.core.active;
        }
        if (typeof data.isActive !== "boolean" && typeof rawData?.core?.isActive === "boolean") {
          data.isActive = rawData.core.isActive;
        }

        if (data.price === undefined) {
          if (rawData?.pricing?.basePrice !== undefined) {
            data.price = rawData.pricing.basePrice;
          } else if (rawData?.core?.pricing?.basePrice !== undefined) {
            data.price = rawData.core.pricing.basePrice;
          } else if (rawData?.draft?.core?.pricing?.basePrice !== undefined) {
            data.price = rawData.draft.core.pricing.basePrice;
          }
        }

        if (data.stock === undefined) {
          if (rawData?.stock !== undefined) {
            data.stock = rawData.stock;
          } else if (rawData?.inventory?.stock !== undefined) {
            data.stock = rawData.inventory.stock;
          } else if (rawData?.core?.inventory?.stock !== undefined) {
            data.stock = rawData.core.inventory.stock;
          } else if (rawData?.draft?.core?.inventory?.stock !== undefined) {
            data.stock = rawData.draft.core.inventory.stock;
          }
        }

        if (!data.product_id && rawData?.core?.productId) {
          data.product_id = rawData.core.productId;
        }

        if (!data.updatedAt) {
          data.updatedAt =
            rawData?.updatedAt ??
            rawData?.core?.updatedAt ??
            rawData?.draft?.core?.updatedAt ??
            rawData?.draft?.updatedAt;
        }

        if (pathSegments.length >= 4 && pathSegments[0] === "vendor_products") {
          const pathVendorId = pathSegments[1];
          if (pathVendorId && !data.vendorId) {
            data.vendorId = pathVendorId;
          }
        }

        if (extraMeta.vendorIdFromPath && !data.vendorId) {
          data.vendorId = extraMeta.vendorIdFromPath;
        }

        if (!isProductLike(data)) return;
        if (!matchesVendorProduct(data)) return;

        const productWithMeta = {
          ...data,
          __docPath: docSnap.ref.path,
          __docSegments: pathSegments,
        };

        const existing = seenById.get(data.id);

        if (!existing) {
          seenById.set(data.id, productWithMeta);
          return;
        }

        const existingPath = existing.__docPath ?? "";
        const currentPath = productWithMeta.__docPath ?? "";
        const existingIsVendor = existingPath.startsWith("vendor_products");
        const currentIsVendor = currentPath.startsWith("vendor_products");

        if (existingIsVendor && !currentIsVendor) {
          const merged = { ...productWithMeta, ...existing };
          merged.__docPath = existing.__docPath;
          merged.__docSegments = existing.__docSegments;
          seenById.set(data.id, merged);
        } else if (!existingIsVendor && currentIsVendor) {
          const merged = { ...existing, ...productWithMeta };
          seenById.set(data.id, merged);
        } else {
          const merged = { ...existing, ...productWithMeta };
          merged.__docPath = currentIsVendor ? currentPath : existingPath;
          merged.__docSegments = currentIsVendor
            ? productWithMeta.__docSegments
            : existing.__docSegments;
          seenById.set(data.id, merged);
        }
      });
    };

    try {
      const snapshot = await getDocs(collection(db, "vendor_products"));
      addSnapshotDocs(snapshot);
    } catch (err) {
      console.warn("Lecture vendor_products (racine) indisponible.", err);
    }

    for (const vendorId of vendorIdentifiers) {
      try {
        const nestedSnapshot = await getDocs(
          collection(db, "vendor_products", vendorId, "products")
        );
        addSnapshotDocs(nestedSnapshot, { vendorIdFromPath: vendorId });
      } catch (err) {
        if (
          err?.code !== "permission-denied" &&
          err?.code !== "not-found" &&
          err?.code !== "failed-precondition"
        ) {
          console.warn(
            `Lecture vendor_products/${vendorId}/products impossible.`,
            err
          );
        }
      }
    }

    try {
      const legacySnapshot = await getDocs(collection(db, "products"));
      addSnapshotDocs(legacySnapshot);
    } catch (err) {
      console.warn("Lecture de la collection legacy products indisponible.", err);
    }

    const list = Array.from(seenById.values());
    list.sort((a, b) => getProductSortValue(b) - getProductSortValue(a));

    return list;
  }, [vendorIdentifiers, matchesVendorProduct]);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      if (!vendor) {
        setProducts([]);
        setProductsLoading(false);
        setProductsError(null);
        return;
      }

      if (vendorIdentifiers.length === 0) {
        setProducts([]);
        setProductsLoading(false);
        setProductsError(null);
        return;
      }

      setProductsLoading(true);

      try {
        const fetched = await fetchProductsForVendor();
        if (!cancelled) {
          setProducts(fetched);
          setProductsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Erreur de recuperation des produits vendeur:", err);
          setProducts([]);
          setProductsError(
            "Impossible de charger les produits du vendeur."
          );
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [vendor, vendorIdentifiers, fetchProductsForVendor]);

  const refreshProducts = useCallback(async () => {
    try {
      const fetched = await fetchProductsForVendor();
      setProducts(fetched);
      setProductsError(null);
    } catch (err) {
      console.error("Erreur de rafraichissement des produits vendeur:", err);
      setProductsError(
        "Impossible de rafraichir les produits du vendeur."
      );
    }
  }, [fetchProductsForVendor]);

  const syncLegacyProductDoc = useCallback(async (product, payload) => {
    if (!product?.id) return;
    if (
      typeof product?.__docPath === "string" &&
      product.__docPath.startsWith("products")
    ) {
      return;
    }
    if (
      Array.isArray(product?.__docSegments) &&
      product.__docSegments[0] === "products"
    ) {
      return;
    }
    try {
      await updateDoc(doc(db, "products", product.id), payload);
    } catch (err) {
      if (err?.code !== "not-found") {
        console.warn("Mise a jour du produit legacy impossible:", err);
      }
    }
  }, []);

  const blockProductsForVendor = useCallback(
    async (targetProducts) => {
      if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
        return 0;
      }

      const chunkSize = 400;
      let processed = 0;

      const legacyUpdates = [];

      for (let index = 0; index < targetProducts.length; index += chunkSize) {
        const chunk = targetProducts.slice(index, index + chunkSize);
        const batch = writeBatch(db);
        const timestamp = serverTimestamp();

        chunk.forEach((product) => {
          const productRef = getPrimaryProductDocRef(product, db);
          const payload = {
            mm_status: false,
            "core.mm_status": false,
            "draft.core.mm_status": false,
            updatedAt: timestamp,
            "core.updatedAt": timestamp,
            "draft.core.updatedAt": timestamp,
          };

          batch.update(productRef, payload);
          legacyUpdates.push({ product, payload });
        });

        await batch.commit();
        processed += chunk.length;
      }

      await Promise.all(
        legacyUpdates.map(({ product, payload }) =>
          syncLegacyProductDoc(product, payload)
        )
      );

      return processed;
    },
    [syncLegacyProductDoc]
  );

  const reactivateProductsForVendor = useCallback(async (targetProducts) => {
    if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
      return 0;
    }

    const chunkSize = 400;
    let processed = 0;
    const legacyUpdates = [];

    for (let index = 0; index < targetProducts.length; index += chunkSize) {
      const chunk = targetProducts.slice(index, index + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach((product) => {
        const productRef = getPrimaryProductDocRef(product, db);
        const updateTimestamp = serverTimestamp();
        const payload = {
          mm_status: true,
          "core.mm_status": true,
          "draft.core.mm_status": true,
          updatedAt: updateTimestamp,
          "core.updatedAt": updateTimestamp,
          "draft.core.updatedAt": updateTimestamp,
        };

        batch.update(productRef, payload);
        legacyUpdates.push({ product, payload });
      });

      await batch.commit();
      processed += chunk.length;
    }

    await Promise.all(
      legacyUpdates.map(({ product, payload }) =>
        syncLegacyProductDoc(product, payload)
      )
    );

    return processed;
  }, [syncLegacyProductDoc]);

  const updatePublicProductsForVendor = useCallback(
    async (enabled) => {
      if (!vendorIdentifiers.length) return 0;
      const candidates = vendorIdentifiers.filter(
        (value) => typeof value === "string" && value.trim()
      );
      if (!candidates.length) return 0;

      const chunkSize = 10;
      let processed = 0;
      const timestamp = serverTimestamp();
      const updates = {
        mm_status: enabled,
        active: enabled,
        isActive: enabled,
        updatedAt: timestamp,
      };

      for (let i = 0; i < candidates.length; i += chunkSize) {
        const chunk = candidates.slice(i, i + chunkSize);
        const [byVendorId, byCoreVendorId] = await Promise.all([
          getDocs(
            query(
              collection(db, "products_public"),
              where("vendorId", "in", chunk)
            )
          ),
          getDocs(
            query(
              collection(db, "products_public"),
              where("core.vendorId", "in", chunk)
            )
          ),
        ]);

        const docs = new Map();
        byVendorId.forEach((docSnap) => docs.set(docSnap.id, docSnap));
        byCoreVendorId.forEach((docSnap) => docs.set(docSnap.id, docSnap));
        if (!docs.size) continue;

        const batch = writeBatch(db);
        docs.forEach((docSnap) => batch.update(docSnap.ref, updates));
        await batch.commit();
        processed += docs.size;
      }

      return processed;
    },
    [vendorIdentifiers]
  );

  const fetchPublicProductSnapshotsForVendor = useCallback(async () => {
    if (!vendorIdentifiers.length) return [];
    const candidates = vendorIdentifiers.filter(
      (value) => typeof value === "string" && value.trim()
    );
    if (!candidates.length) return [];

    const chunkSize = 10;
    const docsByPath = new Map();

    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      const [byVendorId, byCoreVendorId] = await Promise.all([
        getDocs(
          query(
            collection(db, "products_public"),
            where("vendorId", "in", chunk)
          )
        ),
        getDocs(
          query(
            collection(db, "products_public"),
            where("core.vendorId", "in", chunk)
          )
        ),
      ]);

      byVendorId.forEach((docSnap) => docsByPath.set(docSnap.ref.path, docSnap));
      byCoreVendorId.forEach((docSnap) => docsByPath.set(docSnap.ref.path, docSnap));
    }

    return Array.from(docsByPath.values());
  }, [vendorIdentifiers]);

  const fetchVendorProductSnapshotsForDeletion = useCallback(async () => {
    if (!vendorIdentifiers.length) return [];
    const candidates = vendorIdentifiers.filter(
      (value) => typeof value === "string" && value.trim()
    );
    if (!candidates.length) return [];

    const docsByPath = new Map();
    const addSnapshotDocs = (snapshot) => {
      snapshot?.forEach((docSnap) => docsByPath.set(docSnap.ref.path, docSnap));
    };

    for (const vendorId of candidates) {
      try {
        const nestedSnapshot = await getDocs(
          collection(db, "vendor_products", vendorId, "products")
        );
        addSnapshotDocs(nestedSnapshot);
      } catch (err) {
        if (
          err?.code !== "permission-denied" &&
          err?.code !== "not-found" &&
          err?.code !== "failed-precondition"
        ) {
          console.warn(
            `Lecture vendor_products/${vendorId}/products impossible.`,
            err
          );
        }
      }
    }

    const rootFields = [
      "vendorId",
      "core.vendorId",
      "draft.core.vendorId",
      "vendorUid",
      "vendorUID",
      "vendor_id",
      "userId",
      "ownerId",
    ];
    const chunkSize = 10;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      for (const field of rootFields) {
        try {
          const snapshot = await getDocs(
            query(collection(db, "vendor_products"), where(field, "in", chunk))
          );
          addSnapshotDocs(snapshot);
        } catch (err) {
          if (
            err?.code !== "permission-denied" &&
            err?.code !== "not-found" &&
            err?.code !== "failed-precondition"
          ) {
            console.warn(
              `Lecture vendor_products via ${field} impossible.`,
              err
            );
          }
        }
      }
    }

    return Array.from(docsByPath.values());
  }, [vendorIdentifiers]);

  const blockedProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product?.blocked === true ||
          product?.status === false ||
          product?.status === "archived" ||
          product?.core?.status === "archived" ||
          product?.core?.blocked === true ||
          product?.draft?.core?.status === "archived" ||
          product?.draft?.core?.blocked === true ||
          product?.active === false ||
          product?.isActive === false ||
          product?.core?.active === false ||
          product?.core?.isActive === false ||
          product?.draft?.core?.active === false ||
          product?.draft?.core?.isActive === false ||
          product?.mm_status === false ||
          product?.core?.mm_status === false ||
          product?.draft?.core?.mm_status === false
      ),
    [products]
  );

  const handleCaptureLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator?.geolocation) {
      setLocationError(
        "La geolocalisation n'est pas supportee sur cet appareil."
      );
      return;
    }

    setLocationFallback(null);
    setFetchingLocation(true);
    setLocationError(null);
    setLocationMessage(null);

    const onSuccess = (position, message = "Coordonnees recuperees.") => {
      const {
        accuracy,
        altitude,
        altitudeAccuracy,
        heading,
        latitude,
        longitude,
        speed,
      } = position.coords;
      setApprovalLocation({
        latitude,
        longitude,
        accuracy: typeof accuracy === "number" ? accuracy : null,
        altitude: typeof altitude === "number" ? altitude : null,
        altitudeAccuracy:
          typeof altitudeAccuracy === "number" ? altitudeAccuracy : null,
        heading: typeof heading === "number" ? heading : null,
        speed: typeof speed === "number" ? speed : null,
        timestamp: position.timestamp || Date.now(),
      });
      setLocationMessage(message);
      setFetchingLocation(false);
    };

    const finalizeError = (error) => {
      let message = "Impossible de récupérer la position.";
      if (error) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Autorisez l'acces a la localisation pour continuer.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Les informations de localisation sont indisponibles.";
            break;
          case error.TIMEOUT:
            message =
              "La recuperation de la position a expire. Activez la localisation puis reessayez.";
            break;
          default:
            break;
        }
      }
      setFetchingLocation(false);
      setLocationMessage(null);
      setLocationError(message);
    };

    const attemptFallback = () => {
      // Essaye une localisation plus tolérante (moins précise) si la version haute précision échoue.
      navigator.geolocation.getCurrentPosition(
        (position) => onSuccess(position, "Coordonnees recuperees (precision standard)."),
        (fallbackError) => finalizeError(fallbackError),
        {
          enableHighAccuracy: false,
          maximumAge: 300000, // accepte une position cachee jusqu'a 5 minutes
          timeout: 20000, // laisse plus de temps sur reseaux lents
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (position) => onSuccess(position),
      (error) => {
        if (
          error &&
          (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)
        ) {
          attemptFallback();
          return;
        }
        finalizeError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }, []);

  const handleApproveVendor = useCallback(async () => {
    if (!vendor?.id) return false;
    if (!approvalLocation && !locationFallback) {
      setActionError(
        "Veuillez recuperer les coordonnees avant de valider le vendeur."
      );
      return false;
    }
    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      const timestamp = serverTimestamp();
      const vendorRef = doc(db, "vendors", vendor.id);
      const updates = {
        status: "approved",
        approved: true,
        vendorStatus: "approved",
        "profile.status": "approved",
        approvedAt: timestamp,
        blocked: false,
        "profile.blocked": false,
        active: true,
        isActive: true,
        "profile.active": true,
        "profile.isActive": true,
        lockCatalog: false,
        lockEdits: false,
        "profile.lockCatalog": false,
        "profile.lockEdits": false,
        blockedAt: deleteField(),
        blockedReason: deleteField(),
        blockedBy: deleteField(),
        blockedByUid: deleteField(),
        updatedAt: timestamp,
        "profile.blockedAt": deleteField(),
        "profile.blockedReason": deleteField(),
        "profile.blockedBy": deleteField(),
        "profile.blockedByUid": deleteField(),
      };

      if (auth.currentUser?.email) {
        updates.approvedBy = auth.currentUser.email;
      }
      if (auth.currentUser?.uid) {
        updates.approvedByUid = auth.currentUser.uid;
      }

      if (approvalLocation) {
        const locationPayload = {
          latitude: approvalLocation.latitude,
          longitude: approvalLocation.longitude,
        };
        if (typeof approvalLocation.accuracy === "number") {
          locationPayload.accuracy = approvalLocation.accuracy;
        }
        if (typeof approvalLocation.altitude === "number") {
          locationPayload.altitude = approvalLocation.altitude;
        }
        if (typeof approvalLocation.altitudeAccuracy === "number") {
          locationPayload.altitudeAccuracy = approvalLocation.altitudeAccuracy;
        }
        if (typeof approvalLocation.heading === "number") {
          locationPayload.heading = approvalLocation.heading;
        }
        if (typeof approvalLocation.speed === "number") {
          locationPayload.speed = approvalLocation.speed;
        }
        if (approvalLocation.timestamp) {
          locationPayload.capturedAt = approvalLocation.timestamp;
        }
        updates.approvedCoordinates = locationPayload;
      } else if (locationFallback) {
        updates.approvedCoordinatesNote = locationFallback;
      }

      await updateDoc(vendorRef, updates);
      setActionMessage("Le vendeur a ete valide.");
      success = true;
    } catch (err) {
      console.error("Erreur validation vendeur:", err);
      setActionError(
        "Impossible de valider le vendeur pour le moment."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [vendor, approvalLocation, locationFallback]);

  const handleBlockVendor = useCallback(
    async (reason) => {
      if (!vendor?.id) return false;
      if (isProtectedVendor) {
        setActionError(
          "Le compte Monmarche est protege et ne peut pas etre bloque."
        );
        return false;
      }
      setActionBusy(true);
      setActionError(null);
      let success = false;

      try {
        const timestamp = serverTimestamp();
        const vendorRef = doc(db, "vendors", vendor.id);
        const adminEmail = auth.currentUser?.email ?? null;
        const adminUid = auth.currentUser?.uid ?? null;
        const normalizedReason = reason?.trim();
        const preBlockSnapshot = {
          status: vendor?.status ?? vendor?.vendorStatus ?? null,
          vendorStatus: vendor?.vendorStatus ?? vendor?.status ?? null,
          profileStatus: vendor?.profile?.status ?? null,
          active: vendor?.active ?? null,
          isActive: vendor?.isActive ?? null,
          profileActive: vendor?.profile?.active ?? null,
          profileIsActive: vendor?.profile?.isActive ?? null,
          lockCatalog: vendor?.lockCatalog ?? null,
          lockEdits: vendor?.lockEdits ?? null,
          profileLockCatalog: vendor?.profile?.lockCatalog ?? null,
          profileLockEdits: vendor?.profile?.lockEdits ?? null,
        };
        const updates = {
          status: "blocked",
          vendorStatus: "blocked",
          "profile.status": "blocked",
          blocked: true,
          "profile.blocked": true,
          active: false,
          isActive: false,
          lockCatalog: true,
          lockEdits: true,
          blockedAt: timestamp,
          updatedAt: timestamp,
          "profile.blockedAt": timestamp,
          "profile.lockCatalog": true,
          "profile.lockEdits": true,
          "profile.active": false,
          "profile.isActive": false,
          preBlockSnapshot,
        };

        if (adminEmail) {
          updates.blockedBy = adminEmail;
          updates["profile.blockedBy"] = adminEmail;
        } else {
          updates.blockedBy = "admin";
          updates["profile.blockedBy"] = "admin";
        }

        if (adminUid) {
          updates.blockedByUid = adminUid;
          updates["profile.blockedByUid"] = adminUid;
        }

        if (normalizedReason) {
          updates.blockedReason = normalizedReason;
          updates["profile.blockedReason"] = normalizedReason;
        } else {
          updates.blockedReason = deleteField();
          updates["profile.blockedReason"] = deleteField();
          updates["profile.blockedByUid"] = deleteField();
        }

        await updateDoc(vendorRef, updates);

        const targetProducts =
          products.length > 0
            ? products
            : await fetchProductsForVendor();

        const updatedCount = await blockProductsForVendor(
          targetProducts,
          normalizedReason
        );
        const publicCount = await updatePublicProductsForVendor(false);

        if (updatedCount > 0) {
          setActionMessage(
            `Le vendeur a ete bloque et ${updatedCount} produit(s) ont ete desactives.`
          );
        } else {
          setActionMessage("Le vendeur a ete bloque.");
        }
        if (publicCount > 0) {
          setActionMessage(
            `Le vendeur a ete bloque et ${publicCount} produit(s) publics ont ete masques.`
          );
        }

        await refreshProducts();
        success = true;
      } catch (err) {
        console.error("Erreur blocage vendeur:", err);
        setActionError(
          "Impossible de bloquer le vendeur. Merci de reessayer."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [
      vendor,
      isProtectedVendor,
      products,
      fetchProductsForVendor,
      blockProductsForVendor,
      refreshProducts,
      updatePublicProductsForVendor,
    ]
  );

  const handleUnblockVendor = useCallback(async () => {
    if (!vendor?.id) return false;
    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      const timestamp = serverTimestamp();
      const vendorRef = doc(db, "vendors", vendor.id);
      const preBlock = vendor?.preBlockSnapshot || vendor?.profile?.preBlockSnapshot || {};
      const restoreValue = (value, fallback) =>
        value === undefined || value === null ? fallback : value;
      const restored = {
        status: restoreValue(preBlock.status, "under_review"),
        vendorStatus: restoreValue(preBlock.vendorStatus, "under_review"),
        "profile.status": restoreValue(preBlock.profileStatus, "under_review"),
        active: restoreValue(preBlock.active, true),
        isActive: restoreValue(preBlock.isActive, true),
        "profile.active": restoreValue(preBlock.profileActive, true),
        "profile.isActive": restoreValue(preBlock.profileIsActive, true),
        lockCatalog: restoreValue(preBlock.lockCatalog, false),
        lockEdits: restoreValue(preBlock.lockEdits, false),
        "profile.lockCatalog": restoreValue(preBlock.profileLockCatalog, false),
        "profile.lockEdits": restoreValue(preBlock.profileLockEdits, false),
      };
      await updateDoc(vendorRef, {
        ...restored,
        blocked: false,
        "profile.blocked": false,
        blockedAt: deleteField(),
        blockedReason: deleteField(),
        blockedBy: deleteField(),
        blockedByUid: deleteField(),
        updatedAt: timestamp,
        "profile.blockedAt": deleteField(),
        "profile.blockedReason": deleteField(),
        "profile.blockedBy": deleteField(),
        "profile.blockedByUid": deleteField(),
        preBlockSnapshot: deleteField(),
      });

      setActionMessage(
        "Le vendeur a ete debloque. Les valeurs precedentes ont ete restaurees."
      );
      await updatePublicProductsForVendor(true);
      success = true;
    } catch (err) {
      console.error("Erreur deblocage vendeur:", err);
      setActionError(
        "Impossible de debloquer le vendeur pour le moment."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [vendor, updatePublicProductsForVendor]);

  const handleArchiveAndDeleteVendor = useCallback(
    async (reason) => {
      if (!vendor?.id) return false;
      if (isProtectedVendor) {
        setActionError(
          "Le compte Monmarche est protege et ne peut pas etre supprime."
        );
        return false;
      }
      if (!isBlocked) {
        setActionError(
          "La suppression est autorisee uniquement pour un vendeur bloque."
        );
        return false;
      }

      setActionBusy(true);
      setActionError(null);
      setActionMessage(null);
      let success = false;

      try {
        const normalizedReason = reason?.trim();
        if (!normalizedReason) {
          setActionError("Le motif de suppression est obligatoire.");
          return false;
        }

        const actorEmail = auth.currentUser?.email ?? null;
        const actorUid = auth.currentUser?.uid ?? null;
        const actor = actorEmail || actorUid || "admin";
        const deletedVendorRef = doc(db, "deletedVendors", vendor.id);

        const vendorProductSnapshots =
          await fetchVendorProductSnapshotsForDeletion();
        const publicProductSnapshots =
          await fetchPublicProductSnapshotsForVendor();

        const archiveEntries = [];

        const archivedVendorPayload = {
          ...sanitizeForFirestore(vendor),
          archivedFromPath: `vendors/${vendor.id}`,
          archivedAt: serverTimestamp(),
          archivedBy: actor,
          deletedAt: serverTimestamp(),
          deletedBy: actor,
          deletedByEmail: actorEmail,
          deletedByUid: actorUid,
          deleteReason: normalizedReason,
          archivedVendorProductsCount: vendorProductSnapshots.length,
          deletedPublicProductsCount: publicProductSnapshots.length,
        };
        archiveEntries.push({
          ref: deletedVendorRef,
          payload: archivedVendorPayload,
        });

        const refsToDeleteByPath = new Map();
        const addDeleteRef = (ref) => {
          if (!ref?.path) return;
          refsToDeleteByPath.set(ref.path, ref);
        };

        vendorProductSnapshots.forEach((docSnap, index) => {
          const sourcePath = docSnap.ref.path;
          addDeleteRef(docSnap.ref);

          const archiveDocId = buildArchivedDocId(
            sourcePath,
            `vendor_products_${index}`
          );
          const archiveRef = doc(
            db,
            "deletedVendors",
            vendor.id,
            "products",
            archiveDocId
          );

          archiveEntries.push({
            ref: archiveRef,
            payload: {
              ...sanitizeForFirestore({ id: docSnap.id, ...docSnap.data() }),
              archivedAt: serverTimestamp(),
              archivedBy: actor,
              deletedAt: serverTimestamp(),
              deletedBy: actor,
              deletedByEmail: actorEmail,
              deletedByUid: actorUid,
              deleteReason: normalizedReason,
              archivedFromPath: sourcePath,
              archivedFromCollection: "vendor_products",
              originalProductId: docSnap.id,
            },
          });
        });

        publicProductSnapshots.forEach((docSnap) => {
          addDeleteRef(docSnap.ref);
        });

        vendorIdentifiers
          .filter((value) => typeof value === "string" && value.trim())
          .forEach((value) => {
            addDeleteRef(doc(db, "vendor_products", value));
          });

        const archiveChunkSize = 350;
        for (let i = 0; i < archiveEntries.length; i += archiveChunkSize) {
          const chunk = archiveEntries.slice(i, i + archiveChunkSize);
          const batch = writeBatch(db);
          chunk.forEach(({ ref, payload }) => {
            batch.set(ref, payload, { merge: true });
          });
          await batch.commit();
        }

        addDeleteRef(doc(db, "vendors", vendor.id));
        const refsToDelete = Array.from(refsToDeleteByPath.values());
        const deleteChunkSize = 450;
        for (let i = 0; i < refsToDelete.length; i += deleteChunkSize) {
          const chunk = refsToDelete.slice(i, i + deleteChunkSize);
          const batch = writeBatch(db);
          chunk.forEach((ref) => batch.delete(ref));
          await batch.commit();
        }

        success = true;
        window.alert(
          "Le vendeur et tous ses produits ont ete supprimes de l'application."
        );
        navigate("/vendors");
      } catch (err) {
        console.error("Erreur suppression archivee vendeur:", err);
        setActionError(
          "Impossible d'archiver puis supprimer ce vendeur pour le moment."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [
      vendor,
      isBlocked,
      isProtectedVendor,
      vendorIdentifiers,
      fetchVendorProductSnapshotsForDeletion,
      fetchPublicProductSnapshotsForVendor,
      navigate,
    ]
  );

  const handlePartnerToggle = useCallback(
    async (enabled) => {
      if (!vendor?.id) return;
      setActionBusy(true);
      setActionError(null);
      setActionMessage(null);
      try {
        const timestamp = serverTimestamp();
        const vendorRef = doc(db, "vendors", vendor.id);
        await updateDoc(vendorRef, {
          isPartner: enabled,
          partner: enabled,
          "profile.isPartner": enabled,
          "profile.partner": enabled,
          updatedAt: timestamp,
          "profile.updatedAt": timestamp,
        });
        setActionMessage(
          enabled
            ? "Vendeur marque comme partenaire."
            : "Vendeur retire des partenaires."
        );
      } catch (err) {
        console.error("Partner toggle failed:", err);
        setActionError("Impossible de mettre a jour le statut partenaire.");
      } finally {
        setActionBusy(false);
      }
    },
    [vendor]
  );

  const openPartnerConfirm = (enabled) => {
    setPartnerConfirm({ open: true, enabled });
  };

  const closePartnerConfirm = () => {
    setPartnerConfirm({ open: false, enabled: false });
  };

  const handleBlockAllProducts = useCallback(
    async (reason) => {
      setActionBusy(true);
      setActionError(null);
      let success = false;

      try {
        const normalizedReason = reason?.trim();
        const targetProducts =
          products.length > 0
            ? products
            : await fetchProductsForVendor();

        if (targetProducts.length === 0) {
          setActionMessage("Aucun produit associe a ce vendeur.");
          success = true;
        } else {
          const updatedCount = await blockProductsForVendor(
            targetProducts,
            normalizedReason
          );
          setActionMessage(
            `${updatedCount} produit(s) ont ete bloques.`
          );
          await refreshProducts();
          success = true;
        }
      } catch (err) {
        console.error("Erreur blocage produits:", err);
        setActionError(
          "Impossible de bloquer les produits du vendeur."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [products, fetchProductsForVendor, blockProductsForVendor, refreshProducts]
  );

  const handleReactivateAllProducts = useCallback(async () => {
    setActionBusy(true);
    setActionError(null);
    let success = false;

    try {
      let targetProducts = blockedProducts;
      if (targetProducts.length === 0) {
        const fetched = await fetchProductsForVendor();
        targetProducts = fetched.filter(
          (product) =>
            product?.blocked === true || product?.status === false
        );
      }

      if (targetProducts.length === 0) {
        setActionMessage("Aucun produit bloque pour ce vendeur.");
        success = true;
      } else {
        const updatedCount = await reactivateProductsForVendor(
          targetProducts
        );
        setActionMessage(
          `${updatedCount} produit(s) ont ete reactives.`
        );
        await refreshProducts();
        success = true;
      }
    } catch (err) {
      console.error("Erreur reactivation produits:", err);
      setActionError(
        "Impossible de reactiver les produits du vendeur."
      );
    } finally {
      setActionBusy(false);
    }

    return success;
  }, [blockedProducts, fetchProductsForVendor, reactivateProductsForVendor, refreshProducts]);

  const handleToggleProduct = useCallback(
    async (product, shouldBlock, reason) => {
      if (!product?.id) return false;
      setActionBusy(true);
      setActionError(null);
      let success = false;
      const productLabel = getProductLabel(product) || product?.id;

      try {
        const productRef = getPrimaryProductDocRef(product, db);
        if (shouldBlock) {
          const timestamp = serverTimestamp();
          const adminEmail = auth.currentUser?.email ?? null;
          const adminUid = auth.currentUser?.uid ?? null;
          const normalizedReason = reason?.trim();

          const payload = {
            status: "archived",
            blocked: true,
            published: false,
            homePage: false,
            blockedAt: timestamp,
            updatedAt: timestamp,
          };

          payload.active = false;
          payload.isActive = false;
          payload["profile.blocked"] = true;
          payload["profile.active"] = false;
          payload["profile.isActive"] = false;
          payload["core.status"] = "archived";
          payload["core.active"] = false;
          payload["core.isActive"] = false;
          payload["core.blocked"] = true;
          payload["draft.core.status"] = "archived";
          payload["draft.core.active"] = false;
          payload["draft.core.isActive"] = false;
          payload["draft.core.blocked"] = true;
          payload["draft.core.published"] = false;
          payload["core.updatedAt"] = timestamp;
          payload["draft.core.updatedAt"] = timestamp;
          payload["draft.updatedAt"] = timestamp;

          if (adminEmail) {
            payload.blockedBy = adminEmail;
            payload["profile.blockedBy"] = adminEmail;
            payload["core.blockedBy"] = adminEmail;
            payload["draft.core.blockedBy"] = adminEmail;
          } else {
            payload.blockedBy = "admin";
            payload["profile.blockedBy"] = "admin";
            payload["core.blockedBy"] = "admin";
            payload["draft.core.blockedBy"] = "admin";
          }

          if (adminUid) {
            payload.blockedByUid = adminUid;
            payload["profile.blockedByUid"] = adminUid;
            payload["core.blockedByUid"] = adminUid;
            payload["draft.core.blockedByUid"] = adminUid;
          }

          if (normalizedReason) {
            payload.blockedReason = normalizedReason;
            payload["profile.blockedReason"] = normalizedReason;
            payload["core.blockedReason"] = normalizedReason;
            payload["draft.core.blockedReason"] = normalizedReason;
          } else {
            payload.blockedReason = deleteField();
            payload["profile.blockedReason"] = deleteField();
            payload["core.blockedReason"] = deleteField();
            payload["draft.core.blockedReason"] = deleteField();
            payload["profile.blockedByUid"] = deleteField();
            payload["core.blockedByUid"] = deleteField();
            payload["draft.core.blockedByUid"] = deleteField();
          }

          await updateDoc(productRef, payload);
          await syncLegacyProductDoc(product, payload);
          setActionMessage(
            `Le produit "${productLabel}" a ete bloque.`
          );
        } else {
          const updateTimestamp = serverTimestamp();
          const payload = {
            status: "active",
            updatedAt: updateTimestamp,
            blocked: false,
            published: true,
            blockedAt: deleteField(),
            blockedBy: deleteField(),
            blockedByUid: deleteField(),
            blockedReason: deleteField(),
            "profile.blockedBy": deleteField(),
            "profile.blockedByUid": deleteField(),
            "profile.blockedReason": deleteField(),
            "core.blockedBy": deleteField(),
            "core.blockedByUid": deleteField(),
            "core.blockedReason": deleteField(),
            "draft.core.blockedBy": deleteField(),
            "draft.core.blockedByUid": deleteField(),
            "draft.core.blockedReason": deleteField(),
          };

          payload.active = true;
          payload.isActive = true;
          payload["profile.blocked"] = false;
          payload["profile.active"] = true;
          payload["profile.isActive"] = true;
          payload["core.status"] = "active";
          payload["core.active"] = true;
          payload["core.isActive"] = true;
          payload["core.blocked"] = false;
          payload["draft.core.status"] = "active";
          payload["draft.core.active"] = true;
          payload["draft.core.isActive"] = true;
          payload["draft.core.blocked"] = false;
          payload["draft.core.published"] = true;
          payload["core.updatedAt"] = updateTimestamp;
          payload["draft.core.updatedAt"] = updateTimestamp;
          payload["draft.updatedAt"] = updateTimestamp;

          await updateDoc(productRef, payload);
          await syncLegacyProductDoc(product, payload);
          setActionMessage(
            `Le produit "${productLabel}" a ete reactive.`
          );
        }

        await refreshProducts();
        success = true;
      } catch (err) {
        console.error("Erreur mise a jour produit:", err);
        setActionError(
          "Impossible de mettre a jour le produit. Merci de reessayer."
        );
      } finally {
        setActionBusy(false);
      }

      return success;
    },
    [refreshProducts, syncLegacyProductDoc]
  );

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => {
      setActionMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => {
      setActionError(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    if (!locationMessage) return;
    const timer = setTimeout(() => {
      setLocationMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [locationMessage]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogReason("");
    setDialogValidationError("");
  }, []);

  const openDialog = useCallback((payload) => {
    setDialogReason("");
    setDialogValidationError("");
    setDialog(payload);
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;
    const reason = dialogReason.trim();
    const reasonRequired = dialog.type === "deleteVendor";
    if (reasonRequired && !reason) {
      setDialogValidationError("Le motif de suppression est obligatoire.");
      return;
    }
    setDialogValidationError("");
    let success = false;

    switch (dialog.type) {
      case "approveVendor":
        success = await handleApproveVendor();
        break;
      case "blockVendor":
        success = await handleBlockVendor(reason);
        break;
      case "unblockVendor":
        success = await handleUnblockVendor();
        break;
      case "blockAllProducts":
        success = await handleBlockAllProducts(reason);
        break;
      case "reactivateAllProducts":
        success = await handleReactivateAllProducts();
        break;
      case "blockProduct":
        if (dialog.product) {
          success = await handleToggleProduct(dialog.product, true, reason);
        }
        break;
      case "reactivateProduct":
        if (dialog.product) {
          success = await handleToggleProduct(dialog.product, false);
        }
        break;
      case "deleteVendor":
        success = await handleArchiveAndDeleteVendor(reason);
        break;
      default:
        break;
    }

    if (success) {
      closeDialog();
    }
  }, [
    dialog,
    dialogReason,
    setDialogValidationError,
    handleApproveVendor,
    handleBlockVendor,
    handleUnblockVendor,
    handleBlockAllProducts,
    handleReactivateAllProducts,
    handleToggleProduct,
    handleArchiveAndDeleteVendor,
    closeDialog,
  ]);

  const dialogRequiresReason =
    dialog &&
    (dialog.type === "blockVendor" ||
      dialog.type === "blockProduct" ||
      dialog.type === "blockAllProducts" ||
      dialog.type === "deleteVendor");
  const dialogReasonRequired = dialog?.type === "deleteVendor";

  const dialogProductLabel =
    dialog?.product && getProductLabel(dialog.product)
      ? getProductLabel(dialog.product)
      : dialog?.product?.id ?? "";

  const dialogTitle = (() => {
    if (!dialog) return "";
    switch (dialog.type) {
      case "approveVendor":
        return "Valider le vendeur";
      case "blockVendor":
        return "Bloquer le vendeur";
      case "unblockVendor":
        return "Debloquer le vendeur";
      case "blockAllProducts":
        return "Bloquer tous les produits";
      case "reactivateAllProducts":
        return "Reactiver tous les produits";
      case "blockProduct":
        return `Bloquer le produit${dialogProductLabel ? ` : ${dialogProductLabel}` : ""}`;
      case "reactivateProduct":
        return `Reactiver le produit${dialogProductLabel ? ` : ${dialogProductLabel}` : ""}`;
      case "deleteVendor":
        return "Supprimer le vendeur";
      default:
        return "";
    }
  })();

  const dialogDescription = (() => {
    if (!dialog) return "";
    switch (dialog.type) {
      case "approveVendor":
        return "Confirmez la validation de ce dossier vendeur.";
      case "blockVendor":
        return "Le vendeur ne pourra plus se connecter et ses produits seront desactives.";
      case "unblockVendor":
        return "Le statut du vendeur repassera en revue et il pourra a nouveau etre active.";
      case "blockAllProducts":
        return "Tous les produits associes a ce vendeur deviendront inactifs.";
      case "reactivateAllProducts":
        return "Tous les produits bloques seront reactives.";
      case "blockProduct":
        return "Ce produit sera immediatement indisponible pour les clients.";
      case "reactivateProduct":
        return "Ce produit redeviendra visible sur la plateforme.";
      case "deleteVendor":
        return "Cette action est irreversible. Le vendeur sera archive dans deletedVendors puis supprime des collections actives.";
      default:
        return "";
    }
  })();

  const dialogConfirmLabel = (() => {
    if (!dialog) return "Confirmer";
    switch (dialog.type) {
      case "approveVendor":
        return "Valider";
      case "blockVendor":
      case "blockAllProducts":
      case "blockProduct":
        return "Bloquer";
      case "unblockVendor":
        return "Debloquer";
      case "reactivateAllProducts":
      case "reactivateProduct":
        return "Reactiver";
      case "deleteVendor":
        return "Supprimer";
      default:
        return "Confirmer";
    }
  })();

  const hasProducts = products.length > 0;
  const hasBlockedProducts = blockedProducts.length > 0;
  const canModerateProducts = vendorIdentifiers.length > 0;
  const isPartner = useMemo(
    () => getPartnerFlag(vendor, profile),
    [vendor, profile]
  );

  const statusHistory = useMemo(() => {
    if (!vendor) return [];
    return [
      {
        label: "Soumis le",
        value:
          formatDateTime(
            profile?.submittedAt ??
              vendor?.submittedAt ??
              vendor?.createdAt ??
              vendor?.timeStamp
          ),
      },
      {
        label: "Approuvé le",
        value: formatDateTime(profile?.approvedAt ?? vendor?.approvedAt),
      },
      {
        label: "Dernière connexion",
        value: formatDateTime(
          profile?.lastLoginAt ?? vendor?.lastLoginAt ?? vendor?.lastSignInAt
        ),
      },
      {
        label: "Statut",
        value: vendorStatus,
      },
    ];
  }, [vendor, profile, vendorStatus]);

  const stats = useMemo(() => {
    if (!vendor) return [];
    const base = [
      {
        label: "Langue",
        value:
          vendor?.language ??
          profile?.language ??
          vendor?.locale ??
          vendor?.preferredLanguage ??
          "-",
      },
      {
        label: "Étape du dossier",
        value:
          vendor?.currentStep ??
          profile?.currentStep ??
          vendor?.onboardingStep ??
          "-",
      },
      {
        label: "Verrou édition",
        value:
          profile?.lockEdits ?? vendor?.lockEdits ? "Oui" : "Non",
      },
      {
        label: "Verrou catalogue",
        value:
          profile?.lockCatalog ?? vendor?.lockCatalog ? "Oui" : "Non",
      },
      {
        label: "Documents requis",
        value:
          requiredDocs.length > 0
            ? `${requiredDocs.length} doc(s)`
            : profile?.docsRequired ?? vendor?.docsRequired
            ? "À compléter"
            : "Complet",
      },
      {
        label: "Partenaire",
        value: isPartner ? "Oui" : "Non",
      },
    ];
    return base;
  }, [vendor, profile, requiredDocs.length, isPartner]);

  if (loading) {
    return (
      <div className="vendorDetails vendorDetails--loading">
        <Sidebar />
        <div className="vendorDetailsContainer">
          <Navbar />
          <div className="vendorDetails__content">
            <p>Chargement du vendeur...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="vendorDetails vendorDetails--error">
        <Sidebar />
        <div className="vendorDetailsContainer">
          <Navbar />
          <div className="vendorDetails__content vendorDetails__content--center">
            <p>{error || "Vendeur introuvable."}</p>
            <button type="button" onClick={() => navigate(-1)}>
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vendorDetails">
      <Sidebar />
      <div className="vendorDetailsContainer">
        <Navbar />
        <div className="vendorDetails__content">
          <div className="vendorDetails__header">
            <div className="vendorDetails__headerLeft">
              <button
                type="button"
                className="vendorDetails__back"
                onClick={() => navigate(-1)}
              >
                ← Retour
              </button>
              <div className="vendorDetails__headerTitle">
                {coverUrl && (
                  <div
                    className="vendorDetails__cover"
                    onClick={() => setImagePreview(coverUrl)}
                    role="presentation"
                  >
                    <img src={coverUrl} alt="Couverture vendeur" />
                    <div className="vendorDetails__coverFade" />
                  </div>
                )}
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={`${fallbackDisplayName} logo`}
                    className="vendorDetails__logo"
                    onClick={() => setImagePreview(logoUrl)}
                  />
                )}
                <h1>{fallbackDisplayName}</h1>
              </div>
              <p>ID dossier : {vendor.id}</p>
            </div>
            <div className="vendorDetails__headerRight">
              <span className="vendorDetails__statusLabel">{vendorStatus}</span>
              {isPartner && (
                <span className="vendorDetails__partnerBadge">Partenaire</span>
              )}
            </div>
          </div>

          <section>
            <h2>Gestion du vendeur</h2>
            <div className="vendorDetails__actions">
              <div className="vendorDetails__actionGroup vendorDetails__actionGroup--primary">
                <button
                  type="button"
                  className="vendorDetails__actionButton vendorDetails__actionButton--ghost"
                  disabled={fetchingLocation}
                  onClick={handleCaptureLocation}
                >
                  {fetchingLocation
                    ? "Recuperation en cours..."
                    : "Recuperer ma position"}
                </button>
                <div className="vendorDetails__locationAlt">
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--ghost"
                    onClick={() => {
                      setApprovalLocation(null);
                      setLocationFallback("Client hors de Conakry");
                      setLocationMessage("Marqué hors de Conakry.");
                      setLocationError(null);
                    }}
                  >
                    Client hors de Conakry
                  </button>
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--ghost"
                    onClick={() => {
                      setApprovalLocation(null);
                      setLocationFallback("Pas de localisation fournie");
                      setLocationMessage("Marqué sans localisation fournie.");
                      setLocationError(null);
                    }}
                  >
                    Pas de localisation disponible
                  </button>
                </div>
                <button
                  type="button"
                  className="vendorDetails__actionButton vendorDetails__actionButton--primary"
                  disabled={actionBusy || isApproved || !approvalLocation}
                  onClick={() => openDialog({ type: "approveVendor" })}
                >
                  Valider le vendeur
                </button>
                {isBlocked ? (
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--success"
                    disabled={actionBusy}
                    onClick={() => openDialog({ type: "unblockVendor" })}
                  >
                    Debloquer le vendeur
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--danger"
                    disabled={actionBusy || !isApproved || isProtectedVendor}
                    onClick={() => openDialog({ type: "blockVendor" })}
                  >
                    Bloquer le vendeur
                  </button>
                )}
                {isPartner ? (
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--danger"
                    disabled={actionBusy}
                    onClick={() => openPartnerConfirm(false)}
                  >
                    Retirer partenaire
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--success"
                    disabled={actionBusy}
                    onClick={() => openPartnerConfirm(true)}
                  >
                    Marquer partenaire
                  </button>
                )}
                <button
                  type="button"
                  className="vendorDetails__actionButton vendorDetails__actionButton--danger"
                  disabled={actionBusy || !isBlocked || isProtectedVendor}
                  onClick={() => openDialog({ type: "deleteVendor" })}
                >
                  Supprimer le vendeur
                </button>
              </div>
              {isProtectedVendor && (
                <p className="vendorDetails__actionsMeta">
                  Ce compte Monmarche est protege et ne peut pas etre bloque ou supprime.
                </p>
              )}

              <div className="vendorDetails__actionGroup vendorDetails__actionGroup--secondary">
                <button
                  type="button"
                  className="vendorDetails__actionButton vendorDetails__actionButton--ghost"
                  disabled={
                    actionBusy || !canModerateProducts || !hasProducts || !isApproved
                  }
                  onClick={() => openDialog({ type: "blockAllProducts" })}
                >
                  Bloquer tous les produits
                </button>
                <button
                  type="button"
                  className="vendorDetails__actionButton vendorDetails__actionButton--ghost"
                  disabled={
                    actionBusy || !canModerateProducts || !hasBlockedProducts || isBlocked
                  }
                  onClick={() =>
                    openDialog({ type: "reactivateAllProducts" })
                  }
                >
                  Reactiver tous les produits
                </button>
              </div>

              {actionBusy && (
                <p className="vendorDetails__actionsMeta">Action en cours...</p>
              )}
              {approvalLocation && (
                <p className="vendorDetails__actionsMeta">
                  Coordonnees enregistrees :{" "}
                  {approvalLocation.latitude.toFixed(5)},{" "}
                  {approvalLocation.longitude.toFixed(5)}
                  {typeof approvalLocation.accuracy === "number"
                    ? ` (±${Math.round(approvalLocation.accuracy)} m)`
                    : ""}
                </p>
              )}
              {locationMessage && (
                <p className="vendorDetails__actionsFeedback vendorDetails__actionsFeedback--success">
                  {locationMessage}
                </p>
              )}
              {locationError && (
                <p className="vendorDetails__actionsFeedback vendorDetails__actionsFeedback--error">
                  {locationError}
                </p>
              )}
              {(vendor?.approvedCoordinates || vendor?.approvedCoordinatesNote) && (
                <p className="vendorDetails__actionsMeta">
                  Coordonnées validées :{" "}
                  {vendor?.approvedCoordinates
                    ? `${vendor.approvedCoordinates.latitude}, ${vendor.approvedCoordinates.longitude}${
                        vendor.approvedCoordinates.accuracy
                          ? ` (±${Math.round(vendor.approvedCoordinates.accuracy)} m)`
                          : ""
                      }`
                    : vendor?.approvedCoordinatesNote}
                </p>
              )}
              {actionError && (
                <p className="vendorDetails__actionsFeedback vendorDetails__actionsFeedback--error">
                  {actionError}
                </p>
              )}
              {actionMessage && (
                <p className="vendorDetails__actionsFeedback vendorDetails__actionsFeedback--success">
                  {actionMessage}
                </p>
              )}
            </div>
          </section>

          <section>
            <h2>Informations générales</h2>
            <div className="vendorDetails__grid vendorDetails__grid--two">
              <div>
                <h3>Entreprise</h3>
                <ul>
                  <li>
                    <strong>Nom :</strong> {company?.name ?? "-"}
                  </li>
                  <li>
                    <strong>Forme juridique :</strong>{" "}
                    {company?.legalForm ?? profile?.legalForm ?? "-"}
                  </li>
                  <li>
                    <strong>Adresse :</strong> {company?.address ?? "-"}
                  </li>
                  <li>
                    <strong>Code postal :</strong> {company?.zip ?? "-"}
                  </li>
                  <li>
                    <strong>Ville :</strong> {company?.city ?? "-"}
                  </li>
                  <li>
                    <strong>Pays :</strong> {company?.country ?? "-"}
                  </li>
                </ul>
              </div>
              <div>
                <h3>Contact</h3>
                <ul>
                  <li>
                    <strong>Représentant :</strong>{" "}
                    {company?.representative ?? "-"}
                  </li>
                  <li>
                    <strong>Email :</strong> {company?.email ?? vendor?.email ?? "-"}
                  </li>
                  <li>
                    <strong>Téléphone :</strong> {company?.phone ?? vendor?.phone ?? "-"}
                  </li>
                  <li>
                    <strong>Site web :</strong>{" "}
                    {company?.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {company.website}
                      </a>
                    ) : (
                      "-"
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2>Statut du dossier</h2>
            <div className="vendorDetails__grid vendorDetails__grid--four">
              {statusHistory.map((item) => (
                <div key={item.label} className="vendorDetails__stat">
                  <span className="vendorDetails__statLabel">{item.label}</span>
                  <span className="vendorDetails__statValue">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Résumé</h2>
            <div className="vendorDetails__grid vendorDetails__grid--four">
              {stats.map((item) => (
                <div key={item.label} className="vendorDetails__stat">
                  <span className="vendorDetails__statLabel">{item.label}</span>
                  <span className="vendorDetails__statValue">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Produits du vendeur</h2>
            <div className="vendorDetails__card vendorDetails__products">
              {productsLoading ? (
                <p>Chargement des produits...</p>
              ) : productsError ? (
                <p className="vendorDetails__productsMessage vendorDetails__productsMessage--error">
                  {productsError}
                </p>
              ) : !canModerateProducts ? (
                <p className="vendorDetails__productsMessage">
                  Aucun identifiant vendeur n'a ete trouve pour rattacher des produits.
                </p>
              ) : products.length === 0 ? (
                <p className="vendorDetails__productsMessage">
                  Aucun produit associé à ce vendeur pour le moment.
                </p>
              ) : (
                <div className="vendorDetails__productsTableWrapper">
                  <table className="vendorDetails__productsTable">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Statut</th>
                        <th>Prix</th>
                        <th>Stock</th>
                        <th>Dernière mise à jour</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const productLabel = getProductLabel(product);
                        const productStatus =
                          product?.status ??
                          product?.core?.status ??
                          product?.draft?.core?.status ??
                          null;
                        const productActive =
                          product?.active ??
                          product?.isActive ??
                          product?.core?.active ??
                          product?.core?.isActive ??
                          product?.draft?.core?.active ??
                          product?.draft?.core?.isActive;
                        const isProductBlocked =
                          product?.blocked === true ||
                          productStatus === "archived" ||
                          productActive === false;
                        let vendorStatusLabel = "Actif vendeur";
                        if (isProductBlocked) {
                          vendorStatusLabel = "Inactif vendeur";
                        } else if (productStatus === "draft") {
                          vendorStatusLabel = "Brouillon vendeur";
                        } else if (productStatus === "pending") {
                          vendorStatusLabel = "En attente vendeur";
                        } else if (
                          productStatus &&
                          !["active", "published"].includes(productStatus)
                        ) {
                          vendorStatusLabel = `${String(productStatus)} vendeur`;
                        }
                        const vendorStatusClass = isProductBlocked
                          ? "vendorDetails__statusChip--blocked"
                          : "vendorDetails__statusChip--active";
                        const adminStatusFlag = toStatusFlag(
                          product?.mm_status ??
                            product?.core?.mm_status ??
                            product?.draft?.core?.mm_status
                        );
                        const adminStatusLabel = adminStatusFlag
                          ? "Actif admin"
                          : "Inactif admin";
                        const adminStatusClass = adminStatusFlag
                          ? "vendorDetails__statusChip--active"
                          : "vendorDetails__statusChip--blocked";
                        const blockedReason =
                          product?.blockedReason ??
                          product?.core?.blockedReason ??
                          product?.draft?.core?.blockedReason ??
                          null;
                        const priceValue =
                          product?.price ??
                          product?.pricing?.basePrice ??
                          product?.core?.pricing?.basePrice ??
                          product?.draft?.core?.pricing?.basePrice;
                        const currencyValue =
                          product?.pricing?.currency ??
                          product?.core?.pricing?.currency ??
                          product?.draft?.core?.pricing?.currency ??
                          "";
                        const priceDisplay =
                          priceValue === undefined || priceValue === null
                            ? "-"
                            : `${priceValue}${currencyValue ? ` ${currencyValue}` : ""}`;
                        const stockValue =
                          product?.stock ??
                          product?.inventory?.stock ??
                          product?.core?.inventory?.stock ??
                          product?.draft?.core?.inventory?.stock ??
                          "-";
                        const lastUpdated =
                          product?.updatedAt ??
                          product?.core?.updatedAt ??
                          product?.draft?.core?.updatedAt ??
                          product?.timeStamp ??
                          product?.createdAt ??
                          product?.created_at ??
                          product?.draft?.updatedAt;
                        return (
                          <tr
                            key={product.id}
                            className={
                              isProductBlocked
                                ? "vendorDetails__productRow vendorDetails__productRow--blocked"
                                : "vendorDetails__productRow"
                            }
                          >
                            <td>
                              <div className="vendorDetails__productMain">
                                <span className="vendorDetails__productName">
                                  {productLabel || "Produit"}
                                </span>
                                {product?.product_id && (
                                  <span className="vendorDetails__productMeta">
                                    #{product.product_id}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="vendorDetails__statusColumn">
                                <span
                                  className={`vendorDetails__statusChip ${vendorStatusClass}`}
                                >
                                  {vendorStatusLabel}
                                </span>
                                <span
                                  className={`vendorDetails__statusChip ${adminStatusClass}`}
                                >
                                  {adminStatusLabel}
                                </span>
                              </div>
                              {blockedReason && (
                                <span className="vendorDetails__productReason">
                                  {blockedReason}
                                </span>
                              )}
                            </td>
                            <td>{priceDisplay}</td>
                            <td>{stockValue}</td>
                            <td>{formatDateTime(lastUpdated)}</td>
                            <td>
                              <div className="vendorDetails__productActions">
                                <Link
                                  to={`/VendorProductsList/${product.id}`}
                                  className="vendorDetails__tableButton vendorDetails__tableButton--link"
                                >
                                  Voir
                                </Link>
                                {isProductBlocked ? (
                                  <button
                                    type="button"
                                    className="vendorDetails__tableButton vendorDetails__tableButton--success"
                                    disabled={actionBusy}
                                    onClick={() =>
                                      openDialog({
                                        type: "reactivateProduct",
                                        product,
                                      })
                                    }
                                  >
                                    Activer
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="vendorDetails__tableButton vendorDetails__tableButton--danger"
                                    disabled={actionBusy}
                                    onClick={() =>
                                      openDialog({ type: "blockProduct", product })
                                    }
                                  >
                                    Bloquer
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2>Informations légales</h2>
            <div className="vendorDetails__grid vendorDetails__grid--three">
              <div className="vendorDetails__card">
                <h3>Immatriculation</h3>
                <ul>
                  <li>
                    <strong>Steuernummer :</strong>{" "}
                    {legal?.steuernummer ?? vendor?.steuernummer ?? "-"}
                  </li>
                  <li>
                    <strong>USt-IdNr :</strong> {legal?.ustIdNr ?? "-"}
                  </li>
                  <li>
                    <strong>Kleinunternehmer :</strong>{" "}
                    {legal?.kleinunternehmer ? "Oui" : "Non"}
                  </li>
                </ul>
              </div>
              <div className="vendorDetails__card">
                <h3>Documents légaux</h3>
                <ul>
                  <li>
                    <strong>Impressum :</strong>{" "}
                    {legal?.impressumUrl ? (
                      <a
                        href={legal.impressumUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Consulter
                      </a>
                    ) : (
                      "-"
                    )}
                  </li>
                  <li>
                    <strong>CGV :</strong>{" "}
                    {legal?.cgvUrl ? (
                      <a href={legal.cgvUrl} target="_blank" rel="noreferrer">
                        Consulter
                      </a>
                    ) : (
                      "-"
                    )}
                  </li>
                  <li>
                    <strong>Droit de rétractation :</strong>{" "}
                    {legal?.widerrufUrl ? (
                      <a
                        href={legal.widerrufUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Consulter
                      </a>
                    ) : (
                      "-"
                    )}
                  </li>
                </ul>
              </div>
              <div className="vendorDetails__card">
                <h3>Paiements</h3>
                <ul>
                  <li>
                    <strong>IBAN :</strong> {bank?.iban ?? "-"}
                  </li>
                  <li>
                    <strong>Orange Money :</strong> {bank?.orangeMoney ?? "-"}
                  </li>
                  <li>
                    <strong>Code marchand :</strong> {bank?.merchantCode ?? "-"}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2>Activité & opérations</h2>
            <div className="vendorDetails__grid vendorDetails__grid--two">
              <div className="vendorDetails__card">
                <h3>Produits & logistique</h3>
                <ul>
                  <li>
                    <strong>Types de produits :</strong>{" "}
                    {ops?.productTypes ?? vendor?.productTypes ?? "-"}
                  </li>
                  <li>
                    <strong>Horaires d'ouverture :</strong>{" "}
                    {ops?.openingHours ?? "-"}
                  </li>
                  <li>
                    <strong>Points de retrait :</strong>{" "}
                    {ops?.pickupAddresses ?? "-"}
                  </li>
                  <li>
                    <strong>Contact opération :</strong>{" "}
                    {ops?.opsContact ?? "-"}
                  </li>
                </ul>
              </div>
              <div className="vendorDetails__card">
                <h3>Food & conformité</h3>
                <ul>
                  <li>
                    <strong>Activité alimentaire :</strong>{" "}
                    {food?.isFoodBusiness ? "Oui" : "Non"}
                  </li>
                  <li>
                    <strong>Chaîne du froid :</strong>{" "}
                    {food?.coldChain ? "Oui" : "Non"}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2>Consentements</h2>
            <div className="vendorDetails__card">
              {consent && Object.keys(consent).length > 0 ? (
                <ul>
                  {Object.entries(consent).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key} :</strong> {value ? "Accepté" : "Refusé"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun consentement enregistré.</p>
              )}
            </div>
          </section>

          <section>
            <h2>Documents requis</h2>
            <div className="vendorDetails__card">
              {requiredDocs.length > 0 ? (
                <div className="vendorDetails__docsGrid">
                  {requiredDocs.map((docKey) => {
                    const label = REQUIRED_DOC_LABELS[docKey] || docKey;
                    const delivered = Boolean(
                      profile?.deliveredDocs?.[docKey] ?? vendor?.deliveredDocs?.[docKey]
                    );
                    return (
                      <label
                        key={docKey}
                        className={`vendorDetails__docItem ${
                          delivered ? "vendorDetails__docItem--delivered" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={delivered}
                          readOnly
                          disabled
                        />
                        <span className="vendorDetails__docLabel">{label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p>Aucun document supplémentaire requis.</p>
              )}
            </div>
          </section>

          <section>
            <h2>Informations générales</h2>
            <div className="vendorDetails__infoGrid--highlight">
              <div className="vendorDetails__infoChip">
                <span>Statut vendeur</span>
                <span>{vendorStatus}</span>
              </div>
              <div className="vendorDetails__infoChip">
                <span>Email</span>
                <span>{company?.email ?? vendor?.email ?? "-"}</span>
              </div>
              <div className="vendorDetails__infoChip">
                <span>Téléphone</span>
                <span>{company?.phone ?? vendor?.phone ?? "-"}</span>
              </div>
              <div className="vendorDetails__infoChip">
                <span>Ville</span>
                <span>{company?.city ?? vendor?.city ?? "-"}</span>
              </div>
              <div className="vendorDetails__infoChip">
                <span>Pays</span>
                <span>{company?.country ?? vendor?.country ?? "-"}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
      {dialog && (
        <div className="vendorDetails__dialogOverlay">
          <div className="vendorDetails__dialog">
            <h3>{dialogTitle}</h3>
            {dialogDescription && (
              <p className="vendorDetails__dialogDescription">
                {dialogDescription}
              </p>
            )}
            {dialog?.type === "deleteVendor" && (
              <p className="vendorDetails__dialogWarning">
                Attention: la suppression est definitive. Assurez-vous d'avoir
                verifie les informations avant de confirmer.
              </p>
            )}
            {dialogRequiresReason && (
              <div className="vendorDetails__dialogField">
                <label htmlFor="vendor-dialog-reason">
                  {dialogReasonRequired
                    ? "Motif de suppression (obligatoire)"
                    : "Motif (optionnel)"}
                </label>
                <textarea
                  id="vendor-dialog-reason"
                  rows={4}
                  value={dialogReason}
                  onChange={(event) => {
                    setDialogReason(event.target.value);
                    if (dialogValidationError) {
                      setDialogValidationError("");
                    }
                  }}
                  placeholder="Expliquez la raison de cette action"
                  required={dialogReasonRequired}
                />
                {dialogValidationError && (
                  <p className="vendorDetails__dialogError">
                    {dialogValidationError}
                  </p>
                )}
              </div>
            )}
            <div className="vendorDetails__dialogActions">
              <button
                type="button"
                className="vendorDetails__dialogButton"
                onClick={closeDialog}
                disabled={actionBusy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="vendorDetails__dialogButton vendorDetails__dialogButton--confirm"
                onClick={handleDialogConfirm}
                disabled={
                  actionBusy ||
                  (dialogReasonRequired && !dialogReason.trim())
                }
              >
                {dialogConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={partnerConfirm.open}
        title={
          partnerConfirm.enabled
            ? "Marquer comme partenaire"
            : "Retirer le statut partenaire"
        }
        onClose={closePartnerConfirm}
        onConfirm={() => {
          handlePartnerToggle(partnerConfirm.enabled);
          closePartnerConfirm();
        }}
        confirmText="Confirmer"
        cancelText="Annuler"
        loading={actionBusy}
      >
        <p>
          {partnerConfirm.enabled
            ? "Confirmez-vous le marquage de ce vendeur comme partenaire ?"
            : "Confirmez-vous le retrait du statut partenaire ?"}
        </p>
      </ConfirmModal>
      {imagePreview && (
        <div
          className="vendorDetails__imageOverlay"
          onClick={() => setImagePreview(null)}
          role="presentation"
        >
          <div
            className="vendorDetails__imageModal vendorDetails__imageModal--contain"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="vendorDetails__imageClose"
              onClick={() => setImagePreview(null)}
              aria-label="Fermer l'aperçu"
            >
              ×
            </button>
            <img src={imagePreview} alt="Logo vendeur" />
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDetails;
