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
import { resolveVendorStatus } from "../../utils/vendorStatus";

const StatisticsOverview = () => {
  const [vendors, setVendors] = useState([]);
  const [deletedVendors, setDeletedVendors] = useState([]);
  const [balances, setBalances] = useState([]);
  const [sales, setSales] = useState([]);
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
      onSnapshot(collection(db, "product_sales_ledger"), (snapshot) => {
        setSales(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) })));
      }),
      onSnapshot(collection(db, "vendor_payout_batches"), (snapshot) => {
        setBatches(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) })));
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const approvedVendors = useMemo(
    () => vendors.filter((vendor) => resolveVendorStatus(vendor, "draft") === "approved").length,
    [vendors]
  );

  const summary = useMemo(() => {
    const orders = new Set();
    let grossRevenue = 0;
    let unitsSold = 0;
    sales.forEach((entry) => {
      grossRevenue += toNumber(entry.grossAmount);
      unitsSold += toNumber(entry.qty);
      if (entry.orderId) orders.add(String(entry.orderId));
    });

    return {
      grossRevenue,
      unitsSold,
      ordersCount: orders.size,
      pendingNetAmount: balances.reduce(
        (sum, item) => sum + toNumber(item.pendingNetAmount),
        0
      ),
      paidNetAmount: balances.reduce((sum, item) => sum + toNumber(item.paidNetAmount), 0),
    };
  }, [balances, sales]);

  const topVendors = useMemo(
    () =>
      [...balances]
        .sort((left, right) => toNumber(right.paidNetAmount) - toNumber(left.paidNetAmount))
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          vendor: pickVendorName(item, item.vendorId || item.id),
          ventes: formatCurrency(item.lifetimeNetAmount || item.paidNetAmount || 0),
          en_attente: formatCurrency(item.pendingNetAmount || 0),
          deja_paye: formatCurrency(item.paidNetAmount || 0),
        })),
    [balances]
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

  const recentBatches = useMemo(
    () =>
      [...batches]
        .sort(
          (left, right) =>
            toMillis(right.completedAt || right.createdAt) -
            toMillis(left.completedAt || left.createdAt)
        )
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          vendeur: vendorNameById.get(item.vendorId) || "Vendeur inconnu",
          lignes: formatNumber(item.paidEntriesCount || 0),
          net: formatCurrency(item.netAmount || 0, item.currency || "GNF"),
          statut: item.status || "completed",
          date: formatDateTime(item.completedAt || item.createdAt),
        })),
    [batches, vendorNameById]
  );

  return (
    <StatisticsShell
      title="Vue d’ensemble"
      subtitle="Lecture rapide du volume d’activité, des vendeurs et des paiements déjà observés dans l’admin."
    >
      <StatisticsKpiGrid
        items={[
          {
            label: "CA brut observé",
            value: formatCurrency(summary.grossRevenue),
            helper: `${formatNumber(summary.ordersCount)} commande(s)`,
          },
          {
            label: "Unités vendues",
            value: formatNumber(summary.unitsSold),
            helper: "Depuis product_sales_ledger",
          },
          {
            label: "Vendeurs actifs",
            value: formatNumber(approvedVendors),
            helper: `${formatNumber(vendors.length)} vendeurs au total`,
          },
          {
            label: "Net à payer vendeurs",
            value: formatCurrency(summary.pendingNetAmount),
            helper: `${formatCurrency(summary.paidNetAmount)} déjà réglés`,
          },
        ]}
      />

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Top vendeurs"
          subtitle="Classement par net déjà payé ou cumulé dans les balances."
        >
          <StatisticsTable
            columns={[
              { key: "vendor", label: "Vendeur" },
              { key: "ventes", label: "Net cumulé" },
              { key: "en_attente", label: "En attente" },
              { key: "deja_paye", label: "Déjà payé" },
            ]}
            rows={topVendors}
            emptyText="Aucune balance vendeur disponible."
          />
        </StatisticsSection>

        <StatisticsSection
          title="Derniers lots de paiement"
          subtitle="Historique synthétique des règlements vendeurs."
        >
          <StatisticsTable
            columns={[
              { key: "vendeur", label: "Vendeur" },
              { key: "lignes", label: "Lignes" },
              { key: "net", label: "Net" },
              { key: "statut", label: "Statut" },
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

export default StatisticsOverview;
