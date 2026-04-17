import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link } from "react-router-dom";
import ConfirmModal from "../../components/modal/ConfirmModal";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

const isHttpImageUrl = (value) =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const getCategoryCoverSource = (category) => {
  if (normalizeString(category?.coverImage)) {
    return { url: category.coverImage, label: "source: coverImage", tone: "green" };
  }
  if (normalizeString(category?.coverImageUrl)) {
    return {
      url: category.coverImageUrl,
      label: "source: coverImageUrl",
      tone: "blue",
    };
  }
  if (normalizeString(category?.imageURL)) {
    return {
      url: category.imageURL,
      label: "source: imageURL (fallback)",
      tone: "blue",
    };
  }
  return { url: "", label: "sans image", tone: "gray" };
};

const sortCategories = (rows) =>
  [...rows].sort((a, b) => {
    const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : 999999;
    const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : 999999;
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.name || a?.label || a?.id || "").localeCompare(
      String(b?.name || b?.label || b?.id || ""),
      "fr"
    );
  });

const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const MarketingCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "categories"),
      (snapshot) => {
        const rows = [];
        snapshot.forEach((docSnap) =>
          rows.push({
            id: docSnap.id,
            ...docSnap.data(),
          })
        );
        const sorted = sortCategories(rows);
        setCategories(sorted);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load categories:", err);
        setCategories([]);
        setLoading(false);
        setError("Impossible de charger les catégories.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => {
      const values = [
        cat.id,
        cat.name,
        cat.label,
        cat.parentId,
        cat.parentName,
        cat.slug,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return values.some((value) => value.includes(q));
    });
  }, [categories, search]);

  const batchInitializableCount = useMemo(
    () =>
      categories.filter((cat) => {
        const hasCover = Boolean(normalizeString(cat.coverImage));
        const fallbackImage = normalizeString(cat.imageURL);
        return !hasCover && Boolean(fallbackImage);
      }).length,
    [categories]
  );

  const openBatchConfirm = () => {
    if (!categories.length || batchLoading) return;
    if (!batchInitializableCount) {
      setFeedback({
        type: "warning",
        message:
          "Aucune catégorie à initialiser (coverImage déjà défini ou imageURL absent).",
      });
      return;
    }
    setBatchConfirmOpen(true);
  };

  const handleBatchInitialize = async () => {
    if (!categories.length || batchLoading) return;

    const targets = categories.filter((cat) => {
      const hasCover = Boolean(normalizeString(cat.coverImage));
      const fallbackImage = normalizeString(cat.imageURL);
      return !hasCover && Boolean(fallbackImage);
    });

    if (!targets.length) {
      setFeedback({
        type: "warning",
        message: "Aucune catégorie à initialiser (coverImage déjà défini ou imageURL absent).",
      });
      return;
    }

    setBatchLoading(true);
    setBatchConfirmOpen(false);
    setFeedback(null);
    try {
      const groups = chunk(targets, 400);
      let updatedCount = 0;

      for (const group of groups) {
        const batch = writeBatch(db);
        let groupUpdatedCount = 0;
        group.forEach((cat) => {
          const imageURL = normalizeString(cat.imageURL);
          if (!imageURL) return;
          batch.set(
            doc(db, "categories", cat.id),
            {
              coverImage: imageURL,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          groupUpdatedCount += 1;
        });
        await batch.commit();
        updatedCount += groupUpdatedCount;
      }

      setFeedback({
        type: "success",
        message: `Initialisation terminée: ${updatedCount} catégorie(s) mise(s) à jour.`,
      });
    } catch (err) {
      console.error("Failed to initialize coverImage from imageURL:", err);
      setFeedback({
        type: "error",
        message: "Erreur pendant l'initialisation batch des coverImage.",
      });
    } finally {
      setBatchLoading(false);
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
              <h1>Catégories</h1>
              <p className="subtitle">
                Gérez les images de couverture des catégories pour la Home mobile.
              </p>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={openBatchConfirm}
              disabled={batchLoading || loading}
            >
              {batchLoading
                ? "Initialisation..."
                : "Initialiser coverImage depuis imageURL"}
            </button>
          </div>

          {feedback && (
            <div
              className={`feedback feedback--${feedback.type || "success"}`}
              aria-live="polite"
            >
              {feedback.message}
            </div>
          )}

          <div className="marketingPage__list">
            <div className="marketingPage__listHeader marketingPage__listHeader--between">
              <div>
                <p className="eyebrow">Collection Firestore</p>
                <h2>categories ({filteredCategories.length})</h2>
              </div>
              <div className="marketingPage__listMeta">
                <input
                  type="search"
                  placeholder="Rechercher une catégorie..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="marketingPage__search"
                />
                {loading && <span className="helper">Chargement...</span>}
                {error && <span className="error">{error}</span>}
              </div>
            </div>

            {!loading && filteredCategories.length === 0 ? (
              <p className="helper">Aucune catégorie trouvée.</p>
            ) : (
              <div className="categoryTable">
                <div className="categoryTable__head">
                  <span>Couverture</span>
                  <span>Catégorie</span>
                  <span>Parent</span>
                  <span>Ordre</span>
                  <span>Statut</span>
                  <span className="textRight">Action</span>
                </div>
                {filteredCategories.map((cat) => {
                  const coverSourceMeta = getCategoryCoverSource(cat);
                  const coverSource = coverSourceMeta.url;
                  const hasExplicitCover =
                    Boolean(normalizeString(cat.coverImage)) ||
                    Boolean(normalizeString(cat.coverImageUrl));
                  return (
                    <div
                      className="categoryTable__row"
                      key={cat.id}
                    >
                      <span className="categoryTable__cell">
                        <div className="categoryThumb">
                          {isHttpImageUrl(coverSource) ? (
                            <img
                              src={coverSource}
                              alt={cat.name || cat.id}
                              className="categoryThumb__img"
                            />
                          ) : (
                            <div className="categoryThumb__placeholder">Aucune image</div>
                          )}
                          <div className="categoryThumb__badges">
                            <span
                              className={`pill ${
                                hasExplicitCover ? "pill--green" : "pill--gray"
                              }`}
                            >
                              {hasExplicitCover ? "cover ok" : "sans cover"}
                            </span>
                            <span
                              className={`pill ${
                                coverSourceMeta.tone === "green"
                                  ? "pill--green"
                                  : coverSourceMeta.tone === "blue"
                                  ? "pill--blue"
                                  : "pill--gray"
                              }`}
                            >
                              {coverSourceMeta.label}
                            </span>
                          </div>
                        </div>
                      </span>
                      <span className="categoryTable__cell categoryTable__cell--strong">
                        {cat.name || cat.label || "-"}
                        <span className="bannerTable__meta">ID: {cat.id}</span>
                      </span>
                      <span className="categoryTable__cell">
                        {cat.parentId || cat.parentName || "-"}
                      </span>
                      <span className="categoryTable__cell">{cat.order ?? "-"}</span>
                      <span className="categoryTable__cell">
                        <span
                          className={`pill ${
                            cat.isActive === false ? "pill--gray" : "pill--blue"
                          }`}
                        >
                          {cat.isActive === false ? "Inactif" : "Actif"}
                        </span>
                      </span>
                      <span className="categoryTable__cell categoryTable__actions textRight">
                        <Link
                          to={`/admin/marketing/categories/${encodeURIComponent(cat.id)}`}
                          className="ghost"
                          style={{ textDecoration: "none" }}
                        >
                          Modifier cover
                        </Link>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        open={batchConfirmOpen}
        title="Confirmer l'initialisation des coverImage"
        onClose={() => setBatchConfirmOpen(false)}
        onConfirm={handleBatchInitialize}
        confirmText="Lancer l'initialisation"
        cancelText="Annuler"
        loading={batchLoading}
      >
        <p className="helper">
          {batchInitializableCount} catégorie(s) seront mises à jour en copiant
          `imageURL` vers `coverImage` uniquement si `coverImage` est absent.
        </p>
        <p className="helper">
          Vérifiez le nombre avant de confirmer.
        </p>
      </ConfirmModal>
    </div>
  );
};

export default MarketingCategories;
