/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Widget werden hier erstellt
 */
import "./widget.scss";
import { useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

export const WidgetDisplay = ({
  title,
  isMoney,
  amount,
  link,
  linkTo,
  diff,
  icon,
}) => {
  const content = (
    <>
      <div className="left">
        <span className="title">{title}</span>
        <span className="counter">
          {isMoney ? `GNF ${amount ?? 0}` : amount ?? 0}
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
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="widget widget--link">
        {content}
      </Link>
    );
  }

  return <div className="widget">{content}</div>;
};

const Widget = ({ type }) => {
  const [amount, setAmount] = useState(null);
  const [diff, setDiff] = useState(null);

  let data;
  const getUsersNumber = async () => {
    const usersData = query(
      collection(db, "users"),
      where("status", "==", true)
    );
    const usersDataItem = await getDocs(usersData);

    setAmount(usersDataItem.docs.length);
    setDiff(50);
  };

  const getOrdersNumber = async () => {
    const ordersData = query(
      collection(db, "orders"),
      where("delivered", "==", false)
    );
    const ordersDataItems = await getDocs(ordersData);
    setAmount(ordersDataItems.docs.length);
    setDiff(50);
  };

  switch (type) {
    case "user":
      data = {
        title: "UTILISATEURS",
        isMoney: false,
        link: "See all users",
        linkTo: "/users",
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
        linkTo: "/orders",
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
        linkTo: "/orders",
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
        linkTo: "/orders",
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
      linkTo={data.linkTo}
      diff={diff}
      icon={data.icon}
    />
  );
};

export default Widget;
