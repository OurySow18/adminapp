import "./vendorDetails.scss";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import {
  getVendorStatusLabel,
  resolveVendorStatus,
  isVendorPaused,
  isVendorPauseRequested,
} from "../../utils/vendorStatus";
import {
  PROTECTED_VENDOR_EMAIL,
  formatDateTime,
  toNumberOrZero,
  getPartnerFlag,
  getProductLabel,
  formatOpsLabel,
  formatOpsValue,
  getProfileSection,
  getSection,
} from "./vendorDetailsHelpers";
import { useVendorProducts } from "./useVendorProducts";
import { useVendorActions } from "./useVendorActions";
import VendorActionsPanel from "./VendorActionsPanel";
import VendorProfileSections from "./VendorProfileSections";
import VendorProductsSection from "./VendorProductsSection";
import VendorConfirmDialog from "./VendorConfirmDialog";

const VendorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const isPaused = isVendorPaused(vendor);
  const isPauseRequested = isVendorPauseRequested(vendor);
  const isBlocked = normalizedStatus === "blocked";
  const isApproved = normalizedStatus === "approved";
  const opsDetails = useMemo(() => {
    const knownKeys = [
      "productTypes",
      "canAssistDelivery",
      "deliveryCollaborationDetails",
      "openingHours",
      "pickupAddresses",
      "opsContact",
    ];

    const entries = knownKeys.map((key) => ({
      key,
      label: formatOpsLabel(key),
      value: formatOpsValue(key, ops?.[key], vendor?.productTypes),
    }));

    const extraEntries = Object.entries(ops || {})
      .filter(([key]) => !knownKeys.includes(key))
      .map(([key, value]) => ({
        key,
        label: formatOpsLabel(key),
        value: formatOpsValue(key, value, vendor?.productTypes),
      }));

    return [...entries, ...extraEntries];
  }, [ops, vendor?.productTypes]);
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
  const vendorSlug =
    (typeof vendor?.slug === "string" && vendor.slug.trim()) ||
    (typeof vendor?.profile?.slug === "string" && vendor.profile.slug.trim()) ||
    "";


  const {
    products,
    productsLoading,
    productsError,
    vendorIdentifiers,
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
  } = useVendorProducts(vendor, profile);

  const {
    actionBusy,
    actionError,
    actionMessage,
    dialog,
    dialogReason,
    setDialogReason,
    dialogValidationError,
    setDialogValidationError,
    approvalLocation,
    setApprovalLocation,
    setLocationFallback,
    fetchingLocation,
    locationError,
    setLocationError,
    locationMessage,
    setLocationMessage,
    handleCaptureLocation,
    handlePartnerToggle,
    openDialog,
    closeDialog,
    handleDialogConfirm,
  } = useVendorActions({
    id,
    vendor,
    company,
    navigate,
    isProtectedVendor,
    isBlocked,
    isApproved,
    isPaused,
    isPauseRequested,
    vendorIdentifiers,
    products,
    blockedProducts,
    fetchProductsForVendor,
    blockProductsForVendor,
    reactivateProductsForVendor,
    pauseProductsForVendor,
    restoreProductsAfterPause,
    updatePublicProductsForVendor,
    fetchPublicProductSnapshotsForVendor,
    pausePublicProductsForVendor,
    restorePublicProductsAfterPause,
    fetchVendorProductSnapshotsForDeletion,
    refreshProducts,
    syncLegacyProductDoc,
  });

  const openPartnerConfirm = (enabled) => {
    setPartnerConfirm({ open: true, enabled });
  };

  const closePartnerConfirm = () => {
    setPartnerConfirm({ open: false, enabled: false });
  };

  const dialogRequiresReason =
    dialog &&
    (dialog.type === "blockVendor" ||
      (dialog.type === "pauseVendor" && !dialog.fromRequest) ||
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
      case "pauseVendor":
        return dialog?.fromRequest ? "Valider la pause" : "Mettre en pause";
      case "resumeVendor":
        return "Lever la pause";
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
      case "pauseVendor":
        return dialog?.fromRequest
          ? "Confirmez la validation de la pause demandee. Les produits seront bloques depuis l'admin."
          : "La boutique sera temporairement masquee sans blocage definitif du compte.";
      case "resumeVendor":
        return "La boutique sortira de pause et redeviendra visible.";
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
      case "pauseVendor":
        return dialog?.fromRequest ? "Valider la pause" : "Mettre en pause";
      case "resumeVendor":
        return "Lever la pause";
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
        label: "Approuvé par",
        value:
          profile?.approvedBy ??
          vendor?.approvedBy ??
          vendor?.approvedByUid ??
          "-",
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

  const vendorSalesSummary = useMemo(() => {
    if (productsLoading) {
      return {
        unitsSold: null,
        ordersCount: null,
        display: "Chargement...",
      };
    }

    const totals = products.reduce(
      (acc, item) => {
        const sales =
          item?.stats?.sales ??
          item?.core?.stats?.sales ??
          item?.draft?.core?.stats?.sales ??
          null;
        if (!sales || typeof sales !== "object") {
          return acc;
        }

        acc.unitsSold += toNumberOrZero(sales.unitsSold);
        acc.ordersCount += toNumberOrZero(sales.ordersCount);
        return acc;
      },
      { unitsSold: 0, ordersCount: 0 }
    );

    if (!totals.unitsSold && !totals.ordersCount) {
      return {
        ...totals,
        display: "0",
      };
    }

    return {
      ...totals,
      display:
        totals.ordersCount > 0
          ? `${totals.unitsSold} unite(s) (${totals.ordersCount} commande(s))`
          : `${totals.unitsSold} unite(s)`,
    };
  }, [products, productsLoading]);

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
      {
        label: "Ventes vendeur",
        value: vendorSalesSummary.display,
      },
    ];
    return base;
  }, [vendor, profile, requiredDocs.length, isPartner, vendorSalesSummary.display]);

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
              <p>Slug : {vendorSlug || "-"}</p>
            </div>
            <div className="vendorDetails__headerRight">
              <span className="vendorDetails__statusLabel">{vendorStatus}</span>
              {isPartner && (
                <span className="vendorDetails__partnerBadge">Partenaire</span>
              )}
            </div>
          </div>

          <VendorActionsPanel
            fetchingLocation={fetchingLocation}
            handleCaptureLocation={handleCaptureLocation}
            setApprovalLocation={setApprovalLocation}
            setLocationFallback={setLocationFallback}
            setLocationMessage={setLocationMessage}
            setLocationError={setLocationError}
            actionBusy={actionBusy}
            isApproved={isApproved}
            approvalLocation={approvalLocation}
            openDialog={openDialog}
            isBlocked={isBlocked}
            isProtectedVendor={isProtectedVendor}
            isPaused={isPaused}
            isPauseRequested={isPauseRequested}
            isPartner={isPartner}
            openPartnerConfirm={openPartnerConfirm}
            canModerateProducts={canModerateProducts}
            hasProducts={hasProducts}
            hasBlockedProducts={hasBlockedProducts}
            locationMessage={locationMessage}
            locationError={locationError}
            vendor={vendor}
            actionError={actionError}
            actionMessage={actionMessage}
            formatDateTime={formatDateTime}
          />

          <VendorProfileSections
            company={company}
            profile={profile}
            vendor={vendor}
            statusHistory={statusHistory}
            stats={stats}
            legal={legal}
            bank={bank}
            opsDetails={opsDetails}
            food={food}
            consent={consent}
            requiredDocs={requiredDocs}
            vendorStatus={vendorStatus}
          />

          <VendorProductsSection
            productsLoading={productsLoading}
            productsError={productsError}
            canModerateProducts={canModerateProducts}
            products={products}
            actionBusy={actionBusy}
            openDialog={openDialog}
          />
        </div>
      </div>
      <VendorConfirmDialog
        dialog={dialog}
        dialogTitle={dialogTitle}
        dialogDescription={dialogDescription}
        dialogRequiresReason={dialogRequiresReason}
        dialogReasonRequired={dialogReasonRequired}
        dialogReason={dialogReason}
        setDialogReason={setDialogReason}
        dialogValidationError={dialogValidationError}
        setDialogValidationError={setDialogValidationError}
        closeDialog={closeDialog}
        handleDialogConfirm={handleDialogConfirm}
        actionBusy={actionBusy}
        dialogConfirmLabel={dialogConfirmLabel}
      />
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
