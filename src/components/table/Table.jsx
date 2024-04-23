import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom"; // Importez le composant Link depuis React Router
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { format } from "date-fns";

const List = () => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);

  // Récupère les données de Firestore et met à jour l'état local
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      let list = [];
      snapshot.docs.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
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

  return (
    <TableContainer component={Paper} className="table">
      <Table sx={{ minWidth: 700 }} aria-label="customized table">
        <TableHead>
          <TableRow>
            <TableCell className="tableCell">Commande ID</TableCell>
            <TableCell className="tableCell">Nom du récepteur</TableCell>
            <TableCell className="tableCell">Adresse</TableCell>
            <TableCell className="tableCell">Date et Heure</TableCell>
            <TableCell className="tableCell">Total</TableCell>
            <TableCell className="tableCell">Méthode de Paiement</TableCell>
            <TableCell className="tableCell">Statut</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id} component={Link} to={`/order/${row.id}`}>
              <TableCell className="tableCell">{row.orderId}</TableCell>
              <TableCell className="tableCell">
                <div className="cellWrapper">
                  {/* Si vous avez un champ img dans vos données, vous pouvez l'utiliser */}
                  {/* <img src={row.img} alt="" className="image" /> */}
                  {row.deliverInfos.recipientName}
                </div>
              </TableCell>
              <TableCell className="tableCell">{row.deliverInfos.adresse}</TableCell>
              <TableCell className="tableCell">
                {/* Assurez-vous que row.timeStamp est un objet Timestamp valide */}
                {row.timeStamp && format(row.timeStamp.toDate(), 'dd/MM/yyyy HH:mm:ss')}
              </TableCell>       
              <TableCell className="tableCell">{row.total}</TableCell>
              <TableCell className="tableCell">{row.payementMethode}</TableCell>
              <TableCell className="tableCell">
                <span className={`status ${row.delivered ? 'delivered' : 'pending'}`}>
                  {row.delivered ? "Livré" : "En attente"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default List;
