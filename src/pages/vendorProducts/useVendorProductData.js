import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { safeDocRef } from "./vendorProductDetailsHelpers";

// Resout et charge le produit vendeur (essaie plusieurs chemins de document
// possibles : etat de navigation, vendor_products racine, vendor_products
// imbrique, products_public), suit la version publique en parallele, et
// gere le statut d'action (reinitialise a chaque changement de produit,
// auto-efface le message de succes apres 4s).
export const useVendorProductData = ({
  productId,
  vendorId,
  docPathFromState,
  stateSource,
  isPublicCatalogMode,
}) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publicProduct, setPublicProduct] = useState(null);
  const [publicProductError, setPublicProductError] = useState(null);
  const [statusUpdateState, setStatusUpdateState] = useState({
    loading: false,
    error: null,
    success: null,
  });

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setError("Produit introuvable.");
      return undefined;
    }

    let unsub = () => {};
    let cancelled = false;

    const resolve = async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      const attempted = new Set();
      const candidates = [];

      if (isPublicCatalogMode) {
        const publicRef = safeDocRef("products_public", productId);
        if (!publicRef) {
          setError("Référence produit invalide.");
          setLoading(false);
          return;
        }
        candidates.push({
          ref: publicRef,
          scope: "public",
        });
      } else {
        if (docPathFromState) {
          const segments = docPathFromState.split("/").filter(Boolean);
          if (segments.length >= 2 && segments.length % 2 === 0) {
            const stateRef = safeDocRef(...segments);
            if (stateRef) {
              candidates.push({
                ref: stateRef,
                scope:
                  stateSource ||
                  (segments.length === 2 ? "root" : "vendor"),
              });
            }
          }
        }

        const rootRef = safeDocRef("vendor_products", productId);
        if (rootRef) {
          candidates.push({
            ref: rootRef,
            scope: "root",
          });
        }

        if (vendorId && vendorId !== "_" && vendorId !== "root") {
          const vendorRef = safeDocRef(
            "vendor_products",
            vendorId,
            "products",
            productId
          );
          if (vendorRef) {
            candidates.push({
              ref: vendorRef,
              scope: "vendor",
            });
          }
        }

        const publicRef = safeDocRef("products_public", productId);
        if (publicRef) {
          candidates.push({
            ref: publicRef,
            scope: "public",
          });
        }
      }

      if (!candidates.length) {
        setError("Référence produit invalide.");
        setLoading(false);
        return;
      }

      for (const candidate of candidates) {
        const path = candidate.ref.path;
        if (attempted.has(path)) continue;
        attempted.add(path);

        try {
          const snap = await getDoc(candidate.ref);
          if (cancelled) return;
          if (snap.exists()) {
            unsub = onSnapshot(
              candidate.ref,
              (liveSnap) => {
                if (!liveSnap.exists()) {
                  setProduct(null);
                  setError("Produit introuvable.");
                } else {
                  setProduct({
                    id: liveSnap.id,
                    __docPath: liveSnap.ref.path,
                    __scope: candidate.scope,
                    ...liveSnap.data(),
                  });
                  setError(null);
                }
                setLoading(false);
              },
              (err) => {
                console.error("Failed to load vendor product:", err);
                setError("Impossible de charger ce produit.");
                setProduct(null);
                setLoading(false);
              }
            );
            return;
          }
        } catch (err) {
          console.error("Vendor product fetch failed:", err);
        }
      }

      if (!cancelled) {
        setProduct(null);
        setError("Produit introuvable.");
        setLoading(false);
      }
    };

    resolve();

    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [vendorId, productId, docPathFromState, stateSource, isPublicCatalogMode]);

  useEffect(() => {
    setStatusUpdateState({ loading: false, error: null, success: null });
  }, [product?.id]);

  useEffect(() => {
    setPublicProduct(null);
    setPublicProductError(null);
    if (!productId) return undefined;

    const publicRef = doc(db, "products_public", productId);
    const unsubscribe = onSnapshot(
      publicRef,
      (snap) => {
        if (snap.exists()) {
          setPublicProduct({ id: snap.id, ...snap.data() });
        } else {
          setPublicProduct(null);
        }
        setPublicProductError(null);
      },
      (err) => {
        console.error("Erreur verification produit public:", err);
        setPublicProduct(null);
        setPublicProductError(
          "Impossible de verifier la publication Monmarche."
        );
      }
    );

    return () => unsubscribe();
  }, [productId]);

  useEffect(() => {
    if (!statusUpdateState.success) return undefined;
    const timer = setTimeout(() => {
      setStatusUpdateState((prev) =>
        prev.success ? { ...prev, success: null } : prev
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, [statusUpdateState.success]);

  return {
    product,
    loading,
    error,
    publicProduct,
    publicProductError,
    statusUpdateState,
    setStatusUpdateState,
  };
};
