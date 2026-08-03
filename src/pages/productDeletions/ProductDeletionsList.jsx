import "./productDeletionsList.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import { db, functions } from "../../firebase";

const permanentlyDeleteVendorProduct = httpsCallable(
  functions,
  "permanentlyDeleteVendorProduct"
);

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const formatDate = (value) => {
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("fr-FR")
    : "—";
};

const ProductDeletionsList = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pageSize, setPageSize] = useState(25);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const productSnapshot = await getDocs(
        query(collection(db, "vendor_products"), where("deletionStatus", "==", "pending"))
      );
      const candidates = productSnapshot.docs
        .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
        .filter((product) => product.deletionRequestId);

      const requestEntries = await Promise.all(
        candidates.map(async (product) => {
          const requestSnapshot = await getDoc(
            doc(db, "product_change_requests", String(product.deletionRequestId))
          );
          return [product.id, requestSnapshot];
        })
      );
      const requestsByProduct = new Map(requestEntries);
      const validProducts = candidates.filter((product) => {
        const requestData = requestsByProduct.get(product.id)?.data();
        const linkedProductId = firstValue(
          requestData?.productId,
          requestData?.vendorProductId,
          requestData?.entityId
        );
        return (
          requestData?.type === "delete" &&
          requestData?.status === "pending" &&
          (!linkedProductId || linkedProductId === product.id)
        );
      });

      const vendorIds = Array.from(
        new Set(
          validProducts
            .map((product) =>
              firstValue(
                product.vendorId,
                product.core?.vendorId,
                product.draft?.core?.vendorId,
                product.vendor?.id
              )
            )
            .filter(Boolean)
            .map(String)
        )
      );
      const vendorEntries = await Promise.all(
        vendorIds.map(async (vendorId) => [vendorId, await getDoc(doc(db, "vendors", vendorId))])
      );
      const vendors = new Map(vendorEntries.map(([id, snap]) => [id, snap.data() || {}]));

      setRows(
        validProducts.map((product) => {
          const vendorId = String(
            firstValue(
              product.vendorId,
              product.core?.vendorId,
              product.draft?.core?.vendorId,
              product.vendor?.id,
              ""
            )
          );
          const vendor = vendors.get(vendorId) || {};
          const requestData = requestsByProduct.get(product.id)?.data() || {};
          return {
            ...product,
            id: product.id,
            productTitle: firstValue(product.title, product.name, product.core?.title, "Sans titre"),
            image: firstValue(
              product.image,
              product.img,
              product.images?.[0],
              product.media?.cover,
              product.core?.media?.cover
            ),
            vendorId,
            vendorName: firstValue(
              vendor.displayName,
              vendor.company?.name,
              vendor.name,
              product.vendorName,
              product.vendor?.name,
              "Vendeur inconnu"
            ),
            vendorEmail: firstValue(vendor.email, vendor.profile?.email, product.vendor?.email, "—"),
            requestedAt: firstValue(requestData.createdAt, requestData.requestedAt, product.updatedAt),
          };
        })
      );
    } catch (loadError) {
      console.error("Unable to load product deletion requests:", loadError);
      setRows([]);
      setError("Impossible de charger les produits à supprimer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const columns = useMemo(
    () => [
      {
        field: "image",
        headerName: "Produit",
        width: 90,
        sortable: false,
        renderCell: ({ row }) =>
          row.image ? <img className="productDeletions__image" src={row.image} alt="" /> : "—",
      },
      { field: "productTitle", headerName: "Nom", minWidth: 220, flex: 1 },
      { field: "id", headerName: "ID produit", minWidth: 190, flex: 0.8 },
      { field: "vendorName", headerName: "Vendeur", minWidth: 190, flex: 0.8 },
      { field: "vendorEmail", headerName: "Contact vendeur", minWidth: 220, flex: 0.9 },
      {
        field: "requestedAt",
        headerName: "Demandé le",
        width: 170,
        valueGetter: ({ row }) => formatDate(row.requestedAt),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 210,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <button
            type="button"
            className="productDeletions__deleteButton"
            onClick={() => setSelected(row)}
          >
            Supprimer définitivement
          </button>
        ),
      },
    ],
    []
  );

  const confirmDeletion = async () => {
    if (!selected || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await permanentlyDeleteVendorProduct({
        productId: selected.id,
        deletionRequestId: selected.deletionRequestId,
      });
      setRows((current) => current.filter((row) => row.id !== selected.id));
      setSelected(null);
    } catch (deleteError) {
      console.error("Unable to permanently delete vendor product:", deleteError);
      setError(
        deleteError?.code === "functions/failed-precondition"
          ? "Cette demande a déjà été traitée ou n’est plus valide."
          : "La suppression définitive a échoué. Aucun traitement partiel n’a été appliqué."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="productDeletions">
      <Sidebar />
      <main className="productDeletions__container">
        <Navbar />
        <header className="productDeletions__header">
          <div>
            <h1>Produits à supprimer</h1>
            <p>{rows.length} demande(s) de suppression en attente.</p>
          </div>
          <button type="button" onClick={loadRows} disabled={loading}>
            Rafraîchir
          </button>
        </header>
        {error && <div className="productDeletions__error">{error}</div>}
        <section className="productDeletions__table">
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            rowsPerPageOptions={[10, 25, 50, 100]}
            disableSelectionOnClick
            autoHeight
            getRowHeight={() => 76}
          />
        </section>
      </main>
      <ConfirmModal
        open={Boolean(selected)}
        title="Confirmer la suppression définitive"
        onClose={() => !deleting && setSelected(null)}
        onConfirm={confirmDeletion}
        confirmText="Supprimer définitivement"
        loading={deleting}
        confirmButtonClassName="productDeletions__confirmButton"
      >
        <p>
          Le produit <strong>{selected?.productTitle}</strong> sera archivé puis retiré des
          catalogues vendeur et public. Cette action est irréversible.
        </p>
      </ConfirmModal>
    </div>
  );
};

export default ProductDeletionsList;
