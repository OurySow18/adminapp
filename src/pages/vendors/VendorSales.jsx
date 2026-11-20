import "./vendorSales.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import {
  loadVendorLedgerEntries,
  loadVendorPendingOrderItems,
  aggregateVendorSalesByProduct,
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

const VendorSales = () => {
  const { id: vendorId } = useParams();
  const navigate = useNavigate();
  const [vendorName, setVendorName] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [vendorSnap, ledgerEntries, pendingItems] = await Promise.all([
          getDoc(doc(db, "vendors", vendorId)),
          loadVendorLedgerEntries(vendorId),
          loadVendorPendingOrderItems(vendorId),
        ]);
        if (cancelled) return;
        const vendorData = vendorSnap.exists() ? vendorSnap.data() : null;
        setVendorName(
          vendorData?.profile?.company?.name ||
            vendorData?.company?.name ||
            vendorData?.displayName ||
            vendorData?.email ||
            vendorId
        );
        setRows(aggregateVendorSalesByProduct(ledgerEntries, pendingItems));
      } catch (err) {
        console.error("Erreur chargement ventes vendeur:", err);
        if (!cancelled) setError("Impossible de charger les ventes de ce vendeur.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.unitsSold += row.unitsSold;
          acc.grossAmount += row.grossAmount;
          acc.pendingLiveUnits += row.pendingLiveUnits;
          return acc;
        },
        { unitsSold: 0, grossAmount: 0, pendingLiveUnits: 0 }
      ),
    [rows]
  );

  return (
    <div className="vendorSales">
      <Sidebar />
      <div className="vendorSalesContainer">
        <Navbar />
        <div className="vendorSales__content">
          <div className="vendorSales__heading">
            <div>
              <h1>Ventes du vendeur</h1>
              <p className="vendorSales__subtitle">
                {vendorName ? `${vendorName} - ` : ""}
                <span className="vendorSales__mono vendorSales__idChip" title={vendorId}>
                  {vendorId}
                </span>
              </p>
            </div>
            <Link to={`/vendors/${vendorId}`} className="vendorSales__btn vendorSales__btn--light">
              <span aria-hidden="true">←</span> Retour au dossier vendeur
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
              <span>Unités en commande en cours</span>
              <strong>{totals.pendingLiveUnits}</strong>
            </div>
          </div>

          {error && <p className="vendorSales__error">{error}</p>}

          <section>
            <h2>
              Produits vendus
              {!loading && <span className="vendorSales__countBadge">{rows.length}</span>}
            </h2>
            {loading ? (
              <p className="vendorSales__loading">Chargement des ventes...</p>
            ) : rows.length === 0 ? (
              <p className="vendorSales__empty">Aucune vente enregistrée pour ce vendeur.</p>
            ) : (
              <div className="vendorSales__tableWrap">
                <table className="vendorSales__table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Unités vendues</th>
                      <th>Commandes livrées</th>
                      <th>Montant brut</th>
                      <th>Paiement vendeur</th>
                      <th>En commande en cours</th>
                      <th>Dernière vente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const key = row.productId || row.title;
                      const clickable = Boolean(row.productId);
                      return (
                        <tr
                          key={key}
                          className={
                            clickable ? "vendorSales__row vendorSales__row--clickable" : "vendorSales__row"
                          }
                          onClick={
                            clickable
                              ? () => navigate(`/vendors/${vendorId}/sales/${row.productId}`)
                              : undefined
                          }
                          role={clickable ? "button" : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          onKeyDown={
                            clickable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    navigate(`/vendors/${vendorId}/sales/${row.productId}`);
                                  }
                                }
                              : undefined
                          }
                        >
                          <td className="vendorSales__cellStrong">
                            {row.title}
                            {clickable && (
                              <span className="vendorSales__rowChevron" aria-hidden="true">
                                ›
                              </span>
                            )}
                          </td>
                          <td>{row.unitsSold}</td>
                          <td>{row.ordersCount}</td>
                          <td className="vendorSales__cellStrong">{formatCurrency(row.grossAmount)}</td>
                          <td>
                            {row.paidCount > 0 && (
                              <span className="vendorSales__badge vendorSales__badge--paid">
                                {row.paidCount} payée(s)
                              </span>
                            )}
                            {row.pendingPaymentCount > 0 && (
                              <span className="vendorSales__badge vendorSales__badge--pending">
                                {row.pendingPaymentCount} en attente
                              </span>
                            )}
                            {row.reversedCount > 0 && (
                              <span className="vendorSales__badge vendorSales__badge--reversed">
                                {row.reversedCount} annulée(s)
                              </span>
                            )}
                          </td>
                          <td>
                            {row.pendingLiveUnits > 0 ? (
                              <span className="vendorSales__badge vendorSales__badge--live">
                                {row.pendingLiveUnits} unité(s) / {row.pendingLiveOrdersCount} commande(s)
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{formatDateTime(row.lastSoldAt)}</td>
                        </tr>
                      );
                    })}
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

export default VendorSales;
