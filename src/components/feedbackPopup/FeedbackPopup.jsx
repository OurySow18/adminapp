import PropTypes from "prop-types";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import "./FeedbackPopup.scss";

const ICON_MAP = {
  success: CheckCircleIcon,
  error: ErrorOutlineIcon,
  info: InfoOutlinedIcon,
};

const TITLE_MAP = {
  success: "Action reussie",
  error: "Erreur",
  info: "Information",
};

const FeedbackPopup = ({
  open,
  type = "info",
  title,
  message,
  onClose,
  actions,
}) => {
  if (!open) return null;

  const IconComponent = ICON_MAP[type] || ICON_MAP.info;
  const computedTitle = title || TITLE_MAP[type] || TITLE_MAP.info;

  return (
    <div className="feedbackPopup" role="alertdialog" aria-live="assertive">
      <div className={`feedbackPopup__container feedbackPopup__container--${type}`}>
        <button
          type="button"
          className="feedbackPopup__close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <CloseIcon />
        </button>
        <div className="feedbackPopup__icon">
          <IconComponent />
        </div>
        <div className="feedbackPopup__content">
          <h3>{computedTitle}</h3>
          {typeof message === "string" ? <p>{message}</p> : message}
        </div>
        {actions && <div className="feedbackPopup__actions">{actions}</div>}
      </div>
    </div>
  );
};

FeedbackPopup.propTypes = {
  open: PropTypes.bool,
  type: PropTypes.oneOf(["success", "error", "info"]),
  title: PropTypes.string,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  onClose: PropTypes.func,
  actions: PropTypes.node,
};

export default FeedbackPopup;
