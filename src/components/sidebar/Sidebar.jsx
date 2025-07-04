import "./sidebar.scss";
import { Link } from "react-router-dom";
import { useContext } from "react";
import { DarkModeContext } from "../../context/darkModeContext";
import { auth } from "../../firebase";
import { signOut } from "firebase/auth";

import { useNavigate } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import StoreIcon from "@mui/icons-material/Store";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LocalPrintshopSharpIcon from "@mui/icons-material/LocalPrintshopSharp";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SettingsSystemDaydreamOutlinedIcon from "@mui/icons-material/SettingsSystemDaydreamOutlined";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplications";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import AddLocationIcon from "@mui/icons-material/AddLocation";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

const Sidbar = () => {
  const { dispatch } = useContext(DarkModeContext);
  const navigate = useNavigate();

  const logout = async () => {
    //dispatchLogout({type:"LOGOUT"})
    signOut(auth)
      .then(() => {
        // Sign-out successful.
        navigate("/login");
      })
      .catch((error) => {
        // An error happened.
        alert("Fehler");
      });
  };
  return (
    <div className="sidebar">
      <div className="top">
        <Link to="/" style={{ textDecoration: "none" }}>
          <span className="logo">Monmarche</span>
        </Link>
      </div>
      <hr />
      <div className="center">
        <ul>
          <p className="title">MAIN</p>
          <Link to="/" style={{ textDecoration: "none" }}>
            <li>
              <DashboardIcon className="icon" />
              <span>Tableau de bord</span>
            </li>
          </Link>
          <p className="title">LISTS</p>
          <Link to="/users" style={{ textDecoration: "none" }}>
            <li>
              <PersonOutlineOutlinedIcon className="icon" />
              <span>Utilisateurs</span>
            </li>
          </Link>
          <Link to="/products" style={{ textDecoration: "none" }}>
            <li>
              <StoreIcon className="icon" />
              <span>Produits</span>
            </li>
          </Link>
          <Link to="/zones" style={{ textDecoration: "none" }}>
            <li>
              <AddLocationIcon className="icon" />
              <span>Zones</span>
            </li>
          </Link>
          <Link to="/orders" style={{ textDecoration: "none" }}>
            <li>
              <CreditCardIcon className="icon" />
              <span>Commandes</span>
            </li>
          </Link>

          <Link to="/delivery" style={{ textDecoration: "none" }}>
            <li>
              <LocalShippingIcon className="icon" />
              <span>Livraisons</span>
            </li>
          </Link>
          <Link to="/delivredOrders" style={{ textDecoration: "none" }}>
            <li>
              <LocalPrintshopSharpIcon className="icon" />
              <span>Commandes livrées</span>
            </li>
          </Link>
          <Link to="/game" style={{ textDecoration: "none" }}>
            <li>
              <EmojiEventsIcon className="icon" />
              <span>Jeu Concours</span>
            </li>
          </Link>
          <p className="title">UTILES</p>
          <li>
            <CreditCardIcon className="icon" />
            <span>Statistiques</span>
          </li>
          <li>
            <NotificationsNoneIcon className="icon" />
            <span>Notifications</span>
          </li>
          <p className="title">SERVICES</p>
          <li>
            <SettingsSystemDaydreamOutlinedIcon className="icon" />
            <span>System</span>
          </li>
          <li>
            <SettingsApplicationsIcon className="icon" />
            <span>Configurations</span>
          </li>
          <p className="title">Compte</p>
          <li>
            <AccountBalanceOutlinedIcon className="icon" />
            <span>Profile</span>
          </li>
          <li onClick={logout}>
            <ExitToAppIcon className="icon" />
            <span>Déconnexion</span>
          </li>
        </ul>
      </div>
      <div className="bottom">
        <div
          className="colorOption"
          onClick={() => dispatch({ type: "LIGHT" })}
        ></div>
        <div
          className="colorOption"
          onClick={() => dispatch({ type: "DARK" })}
        ></div>
      </div>
    </div>
  );
};

export default Sidbar;
