import "./MarketingPage.scss";
import { useEffect, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

const renderBannerTarget = (banner) => {
  switch (banner.targetType) {
    case "product":
      return `Produit: ${banner.targetId || "-"}`;
    case "vendor":
      return banner.targetLabel
        ? `Vendeur: ${banner.targetLabel}`
        : `Vendeur: ${banner.targetId || "-"}`;
    case "category":
      return `Catégorie: ${banner.targetId || "-"}`;
    case "search":
      return `Recherche: ${banner.query || "-"}`;
    case "url":
      return `URL: ${banner.url || "-"}`;
    default:
      return "-";
  }
};

const MarketingList = () => {
  const [banners, setBanners] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "banners"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
        setBanners(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load banners:", err);
        setBanners([]);
        setLoading(false);
        setError("Impossible de charger les visuels.");
      }
    );
    return () => unsubscribe();
  }, []);

  const handleToggleVisible = async (banner) => {
    setActionError(null);
    try {
      await updateDoc(doc(db, "banners", banner.id), { visible: !banner.visible });
    } catch (err) {
      console.error("Failed to update visibility:", err);
      setActionError("Impossible de mettre à jour la visibilité.");
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
              <h1>Visuels</h1>
            </div>
            <Link to="/admin/marketing/new" className="button primary">
              Nouveau visuel
            </Link>
          </div>

          <div className="marketingPage__list">
            <div className="marketingPage__listHeader marketingPage__listHeader--between">
              <div>
                <p className="eyebrow">Catalogue</p>
                <h2>Liste ({banners.length})</h2>
              </div>
              <div className="marketingPage__listMeta">
                <input
                  type="search"
                  placeholder="Rechercher (titre, vendeur, id...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="marketingPage__search"
                />
                {loading && <span className="helper">Chargement...</span>}
                {error && <span className="error">{error}</span>}
                {actionError && <span className="error">{actionError}</span>}
              </div>
            </div>
            {banners.length === 0 && !loading ? (
              <p className="helper">Aucun visuel.</p>
            ) : (
              <div className="bannerTable">
                <div className="bannerTable__head">
                  <span>Titre</span>
                  <span>Segment</span>
                  <span>Cible</span>
                  <span>Ordre</span>
                  <span>Visibilité</span>
                  <span className="textRight">Actions</span>
                </div>
                {banners
                  .filter((banner) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    const haystack = [
                      banner.title,
                      banner.targetLabel,
                      banner.targetId,
                      banner.segment,
                      banner.id,
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase();
                    return haystack.includes(q);
                  })
                  .map((banner) => (
                  <div className="bannerTable__row" key={banner.id}>
                    <span className="bannerTable__cell bannerTable__cell--strong">
                      {banner.title || "-"}
                      <span className="bannerTable__meta">
                        ID: {banner.id}
                      </span>
                    </span>
                    <span className="bannerTable__cell">
                      <span className="pill pill--blue">
                        {banner.segment || "all"}
                      </span>
                    </span>
                    <span className="bannerTable__cell">{renderBannerTarget(banner)}</span>
                    <span className="bannerTable__cell">{banner.order ?? 0}</span>
                    <span className="bannerTable__cell">
                      <span
                        className={`pill ${banner.visible ? "pill--green" : "pill--gray"}`}
                      >
                        {banner.visible ? "Actif" : "Inactif"}
                      </span>
                    </span>
                    <span className="bannerTable__cell bannerTable__actions textRight">
                      <Link to={`/admin/marketing/${banner.id}`} className="ghost">
                        Modifier
                      </Link>
                      <button
                        type="button"
                        className={`ghost ${banner.visible ? "secondary" : "neutral"}`}
                        onClick={() => handleToggleVisible(banner)}
                      >
                        {banner.visible ? "Désactiver" : "Activer"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingList;
