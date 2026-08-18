// Valeurs derivees de VendorProductDetails.jsx a partir de product/
// publicProduct/vendorId/productId : images, variantes, statuts, infos
// prix/stock/ventes, diff brouillon vs publie. Extrait tel quel (les
// useMemo/useCallback internes sont preserves), aucune logique modifiee.
import { useCallback, useMemo } from "react";
import { getCategoryLabel, getTopCategoryLabel } from "../../utils/catalogLabels";
import {
  collectChangedLeafPaths,
  firstValue,
  formatDateTime,
  getFieldLabel,
  getNestedValue,
  isPlainObject,
  normalizeFieldPath,
  toBoolean,
  toNumberOrZero,
} from "./vendorProductDetailsHelpers";

export const useVendorProductView = (product, publicProduct, vendorId, productId, isPublicCatalogMode) => {
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

  const pendingDraftChanges =
    !isPublicCatalogMode && draftStatus && draftChanges.length > 0;

  const productApprovedAt = useMemo(
    () =>
      firstValue(
        product?.approvedAt,
        publicProduct?.approvedAt
      ) || null,
    [product, publicProduct]
  );

  const productApprovedBy = useMemo(
    () =>
      firstValue(
        product?.approvedBy,
        publicProduct?.approvedBy,
        product?.approvedByUid,
        publicProduct?.approvedByUid
      ) || "-",
    [product, publicProduct]
  );

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

  const salesInfo = useMemo(() => {
    const sales =
      firstValue(
        publicProduct?.stats?.sales,
        product?.stats?.sales,
        product?.core?.stats?.sales,
        product?.draft?.core?.stats?.sales
      ) || null;

    if (!sales || typeof sales !== "object") {
      return "-";
    }

    const unitsSold = toNumberOrZero(sales.unitsSold);
    const ordersCount = toNumberOrZero(sales.ordersCount);

    if (!unitsSold && !ordersCount) {
      return "0";
    }

    if (ordersCount > 0) {
      return `${unitsSold} unite(s) (${ordersCount} commande(s))`;
    }

    return `${unitsSold} unite(s)`;
  }, [product, publicProduct]);

  const attributes = useMemo(() => {
    if (!product) return [];
    const base =
      product.attributes ??
      product.core?.attributes ??
      product.draft?.core?.attributes ??
      {};
    return Object.entries(base);
  }, [product]);

  const fulfillmentDetails = useMemo(
    () =>
      firstValue(
        product?.fulfillment,
        product?.core?.fulfillment,
        product?.draft?.core?.fulfillment
      ),
    [product]
  );

  const ratingDetails = useMemo(
    () =>
      firstValue(
        product?.rating,
        product?.core?.rating,
        product?.draft?.core?.rating
      ),
    [product]
  );

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

  const categoryDisplayValue = useMemo(
    () => getCategoryLabel(categoryValue),
    [categoryValue]
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

  const topCategoryDisplayValue = useMemo(
    () => getTopCategoryLabel(topCategoryValue),
    [topCategoryValue]
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
    (path) => {
      const normalizedPath = normalizeFieldPath(path);
      return (
        getNestedValue(product?.draft?.core, normalizedPath) ??
        getNestedValue(product?.draft, normalizedPath) ??
        getNestedValue(product?.["draft.core"], normalizedPath) ??
        getNestedValue(product, `draft.core.${normalizedPath}`) ??
        getNestedValue(product, `draft.${normalizedPath}`) ??
        getNestedValue(product, path) ??
        getNestedValue(product, normalizedPath)
      );
    },
    [product]
  );

  const resolveCurrentValue = useCallback(
    (path) => {
      const normalizedPath = normalizeFieldPath(path);
      const hasStructuredValues = Boolean(
        product?.core ||
          product?.draft ||
          product?.draft?.core ||
          Object.keys(product || {}).some((key) => key.startsWith("core."))
      );
      const structuredValue =
        getNestedValue(publicProduct, normalizedPath) ??
        getNestedValue(publicProduct, path) ??
        getNestedValue(product?.core, normalizedPath) ??
        getNestedValue(product?.core, path) ??
        getNestedValue(product?.["core"], normalizedPath) ??
        getNestedValue(product, `core.${normalizedPath}`);
      if (structuredValue !== undefined || hasStructuredValues) {
        return structuredValue;
      }
      return (
        getNestedValue(product, normalizedPath)
      );
    },
    [publicProduct, product]
  );

  const draftChangeDetails = useMemo(() => {
    if (!pendingDraftChanges) return [];
    const details = [];
    const seenPaths = new Set();

    draftChanges.forEach((rawPath) => {
      const path =
        typeof rawPath === "string" ? rawPath.trim() : "";
      if (!path) return;

      const vendorValue = resolveDraftValue(path);
      const publishedValue = resolveCurrentValue(path);

      if (isPlainObject(vendorValue) || isPlainObject(publishedValue)) {
        const changedLeafPaths = collectChangedLeafPaths(
          path,
          vendorValue,
          publishedValue
        );
        if (changedLeafPaths.length > 0) {
          changedLeafPaths.forEach((attributePath) => {
            if (!attributePath || seenPaths.has(attributePath)) return;
            seenPaths.add(attributePath);
            details.push({
              path: attributePath,
              label: getFieldLabel(attributePath),
              vendorValue: resolveDraftValue(attributePath),
              publishedValue: resolveCurrentValue(attributePath),
            });
          });
        } else if (!seenPaths.has(path)) {
          seenPaths.add(path);
          details.push({
            path,
            label: getFieldLabel(path),
            vendorValue,
            publishedValue,
          });
        }
        return;
      }

      if (seenPaths.has(path)) return;
      seenPaths.add(path);
      details.push({
        path,
        label: getFieldLabel(path),
        vendorValue,
        publishedValue,
      });
    });

    return details;
  }, [
    draftChanges,
    pendingDraftChanges,
    resolveCurrentValue,
    resolveDraftValue,
  ]);

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

  return {
    deliveryInfo,
    coverImage,
    galleryImages,
    variantMedia,
    imagesByColor,
    variantOptions,
    variantsByColor,
    title,
    mmStatus,
    vmStatus,
    draftStatus,
    draftChanges,
    pendingDraftChanges,
    productApprovedAt,
    productApprovedBy,
    hasDraftChange,
    monmarchePublication,
    visibilityStatus,
    priceInfo,
    stockInfo,
    salesInfo,
    attributes,
    fulfillmentDetails,
    ratingDetails,
    lastUpdated,
    blockedReason,
    categoryValue,
    categoryDisplayValue,
    topCategoryValue,
    topCategoryDisplayValue,
    brandValue,
    getFieldClass,
    getStatClass,
    resolveDraftValue,
    resolveCurrentValue,
    draftChangeDetails,
    vendorDisplayId,
    vendorName,
    resolvedVendorId,
  };
};
