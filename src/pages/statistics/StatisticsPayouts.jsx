import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import StatisticsShell, {
  StatisticsKpiGrid,
  StatisticsSection,
  StatisticsTable,
} from "./StatisticsShell";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  pickVendorName,
  toMillis,
  toNumber,
} from "./statisticsShared";

const StatisticsPayouts = () => {
  const [vendors, setVendors] = useState([]);
  const [deletedVendors, setDeletedVendors] = useState([]);
  const [balances, setBalances] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(collection(db, "vendors"), (snapshot) => {
        setVendors(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) })));
      }),
      onSnapshot(collection(db, "deletedVendors"), (snapshot) => {
        setDeletedVendors(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
        );
      }),
      onSnapshot(collection(db, "vendor_balances"), (snapshot) => {
        setBalances(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) })));
      }),
      onSnapshot(collection(db, "vendor_payout_batches"), (snapshot) => {
        setBatches(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) })));
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const summary = useMemo(
    () => ({
      pendingNetAmount: balances.reduce(
        (sum, item) => sum + toNumber(item.pendingNetAmount),
        0
      ),
      paidNetAmount: balances.reduce((sum, item) => sum + toNumber(item.paidNetAmount), 0),
      pendingEntriesCount: balances.reduce(
        (sum, item) => sum + toNumber(item.pendingEntriesCount),
        0
      ),
      processingBatches: batches.filter((item) => item.status === "processing").length,
      failedBatches: batches.filter((item) => item.status === "failed").length,
    }),
    [balances, batches]
  );

  const vendorNameById = useMemo(() => {
    const map = new Map();

    vendors.forEach((vendor) => {
      map.set(vendor.id, pickVendorName(vendor, "Vendeur"));
    });

    deletedVendors.forEach((vendor) => {
      if (!map.has(vendor.id)) {
        map.set(vendor.id, pickVendorName(vendor, "Vendeur"));
      }
    });

    balances.forEach((balance) => {
      const key = balance.vendorId || balance.id;
      if (!map.has(key)) {
        map.set(key, pickVendorName(balance, "Vendeur"));
      }
    });

    return map;
  }, [vendors, deletedVendors, balances]);

  const topPendingVendors = useMemo(
    () =>
      [...balances]
        .sort((left, right) => toNumber(right.pendingNetAmount) - toNumber(left.pendingNetAmount))
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          vendeur: pickVendorName(item, item.vendorId || item.id),
          lignes: formatNumber(item.pendingEntriesCount || 0),
          net_a_payer: formatCurrency(item.pendingNetAmount || 0),
          deja_paye: formatCurrency(item.paidNetAmount || 0),
        })),
    [balances]
  );

  const recentBatches = useMemo(
    () =>
      [...batches]
        .sort(
          (left, right) =>
            toMillis(right.completedAt || right.createdAt) -
            toMillis(left.completedAt || left.createdAt)
        )
        .slice(0, 12)
        .map((item) => ({
          id: item.id,
          vendeur: vendorNameById.get(item.vendorId) || "Vendeur inconnu",
          statut: item.status || "completed",
          lignes: formatNumber(item.paidEntriesCount || 0),
          net: formatCurrency(item.netAmount || 0, item.currency || "GNF"),
          date: formatDateTime(item.completedAt || item.createdAt),
        })),
    [batches, vendorNameById]
  );

  return (
    <StatisticsShell
      title="Paiements vendeurs"
      subtitle="Suivi V1 des montants à régler, des montants déjà payés et des lots de paiement."
    >
      <StatisticsKpiGrid
        items={[
          {
            label: "Net à payer",
            value: formatCurrency(summary.pendingNetAmount),
            helper: `${formatNumber(summary.pendingEntriesCount)} ligne(s) en attente`,
          },
          {
            label: "Net déjà payé",
            value: formatCurrency(summary.paidNetAmount),
            helper: "Agrégé depuis vendor_balances",
          },
          {
            label: "Lots en cours",
            value: formatNumber(summary.processingBatches),
            helper: `${formatNumber(summary.failedBatches)} en erreur`,
          },
          {
            label: "Vendeurs à payer",
            value: formatNumber(
              balances.filter((item) => toNumber(item.pendingNetAmount) > 0).length
            ),
            helper: "Priorisation du décaissement",
          },
        ]}
      />

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Vendeurs avec le plus de net en attente"
          subtitle="Aide à la priorisation des prochains règlements."
        >
          <StatisticsTable
            columns={[
              { key: "vendeur", label: "Vendeur" },
              { key: "lignes", label: "Lignes" },
              { key: "net_a_payer", label: "Net à payer" },
              { key: "deja_paye", label: "Déjà payé" },
            ]}
            rows={topPendingVendors}
            emptyText="Aucune balance vendeur disponible."
          />
        </StatisticsSection>

        <StatisticsSection
          title="Historique des lots de paiement"
          subtitle="Vue rapide sur les paiements récemment déclenchés."
        >
          <StatisticsTable
            columns={[
              { key: "vendeur", label: "Vendeur" },
              { key: "statut", label: "Statut" },
              { key: "lignes", label: "Lignes" },
              { key: "net", label: "Net" },
              { key: "date", label: "Date" },
            ]}
            rows={recentBatches}
            emptyText="Aucun lot de paiement trouvé."
          />
        </StatisticsSection>
      </div>
    </StatisticsShell>
  );
};

export default StatisticsPayouts;
