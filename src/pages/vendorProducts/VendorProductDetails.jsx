import "./vendorProductDetails.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";
import {
  applyVendorProductDraftChanges,
  updateVendorProductAdminStatus,
} from "../../utils/vendorProductsRepository";

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

const toBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === 1 ||
  value === "1";

const FIELD_LABELS = {
  description: "Description",
  brandRelationship: "Relation marque",
  pricing: "Tarification",
  "pricing.basePrice": "Prix (HT)",
  "pricing.currency": "Devise",
  "pricing.taxes": "Taxes",
  stock: "Stock",
  "inventory.stock": "Stock",
  brand: "Marque",
  category: "Catégorie",
  categoryId: "Catégorie",
  topCategory: "Top catégorie",
};

const splitFieldPath = (path) =>
  typeof path === "string"
    ? path
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean)
    : [];

const humanizeSegment = (segment) => {
  if (!segment) return "";
  return segment
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^\w/, (char) => char.toUpperCase());
};

const getFieldLabel = (path) => {
  if (!path) return "-";
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  return splitFieldPath(path).map(humanizeSegment).join(" > ");
};

const getNestedValue = (source, path) => {
  if (!source || typeof source !== "object") return undefined;
  const segments = splitFieldPath(path);
  if (!segments.length) return undefined;
  return segments.reduce((cursor, segment) => {
    if (cursor === undefined || cursor === null) return undefined;
    if (typeof cursor !== "object") return undefined;
    return cursor[segment];
  }, source);
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
  const [statusUpdateState, setStatusUpdateState] = useState({
    loading: false,
    error: null,
    success: null,
  });
  const [publicProduct, setPublicProduct] = useState(null);
  const [publicProductError, setPublicProductError] = useState(null);

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

      candidates.push({
        ref: doc(db, "products_public", productId),
        scope: "public",
      });

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

  useEffect(() => {
    setStatusUpdateState({ loading: false, error: null, success: null });
  }, [product?.id]);

  useEffect(() => {
    setPublicProduct(null);
    setPublicProductError(null);
    if (!productId) return undefined;

    const publicRef = doc(db, "products_public", productId);
    const unsubscribe = onSnapshot(
      publicRef,
      (snap) => {
        if (snap.exists()) {
          setPublicProduct({ id: snap.id, ...snap.data() });
        } else {
          setPublicProduct(null);
        }
        setPublicProductError(null);
      },
      (err) => {
        console.error("Erreur verification produit public:", err);
        setPublicProduct(null);
        setPublicProductError(
          "Impossible de verifier la publication Monmarche."
        );
      }
    );

    return () => unsubscribe();
  }, [productId]);

  useEffect(() => {
    if (!statusUpdateState.success) return undefined;
    const timer = setTimeout(() => {
      setStatusUpdateState((prev) =>
        prev.success ? { ...prev, success: null } : prev
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, [statusUpdateState.success]);

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

  const mmStatus = useMemo(() => {
    if (!product) return false;
    return toBoolean(
      firstValue(
        product.mm_status,
        product.mmStatus,
        product.core?.mm_status,
        product.draft?.core?.mm_status
      )
    );
  }, [product]);

  const vmStatus = useMemo(() => {
    if (!product) return false;
    return toBoolean(
      firstValue(
        product.vm_status,
        product.vmStatus,
        product.core?.vm_status,
        product.draft?.core?.vm_status
      )
    );
  }, [product]);

  const draftStatus = useMemo(() => {
    if (!product) return false;
    return toBoolean(
      firstValue(
        product.draft_status,
        product.draftStatus,
        product.core?.draft_status,
        product.draft?.core?.draft_status
      )
    );
  }, [product]);

  const draftChanges = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.draftChanges)) return product.draftChanges;
    if (Array.isArray(product.core?.draftChanges)) return product.core.draftChanges;
    if (Array.isArray(product.draft?.core?.draftChanges))
      return product.draft.core.draftChanges;
    return [];
  }, [product]);

  const pendingDraftChanges = draftStatus && draftChanges.length > 0;

  const hasDraftChange = useCallback(
    (...paths) => {
      if (!pendingDraftChanges) return false;
      const normalizedChanges = draftChanges
        .map((value) =>
          typeof value === "string" ? value.trim().toLowerCase() : ""
        )
        .filter(Boolean);
      if (!normalizedChanges.length) return false;
      return paths
        .map((path) =>
          typeof path === "string" ? path.trim().toLowerCase() : ""
        )
        .filter(Boolean)
        .some((candidate) => normalizedChanges.includes(candidate));
    },
    [draftChanges, pendingDraftChanges]
  );

  const monmarchePublication = useMemo(() => {
    if (!publicProduct) {
      return {
        isPublished: false,
        message: "Aucune entrée dans products_public",
      };
    }
    const statusFlag = toBoolean(
      firstValue(
        publicProduct.status,
        publicProduct.active,
        publicProduct.isActive
      )
    );
    const mmStatusFlag = toBoolean(publicProduct.mm_status);
    if (statusFlag && mmStatusFlag) {
      return {
        isPublished: true,
        message: "Le produit est affiché sur Monmarché",
      };
    }
    if (!mmStatusFlag) {
      return {
        isPublished: false,
        message: "Masqué côté Monmarché (mm_status=false)",
      };
    }
    return {
      isPublished: false,
      message: "Statut public inactif dans products_public",
    };
  }, [publicProduct]);

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
    const displayCurrency =
      typeof currency === "string" && currency.trim() && currency !== "-"
        ? currency
        : "GNF";
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice)) {
      return `${price} ${displayCurrency}`;
    }
    const formatter = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: displayCurrency,
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return formatter.format(numericPrice);
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

  const getFieldClass = useCallback(
    (...paths) =>
      hasDraftChange(...paths)
        ? "vendorProductDetails__value vendorProductDetails__value--changed"
        : "vendorProductDetails__value",
    [hasDraftChange]
  );

  const getStatClass = useCallback(
    (...paths) =>
      hasDraftChange(...paths)
        ? "vendorProductDetails__statValue vendorProductDetails__statValue--changed"
        : "vendorProductDetails__statValue",
    [hasDraftChange]
  );

  const resolveDraftValue = useCallback(
    (path) =>
      getNestedValue(product?.draft?.core, path) ??
      getNestedValue(product?.draft, path) ??
      getNestedValue(product, path),
    [product]
  );

  const resolveCurrentValue = useCallback(
    (path) =>
      getNestedValue(publicProduct, path) ??
      getNestedValue(product?.core, path) ??
      getNestedValue(product, path),
    [publicProduct, product]
  );

  const draftChangeDetails = useMemo(() => {
    if (!pendingDraftChanges) return [];
    return draftChanges
      .map((rawPath) => {
        const path =
          typeof rawPath === "string" ? rawPath.trim() : "";
        if (!path) return null;
        return {
          path,
          label: getFieldLabel(path),
          vendorValue: resolveDraftValue(path),
          publishedValue: resolveCurrentValue(path),
        };
      })
      .filter(Boolean);
  }, [
    draftChanges,
    pendingDraftChanges,
    resolveCurrentValue,
    resolveDraftValue,
  ]);

  const renderChangeValue = useCallback((value) => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return (
        <span className="vendorProductDetails__draftValue vendorProductDetails__draftValue--empty">
          -
        </span>
      );
    }
    if (typeof value === "object") {
      let serialized = "";
      try {
        serialized = JSON.stringify(value, null, 2);
      } catch (err) {
        serialized = String(value);
      }
      return (
        <pre className="vendorProductDetails__draftValue vendorProductDetails__draftValue--code">
          {serialized}
        </pre>
      );
    }
    return (
      <span className="vendorProductDetails__draftValue">
        {String(value)}
      </span>
    );
  }, []);

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

  const resolvedVendorId = useMemo(() => {
    if (vendorDisplayId && vendorDisplayId !== "-" && vendorDisplayId !== "_") {
      return vendorDisplayId;
    }
    if (vendorId && vendorId !== "_" && vendorId !== "root") {
      return vendorId;
    }
    return null;
  }, [vendorDisplayId, vendorId]);

  const handleAdminToggle = async (enabled) => {
    if (!product) return;
    setStatusUpdateState({ loading: true, error: null, success: null });
    try {
      await updateVendorProductAdminStatus({
        productId,
        vendorId: resolvedVendorId,
        enabled,
        primaryDocPath: product.__docPath || docPathFromState,
        productData: product,
      });
      setStatusUpdateState({
        loading: false,
        error: null,
        success: enabled
          ? "Le produit est désormais visible pour l'admin."
          : "Le produit a été masqué sur Monmarché.",
      });
    } catch (err) {
      const message =
        err?.message || "Impossible de mettre à jour le statut admin.";
      setStatusUpdateState({ loading: false, error: message, success: null });
    }
  };

  const handleValidateChanges = async () => {
    if (!product || !pendingDraftChanges) return;
    setStatusUpdateState({ loading: true, error: null, success: null });
    try {
      await applyVendorProductDraftChanges({
        productId,
        vendorId: resolvedVendorId,
        primaryDocPath: product.__docPath || docPathFromState,
        productData: product,
      });
      setStatusUpdateState({
        loading: false,
        error: null,
        success: "Modifications validées et appliquées au catalogue public.",
      });
    } catch (err) {
      const message =
        err?.message || "Impossible de valider les modifications.";
      setStatusUpdateState({ loading: false, error: message, success: null });
    }
  };

  const handleActivate = () => handleAdminToggle(true);

  const handleBlock = () => handleAdminToggle(false);

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
              <div className="vendorProductDetails__chips">
                <span
                  className={`vendorProductDetails__chip ${
                    mmStatus
                      ? "vendorProductDetails__chip--positive"
                      : "vendorProductDetails__chip--negative"
                  }`}
                >
                  Admin : {mmStatus ? "Actif" : "Inactif"}
                </span>
                <span
                  className={`vendorProductDetails__chip ${
                    vmStatus
                      ? "vendorProductDetails__chip--positive"
                      : "vendorProductDetails__chip--negative"
                  }`}
                >
                  Vendeur : {vmStatus ? "Actif" : "Inactif"}
                </span>
                {pendingDraftChanges && (
                  <span className="vendorProductDetails__chip vendorProductDetails__chip--warning">
                    Modifications en attente
                  </span>
                )}
              </div>
              <div className="vendorProductDetails__actions">
                {pendingDraftChanges && (
                  <button
                    type="button"
                    className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--pending"
                    onClick={handleValidateChanges}
                    disabled={statusUpdateState.loading}
                  >
                    Valider les modifications
                  </button>
                )}
                <button
                  type="button"
                  className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--activate"
                  onClick={handleActivate}
                  disabled={statusUpdateState.loading || mmStatus}
                >
                  Afficher Monmarché
                </button>
                <button
                  type="button"
                  className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--block"
                  onClick={handleBlock}
                  disabled={statusUpdateState.loading || !mmStatus}
                >
                  Masquer Monmarché
                </button>
              </div>
            </div>
          </div>

          {(statusUpdateState.error || statusUpdateState.success) && (
            <div
              className={`vendorProductDetails__actionFeedback ${
                statusUpdateState.error
                  ? "vendorProductDetails__actionFeedback--error"
                  : "vendorProductDetails__actionFeedback--success"
              }`}
            >
              {statusUpdateState.error || statusUpdateState.success}
            </div>
          )}

          <section>
            <div className="vendorProductDetails__main">
              <div className="vendorProductDetails__cover">
                <img src={coverImage} alt={title} />
              </div>
              <div className="vendorProductDetails__summary">
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">Prix</span>
                  <span
                    className={getStatClass(
                      "price",
                      "pricing.basePrice",
                      "core.pricing.basePrice",
                      "draft.core.pricing.basePrice"
                    )}
                  >
                    {priceInfo}
                  </span>
                </div>
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">Stock</span>
                  <span
                    className={getStatClass(
                      "stock",
                      "inventory.stock",
                      "core.inventory.stock",
                      "draft.core.inventory.stock"
                    )}
                  >
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
                  <span
                    className={getStatClass(
                      "blockedReason",
                      "core.blockedReason",
                      "draft.core.blockedReason"
                    )}
                  >
                    {firstValue(
                      product.blockedReason,
                      product.core?.blockedReason,
                      product.draft?.core?.blockedReason,
                      "-"
                    )}
                  </span>
                </div>
                <div className="vendorProductDetails__stat">
                  <span className="vendorProductDetails__statLabel">
                    Visibilite Monmarche
                  </span>
                  <span
                    className={`vendorProductDetails__statValue ${
                      monmarchePublication.isPublished
                        ? "vendorProductDetails__statValue--positive"
                        : "vendorProductDetails__statValue--negative"
                    }`}
                  >
                    {monmarchePublication.message}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {draftChangeDetails.length > 0 && (
            <section>
              <h2>Champs modifiés</h2>
              <div className="vendorProductDetails__card">
                <p>
                  Ces champs ont été modifiés par le vendeur. Comparez la
                  proposition à la version publiée avant de valider.
                </p>
                <ul className="vendorProductDetails__draftList vendorProductDetails__draftList--detailed">
                  {draftChangeDetails.map((change) => (
                    <li key={change.path}>
                      <div className="vendorProductDetails__draftField">
                        <strong>{change.label}</strong>
                        <span className="vendorProductDetails__draftPath">
                          {change.path}
                        </span>
                      </div>
                      <div className="vendorProductDetails__draftValues">
                        <div>
                          <span className="vendorProductDetails__draftValuesLabel">
                            Proposition vendeur
                          </span>
                          {renderChangeValue(change.vendorValue)}
                        </div>
                        <div>
                          <span className="vendorProductDetails__draftValuesLabel">
                            Version publiée
                          </span>
                          {renderChangeValue(change.publishedValue)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {publicProductError && (
            <div className="vendorProductDetails__publicWarning">
              {publicProductError}
            </div>
          )}

          {galleryImages.length > 1 && (
            <section>
              <h2>Galerie</h2>
              <div className="vendorProductDetails__gallery">
                {galleryImages.slice(1).map((url, index) => (
                  <div
                    className="vendorProductDetails__galleryItem"
                    key={url || index}
                  >
                    <img src={url} alt={`Aperçu ${index}`} />
                  </div>
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
                  <strong>Cat?gorie :</strong>{" "}
                  <span className={getFieldClass("categoryId", "category", "core.categoryId", "draft.core.categoryId")}>
                    {firstValue(
                      product.categoryId,
                      product.category,
                      product.core?.categoryId,
                      product.draft?.core?.categoryId,
                      "-"
                    )}
                  </span>
                </li>
                <li>
                  <strong>Top cat?gorie :</strong>{" "}
                  <span className={getFieldClass("topCategory", "core.topCategory", "draft.core.topCategory")}>
                    {firstValue(
                      product.topCategory,
                      product.core?.topCategory,
                      product.draft?.core?.topCategory,
                      "-"
                    )}
                  </span>
                </li>
                <li>
                  <strong>Marque :</strong>{" "}
                  <span className={getFieldClass("brand", "core.brand", "draft.core.brand")}>
                    {firstValue(
                      product.brand,
                      product.core?.brand,
                      product.draft?.core?.brand,
                      "-"
                    )}
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2>Description</h2>
            <div className="vendorProductDetails__card">
              <p
                className={getFieldClass(
                  "description",
                  "core.description",
                  "draft.core.description"
                )}
              >
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
                      <span
                        className={getFieldClass(
                          `attributes.${key}`,
                          `core.attributes.${key}`,
                          `draft.core.attributes.${key}`
                        )}
                      >
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


