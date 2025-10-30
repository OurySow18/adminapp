import "./vendorProductsList.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { Link, Navigate, useParams } from "react-router-dom";
import { vendorProductColumns } from "../../datatablesource";
import {
  getVendorProductStatusLabel,
  isVendorProductStatus,
  normalizeVendorProductStatus,
} from "../../utils/vendorProductStatus";
import { loadVendorProductRows } from "../../utils/vendorProductsRepository";

const VendorProductsList = () => {
  const { statusId } = useParams();

  const normalizedStatus = useMemo(() => {
    if (!statusId) return null;
    const normalized = normalizeVendorProductStatus(statusId);
    return normalized && isVendorProductStatus(normalized) ? normalized : null;
  }, [statusId]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(25);

  const filteredRows = useMemo(() => {
    if (!normalizedStatus) return rows;
    return rows.filter((row) => row.status === normalizedStatus);
  }, [rows, normalizedStatus]);

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
    ? getVendorProductStatusLabel(normalizedStatus)
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
              {filteredRows.length} element(s) trouves.
            </p>
          </div>
          <button
            type="button"
            className="vendorProducts__refresh"
            onClick={loadProducts}
            disabled={loading}
          >
            Rafraichir
          </button>
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
              rows={filteredRows}
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
