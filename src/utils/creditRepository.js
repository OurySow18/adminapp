// Acces Firestore et transactions pour le module Credit entreprise. Les noms
// de collections/champs/statuts sont partages avec le portail entreprise et
// l'app mobile : ne pas les renommer ici sans les repercuter partout.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  agreementStatus,
  allocatePayment,
  installmentStatus,
  nextDueDate,
  remainingAmount,
  todayConakry,
} from "./credit";

export const COMPANIES_COLLECTION = "companies";
export const COMPANY_ADMINS_COLLECTION = "companyAdmins";
export const COMPANY_MEMBERS_COLLECTION = "companyMembers";
export const CREDIT_AGREEMENTS_COLLECTION = "creditAgreements";
export const CREDIT_PAYMENTS_COLLECTION = "creditPayments";
export const CREDIT_REMINDERS_COLLECTION = "creditReminders";

export const PLAN_LABELS = {
  end_of_month: "Fin de mois",
  three_months: "3 mois",
};

export const AGREEMENT_STATUS_LABELS = {
  pending_review: "À examiner",
  pending_company_approval: "Chez l'entreprise",
  company_approved: "Validée par l'entreprise",
  company_rejected: "Refusée par l'entreprise",
  active: "Active",
  late: "En retard",
  settled: "Soldée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

export const getAgreementStatusLabel = (status) =>
  AGREEMENT_STATUS_LABELS[status] || status || "—";

export const getPlanLabel = (plan) => PLAN_LABELS[plan] || plan || "—";

export const memberDocId = (companyId, uid) => `${companyId}__${uid}`;

const PAYMENT_METHOD_LABELS = {
  orange_money: "Orange Money",
  cash: "Espèces",
  bank_transfer: "Virement bancaire",
  other: "Autre",
};

export const getPaymentMethodLabel = (method) =>
  PAYMENT_METHOD_LABELS[method] || method || "—";

// --------------------------------------------------------------------------
// Lectures
// --------------------------------------------------------------------------

export const loadAgreementsByStatus = async (status) => {
  const q = query(
    collection(db, CREDIT_AGREEMENTS_COLLECTION),
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const loadHistoryAgreements = async () => {
  const [rejected, cancelled] = await Promise.all([
    loadAgreementsByStatus("rejected"),
    loadAgreementsByStatus("cancelled"),
  ]);
  return [...rejected, ...cancelled].sort(
    (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
  );
};

// active + late, triees par echeance la plus ancienne d'abord (les plus en
// retard en premier).
export const loadDebtorAgreements = async () => {
  const q = query(
    collection(db, CREDIT_AGREEMENTS_COLLECTION),
    where("status", "in", ["active", "late"]),
    orderBy("nextDueDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const loadAgreement = async (agreementId) => {
  const snap = await getDoc(doc(db, CREDIT_AGREEMENTS_COLLECTION, agreementId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const loadAgreementPayments = async (agreementId) => {
  const q = query(
    collection(db, CREDIT_PAYMENTS_COLLECTION),
    where("agreementId", "==", agreementId),
    orderBy("recordedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const loadAgreementReminders = async (agreementId) => {
  const q = query(
    collection(db, CREDIT_REMINDERS_COLLECTION),
    where("agreementId", "==", agreementId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const loadCompanies = async () => {
  const snap = await getDocs(collection(db, COMPANIES_COLLECTION));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const loadCompany = async (companyId) => {
  const snap = await getDoc(doc(db, COMPANIES_COLLECTION, companyId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const loadCompanyMembers = async (companyId) => {
  const q = query(
    collection(db, COMPANY_MEMBERS_COLLECTION),
    where("companyId", "==", companyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const loadCompanyAdmins = async (companyId) => {
  const q = query(
    collection(db, COMPANY_ADMINS_COLLECTION),
    where("companyId", "==", companyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

// Paiements les plus recents, filtres par entreprise si fourni (necessite
// l'index composite companyId+recordedAt). Sans filtre, simple orderBy, deja
// auto-indexe.
export const loadPayments = async ({ companyId = null, limitCount = 200 } = {}) => {
  const constraints = [];
  if (companyId) constraints.push(where("companyId", "==", companyId));
  constraints.push(orderBy("recordedAt", "desc"));
  constraints.push(limitDocs(limitCount));
  const q = query(collection(db, CREDIT_PAYMENTS_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

// --------------------------------------------------------------------------
// Aide interne : libere l'encours reserve (entreprise + employe) pour un
// credit qui n'ira finalement jamais en livraison (refuse / annule).
// --------------------------------------------------------------------------
const releaseOutstanding = (tx, agreement, companyRef, memberRef, companySnap, memberSnap) => {
  const reserved =
    Array.isArray(agreement.installments) && agreement.installments.length
      ? remainingAmount(agreement.installments)
      : Math.max(0, (agreement.amount || 0) - (agreement.paid || 0));
  if (reserved <= 0) return;
  if (companySnap?.exists()) {
    tx.update(companyRef, {
      outstanding: Math.max(0, (companySnap.data().outstanding || 0) - reserved),
      updatedAt: serverTimestamp(),
    });
  }
  if (memberSnap?.exists()) {
    tx.update(memberRef, {
      outstanding: Math.max(0, (memberSnap.data().outstanding || 0) - reserved),
      updatedAt: serverTimestamp(),
    });
  }
};

// --------------------------------------------------------------------------
// Actions (transactions)
// --------------------------------------------------------------------------

const STALE_MESSAGE = "Cette demande a changé, rechargez la page.";

// Transmet (approve=true) ou refuse (approve=false, note obligatoire) une
// demande "pending_review".
export const reviewAgreement = async (agreementId, { approve, note, admin }) => {
  const agreementRef = doc(db, CREDIT_AGREEMENTS_COLLECTION, agreementId);

  await runTransaction(db, async (tx) => {
    const agreementSnap = await tx.get(agreementRef);
    if (!agreementSnap.exists()) throw new Error("Demande introuvable.");
    const agreement = agreementSnap.data();
    if (agreement.status !== "pending_review") throw new Error(STALE_MESSAGE);

    const review = {
      approved: approve,
      by: admin.uid,
      byName: admin.name,
      at: serverTimestamp(),
      ...(note ? { note } : {}),
    };

    if (approve) {
      tx.update(agreementRef, {
        status: "pending_company_approval",
        review,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const companyRef = doc(db, COMPANIES_COLLECTION, agreement.companyId);
    const memberRef = doc(
      db,
      COMPANY_MEMBERS_COLLECTION,
      memberDocId(agreement.companyId, agreement.uid)
    );
    const [companySnap, memberSnap] = await Promise.all([
      tx.get(companyRef),
      tx.get(memberRef),
    ]);
    releaseOutstanding(tx, agreement, companyRef, memberRef, companySnap, memberSnap);

    tx.update(agreementRef, {
      status: "rejected",
      review,
      updatedAt: serverTimestamp(),
    });
    if (agreement.orderDocId) {
      tx.update(doc(db, "orders", agreement.orderDocId), {
        orderStatus: "awaiting_payment",
      });
    }
  });
};

// Lance la livraison d'un credit "company_approved" -> "active" (ou "late"
// d'emblee si une echeance est deja depassee, cas limite).
export const releaseAgreementDelivery = async (agreementId, { admin }) => {
  const agreementRef = doc(db, CREDIT_AGREEMENTS_COLLECTION, agreementId);

  await runTransaction(db, async (tx) => {
    const agreementSnap = await tx.get(agreementRef);
    if (!agreementSnap.exists()) throw new Error("Demande introuvable.");
    const agreement = agreementSnap.data();
    if (agreement.status !== "company_approved") throw new Error(STALE_MESSAGE);

    const today = todayConakry();
    const installments = Array.isArray(agreement.installments) ? agreement.installments : [];
    const nextStatus = agreementStatus("active", installments, today);

    tx.update(agreementRef, {
      status: nextStatus,
      releasedBy: admin.uid,
      releasedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (agreement.orderDocId) {
      tx.update(doc(db, "orders", agreement.orderDocId), {
        orderStatus: "confirmed",
      });
    }
  });
};

// Cloture definitivement un credit refuse par l'entreprise
// ("company_rejected" -> "rejected"), libere l'encours.
export const closeCompanyRejectedAgreement = async (agreementId, { admin }) => {
  const agreementRef = doc(db, CREDIT_AGREEMENTS_COLLECTION, agreementId);

  await runTransaction(db, async (tx) => {
    const agreementSnap = await tx.get(agreementRef);
    if (!agreementSnap.exists()) throw new Error("Demande introuvable.");
    const agreement = agreementSnap.data();
    if (agreement.status !== "company_rejected") throw new Error(STALE_MESSAGE);

    const companyRef = doc(db, COMPANIES_COLLECTION, agreement.companyId);
    const memberRef = doc(
      db,
      COMPANY_MEMBERS_COLLECTION,
      memberDocId(agreement.companyId, agreement.uid)
    );
    const [companySnap, memberSnap] = await Promise.all([
      tx.get(companyRef),
      tx.get(memberRef),
    ]);
    releaseOutstanding(tx, agreement, companyRef, memberRef, companySnap, memberSnap);

    tx.update(agreementRef, {
      status: "rejected",
      closedBy: admin.uid,
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (agreement.orderDocId) {
      tx.update(doc(db, "orders", agreement.orderDocId), {
        orderStatus: "awaiting_payment",
      });
    }
  });
};

// Enregistre un paiement sur un credit actif/en retard. Rejette si le
// montant depasse le reste du (excess > 0).
export const recordCreditPayment = async (agreementId, { amount, method, reference, admin }) => {
  const agreementRef = doc(db, CREDIT_AGREEMENTS_COLLECTION, agreementId);
  const companiesRef = collection(db, COMPANIES_COLLECTION);
  const paymentsRef = collection(db, CREDIT_PAYMENTS_COLLECTION);

  await runTransaction(db, async (tx) => {
    const agreementSnap = await tx.get(agreementRef);
    if (!agreementSnap.exists()) throw new Error("Crédit introuvable.");
    const agreement = agreementSnap.data();
    if (!["active", "late"].includes(agreement.status)) throw new Error(STALE_MESSAGE);

    const today = todayConakry();
    const installments = Array.isArray(agreement.installments) ? agreement.installments : [];
    const { installments: nextInstallments, excess } = allocatePayment(installments, amount);
    if (excess > 0) {
      throw new Error(
        `Le paiement dépasse le reste dû de ${excess.toLocaleString("fr-FR")} GNF.`
      );
    }

    const finalInstallments = nextInstallments.map((item) => ({
      ...item,
      status: installmentStatus(item, today),
      ...(item.paid >= item.amount && !item.paidAt ? { paidAt: new Date().toISOString() } : {}),
    }));
    const nextPaid = (agreement.paid || 0) + amount;
    const nextStatus = agreementStatus(agreement.status, finalInstallments, today);
    const nextDue = nextDueDate(finalInstallments) ?? null;

    const companyRef = doc(companiesRef, agreement.companyId);
    const memberRef = doc(
      db,
      COMPANY_MEMBERS_COLLECTION,
      memberDocId(agreement.companyId, agreement.uid)
    );
    const [companySnap, memberSnap] = await Promise.all([
      tx.get(companyRef),
      tx.get(memberRef),
    ]);

    tx.update(agreementRef, {
      installments: finalInstallments,
      paid: nextPaid,
      status: nextStatus,
      nextDueDate: nextDue,
      updatedAt: serverTimestamp(),
    });

    if (companySnap.exists()) {
      tx.update(companyRef, {
        outstanding: Math.max(0, (companySnap.data().outstanding || 0) - amount),
        updatedAt: serverTimestamp(),
      });
    }
    if (memberSnap.exists()) {
      tx.update(memberRef, {
        outstanding: Math.max(0, (memberSnap.data().outstanding || 0) - amount),
        updatedAt: serverTimestamp(),
      });
    }

    const paymentRef = doc(paymentsRef);
    tx.set(paymentRef, {
      agreementId,
      companyId: agreement.companyId,
      uid: agreement.uid,
      amount,
      method,
      reference: reference || "",
      recordedBy: admin.uid,
      recordedByName: admin.name,
      recordedAt: serverTimestamp(),
    });
  });
};

// Annule un paiement deja enregistre (motif obligatoire) : cree un nouveau
// document creditPayments avec un montant negatif, ne modifie jamais
// l'original.
export const reverseCreditPayment = async (paymentId, { reason, admin }) => {
  const paymentRef = doc(db, CREDIT_PAYMENTS_COLLECTION, paymentId);
  const paymentSnap = await getDoc(paymentRef);
  if (!paymentSnap.exists()) throw new Error("Paiement introuvable.");
  const payment = paymentSnap.data();
  if (payment.amount <= 0) throw new Error("Ce paiement est déjà une annulation.");

  const agreementRef = doc(db, CREDIT_AGREEMENTS_COLLECTION, payment.agreementId);

  await runTransaction(db, async (tx) => {
    const agreementSnap = await tx.get(agreementRef);
    if (!agreementSnap.exists()) throw new Error("Crédit introuvable.");
    const agreement = agreementSnap.data();

    const today = todayConakry();
    const installments = Array.isArray(agreement.installments) ? agreement.installments : [];
    const { installments: nextInstallments } = allocatePayment(installments, -payment.amount);
    const finalInstallments = nextInstallments.map((item) => ({
      ...item,
      status: installmentStatus(item, today),
    }));
    const nextPaid = Math.max(0, (agreement.paid || 0) - payment.amount);
    const nextStatus = agreementStatus(agreement.status, finalInstallments, today);
    const nextDue = nextDueDate(finalInstallments) ?? null;

    const companyRef = doc(db, COMPANIES_COLLECTION, agreement.companyId);
    const memberRef = doc(
      db,
      COMPANY_MEMBERS_COLLECTION,
      memberDocId(agreement.companyId, agreement.uid)
    );
    const [companySnap, memberSnap] = await Promise.all([
      tx.get(companyRef),
      tx.get(memberRef),
    ]);

    tx.update(agreementRef, {
      installments: finalInstallments,
      paid: nextPaid,
      status: nextStatus,
      nextDueDate: nextDue,
      updatedAt: serverTimestamp(),
    });
    if (companySnap.exists()) {
      tx.update(companyRef, {
        outstanding: (companySnap.data().outstanding || 0) + payment.amount,
        updatedAt: serverTimestamp(),
      });
    }
    if (memberSnap.exists()) {
      tx.update(memberRef, {
        outstanding: (memberSnap.data().outstanding || 0) + payment.amount,
        updatedAt: serverTimestamp(),
      });
    }

    const reversalRef = doc(collection(db, CREDIT_PAYMENTS_COLLECTION));
    tx.set(reversalRef, {
      agreementId: payment.agreementId,
      companyId: payment.companyId,
      uid: payment.uid,
      amount: -payment.amount,
      method: payment.method,
      reference: reason,
      recordedBy: admin.uid,
      recordedByName: admin.name,
      recordedAt: serverTimestamp(),
      reversalOf: paymentId,
    });
  });
};

// Envoie un rappel (push/email : documente + file d'attente ; sms/phone :
// simplement note comme fait a la main).
export const sendCreditReminder = async (
  agreementId,
  { channel, message, installmentIndex, admin }
) => {
  const agreementRef = doc(db, CREDIT_AGREEMENTS_COLLECTION, agreementId);
  const agreement = await loadAgreement(agreementId);
  if (!agreement) throw new Error("Crédit introuvable.");

  const delivery = channel === "push" || channel === "email" ? "queued" : "logged";

  await addDoc(collection(db, CREDIT_REMINDERS_COLLECTION), {
    agreementId,
    companyId: agreement.companyId,
    uid: agreement.uid,
    channel,
    message,
    installmentIndex,
    sentBy: admin.uid,
    sentByName: admin.name,
    createdAt: serverTimestamp(),
    delivery,
  });

  if (channel === "email") {
    const userSnap = await getDoc(doc(db, "users", agreement.uid));
    const email = userSnap.exists() ? userSnap.data()?.email : null;
    if (email) {
      await addDoc(collection(db, "mail"), {
        to: email,
        message: {
          subject: "Rappel d'échéance - Crédit Monmarché",
          text: message,
        },
      });
    }
  }

  const reminderCount = (agreement.reminderCount || 0) + 1;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(agreementRef);
    if (!snap.exists()) return;
    tx.update(agreementRef, {
      reminderCount,
      lastReminderAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

// Recalcule en lot le statut de tous les credits actifs/en retard (echeances
// + statut global) : a lancer manuellement depuis Debiteurs, en attendant la
// fonction planifiee quotidienne. Renvoie le nombre de credits mis a jour.
export const refreshOverdueAgreements = async () => {
  const agreements = await loadDebtorAgreements();
  const today = todayConakry();
  const updates = [];

  agreements.forEach((agreement) => {
    const installments = Array.isArray(agreement.installments) ? agreement.installments : [];
    const nextInstallments = installments.map((item) => ({
      ...item,
      status: installmentStatus(item, today),
    }));
    const nextStatus = agreementStatus(agreement.status, nextInstallments, today);
    const nextDue = nextDueDate(nextInstallments) ?? null;

    const changed =
      nextStatus !== agreement.status ||
      nextDue !== (agreement.nextDueDate ?? null) ||
      JSON.stringify(nextInstallments) !== JSON.stringify(installments);

    if (changed) {
      updates.push({
        id: agreement.id,
        installments: nextInstallments,
        status: nextStatus,
        nextDueDate: nextDue,
      });
    }
  });

  const chunkSize = 450;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const batch = writeBatch(db);
    updates.slice(i, i + chunkSize).forEach((update) => {
      batch.update(doc(db, CREDIT_AGREEMENTS_COLLECTION, update.id), {
        installments: update.installments,
        status: update.status,
        nextDueDate: update.nextDueDate,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return updates.length;
};
