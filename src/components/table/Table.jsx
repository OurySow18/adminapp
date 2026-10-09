import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
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

const getTimeMs = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const ListCommande = ({
  limit = 10,
  userId = null,
  showOnlyPendingValid = false,
  onCountChange = null,
}) => {
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState([]);
  const [archivedOrders, setArchivedOrders] = useState([]);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const [archivedLoaded, setArchivedLoaded] = useState(!userId);

  // Avec un userId : on interroge directement orders + archivedOrders
  // filtres par userId (historique complet de ce client, y compris les
  // commandes deja livrees/archivees). Sans userId (flux "commandes
  // recentes" global) : on garde l'ancien comportement, orders uniquement,
  // trie + limite cote serveur.
  useEffect(() => {
    setActiveLoaded(false);
    const constraints = userId
      ? [where("userId", "==", userId), orderBy("timeStamp", "desc")]
      : [orderBy("timeStamp", "desc")];
    if (!userId && Number.isInteger(limit) && limit > 0) {
      constraints.push(limitDocs(limit));
    }
    const ordersQuery = query(collection(db, "orders"), ...constraints);
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        setActiveOrders(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        );
        setActiveLoaded(true);
      },
      (error) => {
        console.error("Erreur chargement commandes actives:", error);
        setActiveOrders([]);
        setActiveLoaded(true);
      }
    );
    return () => unsubscribe();
  }, [limit, userId]);

  useEffect(() => {
    if (!userId) {
      setArchivedOrders([]);
      setArchivedLoaded(true);
      return undefined;
    }
    setArchivedLoaded(false);
    const archivedQuery = query(
      collection(db, "archivedOrders"),
      where("userId", "==", userId),
      orderBy("timeStamp", "desc")
    );
    const unsubscribe = onSnapshot(
      archivedQuery,
      (snapshot) => {
        setArchivedOrders(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        );
        setArchivedLoaded(true);
      },
      (error) => {
        console.error("Erreur chargement commandes archivées:", error);
        setArchivedOrders([]);
        setArchivedLoaded(true);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  const loading = !activeLoaded || !archivedLoaded;

  const orders = React.useMemo(() => {
    if (loading) return [];
    const merged = userId ? [...activeOrders, ...archivedOrders] : [...activeOrders];
    merged.sort((a, b) => getTimeMs(b.timeStamp) - getTimeMs(a.timeStamp));
    const filtered = showOnlyPendingValid
      ? merged.filter((row) => row?.payed !== true && row?.fakeOrder !== true)
      : merged;
    return Number.isInteger(limit) && limit > 0 && userId
      ? filtered.slice(0, limit)
      : filtered;
  }, [activeOrders, archivedOrders, loading, userId, showOnlyPendingValid, limit]);

  useEffect(() => {
    if (!loading && typeof onCountChange === "function") {
      onCountChange(orders.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, loading]);

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
              const isArchived = Boolean(row.archived);
              return (
                <TableRow
                  key={row.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(
                      isArchived ? `/delivredOrders/${row.id}` : `/orders/${row.id}`
                    )
                  }
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
                    {row.paymentType || row.paymentMethode || "-"}
                  </TableCell>
                  <TableCell className="tableCell">
                    {row.fakeOrder === true ? (
                      <span className="status fake">Fausse commande</span>
                    ) : (
                      <span
                        className={`status ${row.delivered ? "delivered" : "pending"}`}
                      >
                        {row.delivered ? "Livré" : "En attente"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          {!loading && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="tableCell">
                Aucune commande trouvée.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ListCommande;
