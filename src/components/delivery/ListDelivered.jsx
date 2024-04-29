import "./ListDelivered.scss";
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useParams } from "react-router-dom"; // Importez le composant Link depuis React Router 
import { DataGrid } from "@mui/x-data-grid";

const ListDelivered = ({ typeColumns }) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0); 
  
  const params = useParams();
  //console.log(params) 

  // Récupère les données de Firestore et met à jour l'état local
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      let list = [];
      snapshot.docs.forEach((doc) => {
        const orderData = doc.data();
        // Vérifie si la commande n'est pas payée avant de l'ajouter à la liste
        if (orderData.payed && !orderData.delivered) {
          list.push({ id: doc.id, ...orderData });
        }
      });
      // Triez les données par date décroissante
      list.sort((a, b) => b.timeStamp - a.timeStamp);
      setData(list);
      setCount(list.length);
    }, (error) => {
      console.log("Error fetching data: ", error);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

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
  
  return ( 
        <div className="listOrder">
        <div className="listOrderTitel">
          Nombre de Livraisons a effectuées: {count} 
        </div>
        <DataGrid
          className="datagrid"
          rows={data}
          columns={typeColumns.concat(actionColumn)}
          pageSize={9}
          rowsPerPageOptions={[9]}
          checkboxSelection
        />
      </div>
  );
};

export default ListDelivered;
