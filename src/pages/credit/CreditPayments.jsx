import "./credit.scss";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { formatDateTime, formatGNF } from "./creditFormat";
import { getPaymentMethodLabel, loadCompanies, loadPayments } from "../../utils/creditRepository";

const METHODS = [
  { value: "orange_money", label: "Orange Money" },
  { value: "cash", label: "Espèces" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "other", label: "Autre" },
];

const CreditPayments = () => {
  const [payments, setPayments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadRows = async (companyId) => {
    setLoading(true);
    setError(false);
    try {
      const [paymentsData, companiesData] = await Promise.all([
        loadPayments({ companyId: companyId || null, limitCount: 300 }),
        loadCompanies(),
      ]);
      setPayments(paymentsData);
      setCompanies(companiesData);
    } catch (err) {
      console.error("Failed to load credit payments:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(companyFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter]);

  const filteredRows = useMemo(() => {
    let filtered = payments;
    if (methodFilter) filtered = filtered.filter((p) => p.method === methodFilter);
    if (dateFrom || dateTo) {
      filtered = filtered.filter((p) => {
        const date = typeof p.recordedAt?.toDate === "function" ? p.recordedAt.toDate() : null;
        if (!date) return false;
        const iso = date.toISOString().slice(0, 10);
        if (dateFrom && iso < dateFrom) return false;
        if (dateTo && iso > dateTo) return false;
        return true;
      });
    }
    return filtered;
  }, [payments, methodFilter, dateFrom, dateTo]);

  const total = useMemo(
    () => filteredRows.reduce((sum, p) => sum + (p.amount || 0), 0),
    [filteredRows]
  );

  return (
    <div className="credit">
      <Sidebar />
      <main className="credit__container">
        <Navbar />
        <Link to="/admin/credit" className="credit__back">
          ← Tableau de bord crédit
        </Link>
        <header className="credit__header">
          <div>
            <h1>Paiements</h1>
            <p>Journal des paiements crédit, du plus récent au plus ancien.</p>
          </div>
        </header>

        <div className="credit__filterBar">
          <div className="credit__field">
            <label htmlFor="credit-payments-company">Entreprise</label>
            <select
              id="credit-payments-company"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              <option value="">Toutes</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="credit__field">
            <label htmlFor="credit-payments-method">Moyen</label>
            <select
              id="credit-payments-method"
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value)}
            >
              <option value="">Tous</option>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="credit__field credit__field--narrow">
            <label htmlFor="credit-payments-from">Du</label>
            <input
              id="credit-payments-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="credit__field credit__field--narrow">
            <label htmlFor="credit-payments-to">Au</label>
            <input
              id="credit-payments-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="credit__banner credit__banner--error">
            Impossible de charger les paiements.
          </div>
        )}

        <p className="credit__total">Total affiché : {formatGNF(total)}</p>

        <section className="credit__panel">
          {loading && <p className="credit__empty">Chargement...</p>}
          {!loading && !filteredRows.length && <p className="credit__empty">Aucun paiement.</p>}
          {!loading && filteredRows.length > 0 && (
            <table className="credit__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employé</th>
                  <th>Entreprise</th>
                  <th>Montant</th>
                  <th>Moyen</th>
                  <th>Référence</th>
                  <th>Enregistré par</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateTime(payment.recordedAt)}</td>
                    <td>
                      <Link to={`/admin/credit/debiteurs/${payment.agreementId}`}>
                        {payment.uid}
                      </Link>
                    </td>
                    <td>{companies.find((c) => c.id === payment.companyId)?.name || payment.companyId}</td>
                    <td style={{ color: payment.amount < 0 ? "#b91c1c" : undefined }}>
                      {formatGNF(payment.amount)}
                    </td>
                    <td>{getPaymentMethodLabel(payment.method)}</td>
                    <td>{payment.reference || "—"}</td>
                    <td>{payment.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};

export default CreditPayments;
