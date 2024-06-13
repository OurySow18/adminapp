/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Widget werden hier erstellt
 */
import "./widget.scss";
import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

export const WidgetDisplay = ({ title, isMoney, amount, link, diff, icon }) => {
  return (
    <div className="widget">
      <div className="left">
        <span className="title">{title}</span>
        <span className="counter">
          {isMoney && "€"}
          {amount}
        </span>
        <span className="link">{link}</span>
      </div>
      <div className="right">
        <div className={`percentage ${diff >= 0 ? "positive" : "negative"}`}>
          <KeyboardArrowUpIcon />
          {diff}%
        </div>
        {icon}
      </div>
    </div>
  );
};

const Widget = ({ type }) => {
  const [amount, setAmount] = useState(null);
  const [diff, setDiff] = useState(null);

  let data;
  const getUsersNumber = async () => {
  /*  const today = new Date();
    const lastMonth = new Date(new Date().setMonth(today.getMonth() - 1));
    const prevMonth = new Date(new Date().setMonth(today.getMonth() - 2));

    const lastMonthQuery = query(
      collection(db, "users"),
      where("timeStamp", "<=", today),
      where("timeStamp", ">", lastMonth)
    );
    const prevMonthQuery = query(
      collection(db, "users"),
      where("timeStamp", "<=", lastMonth),
      where("timeStamp", ">", prevMonth)
    );

    const lastMonthData = await getDocs(lastMonthQuery);
    const prevMonthData = await getDocs(prevMonthQuery);
    
    setAmount(lastMonthData.docs.length);
    setDiff(
      ((lastMonthData.docs.length - prevMonthData.docs.length) /
        prevMonthData.docs.length) *
        100
    );*/
    const usersData = query(
        collection(db, "users"),
        where("status", "==", true)
      );
    const usersDataItem = await getDocs(usersData);

    setAmount(usersDataItem.docs.length)
    setDiff(50)
  };

  const getOrdersNumber = async () =>{
    const ordersData = query(
        collection(db, "orders"),
        where("delivered", "==", false) 
      );
    const ordersDataItems = await getDocs(ordersData)
    setAmount(ordersDataItems.docs.length);
    setDiff(50)
  }
  
  switch (type) {
    case "user":
      data = {
        title: "UTILISATEURS",
        isMoney: false,
        link: "See all users",
        icon: (
          <PersonAddAlt1OutlinedIcon
            className="icon"
            style={{
              color: "crimson",
              backgroundColor: "rgba(255, 0, 0, 0.2)",
            }}
          />
        ),
      };      
      getUsersNumber();
      break;
    case "order":
      data = {
        title: "COMMANDES",
        isMoney: false,
        link: "View all ORDER",
        icon: (
          <ShoppingCartOutlinedIcon
            className="icon"
            style={{
              color: "goldenrod",
              backgroundColor: "rgba(255, 0, 0, 0.2)",
            }}
          />
        ),
      };
      getOrdersNumber();
      break;
    case "earning":
      data = {
        title: "REVENUS",
        isMoney: true,
        link: "View net earnings",
        icon: (
          <MonetizationOnOutlinedIcon
            className="icon"
            style={{
              color: "green",
              backgroundColor: "rgba(0, 128, 0, 0.2)",
            }}
          />
        ),
      };
      getUsersNumber();
      break;
    case "balance":
      data = {
        title: "SOLDE",
        isMoney: true,
        link: "See details",
        icon: (
          <AccountBalanceWalletOutlinedIcon
            className="icon"
            style={{
              color: "purple",
              backgroundColor: "rgba(128, 0, 128, 0.2)",
            }}
          />
        ),
      };
      getUsersNumber();
      break;
    default:
      break;
  } 

  return (
    <WidgetDisplay
      title={data.title}
      isMoney={data.isMoney}
      amount={amount}
      link={data.link}
      diff={diff}
      icon={data.icon}
    />
  );
};

export default Widget;
