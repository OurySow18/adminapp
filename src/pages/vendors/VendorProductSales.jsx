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

const shortText = (value, headLen = 10, tailLen = 6) => {
  if (!value) return "—";
  const str = String(value);
  if (str.length <= headLen + tailLen + 1) return str;
  return `${str.slice(0, headLen)}…${str.slice(-tailLen)}`;
};

const Truncated = ({ value, headLen, tailLen, mono }) =>
  value ? (
    <span
      className={mono ? "vendorSales__mono vendorSales__truncate" : "vendorSales__truncate"}
      title={value}
    >
      {shortText(value, headLen, tailLen)}
    </span>
  ) : (
    <span>—</span>
  );

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
                Ventes du vendeur{" "}
                <span className="vendorSales__mono vendorSales__idChip" title={vendorId}>
                  {shortText(vendorId, 10, 6)}
                </span>
              </p>
            </div>
            <Link to={`/vendors/${vendorId}/sales`} className="vendorSales__btn vendorSales__btn--light">
              <span aria-hidden="true">←</span> Retour à la liste des ventes
            </Link>
          </div>

          <div className="vendorSales__summary">
            <div className="vendorSales__summaryCard vendorSales__summaryCard--units">
              <span>Unités vendues (livrées)</span>
              <strong>{totals.unitsSold}</strong>
            </div>
            <div className="vendorSales__summaryCard vendorSales__summaryCard--amount">
              <span>Montant brut</span>
              <strong>{formatCurrency(totals.grossAmount)}</strong>
            </div>
            <div className="vendorSales__summaryCard vendorSales__summaryCard--live">
              <span>Commandes en cours</span>
              <strong>{pendingItems.length}</strong>
            </div>
          </div>

          {error && <p className="vendorSales__error">{error}</p>}

          <section>
            <h2>
              Historique des ventes livrées
              {!loading && <span className="vendorSales__countBadge">{entries.length}</span>}
            </h2>
            {loading ? (
              <p className="vendorSales__loading">Chargement...</p>
            ) : entries.length === 0 ? (
              <p className="vendorSales__empty">Aucune vente livrée enregistrée pour ce produit.</p>
            ) : (
              <div className="vendorSales__tableWrap">
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
                          <td>
                            <Truncated value={entry.orderId} mono headLen={12} tailLen={6} />
                          </td>
                          <td>{entry.qty}</td>
                          <td>{formatCurrency(entry.unitPrice, entry.currency)}</td>
                          <td className="vendorSales__cellStrong">
                            {formatCurrency(entry.grossAmount, entry.currency)}
                          </td>
                          <td>
                            <span className={`vendorSales__badge ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td>{formatDateTime(entry.paidAt)}</td>
                          <td>
                            {entry.status === "paid" ? (
                              <Truncated value={entry.paidByEmail} headLen={14} tailLen={10} />
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2>
              Commandes en cours (non livrées ou non payées)
              {!loading && <span className="vendorSales__countBadge">{pendingItems.length}</span>}
            </h2>
            {loading ? (
              <p className="vendorSales__loading">Chargement...</p>
            ) : pendingItems.length === 0 ? (
              <p className="vendorSales__empty">
                Aucune commande en cours pour ce produit.
              </p>
            ) : (
              <div className="vendorSales__tableWrap">
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
                          <Link
                            to={`/orders/${item.orderDocId}`}
                            className="vendorSales__mono vendorSales__orderLink"
                            title={item.orderId}
                          >
                            {shortText(item.orderId, 12, 6)}
                          </Link>
                        </td>
                        <td>{formatDateTime(item.timeStamp)}</td>
                        <td>{item.qty}</td>
                        <td className="vendorSales__cellStrong">{formatCurrency(item.amount)}</td>
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
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default VendorProductSales;
