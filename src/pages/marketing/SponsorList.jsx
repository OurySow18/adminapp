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

const SponsorList = () => {
  const [sponsors, setSponsors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "sponsors"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
        setSponsors(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load sponsors:", err);
        setSponsors([]);
        setLoading(false);
        setError("Impossible de charger les sponsors.");
      }
    );
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sponsors;
    return sponsors.filter((sponsor) => {
      const haystack = [
        sponsor.title,
        sponsor.subtitle,
        sponsor.badge,
        sponsor.targetLabel,
        sponsor.targetId,
        sponsor.productId,
        sponsor.categoryId,
        sponsor.status,
        sponsor.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sponsors, search]);

  const handleToggleStatus = async (sponsor) => {
    setActionError(null);
    try {
      const nextStatus = sponsor.status === "active" ? "inactive" : "active";
      const updatedBy =
        auth.currentUser?.email || auth.currentUser?.uid || "system";
      await updateDoc(doc(db, "sponsors", sponsor.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });
    } catch (err) {
      console.error("Failed to update sponsor status:", err);
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
              <h1>Sponsors</h1>
              <p className="subtitle">Gérez les sponsors et associations.</p>
            </div>
            <Link to="/admin/marketing/sponsors/new" className="button primary">
              Nouveau sponsor
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
                  placeholder="Rechercher (titre, produit, catégorie...)"
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
              <p className="helper">Aucun sponsor.</p>
            ) : (
              <div className="bannerTable">
                <div className="bannerTable__head">
                  <span>Titre</span>
                  <span>Cible</span>
                  <span>Produit</span>
                  <span>Catégorie</span>
                  <span>Statut</span>
                  <span className="textRight">Actions</span>
                </div>
                {filtered.map((sponsor) => (
                  <div className="bannerTable__row" key={sponsor.id}>
                    <span className="bannerTable__cell bannerTable__cell--strong">
                      {sponsor.title || "-"}
                      <span className="bannerTable__meta">ID: {sponsor.id}</span>
                    </span>
                    <span className="bannerTable__cell">
                      {sponsor.targetLabel || sponsor.targetId || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      {sponsor.productId || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      {sponsor.categoryId || "-"}
                    </span>
                    <span className="bannerTable__cell">
                      <span
                        className={`pill ${
                          sponsor.status === "active" ? "pill--green" : "pill--gray"
                        }`}
                      >
                        {sponsor.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </span>
                    <span className="bannerTable__cell bannerTable__actions textRight">
                      <Link to={`/admin/marketing/sponsors/${sponsor.id}`} className="ghost">
                        Modifier
                      </Link>
                      <button
                        type="button"
                        className={`ghost ${sponsor.status === "active" ? "secondary" : "neutral"}`}
                        onClick={() => handleToggleStatus(sponsor)}
                      >
                        {sponsor.status === "active" ? "Désactiver" : "Activer"}
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

export default SponsorList;
