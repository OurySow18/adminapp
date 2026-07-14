import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import StatisticsShell, {
  StatisticsKpiGrid,
  StatisticsSection,
  StatisticsTable,
} from "./StatisticsShell";
import { formatCurrency, formatNumber, pickVendorName, toNumber } from "./statisticsShared";
import { VENDOR_STATUS_VALUES, getVendorStatusLabel, resolveVendorStatus } from "../../utils/vendorStatus";

const StatisticsVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [deletedVendors, setDeletedVendors] = useState([]);
  const [balances, setBalances] = useState([]);

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
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

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

    return map;
  }, [vendors, deletedVendors]);

  const statusCounts = useMemo(() => {
    const counts = VENDOR_STATUS_VALUES.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {}
    );
    vendors.forEach((vendor) => {
      const status = resolveVendorStatus(vendor, "draft");
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [vendors]);

  const topVendors = useMemo(
    () =>
      [...balances]
        .sort(
          (left, right) =>
            toNumber(right.lifetimeNetAmount || right.paidNetAmount) -
            toNumber(left.lifetimeNetAmount || left.paidNetAmount)
        )
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          vendeur:
            vendorNameById.get(item.vendorId || item.id) ||
            pickVendorName(item, "Vendeur inconnu"),
          en_attente: formatCurrency(item.pendingNetAmount || 0),
          deja_paye: formatCurrency(item.paidNetAmount || 0),
          net_cumule: formatCurrency(
            item.lifetimeNetAmount || item.paidNetAmount || 0
          ),
        })),
    [balances, vendorNameById]
  );

  const vendorStatuses = useMemo(
    () =>
      VENDOR_STATUS_VALUES.map((status) => ({
        id: status,
        statut: getVendorStatusLabel(status),
        volume: formatNumber(statusCounts[status] || 0),
      })),
    [statusCounts]
  );

  return (
    <StatisticsShell
      title="Vendeurs"
      subtitle="Lecture des vendeurs par statut et du poids économique des boutiques déjà actives dans les balances."
    >
      <StatisticsKpiGrid
        items={[
          {
            label: "Vendeurs totaux",
            value: formatNumber(vendors.length),
            helper: "Collection vendors",
          },
          {
            label: "Approuvés",
            value: formatNumber(statusCounts.approved || 0),
            helper: "Boutiques actives",
          },
          {
            label: "En revue ou soumis",
            value: formatNumber(
              (statusCounts.submitted || 0) + (statusCounts.under_review || 0)
            ),
            helper: "Dossiers à suivre",
          },
          {
            label: "Bloqués ou refusés",
            value: formatNumber(
              (statusCounts.blocked || 0) + (statusCounts.rejected || 0)
            ),
            helper: "Risque ou rejet",
          },
        ]}
      />

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Répartition des statuts"
          subtitle="Répartition actuelle des vendeurs dans le cycle de validation."
        >
          <StatisticsTable
            columns={[
              { key: "statut", label: "Statut" },
              { key: "volume", label: "Nombre de vendeurs" },
            ]}
            rows={vendorStatuses}
            emptyText="Aucun vendeur trouvé."
          />
        </StatisticsSection>

        <StatisticsSection
          title="Top vendeurs par net cumulé"
          subtitle="Lecture basée sur les balances vendeurs disponibles."
        >
          <StatisticsTable
            columns={[
              { key: "vendeur", label: "Vendeur" },
              { key: "en_attente", label: "En attente" },
              { key: "deja_paye", label: "Déjà payé" },
              { key: "net_cumule", label: "Net cumulé" },
            ]}
            rows={topVendors}
            emptyText="Aucune balance vendeur trouvée."
          />
        </StatisticsSection>
      </div>
    </StatisticsShell>
  );
};

export default StatisticsVendors;
