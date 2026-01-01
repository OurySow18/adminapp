import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
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
import { auth, db } from "../../firebase";

const resolveProductTitle = (data = {}) =>
  data.title ||
  data.name ||
  data.product ||
  data.core?.title ||
  data.draft?.core?.title ||
  "";

const resolveProductImage = (data = {}) =>
  data.img ||
  data.image ||
  (Array.isArray(data.images) ? data.images[0] : null) ||
  data.media?.cover ||
  data.core?.media?.cover ||
  data.draft?.core?.media?.cover ||
  "";

const resolveProductPrice = (data = {}) =>
  data.price ??
  data.pricing?.basePrice ??
  data.core?.pricing?.basePrice ??
  data.draft?.core?.pricing?.basePrice ??
  null;

const resolveProductCurrency = (data = {}) =>
  data.currency ||
  data.pricing?.currency ||
  data.core?.pricing?.currency ||
  data.draft?.core?.pricing?.currency ||
  "GNF";

const BestsellerEditor = () => {
  const { bestsellerId } = useParams();
  const isEdit = Boolean(bestsellerId);
  const navigate = useNavigate();

  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("active");
  const [savedProduct, setSavedProduct] = useState(null);

  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [loadingItem, setLoadingItem] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  useEffect(() => {
    const loadBestseller = async () => {
      if (!isEdit) return;
      setLoadingItem(true);
      try {
        const snap = await getDoc(doc(db, "bestseller", bestsellerId));
        if (snap.exists()) {
          const data = snap.data() || {};
          setVendorId(data.vendorId || "");
          setVendorName(data.vendorName || "");
          setProductId(data.productId || "");
          setStatus(data.status || "active");
          setSavedProduct({
            title: data.title || "",
            imageUrl: data.imageUrl || "",
            price: data.price ?? null,
            currency: data.currency || "GNF",
          });
        } else {
          setFormError("Bestseller introuvable.");
        }
      } catch (err) {
        console.error("Failed to load bestseller:", err);
        setFormError("Impossible de charger le bestseller.");
      } finally {
        setLoadingItem(false);
      }
    };
    loadBestseller();
  }, [bestsellerId, isEdit]);

  useEffect(() => {
    const loadVendors = async () => {
      setVendorsLoading(true);
      try {
        const q = query(
          collection(db, "vendors"),
          where("status", "==", "approved"),
          limit(200)
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
      if (!vendorId) {
        setProducts([]);
        setProductsLoading(false);
        return;
      }
      setProductsLoading(true);
      try {
        const q = query(
          collection(db, "vendor_products"),
          where("vendorId", "==", vendorId),
          limit(200)
        );
        const snapshot = await getDocs(q);
        const items = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          items.push({
            id: docSnap.id,
            label: resolveProductTitle(data) || docSnap.id,
            imageUrl: resolveProductImage(data),
            price: resolveProductPrice(data),
            currency: resolveProductCurrency(data),
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
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
    if (selectedVendor) {
      setVendorName(selectedVendor.label);
    }
  }, [vendorId, vendors]);

  useEffect(() => {
    if (!vendorId) {
      setProductId("");
      setProducts([]);
    }
  }, [vendorId]);

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
    const list = [...products];
    list.sort((a, b) =>
      a.label.localeCompare(b.label, "fr", { sensitivity: "base" })
    );
    return list;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return sortedProducts;
    return sortedProducts.filter((product) =>
      product.label.toLowerCase().includes(q)
    );
  }, [sortedProducts, productSearch]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [products, productId]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!vendorId) {
      setFormError("Veuillez sélectionner une boutique.");
      return;
    }
    if (!productId) {
      setFormError("Veuillez sélectionner un produit.");
      return;
    }
    if (!status) {
      setFormError("Veuillez choisir un statut.");
      return;
    }

    const productInfo = selectedProduct || savedProduct;
    if (!productInfo) {
      setFormError("Informations produit indisponibles.");
      return;
    }

    const updatedBy =
      auth.currentUser?.email || auth.currentUser?.uid || "system";
    const payload = {
      vendorId,
      vendorName,
      productId,
      title: productInfo.label || productInfo.title || "",
      imageUrl: productInfo.imageUrl || "",
      price: productInfo.price ?? null,
      currency: productInfo.currency || "GNF",
      status,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await updateDoc(doc(db, "bestseller", bestsellerId), payload);
        setFormSuccess("Bestseller mis à jour.");
      } else {
        await addDoc(collection(db, "bestseller"), {
          ...payload,
          createdAt: new Date().toISOString(),
          createdBy: updatedBy,
        });
        setFormSuccess("Bestseller créé.");
        setVendorId("");
        setVendorName("");
        setProductId("");
        setStatus("active");
        setSavedProduct(null);
      }
    } catch (err) {
      console.error("Failed to save bestseller:", err);
      setFormError("Impossible d'enregistrer le bestseller.");
    } finally {
      setSubmitting(false);
    }
  };

  const previewTitle = selectedProduct?.label || savedProduct?.title || "";
  const previewImage = selectedProduct?.imageUrl || savedProduct?.imageUrl || "";
  const previewPrice = selectedProduct?.price ?? savedProduct?.price ?? null;
  const previewCurrency =
    selectedProduct?.currency || savedProduct?.currency || "GNF";

  return (
    <div className="marketingPage">
      <Sidebar />
      <div className="marketingPage__container">
        <Navbar />
        <div className="marketingPage__content">
          <div className="marketingPage__header marketingPage__header--between">
            <div>
              <h1>{isEdit ? "Modifier le bestseller" : "Créer un bestseller"}</h1>
              <p className="subtitle">
                Données enregistrées dans la collection bestseller.
              </p>
            </div>
            <Link to="/admin/marketing/bestsellers" className="ghost">
              Retour à la liste
            </Link>
          </div>

          <form className="marketingPage__form" onSubmit={handleSubmit}>
            {loadingItem && <p className="helper">Chargement...</p>}
            {formError && <p className="error">{formError}</p>}
            {formSuccess && <p className="success">{formSuccess}</p>}

            <div className="formGrid">
              <div className="formField">
                <label htmlFor="vendorSearch">Boutique</label>
                <input
                  id="vendorSearch"
                  type="text"
                  placeholder="Rechercher une boutique..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                />
                <select
                  value={vendorId}
                  onChange={(e) => {
                    setVendorId(e.target.value);
                    setProductId("");
                  }}
                  disabled={vendorsLoading}
                >
                  <option value="">Sélectionner une boutique</option>
                  {filteredVendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.label}
                    </option>
                  ))}
                </select>
                {vendorsLoading && <span className="helper">Chargement...</span>}
              </div>

              <div className="formField">
                <label htmlFor="productSearch">Produit</label>
                <input
                  id="productSearch"
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  disabled={!vendorId}
                />
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={!vendorId || productsLoading}
                >
                  <option value="">Sélectionner un produit</option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.label}
                    </option>
                  ))}
                </select>
                {vendorId && !productsLoading && filteredProducts.length === 0 && (
                  <span className="error">
                    Cette boutique n'a aucun produit disponible.
                  </span>
                )}
                {productsLoading && <span className="helper">Chargement...</span>}
              </div>

              <div className="formField">
                <label htmlFor="status">Statut</label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>

            {(previewTitle || previewImage) && (
              <div className="marketingPage__card">
                <h3>Aperçu du produit</h3>
                {previewImage ? (
                  <img src={previewImage} alt={previewTitle} />
                ) : null}
                <p>{previewTitle || "-"}</p>
                <p className="helper">
                  {previewPrice !== null
                    ? `${previewPrice} ${previewCurrency}`
                    : "-"}
                </p>
              </div>
            )}

            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BestsellerEditor;
