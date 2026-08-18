import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const formatInvoiceNumber = (sequence) => `FAC-${String(sequence).padStart(6, "0")}`;

// Numero de facture sequentiel et sans trou (compteur global dans
// counters/invoiceNumber), attribue au premier appel d'impression et fige
// ensuite sur la commande pour rester stable en cas de reimpression.
export const getOrCreateInvoiceNumber = async (collectionName, orderId) => {
  const orderRef = doc(db, collectionName, orderId);
  const counterRef = doc(db, "counters", "invoiceNumber");

  return runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Commande introuvable.");
    }

    const existing = orderSnap.data()?.invoiceNumber;
    if (existing) return existing;

    const counterSnap = await transaction.get(counterRef);
    const nextSequence = (counterSnap.exists() ? counterSnap.data()?.value || 0 : 0) + 1;
    const invoiceNumber = formatInvoiceNumber(nextSequence);

    transaction.set(
      counterRef,
      { value: nextSequence, updatedAt: serverTimestamp() },
      { merge: true }
    );
    transaction.update(orderRef, { invoiceNumber });

    return invoiceNumber;
  });
};
