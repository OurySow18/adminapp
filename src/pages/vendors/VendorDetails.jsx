import "./vendorDetails.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  toStatusFlag,
  getPartnerFlag,
  getProductLabel,
  formatOpsLabel,
  formatOpsValue,
  getProfileSection,
  getSection,
} from "./vendorDetailsHelpers";
import { useVendorProducts } from "./useVendorProducts";
import { useVendorActions } from "./useVendorActions";

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

  const REQUIRED_DOC_LABELS = {
    repId: "Pièce d'identité du représentant",
    gewerbe: "Enregistrement commerce",
    handelsregister: "Extrait registre de commerce",
    ifsg: "Certificat IFSG",
    haccp: "Plan HACCP",
    liability: "Assurance responsabilité civile",
    foodRegistration: "Enregistrement établissement alimentaire",
  };
  const CONSENT_LABELS = {
    acceptPrivacy: "Politique de confidentialité",
    contactConsent: "Consentement de contact",
    attestTrue: "Déclaration sur l'honneur",
    acceptTos: "Conditions d'utilisation",
  };
  const formatConsentLabel = (key) =>
    CONSENT_LABELS[key] ||
    String(key || "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim() ||
    "-";

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
                    disabled={
                      actionBusy ||
                      (!isApproved && !isPaused) ||
                      isProtectedVendor
                    }
                    onClick={() => openDialog({ type: "blockVendor" })}
                  >
                    Bloquer le vendeur
                  </button>
                )}
                {isPaused ? (
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--success"
                    disabled={actionBusy || isBlocked}
                    onClick={() => openDialog({ type: "resumeVendor" })}
                  >
                    Lever la pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vendorDetails__actionButton vendorDetails__actionButton--ghost"
                    disabled={
                      actionBusy ||
                      isBlocked ||
                      isProtectedVendor ||
                      (!isPauseRequested && !isApproved)
                    }
                    onClick={() =>
                      openDialog({
                        type: "pauseVendor",
                        fromRequest: isPauseRequested,
                      })
                    }
                  >
                    {isPauseRequested ? "Valider la pause" : "Mettre en pause"}
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
                  Ce compte Monmarche est protege et ne peut pas etre bloque, mis en pause ou supprime.
                </p>
              )}
              {isPauseRequested && !isPaused && (
                <p className="vendorDetails__actionsMeta">
                  Demande de pause recue le{" "}
                  {formatDateTime(
                    vendor?.pause?.requestedAt ??
                      vendor?.profile?.pause?.requestedAt ??
                      vendor?.pauseRequestedAt
                  )}
                  . Cliquez sur "Valider la pause" pour appliquer le blocage des produits.
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
            <h2>Informations légales</h2>
            <div className="vendorDetails__grid vendorDetails__grid--three">
              <div className="vendorDetails__card">
                <h3>Immatriculation</h3>
                <ul>
                  <li>
                    <strong>Numéro fiscal :</strong>{" "}
                    {legal?.steuernummer ?? vendor?.steuernummer ?? "-"}
                  </li>
                  <li>
                    <strong>Numéro TVA :</strong> {legal?.ustIdNr ?? "-"}
                  </li>
                  <li>
                    <strong>Micro-entreprise :</strong>{" "}
                    {legal?.kleinunternehmer ? "Oui" : "Non"}
                  </li>
                </ul>
              </div>
              <div className="vendorDetails__card">
                <h3>Documents légaux</h3>
                <ul>
                  <li>
                    <strong>Mentions légales :</strong>{" "}
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
                <h3>Ops, livraison & retrait</h3>
                {opsDetails.length > 0 ? (
                  <ul>
                    {opsDetails.map((item) => (
                      <li key={item.key}>
                        <strong>{item.label} :</strong>{" "}
                        <span style={{ whiteSpace: "pre-line" }}>{item.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Aucune donnée ops enregistrée.</p>
                )}
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
                      <strong>{formatConsentLabel(key)} :</strong>{" "}
                      {value ? "Oui" : "Non"}
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
