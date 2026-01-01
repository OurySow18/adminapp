/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Widget werden hier erstellt
 */
import "./widget.scss";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { loadVendorProductRows } from "../../utils/vendorProductsRepository";

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
  subStats,
}) => {
  const content = (
    <>
      <div className="left">
        <span className="title">{title}</span>
        <span className="counter">
          {isMoney ? `GNF ${amount ?? 0}` : amount ?? 0}
        </span>
        {Array.isArray(subStats) && subStats.length > 0 && (
          <div className="substats">
            {subStats.map((item) => (
              <span key={item.label} className="substats__item">
                {item.label}: <strong>{item.value ?? 0}</strong>
              </span>
            ))}
          </div>
        )}
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
  const [subStats, setSubStats] = useState(null);

  const MONMARCHE_VENDOR_ID = "89xYCymLLyTSGeAw1oZvNcHLIFO2";

  const normalizeLabel = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const isMonmarcheRow = (row) => {
    if (!row) return false;
    const vendorId = row.vendorId || row.vendorDisplayId;
    if (vendorId === MONMARCHE_VENDOR_ID) return true;
    if (typeof row.docPath === "string" && row.docPath.includes(MONMARCHE_VENDOR_ID)) {
      return true;
    }
    const vendorName = normalizeLabel(
      row.vendorName ||
        row.raw?.vendorName ||
        row.raw?.core?.vendorName ||
        row.raw?.company?.name ||
        row.raw?.storeName
    );
    return vendorName.includes("monmarche");
  };

  const getUsersNumber = async () => {
    try {
      const snapshot = await getCountFromServer(collection(db, "users"));
      setAmount(snapshot.data().count);
    } catch (error) {
      console.warn("Count aggregation failed, fallback to getDocs.", error);
      const usersDataItem = await getDocs(collection(db, "users"));
      setAmount(usersDataItem.docs.length);
    }
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

  const getVendorsNumber = async () => {
    try {
      const snapshot = await getCountFromServer(collection(db, "vendors"));
      setAmount(snapshot.data().count);
    } catch (error) {
      console.warn("Vendors count aggregation failed, fallback to getDocs.", error);
      const vendorsDataItem = await getDocs(collection(db, "vendors"));
      setAmount(vendorsDataItem.docs.length);
    }
    setDiff(50);
  };

  const getVendorProductsNumber = async () => {
    try {
      const snapshot = await getCountFromServer(collection(db, "vendor_products"));
      setAmount(snapshot.data().count);
    } catch (error) {
      console.warn("Vendor products count aggregation failed, fallback to getDocs.", error);
      const productsDataItem = await getDocs(collection(db, "vendor_products"));
      setAmount(productsDataItem.docs.length);
    }
    setDiff(50);
  };

  const getVendorProductsBreakdown = async () => {
    try {
      const rows = await loadVendorProductRows();
      const total = rows.length;
      const monmarcheCount = rows.filter(isMonmarcheRow).length;
      setAmount(total);
      setSubStats([
        { label: "Monmarché", value: monmarcheCount },
        { label: "Autres vendeurs", value: total - monmarcheCount },
      ]);
    } catch (error) {
      console.warn("Vendor products breakdown failed.", error);
      setAmount(0);
      setSubStats([
        { label: "Monmarché", value: 0 },
        { label: "Autres vendeurs", value: 0 },
      ]);
    }
    setDiff(50);
  };

  const data = (() => {
    switch (type) {
      case "user":
        return {
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
      case "order":
        return {
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
      case "earning":
        return {
          title: "VENDEURS",
          isMoney: false,
          link: "Voir les vendeurs",
          linkTo: "/vendors",
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
      case "balance":
        return {
          title: "PRODUITS VENDEURS",
          isMoney: false,
          link: "Voir les produits",
          linkTo: "/vendor-products",
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
      default:
        return null;
    }
  })();

  useEffect(() => {
    setSubStats(null);
    if (type === "user") {
      getUsersNumber();
      return;
    }
    if (type === "order") {
      getOrdersNumber();
      return;
    }
    if (type === "earning") {
      getVendorsNumber();
      return;
    }
    if (type === "balance") {
      getVendorProductsBreakdown();
    }
  }, [type]);

  return (
    <WidgetDisplay
      title={data?.title}
      isMoney={data?.isMoney}
      amount={amount}
      link={data?.link}
      linkTo={data?.linkTo}
      diff={diff}
      icon={data?.icon}
      subStats={subStats}
    />
  );
};

export default Widget;
