import "./gameStats.scss";
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useParams } from "react-router-dom"; // Importez le composant Link depuis React Router 
import { DataGrid } from "@mui/x-data-grid";

const GameStats = ({typeColumns}) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0); 
   
  // Récupère les données de Firestore et met à jour l'état local
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "game"), (snapshot) => {
      let list = [];
      snapshot.docs.forEach((doc) => {
        const gamers = doc.data();          
        list.push({ id: doc.id, ...gamers });
         
      });
      // Triez les données par date décroissante
      list.sort((a, b) => b.points - a.points);
      setData(list);
      setCount(list.length);
    }, (error) => {
      console.log("Error fetching data: ", error);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  console.log("Data: ", data)
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
          Nombre de Joueurs: {count} 
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

export default GameStats;
