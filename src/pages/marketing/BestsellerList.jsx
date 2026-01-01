import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link } from "react-router-dom";
import ConfirmModal from "../../components/modal/ConfirmModal";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

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

  useEffect(() => {
    const q = query(collection(db, "bestseller"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
        setItems(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load bestsellers:", err);
        setItems([]);
        setLoading(false);
        setError("Impossible de charger les bestsellers.");
      }
    );
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.productId,
        item.vendorName,
        item.vendorId,
        item.status,
        item.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const handleToggleStatus = async (item) => {
    setActionError(null);
    try {
      const nextStatus = item.status === "active" ? "inactive" : "active";
      const updatedBy =
        auth.currentUser?.email || auth.currentUser?.uid || "system";
      await updateDoc(doc(db, "bestseller", item.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });
    } catch (err) {
      console.error("Failed to update bestseller status:", err);
      setActionError("Impossible de mettre à jour le statut.");
    }
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteDoc(doc(db, "bestseller", confirmTarget.id));
      setConfirmTarget(null);
    } catch (err) {
      console.error("Failed to delete bestseller:", err);
      setActionError("Impossible de supprimer le bestseller.");
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
              <h1>Bestsellers</h1>
              <p className="subtitle">Gérez la liste des produits mis en avant.</p>
            </div>
            <Link to="/admin/marketing/bestsellers/new" className="button primary">
              Nouveau bestseller
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
              <p className="helper">Aucun bestseller.</p>
            ) : (
              <div className="bannerTable">
                <div className="bannerTable__head">
                  <span>Produit</span>
                  <span>Boutique</span>
                  <span>Prix</span>
                  <span>Statut</span>
                  <span>MAJ</span>
                  <span className="textRight">Actions</span>
                </div>
                {filtered.map((item) => (
                  <div className="bannerTable__row" key={item.id}>
                    <span className="bannerTable__cell bannerTable__cell--strong">
                      {item.title || "-"}
                      <span className="bannerTable__meta">
                        ID: {item.productId || item.id}
                      </span>
                    </span>
                    <span className="bannerTable__cell">
                      {item.vendorName || item.vendorId || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      {formatPrice(item.price, item.currency)}
                    </span>
                    <span className="bannerTable__cell">
                      <span
                        className={`pill ${
                          item.status === "active" ? "pill--green" : "pill--gray"
                        }`}
                      >
                        {item.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </span>
                    <span className="bannerTable__cell">
                      {formatDate(item.updatedAt || item.createdAt)}
                    </span>
                    <span className="bannerTable__cell bannerTable__actions textRight">
                      <Link
                        to={`/admin/marketing/bestsellers/${item.id}`}
                        className="ghost"
                      >
                        Modifier
                      </Link>
                      <button
                        type="button"
                        className={`ghost ${
                          item.status === "active" ? "secondary" : "neutral"
                        }`}
                        onClick={() => handleToggleStatus(item)}
                      >
                        {item.status === "active" ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => setConfirmTarget(item)}
                      >
                        Supprimer
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
        title="Supprimer le bestseller"
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
        confirmText="Supprimer"
        loading={deleting}
      >
        {confirmTarget ? (
          <p>
            Confirmer la suppression de{" "}
            <strong>{confirmTarget.title || "ce produit"}</strong> ?
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
};

export default BestsellerList;
