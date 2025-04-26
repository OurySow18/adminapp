import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { format } from "date-fns";

const ListCommande = ({ userId }) => {
  const [data, setData] = useState([]);
  console.log("User: ", userId)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "archivedOrders"), (snapshot) => {
      let list = [];
      snapshot.docs.forEach((doc) => {
        const order = { id: doc.id, ...doc.data() };
        // Filtrer selon l'userId
        if (order.userId === userId) {
          list.push(order);
        }
      });
      // Tri décroissant par date
      list.sort((a, b) => b.timeStamp.toDate() - a.timeStamp.toDate());
      setData(list);
    }, (error) => {
      console.log("Error fetching data: ", error);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return (
    <TableContainer component={Paper} className="table">
      <Table sx={{ minWidth: 700 }} aria-label="table des commandes">
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
            <TableRow key={row.id} component={Link} to={`/order/${row.id}`} hover>
              <TableCell className="tableCell">{row.orderId}</TableCell>
              <TableCell className="tableCell">
                <div className="cellWrapper">
                  {row.deliverInfos.name}
                </div>
              </TableCell>
              <TableCell className="tableCell">{row.deliverInfos.address}</TableCell>
              <TableCell className="tableCell">
                {row.timeStamp && format(row.timeStamp.toDate(), 'dd/MM/yyyy HH:mm:ss')}
              </TableCell>
              <TableCell className="tableCell">{row.total}</TableCell>
              <TableCell className="tableCell">{row.paymentMethode}</TableCell>
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

export default ListCommande;
