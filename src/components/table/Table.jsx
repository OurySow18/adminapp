import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit as limitDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { format } from "date-fns";
import "./table.scss";

const formatDateTime = (value) => {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return format(date, "dd/MM/yyyy HH:mm");
  }
  if (value instanceof Date) return format(value, "dd/MM/yyyy HH:mm");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : format(parsed, "dd/MM/yyyy HH:mm");
};

const formatCurrency = (amount, currency = "GNF") => {
  if (amount === undefined || amount === null) return "-";
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const ListCommande = ({ limit = 10 }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("timeStamp", "desc"),
      limitDocs(limit)
    );
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setOrders(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur chargement commandes:", error);
        setOrders([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [limit]);

  return (
    <TableContainer component={Paper} className="table">
      <Table sx={{ minWidth: 700 }} aria-label="table des commandes">
        <TableHead>
          <TableRow>
            <TableCell className="tableCell">Commande ID</TableCell>
            <TableCell className="tableCell">Nom du client</TableCell>
            <TableCell className="tableCell">Adresse</TableCell>
            <TableCell className="tableCell">Date et Heure</TableCell>
            <TableCell className="tableCell">Total</TableCell>
            <TableCell className="tableCell">Méthode de Paiement</TableCell>
            <TableCell className="tableCell">Statut</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} className="tableCell">
                Chargement des commandes...
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            orders.map((row) => {
              const receiver = row.deliverInfos ?? {};
              return (
                <TableRow
                  key={row.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/orders/${row.id}`)}
                >
                  <TableCell className="tableCell">{row.orderId || row.id}</TableCell>
                  <TableCell className="tableCell">
                    <div className="cellWrapper">
                      {receiver.name || row.customerName || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="tableCell">
                    {receiver.address || row.customerAddress || "-"}
                  </TableCell>
                  <TableCell className="tableCell">
                    {formatDateTime(row.timeStamp)}
                  </TableCell>
                  <TableCell className="tableCell">
                    {formatCurrency(row.total)}
                  </TableCell>
                  <TableCell className="tableCell">
                    {row.paymentMethode || row.paymentMethod || "-"}
                  </TableCell>
                  <TableCell className="tableCell">
                    <span
                      className={`status ${row.delivered ? "delivered" : "pending"}`}
                    >
                      {row.delivered ? "Livré" : "En attente"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          {!loading && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="tableCell">
                Aucune commande trouvée.©e.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ListCommande;





