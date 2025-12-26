import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebase";

const BannerList = () => {
  const [banners, setBanners] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "banners"), orderBy("createdAt", "desc"));
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
        setError("Impossible de charger les bannières.");
      }
    );
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return banners;
    return banners.filter((banner) => {
      const haystack = [
        banner.title,
        banner.subtitle,
        banner.badge,
        banner.targetLabel,
        banner.targetId,
        banner.status,
        banner.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [banners, search]);

  const handleToggleStatus = async (banner) => {
    setActionError(null);
    try {
      const nextStatus = banner.status === "active" ? "inactive" : "active";
      const updatedBy =
        auth.currentUser?.email || auth.currentUser?.uid || "system";
      await updateDoc(doc(db, "banners", banner.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });
    } catch (err) {
      console.error("Failed to update banner status:", err);
      setActionError("Impossible de mettre à jour le statut.");
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
              <h1>Banniere</h1>
              <p className="subtitle">Gérez les visuels principaux.</p>
            </div>
            <Link to="/admin/marketing/banners/new" className="button primary">
              Nouvelle bannière
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
                  placeholder="Rechercher (titre, badge, cible...)"
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
              <p className="helper">Aucune bannière.</p>
            ) : (
              <div className="bannerTable">
                <div className="bannerTable__head">
                  <span>Titre</span>
                  <span>Cible</span>
                  <span>Badge</span>
                  <span>Statut</span>
                  <span>MAJ</span>
                  <span className="textRight">Actions</span>
                </div>
                {filtered.map((banner) => (
                  <div className="bannerTable__row" key={banner.id}>
                    <span className="bannerTable__cell bannerTable__cell--strong">
                      {banner.title || "-"}
                      <span className="bannerTable__meta">ID: {banner.id}</span>
                    </span>
                    <span className="bannerTable__cell">
                      {banner.targetLabel || banner.targetId || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      {banner.badge || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      <span
                        className={`pill ${
                          banner.status === "active" ? "pill--green" : "pill--gray"
                        }`}
                      >
                        {banner.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </span>
                    <span className="bannerTable__cell">
                      {banner.updatedAt ? banner.updatedAt.split("T")[0] : "-"}
                    </span>
                    <span className="bannerTable__cell bannerTable__actions textRight">
                      <Link to={`/admin/marketing/banners/${banner.id}`} className="ghost">
                        Modifier
                      </Link>
                      <button
                        type="button"
                        className={`ghost ${banner.status === "active" ? "secondary" : "neutral"}`}
                        onClick={() => handleToggleStatus(banner)}
                      >
                        {banner.status === "active" ? "Désactiver" : "Activer"}
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

export default BannerList;
