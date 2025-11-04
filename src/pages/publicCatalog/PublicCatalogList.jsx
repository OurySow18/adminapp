import "../vendorProducts/vendorProductsList.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { DataGrid } from "@mui/x-data-grid";
import { Link } from "react-router-dom";
import { vendorProductColumns } from "../../datatablesource";
import { loadPublicCatalogRows } from "../../utils/vendorProductsRepository";

const PublicCatalogList = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(25);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dataset = await loadPublicCatalogRows();
      setRows(dataset);
    } catch (err) {
      console.error("Failed to load public catalog products:", err);
      setError("Impossible de charger le catalogue publique.");
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

  return (
    <div className="vendorProducts publicCatalog">
      <Sidebar />
      <div className="vendorProducts__container">
        <Navbar />
        <div className="vendorProducts__header">
          <div>
            <h1>Catalogue publique</h1>
            <p>
              Catalogue issu de la collection Firestore{" "}
              <code>products_public</code>. {rows.length} element(s) trouves.
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
          <div className="vendorProducts__gridWrapper">
            <DataGrid
              className="vendorProducts__datagrid"
              rows={rows}
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

export default PublicCatalogList;
