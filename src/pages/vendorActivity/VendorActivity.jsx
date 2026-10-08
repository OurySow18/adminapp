import "./vendorActivity.scss";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Link } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db } from "../../firebase";
import { resolveVendorStatus, getVendorStatusLabel } from "../../utils/vendorStatus";
import {
  loadVendorActivityMap,
  isVendorInactive,
  formatLastActivity,
  getVendorLastLogin,
  INACTIVE_VENDOR_DAYS,
} from "../../utils/vendorActivity";

const SORT_OPTIONS = [
  { value: "lastSaleAsc", label: "Vente la plus ancienne" },
  { value: "lastSaleDesc", label: "Vente la plus récente" },
  { value: "lastLoginAsc", label: "Connexion la plus ancienne" },
  { value: "productCountAsc", label: "Moins de produits" },
  { value: "name", label: "Nom (A-Z)" },
];

const getVendorName = (vendor) =>
  vendor?.company?.name ||
  vendor?.companyName ||
  vendor?.name ||
  vendor?.displayName ||
  vendor?.profile?.company?.name ||
  vendor?.profile?.displayName ||
  vendor?.id;

const VendorActivity = () => {
  const [vendors, setVendors] = useState([]);
  const [activityMap, setActivityMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [sortOption, setSortOption] = useState("lastSaleAsc");
  const [productCountMin, setProductCountMin] = useState("");
  const [productCountMax, setProductCountMax] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [vendorsSnapshot, activity] = await Promise.all([
        getDocs(collection(db, "vendors")),
        loadVendorActivityMap(),
      ]);
      setVendors(
        vendorsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );
      setActivityMap(activity);
    } catch (err) {
      console.error("Failed to load vendor activity:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return vendors.map((vendor) => {
      const activity = activityMap.get(vendor.id) || null;
      const lastLoginAt = getVendorLastLogin(vendor);
      return {
        id: vendor.id,
        name: getVendorName(vendor),
        status: resolveVendorStatus(vendor, "draft"),
        totalProductCount: activity?.totalProductCount ?? 0,
        activeProductCount: activity?.activeProductCount ?? 0,
        lastSaleAt: activity?.lastSaleAt ?? null,
        lastLoginAt,
        inactive: isVendorInactive(vendor, activity),
      };
    });
  }, [vendors, activityMap]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const minProducts = productCountMin !== "" ? Number(productCountMin) : null;
    const maxProducts = productCountMax !== "" ? Number(productCountMax) : null;
    let filtered = rows;
    if (inactiveOnly) {
      filtered = filtered.filter((row) => row.inactive);
    }
    if (normalizedSearch) {
      filtered = filtered.filter((row) =>
        String(row.name || "").toLowerCase().includes(normalizedSearch)
      );
    }
    if (minProducts !== null && Number.isFinite(minProducts)) {
      filtered = filtered.filter((row) => row.totalProductCount >= minProducts);
    }
    if (maxProducts !== null && Number.isFinite(maxProducts)) {
      filtered = filtered.filter((row) => row.totalProductCount <= maxProducts);
    }

    const sorted = [...filtered];
    const time = (date) => date?.getTime() ?? 0;
    sorted.sort((a, b) => {
      switch (sortOption) {
        case "lastSaleDesc":
          return time(b.lastSaleAt) - time(a.lastSaleAt);
        case "lastLoginAsc":
          return time(a.lastLoginAt) - time(b.lastLoginAt);
        case "productCountAsc":
          return a.totalProductCount - b.totalProductCount;
        case "name":
          return String(a.name || "").localeCompare(String(b.name || ""), "fr", {
            sensitivity: "base",
          });
        case "lastSaleAsc":
        default:
          // jamais vendu (null) en premier, puis du plus ancien au plus recent
          return time(a.lastSaleAt) - time(b.lastSaleAt);
      }
    });
    return sorted;
  }, [rows, inactiveOnly, searchText, sortOption, productCountMin, productCountMax]);

  const inactiveCount = useMemo(() => rows.filter((row) => row.inactive).length, [rows]);

  return (
    <div className="vendorActivity">
      <Sidebar />
      <main className="vendorActivity__container">
        <Navbar />
        <header className="vendorActivity__header">
          <div>
            <h1>Activité des vendeurs</h1>
            <p>
              Vendeur, nombre de produits, dernière vente et dernière connexion —
              pour repérer les comptes à nettoyer. Inactif = approuvé, aucune
              vente depuis {INACTIVE_VENDOR_DAYS} jours (ou jamais), aucun
              produit visible.
            </p>
          </div>
          <div className="vendorActivity__stats">
            <div>
              <span>Vendeurs</span>
              <strong>{rows.length}</strong>
            </div>
            <div>
              <span>Inactifs</span>
              <strong>{inactiveCount}</strong>
            </div>
          </div>
        </header>

        <div className="vendorActivity__filterBar">
          <div className="vendorActivity__field">
            <label htmlFor="vendor-activity-search">Recherche</label>
            <input
              id="vendor-activity-search"
              type="text"
              placeholder="Nom du vendeur..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div className="vendorActivity__field">
            <label htmlFor="vendor-activity-sort">Trier par</label>
            <select
              id="vendor-activity-sort"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="vendorActivity__field vendorActivity__field--narrow">
            <label htmlFor="vendor-activity-products-min">Produits (min)</label>
            <input
              id="vendor-activity-products-min"
              type="number"
              min={0}
              placeholder="0"
              value={productCountMin}
              onChange={(event) => setProductCountMin(event.target.value)}
            />
          </div>
          <div className="vendorActivity__field vendorActivity__field--narrow">
            <label htmlFor="vendor-activity-products-max">Produits (max)</label>
            <input
              id="vendor-activity-products-max"
              type="number"
              min={0}
              placeholder="∞"
              value={productCountMax}
              onChange={(event) => setProductCountMax(event.target.value)}
            />
          </div>
          <label className="vendorActivity__toggle">
            <input
              type="checkbox"
              checked={inactiveOnly}
              onChange={(event) => setInactiveOnly(event.target.checked)}
            />
            Inactifs uniquement ({inactiveCount})
          </label>
          <button type="button" className="vendorActivity__refresh" onClick={loadData}>
            Rafraîchir
          </button>
          {(searchText || inactiveOnly || productCountMin !== "" || productCountMax !== "") && (
            <button
              type="button"
              className="vendorActivity__reset"
              onClick={() => {
                setSearchText("");
                setInactiveOnly(false);
                setProductCountMin("");
                setProductCountMax("");
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {error && (
          <div className="vendorActivity__banner vendorActivity__banner--error">
            Impossible de charger les données vendeurs.
          </div>
        )}

        <section className="vendorActivity__panel">
          {loading && <p className="vendorActivity__empty">Chargement...</p>}
          {!loading && !filteredRows.length && (
            <p className="vendorActivity__empty">Aucun vendeur ne correspond.</p>
          )}
          {!loading && filteredRows.length > 0 && (
            <table className="vendorActivity__table">
              <thead>
                <tr>
                  <th>Vendeur</th>
                  <th>Statut</th>
                  <th>Produits</th>
                  <th>Dernière vente</th>
                  <th>Dernière connexion</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className={row.inactive ? "vendorActivity__row--inactive" : ""}>
                    <td>
                      <Link to={`/vendors/${row.id}`}>{row.name}</Link>
                      {row.inactive && <span className="vendorActivity__badge">Inactif</span>}
                    </td>
                    <td>{getVendorStatusLabel(row.status)}</td>
                    <td>
                      {row.totalProductCount}
                      {row.totalProductCount > 0 && (
                        <span className="vendorActivity__muted">
                          {" "}
                          ({row.activeProductCount} visible
                          {row.activeProductCount > 1 ? "s" : ""})
                        </span>
                      )}
                    </td>
                    <td className={!row.lastSaleAt ? "vendorActivity__neverCell" : ""}>
                      {formatLastActivity(row.lastSaleAt)}
                    </td>
                    <td className={!row.lastLoginAt ? "vendorActivity__neverCell" : ""}>
                      {formatLastActivity(row.lastLoginAt, "Jamais connecté")}
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

export default VendorActivity;
