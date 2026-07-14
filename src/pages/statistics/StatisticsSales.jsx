import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import StatisticsShell, {
  StatisticsKpiGrid,
  StatisticsSection,
  StatisticsTable,
} from "./StatisticsShell";
import { formatCurrency, formatNumber, pickVendorName, toNumber } from "./statisticsShared";

const StatisticsSales = () => {
  const [vendors, setVendors] = useState([]);
  const [deletedVendors, setDeletedVendors] = useState([]);
  const [sales, setSales] = useState([]);

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
      onSnapshot(collection(db, "product_sales_ledger"), (snapshot) => {
        setSales(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) })));
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

  const summary = useMemo(() => {
    const orders = new Set();
    let grossRevenue = 0;
    let unitsSold = 0;
    sales.forEach((entry) => {
      grossRevenue += toNumber(entry.grossAmount);
      unitsSold += toNumber(entry.qty);
      if (entry.orderId) orders.add(String(entry.orderId));
    });
    const averageOrderValue = orders.size ? grossRevenue / orders.size : 0;
    return { grossRevenue, unitsSold, ordersCount: orders.size, averageOrderValue };
  }, [sales]);

  const topProducts = useMemo(() => {
    const byProduct = new Map();
    sales.forEach((entry) => {
      const key = entry.productId || entry.id;
      const current = byProduct.get(key) || {
        id: key,
        produit: entry.title || entry.productId || "Produit",
        vendeur:
          (entry.vendorId && vendorNameById.get(entry.vendorId)) ||
          pickVendorName(entry, "—"),
        quantites: 0,
        brut: 0,
        commandes: new Set(),
      };
      current.quantites += toNumber(entry.qty);
      current.brut += toNumber(entry.grossAmount);
      if (entry.orderId) current.commandes.add(String(entry.orderId));
      byProduct.set(key, current);
    });

    return Array.from(byProduct.values())
      .sort((left, right) => right.brut - left.brut)
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        produit: item.produit,
        vendeur: item.vendeur,
        quantites: formatNumber(item.quantites),
        commandes: formatNumber(item.commandes.size),
        brut: formatCurrency(item.brut),
      }));
  }, [sales, vendorNameById]);

  const topVendors = useMemo(() => {
    const byVendor = new Map();
    sales.forEach((entry) => {
      const key = entry.vendorId || entry.vendorName || "unknown_vendor";
      const current = byVendor.get(key) || {
        id: key,
        vendeur:
          (entry.vendorId && vendorNameById.get(entry.vendorId)) ||
          pickVendorName(entry, "Vendeur inconnu"),
        brut: 0,
        quantites: 0,
        commandes: new Set(),
      };
      current.brut += toNumber(entry.grossAmount);
      current.quantites += toNumber(entry.qty);
      if (entry.orderId) current.commandes.add(String(entry.orderId));
      byVendor.set(key, current);
    });

    return Array.from(byVendor.values())
      .sort((left, right) => right.brut - left.brut)
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        vendeur: item.vendeur,
        commandes: formatNumber(item.commandes.size),
        quantites: formatNumber(item.quantites),
        brut: formatCurrency(item.brut),
      }));
  }, [sales, vendorNameById]);

  return (
    <StatisticsShell
      title="Ventes"
      subtitle="Vue V1 des revenus observés dans le ledger produit, avec focus sur les produits et vendeurs qui performent."
    >
      <StatisticsKpiGrid
        items={[
          {
            label: "CA brut observé",
            value: formatCurrency(summary.grossRevenue),
            helper: "Somme des lignes de ventes produit",
          },
          {
            label: "Commandes distinctes",
            value: formatNumber(summary.ordersCount),
            helper: "Calculé depuis les orderId",
          },
          {
            label: "Panier moyen observé",
            value: formatCurrency(summary.averageOrderValue),
            helper: "CA brut / commandes",
          },
          {
            label: "Unités vendues",
            value: formatNumber(summary.unitsSold),
            helper: "Toutes lignes confondues",
          },
        ]}
      />

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Top produits"
          subtitle="Produits générant le plus de revenu brut dans le ledger."
        >
          <StatisticsTable
            columns={[
              { key: "produit", label: "Produit" },
              { key: "vendeur", label: "Vendeur" },
              { key: "quantites", label: "Unités" },
              { key: "commandes", label: "Commandes" },
              { key: "brut", label: "CA brut" },
            ]}
            rows={topProducts}
            emptyText="Aucune vente produit trouvée."
          />
        </StatisticsSection>

        <StatisticsSection
          title="Top vendeurs"
          subtitle="Classement des vendeurs à partir des ventes produit observées."
        >
          <StatisticsTable
            columns={[
              { key: "vendeur", label: "Vendeur" },
              { key: "commandes", label: "Commandes" },
              { key: "quantites", label: "Unités" },
              { key: "brut", label: "CA brut" },
            ]}
            rows={topVendors}
            emptyText="Aucune vente vendeur trouvée."
          />
        </StatisticsSection>
      </div>
    </StatisticsShell>
  );
};

export default StatisticsSales;
