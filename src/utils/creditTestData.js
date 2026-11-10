// Donnees de test pour le module Credit entreprise (visible uniquement du
// superAdmin). Tous les documents crees portent isTest: true, ce qui permet
// de tout supprimer proprement avec deleteCreditTestData().
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { agreementStatus, installmentStatus, nextDueDate, todayConakry } from "./credit";
import {
  COMPANIES_COLLECTION,
  COMPANY_MEMBERS_COLLECTION,
  CREDIT_AGREEMENTS_COLLECTION,
  memberDocId,
} from "./creditRepository";

const TEST_COMPANY_ID = "credit_test_company";

const endOfMonthStr = (monthOffset = 0) => {
  const now = new Date();
  // Jour 0 du mois suivant = dernier jour du mois cible (UTC, coherent avec
  // le format AAAA-MM-JJ attendu, fuseau Conakry = UTC+0).
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 0));
  return date.toISOString().slice(0, 10);
};

const daysAgoStr = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

export const createCreditTestData = async (admin) => {
  const today = todayConakry();
  const companyRef = doc(db, COMPANIES_COLLECTION, TEST_COMPANY_ID);
  const memberRef = doc(db, COMPANY_MEMBERS_COLLECTION, memberDocId(TEST_COMPANY_ID, admin.uid));

  const agreement1Order = doc(collection(db, "orders"));
  const agreement2Order = doc(collection(db, "orders"));
  const agreement3Order = doc(collection(db, "orders"));

  // Agreement 1 : nouvelle demande, pas encore examinee.
  const installments1 = [
    { index: 0, dueDate: endOfMonthStr(0), amount: 150000, paid: 0, status: "due" },
  ];

  // Agreement 2 : deja validee par l'entreprise, prete pour la livraison.
  const installments2 = [
    { index: 0, dueDate: endOfMonthStr(0), amount: 100000, paid: 0, status: "due" },
    { index: 1, dueDate: endOfMonthStr(1), amount: 100000, paid: 0, status: "due" },
    { index: 2, dueDate: endOfMonthStr(2), amount: 100000, paid: 0, status: "due" },
  ];

  // Agreement 3 : livree, premiere echeance deja depassee -> "late" calcule
  // avec la meme logique que le reste de l'app (agreementStatus).
  const installments3Raw = [
    { index: 0, dueDate: daysAgoStr(5), amount: 90000, paid: 0, status: "due" },
  ];
  const installments3 = installments3Raw.map((item) => ({
    ...item,
    status: installmentStatus(item, today),
  }));
  const status3 = agreementStatus("active", installments3, today);

  const outstandingTotal = 150000 + 300000 + 90000;

  const batch = writeBatch(db);

  batch.set(companyRef, {
    name: "Entreprise Test (démo crédit)",
    status: "active",
    currency: "GNF",
    globalLimit: 5000000,
    outstanding: outstandingTotal,
    plans: ["end_of_month", "three_months"],
    cutoffDay: 20,
    defaultMemberLimit: 500000,
    contact: { name: "Correspondant Test", phone: "+224600000000", email: "" },
    isTest: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    companyId: TEST_COMPANY_ID,
    uid: admin.uid,
    name: admin.name || "Compte de test",
    phone: "+224600000001",
    creditLimit: 500000,
    outstanding: outstandingTotal,
    status: "active",
    enrollmentCode: "TEST-0001",
    isTest: true,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const baseOrder = {
    userId: admin.uid,
    paymentType: "credit_entreprise",
    payed: false,
    isTest: true,
    deliverInfos: {
      name: admin.name || "Employé test",
      phone: "+224600000001",
      address: "Conakry (donnée de test)",
    },
    mail_invoice: admin.email || "",
    timeStamp: serverTimestamp(),
  };

  batch.set(agreement1Order, {
    ...baseOrder,
    orderId: "TEST-CREDIT-1",
    total: 150000,
    cart: [{ name: "Panier test crédit #1", quantity: 1, totalAmount: 150000 }],
    orderStatus: "awaiting_credit_approval",
    credit: { agreementId: agreement1Order.id, plan: "end_of_month" },
  });
  batch.set(doc(db, CREDIT_AGREEMENTS_COLLECTION, agreement1Order.id), {
    companyId: TEST_COMPANY_ID,
    companyName: "Entreprise Test (démo crédit)",
    uid: admin.uid,
    memberId: memberDocId(TEST_COMPANY_ID, admin.uid),
    memberName: admin.name || "Employé test",
    memberPhone: "+224600000001",
    orderDocId: agreement1Order.id,
    orderId: "TEST-CREDIT-1",
    plan: "end_of_month",
    amount: 150000,
    fees: 0,
    paid: 0,
    status: "pending_review",
    installments: installments1,
    nextDueDate: nextDueDate(installments1),
    reminderCount: 0,
    isTest: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(agreement2Order, {
    ...baseOrder,
    orderId: "TEST-CREDIT-2",
    total: 300000,
    cart: [{ name: "Panier test crédit #2", quantity: 1, totalAmount: 300000 }],
    orderStatus: "awaiting_credit_approval",
    credit: { agreementId: agreement2Order.id, plan: "three_months" },
  });
  batch.set(doc(db, CREDIT_AGREEMENTS_COLLECTION, agreement2Order.id), {
    companyId: TEST_COMPANY_ID,
    companyName: "Entreprise Test (démo crédit)",
    uid: admin.uid,
    memberId: memberDocId(TEST_COMPANY_ID, admin.uid),
    memberName: admin.name || "Employé test",
    memberPhone: "+224600000001",
    orderDocId: agreement2Order.id,
    orderId: "TEST-CREDIT-2",
    plan: "three_months",
    amount: 300000,
    fees: 0,
    paid: 0,
    status: "company_approved",
    installments: installments2,
    nextDueDate: nextDueDate(installments2),
    review: { approved: true, by: admin.uid, byName: admin.name, at: serverTimestamp() },
    companyDecision: { approved: true, by: "test-company-admin", byName: "Correspondant Test", at: serverTimestamp() },
    reminderCount: 0,
    isTest: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(agreement3Order, {
    ...baseOrder,
    orderId: "TEST-CREDIT-3",
    total: 90000,
    cart: [{ name: "Panier test crédit #3", quantity: 1, totalAmount: 90000 }],
    orderStatus: "confirmed",
    credit: { agreementId: agreement3Order.id, plan: "end_of_month" },
  });
  batch.set(doc(db, CREDIT_AGREEMENTS_COLLECTION, agreement3Order.id), {
    companyId: TEST_COMPANY_ID,
    companyName: "Entreprise Test (démo crédit)",
    uid: admin.uid,
    memberId: memberDocId(TEST_COMPANY_ID, admin.uid),
    memberName: admin.name || "Employé test",
    memberPhone: "+224600000001",
    orderDocId: agreement3Order.id,
    orderId: "TEST-CREDIT-3",
    plan: "end_of_month",
    amount: 90000,
    fees: 0,
    paid: 0,
    status: status3,
    installments: installments3,
    nextDueDate: nextDueDate(installments3),
    review: { approved: true, by: admin.uid, byName: admin.name, at: serverTimestamp() },
    companyDecision: { approved: true, by: "test-company-admin", byName: "Correspondant Test", at: serverTimestamp() },
    releasedBy: admin.uid,
    releasedAt: serverTimestamp(),
    reminderCount: 0,
    isTest: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
};

const deleteTestDocsIn = async (collectionName) => {
  const snap = await getDocs(query(collection(db, collectionName), where("isTest", "==", true)));
  const ids = snap.docs.map((d) => d.id);
  const chunkSize = 450;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const batch = writeBatch(db);
    ids.slice(i, i + chunkSize).forEach((id) => batch.delete(doc(db, collectionName, id)));
    await batch.commit();
  }
  return ids.length;
};

export const deleteCreditTestData = async () => {
  const counts = {};
  counts.orders = await deleteTestDocsIn("orders");
  counts.creditAgreements = await deleteTestDocsIn(CREDIT_AGREEMENTS_COLLECTION);
  counts.creditPayments = await deleteTestDocsIn("creditPayments");
  counts.creditReminders = await deleteTestDocsIn("creditReminders");
  counts.companyMembers = await deleteTestDocsIn(COMPANY_MEMBERS_COLLECTION);
  counts.companyAdmins = await deleteTestDocsIn("companyAdmins");
  counts.companies = await deleteTestDocsIn(COMPANIES_COLLECTION);
  return counts;
};
