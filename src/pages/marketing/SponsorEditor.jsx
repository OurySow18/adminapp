import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../../components/modal/ConfirmModal";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, storage, auth } from "../../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const BADGE_SUGGESTIONS = [
  "Offre Flash",
  "Nouveau",
  "Best Seller",
  "Edition Limitee",
  "Promo",
  "Top Vente",
  "Exclusif",
  "Coup de coeur",
  "Derniere chance",
  "Stock limite",
  "Sponsorise",
];

const SponsorEditor = () => {
  const { sponsorId } = useParams();
  const isEdit = Boolean(sponsorId);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [badge, setBadge] = useState("");
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [targetType, setTargetType] = useState("vendor");
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [discount, setDiscount] = useState("");
  const [status, setStatus] = useState("active");
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [imageError, setImageError] = useState(null);
  const [imageWarning, setImageWarning] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");

  const [loadingSponsor, setLoadingSponsor] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const maxMb = Math.round((MAX_IMAGE_BYTES / (1024 * 1024)) * 10) / 10;

  useEffect(() => {
    if (heroImageFile) {
      const url = URL.createObjectURL(heroImageFile);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFilePreviewUrl("");
    return undefined;
  }, [heroImageFile]);

  useEffect(() => {
    const loadSponsor = async () => {
      if (!isEdit) return;
      setLoadingSponsor(true);
      try {
        const snap = await getDoc(doc(db, "sponsors", sponsorId));
        if (snap.exists()) {
          const data = snap.data() || {};
          setTitle(data.title || "");
          setBadge(data.badge || "");
          // targetId/targetLabel are inferred from selected vendor/product
          setProductId(data.productId || "");
          setCategoryId(data.categoryId || "");
          setHeroImageUrl(data.heroImage || "");
          setStatus(data.status || "active");
          setDiscount(
            data.discount !== undefined && data.discount !== null
              ? String(data.discount)
              : ""
          );
          const inferredType = data.targetType
            ? data.targetType
            : data.productId
            ? "product"
            : "vendor";
          setTargetType(inferredType);
          if (data.vendorId || data.targetType === "vendor") {
            setVendorId(data.vendorId || data.targetId || "");
          }
          if (data.productId || data.targetType === "product") {
            setProductId(data.productId || data.targetId || "");
          }
        } else {
          setFormError("Sponsor introuvable.");
        }
      } catch (err) {
        console.error("Failed to load sponsor:", err);
        setFormError("Impossible de charger le sponsor.");
      } finally {
        setLoadingSponsor(false);
      }
    };
    loadSponsor();
  }, [isEdit, sponsorId]);

  const canSubmit = useMemo(() => {
    if (loadingSponsor || submitting) return false;
    if (!title.trim()) return false;
    if (!badge.trim()) return false;
    if (!heroImageFile && !heroImageUrl) return false;
    if (targetType === "vendor" && !vendorId) return false;
    if (targetType === "product" && (!vendorId || !productId)) return false;
    if (!discount.trim()) return false;
    return true;
  }, [
    heroImageFile,
    heroImageUrl,
    loadingSponsor,
    discount,
    productId,
    submitting,
    targetType,
    title,
    vendorId,
  ]);

  useEffect(() => {
    const loadVendors = async () => {
      setVendorsLoading(true);
      try {
        const q = query(
          collection(db, "vendors"),
          where("status", "==", "approved"),
          limit(100)
        );
        const snapshot = await getDocs(q);
        const items = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          items.push({
            id: docSnap.id,
            label:
              data.storeName ||
              data.profile?.storeName ||
              data.vendorName ||
              data.profile?.vendorName ||
              data.name ||
              data.profile?.name ||
              data.displayName ||
              data.profile?.displayName ||
              docSnap.id,
          });
        });
        setVendors(items);
      } catch (err) {
        console.error("Failed to load vendors:", err);
        setVendors([]);
      } finally {
        setVendorsLoading(false);
      }
    };
    loadVendors();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const q = query(collection(db, "products_public"), limit(200));
        const snapshot = await getDocs(q);
        const items = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          items.push({
            id: docSnap.id,
            label:
              data.title ||
              data.name ||
              data.product ||
              data.core?.title ||
              data.draft?.core?.title ||
              docSnap.id,
            vendorId:
              data.vendorId ||
              data.core?.vendorId ||
              data.vendor?.id ||
              data.vendor?.vendorId ||
              data.vendor?.uid ||
              null,
          });
        });
        setProducts(items);
      } catch (err) {
        console.error("Failed to load products:", err);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!vendorId) return [];
    const filtered = products.filter((product) => product.vendorId === vendorId);
    return filtered;
  }, [products, vendorId]);

  const sortedVendors = useMemo(() => {
    const list = [...vendors];
    list.sort((a, b) =>
      a.label.localeCompare(b.label, "fr", { sensitivity: "base" })
    );
    return list;
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return sortedVendors;
    return sortedVendors.filter((vendor) =>
      vendor.label.toLowerCase().includes(q)
    );
  }, [sortedVendors, vendorSearch]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) =>
      a.label.localeCompare(b.label, "fr", { sensitivity: "base" })
    );
    return list;
  }, [filteredProducts]);

  const filteredProductsBySearch = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return sortedProducts;
    return sortedProducts.filter((product) =>
      product.label.toLowerCase().includes(q)
    );
  }, [sortedProducts, productSearch]);

  const resetFeedback = () => {
    setFormError(null);
    setFormSuccess(null);
    setImageError(null);
    setImageWarning(null);
  };

  const loadImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const canvasToBlob = (canvas, quality = 0.85) =>
    new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/webp",
        quality
      );
    });

  const compressImage = async (file, maxBytes) => {
    const img = await loadImage(file);
    let width = img.width;
    let height = img.height;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const draw = () => {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
    };

    draw();
    let quality = 0.9;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > maxBytes && quality > 0.6) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }

    if (blob && blob.size > maxBytes) {
      const scale = Math.sqrt(maxBytes / blob.size);
      if (scale < 1) {
        width = Math.max(1, Math.floor(width * scale));
        height = Math.max(1, Math.floor(height * scale));
        draw();
        quality = 0.85;
        blob = await canvasToBlob(canvas, quality);
      }
    }

    if (!blob || blob.size > maxBytes) return null;
    const name = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${name}.webp`, { type: "image/webp" });
  };

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

  const handleFileChange = async (event) => {
    resetFeedback();
    const file = event.target.files?.[0];
    if (!file) {
      setHeroImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Format invalide (png, jpg ou webp uniquement).");
      setHeroImageFile(null);
      return;
    }
    let candidate = file;
    if (file.size > MAX_IMAGE_BYTES) {
      const compressed = await compressImage(file, MAX_IMAGE_BYTES);
      if (!compressed) {
        setImageError(`Image trop lourde (max ${maxMb} Mo).`);
        setHeroImageFile(null);
        return;
      }
      setImageWarning(
        `Image compressée automatiquement (${Math.round(compressed.size / 1024)} Ko).`
      );
      candidate = compressed;
    }

    readImageDimensions(candidate)
      .then(({ width, height }) => {
        if (height > 0) {
          const ratio = width / height;
          if (ratio < 1.8 || ratio > 2.2) {
            setImageWarning(
              `Ratio conseillé ~2:1 (ex 1600×800). Image actuelle: ${width}×${height}.`
            );
          }
        }
      })
      .catch((err) => {
        console.error("Failed to read image dimensions:", err);
      });
    setHeroImageFile(candidate);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetFeedback();
    if (!heroImageFile && !heroImageUrl) {
      setFormError("Ajoutez une image (png/jpg/webp).");
      return;
    }
    if (!badge.trim()) {
      setFormError("Renseignez le badge.");
      return;
    }
    if (targetType === "vendor" && !vendorId) {
      setFormError("Sélectionnez une boutique.");
      return;
    }
    if (targetType === "product" && (!vendorId || !productId)) {
      setFormError("Sélectionnez une boutique et un produit.");
      return;
    }
    if (!discount.trim()) {
      setFormError("Renseignez la reduction.");
      return;
    }
    try {
      setSubmitting(true);
      let uploadUrl = heroImageUrl;
      if (heroImageFile) {
        const storageRef = ref(
          storage,
          `sponsors/${Date.now()}-${heroImageFile.name.replace(/\s+/g, "_")}`
        );
        await uploadBytes(storageRef, heroImageFile);
        uploadUrl = await getDownloadURL(storageRef);
      }
      const actor = auth.currentUser?.email || auth.currentUser?.uid || "system";
      const now = new Date().toISOString();
      const resolvedTargetId =
        targetType === "vendor" ? vendorId : productId;
      const resolvedTargetLabel =
        targetType === "vendor"
          ? vendors.find((v) => v.id === vendorId)?.label || ""
          : filteredProducts.find((p) => p.id === productId)?.label || "";
      const payload = {
        targetId: resolvedTargetId || null,
        targetLabel: resolvedTargetLabel || null,
        heroImage: uploadUrl,
        badge: badge.trim() || null,
        title: title.trim(),
        productId: productId.trim() || null,
        categoryId: categoryId.trim() || null,
        discount: discount.trim(),
        status,
        targetType,
        vendorId: vendorId || null,
        updatedAt: now,
        updatedBy: actor,
      };

      if (isEdit) {
        await updateDoc(doc(db, "sponsors", sponsorId), payload);
        setFormSuccess("Sponsor mis à jour.");
      } else {
        const docRef = doc(collection(db, "sponsors"));
        await setDoc(docRef, {
          id: docRef.id,
          ...payload,
          createdAt: now,
          createdBy: actor,
        });
        setFormSuccess("Sponsor créé.");
        navigate("/admin/marketing/sponsors");
        return;
      }
    } catch (err) {
      console.error("Failed to save sponsor:", err);
      setFormError("Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalMessage = formError || formSuccess;
  const handleCloseModal = () => {
    setFormError(null);
    setFormSuccess(null);
  };

  return (
    <div className="marketingPage">
      <Sidebar />
      <div className="marketingPage__container">
        <Navbar />
        <div className="marketingPage__content">
          <div className="marketingPage__header marketingPage__header--between">
            <div>
              <h1>{isEdit ? "Modifier le sponsor" : "Créer un sponsor"}</h1>
              <p className="subtitle">Données enregistrées dans la collection sponsors.</p>
            </div>
            <Link to="/admin/marketing/sponsors" className="ghost">
              Retour à la liste
            </Link>
          </div>

          <form className="marketingPage__form" onSubmit={handleSubmit}>
            {loadingSponsor && <p className="helper">Chargement...</p>}

            <div className="formRow">
              <label>
                Titre <span className="requiredStar">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre principal"
                required
              />
            </div>


            <div className="formRow">
              <label>
                Badge <span className="requiredStar">*</span>
              </label>
              <div className="badgeField">
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  onFocus={() => setBadgeOpen(true)}
                  onBlur={() => setTimeout(() => setBadgeOpen(false), 150)}
                  placeholder="Texte de badge"
                  required
                />
                {badgeOpen && (
                  <div className="badgeField__list">
                    {BADGE_SUGGESTIONS.filter((option) =>
                      option.toLowerCase().includes(badge.trim().toLowerCase())
                    ).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="badgeField__option"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setBadge(option);
                          setBadgeOpen(false);
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="formGrid">
              <div className="formRow">
                <label>
                  Type de cible <span className="requiredStar">*</span>
                </label>
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value);
                    setProductId("");
                  }}
                  required
                >
                  <option value="vendor">Boutique</option>
                  <option value="product">Produit</option>
                </select>
              </div>
              <div className="formRow">
                <label>
                  Boutique <span className="requiredStar">*</span>
                </label>
                {vendorsLoading ? (
                  <p className="helper">Chargement des boutiques...</p>
                ) : (
                  <>
                    <input
                      type="search"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder="Rechercher une boutique..."
                    />
                    <select
                      value={vendorId}
                      onChange={(e) => {
                        setVendorId(e.target.value);
                        setProductId("");
                        setProductSearch("");
                      }}
                      required
                    >
                      <option value="">Sélectionner une boutique</option>
                      {filteredVendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>

            {targetType === "product" && (
              <div className="formRow">
                <label>
                  Produit (du vendeur sélectionné) <span className="requiredStar">*</span>
                </label>
                {productsLoading ? (
                  <p className="helper">Chargement des produits...</p>
                ) : (
                  <>
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Rechercher un produit..."
                      disabled={!vendorId}
                    />
                    {vendorId && !productsLoading && filteredProducts.length === 0 && (
                      <p className="helper helper--error">
                        Aucun produit disponible pour cette boutique.
                      </p>
                    )}
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      disabled={!vendorId}
                      required
                    >
                      <option value="">Sélectionner un produit</option>
                      {filteredProductsBySearch.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}

            <div className="formRow">
              <label>
                Reduction <span className="requiredStar">*</span>
              </label>
              <input
                type="text"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="Ex: -10% cette semaine"
                required
              />
            </div>

            <div className="formRow">
              <label>
                Image principale <span className="requiredStar">*</span>
              </label>
              <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} />
              {imageError && <p className="error">{imageError}</p>}
              {imageWarning && !imageError && <p className="helper">{imageWarning}</p>}
              {heroImageFile && !imageError && (
                <p className="helper">
                  {heroImageFile.name} ({Math.round(heroImageFile.size / 1024)} Ko)
                </p>
              )}
              {!heroImageFile && heroImageUrl && <p className="helper">Image actuelle conservée.</p>}
              <p className="helper">Formats acceptés : png/jpg/webp · max {maxMb} Mo.</p>
              {(filePreviewUrl || heroImageUrl) && (
                <div className="imagePreview">
                  <p className="helper">Aperçu :</p>
                  <img
                    src={filePreviewUrl || heroImageUrl}
                    alt="Aperçu sponsor"
                    className="imagePreview__img"
                  />
                </div>
              )}
            </div>

            <div className="formRow">
              <label>
                Statut <span className="requiredStar">*</span>
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>

            <div className="formActions">
              <button type="submit" disabled={!canSubmit}>
                {submitting ? "Enregistrement..." : isEdit ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmModal
        open={Boolean(modalMessage)}
        title={formError ? "Erreur" : "Succès"}
        onClose={handleCloseModal}
        onConfirm={handleCloseModal}
        confirmText="OK"
        cancelText="Fermer"
      >
        <p>{modalMessage}</p>
      </ConfirmModal>
    </div>
  );
};

export default SponsorEditor;
