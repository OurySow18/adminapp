import "./ListOrder.scss";
import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useParams } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";

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

const ListOrder = ({ typeColumns, title }) => {
  const [data, setData] = useState([]);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");

  const params = useParams();
  //console.log(params)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        const list = [];
        snapshot.docs.forEach((doc) => {
          const orderData = doc.data();
          if (!orderData.payed) {
            list.push({ id: doc.id, ...orderData });
          }
        });
        list.sort((a, b) => (b.timeStamp || 0) - (a.timeStamp || 0));
        setData(list);
      },
      (error) => {
        console.log("Error fetching data: ", error);
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return data;
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
  }, [data, normalizedSearch]);

  const actionColumn = [
    {
      field: "action",
      headername: "Action",
      width: 200,
      renderCell: (params) => {
        return (
          <div className="cellAction">
            <Link
              to={{ pathname: params.id }}
              style={{ textDecoration: "none" }}
            >
              <div className="viewButton">Details</div>
            </Link>
          </div>
        );
      },
    },
  ];

  const columns = useMemo(
    () => typeColumns.concat(actionColumn),
    [typeColumns]
  );

  return (
    <div className="listOrder">
      <div className="listOrder__header">
        <div className="listOrderTitel">
          Nombre de Commandes: {filteredRows.length}
        </div>
        <input
          type="search"
          className="listOrder__searchInput"
          placeholder="Rechercher une commande..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>
      <div className="listOrder__gridWrapper">
        <DataGrid
          className="datagrid"
          rows={filteredRows}
          columns={columns}
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

export default ListOrder;
