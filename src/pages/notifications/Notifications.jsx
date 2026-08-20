import "./notifications.scss";
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import { functions } from "../../firebase";

const sendBroadcastNotificationCallable = httpsCallable(
  functions,
  "sendBroadcastNotification"
);

const MESSAGE_MAX_LENGTH = 500;
const TITLE_MAX_LENGTH = 120;

const BROADCAST_ERROR_MESSAGES = {
  auth_required: "Vous devez être connecté pour envoyer une notification.",
  admin_required:
    "Ce compte n'a pas les droits admin nécessaires pour envoyer une notification (aucun document trouvé dans admin/{uid}).",
  message_required: "Le message est obligatoire.",
};

const formatBroadcastError = (error) => {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";
  const normalizedCode = code.startsWith("functions/")
    ? code.slice("functions/".length)
    : code;
  const normalizedMessage = message
    .replace(/^functions\/[a-z-]+:\s*/i, "")
    .trim();

  if (BROADCAST_ERROR_MESSAGES[normalizedMessage]) {
    return BROADCAST_ERROR_MESSAGES[normalizedMessage];
  }
  if (BROADCAST_ERROR_MESSAGES[normalizedCode]) {
    return BROADCAST_ERROR_MESSAGES[normalizedCode];
  }
  return (
    normalizedMessage || "Une erreur inattendue est survenue. Merci de réessayer."
  );
};

const Notifications = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  const trimmedMessage = message.trim();
  const canSubmit = trimmedMessage.length > 0 && !sending;

  const handleOpenConfirm = (event) => {
    event.preventDefault();
    if (!trimmedMessage) {
      setError("Le message est obligatoire.");
      return;
    }
    setError("");
    setSuccessInfo(null);
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      const response = await sendBroadcastNotificationCallable({
        title: title.trim() || undefined,
        message: trimmedMessage,
      });
      const recipientCount = response?.data?.recipientCount ?? 0;
      setSuccessInfo({ recipientCount });
      setTitle("");
      setMessage("");
      setConfirmOpen(false);
    } catch (sendError) {
      console.error("Erreur envoi notification broadcast:", sendError);
      setError(formatBroadcastError(sendError));
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="notifications">
      <Sidebar />
      <main className="notifications__container">
        <Navbar />
        <header className="notifications__header">
          <div>
            <h1>Notifications</h1>
            <p>
              Envoyez une notification push à tous les utilisateurs de l'app
              Monmarché ayant les notifications activées.
            </p>
          </div>
        </header>

        {error && <div className="notifications__banner notifications__banner--error">{error}</div>}
        {successInfo && (
          <div className="notifications__banner notifications__banner--success">
            Notification envoyée à {successInfo.recipientCount} destinataire
            {successInfo.recipientCount > 1 ? "s" : ""}.
          </div>
        )}

        <section className="notifications__panel">
          <form onSubmit={handleOpenConfirm}>
            <div className="notifications__field">
              <label htmlFor="notif-title">Titre (optionnel)</label>
              <input
                id="notif-title"
                type="text"
                placeholder="MonMarché"
                value={title}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(event) => setTitle(event.target.value)}
                disabled={sending}
              />
            </div>

            <div className="notifications__field">
              <label htmlFor="notif-message">Message</label>
              <textarea
                id="notif-message"
                rows={6}
                placeholder="Votre message aux utilisateurs..."
                value={message}
                maxLength={MESSAGE_MAX_LENGTH}
                onChange={(event) => setMessage(event.target.value)}
                disabled={sending}
              />
              <div className="notifications__counter">
                {message.length} / {MESSAGE_MAX_LENGTH}
              </div>
            </div>

            <div className="notifications__actions">
              <button type="submit" className="primary" disabled={!canSubmit}>
                {sending ? "Envoi en cours..." : "Envoyer"}
              </button>
            </div>
          </form>
        </section>

        <ConfirmModal
          open={confirmOpen}
          title="Confirmer l'envoi"
          onClose={() => !sending && setConfirmOpen(false)}
          onConfirm={handleSend}
          confirmText="Envoyer à tous"
          loading={sending}
          confirmButtonClassName="confirmModal__button--strongConfirm"
        >
          <p>
            Cette notification sera envoyée à <strong>tous les utilisateurs</strong>{" "}
            ayant l'application installée et les notifications activées. Il n'est
            pas possible de cibler un segment pour l'instant. Continuer ?
          </p>
        </ConfirmModal>
      </main>
    </div>
  );
};

export default Notifications;
