// Logique de calcul du credit entreprise (encours, echeances, imputation des
// paiements). Copie telle quelle de @ourysow18/monmarche-credit (depot
// monmarche-shared), qui fait foi et y est teste : ne pas modifier cette
// logique ici sans la repercuter dans le paquet partage (le portail
// entreprise et l'app mobile s'appuient sur les memes regles).

// Date du jour a Conakry (UTC+0), au format AAAA-MM-JJ.
export const todayConakry = () => new Date().toISOString().slice(0, 10);

// Impute un paiement : echeance la plus ancienne d'abord. Montant negatif =
// annulation, retiree des echeances les plus recentes d'abord.
export function allocatePayment(installments, amount) {
  const next = installments.map((item) => ({ ...item }));
  const ordered = [...next].sort((a, b) => a.index - b.index);
  if (amount > 0) {
    let left = amount;
    for (const item of ordered) {
      const take = Math.min(item.amount - item.paid, left);
      if (take > 0) {
        item.paid += take;
        left -= take;
      }
    }
    return { installments: next, excess: left };
  }
  let toRemove = -amount;
  for (const item of ordered.reverse()) {
    const take = Math.min(item.paid, toRemove);
    item.paid -= take;
    toRemove -= take;
  }
  if (toRemove > 0) throw new Error("L'annulation dépasse les paiements enregistrés.");
  return { installments: next, excess: 0 };
}

// Echeance due le dernier jour du mois : en retard a partir du lendemain.
export const installmentStatus = (item, today) =>
  item.paid >= item.amount ? "paid" : item.dueDate < today ? "late" : "due";

export const remainingAmount = (installments) =>
  installments.reduce((sum, item) => sum + Math.max(0, item.amount - item.paid), 0);

export const nextDueDate = (installments) =>
  [...installments].sort((a, b) => a.index - b.index).find((i) => i.paid < i.amount)?.dueDate;

// Statut d'un credit livre, recalcule ; les autres statuts ne changent pas.
export function agreementStatus(current, installments, today) {
  if (!["active", "late", "settled"].includes(current)) return current;
  if (remainingAmount(installments) === 0) return "settled";
  return installments.some((i) => installmentStatus(i, today) === "late") ? "late" : "active";
}
