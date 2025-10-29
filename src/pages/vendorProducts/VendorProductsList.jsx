import "./vendorProductsList.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { DataGrid } from "@mui/x-data-grid";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import { vendorProductColumns } from "../../datatablesource";
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

const createRowKey = (vendorId, productId) =>
  `${encodeURIComponent(vendorId || "_")}::${productId}`;

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const normalizeVendorProduct = (docSnap, extraMeta = {}) => {
  const data = docSnap.data() || {};
  const pathSegments = docSnap.ref.path.split("/").filter(Boolean);
  const fromPathVendor =
    pathSegments.length >= 4 && pathSegments[0] === "vendor_products"
      ? pathSegments[1]
      : undefined;

  const resolvedVendor =
    data.vendorId ??
    data.core?.vendorId ??
    data.draft?.core?.vendorId ??
    extraMeta.vendorIdFromPath ??
    fromPathVendor;
  const vendorId =
    extraMeta.source === "root"
      ? "_"
      : resolvedVendor ?? fromPathVendor ?? "_";

  const productId =
    data.core?.productId ??
    data.productId ??
    extraMeta.productId ??
    docSnap.id;

  const updatedAt =
    data.updatedAt ??
    data.core?.updatedAt ??
    data.draft?.core?.updatedAt ??
    data.timeStamp ??
    data.createdAt ??
    data.draft?.updatedAt ??
    null;

  return {
    id: createRowKey(vendorId, productId),
    vendorId,
    vendorDisplayId: resolvedVendor ?? fromPathVendor ?? "-",
    productId,
    source: extraMeta.source ?? "root",
    raw: data,
    source: extraMeta.source ?? "root",
    pathSegments,
    docPath: docSnap.ref.path,
    updatedAt,
  };
};

const mergeProductEntry = (map, entry) => {
  const existing = map.get(entry.id);
  if (!existing) {
    map.set(entry.id, entry);
    return;
  }
  if (existing.source === "root" && entry.source !== "root") {
    map.set(entry.id, entry);
    return;
  }
  if (existing.source !== "root" && entry.source !== "root") {
    const existingUpdated =
      existing.updatedAt && typeof existing.updatedAt.toMillis === "function"
        ? existing.updatedAt.toMillis()
        : null;
    const incomingUpdated =
      entry.updatedAt && typeof entry.updatedAt.toMillis === "function"
        ? entry.updatedAt.toMillis()
        : null;
    if ((incomingUpdated || 0) > (existingUpdated || 0)) {
      map.set(entry.id, entry);
    }
  }
};

const deriveRowData = (entry) => {
  const { raw, vendorId, vendorDisplayId, productId, docPath, pathSegments, updatedAt, source } = entry;
  const title =
    raw.title ??
    raw.name ??
    raw.product ??
    raw.core?.title ??
    raw.draft?.core?.title ??
    `Produit ${productId}`;

  const status =
    raw.status ?? raw.core?.status ?? raw.draft?.core?.status ?? "-";

  const activeCandidates = [
    raw.active,
    raw.isActive,
    raw.core?.active,
    raw.core?.isActive,
    raw.draft?.core?.active,
    raw.draft?.core?.isActive,
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
      raw.blocked ?? raw.core?.blocked ?? raw.draft?.core?.blocked;
    if (typeof blocked === "boolean") {
      active = !blocked;
    }
  }
  const statusLabel =
    active === false || status === "archived"
      ? "Bloqué"
      : status === "draft"
      ? "Brouillon"
      : status === "active"
      ? "Actif"
      : status;

  const price =
    raw.price ??
    raw.pricing?.basePrice ??
    raw.core?.pricing?.basePrice ??
    raw.draft?.core?.pricing?.basePrice;
  const currency =
    raw.pricing?.currency ??
    raw.core?.pricing?.currency ??
    raw.draft?.core?.pricing?.currency ??
    "";

  const stock =
    raw.stock ??
    raw.inventory?.stock ??
    raw.core?.inventory?.stock ??
    raw.draft?.core?.inventory?.stock;

  const blockedReason =
    raw.blockedReason ??
    raw.core?.blockedReason ??
    raw.draft?.core?.blockedReason ??
    "-";

  const cover =
    raw.img ||
    raw.image ||
    (Array.isArray(raw.images) ? raw.images[0] : undefined) ||
    raw.media?.cover ||
    raw.core?.media?.cover ||
    raw.draft?.core?.media?.cover ||
    "/default-image.png";

  return {
    id: entry.id,
    vendorId,
    productId,
    title,
    status,
    statusLabel,
    active,
    cover,
    price,
    currency,
    stock,
    blockedReason: blockedReason || "-",
    updatedAt,
    updatedAtLabel: formatDateTime(updatedAt),
    docPath,
    source,
    pathSegments,
    vendorDisplayId:
      vendorDisplayId ??
      firstValue(
        raw.vendorId,
        raw.core?.vendorId,
        raw.draft?.core?.vendorId,
        vendorId === "_" ? "-" : vendorId
      ),
  };
};

const VendorProductsList = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const aggregate = new Map();

      const rootSnapshot = await getDocs(collection(db, "vendor_products"));
      rootSnapshot.forEach((docSnap) => {
        const entry = normalizeVendorProduct(docSnap, {
          source: "root",
        });
        mergeProductEntry(aggregate, entry);
      });

      const vendorSnapshots = await getDocs(collectionGroup(db, "products"));
      vendorSnapshots.forEach((docSnap) => {
        const segments = docSnap.ref.path.split("/").filter(Boolean);
        const vendorIdFromPath =
          segments.length >= 4 ? segments[segments.length - 3] : undefined;
        const entry = normalizeVendorProduct(docSnap, {
          source: "nested",
          vendorIdFromPath,
        });
        mergeProductEntry(aggregate, entry);
      });

      const nextRows = Array.from(aggregate.values()).map(deriveRowData);
      nextRows.sort(
        (a, b) =>
          (b.updatedAt?.toMillis?.() ?? toTime(b.updatedAt)) -
          (a.updatedAt?.toMillis?.() ?? toTime(a.updatedAt))
      );
      setRows(nextRows);
    } catch (err) {
      console.error("Failed to load vendor products:", err);
      setError("Impossible de charger les produits vendeurs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const columns = useMemo(() => {
    const actionColumn = {
      field: "actions",
      headerName: "Actions",
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const row = params.row;
        const vendorId = encodeURIComponent(row.vendorId || "_");
        const productId = encodeURIComponent(row.productId);
        return (
          <div className="vendorProducts__actionsCell">
            <Link
              to={`/vendor-products/${vendorId}/${productId}`}
              state={{ source: row.source, docPath: row.docPath }}
              className="vendorProducts__actionsLink"
            >
              Voir
            </Link>
          </div>
        );
      },
    };
    return vendorProductColumns.concat(actionColumn);
  }, []);

  return (
    <div className="vendorProducts">
      <Sidebar />
      <div className="vendorProducts__container">
        <Navbar />
        <div className="vendorProducts__header">
          <div>
            <h1>Produits vendeurs</h1>
            <p>
              Gestion des articles issus du catalogue vendeur. {rows.length}{" "}
              élément(s) trouvés.
            </p>
          </div>
          <button
            type="button"
            className="vendorProducts__refresh"
            onClick={loadProducts}
            disabled={loading}
          >
            Rafraîchir
          </button>
        </div>
        {error && (
          <div className="vendorProducts__error">
            <span>{error}</span>
          </div>
        )}
        <div className="vendorProducts__table">
          <DataGrid
            rows={rows}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            loading={loading}
            disableSelectionOnClick
            autoHeight
          />
        </div>
      </div>
    </div>
  );
};

const toTime = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export default VendorProductsList;
