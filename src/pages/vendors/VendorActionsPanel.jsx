// Panneau d'actions d'administration sur un vendeur (capture de position,
// approuver, bloquer/debloquer, pauser/reprendre, partenaire, supprimer,
// actions groupees sur les produits). Extrait de VendorDetails.jsx.
const VendorActionsPanel = ({
  fetchingLocation,
  handleCaptureLocation,
  setApprovalLocation,
  setLocationFallback,
  setLocationMessage,
  setLocationError,
  actionBusy,
  isApproved,
  approvalLocation,
  openDialog,
  isBlocked,
  isProtectedVendor,
  isPaused,
  isPauseRequested,
  isPartner,
  openPartnerConfirm,
  canModerateProducts,
  hasProducts,
  hasBlockedProducts,
  locationMessage,
  locationError,
  vendor,
  actionError,
  actionMessage,
  formatDateTime,
}) => {
  return (
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
  );
};

export default VendorActionsPanel;
