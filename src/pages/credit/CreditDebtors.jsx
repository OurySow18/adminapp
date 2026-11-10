import "./credit.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { daysLate, formatDueDate, formatGNF, formatDateTime } from "./creditFormat";
import { todayConakry } from "../../utils/credit";
import { loadDebtorAgreements, refreshOverdueAgreements } from "../../utils/creditRepository";

const CreditDebtors = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [lateOnly, setLateOnly] = useState(searchParams.get("late") === "1");
  const [feedback, setFeedback] = useState({ open: false, type: "success", message: "" });

  const today = todayConakry();

  const loadRows = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await loadDebtorAgreements();
      setRows(data);
    } catch (err) {
      console.error("Failed to load debtors:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const companies = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (row.companyId && !map.has(row.companyId)) {
        map.set(row.companyId, row.companyName || row.companyId);
      }
    });
    return Array.from(map.entries());
  }, [rows]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (companyFilter) filtered = filtered.filter((row) => row.companyId === companyFilter);
    if (lateOnly) filtered = filtered.filter((row) => row.status === "late");
    return filtered;
  }, [rows, companyFilter, lateOnly]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const count = await refreshOverdueAgreements();
      setFeedback({
        open: true,
        type: "success",
        message: `${count} crédit(s) mis à jour.`,
      });
      await loadRows();
    } catch (err) {
      setFeedback({ open: true, type: "error", message: err?.message || "Action impossible." });
    } finally {
      setRefreshing(false);
    }
  };

  const toggleLateOnly = (checked) => {
    setLateOnly(checked);
    const next = new URLSearchParams(searchParams);
    if (checked) next.set("late", "1");
    else next.delete("late");
    setSearchParams(next);
  };

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
            <h1>Débiteurs et échéances</h1>
            <p>Tous les crédits livrés (actifs ou en retard), triés par échéance la plus ancienne.</p>
          </div>
        </header>

        <div className="credit__filterBar">
          <div className="credit__field">
            <label htmlFor="credit-debtors-company">Entreprise</label>
            <select
              id="credit-debtors-company"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              <option value="">Toutes</option>
              {companies.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <label className="credit__toggle">
            <input
              type="checkbox"
              checked={lateOnly}
              onChange={(event) => toggleLateOnly(event.target.checked)}
            />
            En retard seulement
          </label>
          <button type="button" className="credit__button" disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? "Mise à jour..." : "Mettre à jour les retards"}
          </button>
        </div>

        {error && (
          <div className="credit__banner credit__banner--error">
            Impossible de charger les débiteurs.
          </div>
        )}

        <section className="credit__panel">
          {loading && <p className="credit__empty">Chargement...</p>}
          {!loading && !filteredRows.length && <p className="credit__empty">Aucun débiteur.</p>}
          {!loading && filteredRows.length > 0 && (
            <table className="credit__table">
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Téléphone</th>
                  <th>Entreprise</th>
                  <th>Montant</th>
                  <th>Payé</th>
                  <th>Reste dû</th>
                  <th>Prochaine échéance</th>
                  <th>Retard</th>
                  <th>Rappels</th>
                  <th>Dernier rappel</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const remaining = Math.max(0, (row.amount || 0) - (row.paid || 0));
                  const late = daysLate(row.nextDueDate, today);
                  return (
                    <tr
                      key={row.id}
                      className={row.status === "late" ? "credit__row--late" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/admin/credit/debiteurs/${row.id}`)}
                    >
                      <td>{row.memberName}</td>
                      <td>{row.memberPhone}</td>
                      <td>{row.companyName}</td>
                      <td>{formatGNF(row.amount)}</td>
                      <td>{formatGNF(row.paid)}</td>
                      <td>{formatGNF(remaining)}</td>
                      <td>{formatDueDate(row.nextDueDate)}</td>
                      <td>{late > 0 ? <span className="credit__lateDays">{late} j</span> : "—"}</td>
                      <td>{row.reminderCount || 0}</td>
                      <td>{row.lastReminderAt ? formatDateTime(row.lastReminderAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <FeedbackPopup
          open={feedback.open}
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        />
      </main>
    </div>
  );
};

export default CreditDebtors;
