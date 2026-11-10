import "./credit.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { auth, db } from "../../firebase";
import { daysLate, formatDateTime, formatDueDate, formatGNF } from "./creditFormat";
import { todayConakry } from "../../utils/credit";
import {
  getAgreementStatusLabel,
  getPaymentMethodLabel,
  getPlanLabel,
  loadAgreement,
  loadAgreementPayments,
  loadAgreementReminders,
  recordCreditPayment,
  reverseCreditPayment,
  sendCreditReminder,
} from "../../utils/creditRepository";

const PAYMENT_METHODS = [
  { value: "orange_money", label: "Orange Money" },
  { value: "cash", label: "Espèces" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "other", label: "Autre" },
];

const REMINDER_CHANNELS = [
  { value: "push", label: "Notification push" },
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS (fait à la main)" },
  { value: "phone", label: "Appel téléphonique (fait à la main)" },
];

const getAdmin = () => ({
  uid: auth.currentUser?.uid,
  name: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
});

const buildDefaultReminderMessage = (agreement) => {
  const firstName = (agreement?.memberName || "").split(" ")[0] || "client";
  const nextInstallment = Array.isArray(agreement?.installments)
    ? [...agreement.installments].sort((a, b) => a.index - b.index).find((i) => i.paid < i.amount)
    : null;
  const amount = nextInstallment ? formatGNF(nextInstallment.amount - nextInstallment.paid) : "";
  const due = nextInstallment ? formatDueDate(nextInstallment.dueDate) : "";
  return `Bonjour ${firstName}, votre échéance de ${amount} GNF du ${due} pour votre commande Monmarché n'a pas encore été réglée. Merci de régulariser votre situation rapidement.`;
};

const CreditAgreementDetails = () => {
  const { agreementId } = useParams();
  const [agreement, setAgreement] = useState(null);
  const [payments, setPayments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [customerEmail, setCustomerEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, type: "success", message: "" });

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("orange_money");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const [reverseTarget, setReverseTarget] = useState(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseError, setReverseError] = useState("");

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderChannel, setReminderChannel] = useState("push");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderError, setReminderError] = useState("");

  const [actionRunning, setActionRunning] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(false);
    try {
      const [agreementData, paymentsData, remindersData] = await Promise.all([
        loadAgreement(agreementId),
        loadAgreementPayments(agreementId),
        loadAgreementReminders(agreementId),
      ]);
      if (!agreementData) {
        setError(true);
        return;
      }
      setAgreement(agreementData);
      setPayments(paymentsData);
      setReminders(remindersData);
      setReminderMessage(buildDefaultReminderMessage(agreementData));

      const userSnap = await getDoc(doc(db, "users", agreementData.uid));
      setCustomerEmail(userSnap.exists() ? userSnap.data()?.email || null : null);
    } catch (err) {
      console.error("Failed to load credit agreement:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreementId]);

  const remaining = useMemo(
    () => (agreement ? Math.max(0, (agreement.amount || 0) - (agreement.paid || 0)) : 0),
    [agreement]
  );
  const today = todayConakry();

  const openPaymentModal = () => {
    setPaymentAmount(String(remaining));
    setPaymentMethod("orange_money");
    setPaymentReference("");
    setPaymentError("");
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Montant invalide.");
      return;
    }
    setActionRunning(true);
    try {
      await recordCreditPayment(agreementId, {
        amount,
        method: paymentMethod,
        reference: paymentReference.trim(),
        admin: getAdmin(),
      });
      setPaymentModalOpen(false);
      setFeedback({ open: true, type: "success", message: "Paiement enregistré." });
      await loadAll();
    } catch (err) {
      setPaymentError(err?.message || "Impossible d'enregistrer ce paiement.");
    } finally {
      setActionRunning(false);
    }
  };

  const handleReversePayment = async () => {
    if (!reverseReason.trim()) {
      setReverseError("Le motif est obligatoire.");
      return;
    }
    setActionRunning(true);
    try {
      await reverseCreditPayment(reverseTarget.id, {
        reason: reverseReason.trim(),
        admin: getAdmin(),
      });
      setReverseTarget(null);
      setReverseReason("");
      setFeedback({ open: true, type: "success", message: "Paiement annulé." });
      await loadAll();
    } catch (err) {
      setReverseError(err?.message || "Impossible d'annuler ce paiement.");
    } finally {
      setActionRunning(false);
    }
  };

  const nextUnpaidIndex = useMemo(() => {
    if (!Array.isArray(agreement?.installments)) return null;
    const sorted = [...agreement.installments].sort((a, b) => a.index - b.index);
    const found = sorted.find((i) => i.paid < i.amount);
    return found ? found.index : null;
  }, [agreement]);

  const handleSendReminder = async () => {
    if (!reminderMessage.trim()) {
      setReminderError("Le message est obligatoire.");
      return;
    }
    setActionRunning(true);
    try {
      await sendCreditReminder(agreementId, {
        channel: reminderChannel,
        message: reminderMessage.trim(),
        installmentIndex: nextUnpaidIndex,
        admin: getAdmin(),
      });
      setReminderModalOpen(false);
      setFeedback({ open: true, type: "success", message: "Rappel envoyé." });
      await loadAll();
    } catch (err) {
      setReminderError(err?.message || "Impossible d'envoyer ce rappel.");
    } finally {
      setActionRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="credit">
        <Sidebar />
        <main className="credit__container">
          <Navbar />
          <p className="credit__empty">Chargement...</p>
        </main>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="credit">
        <Sidebar />
        <main className="credit__container">
          <Navbar />
          <div className="credit__banner credit__banner--error">Crédit introuvable.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="credit">
      <Sidebar />
      <main className="credit__container">
        <Navbar />
        <Link to="/admin/credit/debiteurs" className="credit__back">
          ← Débiteurs et échéances
        </Link>
        <header className="credit__header">
          <div>
            <h1>{agreement.memberName}</h1>
            <p>
              {agreement.companyName} · {agreement.memberPhone} ·{" "}
              <span className={`credit__pill credit__pill--${agreement.status}`}>
                {getAgreementStatusLabel(agreement.status)}
              </span>
            </p>
          </div>
          <div className="credit__actions">
            <button type="button" className="credit__button credit__button--primary" onClick={openPaymentModal}>
              Enregistrer un paiement
            </button>
            <button
              type="button"
              className="credit__button"
              onClick={() => {
                setReminderChannel("push");
                setReminderMessage(buildDefaultReminderMessage(agreement));
                setReminderError("");
                setReminderModalOpen(true);
              }}
            >
              Envoyer un rappel
            </button>
          </div>
        </header>

        <section className="credit__panel">
          <h2>Résumé</h2>
          <div className="credit__cards">
            <div className="credit__card">
              <span>Formule</span>
              <strong>{getPlanLabel(agreement.plan)}</strong>
            </div>
            <div className="credit__card">
              <span>Montant</span>
              <strong>{formatGNF(agreement.amount)}</strong>
            </div>
            <div className="credit__card">
              <span>Payé</span>
              <strong>{formatGNF(agreement.paid)}</strong>
            </div>
            <div className="credit__card credit__card--alert">
              <span>Reste dû</span>
              <strong>{formatGNF(remaining)}</strong>
            </div>
          </div>
          <p className="credit__muted" style={{ marginTop: 10 }}>
            Commande : <Link to={`/orders/${agreement.orderDocId}`}>{agreement.orderId || agreement.orderDocId}</Link>
            {" · "}Client : <Link to={`/users/${agreement.uid}`}>fiche client</Link>
          </p>
        </section>

        <section className="credit__panel">
          <h2>Échéancier</h2>
          <div className="credit__installments">
            {(agreement.installments || []).map((item) => {
              const late = daysLate(item.dueDate, today);
              const isPaid = item.paid >= item.amount;
              return (
                <div
                  key={item.index}
                  className={`credit__installmentRow ${
                    isPaid ? "credit__installmentRow--paid" : late > 0 ? "credit__installmentRow--late" : ""
                  }`}
                >
                  <span>Échéance {item.index + 1} — {formatDueDate(item.dueDate)}</span>
                  <span>
                    {formatGNF(item.paid)} / {formatGNF(item.amount)}
                  </span>
                  <span className={`credit__pill credit__pill--${isPaid ? "settled" : late > 0 ? "late" : "active"}`}>
                    {isPaid ? "Payée" : late > 0 ? `En retard (${late} j)` : "À venir"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="credit__panel">
          <h2>Paiements</h2>
          {!payments.length && <p className="credit__empty">Aucun paiement enregistré.</p>}
          {payments.length > 0 && (
            <table className="credit__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Moyen</th>
                  <th>Référence</th>
                  <th>Enregistré par</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateTime(payment.recordedAt)}</td>
                    <td style={{ color: payment.amount < 0 ? "#b91c1c" : undefined }}>
                      {formatGNF(payment.amount)}
                    </td>
                    <td>{getPaymentMethodLabel(payment.method)}</td>
                    <td>{payment.reference || "—"}</td>
                    <td>{payment.recordedByName}</td>
                    <td>
                      {payment.amount > 0 && !payment.reversalOf && (
                        <button
                          type="button"
                          className="credit__button credit__button--danger"
                          onClick={() => {
                            setReverseTarget(payment);
                            setReverseReason("");
                            setReverseError("");
                          }}
                        >
                          Annuler
                        </button>
                      )}
                      {payment.reversalOf && <span className="credit__muted">Annulation</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="credit__panel">
          <h2>Rappels</h2>
          {!reminders.length && <p className="credit__empty">Aucun rappel envoyé.</p>}
          {reminders.length > 0 && (
            <table className="credit__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Canal</th>
                  <th>Message</th>
                  <th>Envoyé par</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((reminder) => (
                  <tr key={reminder.id}>
                    <td>{formatDateTime(reminder.createdAt)}</td>
                    <td>{REMINDER_CHANNELS.find((c) => c.value === reminder.channel)?.label || reminder.channel}</td>
                    <td style={{ maxWidth: 360 }}>{reminder.message}</td>
                    <td>{reminder.sentByName}</td>
                    <td>{reminder.delivery === "queued" ? "En attente d'envoi" : "Noté"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <ConfirmModal
          open={paymentModalOpen}
          title="Enregistrer un paiement"
          onClose={() => !actionRunning && setPaymentModalOpen(false)}
          onConfirm={handleRecordPayment}
          confirmText="Enregistrer"
          loading={actionRunning}
        >
          <div className="workModal__field">
            <label htmlFor="credit-payment-amount">Montant (GNF)</label>
            <input
              id="credit-payment-amount"
              type="number"
              min={1}
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              disabled={actionRunning}
            />
          </div>
          <div className="workModal__field">
            <label htmlFor="credit-payment-method">Moyen de paiement</label>
            <select
              id="credit-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              disabled={actionRunning}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="workModal__field">
            <label htmlFor="credit-payment-reference">Référence</label>
            <input
              id="credit-payment-reference"
              type="text"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="N° de transaction, de reçu..."
              disabled={actionRunning}
            />
          </div>
          {paymentError && <p className="workModal__error">{paymentError}</p>}
        </ConfirmModal>

        <ConfirmModal
          open={Boolean(reverseTarget)}
          title="Annuler ce paiement"
          onClose={() => !actionRunning && setReverseTarget(null)}
          onConfirm={handleReversePayment}
          confirmText="Annuler le paiement"
          confirmButtonClassName="confirmModal__button--strongConfirm"
          loading={actionRunning}
        >
          <p>
            Ce paiement de {reverseTarget ? formatGNF(reverseTarget.amount) : ""} sera annulé (un nouveau
            document sera créé, l'original n'est jamais modifié).
          </p>
          <div className="workModal__field">
            <label htmlFor="credit-reverse-reason">Motif</label>
            <textarea
              id="credit-reverse-reason"
              value={reverseReason}
              onChange={(event) => {
                setReverseReason(event.target.value);
                if (reverseError) setReverseError("");
              }}
              rows={3}
              disabled={actionRunning}
            />
          </div>
          {reverseError && <p className="workModal__error">{reverseError}</p>}
        </ConfirmModal>

        <ConfirmModal
          open={reminderModalOpen}
          title="Envoyer un rappel"
          onClose={() => !actionRunning && setReminderModalOpen(false)}
          onConfirm={handleSendReminder}
          confirmText="Envoyer"
          loading={actionRunning}
        >
          <div className="workModal__field">
            <label htmlFor="credit-reminder-channel">Canal</label>
            <select
              id="credit-reminder-channel"
              value={reminderChannel}
              onChange={(event) => setReminderChannel(event.target.value)}
              disabled={actionRunning}
            >
              {REMINDER_CHANNELS.map((c) => (
                <option key={c.value} value={c.value} disabled={c.value === "email" && !customerEmail}>
                  {c.label}
                  {c.value === "email" && !customerEmail ? " (pas d'e-mail)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="workModal__field">
            <label htmlFor="credit-reminder-message">Message</label>
            <textarea
              id="credit-reminder-message"
              value={reminderMessage}
              onChange={(event) => {
                setReminderMessage(event.target.value);
                if (reminderError) setReminderError("");
              }}
              rows={5}
              disabled={actionRunning}
            />
          </div>
          {reminderError && <p className="workModal__error">{reminderError}</p>}
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

export default CreditAgreementDetails;
