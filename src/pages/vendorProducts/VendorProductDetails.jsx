import "./vendorProductDetails.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";

const formatDateTime = (value) => {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? format(date, "dd/MM/yyyy HH:mm:ss") : "-";
  }
  if (value instanceof Date) {
    return format(value, "dd/MM/yyyy HH:mm:ss");
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : format(parsed, "dd/MM/yyyy HH:mm:ss");
};

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const VendorProductDetails = () => {
  const { vendorId: vendorIdParam, productId: productIdParam } = useParams();
  const vendorId = decodeURIComponent(vendorIdParam || "_");
  const productId = decodeURIComponent(productIdParam || "");
  const navigate = useNavigate();
  const location = useLocation();
  const docPathFromState =
    typeof location.state?.docPath === "string" ? location.state.docPath : null;
  const stateSource =
    typeof location.state?.source === "string" ? location.state.source : null;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;

    let unsub = () => {};
    let cancelled = false;

    const resolve = async () => {
      setLoading(true);
      setError(null);
      setProduct(null);

      const attempted = new Set();
      const candidates = [];

      if (docPathFromState) {
        const segments = docPathFromState.split("/").filter(Boolean);
        if (segments.length >= 2 && segments.length % 2 === 0) {
          candidates.push({
            ref: doc(db, ...segments),
            scope:
              stateSource ||
              (segments.length === 2 ? "root" : "vendor"),
          });
        }
      }

      candidates.push({
        ref: doc(db, "vendor_products", productId),
        scope: "root",
      });

      if (vendorId && vendorId !== "_" && vendorId !== "root") {
        candidates.push({
          ref: doc(db, "vendor_products", vendorId, "products", productId),
          scope: "vendor",
        });
      }

      for (const candidate of candidates) {
        const path = candidate.ref.path;
        if (attempted.has(path)) continue;
        attempted.add(path);

        try {
          const snap = await getDoc(candidate.ref);
          if (cancelled) return;
          if (snap.exists()) {
            unsub = onSnapshot(
              candidate.ref,
              (liveSnap) => {
                if (!liveSnap.exists()) {
                  setProduct(null);
                  setError("Produit introuvable.");
                } else {
                  setProduct({
                    id: liveSnap.id,
                    __docPath: liveSnap.ref.path,
                    __scope: candidate.scope,
                    ...liveSnap.data(),
                  });
                  setError(null);
                }
                setLoading(false);
              },
              (err) => {
                console.error("Failed to load vendor product:", err);
                setError("Impossible de charger ce produit.");
                setProduct(null);
                setLoading(false);
              }
            );
            return;
          }
        } catch (err) {
          console.error("Vendor product fetch failed:", err);
        }
      }

      if (!cancelled) {
        setProduct(null);
        setError("Produit introuvable.");
        setLoading(false);
      }
    };

    resolve();

    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [vendorId, productId, docPathFromState, stateSource]);

  const coverImage = useMemo(() => {
    if (!product) return "/default-image.png";
    return (
      product.img ||
      product.image ||
      (Array.isArray(product.images) ? product.images[0] : null) ||
      product.media?.cover ||
      product.core?.media?.cover ||
      product.draft?.core?.media?.cover ||
      "/default-image.png"
    );
  }, [product]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return (
      product.images ||
      product.media?.gallery ||
      product.core?.media?.gallery ||
      product.draft?.core?.media?.gallery ||
      []
    );
  }, [product]);

  const title = useMemo(() => {
    if (!product) return "Produit vendeur";
    return (
      product.title ||
      product.name ||
      product.product ||
      product.core?.title ||
      product.draft?.core?.title ||
      `Produit ${productId}`
    );
  }, [product, productId]);

  const productStatus = useMemo(() => {
    if (!product) return "-";
    const status =
      product.status ??
      product.core?.status ??
      product.draft?.core?.status ??
      "-";
    const activeCandidates = [
      product.active,
      product.isActive,
      product.core?.active,
      product.core?.isActive,
      product.draft?.core?.active,
      product.draft?.core?.isActive,
    ];
    let active;
    for (const value of activeCandidates) {
      if (typeof value === "boolean") {
        active = value;
        break;
      }
    }
    if (active === undefined) {
      const blocked =
        product.blocked ??
        product.core?.blocked ??
        product.draft?.core?.blocked;
      if (typeof blocked === "boolean") {
        active = !blocked;
      }
    }
    if (active === false || status === "archived") return "Bloqué";
    if (status === "draft") return "Brouillon";
    if (status === "active") return "Actif";
    return status;
  }, [product]);

  const priceInfo = useMemo(() => {
    if (!product) return "-";
    const price =
      product.price ??
      product.pricing?.basePrice ??
      product.core?.pricing?.basePrice ??
      product.draft?.core?.pricing?.basePrice;
    if (price === undefined || price === null) return "-";
    const currency =
      product.pricing?.currency ??
      product.core?.pricing?.currency ??
      product.draft?.core?.pricing?.currency ??
      "";
    return currency ? `${price} ${currency}` : `${price}`;
  }, [product]);

  const stockInfo = useMemo(() => {
    if (!product) return "-";
    const stock =
      product.stock ??
      product.inventory?.stock ??
      product.core?.inventory?.stock ??
      product.draft?.core?.inventory?.stock;
    return stock === undefined || stock === null ? "-" : stock;
  }, [product]);

  const attributes = useMemo(() => {
    if (!product) return [];
    const base =
      product.attributes ??
      product.core?.attributes ??
      product.draft?.core?.attributes ??
      {};
    return Object.entries(base);
  }, [product]);

  const vendorDisplayId = useMemo(
    () =>
      firstValue(
        product?.vendorId,
        product?.core?.vendorId,
        product?.draft?.core?.vendorId,
        vendorId === "_" ? null : vendorId
      ) ?? "-",
    [product, vendorId]
  );

  if (loading) {
    return (
      <div className="vendorProductDetails vendorProductDetails--loading">
        <Sidebar />
        <div className="vendorProductDetails__container">
          <Navbar />
          <div className="vendorProductDetails__content">
            <p>Chargement du produit vendeur...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="vendorProductDetails vendorProductDetails--error">
        <Sidebar />
        <div className="vendorProductDetails__container">
          <Navbar />
          <div className="vendorProductDetails__content vendorProductDetails__content--center">
            <p>{error || "Produit introuvable."}</p>
            <button type="button" onClick={() => navigate(-1)}>
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vendorProductDetails">
      <Sidebar />
      <div className="vendorProductDetails__container">
        <Navbar />
        <div className="vendorProductDetails__content">
          <div className="vendorProductDetails__header">
            <div className="vendorProductDetails__headerLeft">
              <button
                type="button"
                className="vendorProductDetails__back"
                onClick={() => navigate(-1)}
              >
                ← Retour
              </button>
              <h1>{title}</h1>
              <p>
                Produit #{productId} — Vendeur :{" "}
                {vendorId === "_" ? "N/A" : vendorId}
              </p>
            </div>
            <div className="vendorProductDetails__headerRight">
              <span className="vendorProductDetails__status">{productStatus}</span>
            </div>
          </div>

          <section>
            <div className="vendorProductDetails__main">
              <div className="vendorProductDetails__cover">
                <img src={coverImage} alt={title} />
              </div>
              <div className="vendorProductDetails__summary">
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">Prix</span>
                  <span className="vendorProductDetails__statValue">
                    {priceInfo}
                  </span>
                </div>
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">Stock</span>
                  <span className="vendorProductDetails__statValue">
                    {stockInfo}
                  </span>
                </div>
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">
                    Dernière mise à jour
                  </span>
                  <span className="vendorProductDetails__statValue">
                    {formatDateTime(
                      product.updatedAt ??
                        product.core?.updatedAt ??
                        product.draft?.core?.updatedAt
                    )}
                  </span>
                </div>
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">
                    Motif blocage
                  </span>
                  <span className="vendorProductDetails__statValue">
                    {firstValue(
                      product.blockedReason,
                      product.core?.blockedReason,
                      product.draft?.core?.blockedReason,
                      "-"
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {galleryImages.length > 1 && (
            <section>
              <h2>Galerie</h2>
              <div className="vendorProductDetails__gallery">
                {galleryImages.slice(1).map((url, index) => (
                  <img src={url} alt={`Aperçu ${index}`} key={url || index} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2>Informations générales</h2>
            <div className="vendorProductDetails__card">
              <ul>
                <li>
                  <strong>Vendor ID :</strong>{" "}
                  {vendorDisplayId}
                </li>
                <li>
                  <strong>Product ID :</strong> {productId}
                </li>
                <li>
                  <strong>Catégorie :</strong>{" "}
                  {firstValue(
                    product.categoryId,
                    product.category,
                    product.core?.categoryId,
                    product.draft?.core?.categoryId,
                    "-"
                  )}
                </li>
                <li>
                  <strong>Top catégorie :</strong>{" "}
                  {firstValue(
                    product.topCategory,
                    product.core?.topCategory,
                    product.draft?.core?.topCategory,
                    "-"
                  )}
                </li>
                <li>
                  <strong>Marque :</strong>{" "}
                  {firstValue(
                    product.brand,
                    product.core?.brand,
                    product.draft?.core?.brand,
                    "-"
                  )}
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2>Description</h2>
            <div className="vendorProductDetails__card">
              <p>
                {firstValue(
                  product.description,
                  product.core?.description,
                  product.draft?.core?.description,
                  "Aucune description fournie."
                )}
              </p>
            </div>
          </section>

          {attributes.length > 0 && (
            <section>
              <h2>Attributs</h2>
              <div className="vendorProductDetails__card">
                <ul>
                  {attributes.map(([key, value]) => (
                    <li key={key}>
                      <strong>{key} :</strong>{" "}
                      <span>
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section>
            <h2>Liens rapides</h2>
            <div className="vendorProductDetails__card vendorProductDetails__links">
              <Link to="/vendor-products" className="vendorProductDetails__link">
                Retour à la liste des produits vendeurs
              </Link>
              {vendorDisplayId && vendorDisplayId !== "-" && vendorDisplayId !== "_" && (
                <Link
                  to={`/vendors/${encodeURIComponent(vendorDisplayId)}`}
                  className="vendorProductDetails__link"
                >
                  Consulter le vendeur
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default VendorProductDetails;
