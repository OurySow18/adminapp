import "./vendorsList.scss";
import { useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import List from "../list/List";
import ConfirmModal from "../../components/modal/ConfirmModal";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { auth, db } from "../../firebase";
import { vendorColumns, vendorPausedColumns } from "../../datatablesource";
import {
  normalizeVendorStatus,
  isVendorStatus,
  resolveVendorStatus,
  getVendorStatusLabel,
  isVendorPaused,
} from "../../utils/vendorStatus";
import { escapeHtml } from "./vendorDetailsHelpers";

const getVendorName = (vendor) =>
  vendor?.company?.name ||
  vendor?.companyName ||
  vendor?.name ||
  vendor?.displayName ||
  vendor?.profile?.company?.name ||
  vendor?.profile?.displayName ||
  vendor?.id;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const formatExactDateTime = (date) =>
  date
    ? date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const getVendorEmail = (vendor) =>
  vendor?.company?.email ||
  vendor?.email ||
  vendor?.contactEmail ||
  vendor?.profile?.email ||
  vendor?.profile?.company?.email ||
  null;

const buildDefaultHelpMessage = (vendorName) =>
  `Bonjour,

Nous avons remarqué que votre boutique "${vendorName}" sur Monmarché est toujours en brouillon et n'a pas encore été soumise.

Rencontrez-vous des difficultés pour vous connecter, pour renseigner vos informations, ou à une autre étape de l'inscription ?

Nous serions ravis de vous aider à finaliser votre dossier afin que vous puissiez soumettre votre boutique et commencer à vendre sur Monmarché.

N'hésitez pas à répondre à cet email ou à nous contacter directement, nous sommes là pour vous accompagner.

L'équipe Monmarché`;

const VendorsList = () => {
  const { statusId } = useParams();
  const [helpTarget, setHelpTarget] = useState(null);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [helpError, setHelpError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, type: "success", message: "" });

  const normalizedStatus = useMemo(() => {
    if (!statusId) return null;
    const normalized = normalizeVendorStatus(statusId);
    return normalized && isVendorStatus(normalized) ? normalized : null;
  }, [statusId]);

  const filterCallback = useMemo(() => {
    if (!normalizedStatus) return null;
    if (normalizedStatus === "paused") {
      return (row) => isVendorPaused(row);
    }
    return (row) => resolveVendorStatus(row, "draft") === normalizedStatus;
  }, [normalizedStatus]);

  const openHelpModal = (vendor) => {
    const vendorId = vendor.__docId || vendor.id;
    setHelpTarget({
      id: vendorId,
      name: getVendorName(vendor),
      email: getVendorEmail(vendor),
      lastSentAt: toDate(vendor.lastOnboardingHelpAt),
    });
    setHelpMessage(buildDefaultHelpMessage(getVendorName(vendor)));
    setHelpError("");
  };

  const closeHelpModal = () => {
    if (helpSending) return;
    setHelpTarget(null);
    setHelpMessage("");
    setHelpError("");
  };

  const sendHelpEmail = async () => {
    if (!helpTarget) return;
    const finalMessage = helpMessage.trim();
    if (!finalMessage) {
      setHelpError("Le message est obligatoire.");
      return;
    }
    if (!helpTarget.email) {
      setHelpError("Aucun email de contact trouvé pour cette boutique.");
      return;
    }

    setHelpSending(true);
    setHelpError("");
    try {
      const vendorNameSafe = escapeHtml(helpTarget.name);
      const messageHtml = escapeHtml(finalMessage).replace(/\n/g, "<br />");
      const html = `
        <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Besoin d'aide pour finaliser votre boutique - Monmarché</title></head>
        <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:#ff6f00;color:#fff;padding:12px;text-align:center">
              <h1 style="margin:0;font-size:20px">Besoin d'aide, ${vendorNameSafe} ?</h1>
            </div>
            <div style="padding:20px">
              <p>${messageHtml}</p>
            </div>
            <div style="background:#ff6f00;color:#fff;padding:10px;text-align:center;font-size:12px">
              &copy; ${new Date().getFullYear()} Monmarché
            </div>
          </div>
        </body></html>`;

      await addDoc(collection(db, "mail"), {
        to: helpTarget.email,
        message: {
          subject: "Besoin d'aide pour finaliser votre boutique Monmarché ?",
          text: finalMessage,
          html,
        },
      });

      await updateDoc(doc(db, "vendors", helpTarget.id), {
        lastOnboardingHelpAt: serverTimestamp(),
        lastOnboardingHelpMessage: finalMessage,
        lastOnboardingHelpBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
      });

      setHelpTarget(null);
      setHelpMessage("");
      setFeedback({
        open: true,
        type: "success",
        message: `Email envoyé à ${helpTarget.name}.`,
      });
    } catch (err) {
      console.error("Erreur envoi email d'aide boutique brouillon:", err);
      setHelpError("Impossible d'envoyer l'email. Merci de réessayer.");
    } finally {
      setHelpSending(false);
    }
  };

  const draftHelpColumn = useMemo(
    () => ({
      field: "onboardingHelp",
      headerName: "Aide",
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const lastSentAt = toDate(params.row.lastOnboardingHelpAt);
        return (
          <button
            type="button"
            className={`vendorsList__helpButton ${
              lastSentAt ? "vendorsList__helpButton--sent" : ""
            }`}
            title={lastSentAt ? `Envoyé le ${formatExactDateTime(lastSentAt)}` : undefined}
            onClick={(event) => {
              event.stopPropagation();
              openHelpModal(params.row);
            }}
          >
            {lastSentAt ? "Renvoyer" : "Proposer de l'aide"}
          </button>
        );
      },
    }),
    []
  );

  const columns = useMemo(() => {
    const base = normalizedStatus === "paused" ? vendorPausedColumns : vendorColumns;
    return normalizedStatus === "draft" ? [...base, draftHelpColumn] : base;
  }, [normalizedStatus, draftHelpColumn]);

  if (statusId && !normalizedStatus) {
    return <Navigate to="/vendors" replace />;
  }

  const baseTitle = "Vendeurs";
  const pageTitle = normalizedStatus
    ? `${baseTitle} (${getVendorStatusLabel(normalizedStatus)})`
    : baseTitle;
  const disableCreate = Boolean(normalizedStatus);

  return (
    <>
      <List
        typeColumns={columns}
        title="vendors"
        dataFilter={filterCallback}
        pageTitle={pageTitle}
        disableCreate={disableCreate}
      />
      <ConfirmModal
        open={Boolean(helpTarget)}
        title={helpTarget ? `Proposer de l'aide à ${helpTarget.name}` : ""}
        onClose={closeHelpModal}
        onConfirm={sendHelpEmail}
        confirmText="Envoyer l'email"
        loading={helpSending}
        confirmButtonClassName="confirmModal__button--strongConfirm"
      >
        {helpTarget && !helpTarget.email && (
          <p className="workModal__error">
            Aucun email de contact trouvé pour cette boutique — l'envoi échouera.
          </p>
        )}
        {helpTarget?.lastSentAt && (
          <p className="workModal__text">
            ℹ Un email a déjà été envoyé à cette boutique le{" "}
            <strong>{formatExactDateTime(helpTarget.lastSentAt)}</strong>.
          </p>
        )}
        <div className="workModal__field">
          <label htmlFor="vendor-help-message">Message envoyé à la boutique</label>
          <textarea
            id="vendor-help-message"
            value={helpMessage}
            onChange={(event) => {
              setHelpMessage(event.target.value);
              if (helpError) setHelpError("");
            }}
            rows={10}
            disabled={helpSending}
          />
        </div>
        {helpError && <p className="workModal__error">{helpError}</p>}
      </ConfirmModal>
      <FeedbackPopup
        open={feedback.open}
        type={feedback.type}
        message={feedback.message}
        onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
};

export default VendorsList;
