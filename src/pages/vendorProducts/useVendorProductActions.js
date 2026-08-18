import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  applyVendorProductDraftChanges,
  updateVendorProductAdminStatus,
} from "../../utils/vendorProductsRepository";

// Charge l'email de contact du vendeur, et expose les actions admin sur le
// produit (activer/masquer, valider les modifications en attente). Extrait
// tel quel de VendorProductDetails.jsx, aucune logique modifiee.
export const useVendorProductActions = ({
  productId,
  resolvedVendorId,
  product,
  docPathFromState,
  isPublicCatalogMode,
  pendingDraftChanges,
  setStatusUpdateState,
}) => {
  const [vendorContactEmail, setVendorContactEmail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadVendorContact = async () => {
      if (!resolvedVendorId) {
        setVendorContactEmail(null);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, "vendors", resolvedVendorId));
        if (!snapshot.exists()) {
          if (!cancelled) setVendorContactEmail(null);
          return;
        }
        const data = snapshot.data() || {};
        const email =
          data?.company?.email ||
          data?.email ||
          data?.contactEmail ||
          data?.profile?.email ||
          data?.profile?.company?.email ||
          data?.company?.email ||
          null;
        if (!cancelled) {
          setVendorContactEmail(
            typeof email === "string" && email.trim() ? email.trim() : null
          );
        }
      } catch (err) {
        if (!cancelled) setVendorContactEmail(null);
      }
    };
    loadVendorContact();
    return () => {
      cancelled = true;
    };
  }, [resolvedVendorId]);

  const handleAdminToggle = async (enabled) => {
    if (!product) return;
    setStatusUpdateState({ loading: true, error: null, success: null });
    try {
      const approvedBy = auth.currentUser?.email ?? "admin";
      const approvedByUid = auth.currentUser?.uid ?? null;
      await updateVendorProductAdminStatus({
        productId,
        vendorId: resolvedVendorId,
        enabled,
        primaryDocPath: product.__docPath || docPathFromState,
        productData: product,
        approvedBy: enabled ? approvedBy : undefined,
        approvedByUid: enabled ? approvedByUid : undefined,
      });
      setStatusUpdateState({
        loading: false,
        error: null,
        success: enabled
          ? "Le produit est desormais visible pour l'admin."
          : "Le produit a ete masque sur Monmarche.",
      });
    } catch (err) {
      const message =
        err?.message || "Impossible de mettre a jour le statut admin.";
      setStatusUpdateState({ loading: false, error: message, success: null });
    }
  };

  const handleValidateChanges = async () => {
    if (!product || !pendingDraftChanges) return;
    if (isPublicCatalogMode || product?.__scope === "public") {
      setStatusUpdateState({
        loading: false,
        error:
          "La validation des modifications est disponible uniquement depuis Produits vendeurs.",
        success: null,
      });
      return;
    }
    setStatusUpdateState({ loading: true, error: null, success: null });
    try {
      const approvedBy = auth.currentUser?.email ?? "admin";
      const approvedByUid = auth.currentUser?.uid ?? null;
      await applyVendorProductDraftChanges({
        productId,
        vendorId: resolvedVendorId,
        primaryDocPath: product.__docPath || docPathFromState,
        productData: product,
        approvedBy,
        approvedByUid,
      });
      if (vendorContactEmail) {
        const subject = "Vos modifications ont été validées";
        const html = `
          <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${subject} - Monmarché</title></head>
          <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:#16a34a;color:#fff;padding:12px;text-align:center">
                <h1 style="margin:0;font-size:20px">Modifications validées</h1>
              </div>
              <div style="padding:20px">
                <p>Bonjour,</p>
                <p>Vos dernières modifications sur le produit <strong>${product?.title || product?.name || "Produit"}</strong> ont été validées par Monmarché.</p>
                <p>Elles sont maintenant visibles dans l'application.</p>
                <p>Merci,</p>
                <p>Service Client Monmarché</p>
              </div>
              <div style="background:#16a34a;color:#fff;padding:10px;text-align:center;font-size:12px">
                &copy; ${new Date().getFullYear()} Monmarché
              </div>
            </div>
          </body></html>`;
        addDoc(collection(db, "mail"), {
          to: vendorContactEmail,
          message: {
            subject,
            text:
              "Vos dernières modifications ont été validées par Monmarché et sont visibles dans l'application.",
            html,
          },
        }).catch((err) => {
          console.warn("Email validation produit non envoyé (non bloquant):", err);
        });
      }
      setStatusUpdateState({
        loading: false,
        error: null,
        success: "Modifications validees et appliquees au catalogue public.",
      });
    } catch (err) {
      const message =
        err?.message || "Impossible de valider les modifications.";
      setStatusUpdateState({ loading: false, error: message, success: null });
    }
  };

  const handleActivate = () => handleAdminToggle(true);

  const handleBlock = () => handleAdminToggle(false);

  return { handleActivate, handleBlock, handleValidateChanges };
};
