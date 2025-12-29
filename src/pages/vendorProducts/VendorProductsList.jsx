import "./vendorProductsList.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { Link, Navigate, useParams } from "react-router-dom";
import { vendorProductColumns } from "../../datatablesource";
import {
  doesProductMatchFilter,
  getVendorProductFilterLabel,
  loadVendorProductRows,
  normalizeVendorProductFilterKey,
} from "../../utils/vendorProductsRepository";

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

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

const formatDateForSearch = (value) => {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
};

const MONMARCHE_VENDOR_ID = "89xYCymLLyTSGeAw1oZvNcHLIFO2";
const MONMARCHE_NAME = "monmarché";

const isValidVendorId = (value) => {
  if (value === undefined || value === null || value === "") return false;
  const normalized = String(value).trim();
  if (!normalized) return false;
  return normalized !== "_" && normalized !== "root";
};

const resolveRowVendorId = (row) => {
  const candidates = [
    row.vendorId,
    row.raw?.vendorId,
    row.raw?.core?.vendorId,
    row.raw?.draft?.core?.vendorId,
    row.vendorDisplayId,
  ];
  for (const candidate of candidates) {
    if (isValidVendorId(candidate)) return candidate;
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
    row.vendorDisplayId
  );

const isMonmarcheRow = (row) => {
  const vendorId = resolveRowVendorId(row);
  if (vendorId === MONMARCHE_VENDOR_ID) return true;
  if (row?.vendorDisplayId === MONMARCHE_VENDOR_ID) return true;
  if (
    typeof row?.docPath === "string" &&
    row.docPath.includes(MONMARCHE_VENDOR_ID)
  ) {
    return true;
  }
  const vendorName = normalizeLabel(resolveRowVendorName(row));
  return vendorName.includes(MONMARCHE_NAME);
};

const VendorProductsList = ({ scope = "vendors" }) => {
  const { statusId } = useParams();

  const normalizedStatus = useMemo(() => {
    if (!statusId) return null;
    return normalizeVendorProductFilterKey(statusId);
  }, [statusId]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");

  const scopeFilteredRows = useMemo(() => {
    if (scope === "monmarche") {
      return rows.filter((row) => isMonmarcheRow(row));
    }
    if (scope === "vendors") {
      return rows.filter((row) => !isMonmarcheRow(row));
    }
    return rows;
  }, [rows, scope]);

  const statusFilteredRows = useMemo(() => {
    if (!normalizedStatus) return scopeFilteredRows;
    return scopeFilteredRows.filter((row) =>
      doesProductMatchFilter(row, normalizedStatus)
    );
  }, [scopeFilteredRows, normalizedStatus]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const displayedRows = useMemo(() => {
    if (!normalizedSearch) return statusFilteredRows;
    return statusFilteredRows.filter((row) => {
      const categoryId = firstValue(
        row.categoryId,
        row.raw?.categoryId,
        row.raw?.core?.categoryId,
        row.raw?.draft?.core?.categoryId
      );
      const createdAt = formatDateForSearch(
        firstValue(
          row.raw?.createdAt,
          row.raw?.core?.createdAt,
          row.raw?.draft?.core?.createdAt,
          row.timeStamp,
          row.createdAt,
          row.updatedAt
        )
      );
      const candidates = [
        row.title,
        row.productId,
        row.vendorName,
        row.vendorDisplayId,
        row.vendorId,
        categoryId,
        row.statusLabel,
        createdAt,
      ];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [statusFilteredRows, normalizedSearch]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dataset = await loadVendorProductRows();
      setRows(dataset);
    } catch (err) {
      console.error("Failed to load vendor products:", err);
      setError(
        scope === "monmarche"
          ? "Impossible de charger les produits Monmarché."
          : "Impossible de charger les produits vendeurs."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const shouldRedirect = Boolean(statusId && !normalizedStatus);

  const columns = useMemo(() => {
    const actionColumn = {
      field: "actions",
      headerName: "Actions",
      minWidth: 140,
      flex: 0.4,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const row = params.row;
        const vendorId = encodeURIComponent(row.vendorId || "_");
        const productId = encodeURIComponent(row.productId || row.id);
        const monmarcheDocPath =
          scope === "monmarche" ? `products/${productId}` : null;
        return (
          <div className="vendorProducts__actionsCell">
            <Link
              to={
                scope === "monmarche"
                  ? `/vendor-products/_/${productId}`
                  : `/vendor-products/${vendorId}/${productId}`
              }
              state={
                scope === "monmarche"
                  ? { source: "products", docPath: monmarcheDocPath }
                  : { source: row.source, docPath: row.docPath }
              }
              className="vendorProducts__actionsLink"
            >
              Voir
            </Link>
          </div>
        );
      },
    };
    return vendorProductColumns.concat(actionColumn);
  }, [scope]);

  if (shouldRedirect) {
    return <Navigate to="/vendor-products" replace />;
  }

  const statusLabel = normalizedStatus
    ? getVendorProductFilterLabel(normalizedStatus)
    : null;
  const baseTitle =
    scope === "monmarche" ? "Produits Monmarché" : "Produits vendeurs";
  const descriptionText =
    scope === "monmarche"
      ? "Catalogue Monmarché issu de la collection products."
      : "Gestion des articles issus du catalogue vendeur.";

  return (
    <div className="vendorProducts">
      <Sidebar />
      <div className="vendorProducts__container">
        <Navbar />
        <div className="vendorProducts__header">
          <div>
            <h1>
              {statusLabel ? `${baseTitle} - ${statusLabel}` : baseTitle}
            </h1>
            <p>
              {descriptionText}{" "}
              {displayedRows.length} élément(s) affiché(s).
            </p>
          </div>
          <div className="vendorProducts__actions">
            <input
              type="search"
              className="vendorProducts__searchInput"
              placeholder="Rechercher par produit, vendeur, catégorie, date..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button
              type="button"
              className="vendorProducts__refresh"
              onClick={loadProducts}
              disabled={loading}
            >
              Rafraichir
            </button>
          </div>
        </div>
        {error && (
          <div className="vendorProducts__error">
            <span>{error}</span>
          </div>
        )}
        <div className="vendorProducts__table">
          <div className="vendorProducts__gridWrapper">
            <DataGrid
              className="vendorProducts__datagrid"
              rows={displayedRows}
              columns={columns}
              pageSize={pageSize}
              onPageSizeChange={(size) => setPageSize(size)}
              rowsPerPageOptions={[10, 25, 50, 100]}
              loading={loading}
              disableSelectionOnClick
              autoHeight
              getRowHeight={() => 80}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorProductsList;
