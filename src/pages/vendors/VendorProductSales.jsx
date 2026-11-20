import "./vendorSales.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import {
  loadVendorLedgerEntries,
  loadVendorPendingOrderItems,
} from "../../utils/vendorSalesRepository";

const formatCurrency = (value, currency = "GNF") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatCurrency(0, currency);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString("fr-FR");
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("fr-FR");
};

const STATUS_LABELS = {
  paid: { label: "Payé au vendeur", className: "vendorSales__badge--paid" },
  pending: { label: "En attente de paiement", className: "vendorSales__badge--pending" },
  reversed: { label: "Annulé", className: "vendorSales__badge--reversed" },
};

const VendorProductSales = () => {
  const { id: vendorId, productId } = useParams();
  const [entries, setEntries] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!vendorId || !productId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ledgerEntries, allPendingItems] = await Promise.all([
          loadVendorLedgerEntries(vendorId),
          loadVendorPendingOrderItems(vendorId),
        ]);
        if (cancelled) return;
        setEntries(ledgerEntries.filter((entry) => entry.productId === productId));
        setPendingItems(allPendingItems.filter((item) => item.productId === productId));
      } catch (err) {
        console.error("Erreur chargement ventes produit:", err);
        if (!cancelled) setError("Impossible de charger les ventes de ce produit.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [vendorId, productId]);

  const productTitle = entries[0]?.title || pendingItems[0]?.title || productId;

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          acc.unitsSold += entry.qty;
          acc.grossAmount += entry.grossAmount;
          return acc;
        },
        { unitsSold: 0, grossAmount: 0 }
      ),
    [entries]
  );

  return (
    <div className="vendorSales">
      <Sidebar />
      <div className="vendorSalesContainer">
        <Navbar />
        <div className="vendorSales__content">
          <div className="vendorSales__heading">
            <div>
              <h1>{productTitle}</h1>
              <p className="vendorSales__subtitle">
                Ventes du vendeur <strong>{vendorId}</strong>
              </p>
            </div>
            <Link to={`/vendors/${vendorId}/sales`} className="vendorSales__btn vendorSales__btn--light">
              Retour à la liste des ventes
            </Link>
          </div>

          <div className="vendorSales__summary">
            <div className="vendorSales__summaryCard">
              <span>Unités vendues (livrées)</span>
              <strong>{totals.unitsSold}</strong>
            </div>
            <div className="vendorSales__summaryCard">
              <span>Montant brut</span>
              <strong>{formatCurrency(totals.grossAmount)}</strong>
            </div>
            <div className="vendorSales__summaryCard">
              <span>Commandes en cours</span>
              <strong>{pendingItems.length}</strong>
            </div>
          </div>

          {error && <p className="vendorSales__error">{error}</p>}

          <section>
            <h2>Historique des ventes livrées</h2>
            {loading ? (
              <p className="vendorSales__loading">Chargement...</p>
            ) : entries.length === 0 ? (
              <p className="vendorSales__empty">Aucune vente livrée enregistrée pour ce produit.</p>
            ) : (
              <table className="vendorSales__table">
                <thead>
                  <tr>
                    <th>Date de livraison</th>
                    <th>Commande</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                    <th>Montant brut</th>
                    <th>Statut paiement vendeur</th>
                    <th>Date de paiement</th>
                    <th>Payé par</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const status = STATUS_LABELS[entry.status] || STATUS_LABELS.pending;
                    return (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.deliveredAt)}</td>
                        <td>{entry.orderId || "—"}</td>
                        <td>{entry.qty}</td>
                        <td>{formatCurrency(entry.unitPrice, entry.currency)}</td>
                        <td>{formatCurrency(entry.grossAmount, entry.currency)}</td>
                        <td>
                          <span className={`vendorSales__badge ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>{formatDateTime(entry.paidAt)}</td>
                        <td>{entry.status === "paid" ? entry.paidByEmail || "—" : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Commandes en cours (non livrées ou non payées)</h2>
            {loading ? (
              <p className="vendorSales__loading">Chargement...</p>
            ) : pendingItems.length === 0 ? (
              <p className="vendorSales__empty">
                Aucune commande en cours pour ce produit.
              </p>
            ) : (
              <table className="vendorSales__table">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Date</th>
                    <th>Quantité</th>
                    <th>Montant</th>
                    <th>Payée (client)</th>
                    <th>Livrée</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item) => (
                    <tr key={`${item.orderDocId}-${item.lineIndex}`}>
                      <td>
                        <Link to={`/orders/${item.orderDocId}`}>{item.orderId}</Link>
                      </td>
                      <td>{formatDateTime(item.timeStamp)}</td>
                      <td>{item.qty}</td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>
                        <span
                          className={`vendorSales__badge ${
                            item.payed ? "vendorSales__badge--paid" : "vendorSales__badge--pending"
                          }`}
                        >
                          {item.payed ? "Payée" : "Non payée"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`vendorSales__badge ${
                            item.delivered ? "vendorSales__badge--paid" : "vendorSales__badge--pending"
                          }`}
                        >
                          {item.delivered ? "Livrée" : "Non livrée"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default VendorProductSales;
