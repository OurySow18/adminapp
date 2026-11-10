import "./credit.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { auth } from "../../firebase";
import { formatDateTime, formatDueDate, formatGNF } from "./creditFormat";
import {
  closeCompanyRejectedAgreement,
  getAgreementStatusLabel,
  getPlanLabel,
  loadAgreementsByStatus,
  loadHistoryAgreements,
  releaseAgreementDelivery,
  reviewAgreement,
} from "../../utils/creditRepository";

const TABS = [
  { key: "pending_review", label: "À examiner" },
  { key: "pending_company_approval", label: "Chez l'entreprise" },
  { key: "company_approved", label: "Validées par l'entreprise" },
  { key: "company_rejected", label: "Refusées par l'entreprise" },
  { key: "history", label: "Historique" },
];

const getAdmin = () => ({
  uid: auth.currentUser?.uid,
  name: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
});

const hoursSince = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : null;
  if (!date) return 0;
  return (Date.now() - date.getTime()) / 3_600_000;
};

const CreditRequests = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.key === requestedTab) ? requestedTab : "pending_review";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, type: "success", message: "" });

  const loadRows = async (tab) => {
    setLoading(true);
    setError(false);
    try {
      const data =
        tab === "history" ? await loadHistoryAgreements() : await loadAgreementsByStatus(tab);
      setRows(data);
    } catch (err) {
      console.error("Failed to load credit requests:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const setTab = (tab) => setSearchParams(tab === "pending_review" ? {} : { tab });

  const handleTransmit = async (agreement) => {
    setActionRunning(true);
    try {
      await reviewAgreement(agreement.id, { approve: true, admin: getAdmin() });
      setFeedback({ open: true, type: "success", message: "Demande transmise à l'entreprise." });
      await loadRows(activeTab);
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    } finally {
      setActionRunning(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      setRejectError("Le motif est obligatoire.");
      return;
    }
    setActionRunning(true);
    try {
      await reviewAgreement(rejectTarget.id, {
        approve: false,
        note: rejectNote.trim(),
        admin: getAdmin(),
      });
      setFeedback({ open: true, type: "success", message: "Demande refusée." });
      setRejectTarget(null);
      setRejectNote("");
      await loadRows(activeTab);
    } catch (err) {
      setRejectError(err?.message || "Action impossible.");
    } finally {
      setActionRunning(false);
    }
  };

  const handleRelease = async (agreement) => {
    setActionRunning(true);
    try {
      await releaseAgreementDelivery(agreement.id, { admin: getAdmin() });
      setFeedback({
        open: true,
        type: "success",
        message: "Livraison lancée, le crédit est maintenant actif.",
      });
      await loadRows(activeTab);
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    } finally {
      setActionRunning(false);
    }
  };

  const handleClose = async (agreement) => {
    setActionRunning(true);
    try {
      await closeCompanyRejectedAgreement(agreement.id, { admin: getAdmin() });
      setFeedback({
        open: true,
        type: "success",
        message: "Demande clôturée. Pensez à contacter l'employé pour le paiement comptant.",
      });
      setConfirmAction(null);
      await loadRows(activeTab);
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    } finally {
      setActionRunning(false);
    }
  };

  const summary = useMemo(() => `${rows.length} demande(s)`, [rows]);

  return (
    <div className="credit">
      <Sidebar />
      <main className="credit__container">
        <Navbar />
        <Link to="/admin/credit" className="credit__back">
          ← Tableau de bord crédit
        </Link>
        <header className="credit__header">
          <div>
            <h1>Demandes de crédit</h1>
            <p>{summary}</p>
          </div>
        </header>

        <div className="credit__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`credit__tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="credit__banner credit__banner--error">
            Impossible de charger les demandes.
          </div>
        )}

        <section className="credit__panel">
          {loading && <p className="credit__empty">Chargement...</p>}
          {!loading && !rows.length && <p className="credit__empty">Aucune demande.</p>}
          {!loading &&
            rows.map((agreement) => {
              const waitingHours = activeTab === "pending_company_approval" ? hoursSince(agreement.createdAt) : 0;
              const isWaitingLong = waitingHours > 48;
              return (
                <div
                  key={agreement.id}
                  className={`credit__panel ${isWaitingLong ? "credit__row--waiting" : ""}`}
                  style={{ marginBottom: 14 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <strong>{agreement.memberName}</strong> — {agreement.memberPhone}
                      <div className="credit__muted">{agreement.companyName}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="credit__total">{formatGNF(agreement.amount)}</div>
                      <div className="credit__muted">{getPlanLabel(agreement.plan)}</div>
                    </div>
                  </div>

                  <div className="credit__muted" style={{ marginTop: 8 }}>
                    Demande créée le {formatDateTime(agreement.createdAt)} ·{" "}
                    <Link to={`/orders/${agreement.orderDocId}`}>Voir la commande</Link>
                  </div>

                  {Array.isArray(agreement.installments) && (
                    <div className="credit__muted" style={{ marginTop: 4 }}>
                      Échéancier :{" "}
                      {agreement.installments
                        .map((item) => `${formatGNF(item.amount)} le ${formatDueDate(item.dueDate)}`)
                        .join(" · ")}
                    </div>
                  )}

                  {agreement.review && (
                    <div className="credit__muted" style={{ marginTop: 4 }}>
                      Décision Monmarché : {agreement.review.approved ? "transmise" : "refusée"} par{" "}
                      {agreement.review.byName} le {formatDateTime(agreement.review.at)}
                      {agreement.review.note ? ` — « ${agreement.review.note} »` : ""}
                    </div>
                  )}
                  {agreement.companyDecision && (
                    <div className="credit__muted" style={{ marginTop: 4 }}>
                      Décision entreprise : {agreement.companyDecision.approved ? "validée" : "refusée"} par{" "}
                      {agreement.companyDecision.byName} le {formatDateTime(agreement.companyDecision.at)}
                      {agreement.companyDecision.note ? ` — « ${agreement.companyDecision.note} »` : ""}
                    </div>
                  )}

                  {isWaitingLong && (
                    <div className="credit__banner credit__banner--info" style={{ marginTop: 10, marginBottom: 0 }}>
                      Chez l'entreprise depuis plus de 48h.
                    </div>
                  )}

                  <div className="credit__actions" style={{ marginTop: 12 }}>
                    {activeTab === "pending_review" && (
                      <>
                        <button
                          type="button"
                          className="credit__button credit__button--primary"
                          disabled={actionRunning}
                          onClick={() => handleTransmit(agreement)}
                        >
                          Transmettre à l'entreprise
                        </button>
                        <button
                          type="button"
                          className="credit__button credit__button--danger"
                          disabled={actionRunning}
                          onClick={() => {
                            setRejectTarget(agreement);
                            setRejectNote("");
                            setRejectError("");
                          }}
                        >
                          Refuser
                        </button>
                      </>
                    )}
                    {activeTab === "company_approved" && (
                      <button
                        type="button"
                        className="credit__button credit__button--primary"
                        disabled={actionRunning}
                        onClick={() => handleRelease(agreement)}
                      >
                        Lancer la livraison
                      </button>
                    )}
                    {activeTab === "company_rejected" && (
                      <button
                        type="button"
                        className="credit__button credit__button--danger"
                        disabled={actionRunning}
                        onClick={() => setConfirmAction(agreement)}
                      >
                        Clôturer
                      </button>
                    )}
                  </div>

                  {activeTab === "company_rejected" && agreement.companyDecision?.note && (
                    <p className="credit__muted" style={{ marginTop: 8 }}>
                      Motif du refus : {agreement.companyDecision.note}
                    </p>
                  )}
                  {(activeTab === "history" || activeTab === "company_rejected" || activeTab === "pending_company_approval" || activeTab === "company_approved") && (
                    <span className={`credit__pill credit__pill--${agreement.status}`} style={{ marginTop: 10, display: "inline-block" }}>
                      {getAgreementStatusLabel(agreement.status)}
                    </span>
                  )}
                </div>
              );
            })}
        </section>

        <ConfirmModal
          open={Boolean(rejectTarget)}
          title="Refuser la demande"
          onClose={() => !actionRunning && setRejectTarget(null)}
          onConfirm={handleReject}
          confirmText="Refuser"
          confirmButtonClassName="confirmModal__button--strongConfirm"
          loading={actionRunning}
        >
          <div className="workModal__field">
            <label htmlFor="credit-reject-note">Motif du refus</label>
            <textarea
              id="credit-reject-note"
              value={rejectNote}
              onChange={(event) => {
                setRejectNote(event.target.value);
                if (rejectError) setRejectError("");
              }}
              rows={4}
              disabled={actionRunning}
            />
          </div>
          {rejectError && <p className="workModal__error">{rejectError}</p>}
        </ConfirmModal>

        <ConfirmModal
          open={Boolean(confirmAction)}
          title="Clôturer la demande"
          onClose={() => !actionRunning && setConfirmAction(null)}
          onConfirm={() => handleClose(confirmAction)}
          confirmText="Clôturer"
          confirmButtonClassName="confirmModal__button--strongConfirm"
          loading={actionRunning}
        >
          <p>
            La demande sera définitivement refusée. Pensez à contacter l'employé (
            {confirmAction?.memberPhone}) pour qu'il paie la totalité de sa commande.
          </p>
        </ConfirmModal>

        <FeedbackPopup
          open={feedback.open}
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        />
      </main>
    </div>
  );
};

export default CreditRequests;
