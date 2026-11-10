import "./credit.scss";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { formatGNF } from "./creditFormat";
import { loadCompanies } from "../../utils/creditRepository";

const CreditCompanies = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        setCompanies(await loadCompanies());
      } catch (err) {
        console.error("Failed to load companies:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
            <h1>Entreprises partenaires</h1>
            <p>Entreprises ayant signé un partenariat crédit salarié.</p>
          </div>
          <div className="credit__actions">
            <button
              type="button"
              className="credit__button credit__button--primary"
              onClick={() => navigate("/admin/credit/entreprises/new")}
            >
              Nouvelle entreprise
            </button>
          </div>
        </header>

        {error && (
          <div className="credit__banner credit__banner--error">
            Impossible de charger les entreprises.
          </div>
        )}

        <section className="credit__panel">
          {loading && <p className="credit__empty">Chargement...</p>}
          {!loading && !companies.length && <p className="credit__empty">Aucune entreprise.</p>}
          {!loading && companies.length > 0 && (
            <table className="credit__table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Statut</th>
                  <th>Encours</th>
                  <th>Plafond global</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/admin/credit/entreprises/${company.id}`)}
                  >
                    <td>{company.name}</td>
                    <td>
                      <span
                        className={`credit__pill ${
                          company.status === "active" ? "credit__pill--active" : "credit__pill--rejected"
                        }`}
                      >
                        {company.status === "active" ? "Active" : "Suspendue"}
                      </span>
                    </td>
                    <td>{formatGNF(company.outstanding)}</td>
                    <td>{formatGNF(company.globalLimit)}</td>
                    <td>
                      {company.contact?.name || "—"}
                      {company.contact?.phone ? ` · ${company.contact.phone}` : ""}
                    </td>
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

export default CreditCompanies;
