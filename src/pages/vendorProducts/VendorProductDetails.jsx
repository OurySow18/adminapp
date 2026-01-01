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

const ATTRIBUTE_LABELS = {
  perishables: "Produit perissable",
  originCountry: "Pays d'origine",
  organic: "Produit bio",
  expirationDate: "Date limite",
  storage: "Conservation",
  unit: "Unite de vente",
  netWeight: "Poids net",
  ingredients: "Ingredients",
  allergens: "Allergenes",
  "nutrition.kcalPer100g": "Calories / 100g",
  volume: "Contenance",
  alcohol: "Degre d'alcool",
  gender: "Genre",
  material: "Matiere",
  fit: "Coupe",
  care: "Entretien",
  materialUpper: "Matiere (tige)",
  materialSole: "Matiere (semelle)",
  color: "Couleur",
  model: "Modele",
  os: "Systeme",
  storageGb: "Stockage (Go)",
  ramGb: "Memoire vive (Go)",
  batteryMah: "Batterie (mAh)",
  screenInch: "Ecran (\")",
  cameraMp: "Appareil photo (MP)",
  cpu: "Processeur",
  gpu: "Carte graphique",
  screenType: "Type d'ecran",
  sizeInch: "Diagonal (\")",
  panel: "Dalle",
  type: "Type",
  wireless: "Sans fil",
  codec: "Codecs",
  room: "Piece",
  requiresAssembly: "Montage requis",
  maxLoadKg: "Charge max (kg)",
  powerW: "Puissance (W)",
  energyClass: "Classe energetique",
  capacity: "Capacite",
  features: "Fonctionnalites",
  dishwasherSafe: "Compatible lave-vaisselle",
  skinType: "Type de peau",
  crueltyFree: "Non teste sur animaux",
  sport: "Discipline",
  level: "Niveau pratique",
  ageMin: "Age minimum",
  ageMax: "Age maximum",
  safetyMarks: "Normes / certifications",
  author: "Auteur",
  publisher: "Editeur",
  language: "Langue",
  pages: "Nombre de pages",
  format: "Format",
  isbn13: "ISBN-13",
  artist: "Artiste",
  tracks: "Nombre de pistes",
  platform: "Plateforme",
  pegi: "PEGI",
  compatibleMakes: "Marques compatibles",
  partNumber: "Reference piece",
  cordless: "Sans fil",
  voltageV: "Voltage (V)",
  animal: "Animal concerne",
  weight: "Poids / contenance",
  flavor: "Saveur",
  deliveryType: "Mode de livraison",
  durationDays: "Duree (jours)",
  ageMaxMonths: "Age maximum (mois)",
  ageMinMonths: "Age minimum (mois)",
  age_max_months: "Age maximum (mois)",
  age_min_months: "Age minimum (mois)",
  weightLimitKg: "Poids maximal (kg)",
  weight_limit_kg: "Poids maximal (kg)",
  type: "Type",
};

const ATTRIBUTE_FIELD_LABELS = Object.fromEntries(
  Object.entries(ATTRIBUTE_LABELS).flatMap(([key, label]) => {
    const entries = [[key, label]];
    if (!key.startsWith("attributes.")) {
      entries.push([`attributes.${key}`, label]);
      entries.push([`core.attributes.${key}`, label]);
      entries.push([`draft.core.attributes.${key}`, label]);
    }
    return entries;
  })
);

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
  ...ATTRIBUTE_FIELD_LABELS,
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

const normalizeFieldPath = (path) => {
  if (typeof path !== "string") return "";
  return path
    .replace(/^draft\.core\./, "")
    .replace(/^core\./, "")
    .replace(/^draft\./, "");
};

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
  const normalized = normalizeFieldPath(path);
  if (normalized && FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];
  const resolvedPath = normalized || path;
  const segments = splitFieldPath(resolvedPath);
  if (!segments.length) return "-";
  return segments.map(humanizeSegment).join(" > ");
};

const trimAttributeLabel = (value) => {
  if (typeof value !== "string") return value;
  const segments = value
    .split(">")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return value;
  return segments[segments.length - 1];
};

const getAttributeLabel = (key) => {
  if (!key) return "-";
  const candidates = [
    FIELD_LABELS[key],
    FIELD_LABELS[`attributes.${key}`],
    FIELD_LABELS[`core.attributes.${key}`],
    FIELD_LABELS[`draft.core.attributes.${key}`],
    getFieldLabel(key),
    getFieldLabel(`attributes.${key}`),
  ];
  const label = candidates.find(
    (value) => typeof value === "string" && value.trim() && value !== "-"
  );
  if (!label) {
    const fallback = humanizeSegment(key);
    return fallback || key;
  }
  return trimAttributeLabel(label);
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
  const [imagePreview, setImagePreview] = useState(null);

  const deliveryInfo = useMemo(() => {
    const get = (...paths) => firstValue(...paths);
    const fulfillment =
      get(product?.fulfillment, product?.core?.fulfillment, product?.draft?.core?.fulfillment) ||
      {};
    const type = get(
      product?.deliveryType,
      product?.core?.deliveryType,
      product?.draft?.core?.deliveryType,
      product?.attributes?.deliveryType,
      product?.core?.attributes?.deliveryType,
      product?.draft?.core?.attributes?.deliveryType,
      fulfillment?.deliveryType
    );
    const zones = get(
      product?.deliveryZones,
      product?.core?.deliveryZones,
      product?.draft?.core?.deliveryZones,
      fulfillment?.vendorDeliveryAreas,
      fulfillment?.vendorShipping?.localAreas,
      fulfillment?.vendorShipping?.pickupPoints,
      fulfillment?.vendorShipping?.nationalCarriers,
      fulfillment?.vendorShipping?.internationalCarriers
    );
    const fee = get(
      product?.deliveryFee,
      product?.core?.deliveryFee,
      product?.draft?.core?.deliveryFee,
      product?.shippingFee,
      product?.core?.shippingFee,
      product?.draft?.core?.shippingFee,
      product?.deliveryCost,
      product?.core?.deliveryCost,
      product?.draft?.core?.deliveryCost
    );
    const delay = get(
      product?.deliveryDelay,
      product?.core?.deliveryDelay,
      product?.draft?.core?.deliveryDelay,
      product?.deliveryTime,
      product?.core?.deliveryTime,
      product?.draft?.core?.deliveryTime,
      product?.shippingTime,
      product?.core?.shippingTime,
      product?.draft?.core?.shippingTime,
      fulfillment?.leadTimeDays
    );
    const mode = get(
      product?.deliveryMethod,
      product?.core?.deliveryMethod,
      product?.draft?.core?.deliveryMethod
    );
    const shippedBy = get(
      fulfillment?.shippedBy,
      product?.shippedBy,
      product?.core?.shippedBy,
      product?.draft?.core?.shippedBy
    );
    const deliveryOptions = get(
      fulfillment?.deliveryOptions,
      product?.deliveryOptions,
      product?.core?.deliveryOptions,
      product?.draft?.core?.deliveryOptions
    );
    const note = get(
      fulfillment?.deliveryNote,
      product?.deliveryNote,
      product?.core?.deliveryNote,
      product?.draft?.core?.deliveryNote
    );

    const currency = get(
      product?.currency,
      product?.pricing?.currency,
      product?.core?.pricing?.currency,
      product?.draft?.core?.pricing?.currency
    );

    const normalizeList = (value) =>
      Array.isArray(value) ? value : value ? [value] : [];
    const unique = (items) =>
      Array.from(new Set(items.filter((item) => item !== undefined && item !== null && item !== "")));

    const optionLabels = {
      pickup: "Retrait",
      local_delivery: "Livraison locale",
      carrier: "Transporteur",
      digital: "Digital",
    };
    const shippedByLabels = {
      vendor: "Expédié par le vendeur",
      platform: "Expédié par Monmarché",
    };

    const deliveryOptionValues = normalizeList(deliveryOptions).map((opt) => {
      if (typeof opt === "string") return optionLabels[opt] || opt;
      return "";
    });

    const shippingModes = [];
    if (fulfillment?.vendorShipping?.localAreas?.length) {
      shippingModes.push("Livraison locale");
    }
    if (fulfillment?.vendorShipping?.nationalCarriers?.length) {
      shippingModes.push("Transporteur national");
    }
    if (fulfillment?.vendorShipping?.internationalCarriers?.length) {
      shippingModes.push("Transporteur international");
    }
    if (fulfillment?.vendorShipping?.pickupPoints?.length) {
      shippingModes.push("Point de retrait");
    }

    const modeValues = unique([
      shippedByLabels[shippedBy] || shippedBy,
      ...deliveryOptionValues,
      ...shippingModes,
      mode,
      type,
    ]).filter(Boolean);

    const areaNames = [];
    const rawZones = normalizeList(zones);
    rawZones.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        areaNames.push(entry);
        return;
      }
      if (typeof entry === "object") {
        if (entry.city) areaNames.push(entry.city);
        if (entry.coverage) areaNames.push(entry.coverage);
        if (entry.label) areaNames.push(entry.label);
        if (entry.address) areaNames.push(entry.address);
      }
    });

    const fees = [];
    rawZones.forEach((entry) => {
      if (entry && typeof entry === "object") {
        if (typeof entry.fee === "number") fees.push(entry.fee);
        if (typeof entry.baseFee === "number") fees.push(entry.baseFee);
      }
    });

    const delays = [];
    rawZones.forEach((entry) => {
      if (entry && typeof entry === "object") {
        if (typeof entry.minDelayDays === "number") delays.push(`${entry.minDelayDays}j`);
        if (typeof entry.maxDelayDays === "number") delays.push(`${entry.maxDelayDays}j`);
        if (entry.estimatedDays) delays.push(String(entry.estimatedDays));
      }
    });

    const formatFee = (value) => {
      if (value === undefined || value === null || value === "") return "";
      const printable =
        typeof value === "number" ? value.toLocaleString("fr-FR") : String(value);
      return currency ? `${printable} ${currency}` : printable;
    };

    const feeValue =
      fee !== undefined && fee !== null && fee !== ""
        ? formatFee(fee)
        : fees.length
        ? formatFee(Math.min(...fees)) +
          (Math.max(...fees) !== Math.min(...fees)
            ? ` - ${formatFee(Math.max(...fees))}`
            : "")
        : "";

    const delayValue =
      delay !== undefined && delay !== null && delay !== ""
        ? typeof delay === "number"
          ? `${delay} j`
          : String(delay)
        : delays.length
        ? unique(delays).join(", ")
        : "";

    return {
      modeLabel: modeValues.join(" · "),
      zonesLabel: unique(areaNames).join(", "),
      feeLabel: feeValue,
      delayLabel: delayValue,
      note,
    };
  }, [product]);

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

  const variantMedia = useMemo(() => {
    if (!product) return [];
    const source =
      product.media?.byOption ||
      product.core?.media?.byOption ||
      product.draft?.core?.media?.byOption;
    if (!source || typeof source !== "object") return [];
    console.log("Source: ", source)
    const collected = [];
    const walk = (node, prefix = "") => {
      if (!node || typeof node !== "object") return;
      
      Object.entries(node).forEach(([key, value]) => {
        const label = prefix ? `${prefix} / ${key}` : key;
        if (Array.isArray(value)) {
          if (value.length) collected.push({ key: label, images: value });
          return;
        }
        if (value && typeof value === "object") {
          const images = Array.isArray(value.images) ? value.images : null;
          if (images && images.length) {
            collected.push({ key: label, images });
          }
          // explore deeper for structures like byOption.color.blancs
          walk(value, label);
        }
      });
    };

    walk(source);
    return collected;
  }, [product]);

  const imagesByColor = useMemo(() => {
    const map = new Map();
    variantMedia.forEach(({ key, images }) => {
      const parts = key.split("/").map((s) => s.trim()).filter(Boolean);
      const colorKey = (parts[parts.length - 1] || "").toLowerCase();
      if (!colorKey) return;
      map.set(colorKey, images);
    });
    return map;
  }, [variantMedia]);

  const variantOptions = useMemo(() => {
    if (!product?.variants || !Array.isArray(product.variants.variants)) return [];
    return product.variants.variants.map((variant, idx) => {
      const baseOptions = variant?.options || {};
      const price = firstValue(
        baseOptions.price,
        variant.price,
        variant.pricing?.price,
        variant.pricing?.basePrice
      );
      const stock = firstValue(
        baseOptions.stock,
        variant.stock,
        variant.inventory?.stock
      );
      const optionValues = { ...baseOptions, price, stock };
      const imageKeys = Array.isArray(variant?.imageKeys) ? variant.imageKeys : [];
      const resolvedImages = [];
      const pushUnique = (url) => {
        if (typeof url !== "string") return;
        const trimmed = url.trim();
        if (!trimmed) return;
        if (!resolvedImages.includes(trimmed)) {
          resolvedImages.push(trimmed);
        }
      };
      imageKeys.forEach((key) => {
        if (typeof key !== "string") return;
        const normalized = key.trim().toLowerCase();
        if (normalized.startsWith("http")) {
          pushUnique(key);
          return;
        }
        const mapped = imagesByColor.get(normalized);
        if (Array.isArray(mapped)) {
          mapped.forEach(pushUnique);
        }
      });
      // fallbacks: direct images on variant
      if (typeof variant.image === "string" && variant.image.trim()) {
        pushUnique(variant.image);
      }
      if (Array.isArray(variant.images)) {
        variant.images.forEach((url) => {
          pushUnique(url);
        });
      }
      // fallback: images by detected color if none resolved via keys
      if (!resolvedImages.length) {
        const colorValue =
          baseOptions.color ||
          baseOptions.Color ||
          baseOptions.couleur ||
          baseOptions.Couleur ||
          variant.optionValues?.color ||
          variant.optionValues?.couleur;
        if (colorValue) {
          const mapped = imagesByColor.get(String(colorValue).trim().toLowerCase());
          if (Array.isArray(mapped)) {
            mapped.forEach(pushUnique);
          }
        }
        // if still none, try any string option value as a possible key (e.g. option id opt_xj7b)
        if (!resolvedImages.length) {
          Object.values(optionValues)
            .filter((val) => typeof val === "string" && val.trim())
            .forEach((val) => {
              const mapped = imagesByColor.get(val.trim().toLowerCase());
              if (Array.isArray(mapped)) {
                mapped.forEach(pushUnique);
              }
            });
        }
      }
      return {
        idx: idx + 1,
        optionValues,
        images: resolvedImages,
        vid: variant?.vid,
      };
    });
  }, [product, imagesByColor]);

  const variantsByColor = useMemo(() => {
    const groups = new Map();
    variantOptions.forEach((variant) => {
      const colorValue =
        variant.optionValues.color ||
        variant.optionValues.Color ||
        variant.optionValues.couleur ||
        variant.optionValues.Couleur ||
        "Autres";
      const key = String(colorValue).trim() || "Autres";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(variant);
    });
    return Array.from(groups.entries()).map(([color, list]) => ({
      color,
      list,
    }));
  }, [variantOptions]);

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

  const renderAttributeValue = (value) => {
    if (value === undefined || value === null) return "-";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (Array.isArray(value)) {
      const cleaned = value
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
        .map((v) => (typeof v === "boolean" ? (v ? "Oui" : "Non") : v));
      return cleaned.length ? cleaned.join(", ") : "-";
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (err) {
        return "-";
      }
    }
    return String(value);
  };

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
    <>
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
                  Activer
                </button>
                <button
                  type="button"
                  className="vendorProductDetails__actionBtn vendorProductDetails__actionBtn--block"
                  onClick={handleBlock}
                  disabled={statusUpdateState.loading || !mmStatus}
                >
                  Désactiver
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
                  <img
                    src={coverImage}
                    alt={title}
                    onClick={() => coverImage && setImagePreview(coverImage)}
                  />
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
                        <span
                          className="vendorProductDetails__attributeKey"
                          title={key}
                        >
                          {getAttributeLabel(key)}
                        </span>
                        <span
                          className={`vendorProductDetails__attributeValue ${getFieldClass(
                            `attributes.${key}`,
                            `core.attributes.${key}`,
                            `draft.core.attributes.${key}`
                          )}`}
                        >
                          {renderAttributeValue(value)}
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
                        <img
                          src={url}
                          alt={`Apercu ${index}`}
                          onClick={() => url && setImagePreview(url)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {variantsByColor.length > 0 && (
                <section className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__card--highlight">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Variantes & visuels</h2>
                    <p>Groupées par couleur avec options et photos.</p>
                  </div>
                  <div className="vendorProductDetails__variants">
                    {variantsByColor.map(({ color, list }) => {
                      const colorKey = String(color || "").trim().toLowerCase();
                      const colorImages = imagesByColor.get(colorKey) || [];
                      const hasPriceOrStock = list.some(
                        (variant) =>
                          variant.optionValues.price !== undefined ||
                          variant.optionValues.stock !== undefined
                      );
                      return (
                        <div className="vendorProductDetails__variantCard" key={color || "autres"}>
                          <div className="vendorProductDetails__variantHeader">
                            <span className="vendorProductDetails__variantLabel">
                              Couleur : {color}
                            </span>
                            <span className="vendorProductDetails__variantCount">
                              {list.length} déclinaison(s)
                            </span>
                          </div>
                          {colorImages.length > 0 && (
                            <div className="vendorProductDetails__variantGallery">
                              {colorImages.map((url, idx) => (
                                <div
                                  className="vendorProductDetails__variantImgWrapper"
                                  key={url || idx}
                                >
                                  <img
                                    src={url}
                                    alt={`Variante ${color} - ${idx + 1}`}
                                    onClick={() => url && setImagePreview(url)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="vendorProductDetails__variantOptions">
                            {list.map((variant) => (
                              <div
                                className="vendorProductDetails__variantRow"
                                key={variant.vid || variant.idx}
                              >
                                <div className="vendorProductDetails__variantMeta">
                                  <span className="vendorProductDetails__variantChip">
                                    Variante #{variant.idx}
                                  </span>
                                  {variant.vid && (
                                    <span className="vendorProductDetails__variantVid">
                                      {variant.vid}
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const displayImages =
                                    (Array.isArray(variant.images) && variant.images.length
                                      ? variant.images
                                      : colorImages) || [];
                                  const limited =
                                    Array.isArray(displayImages) && displayImages.length
                                      ? displayImages.slice(0, 4)
                                      : [];
                                  if (!limited.length) return null;
                                  return (
                                    <div className="vendorProductDetails__variantGallery vendorProductDetails__variantGallery--compact vendorProductDetails__variantGallery--inline">
                                      {limited.map((url, idx) => (
                                        <div
                                          className="vendorProductDetails__variantImgWrapper"
                                          key={url || idx}
                                        >
                                          <img
                                            src={url}
                                            alt={`Variante ${color} - ${idx + 1}`}
                                            onClick={() => url && setImagePreview(url)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                                <div className="vendorProductDetails__variantOptionsGrid">
                                  {Object.entries(variant.optionValues)
                                    .filter(
                                      ([key]) =>
                                        key.toLowerCase() !== "color" &&
                                        key.toLowerCase() !== "couleur" &&
                                        key.toLowerCase() !== "price" &&
                                        key.toLowerCase() !== "stock"
                                    )
                                    .map(([key, value]) => (
                                      <div
                                        className="vendorProductDetails__variantOption"
                                        key={key}
                                      >
                                        <span className="vendorProductDetails__variantOptionLabel">
                                          {getAttributeLabel(key)}
                                        </span>
                                        <span className="vendorProductDetails__variantOptionValue">
                                          {String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  <div className="vendorProductDetails__variantOption">
                                    <span className="vendorProductDetails__variantOptionLabel">
                                      Prix
                                    </span>
                                    <span className="vendorProductDetails__variantOptionValue">
                                      {variant.optionValues.price !== undefined
                                        ? variant.optionValues.price
                                        : hasPriceOrStock
                                        ? "—"
                                        : "N/A"}
                                    </span>
                                  </div>
                                  <div className="vendorProductDetails__variantOption">
                                    <span className="vendorProductDetails__variantOptionLabel">
                                      Stock
                                    </span>
                                    <span className="vendorProductDetails__variantOptionValue">
                                      {variant.optionValues.stock !== undefined
                                        ? variant.optionValues.stock
                                        : hasPriceOrStock
                                        ? "—"
                                        : "N/A"}
                                    </span>
                                  </div>
                                </div>
                                {Array.isArray(variant.images) && variant.images.length > 0 && (
                                  <div className="vendorProductDetails__variantGallery vendorProductDetails__variantGallery--compact">
                                    {variant.images.map((url, idx) => (
                                      <div
                                        className="vendorProductDetails__variantImgWrapper"
                                        key={url || idx}
                                      >
                                        <img
                                          src={url}
                                          alt={`Variante ${color} - ${idx + 1}`}
                                          onClick={() => url && setImagePreview(url)}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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

                <section className="vendorProductDetails__card vendorProductDetails__card--section vendorProductDetails__card--highlight">
                  <div className="vendorProductDetails__cardHeader">
                    <h2>Livraison</h2>
                    <p>Informations clés pour l'expédition.</p>
                  </div>
                  <div className="vendorProductDetails__deliveryGrid">
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Mode</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.modeLabel || "—"}
                      </span>
                    </div>
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Zones / périmètre</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.zonesLabel || "—"}
                      </span>
                    </div>
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Frais</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.feeLabel || "—"}
                      </span>
                    </div>
                    <div className="vendorProductDetails__deliveryItem">
                      <span className="vendorProductDetails__deliveryLabel">Délai estimé</span>
                      <span className="vendorProductDetails__deliveryValue">
                        {deliveryInfo.delayLabel || "—"}
                      </span>
                    </div>
                    {deliveryInfo.note ? (
                      <div className="vendorProductDetails__deliveryItem vendorProductDetails__deliveryItem--full">
                        <span className="vendorProductDetails__deliveryLabel">Note</span>
                        <span className="vendorProductDetails__deliveryValue">
                          {deliveryInfo.note}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </section>
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
    {imagePreview && (
      <div
        className="vendorProductDetails__imageOverlay"
        onClick={() => setImagePreview(null)}
        role="presentation"
      >
        <div
          className="vendorProductDetails__imageModal"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="vendorProductDetails__imageClose"
            onClick={() => setImagePreview(null)}
            aria-label="Fermer l'aperçu"
          >
            ×
          </button>
          <img src={imagePreview} alt={title} />
        </div>
      </div>
    )}
    </>
  );
};

export default VendorProductDetails;

