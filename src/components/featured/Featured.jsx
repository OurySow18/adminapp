/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Statistiken über das Geld
 */
import "./featured.scss";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";

const Featured = () => {
  const [data, setData] = useState([]);
  const monthGoal = 85000000;
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);  
const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const lastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    today.getDate()
  );
  // Obtenir le premier jour du mois actuel
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  useEffect(() => {
    const fetchData = async () => {
      // Récupérer les données des commandes depuis Firestore
      const q = query(
        collection(db, "orders"),
        where("timeStamp", "<=", today),
        where("timeStamp", ">", lastMonth)
      );

      try {
        const querySnapshot = await getDocs(q);
        const orderData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setData(orderData);
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
      }
    };
    fetchData();
  }, []);

  // Calculer le total des revenus réalisés aujourd'hui
  const totalRevenueToday = data.reduce((total, order) => {
    const orderDate = order.timeStamp.toDate();
    return orderDate >= startOfToday && orderDate < today ? total + order.total : total;
  }, 0);
  

 // console.log("totalRevenue: ", totalRevenueToday)

  //console.log("totalRevenueToday: ", data)
  // Calculer le total des revenus réalisés ce mois-ci
  const totalRevenueThisMonth = data.reduce(
    (total, order) =>
      order.timeStamp.toDate() >= firstDayOfMonth &&
      order.timeStamp.toDate() < today
        ? total + order.total
        : total,
    0
  );
 
  // Calculer le total des revenus réalisés la semaine dernière
  const totalRevenueThisWeek = data.reduce((total, order) => {
    //console.log("Order timestamp:", order.timeStamp.toDate());
    //console.log("Last week:", lastWeek);
    //console.log("Today:", today);
    //console.log(
    //  "Is within last week:",
    //  order.timeStamp.toDate() >= lastWeek && order.timeStamp.toDate() < today
    //);
    //console.log("Amount:", order.total);
    return order.timeStamp.toDate() >= lastWeek &&
      order.timeStamp.toDate() < today
      ? total + order.total
      : total;
  }, 0);
 
  // Calculer le total des revenus réalisés le mois dernier
  const totalRevenueLastMonth = data.reduce(
    (total, order) =>
      order.timeStamp.toDate() >= lastMonth && order.timeStamp.toDate() < today
        ? total + order.total
        : total,
    0
  );
  //console.log("totalRevenueLastMonth: ", totalRevenueLastMonth);
  return (
    <div className="featured">
      <div className="top">
        <h1 className="title">Total Revenue</h1>
        <MoreVertIcon fontSize="small" />
      </div>
      <div className="bottom">
        <div className="featuredChart">
          <CircularProgressbar value={90} text={"90%"} strokeWidth={1} />
        </div>
        <p className="total">Ventes totales réalisées aujourd'hui</p>
        <p className="amount">
          {totalRevenueToday.toLocaleString("fr-FR")} GNF
        </p>
        <p className="desc">Traitement des transactions précédentes.</p>
        <div className="summary">
          <div className="item">
            <div className="itemTitle">Ce Mois: 85M</div>
            <div
              className={`itemResult ${
                monthGoal <= totalRevenueThisMonth ? "positive" : "negative"
              }`}
            >
              <KeyboardArrowDownIcon fontSize="small" />
              <div className="resultAmount">
                {totalRevenueThisMonth.toLocaleString("fr-FR")} GNF
              </div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">Les 7 dernier Jours</div>
            <div
              className={`itemResult ${
                totalRevenueThisWeek >= 0 ? "positive" : "negative"
              }`}
            >
              {totalRevenueThisWeek <= 0 ? (
                <KeyboardArrowDownIcon fontSize="small" />
              ) : (
                <KeyboardArrowUpIcon fontSize="small" />
              )}
              <div className="resultAmount">
                {totalRevenueThisWeek.toLocaleString("fr-FR")} GNF
              </div>
            </div>
          </div>
          <div className="item">
            <div className="itemTitle">Le mois dernier</div>
            <div
              className={`itemResult ${
                totalRevenueLastMonth >= 0 ? "positive" : "negative"
              }`}
            >
              {totalRevenueLastMonth <= 0 ? (
                <KeyboardArrowDownIcon fontSize="small" />
              ) : (
                <KeyboardArrowUpIcon fontSize="small" />
              )}
              <div className="resultAmount">
                {totalRevenueLastMonth.toLocaleString("fr-FR")} GNF
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Featured;
