import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import StatisticsShell, {
  StatisticsKpiGrid,
  StatisticsSection,
  StatisticsTable,
} from "./StatisticsShell";
import { formatNumber } from "./statisticsShared";
import { db } from "../../firebase";
import {
  CATEGORY_LABELS,
  TOP_CATEGORY_LABELS,
  getCatalogLabel,
  getTopCategoryLabel,
} from "../../utils/catalogLabels";
import {
  loadPublicCatalogRows,
  loadVendorProductRows,
} from "../../utils/vendorProductsRepository";

const MONMARCHE_VENDOR_ID = "89xYCymLLyTSGeAw1oZvNcHLIFO2";

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const normalizeLabel = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const resolveRowVendorName = (row) =>
  firstValue(
    row.vendorName,
    row.raw?.vendorName,
    row.raw?.core?.vendorName,
    row.raw?.draft?.core?.vendorName,
    row.raw?.vendor?.name,
    row.raw?.vendor?.displayName,
    row.raw?.vendor?.company?.name,
    row.raw?.profile?.displayName,
    row.raw?.profile?.company?.name,
    row.raw?.company?.name,
    row.raw?.storeName,
    row.vendorDisplayId,
    row.vendorId
  );

const getProfileSection = (vendor) => {
  if (!vendor || typeof vendor !== "object") return {};
  return vendor.profile || vendor.vendor || vendor || {};
};

const getSection = (vendor, key) => {
  if (!vendor) return {};
  const profile = getProfileSection(vendor) || {};
  return profile?.[key] ?? vendor?.[key] ?? {};
};

const resolveVendorDocName = (vendor) =>
  firstValue(
    vendor?.vendorName,
    vendor?.displayName,
    vendor?.profile?.displayName,
    vendor?.profile?.company?.name,
    vendor?.company?.name,
    vendor?.companyName,
    vendor?.name,
    vendor?.label,
    vendor?.vendorId,
    vendor?.id
  );

const resolveVendorDocAddressMeta = (vendor) => {
  const company = getSection(vendor, "company");
  const address = firstValue(
    company?.address,
    vendor?.company?.address,
    vendor?.address
  );
  const zip = firstValue(company?.zip, vendor?.company?.zip, vendor?.zip);
  const city = firstValue(company?.city, vendor?.company?.city, vendor?.city);
  const country = firstValue(
    company?.country,
    vendor?.company?.country,
    vendor?.country
  );

  const locality = [zip, city].filter(Boolean).join(" ");
  const parts = [address, locality, country]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  return {
    address: parts.join(", ") || "—",
    city:
      (typeof city === "string" && city.trim() && city.trim()) ||
      (typeof country === "string" && country.trim() && country.trim()) ||
      "Zone non renseignée",
  };
};

const resolveRowVendorAddress = (row) => {
  const addressCandidates = [
    row.raw?.vendor?.company?.address,
    row.raw?.vendor?.profile?.company?.address,
    row.raw?.profile?.company?.address,
    row.raw?.company?.address,
    row.raw?.address,
  ];
  const zipCandidates = [
    row.raw?.vendor?.company?.zip,
    row.raw?.vendor?.profile?.company?.zip,
    row.raw?.profile?.company?.zip,
    row.raw?.company?.zip,
    row.raw?.zip,
  ];
  const cityCandidates = [
    row.raw?.vendor?.company?.city,
    row.raw?.vendor?.profile?.company?.city,
    row.raw?.profile?.company?.city,
    row.raw?.company?.city,
    row.raw?.city,
  ];
  const countryCandidates = [
    row.raw?.vendor?.company?.country,
    row.raw?.vendor?.profile?.company?.country,
    row.raw?.profile?.company?.country,
    row.raw?.company?.country,
    row.raw?.country,
  ];

  const address = firstValue(...addressCandidates);
  const zip = firstValue(...zipCandidates);
  const city = firstValue(...cityCandidates);
  const country = firstValue(...countryCandidates);

  const locality = [zip, city].filter(Boolean).join(" ");
  const parts = [address, locality, country]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  return parts.join(", ") || "—";
};

const resolveRowVendorCity = (row) =>
  firstValue(
    row.raw?.vendor?.company?.city,
    row.raw?.vendor?.profile?.company?.city,
    row.raw?.profile?.company?.city,
    row.raw?.company?.city,
    row.raw?.city
  );

const resolveRowVendorCountry = (row) =>
  firstValue(
    row.raw?.vendor?.company?.country,
    row.raw?.vendor?.profile?.company?.country,
    row.raw?.profile?.company?.country,
    row.raw?.company?.country,
    row.raw?.country
  );

const resolveRowVendorGeoSector = (row) => {
  const city = resolveRowVendorCity(row);
  if (typeof city === "string" && city.trim()) {
    return city.trim();
  }

  const country = resolveRowVendorCountry(row);
  if (typeof country === "string" && country.trim()) {
    return country.trim();
  }

  const address = resolveRowVendorAddress(row);
  if (address && address !== "—") {
    return address.split(",")[0].trim() || address;
  }

  return "Zone non renseignée";
};

const isMonmarcheRow = (row) => {
  if (row?.vendorId === MONMARCHE_VENDOR_ID) return true;
  if (row?.vendorDisplayId === MONMARCHE_VENDOR_ID) return true;
  const vendorName = normalizeLabel(resolveRowVendorName(row));
  return vendorName.includes("monmarche");
};

const resolveCategoryId = (row) =>
  firstValue(
    row.categoryId,
    row.category,
    row.raw?.categoryId,
    row.raw?.category,
    row.raw?.core?.categoryId,
    row.raw?.core?.category,
    row.raw?.draft?.core?.categoryId,
    row.raw?.draft?.core?.category
  );

const resolveTopCategoryKey = (categoryId) => {
  if (typeof categoryId !== "string" || !categoryId.trim()) return "";
  const normalized = categoryId.trim();
  if (TOP_CATEGORY_LABELS[normalized]) return normalized;
  const [topCategory] = normalized.split("_");
  return topCategory || normalized;
};

const getFamilyCategoryKeys = (familyKey) =>
  Object.keys(CATEGORY_LABELS).filter(
    (categoryKey) => resolveTopCategoryKey(categoryKey) === familyKey
  );

const createCoverageEntry = (label, familyKey = "") => ({
  label,
  familyKey,
  productCount: 0,
  vendors: new Set(),
});

const isVisibleCatalogRow = (row) =>
  row?.source === "public" || Boolean(row?.isVisibleOnMonmarche);

const StatisticsCatalog = () => {
  const [rows, setRows] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [deletedVendors, setDeletedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      setLoading(true);
      setError(null);
      try {
        const publicRows = await loadPublicCatalogRows();
        const dataset =
          Array.isArray(publicRows) && publicRows.length
            ? publicRows
            : await loadVendorProductRows();
        if (!cancelled) {
          setRows(Array.isArray(dataset) ? dataset : []);
        }
      } catch (err) {
        console.error("Failed to load catalog statistics:", err);
        if (!cancelled) {
          setRows([]);
          setError("Impossible de charger la couverture catalogue.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRows();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(collection(db, "vendors"), (snapshot) => {
        setVendors(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() || {}),
          }))
        );
      }),
      onSnapshot(collection(db, "deletedVendors"), (snapshot) => {
        setDeletedVendors(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() || {}),
          }))
        );
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const vendorMetaById = useMemo(() => {
    const map = new Map();

    [...vendors, ...deletedVendors].forEach((vendor) => {
      if (!vendor?.id) return;
      const addressMeta = resolveVendorDocAddressMeta(vendor);
      map.set(vendor.id, {
        name: resolveVendorDocName(vendor) || "Boutique",
        address: addressMeta.address,
        city: addressMeta.city,
      });
    });

    return map;
  }, [vendors, deletedVendors]);

  const visibleVendorRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          isVisibleCatalogRow(row) &&
          row?.vendorId &&
          row.vendorId !== "_" &&
          !isMonmarcheRow(row)
      ),
    [rows]
  );

  const coverage = useMemo(() => {
    const byFamily = new Map(
      Object.keys(TOP_CATEGORY_LABELS).map((key) => [
        key,
        createCoverageEntry(getTopCategoryLabel(key), key),
      ])
    );
    const byCategory = new Map(
      Object.keys(CATEGORY_LABELS).map((key) => [
        key,
        createCoverageEntry(getCatalogLabel(key), resolveTopCategoryKey(key)),
      ])
    );
    const uncategorized = createCoverageEntry("Non renseigné");
    const visibleVendorIds = new Set();

    visibleVendorRows.forEach((row) => {
      const vendorKey = row.vendorId || row.vendorDisplayId || row.id;
      const categoryId = resolveCategoryId(row);
      const topCategoryKey = resolveTopCategoryKey(categoryId);

      visibleVendorIds.add(vendorKey);

      if (categoryId) {
        if (!byCategory.has(categoryId)) {
          byCategory.set(
            categoryId,
            createCoverageEntry(
              getCatalogLabel(categoryId),
              resolveTopCategoryKey(categoryId)
            )
          );
        }
        const categoryEntry = byCategory.get(categoryId);
        categoryEntry.productCount += 1;
        categoryEntry.vendors.add(vendorKey);
      } else {
        uncategorized.productCount += 1;
        uncategorized.vendors.add(vendorKey);
      }

      if (topCategoryKey && byFamily.has(topCategoryKey)) {
        const familyEntry = byFamily.get(topCategoryKey);
        familyEntry.productCount += 1;
        familyEntry.vendors.add(vendorKey);
      }
    });

    return {
      byFamily,
      byCategory,
      uncategorized,
      visibleVendorIds,
    };
  }, [visibleVendorRows]);

  const familyRows = useMemo(
    () =>
      Object.keys(TOP_CATEGORY_LABELS)
        .map((familyKey) => {
          const familyEntry = coverage.byFamily.get(familyKey);
          const familyCategoryKeys = getFamilyCategoryKeys(familyKey);
          const activeTypes = familyCategoryKeys.filter(
            (categoryKey) =>
              (coverage.byCategory.get(categoryKey)?.productCount || 0) > 0
          ).length;
          const vendorCount = familyEntry?.vendors.size || 0;
          const productCount = familyEntry?.productCount || 0;

          let reading = "À développer";
          if (productCount > 0 && activeTypes === familyCategoryKeys.length) {
            reading = "Bien couvert";
          } else if (productCount > 0) {
            reading = "Partiel";
          }

          return {
            id: familyKey,
            famille: getTopCategoryLabel(familyKey),
            vendeurs: formatNumber(vendorCount),
            types: `${formatNumber(activeTypes)}/${formatNumber(
              familyCategoryKeys.length
            )}`,
            produits: formatNumber(productCount),
            lecture: reading,
            _sortProducts: productCount,
            _sortVendors: vendorCount,
          };
        })
        .sort((left, right) => {
          if (right._sortProducts !== left._sortProducts) {
            return right._sortProducts - left._sortProducts;
          }
          return right._sortVendors - left._sortVendors;
        }),
    [coverage.byCategory, coverage.byFamily]
  );

  const availableTypeRows = useMemo(
    () =>
      Array.from(coverage.byCategory.entries())
        .map(([categoryKey, entry]) => {
          const productCount = entry?.productCount || 0;
          const vendorCount = entry?.vendors.size || 0;

          return {
            id: categoryKey,
            type: getCatalogLabel(categoryKey),
            famille: getTopCategoryLabel(resolveTopCategoryKey(categoryKey)),
            vendeurs: formatNumber(vendorCount),
            produits: formatNumber(productCount),
            lecture:
              productCount === 0
                ? "Absent"
                : vendorCount === 1 || productCount <= 2
                ? "Fragile"
                : "Disponible",
            _sortProducts: productCount,
            _sortVendors: vendorCount,
          };
        })
        .filter((row) => row._sortProducts > 0)
        .sort((left, right) => {
          if (right._sortProducts !== left._sortProducts) {
            return right._sortProducts - left._sortProducts;
          }
          return right._sortVendors - left._sortVendors;
        })
        .slice(0, 12),
    [coverage.byCategory]
  );

  const prospectingRows = useMemo(
    () =>
      Object.keys(TOP_CATEGORY_LABELS)
        .map((familyKey) => {
          const familyEntry = coverage.byFamily.get(familyKey);
          const familyCategoryKeys = getFamilyCategoryKeys(familyKey);
          const missingTypes = familyCategoryKeys.filter(
            (categoryKey) =>
              (coverage.byCategory.get(categoryKey)?.productCount || 0) === 0
          );
          const vendorCount = familyEntry?.vendors.size || 0;
          const productCount = familyEntry?.productCount || 0;

          if (
            vendorCount > 1 &&
            missingTypes.length === 0 &&
            productCount > 3
          ) {
            return null;
          }

          let situation = "Absent";
          let action = `Démarcher un vendeur ${getTopCategoryLabel(
            familyKey
          ).toLowerCase()} pour ouvrir cette famille.`;

          if (vendorCount > 0) {
            situation =
              missingTypes.length > 0 ? "Couverture partielle" : "Dépendance faible";
            action =
              missingTypes.length > 0
                ? `Chercher 1 à 2 vendeurs ${getTopCategoryLabel(
                    familyKey
                  ).toLowerCase()} pour couvrir les types manquants.`
                : `Sécuriser un second vendeur ${getTopCategoryLabel(
                    familyKey
                  ).toLowerCase()} pour éviter une dépendance unique.`;
          }

          return {
            id: familyKey,
            famille: getTopCategoryLabel(familyKey),
            situation,
            vendeurs: formatNumber(vendorCount),
            types_manquants: missingTypes.length
              ? missingTypes
                  .slice(0, 3)
                  .map((categoryKey) => getCatalogLabel(categoryKey))
                  .join(", ")
              : "Aucun",
            action,
            _priority:
              vendorCount === 0
                ? 3
                : missingTypes.length >= 2
                ? 2
                : vendorCount === 1
                ? 1
                : 0,
            _missingCount: missingTypes.length,
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          if (right._priority !== left._priority) {
            return right._priority - left._priority;
          }
          return right._missingCount - left._missingCount;
        }),
    [coverage.byCategory, coverage.byFamily]
  );

  const gapRows = useMemo(
    () =>
      Object.keys(CATEGORY_LABELS)
        .map((categoryKey) => {
          const entry = coverage.byCategory.get(categoryKey);
          const productCount = entry?.productCount || 0;
          const vendorCount = entry?.vendors.size || 0;

          if (productCount > 2 && vendorCount > 1) {
            return null;
          }

          const familyLabel = getTopCategoryLabel(resolveTopCategoryKey(categoryKey));
          const status = productCount === 0 ? "Absent" : "Faible";

          return {
            id: categoryKey,
            type: getCatalogLabel(categoryKey),
            famille: familyLabel,
            situation: status,
            offre:
              productCount === 0
                ? "Aucun produit visible"
                : `${formatNumber(productCount)} produit(s) chez ${formatNumber(
                    vendorCount
                  )} vendeur(s)`,
            recommandation:
              productCount === 0
                ? `Chercher un vendeur ${familyLabel.toLowerCase()} avec cette offre.`
                : `Renforcer cette niche avec au moins un vendeur ${familyLabel.toLowerCase()} supplémentaire.`,
            _priority: productCount === 0 ? 2 : 1,
            _productCount: productCount,
            _vendorCount: vendorCount,
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          if (right._priority !== left._priority) {
            return right._priority - left._priority;
          }
          if (left._productCount !== right._productCount) {
            return left._productCount - right._productCount;
          }
          return left._vendorCount - right._vendorCount;
        })
        .slice(0, 12),
    [coverage.byCategory]
  );

  const vendorSectorProfiles = useMemo(() => {
    const vendorBuckets = new Map();

    visibleVendorRows.forEach((row) => {
      const vendorId = row.vendorId || row.vendorDisplayId || row.id;
      if (!vendorBuckets.has(vendorId)) {
        const vendorMeta = vendorMetaById.get(vendorId);
        vendorBuckets.set(vendorId, {
          id: vendorId,
          vendor: vendorMeta?.name || resolveRowVendorName(row) || "Boutique",
          address: vendorMeta?.address || resolveRowVendorAddress(row),
          sector: vendorMeta?.city || resolveRowVendorGeoSector(row),
          productCount: 0,
          categoryKeys: new Set(),
        });
      }

      const vendorEntry = vendorBuckets.get(vendorId);
      const categoryId = resolveCategoryId(row);

      vendorEntry.productCount += 1;

      if (categoryId) {
        vendorEntry.categoryKeys.add(categoryId);
      }
    });

    return Array.from(vendorBuckets.values())
      .map((vendorEntry) => {
        return {
          id: vendorEntry.id,
          vendor: vendorEntry.vendor,
          secteur: vendorEntry.sector,
          address: vendorEntry.address,
          products: vendorEntry.productCount,
          typeCount: vendorEntry.categoryKeys.size,
        };
      })
      .sort((left, right) => {
        if (left.secteur !== right.secteur) {
          return left.secteur.localeCompare(right.secteur);
        }
        if (right.products !== left.products) {
          return right.products - left.products;
        }
        return left.vendor.localeCompare(right.vendor);
      });
  }, [vendorMetaById, visibleVendorRows]);

  const sectorStoreRows = useMemo(() => {
    const sectors = new Map();

    vendorSectorProfiles.forEach((vendorEntry) => {
      const sectorKey = normalizeLabel(vendorEntry.secteur) || "unclassified";
      if (!sectors.has(sectorKey)) {
        sectors.set(sectorKey, {
          id: sectorKey,
          secteur: vendorEntry.secteur,
          boutiques: 0,
          products: 0,
          vendors: [],
        });
      }

      const sectorEntry = sectors.get(sectorKey);
      sectorEntry.boutiques += 1;
      sectorEntry.products += vendorEntry.products;
          sectorEntry.vendors.push(vendorEntry);
    });

    return Array.from(sectors.values())
      .map((sectorEntry) => ({
        id: sectorEntry.id,
        secteur: sectorEntry.secteur,
        boutiques: formatNumber(sectorEntry.boutiques),
        produits: formatNumber(sectorEntry.products),
        profils:
          sectorEntry.vendors
            .sort((left, right) => right.products - left.products)
            .slice(0, 3)
            .map((vendorEntry) => vendorEntry.vendor)
            .join(", ") || "—",
        lecture:
          sectorEntry.boutiques >= 4
            ? "Dense"
            : sectorEntry.boutiques >= 2
            ? "Présent"
            : "Faible",
        _boutiques: sectorEntry.boutiques,
        _produits: sectorEntry.products,
      }))
      .sort((left, right) => {
        if (right._boutiques !== left._boutiques) {
          return right._boutiques - left._boutiques;
        }
        return right._produits - left._produits;
      });
  }, [vendorSectorProfiles]);

  const vendorBySectorRows = useMemo(
    () =>
      vendorSectorProfiles.map((vendorEntry) => ({
        id: vendorEntry.id,
        boutique: vendorEntry.vendor,
        adresse: vendorEntry.address,
        secteur: vendorEntry.secteur,
        types: formatNumber(vendorEntry.typeCount),
        produits: formatNumber(vendorEntry.products),
        lecture:
          vendorEntry.address !== "—" ? "Adresse connue" : "Adresse partielle",
      })),
    [vendorSectorProfiles]
  );

  const kpis = useMemo(() => {
    if (loading) {
      return [
        {
          label: "Familles vendeurs couvertes",
          value: "—",
          helper: "Chargement catalogue...",
        },
        {
          label: "Types de produits visibles",
          value: "—",
          helper: "Chargement catalogue...",
        },
        {
          label: "Types manquants",
          value: "—",
          helper: "Chargement catalogue...",
        },
        {
          label: "Profils à démarcher",
          value: "—",
          helper: "Chargement catalogue...",
        },
      ];
    }

    const totalFamilies = Object.keys(TOP_CATEGORY_LABELS).length;
    const coveredFamilies = familyRows.filter((row) => row._sortProducts > 0).length;
    const totalTypes = Object.keys(CATEGORY_LABELS).length;
    const coveredTypes = Object.keys(CATEGORY_LABELS).filter(
      (categoryKey) => (coverage.byCategory.get(categoryKey)?.productCount || 0) > 0
    ).length;
    const missingTypes = totalTypes - coveredTypes;

    return [
      {
        label: "Familles vendeurs couvertes",
        value: `${formatNumber(coveredFamilies)}/${formatNumber(totalFamilies)}`,
        helper: `${formatNumber(coverage.visibleVendorIds.size)} vendeur(s) avec offre visible`,
      },
      {
        label: "Types de produits visibles",
        value: formatNumber(coveredTypes),
        helper: `${formatNumber(visibleVendorRows.length)} produit(s) visibles analysés`,
      },
      {
        label: "Types manquants",
        value: formatNumber(missingTypes),
        helper: "Sous-catégories sans offre visible",
      },
      {
        label: "Profils à démarcher",
        value: formatNumber(prospectingRows.length),
        helper: "Familles à compléter ou à ouvrir",
      },
    ];
  }, [
    coverage.byCategory,
    coverage.visibleVendorIds.size,
    familyRows,
    loading,
    prospectingRows.length,
    visibleVendorRows.length,
  ]);

  return (
    <StatisticsShell
      title="Offre & catégories"
      subtitle="Vue métier des familles de vendeurs déduites des produits visibles, des types déjà disponibles et des manques à couvrir pour le démarchage."
    >
      <StatisticsKpiGrid items={kpis} />

      {error ? <div className="statisticsPage__empty">{error}</div> : null}

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Familles de vendeurs observées"
          subtitle="Lecture par grande famille de catalogue pour savoir où l’offre est réellement présente."
        >
          <StatisticsTable
            columns={[
              { key: "famille", label: "Famille vendeur" },
              { key: "vendeurs", label: "Vendeurs" },
              { key: "types", label: "Types couverts" },
              { key: "produits", label: "Produits visibles" },
              { key: "lecture", label: "Lecture" },
            ]}
            rows={loading ? [] : familyRows}
            emptyText={loading ? "Chargement..." : "Aucune donnée catalogue trouvée."}
          />
        </StatisticsSection>

        <StatisticsSection
          title="Profils de vendeurs à démarcher"
          subtitle="Recommandations de prospection pour ouvrir les familles absentes ou renforcer les familles trop faibles."
        >
          <StatisticsTable
            columns={[
              { key: "famille", label: "Famille à couvrir" },
              { key: "situation", label: "Situation" },
              { key: "vendeurs", label: "Vendeurs actuels" },
              { key: "types_manquants", label: "Types manquants" },
              { key: "action", label: "Action recommandée" },
            ]}
            rows={loading ? [] : prospectingRows}
            emptyText={loading ? "Chargement..." : "Aucun besoin de prospection détecté."}
          />
        </StatisticsSection>
      </div>

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Types de produits déjà disponibles"
          subtitle="Les sous-catégories les mieux remplies parmi les produits vendeurs visibles."
        >
          <StatisticsTable
            columns={[
              { key: "type", label: "Type de produit" },
              { key: "famille", label: "Famille" },
              { key: "vendeurs", label: "Vendeurs" },
              { key: "produits", label: "Produits" },
              { key: "lecture", label: "Lecture" },
            ]}
            rows={loading ? [] : availableTypeRows}
            emptyText={loading ? "Chargement..." : "Aucun type de produit visible."}
          />
        </StatisticsSection>

        <StatisticsSection
          title="Trous de catalogue à combler"
          subtitle="Sous-catégories absentes ou encore trop faibles pour une offre solide."
        >
          <StatisticsTable
            columns={[
              { key: "type", label: "Type de produit" },
              { key: "famille", label: "Famille vendeur" },
              { key: "situation", label: "Situation" },
              { key: "offre", label: "Offre actuelle" },
              { key: "recommandation", label: "Recommandation" },
            ]}
            rows={loading ? [] : gapRows}
            emptyText={loading ? "Chargement..." : "Aucun trou de catalogue identifié."}
          />
        </StatisticsSection>
      </div>

      <div className="statisticsPage__grid">
        <StatisticsSection
          title="Boutiques par zone"
          subtitle="Regroupement géographique des boutiques selon la ville ou l’adresse disponible dans leurs données."
        >
          <StatisticsTable
            columns={[
              { key: "secteur", label: "Zone / ville" },
              { key: "boutiques", label: "Boutiques" },
              { key: "produits", label: "Produits visibles" },
              { key: "profils", label: "Boutiques repères" },
              { key: "lecture", label: "Lecture" },
            ]}
            rows={loading ? [] : sectorStoreRows}
            emptyText={loading ? "Chargement..." : "Aucune boutique classée par zone."}
          />
        </StatisticsSection>

        <StatisticsSection
          title="Classement des boutiques"
          subtitle="Lecture individuelle des boutiques avec leur zone géographique et leur adresse connue."
        >
          <StatisticsTable
            columns={[
              { key: "boutique", label: "Boutique" },
              { key: "adresse", label: "Adresse" },
              { key: "secteur", label: "Zone / ville" },
              { key: "types", label: "Types" },
              { key: "produits", label: "Produits" },
              { key: "lecture", label: "Profil" },
            ]}
            rows={loading ? [] : vendorBySectorRows}
            emptyText={loading ? "Chargement..." : "Aucune boutique disponible."}
          />
        </StatisticsSection>
      </div>
    </StatisticsShell>
  );
};

export default StatisticsCatalog;
