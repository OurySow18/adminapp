import "./OrderList.scss";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import { toTimeNumber } from "../../utils/orderDate";

const formatDateTime = (value) => {
  if (!value) return "";
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.toLocaleString("fr-FR") : "";
  }
  if (value instanceof Date) {
    return value.toLocaleString("fr-FR");
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("fr-FR");
};

// Liste de commandes generique, parametree par collection/filtre. Remplace
// les anciens ListOrder / ListDelivered / ListDeliveryOrder qui etaient
// ~90% du meme code (meme colonne d'action, meme DataGrid, meme tri) et ne
// differaient que par la collection Firestore et le filtre applique.
const OrderList = ({
  typeColumns,
  collectionName = "orders",
  whereFilters = [],
  clientFilter,
  renderCountLabel,
  showSearch = false,
}) => {
  const [data, setData] = useState([]);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");

  const whereFiltersKey = JSON.stringify(whereFilters);

  useEffect(() => {
    const constraints = whereFilters.map(([field, op, value]) =>
      where(field, op, value)
    );
    const target = constraints.length
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName);

    const unsubscribe = onSnapshot(
      target,
      (snapshot) => {
        const list = [];
        snapshot.docs.forEach((docSnap) => {
          const orderData = docSnap.data();
          if (clientFilter && !clientFilter(orderData)) return;
          list.push({
            ...orderData,
            id: docSnap.id,
            __docId: docSnap.id,
          });
        });
        list.sort(
          (a, b) => toTimeNumber(b.timeStamp) - toTimeNumber(a.timeStamp)
        );
        setData(list);
      },
      (error) => {
        console.error("Error fetching data: ", error);
      }
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, whereFiltersKey]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!showSearch || !normalizedSearch) return data;
    return data.filter((row) => {
      const receiver = row.deliverInfos ?? {};
      const candidates = [
        row.orderId,
        row.id,
        receiver.name,
        receiver.address,
        row.customerName,
        row.customerAddress,
        row.paymentMethode,
        formatDateTime(row.timeStamp),
        String(row.total ?? ""),
      ];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [data, normalizedSearch, showSearch]);

  const actionColumn = useMemo(
    () => [
      {
        field: "action",
        headerName: "Action",
        width: 200,
        renderCell: (params) => {
          const targetId = params?.row?.__docId || params.id;
          return (
            <div className="cellAction">
              <Link
                to={{ pathname: String(targetId) }}
                style={{ textDecoration: "none" }}
              >
                <div className="viewButton">Details</div>
              </Link>
            </div>
          );
        },
      },
    ],
    []
  );

  const columns = useMemo(
    () => typeColumns.concat(actionColumn),
    [typeColumns, actionColumn]
  );

  return (
    <div className="listOrder">
      <div className="listOrder__header">
        <div className="listOrderTitel">
          {renderCountLabel
            ? renderCountLabel(filteredRows.length)
            : `Nombre de Commandes: ${filteredRows.length}`}
        </div>
        {showSearch && (
          <div className="listOrder__headerControls">
            <input
              type="search"
              className="listOrder__searchInput"
              placeholder="Rechercher une commande..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        )}
      </div>
      <div className="listOrder__gridWrapper">
        <DataGrid
          className="datagrid"
          rows={filteredRows}
          columns={columns}
          pagination
          pageSize={pageSize}
          onPageSizeChange={(size) => setPageSize(size)}
          rowsPerPageOptions={[5, 9, 25]}
          checkboxSelection
          disableSelectionOnClick
          autoHeight
        />
      </div>
    </div>
  );
};

export default OrderList;
