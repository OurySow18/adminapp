// Chargement et mutation des produits d'un vendeur (vendor_products, legacy
// products, products_public). Extrait de VendorDetails.jsx : ce bloc etait
// utilise par la quasi-totalite des handlers d'action (bloquer, mettre en
// pause, reactiver, archiver...), d'ou son regroupement en un seul hook
// plutot qu'un simple decoupage par fonction.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  getPrimaryProductDocRef,
  getProductAvailabilityFlag,
  getProductSortValue,
  isProductLike,
  parseStatusFlagOrNull,
} from "./vendorDetailsHelpers";

export const useVendorProducts = (vendor, profile) => {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

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

  const pauseProductsForVendor = useCallback(
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

        chunk.forEach((product) => {
          const productRef = getPrimaryProductDocRef(product, db);
          const updateTimestamp = serverTimestamp();
          const payload = {
            mm_status: false,
            "core.mm_status": false,
            "draft.core.mm_status": false,
            updatedAt: updateTimestamp,
            "core.updatedAt": updateTimestamp,
            "draft.core.updatedAt": updateTimestamp,
            "pauseSnapshot.vendor.wasAvailable":
              getProductAvailabilityFlag(product),
            "pauseSnapshot.vendor.mmStatus": parseStatusFlagOrNull(
              product?.mm_status
            ),
            "pauseSnapshot.vendor.coreMmStatus": parseStatusFlagOrNull(
              product?.core?.mm_status
            ),
            "pauseSnapshot.vendor.draftCoreMmStatus": parseStatusFlagOrNull(
              product?.draft?.core?.mm_status
            ),
            "pauseSnapshot.vendor.capturedAt": updateTimestamp,
            "pauseSnapshot.vendor.version": 1,
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

  const restoreProductsAfterPause = useCallback(
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

        chunk.forEach((product) => {
          const productRef = getPrimaryProductDocRef(product, db);
          const updateTimestamp = serverTimestamp();
          const snap = product?.pauseSnapshot?.vendor || {};
          const previousMmStatus = parseStatusFlagOrNull(snap.mmStatus);
          const previousCoreMmStatus = parseStatusFlagOrNull(snap.coreMmStatus);
          const previousDraftCoreMmStatus = parseStatusFlagOrNull(
            snap.draftCoreMmStatus
          );
          const previousWasAvailable = parseStatusFlagOrNull(snap.wasAvailable);
          const fallbackAvailability =
            previousWasAvailable ??
            parseStatusFlagOrNull(getProductAvailabilityFlag(product)) ??
            false;

          const payload = {
            mm_status:
              previousMmStatus === null
                ? fallbackAvailability
                : previousMmStatus,
            "core.mm_status":
              previousCoreMmStatus === null
                ? previousMmStatus === null
                  ? fallbackAvailability
                  : previousMmStatus
                : previousCoreMmStatus,
            "draft.core.mm_status":
              previousDraftCoreMmStatus === null
                ? previousCoreMmStatus === null
                  ? previousMmStatus === null
                    ? fallbackAvailability
                    : previousMmStatus
                  : previousCoreMmStatus
                : previousDraftCoreMmStatus,
            updatedAt: updateTimestamp,
            "core.updatedAt": updateTimestamp,
            "draft.core.updatedAt": updateTimestamp,
            "pauseSnapshot.vendor": deleteField(),
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

  const pausePublicProductsForVendor = useCallback(async () => {
    const docs = await fetchPublicProductSnapshotsForVendor();
    if (!docs.length) return 0;

    const chunkSize = 400;
    let processed = 0;

    for (let index = 0; index < docs.length; index += chunkSize) {
      const chunk = docs.slice(index, index + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach((docSnap) => {
        const raw = docSnap.data() || {};
        const updateTimestamp = serverTimestamp();
        const snapshotMmStatus = parseStatusFlagOrNull(raw.mm_status);
        const snapshotActive = parseStatusFlagOrNull(raw.active);
        const snapshotIsActive = parseStatusFlagOrNull(raw.isActive);
        const snapshotWasAvailable =
          snapshotMmStatus ?? snapshotActive ?? snapshotIsActive ?? false;
        batch.update(docSnap.ref, {
          mm_status: false,
          active: false,
          isActive: false,
          updatedAt: updateTimestamp,
          "pauseSnapshot.public.wasAvailable": snapshotWasAvailable,
          "pauseSnapshot.public.mmStatus": snapshotMmStatus,
          "pauseSnapshot.public.active": snapshotActive,
          "pauseSnapshot.public.isActive": snapshotIsActive,
          "pauseSnapshot.public.capturedAt": updateTimestamp,
          "pauseSnapshot.public.version": 1,
        });
      });

      await batch.commit();
      processed += chunk.length;
    }

    return processed;
  }, [fetchPublicProductSnapshotsForVendor]);

  const restorePublicProductsAfterPause = useCallback(async () => {
    const docs = await fetchPublicProductSnapshotsForVendor();
    if (!docs.length) return 0;

    const chunkSize = 400;
    let processed = 0;

    for (let index = 0; index < docs.length; index += chunkSize) {
      const chunk = docs.slice(index, index + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach((docSnap) => {
        const raw = docSnap.data() || {};
        const snap = raw?.pauseSnapshot?.public || {};
        const previousWasAvailable = parseStatusFlagOrNull(snap.wasAvailable);
        const previousMmStatus = parseStatusFlagOrNull(snap.mmStatus);
        const previousActive = parseStatusFlagOrNull(snap.active);
        const previousIsActive = parseStatusFlagOrNull(snap.isActive);
        const fallback = previousWasAvailable ?? false;
        const mmStatus =
          previousMmStatus === null ? fallback : previousMmStatus;
        const active =
          previousActive === null ? mmStatus : previousActive;
        const isActive =
          previousIsActive === null ? active : previousIsActive;
        const updateTimestamp = serverTimestamp();

        batch.update(docSnap.ref, {
          mm_status: mmStatus,
          active,
          isActive,
          updatedAt: updateTimestamp,
          "pauseSnapshot.public": deleteField(),
        });
      });

      await batch.commit();
      processed += chunk.length;
    }

    return processed;
  }, [fetchPublicProductSnapshotsForVendor]);

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

  return {
    products,
    productsLoading,
    productsError,
    vendorIdentifiers,
    matchesVendorProduct,
    fetchProductsForVendor,
    refreshProducts,
    syncLegacyProductDoc,
    blockProductsForVendor,
    reactivateProductsForVendor,
    pauseProductsForVendor,
    restoreProductsAfterPause,
    updatePublicProductsForVendor,
    fetchPublicProductSnapshotsForVendor,
    pausePublicProductsForVendor,
    restorePublicProductsAfterPause,
    fetchVendorProductSnapshotsForDeletion,
    blockedProducts,
  };
};
