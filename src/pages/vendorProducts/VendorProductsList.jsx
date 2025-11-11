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

const VendorProductsList = () => {
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

  const statusFilteredRows = useMemo(() => {
    if (!normalizedStatus) return rows;
    return rows.filter((row) =>
      doesProductMatchFilter(row, normalizedStatus)
    );
  }, [rows, normalizedStatus]);

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
      setError("Impossible de charger les produits vendeurs.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (shouldRedirect) {
    return <Navigate to="/vendor-products" replace />;
  }

  const statusLabel = normalizedStatus
    ? getVendorProductFilterLabel(normalizedStatus)
    : null;

  return (
    <div className="vendorProducts">
      <Sidebar />
      <div className="vendorProducts__container">
        <Navbar />
        <div className="vendorProducts__header">
          <div>
            <h1>
              {statusLabel
                ? `Produits vendeurs - ${statusLabel}`
                : "Produits vendeurs"}
            </h1>
            <p>
              Gestion des articles issus du catalogue vendeur.{" "}
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
