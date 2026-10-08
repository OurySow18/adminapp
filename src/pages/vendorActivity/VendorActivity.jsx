import "./vendorActivity.scss";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import { auth, db } from "../../firebase";
import { resolveVendorStatus, getVendorStatusLabel } from "../../utils/vendorStatus";
import { escapeHtml } from "../vendors/vendorDetailsHelpers";
import {
  loadVendorActivityMap,
  isVendorInactive,
  formatLastActivity,
  getVendorLastLogin,
  INACTIVE_VENDOR_DAYS,
} from "../../utils/vendorActivity";

const getVendorEmail = (vendor) =>
  vendor?.company?.email ||
  vendor?.email ||
  vendor?.contactEmail ||
  vendor?.profile?.email ||
  vendor?.profile?.company?.email ||
  null;

const buildDefaultWarningMessage = (vendorName) =>
  `Bonjour,

Nous avons remarqué qu'aucune activité (vente ou connexion) n'a été enregistrée récemment sur votre boutique "${vendorName}" sur Monmarché.

Sans activité de votre part, votre compte pourrait être suspendu prochainement.

Si vous souhaitez continuer à vendre sur Monmarché, merci de mettre à jour votre catalogue ou de vous connecter rapidement. N'hésitez pas à nous contacter en cas de besoin.

L'équipe Monmarché`;

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

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const formatExactDateTime = (date) =>
  date
    ? date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const VendorActivity = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [activityMap, setActivityMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [sortOption, setSortOption] = useState("lastSaleAsc");
  const [productCountMin, setProductCountMin] = useState("");
  const [productCountMax, setProductCountMax] = useState("");
  const [warningTarget, setWarningTarget] = useState(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [warningSending, setWarningSending] = useState(false);
  const [warningError, setWarningError] = useState("");
  const [warningSuccess, setWarningSuccess] = useState("");

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
        email: getVendorEmail(vendor),
        status: resolveVendorStatus(vendor, "draft"),
        totalProductCount: activity?.totalProductCount ?? 0,
        activeProductCount: activity?.activeProductCount ?? 0,
        lastSaleAt: activity?.lastSaleAt ?? null,
        lastLoginAt,
        lastWarningAt: toDate(vendor?.lastWarningAt),
        inactive: isVendorInactive(vendor, activity),
        raw: vendor,
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

  const openWarningModal = (row) => {
    setWarningTarget(row);
    setWarningMessage(buildDefaultWarningMessage(row.name));
    setWarningError("");
    setWarningSuccess("");
  };

  const closeWarningModal = () => {
    if (warningSending) return;
    setWarningTarget(null);
    setWarningMessage("");
    setWarningError("");
  };

  const sendWarning = async () => {
    if (!warningTarget) return;
    const finalMessage = warningMessage.trim();
    if (!finalMessage) {
      setWarningError("Le message est obligatoire.");
      return;
    }
    const vendorEmail = warningTarget.email;
    if (!vendorEmail) {
      setWarningError("Aucun email de contact trouvé pour ce vendeur.");
      return;
    }

    setWarningSending(true);
    setWarningError("");
    try {
      const vendorNameSafe = escapeHtml(warningTarget.name);
      const messageHtml = escapeHtml(finalMessage).replace(/\n/g, "<br />");
      const html = `
        <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Dernier avertissement - Monmarché</title></head>
        <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:#dc2626;color:#fff;padding:12px;text-align:center">
              <h1 style="margin:0;font-size:20px">Avertissement - Boutique ${vendorNameSafe}</h1>
            </div>
            <div style="padding:20px">
              <p>${messageHtml}</p>
            </div>
            <div style="background:#dc2626;color:#fff;padding:10px;text-align:center;font-size:12px">
              &copy; ${new Date().getFullYear()} Monmarché
            </div>
          </div>
        </body></html>`;

      await addDoc(collection(db, "mail"), {
        to: vendorEmail,
        message: {
          subject: "Dernier avertissement - Monmarché",
          text: finalMessage,
          html,
        },
      });

      await updateDoc(doc(db, "vendors", warningTarget.id), {
        lastWarningAt: serverTimestamp(),
        lastWarningMessage: finalMessage,
        lastWarningBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
      });

      // Mise a jour optimiste locale (pas de refresh complet necessaire pour
      // voir la colonne "Dernier avertissement" se mettre a jour).
      const sentAt = new Date();
      setVendors((prev) =>
        prev.map((vendor) =>
          vendor.id === warningTarget.id
            ? { ...vendor, lastWarningAt: sentAt, lastWarningMessage: finalMessage }
            : vendor
        )
      );

      setWarningSuccess(`Avertissement envoyé à ${warningTarget.name}.`);
      setWarningTarget(null);
      setWarningMessage("");
    } catch (err) {
      console.error("Erreur envoi avertissement vendeur:", err);
      setWarningError("Impossible d'envoyer l'avertissement. Merci de réessayer.");
    } finally {
      setWarningSending(false);
    }
  };

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
        {warningSuccess && (
          <div className="vendorActivity__banner vendorActivity__banner--success">
            {warningSuccess}
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
                  <th>Dernier avertissement</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className={row.inactive ? "vendorActivity__row--inactive" : ""}>
                    <td>
                      {row.name}
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
                    <td>
                      {row.lastWarningAt ? (
                        <span
                          className="vendorActivity__warnedCell"
                          title={formatExactDateTime(row.lastWarningAt)}
                        >
                          {formatLastActivity(row.lastWarningAt)}
                        </span>
                      ) : (
                        <span className="vendorActivity__muted">Aucun</span>
                      )}
                    </td>
                    <td className="vendorActivity__actions">
                      <button
                        type="button"
                        className="vendorActivity__actionBtn vendorActivity__actionBtn--warn"
                        onClick={() => openWarningModal(row)}
                        disabled={Boolean(row.lastWarningAt)}
                        title={
                          row.lastWarningAt
                            ? `Déjà averti le ${formatExactDateTime(row.lastWarningAt)}`
                            : undefined
                        }
                      >
                        {row.lastWarningAt ? "Déjà averti" : "Avertir"}
                      </button>
                      <button
                        type="button"
                        className="vendorActivity__actionBtn"
                        onClick={() => navigate(`/vendors/${row.id}`)}
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <ConfirmModal
          open={Boolean(warningTarget)}
          title={warningTarget ? `Avertir ${warningTarget.name}` : ""}
          onClose={closeWarningModal}
          onConfirm={sendWarning}
          confirmText="Envoyer l'avertissement"
          loading={warningSending}
          confirmButtonClassName="confirmModal__button--strongConfirm"
        >
          {warningTarget && !warningTarget.email && (
            <p className="workModal__error">
              Aucun email de contact trouvé pour ce vendeur — l'envoi échouera.
            </p>
          )}
          {warningTarget?.lastWarningAt && (
            <p className="workModal__text">
              ⚠ Un avertissement a déjà été envoyé à ce vendeur le{" "}
              <strong>{formatExactDateTime(warningTarget.lastWarningAt)}</strong>.
            </p>
          )}
          <div className="workModal__field">
            <label htmlFor="vendor-warning-message">Message envoyé au vendeur</label>
            <textarea
              id="vendor-warning-message"
              value={warningMessage}
              onChange={(event) => {
                setWarningMessage(event.target.value);
                if (warningError) setWarningError("");
              }}
              rows={9}
              disabled={warningSending}
            />
          </div>
          {warningError && <p className="workModal__error">{warningError}</p>}
        </ConfirmModal>
      </main>
    </div>
  );
};

export default VendorActivity;
