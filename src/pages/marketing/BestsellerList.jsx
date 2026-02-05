import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ConfirmModal from "../../components/modal/ConfirmModal";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

const resolveTitle = (data = {}) =>
  data.title ||
  data.name ||
  data.product ||
  data.core?.title ||
  data.draft?.core?.title ||
  "";

const resolveVendorName = (data = {}) =>
  data.vendorName ||
  data.vendor?.name ||
  data.vendor?.storeName ||
  data.storeName ||
  data.vendorLabel ||
  "";

const resolveVendorId = (data = {}) =>
  data.vendorId ||
  data.vendor?.id ||
  data.vendor?.vendorId ||
  data.vendor?.uid ||
  "";

const resolvePrice = (data = {}) =>
  data.price ??
  data.pricing?.basePrice ??
  data.core?.pricing?.basePrice ??
  data.draft?.core?.pricing?.basePrice ??
  null;

const resolveCurrency = (data = {}) =>
  data.currency ||
  data.pricing?.currency ||
  data.core?.pricing?.currency ||
  data.draft?.core?.pricing?.currency ||
  "GNF";

const formatDate = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value.split("T")[0];
  return "-";
};

const formatPrice = (value, currency) => {
  if (value === undefined || value === null || value === "") return "-";
  const printable = typeof value === "number" ? value.toLocaleString("fr-FR") : value;
  return `${printable} ${currency || "GNF"}`.trim();
};

const BestsellerList = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [rankUpdatingId, setRankUpdatingId] = useState(null);
  const [normalizingRanks, setNormalizingRanks] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "products_public"),
      where("recommendedRank", ">=", 0)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) =>
          list.push({ id: docSnap.id, ...docSnap.data() })
        );
        setItems(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load recommended products:", err);
        setItems([]);
        setLoading(false);
        setError("Impossible de charger les produits recommandés.");
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!items.length || normalizingRanks) return;
    const sorted = [...items].sort((a, b) => {
      const rankA =
        a.recommendedRank !== undefined && a.recommendedRank !== null
          ? Number(a.recommendedRank)
          : Number.POSITIVE_INFINITY;
      const rankB =
        b.recommendedRank !== undefined && b.recommendedRank !== null
          ? Number(b.recommendedRank)
          : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return resolveTitle(a).localeCompare(resolveTitle(b), "fr", {
        sensitivity: "base",
      });
    });

    const updates = [];
    sorted.forEach((item, index) => {
      const expectedRank = index + 1;
      if (item.recommendedRank !== expectedRank) {
        updates.push({ id: item.id, rank: expectedRank });
      }
    });

    if (!updates.length) return;
    const normalize = async () => {
      setNormalizingRanks(true);
      const now = new Date().toISOString();
      const updatedBy =
        auth.currentUser?.email || auth.currentUser?.uid || "system";
      try {
        const batch = writeBatch(db);
        updates.forEach((update) => {
          batch.update(doc(db, "products_public", update.id), {
            recommendedRank: update.rank,
            recommendedUpdatedAt: now,
            recommendedUpdatedBy: updatedBy,
          });
        });
        await batch.commit();
      } catch (err) {
        console.error("Failed to normalize recommended ranks:", err);
      } finally {
        setNormalizingRanks(false);
      }
    };
    normalize();
  }, [items, normalizingRanks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? items.filter((item) => {
          const haystack = [
            item.title,
            item.name,
            item.product,
            item.vendorName,
            item.vendorId,
            item.productId,
            item.id,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : items;
    const sorted = [...base];
    sorted.sort((a, b) => {
      const rankA =
        a.recommendedRank !== undefined && a.recommendedRank !== null
          ? Number(a.recommendedRank)
          : Number.POSITIVE_INFINITY;
      const rankB =
        b.recommendedRank !== undefined && b.recommendedRank !== null
          ? Number(b.recommendedRank)
          : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      const titleA = resolveTitle(a).toLowerCase();
      const titleB = resolveTitle(b).toLowerCase();
      return titleA.localeCompare(titleB, "fr");
    });
    return sorted;
  }, [items, search]);

  

  const handleToggleStatus = async (item) => {
    setActionError(null);
    try {
      const updatedBy =
        auth.currentUser?.email || auth.currentUser?.uid || "system";
      await updateDoc(doc(db, "products_public", item.id), {
        recommended: !item.recommended,
        recommendedUpdatedAt: new Date().toISOString(),
        recommendedUpdatedBy: updatedBy,
      });
    } catch (err) {
      console.error("Failed to update recommended status:", err);
      setActionError("Impossible de mettre à jour le statut.");
    }
  };

  const handleMoveRank = async (item, direction) => {
    if (!item || !direction) return;
    const index = filtered.findIndex((entry) => entry.id === item.id);
    if (index === -1) return;
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= filtered.length) return;

    const neighbor = filtered[neighborIndex];
    if (!neighbor) return;

    const now = new Date().toISOString();
    const updatedBy = auth.currentUser?.email || auth.currentUser?.uid || "system";

    const currentRankRaw = Number(item.recommendedRank);
    const neighborRankRaw = Number(neighbor.recommendedRank);
    const currentRank = Number.isNaN(currentRankRaw) ? index + 1 : currentRankRaw;
    const neighborRank = Number.isNaN(neighborRankRaw)
      ? neighborIndex + 1
      : neighborRankRaw;

    setRankUpdatingId(item.id);
    setActionError(null);
    try {
      await updateDoc(doc(db, "products_public", item.id), {
        recommendedRank: neighborRank,
        recommendedUpdatedAt: now,
        recommendedUpdatedBy: updatedBy,
      });
      await updateDoc(doc(db, "products_public", neighbor.id), {
        recommendedRank: currentRank,
        recommendedUpdatedAt: now,
        recommendedUpdatedBy: updatedBy,
      });
    } catch (err) {
      console.error("Failed to move recommended rank:", err);
      setActionError("Impossible de modifier le rang.");
    } finally {
      setRankUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      const updatedBy =
        auth.currentUser?.email || auth.currentUser?.uid || "system";
      await updateDoc(doc(db, "products_public", confirmTarget.id), {
        recommended: false,
        recommendedRank: null,
        recommendedUpdatedAt: new Date().toISOString(),
        recommendedUpdatedBy: updatedBy,
      });
      setConfirmTarget(null);
    } catch (err) {
      console.error("Failed to remove recommended:", err);
      setActionError("Impossible de retirer le recommandé.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="marketingPage">
      <Sidebar />
      <div className="marketingPage__container">
        <Navbar />
        <div className="marketingPage__content">
          <div className="marketingPage__header marketingPage__header--between">
            <div>
              <h1>Produits recommandés</h1>
              <p className="subtitle">Gérez la liste des produits recommandés.</p>
            </div>
            <Link to="/admin/marketing/bestsellers/new" className="button primary">
              Nouveau recommandé
            </Link>
          </div>

          <div className="marketingPage__list">
            <div className="marketingPage__listHeader marketingPage__listHeader--between">
              <div>
                <p className="eyebrow">Catalogue</p>
                <h2>Liste ({filtered.length})</h2>
              </div>
              <div className="marketingPage__listMeta">
                <input
                  type="search"
                  placeholder="Rechercher (produit, vendeur...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="marketingPage__search"
                />
                {loading && <span className="helper">Chargement...</span>}
                {error && <span className="error">{error}</span>}
                {actionError && <span className="error">{actionError}</span>}
              </div>
            </div>

            {filtered.length === 0 && !loading ? (
              <p className="helper">Aucun produit recommandé.</p>
            ) : (
              <div className="bannerTable bannerTable--bestsellers">
                <div className="bannerTable__head">
                  <span>Produit</span>
                  <span>Boutique</span>
                  <span>Prix</span>
                  <span>Rang</span>
                  <span>Statut</span>
                  <span>MAJ</span>
                  <span className="textRight">Actions</span>
                </div>
                {filtered.map((item, index) => (
                  <div className="bannerTable__row" key={item.id}>
                    <span className="bannerTable__cell bannerTable__cell--strong">
                      {resolveTitle(item) || "-"}
                      <span className="bannerTable__meta">
                        ID: {item.id}
                      </span>
                    </span>
                    <span className="bannerTable__cell">
                      {resolveVendorName(item) || resolveVendorId(item) || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      {formatPrice(resolvePrice(item), resolveCurrency(item))}
                    </span>
                    <span className="bannerTable__cell">
                      {item.recommendedRank ?? index + 1}
                    </span>
                    <span className="bannerTable__cell">
                      <span
                        className={`pill ${
                          item.recommended ? "pill--green" : "pill--gray"
                        }`}
                      >
                        {item.recommended ? "Actif" : "Inactif"}
                      </span>
                    </span>
                    <span className="bannerTable__cell">
                      {formatDate(
                        item.recommendedUpdatedAt || item.updatedAt || item.createdAt
                      )}
                    </span>
                    <span className="bannerTable__cell bannerTable__actions textRight">
                      <button
                        type="button"
                        className="ghost neutral action-compact"
                        onClick={() => handleMoveRank(item, "up")}
                        disabled={rankUpdatingId === item.id || filtered[0]?.id === item.id}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="ghost neutral action-compact"
                        onClick={() => handleMoveRank(item, "down")}
                        disabled={
                          rankUpdatingId === item.id ||
                          filtered[filtered.length - 1]?.id === item.id
                        }
                      >
                        ↓
                      </button>
                      <Link
                        to={`/admin/marketing/bestsellers/${item.id}`}
                        className="ghost action-primary action-icon"
                        title="Modifier"
                        aria-label="Modifier"
                      >
                        <EditIcon fontSize="small" />
                      </Link>
                      <button
                        type="button"
                        className={`ghost action-primary action-icon ${
                          item.recommended ? "secondary" : "neutral"
                        }`}
                        onClick={() => handleToggleStatus(item)}
                        title={item.recommended ? "Désactiver" : "Activer"}
                        aria-label={item.recommended ? "Désactiver" : "Activer"}
                      >
                        {item.recommended ? (
                          <ToggleOffIcon fontSize="small" />
                        ) : (
                          <ToggleOnIcon fontSize="small" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="ghost danger action-primary action-icon"
                        onClick={() => setConfirmTarget(item)}
                        title="Retirer"
                        aria-label="Retirer"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmTarget)}
        title="Retirer le recommandé"
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
        confirmText="Retirer"
        loading={deleting}
      >
        {confirmTarget ? (
          <p>
            Retirer{" "}
            <strong>{resolveTitle(confirmTarget) || "ce produit"}</strong> de la
            liste des recommandés ?
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
};

export default BestsellerList;
