import "./statistics.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";

const StatisticsShell = ({ title, subtitle, children }) => {
  return (
    <div className="statisticsPage">
      <Sidebar />
      <div className="statisticsPage__container">
        <Navbar />
        <div className="statisticsPage__content">
          <header className="statisticsHero">
            <div className="statisticsHero__main">
              <p className="statisticsPage__eyebrow">Pilotage</p>
              <h1>{title}</h1>
              {subtitle ? <p className="statisticsPage__subtitle">{subtitle}</p> : null}
            </div>
            <div className="statisticsHero__side">
              <div className="statisticsPage__chip">Tableau pro</div>
              <div className="statisticsHero__note">
                <span className="statisticsHero__noteLabel">Lecture</span>
                <strong>Temps réel</strong>
                <small>Données issues des collections admin déjà utilisées par l’équipe.</small>
              </div>
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
};

export const StatisticsKpiGrid = ({ items }) => {
  return (
    <section className="statisticsPage__kpis">
      {items.map((item, index) => (
        <article
          key={item.label}
          className={`statisticsCard statisticsCard--kpi statisticsCard--kpi-${
            (index % 4) + 1
          }`}
        >
          <span className="statisticsCard__accent" />
          <span className="statisticsCard__label">{item.label}</span>
          <strong className="statisticsCard__value">{item.value}</strong>
          {item.helper ? (
            <span className="statisticsCard__helper">{item.helper}</span>
          ) : null}
        </article>
      ))}
    </section>
  );
};

export const StatisticsSection = ({ title, subtitle, children }) => {
  return (
    <section className="statisticsCard statisticsCard--section">
      <div className="statisticsCard__header">
        <div>
          <span className="statisticsCard__eyebrow">Analyse</span>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="statisticsCard__body">{children}</div>
    </section>
  );
};

export const StatisticsTable = ({ columns, rows, emptyText = "Aucune donnée." }) => {
  if (!rows.length) {
    return <div className="statisticsPage__empty">{emptyText}</div>;
  }

  return (
    <div className="statisticsTableWrap">
      <table className="statisticsTable">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `${index}-${row[columns[0].key] || "row"}`}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StatisticsShell;
