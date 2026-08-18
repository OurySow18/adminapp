import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

// Charge la commande (ecoute en temps reel) et les boutiques des vendeurs
// presents dans le panier, pour afficher leurs coordonnees sur la commande.
export const useOrderData = (title, orderId) => {
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [orderVendors, setOrderVendors] = useState({});

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const unsubscribe = onSnapshot(
      doc(db, title, orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrderDetails(null);
          setLoadError("Commande introuvable.");
          setLoading(false);
          return;
        }
        setOrderDetails(snapshot.data());
        setLoading(false);
      },
      (error) => {
        console.log(error);
        setLoadError("Impossible de charger la commande.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId, title]);

  useEffect(() => {
    const cart = Array.isArray(orderDetails?.cart) ? orderDetails.cart : [];
    const vendorIds = Array.from(
      new Set(
        cart
          .map(
            (item) =>
              item?.vendorId ||
              item?.vendor?.vendorId ||
              item?.vendor?.id ||
              item?.vendor?.uid ||
              item?.sellerId ||
              item?.storeId
          )
          .filter(Boolean)
          .map(String)
      )
    );

    if (!vendorIds.length) {
      setOrderVendors({});
      return undefined;
    }

    let cancelled = false;
    Promise.all(
      vendorIds.map(async (vendorId) => {
        try {
          const snapshot = await getDoc(doc(db, "vendors", vendorId));
          return [vendorId, snapshot.exists() ? snapshot.data() : null];
        } catch (error) {
          console.warn(`Impossible de charger la boutique ${vendorId}:`, error);
          return [vendorId, null];
        }
      })
    ).then((entries) => {
      if (!cancelled) setOrderVendors(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [orderDetails?.cart]);

  return { orderDetails, loading, loadError, orderVendors };
};
