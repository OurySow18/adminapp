import "./MarketingPage.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const CATEGORY_OPTIONS = [
  "grocery",
  "fashion",
  "electronics",
  "home",
  "beauty",
  "sports",
  "media",
  "auto",
  "diy",
  "pet",
  "services",
];

const SEGMENT_OPTIONS = ["all", "new_user", "returning", "high_value"];
const TARGET_TYPES = ["product", "vendor", "category", "search", "url"];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const IMAGE_PROFILES = [
  {
    id: "hero",
    label: "Bannière hero / slot principal",
    ideal: "1200×600",
    minWidth: 1000,
    minHeight: 500,
    maxBytes: 2 * 1024 * 1024,
  },
  {
    id: "carousel",
    label: "Carrousel horizontal produit/collection",
    ideal: "800×800",
    minWidth: 600,
    minHeight: 600,
    maxBytes: 2 * 1024 * 1024,
  },
  {
    id: "partner_logo",
    label: "Logo partenaire",
    ideal: "300×200",
    minWidth: 200,
    minHeight: 130,
    maxBytes: 1 * 1024 * 1024,
  },
  {
    id: "card",
    label: "Vignette rail recommandé / carte",
    ideal: "600×800",
    minWidth: 450,
    minHeight: 600,
    maxBytes: 1.5 * 1024 * 1024,
  },
];

const formatProductLabel = (data = {}, id) =>
  data.title ||
  data.name ||
  data.product ||
  data.core?.title ||
  data.draft?.core?.title ||
  id;

const formatVendorLabel = (data = {}, id) =>
  data.storeName ||
  data.profile?.storeName ||
  data.vendorName ||
  data.profile?.vendorName ||
  data.name ||
  data.profile?.name ||
  data.displayName ||
  data.profile?.displayName ||
  "Boutique sans nom";

const MarketingEditor = () => {
  const { bannerId } = useParams();
  const isEdit = Boolean(bannerId);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [segment, setSegment] = useState("all");
  const [order, setOrder] = useState(0);
  const [targetType, setTargetType] = useState("product");
  const [productId, setProductId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [categoryId, setCategoryId] = useState(CATEGORY_OPTIONS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [visible, setVisible] = useState(true);
  const [imageProfileId, setImageProfileId] = useState(IMAGE_PROFILES[0].id);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorsError, setVendorsError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [loadingBanner, setLoadingBanner] = useState(isEdit);

  const resetFeedback = () => {
    setFormError(null);
    setFormSuccess(null);
    setImageError(null);
  };

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFilePreviewUrl("");
    return undefined;
  }, [imageFile]);

  const selectedProfile = useMemo(
    () => IMAGE_PROFILES.find((profile) => profile.id === imageProfileId) || IMAGE_PROFILES[0],
    [imageProfileId]
  );

  const formatMaxMb = (bytes) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

  const readImageDimensions = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const q = query(
        collection(db, "products_public"),
        where("published", "==", true),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        items.push({ id: docSnap.id, label: formatProductLabel(data, docSnap.id) });
      });
      setProducts(items);
    } catch (err) {
      console.error("Failed to load public products:", err);
      setProducts([]);
      setProductsError("Impossible de charger les produits publics.");
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadVendors = useCallback(async () => {
    setVendorsLoading(true);
    setVendorsError(null);
    try {
      const q = query(
        collection(db, "vendors"),
        where("status", "==", "approved"),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        items.push({ id: docSnap.id, label: formatVendorLabel(data, docSnap.id) });
      });
      setVendors(items);
    } catch (err) {
      console.error("Failed to load vendors:", err);
      setVendors([]);
      setVendorsError("Impossible de charger les vendeurs.");
    } finally {
      setVendorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadVendors();
  }, [loadProducts, loadVendors]);

  useEffect(() => {
    const loadBanner = async () => {
      if (!isEdit) return;
      setLoadingBanner(true);
      try {
        const snap = await getDoc(doc(db, "banners", bannerId));
        if (snap.exists()) {
          const banner = { id: snap.id, ...snap.data() };
          setTitle(banner.title || "");
          setSegment(banner.segment || "all");
          setOrder(banner.order ?? 0);
          setTargetType(banner.targetType || "product");
          setProductId(banner.targetType === "product" ? banner.targetId || "" : "");
          setVendorId(banner.targetType === "vendor" ? banner.targetId || "" : "");
          setCategoryId(
            banner.targetType === "category" ? banner.targetId || CATEGORY_OPTIONS[0] : CATEGORY_OPTIONS[0]
          );
          setSearchQuery(banner.targetType === "search" ? banner.query || "" : "");
          setTargetUrl(banner.targetType === "url" ? banner.url || "" : "");
          setExistingImageUrl(banner.imageUrl || "");
          setVisible(banner.visible ?? true);
          if (banner.imageProfile) {
            setImageProfileId(banner.imageProfile);
          }
        } else {
          setFormError("Visuel introuvable.");
        }
      } catch (err) {
        console.error("Failed to load banner:", err);
        setFormError("Impossible de charger ce visuel.");
      } finally {
        setLoadingBanner(false);
      }
    };
    loadBanner();
  }, [bannerId, isEdit]);

  const handleFileChange = async (event) => {
    resetFeedback();
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Format invalide (png, jpg ou webp uniquement).");
      setImageFile(null);
      return;
    }
    const maxBytes = selectedProfile.maxBytes;
    if (file.size > maxBytes) {
      setImageError(
        `Image trop lourde (max ${formatMaxMb(maxBytes)} Mo pour ce format).`
      );
      setImageFile(null);
      return;
    }

    try {
      const { width, height } = await readImageDimensions(file);
      if (width < selectedProfile.minWidth || height < selectedProfile.minHeight) {
        setImageError(
          `Dimensions insuffisantes (${width}×${height}). Minimum requis : ${selectedProfile.minWidth}×${selectedProfile.minHeight}px.`
        );
        setImageFile(null);
        return;
      }
      setImageFile(file);
    } catch (err) {
      console.error("Failed to read image dimensions:", err);
      setImageError("Impossible de lire l'image. Réessayez avec un autre fichier.");
      setImageFile(null);
    }
  };

  const targetListEmpty = useMemo(() => {
    if (targetType === "product") return !productsLoading && products.length === 0;
    if (targetType === "vendor") return !vendorsLoading && vendors.length === 0;
    return false;
  }, [products.length, productsLoading, targetType, vendors.length, vendorsLoading]);

  const isSubmitDisabled = useMemo(() => {
    if (submitting || loadingBanner) return true;
    if (!title.trim()) return true;
    if (!imageFile && !existingImageUrl) return true;
    if (targetType === "product" && (!productId || targetListEmpty)) return true;
    if (targetType === "vendor" && (!vendorId || targetListEmpty)) return true;
    if (targetType === "search" && !searchQuery.trim()) return true;
    if (targetType === "url" && !targetUrl.trim()) return true;
    return false;
  }, [
    bannerId,
    existingImageUrl,
    imageFile,
    loadingBanner,
    productId,
    searchQuery,
    submitting,
    targetListEmpty,
    targetType,
    targetUrl,
    title,
    vendorId,
  ]);

  const buildPayloadTarget = () => {
    const base = { targetId: null, query: null, url: null };
    if (targetType === "product") return { ...base, targetId: productId };
    if (targetType === "vendor") return { ...base, targetId: vendorId };
    if (targetType === "category") return { ...base, targetId: categoryId };
    if (targetType === "search") return { ...base, query: searchQuery.trim() };
    if (targetType === "url") return { ...base, url: targetUrl.trim() };
    return base;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetFeedback();
    if (!imageFile && !existingImageUrl) {
      setFormError("Ajoutez une image (max 2 Mo, png/jpg/webp).");
      return;
    }
    try {
      setSubmitting(true);
      let downloadURL = existingImageUrl;
      if (imageFile) {
        const storageRef = ref(
          storage,
          `banners/${Date.now()}-${imageFile.name.replace(/\s+/g, "_")}`
        );
        await uploadBytes(storageRef, imageFile);
        downloadURL = await getDownloadURL(storageRef);
      }
      const targetPayload = buildPayloadTarget();
      const vendorLabel =
        targetType === "vendor"
          ? vendors.find((v) => v.id === vendorId)?.label ||
            targetPayload.targetLabel ||
            ""
          : "";
      const productLabel =
        targetType === "product"
          ? products.find((p) => p.id === productId)?.label ||
            targetPayload.targetLabel ||
            ""
          : "";
      const targetLabel = vendorLabel || productLabel || targetPayload.targetLabel || null;

      const payload = {
        title: title.trim(),
        segment,
        order: Number(order) || 0,
        targetType,
        imageUrl: downloadURL,
        visible,
        ...targetPayload,
        imageProfile: imageProfileId,
        ...(targetLabel ? { targetLabel } : {}),
      };
      if (isEdit) {
        await updateDoc(doc(db, "banners", bannerId), payload);
        setFormSuccess("Visuel mis à jour.");
      } else {
        await addDoc(collection(db, "banners"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setFormSuccess("Visuel enregistré avec succès.");
        navigate("/admin/marketing");
        return;
      }
    } catch (err) {
      console.error("Failed to save banner:", err);
      setFormError("Erreur lors de l'enregistrement du visuel.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTargetField = () => {
    switch (targetType) {
      case "product":
        return (
          <div className="formRow">
            <label>Produit cible</label>
            {productsLoading ? (
              <p className="helper">Chargement des produits...</p>
            ) : productsError ? (
              <p className="error">{productsError}</p>
            ) : products.length === 0 ? (
              <p className="helper">Aucun résultat</p>
            ) : (
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Sélectionner un produit</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      case "vendor":
        return (
          <div className="formRow">
            <label>Vendeur cible</label>
            {vendorsLoading ? (
              <p className="helper">Chargement des vendeurs...</p>
            ) : vendorsError ? (
              <p className="error">{vendorsError}</p>
            ) : vendors.length === 0 ? (
              <p className="helper">Aucun résultat</p>
            ) : (
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Sélectionner un vendeur</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      case "category":
        return (
          <div className="formRow">
            <label>Catégorie</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        );
      case "search":
        return (
          <div className="formRow">
            <label>Requête de recherche</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ex: riz bio"
            />
          </div>
        );
      case "url":
        return (
          <div className="formRow">
            <label>URL cible</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://exemple.com"
            />
          </div>
        );
      default:
        return null;
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
              <p className="eyebrow">Contenus marketing</p>
              <h1>{isEdit ? "Modifier le visuel" : "Créer une bannière"}</h1>
              <p className="subtitle">Configurez un visuel ciblé par segment et destination.</p>
            </div>
            <Link to="/admin/marketing" className="ghost">
              Retour à la liste
            </Link>
          </div>

          <form className="marketingPage__form" onSubmit={handleSubmit}>
            {loadingBanner && <p className="helper">Chargement du visuel...</p>}

            <div className="formRow">
              <label>Titre</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre interne du visuel"
                required
              />
            </div>

            <div className="formGrid">
              <div className="formRow">
                <label>Segment</label>
                <select value={segment} onChange={(e) => setSegment(e.target.value)}>
                  {SEGMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="formRow">
                <label>Ordre d'affichage</label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  min="0"
                />
              </div>
              {isEdit && (
                <div className="formRow">
                  <label>Visibilité</label>
                  <select value={visible ? "true" : "false"} onChange={(e) => setVisible(e.target.value === "true")}>
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                </div>
              )}
            </div>

            <div className="formGrid">
              <div className="formRow">
                <label>Format visuel</label>
                <select
                  value={imageProfileId}
                  onChange={(e) => setImageProfileId(e.target.value)}
                >
                  {IMAGE_PROFILES.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label} (ideal {profile.ideal})
                    </option>
                  ))}
                </select>
              </div>
              <div className="formRow">
                <label>Type de cible</label>
                <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                  {TARGET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {renderTargetField()}

            <div className="formRow">
              <label>Image (png, jpg, webp — max 2 Mo)</label>
              <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} />
              {imageError && <p className="error">{imageError}</p>}
              {imageFile && !imageError && (
                <p className="helper">
                  {imageFile.name} ({Math.round(imageFile.size / 1024)} Ko)
                </p>
              )}
              {!imageFile && existingImageUrl && <p className="helper">Image actuelle conservée.</p>}
              <p className="helper">
                Attendu : {selectedProfile.ideal} (min {selectedProfile.minWidth}×
                {selectedProfile.minHeight}px) · max {formatMaxMb(selectedProfile.maxBytes)} Mo.
              </p>
              {(filePreviewUrl || existingImageUrl) && (
                <div className="imagePreview">
                  <p className="helper">Aperçu :</p>
                  <img
                    src={filePreviewUrl || existingImageUrl}
                    alt="Aperçu du visuel"
                    className="imagePreview__img"
                  />
                </div>
              )}
            </div>

            <div className="formActions">
              <button type="submit" disabled={isSubmitDisabled}>
                {submitting ? "Enregistrement..." : isEdit ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>

            {formSuccess && <p className="feedback feedback--success">{formSuccess}</p>}
            {formError && <p className="feedback feedback--error">{formError}</p>}
            {targetListEmpty && (
              <p className="feedback feedback--warning">
                Aucun résultat pour cette cible. Ajoutez des données ou changez de type.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default MarketingEditor;
