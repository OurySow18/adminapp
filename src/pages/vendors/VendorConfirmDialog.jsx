// Boite de dialogue de confirmation generique pour les actions vendeur/produit
// (approuver, bloquer, pauser, archiver...). Extrait de VendorDetails.jsx.
const VendorConfirmDialog = ({
  dialog,
  dialogTitle,
  dialogDescription,
  dialogRequiresReason,
  dialogReasonRequired,
  dialogReason,
  setDialogReason,
  dialogValidationError,
  setDialogValidationError,
  closeDialog,
  handleDialogConfirm,
  actionBusy,
  dialogConfirmLabel,
}) => {
  if (!dialog) return null;

  return (
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
  );
};

export default VendorConfirmDialog;
