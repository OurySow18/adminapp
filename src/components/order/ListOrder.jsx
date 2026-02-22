import "./ListOrder.scss";
import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
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

const toTimeNumber = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const millis = value.seconds * 1000;
    if (typeof value.nanoseconds === "number") {
      return millis + Math.floor(value.nanoseconds / 1e6);
    }
    return millis;
  }
  return 0;
};

const ListOrder = ({ typeColumns, showFakeOrders = false }) => {
  const [data, setData] = useState([]);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        const list = [];
        snapshot.docs.forEach((doc) => {
          const orderData = doc.data();

          const isFakeOrder = orderData?.fakeOrder === true;
          const shouldInclude = showFakeOrders ? isFakeOrder : !isFakeOrder;
          if (!shouldInclude) return;

          // Vue "Commandes" garde le comportement actuel (non payées).
          if (!showFakeOrders && orderData?.payed) return;

          list.push({ id: doc.id, ...orderData });
        });
        list.sort(
          (a, b) => toTimeNumber(b.timeStamp) - toTimeNumber(a.timeStamp)
        );
        setData(list);
      },
      (error) => {
        console.log("Error fetching data: ", error);
      }
    );
    return () => {
      unsubscribe();
    };
  }, [showFakeOrders]);

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
    [typeColumns, actionColumn]
  );

  return (
    <div className="listOrder">
      <div className="listOrder__header">
        <div className="listOrderTitel">
          {showFakeOrders
            ? `Nombre de fausses commandes: ${filteredRows.length}`
            : `Nombre de Commandes: ${filteredRows.length}`}
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
