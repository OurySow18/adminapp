import { format } from "date-fns";
import {
  resolveVendorStatus,
  getVendorStatusLabel,
} from "./utils/vendorStatus";
const toDate = (value) => {
  if (!value) return undefined;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (
    typeof value === "object" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6));
  }
  return undefined;
};

const formatDate = (timestamp) => {
  const date = toDate(timestamp);
  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }
  return format(date, "dd/MM/yyyy HH:mm:ss");
};

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "-";
};

const boolLabel = (value, yesLabel = "Oui", noLabel = "Non") => {
  if (value === true) return yesLabel;
  if (value === false) return noLabel;
  return "-";
};

const getVendorProfile = (row) => row.profile || row.vendor || row || {};

const getVendorCompany = (row) => {
  const profile = getVendorProfile(row);
  return profile.company || row.company || {};
};

/*const getVendorLegal = (row) => {
  const profile = getVendorProfile(row);
  return profile.legal || row.legal || {};
};

const getVendorBankInfo = (row) => {
  const profile = getVendorProfile(row);
  return profile.bank || row.bank || {};
};

const getVendorFoodInfo = (row) => {
  const profile = getVendorProfile(row);
  return profile.food || row.food || {};
};

const getVendorConsent = (row) => {
  const profile = getVendorProfile(row);
  return profile.consent || row.consent || {};
};

const getVendorDocsRequiredFlag = (row) => {
  const profile = getVendorProfile(row);
  if (profile.docsRequired !== undefined) return profile.docsRequired;
  if (row.docsRequired !== undefined) return row.docsRequired;
  const requiredDocs = getVendorRequiredDocs(row);
  return requiredDocs.length > 0 ? true : undefined;
};
const getVendorRequiredDocs = (row) => {
  const profile = getVendorProfile(row);
  if (Array.isArray(profile.requiredDocs)) return profile.requiredDocs;
  if (Array.isArray(row.requiredDocs)) return row.requiredDocs;
  return [];
};
*/
const getVendorOpsInfo = (row) => {
  const profile = getVendorProfile(row);
  return profile.ops || row.ops || {};
};

const getVendorTimestamp = (row, key) => {
  const profile = getVendorProfile(row);
  return (
    profile?.[key] ??
    row?.[key] ??
    (key === "submittedAt"
      ? profile?.createdAt ?? row?.createdAt ?? row?.timeStamp
      : undefined)
  );
};

const getVendorActiveFlag = (row) => {
  const profile = getVendorProfile(row);
  if (typeof row?.active === "boolean") return row.active;
  if (typeof row?.isActive === "boolean") return row.isActive;
  if (typeof profile?.active === "boolean") return profile.active;
  if (typeof profile?.isActive === "boolean") return profile.isActive;
  if (typeof row?.core?.active === "boolean") return row.core.active;
  if (typeof row?.core?.isActive === "boolean") return row.core.isActive;
  if (typeof row?.draft?.core?.active === "boolean") return row.draft.core.active;
  if (typeof row?.draft?.core?.isActive === "boolean") return row.draft.core.isActive;
  if (typeof row?.blocked === "boolean") return !row.blocked;
  if (typeof profile?.blocked === "boolean") return !profile.blocked;
  if (typeof row?.core?.blocked === "boolean") return !row.core.blocked;
  if (typeof row?.draft?.core?.blocked === "boolean") return !row.draft.core.blocked;
  return undefined;
};

const getVendorLockCatalogFlag = (row) => {
  const profile = getVendorProfile(row);
  if (typeof row?.lockCatalog === "boolean") return row.lockCatalog;
  if (typeof profile?.lockCatalog === "boolean") return profile.lockCatalog;
  if (typeof row?.core?.lockCatalog === "boolean") return row.core.lockCatalog;
  if (typeof row?.draft?.core?.lockCatalog === "boolean") return row.draft.core.lockCatalog;
  return undefined;
};

const getProductTitle = (row) =>
  firstValue(
    row.title,
    row.name,
    row.product,
    row.core?.title,
    row.draft?.core?.title
  );

const getProductActiveFlag = (row) => {
  if (
    typeof row?.mmStatus === "boolean" &&
    typeof row?.vmStatus === "boolean"
  ) {
    return row.mmStatus && row.vmStatus;
  }
  if (typeof row?.publicActive === "boolean") {
    return row.publicActive;
  }
  const candidates = [
    row.active,
    row.isActive,
    row.core?.active,
    row.core?.isActive,
    row.draft?.core?.active,
    row.draft?.core?.isActive,
  ];
  for (const value of candidates) {
    if (typeof value === "boolean") return value;
  }
  if (typeof row?.blocked === "boolean") return !row.blocked;
  if (typeof row?.core?.blocked === "boolean") return !row.core.blocked;
  if (typeof row?.draft?.core?.blocked === "boolean")
    return !row.draft.core.blocked;
  return undefined;
};

const getProductBlockedReason = (row) =>
  firstValue(
    row.blockedReason,
    row.core?.blockedReason,
    row.draft?.core?.blockedReason
  );

const getProductPrice = (row) =>
  firstValue(
    row.price,
    row.pricing?.basePrice,
    row.core?.pricing?.basePrice,
    row.draft?.core?.pricing?.basePrice
  );

const getProductCurrency = (row) =>
  firstValue(
    row.pricing?.currency,
    row.core?.pricing?.currency,
    row.draft?.core?.pricing?.currency
  );

const getProductStock = (row) =>
  firstValue(
    row.stock,
    row.inventory?.stock,
    row.core?.inventory?.stock,
    row.draft?.core?.inventory?.stock
  );

const getProductUpdatedAt = (row) =>
  firstValue(
    row.updatedAt,
    row.core?.updatedAt,
    row.draft?.core?.updatedAt,
    row.timeStamp,
    row.createdAt,
    row.draft?.updatedAt
  );

const getProductCover = (row) =>
  firstValue(
    row.cover,
    row.img,
    row.image,
    Array.isArray(row.images) ? row.images[0] : undefined,
    row.media?.cover,
    row.core?.media?.cover,
    row.draft?.core?.media?.cover
  );

export const userColumns = [
  { field: "id", headerName: "ID", width: 70 },
  {
    field: "surname",
    headerName: "Nom",
    width: 190,
  },
  {
    field: "email",
    headerName: "Email",
    width: 230,
  },
  {
    field: "signInMethod",
    headerName: "Connexion",
    width: 100,
  },
  {
    field: "timeStamp",
    headerName: "Date & Heure",
    width: 180,
    valueGetter: (params) => formatDate(params.row.timeStamp),
  },
  {
    field: "adresse",
    headerName: "Adresse",
    width: 250,
  },
  {
    field: "category",
    headerName: "Category",
    width: 100,
  },
  {
    field: "status",
    headerName: "Status",
    width: 160,
  },
];

export const vendorColumns = [
  { field: "id", headerName: "ID", width: 90 },
  {
    field: "companyName",
    headerName: "Entreprise",
    width: 220,
    valueGetter: (params) => {
      const company = getVendorCompany(params.row);
      return firstValue(
        company.name,
        params.row.companyName,
        params.row.name,
        params.row.displayName
      );
    },
  },
  {
    field: "representative",
    headerName: "Représentant",
    width: 190,
    valueGetter: (params) => {
      const company = getVendorCompany(params.row);
      return firstValue(
        company.representative,
        params.row.repName,
        params.row.companyRepresentative
      );
    },
  },
  {
    field: "contactEmail",
    headerName: "Email",
    width: 230,
    valueGetter: (params) => {
      const company = getVendorCompany(params.row);
      return firstValue(
        company.email,
        params.row.email,
        params.row.contactEmail,
        params.row.profile?.email
      );
    },
  },
  {
    field: "phone",
    headerName: "Téléphone",
    width: 160,
    valueGetter: (params) => {
      const company = getVendorCompany(params.row);
      return firstValue(
        company.phone,
        params.row.phone,
        params.row.contactPhone
      );
    },
  }, 
  {
    field: "address",
    headerName: "Adresse",
    width: 220,
    valueGetter: (params) => {
      const company = getVendorCompany(params.row);
      return firstValue(
        company.address,
        params.row.address,
        params.row.streetAddress,
        params.row.companyAddress
      );
    },
  }, 
  {
    field: "status",
    headerName: "Statut",
    width: 120,
    valueGetter: (params) =>
      getVendorStatusLabel(resolveVendorStatus(params.row, "draft")),
  },  
  {
    field: "active",
    headerName: "Actif",
    width: 100,
    valueGetter: (params) =>
      boolLabel(getVendorActiveFlag(params.row), "Oui", "Non"),
  },
  {
    field: "lockCatalog",
    headerName: "Catalogue",
    width: 120,
    valueGetter: (params) => {
      const locked = getVendorLockCatalogFlag(params.row);
      if (locked === undefined) return "-";
      return locked ? "Verrouille" : "Ouvert";
    },
  },
  {
    field: "productTypes",
    headerName: "Types produits",
    width: 200,
    valueGetter: (params) => {
      const ops = getVendorOpsInfo(params.row);
      return firstValue(ops.productTypes, params.row.productTypes);
    },
  }, 
  {
    field: "submittedAt",
    headerName: "Soumis le",
    width: 180,
    valueGetter: (params) =>
      formatDate(getVendorTimestamp(params.row, "submittedAt")),
  }, 
];

export const productColumns = [
  { field: "product_id", headerName: "ID", width: 100 },
  {
    field: "product",
    headerName: "Product",
    width: 100,
    renderCell: (params) => {
      const row = params.row || {};
      const cover =
        row.img ||
        row.image ||
        row.images?.[0] ||
        row.media?.cover ||
        row.core?.media?.cover ||
        row.draft?.core?.media?.cover ||
        "/default-image.png"; 
      return (
        <div className="cellWithImg">
          <img className="cellImg" src={cover} alt="product" />
           
        </div>
      );
    },
  },
  {
    field: "name",
    headerName: "Name",
    width: 230,
    valueGetter: (params) =>
      firstValue(
        params.row.name,
        params.row.title,
        params.row.core?.title,
        params.row.draft?.core?.title,
        params.row.product
      ),
  },
  {
    field: "description",
    headerName: "Description",
    width: 230,
  },
  {
    field: "category",
    headerName: "Category",
    width: 100,
  },
  {
    field: "price",
    headerName: "Prix Detail",
    width: 100,
    valueGetter: (params) =>
      firstValue(
        params.row.price,
        params.row.pricing?.basePrice,
        params.row.core?.pricing?.basePrice,
        params.row.draft?.core?.pricing?.basePrice
      ),
  },
  {
    field: "priceWholesale",
    headerName: "Prix en Gros",
    width: 100,
  },
  {
    field: "status",
    headerName: "Status",
    width: 160,
    valueGetter: (params) =>
      firstValue(
        params.row.status,
        params.row.core?.status,
        params.row.draft?.core?.status
      ),
  },
];

export const vendorProductColumns = [
  {
    field: "cover",
    headerName: "Image",
    minWidth: 96,
    maxWidth: 110,
    flex: 0.3,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    renderCell: (params) => {
      const cover = getProductCover(params.row) || "/default-image.png";
      return (
        <div className="cellWithImg cellWithImg--product">
          <img className="cellImg" src={cover} alt="cover" />
        </div>
      );
    },
  },
  {
    field: "title",
    headerName: "Produit",
    flex: 1.2,
    minWidth: 200,
    valueGetter: (params) => getProductTitle(params.row),
  },
  {
    field: "vendorName",
    headerName: "Vendeur",
    flex: 0.7,
    minWidth: 160,
    valueGetter: (params) =>
      firstValue(
        params.row.vendorName,
        params.row.vendorDisplayId,
        params.row.vendorId,
        params.row.core?.vendorId,
        params.row.draft?.core?.vendorId,
        "-"
      ),
  },
  {
    field: "visibility",
    headerName: "Visibilité",
    flex: 0.7,
    minWidth: 170,
    valueGetter: (params) => {
      const { mmStatus, vmStatus } = params.row;
      if (mmStatus && vmStatus) {
        return "Visible sur Monmarché";
      }
      if (mmStatus === false) return "Masqué par l'admin";
      if (vmStatus === false) return "Désactivé vendeur";
      return "-";
    },
  },
  {
    field: "mmStatus",
    headerName: "Admin",
    flex: 0.4,
    minWidth: 130,
    valueGetter: (params) =>
      boolLabel(params.row.mmStatus, "Actif", "Inactif"),
  },
  {
    field: "vmStatus",
    headerName: "Vendeur",
    flex: 0.5,
    minWidth: 140,
    valueGetter: (params) =>
      boolLabel(params.row.vmStatus, "Actif", "Inactif"),
  },
  {
    field: "draftStatus",
    headerName: "Modifs",
    flex: 0.5,
    minWidth: 130,
    valueGetter: (params) => {
      const pendingChanges =
        Array.isArray(params.row.draftChanges) &&
        params.row.draftChanges.length > 0;
      if (!pendingChanges) return "-";
      return `${params.row.draftChanges.length} champ(s)`;
    },
  },
  {
    field: "price",
    headerName: "Prix",
    flex: 0.6,
    minWidth: 140,
    valueGetter: (params) => {
      const price = getProductPrice(params.row);
      if (price === undefined || price === null) return "-";
      const numericPrice = Number(price);
      const safePrice = Number.isNaN(numericPrice) ? price : numericPrice;
      const baseCurrency = getProductCurrency(params.row);
      const resolvedCurrency =
        typeof baseCurrency === "string" && baseCurrency.trim() && baseCurrency !== "-"
          ? baseCurrency
          : "GNF";
      if (typeof safePrice === "number") {
        const formatter = new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: resolvedCurrency,
          currencyDisplay: "code",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        return formatter.format(safePrice);
      }
      return `${safePrice} ${resolvedCurrency}`;
    },
  },
  {
    field: "stock",
    headerName: "Stock",
    flex: 0.4,
    minWidth: 110,
    valueGetter: (params) => {
      const stock = getProductStock(params.row);
      return stock === undefined || stock === null ? "-" : stock;
    },
  },
  {
    field: "blockedReason",
    headerName: "Motif blocage",
    flex: 0.9,
    minWidth: 220,
    valueGetter: (params) => getProductBlockedReason(params.row) ?? "-",
  },
  {
    field: "updatedAt",
    headerName: "MAJ",
    flex: 0.7,
    minWidth: 180,
    valueGetter: (params) => formatDate(getProductUpdatedAt(params.row)),
  },
];

export const zonesColumns = [
  { field: "id", headerName: "ID", width: 270 },
  {
    field: "zoneName",
    headerName: "Zones",
    width: 100,
  },
  {
    field: "priceZoneMinimum",
    headerName: "Prix minimum",
    width: 230,
  },
  {
    field: "priceZoneMaximum",
    headerName: "Prix maximum",
    width: 230,
  },
  {
    field: "createdAt",
    headerName: "Creation",
    width: 100,
  },
  {
    field: "updatedAt",
    headerName: "Modification",
    width: 100,
  },
  {
    field: "status",
    headerName: "Status",
    width: 160,
  },
];

export const orderColumns = [
  { field: "orderId", headerName: "ID", width: 90 },
  {
    field: "mail_invoice",
    headerName: "Email",
    width: 300,
  },
  {
    field: "deliverInfos.recipientName",
    headerName: "Nom du recepteur",
    width: 230,
    valueGetter: (params) => params.row.deliverInfos?.name,
  },
  {
    field: "deliverInfos.adresse",
    headerName: "Adresse de livraison",
    width: 200,
    valueGetter: (params) => params.row.deliverInfos?.address,
  },
  {
    field: "deliverInfos.phone",
    headerName: "Telephone",
    width: 100,
    valueGetter: (params) => params.row.deliverInfos?.phone,
  },
  {
    field: "timeStamp",
    headerName: "Date & Heure",
    width: 180,
    valueGetter: (params) => formatDate(params.row.timeStamp),
  },
  {
    field: "paymentType",
    headerName: "Type de Payement",
    width: 150,
  },
  {
    field: "total",
    headerName: "Total",
    width: 150,
  },
];
