import ConfirmModal from "../modal/ConfirmModal";

// Avertissement affiche ~1 minute avant la deconnexion automatique pour
// inactivite. ConfirmModal appelle toujours onClose pour le bouton "X" ET
// le bouton secondaire (cancelText) : les deux sont donc mappes sur
// "Se deconnecter" ici, et seul le bouton primaire (onConfirm) reinitialise
// le minuteur pour rester connecte.
const IdleLogoutWarning = ({ open, remainingSeconds, onStayLoggedIn, onLogoutNow }) => (
  <ConfirmModal
    open={open}
    title="Session inactive"
    onClose={onLogoutNow}
    onConfirm={onStayLoggedIn}
    confirmText="Rester connecté"
    cancelText="Se déconnecter"
  >
    <p>
      Vous allez être déconnecté dans <strong>{remainingSeconds}</strong>{" "}
      seconde{remainingSeconds > 1 ? "s" : ""} pour cause d'inactivité.
    </p>
  </ConfirmModal>
);

export default IdleLogoutWarning;
