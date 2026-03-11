import "./listDeliveryOrder.scss";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom"; // Importez le composant Link depuis React Router 
import { DataGrid } from "@mui/x-data-grid";

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

const ListDeliveryOrder = ({ typeColumns }) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0); 
  const [pageSize, setPageSize] = useState(9);
   
  // Récupère les données de Firestore et met à jour l'état local
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "archivedOrders"), (snapshot) => {
      let list = [];
      snapshot.docs.forEach((doc) => {
        const orderData = doc.data();
        // Vérifie si la commande n'est pas payée avant de l'ajouter à la liste
        if (orderData.payed && orderData.delivered) {
          list.push({
            ...orderData,
            id: doc.id,
            __docId: doc.id,
          });
        }
      });
      // Triez les données par date décroissante
      list.sort((a, b) => toTimeNumber(b.timeStamp) - toTimeNumber(a.timeStamp));
      setData(list);
      setCount(list.length);
    }, (error) => {
      console.log("Error fetching data: ", error);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

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
	        <div className="listOrderTitel">
	          Nombre de Commandes archivées: {count} 
	        </div>
          <div className="listOrder__gridWrapper">
            <DataGrid
              className="datagrid"
              rows={data}
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

export default ListDeliveryOrder;
