import "./confirmModal.scss";
import { createPortal } from "react-dom";

const ConfirmModal = ({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  loading = false,
  confirmButtonClassName = "",
  cancelButtonClassName = "",
}) => {
  if (!open) return null;

  return createPortal(
    <div className="confirmModal__backdrop" role="dialog" aria-modal="true">
      <div className="confirmModal__content">
        <div className="confirmModal__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="confirmModal__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="confirmModal__body">{children}</div>
        <div className="confirmModal__footer">
          <button
            type="button"
            className={`confirmModal__button confirmModal__button--ghost ${cancelButtonClassName}`.trim()}
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirmModal__button confirmModal__button--primary ${confirmButtonClassName}`.trim()}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
