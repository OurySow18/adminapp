import "./credit.scss";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { AuthContext } from "../../context/AuthContext";
import { auth } from "../../firebase";
import { SUPER_ADMIN_UID } from "../../config/adminConfig";
import { formatGNF } from "./creditFormat";
import {
  loadAgreementsByStatus,
  loadCompanies,
  loadDebtorAgreements,
} from "../../utils/creditRepository";
import { createCreditTestData, deleteCreditTestData } from "../../utils/creditTestData";

const CreditDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const isSuperAdmin = currentUser?.uid === SUPER_ADMIN_UID;

  const [counts, setCounts] = useState({
    pendingReview: 0,
    pendingCompany: 0,
    readyToRelease: 0,
    toClose: 0,
    lateCount: 0,
    lateAmount: 0,
    outstandingTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, type: "success", message: "" });

  const loadDashboard = async () => {
    setLoading(true);
    setError(false);
    try {
      const [pendingReview, pendingCompany, companyApproved, companyRejected, debtors, companies] =
        await Promise.all([
          loadAgreementsByStatus("pending_review"),
          loadAgreementsByStatus("pending_company_approval"),
          loadAgreementsByStatus("company_approved"),
          loadAgreementsByStatus("company_rejected"),
          loadDebtorAgreements(),
          loadCompanies(),
        ]);
      const lateAgreements = debtors.filter((a) => a.status === "late");
      const lateAmount = lateAgreements.reduce(
        (sum, a) => sum + Math.max(0, (a.amount || 0) - (a.paid || 0)),
        0
      );
      const outstandingTotal = companies.reduce((sum, c) => sum + (c.outstanding || 0), 0);

      setCounts({
        pendingReview: pendingReview.length,
        pendingCompany: pendingCompany.length,
        readyToRelease: companyApproved.length,
        toClose: companyRejected.length,
        lateCount: lateAgreements.length,
        lateAmount,
        outstandingTotal,
      });
    } catch (err) {
      console.error("Failed to load credit dashboard:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const runTestAction = async (action) => {
    setActionRunning(true);
    try {
      if (action === "create") {
        const admin = {
          uid: auth.currentUser?.uid,
          name: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
          email: auth.currentUser?.email ?? "",
        };
        await createCreditTestData(admin);
        setFeedback({ open: true, type: "success", message: "Données de test créées." });
      } else {
        const result = await deleteCreditTestData();
        const total = Object.values(result).reduce((sum, n) => sum + n, 0);
        setFeedback({
          open: true,
          type: "success",
          message: `${total} document(s) de test supprimé(s).`,
        });
      }
      setConfirmAction(null);
      await loadDashboard();
    } catch (err) {
      console.error("Erreur données de test crédit:", err);
      setFeedback({
        open: true,
        type: "error",
        message: err?.message || "Une erreur est survenue.",
      });
    } finally {
      setActionRunning(false);
    }
  };

  const cards = [
    { key: "review", label: "À examiner", value: counts.pendingReview, to: "/admin/credit/demandes?tab=pending_review" },
    { key: "company", label: "Chez l'entreprise", value: counts.pendingCompany, to: "/admin/credit/demandes?tab=pending_company_approval" },
    { key: "release", label: "À livrer", value: counts.readyToRelease, to: "/admin/credit/demandes?tab=company_approved" },
    { key: "close", label: "Refus à clôturer", value: counts.toClose, to: "/admin/credit/demandes?tab=company_rejected" },
    { key: "outstanding", label: "Encours total", value: formatGNF(counts.outstandingTotal), to: "/admin/credit/entreprises" },
    { key: "late", label: "Crédits en retard", value: counts.lateCount, to: "/admin/credit/debiteurs?late=1", alert: counts.lateCount > 0 },
    { key: "lateAmount", label: "Montant en retard", value: formatGNF(counts.lateAmount), to: "/admin/credit/debiteurs?late=1", alert: counts.lateAmount > 0 },
  ];

  return (
    <div className="credit">
      <Sidebar />
      <main className="credit__container">
        <Navbar />
        <header className="credit__header">
          <div>
            <h1>Crédit entreprise</h1>
            <p>
              Vue d'ensemble des demandes de crédit salarié, de l'encours et des
              retards de paiement.
            </p>
          </div>
          {isSuperAdmin && (
            <div className="credit__actions">
              <button
                type="button"
                className="credit__button"
                onClick={() => setConfirmAction("create")}
              >
                Créer des données de test
              </button>
              <button
                type="button"
                className="credit__button credit__button--danger"
                onClick={() => setConfirmAction("delete")}
              >
                Supprimer les données de test
              </button>
            </div>
          )}
        </header>

        {error && (
          <div className="credit__banner credit__banner--error">
            Impossible de charger le tableau de bord.
          </div>
        )}

        {loading ? (
          <p className="credit__empty">Chargement...</p>
        ) : (
          <div className="credit__cards">
            {cards.map((card) => (
              <Link
                key={card.key}
                to={card.to}
                className={`credit__card ${card.alert ? "credit__card--alert" : ""}`}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </Link>
            ))}
          </div>
        )}

        <ConfirmModal
          open={Boolean(confirmAction)}
          title={
            confirmAction === "create"
              ? "Créer des données de test"
              : "Supprimer les données de test"
          }
          onClose={() => !actionRunning && setConfirmAction(null)}
          onConfirm={() => runTestAction(confirmAction)}
          confirmText={confirmAction === "create" ? "Créer" : "Supprimer"}
          confirmButtonClassName={
            confirmAction === "delete" ? "confirmModal__button--strongConfirm" : ""
          }
          loading={actionRunning}
        >
          {confirmAction === "create" ? (
            <p>
              Crée une entreprise de test, un employé rattaché à votre propre
              compte, et trois demandes de crédit à des statuts différents
              (toutes marquées <code>isTest: true</code>).
            </p>
          ) : (
            <p>
              Supprime définitivement tous les documents marqués{" "}
              <code>isTest: true</code> du module crédit (entreprises, employés,
              demandes, paiements, rappels, commandes de test).
            </p>
          )}
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

export default CreditDashboard;
