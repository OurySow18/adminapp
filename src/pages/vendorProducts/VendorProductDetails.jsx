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
  category: "Categorie",
  categoryId: "Categorie",
  topCategory: "Top categorie",
  media: "Medias",
  "media.cover": "Medias > couverture",
  "media.gallery": "Medias > galerie",
  "media.byOption": "Medias > par option",
  "media.byOption.color": "Medias > par option > couleur",
};

const SEGMENT_LABEL_OVERRIDES = {
  media: "Medias",
  cover: "Couverture",
  gallery: "Galerie",
  byoption: "Par option",
  color: "Couleur",
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
  const normalized = segment.toLowerCase();
  if (SEGMENT_LABEL_OVERRIDES[normalized]) {
    return SEGMENT_LABEL_OVERRIDES[normalized];
  }
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

const isLikelyImageUrl = (value = "", path = "") => {
  if (typeof value !== "string") return false;
  const candidate = value.trim().toLowerCase();
  if (!candidate.startsWith("http")) return false;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(candidate)) return true;
  if (candidate.includes("firebasestorage")) return true;
  if (!path) return false;
  const normalizedPath = path.toLowerCase();
  return (
    normalizedPath.includes("image") ||
    normalizedPath.includes("media") ||
    normalizedPath.includes("cover") ||
    normalizedPath.includes("gallery")
  );
};

const DiffImagePreview = ({ src, label }) => {
  const [dimensions, setDimensions] = useState(null);
  const [error, setError] = useState(false);

  const handleLoad = (event) => {
    setDimensions({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  };

  const handleError = () => {
    setError(true);
  };

  return (
    <figure className="vendorProductDetails__diffImage">
      <img
        src={src}
        alt={label || "Apercu du media"}
        onLoad={handleLoad}
        onError={handleError}
      />
      <figcaption>
        {label && <strong>{label}</strong>}
        <span>
          {error
            ? "Impossible de charger l'image"
            : dimensions
            ? `${dimensions.width}  ${dimensions.height} px`
            : "Taille en cours de chargement"}
        </span>
      </figcaption>
    </figure>
  );
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
        message: "Ce Produit n´est pas encore affiché dans Monmarché",
      };
    }
    const statusFlag = toBoolean(
      firstValue(
        publicProduct.vm_status,
        publicProduct.active,
        publicProduct.isActive
      )
    );
    const mmStatusFlag = toBoolean(publicProduct.mm_status);
    if (statusFlag && mmStatusFlag) {
      return {
        isPublished: true,
        message: "Le produit est affiche sur Monmarche",
      };
    }
    if (!mmStatusFlag) {
      return {
        isPublished: false,
        message: "Masque cote Monmarche",
      };
    }
    return {
      isPublished: false,
      message: "Statut public inactif",
    };
  }, [publicProduct]);

  const visibilityStatus = useMemo(() => {
    if (mmStatus && vmStatus) {
      return { tone: "positive", message: "Produit actif cote Monmarche" };
    }
    if (!mmStatus && !vmStatus) {
      return {
        tone: "negative",
        message: "Masque par l'admin et le vendeur",
      };
    }
    if (!mmStatus) {
      return { tone: "negative", message: "Masque par l'admin" };
    }
    if (!vmStatus) {
      return { tone: "warning", message: "Desactive par le vendeur" };
    }
    return { tone: "neutral", message: "Visibilite inconnue" };
  }, [mmStatus, vmStatus]);

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

  const lastUpdated = useMemo(() => {
    if (!product) return "-";
    const source = firstValue(
      product.updatedAt,
      product.core?.updatedAt,
      product.draft?.core?.updatedAt
    );
    return formatDateTime(source);
  }, [product]);

  const blockedReason = useMemo(
    () =>
      firstValue(
        product?.blockedReason,
        product?.core?.blockedReason,
        product?.draft?.core?.blockedReason,
        "-"
      ),
    [product]
  );

  const categoryValue = useMemo(
    () =>
      firstValue(
        product?.categoryId,
        product?.category,
        product?.core?.categoryId,
        product?.draft?.core?.categoryId,
        "-"
      ),
    [product]
  );

  const topCategoryValue = useMemo(
    () =>
      firstValue(
        product?.topCategory,
        product?.core?.topCategory,
        product?.draft?.core?.topCategory,
        "-"
      ),
    [product]
  );

  const brandValue = useMemo(
    () =>
      firstValue(
        product?.brand,
        product?.core?.brand,
        product?.draft?.core?.brand,
        "-"
      ),
    [product]
  );



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

  const renderChangeValue = useCallback(
    (value, path = "") => {
      const renderEmpty = () => (
        <span className="vendorProductDetails__draftValue vendorProductDetails__draftValue--empty">
          -
        </span>
      );

      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return renderEmpty();
      }

      if (typeof value === "boolean") {
        return (
          <span className="vendorProductDetails__draftValue">
            {value ? "Oui" : "Non"}
          </span>
        );
      }

      if (typeof value === "number") {
        return (
          <span className="vendorProductDetails__draftValue">
            {value}
          </span>
        );
      }

      if (typeof value === "string") {
        if (isLikelyImageUrl(value, path)) {
          return (
            <div className="vendorProductDetails__diffImages">
              <DiffImagePreview src={value} label="Image" />
            </div>
          );
        }
        if (/^https?:\/\//i.test(value.trim())) {
          return (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="vendorProductDetails__draftLink"
            >
              {value}
            </a>
          );
        }
        return (
          <span className="vendorProductDetails__draftValue">
            {value}
          </span>
        );
      }

      if (Array.isArray(value)) {
        const cleaned = value.filter(
          (entry) =>
            entry !== undefined &&
            entry !== null &&
            !(typeof entry === "string" && entry.trim() === "")
        );
        if (!cleaned.length) return renderEmpty();

        if (
          cleaned.every(
            (entry) =>
              typeof entry === "string" && isLikelyImageUrl(entry, path || "gallery")
          )
        ) {
          return (
            <div className="vendorProductDetails__diffImages">
              {cleaned.map((url, index) => (
                <DiffImagePreview
                  key={`${url}-${index}`}
                  src={url}
                  label={`Image ${index + 1}`}
                />
              ))}
            </div>
          );
        }

        return (
          <ul className="vendorProductDetails__diffList vendorProductDetails__diffList--bullets">
            {cleaned.map((entry, index) => (
              <li key={`${path}-${index}`}>
                {renderChangeValue(entry, `${path || ""}[${index}]`)}
              </li>
            ))}
          </ul>
        );
      }

      if (typeof value === "object") {
        const entries = Object.entries(value);
        if (!entries.length) return renderEmpty();
        return (
          <dl className="vendorProductDetails__diffDefinition">
            {entries.map(([key, val]) => {
              const childPath = path ? `${path}.${key}` : key;
              return (
                <div
                  key={childPath}
                  className="vendorProductDetails__diffDefinitionRow"
                >
                  <dt>{getFieldLabel(childPath)}</dt>
                  <dd>{renderChangeValue(val, childPath)}</dd>
                </div>
              );
            })}
          </dl>
        );
      }

      return renderEmpty();
    },
    []
  );

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

  const vendorName = useMemo(
    () =>
      firstValue(
        product?.vendorName,
        product?.vendor?.name,
        product?.vendor?.displayName,
        product?.core?.vendorName,
        product?.core?.vendor?.name,
        product?.core?.vendor?.displayName,
        product?.draft?.core?.vendorName,
        product?.draft?.core?.vendor?.name,
        product?.draft?.core?.vendor?.displayName
      ) ?? (vendorDisplayId !== "-" && vendorDisplayId !== "_" ? vendorDisplayId : "Vendeur non renseigne"),
    [product, vendorDisplayId]
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
          ? "Le produit est desormais visible pour l'admin."
          : "Le produit a ete masque sur Monmarche.",
      });
    } catch (err) {
      const message =
        err?.message || "Impossible de mettre a jour le statut admin.";
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
        success: "Modifications validees et appliquees au catalogue public.",
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
                &larr; Retour
              </button>
              <h1>{title}</h1>
              <p>
                Produit #{productId}  Vendeur :{" "}
                <span className="vendorProductDetails__metaHighlight">
                  {vendorName}
                </span>{" "}
                {" "}
                {lastUpdated === "-"
                  ? "Derniere actualisation indisponible"
                  : `Actualise le ${lastUpdated}`}
              </p>
            </div>
            <div className="vendorProductDetails__headerRight">
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
                  Afficher Monmarche
                </button>
                <button
                  type="button"
                  className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--block"
                  onClick={handleBlock}
                  disabled={statusUpdateState.loading || !mmStatus}
                >
                  Masquer Monmarche
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

          <section className="vendorProductDetails__spotlightSection">
            <div className="vendorProductDetails__sectionHeading">
              <h2>Vue d'ensemble</h2>
              <p>Resume des indicateurs cles et du media principal.</p>
            </div>
            <div className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__spotlightCard">
              <div className="vendorProductDetails__spotlightGrid">
                <div className="vendorProductDetails__cover">
                  {pendingDraftChanges && (
                    <span className="vendorProductDetails__coverBadge">
                      Brouillon vendeur en attente
                    </span>
                  )}
                  <img src={coverImage} alt={title} />
                </div>
                <div className="vendorProductDetails__summary">
                  <div className="vendorProductDetails__statGrid">
                    <div className="vendorProductDetails__stat">
                      <span className="vendorProductDetails__statLabel">
                        Prix
                      </span>
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
                      <span className="vendorProductDetails__statLabel">
                        Stock
                      </span>
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
                        Visibilite Monmarche
                      </span>
                      <span
                        className={`vendorProductDetails__statValue ${
                          visibilityStatus.tone === "positive"
                            ? "vendorProductDetails__statValue--positive"
                            : visibilityStatus.tone === "negative"
                            ? "vendorProductDetails__statValue--negative"
                            : visibilityStatus.tone === "warning"
                            ? "vendorProductDetails__statValue--warning"
                            : ""
                        }`}
                      >
                        {visibilityStatus.message}
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
                        {blockedReason}
                      </span>
                    </div>
                  </div>
                  <div className="vendorProductDetails__metaBar">
                    <div className="vendorProductDetails__metaDetails">
                      <span>Produit #{productId}</span>
                      <span>
                        Vendeur :{" "}
                        <span className="vendorProductDetails__metaHighlight">
                          {vendorName}
                        </span>
                      </span>
                      <span>Derniere mise a jour : {lastUpdated}</span>
                    </div>
                    <div className="vendorProductDetails__chips vendorProductDetails__chips--inline">
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
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="vendorProductDetails__layout">
            <div className="vendorProductDetails__primaryColumn">
              {draftChangeDetails.length > 0 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Champs modifies</h2>
                    <p>
                      Ces champs ont ete modifies par le vendeur. Comparez la
                      proposition a la version publiee avant de valider.
                    </p>
                  </div>
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
                          {renderChangeValue(change.vendorValue, change.path)}
                        </div>
                        <div>
                          <span className="vendorProductDetails__draftValuesLabel">
                            Version publiee
                          </span>
                          {renderChangeValue(
                            change.publishedValue,
                            change.path
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                </section>
              )}

              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Description</h2>
                  <p>Resume fonctionnel partage par le vendeur.</p>
                </div>
                <p
                  className={`vendorProductDetails__description ${getFieldClass(
                    "description",
                    "core.description",
                    "draft.core.description"
                  )}`}
                >
                  {firstValue(
                    product.description,
                    product.core?.description,
                    product.draft?.core?.description,
                    "Aucune description fournie."
                  )}
                </p>
              </section>

              {attributes.length > 0 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Attributs</h2>
                    <p>Donnees declaratives fournies par le vendeur.</p>
                  </div>
                  <div className="vendorProductDetails__attributes">
                    {attributes.map(([key, value]) => (
                      <div className="vendorProductDetails__attributeRow" key={key}>
                        <span className="vendorProductDetails__attributeKey">{key}</span>
                        <span
                          className={`vendorProductDetails__attributeValue ${getFieldClass(
                            `attributes.${key}`,
                            `core.attributes.${key}`,
                            `draft.core.attributes.${key}`
                          )}`}
                        >
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {galleryImages.length > 1 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Galerie</h2>
                    <p>Visuels complementaires soumis par le vendeur.</p>
                  </div>
                  <div className="vendorProductDetails__gallery">
                    {galleryImages.slice(1).map((url, index) => (
                      <div
                        className="vendorProductDetails__galleryItem"
                        key={url || index}
                      >
                        <img src={url} alt={`Apercu ${index}`} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="vendorProductDetails__sideColumn">
              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Informations essentielles</h2>
                  <p>Identification et classification du produit.</p>
                </div>
                <div className="vendorProductDetails__infoGrid">
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Vendeur</span>
                    <span className="vendorProductDetails__infoValue vendorProductDetails__infoValue--accent">
                      {vendorName}
                    </span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Product ID</span>
                    <span className="vendorProductDetails__infoValue">{productId}</span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Categorie</span>
                    <span
                      className={`vendorProductDetails__infoValue ${getFieldClass(
                        "categoryId",
                        "category",
                        "core.categoryId",
                        "draft.core.categoryId"
                      )}`}
                    >
                      {categoryValue}
                    </span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Top categorie</span>
                    <span
                      className={`vendorProductDetails__infoValue ${getFieldClass(
                        "topCategory",
                        "core.topCategory",
                        "draft.core.topCategory"
                      )}`}
                    >
                      {topCategoryValue}
                    </span>
                  </div>
                  <div className="vendorProductDetails__infoItem">
                    <span className="vendorProductDetails__infoLabel">Marque</span>
                    <span
                      className={`vendorProductDetails__infoValue ${getFieldClass(
                        "brand",
                        "core.brand",
                        "draft.core.brand"
                      )}`}
                    >
                      {brandValue}
                    </span>
                  </div>
                </div>
              </section>

              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Publication & conformite</h2>
                  <p>Suivi des statuts visibles sur Monmarche.</p>
                </div>
                <div className="vendorProductDetails__publication">
                  <div
                    className={`vendorProductDetails__badge ${
                      monmarchePublication.isPublished
                        ? "vendorProductDetails__badge--positive"
                        : "vendorProductDetails__badge--negative"
                    }`}
                  >
                    {monmarchePublication.message}
                  </div>
                  <ul className="vendorProductDetails__statusList">
                    <li>
                      <span>Statut admin</span>
                      <span
                        className={`vendorProductDetails__statusValue ${
                          mmStatus
                            ? "vendorProductDetails__statusValue--positive"
                            : "vendorProductDetails__statusValue--negative"
                        }`}
                      >
                        {mmStatus ? "Actif" : "Inactif"}
                      </span>
                    </li>
                    <li>
                      <span>Statut vendeur</span>
                      <span
                        className={`vendorProductDetails__statusValue ${
                          vmStatus
                            ? "vendorProductDetails__statusValue--positive"
                            : "vendorProductDetails__statusValue--negative"
                        }`}
                      >
                        {vmStatus ? "Actif" : "Inactif"}
                      </span>
                    </li>
                    <li>
                      <span>Propositions vendeur</span>
                      <span
                        className={`vendorProductDetails__statusValue ${
                          pendingDraftChanges
                            ? "vendorProductDetails__statusValue--warning"
                            : ""
                        }`}
                      >
                        {pendingDraftChanges
                          ? "En attente de validation"
                          : "Aucune modification"}
                      </span>
                    </li>
                    <li>
                      <span>Blocage</span>
                      <span
                        className={getStatClass(
                          "blockedReason",
                          "core.blockedReason",
                          "draft.core.blockedReason"
                        )}
                      >
                        {blockedReason}
                      </span>
                    </li>
                  </ul>
                </div>
                {publicProductError && (
                  <div className="vendorProductDetails__publicWarning vendorProductDetails__publicWarning--compact">
                    {publicProductError}
                  </div>
                )}
              </section>

              <section className="vendorProductDetails__card vendorProductDetails__card--section">
                <div className="vendorProductDetails__cardHeader">
                  <h2>Raccourcis</h2>
                  <p>Actions rapides autour de ce produit.</p>
                </div>
                <div className="vendorProductDetails__links">
                  <Link to="/vendor-products" className="vendorProductDetails__linkButton">
                    Retour a la liste des produits vendeurs
                  </Link>
                  {vendorDisplayId &&
                    vendorDisplayId !== "-" &&
                    vendorDisplayId !== "_" && (
                    <Link
                      to={`/vendors/${encodeURIComponent(vendorDisplayId)}`}
                      className="vendorProductDetails__linkButton"
                    >
                      Consulter le vendeur
                    </Link>
                  )}
                </div>
              </section>
            </aside>
          </div>

        </div>
      </div>
    </div>
  );
};

export default VendorProductDetails;

