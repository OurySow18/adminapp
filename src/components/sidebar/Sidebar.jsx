import "./sidebar.scss";
import { Link, useLocation } from "react-router-dom";
import { useContext, useEffect, useMemo, useState } from "react";
import { DarkModeContext } from "../../context/darkModeContext";
import { auth } from "../../firebase";
import { signOut } from "firebase/auth";

import { useNavigate } from "react-router-dom";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import StoreIcon from "@mui/icons-material/Store";
import StorefrontIcon from "@mui/icons-material/Storefront";
import Inventory2Icon from "@mui/icons-material/Inventory2";
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
import EditNoteIcon from "@mui/icons-material/EditNote";
import ForwardToInboxIcon from "@mui/icons-material/ForwardToInbox";
import DescriptionIcon from "@mui/icons-material/Description";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import BlockIcon from "@mui/icons-material/Block";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import {
  VENDOR_STATUS_VALUES,
  resolveVendorStatus,
  normalizeVendorStatus,
  isVendorStatus,
} from "../../utils/vendorStatus";

const createEmptyVendorStats = () => ({
  total: 0,
  byStatus: VENDOR_STATUS_VALUES.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {}
  ),
});

const Sidbar = () => {
  const { dispatch } = useContext(DarkModeContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [vendorMenuOpen, setVendorMenuOpen] = useState(true);
  const [vendorStats, setVendorStats] = useState(createEmptyVendorStats);
  const [vendorStatsState, setVendorStatsState] = useState({
    loading: true,
    error: false,
  });

  const vendorMenuItems = useMemo(
    () => [
      {
        key: "all",
        label: "Tous les vendeurs",
        description: "Vue globale des dossiers",
        to: "/vendors",
        Icon: StorefrontIcon,
      },
      {
        key: "draft",
        label: "Brouillons",
        description: "Demandes non soumises",
        to: "/vendors/status/draft",
        Icon: EditNoteIcon,
      },
      {
        key: "submitted",
        label: "A valider",
        description: "Candidatures reçues",
        to: "/vendors/status/submitted",
        Icon: ForwardToInboxIcon,
      },
      {
        key: "needs_docs",
        label: "Documents manquants",
        description: "Pièces justificatives à récupérer",
        to: "/vendors/status/needs_docs",
        Icon: DescriptionIcon,
      },
      {
        key: "under_review",
        label: "En revue",
        description: "Analyse du dossier en cours",
        to: "/vendors/status/under_review",
        Icon: ManageSearchIcon,
      },
      {
        key: "approved",
        label: "Actifs",
        description: "Vendeurs approuvés",
        to: "/vendors/status/approved",
        Icon: TaskAltIcon,
      },
      {
        key: "rejected",
        label: "Refusés",
        description: "Demandes refusées",
        to: "/vendors/status/rejected",
        Icon: BlockIcon,
      },
    ],
    []
  );

  useEffect(() => {
    const vendorsRef = collection(db, "vendors");
    const unsubscribe = onSnapshot(
      vendorsRef,
      (snapshot) => {
        const baseStats = createEmptyVendorStats();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};

          const statusKey = resolveVendorStatus(data, "draft");
          baseStats.total += 1;
          baseStats.byStatus[statusKey] =
            (baseStats.byStatus[statusKey] || 0) + 1;
        });

        setVendorStats(baseStats);
        setVendorStatsState({ loading: false, error: false });
      },
      (error) => {
        console.error("Failed to load vendor stats:", error);
        setVendorStatsState({ loading: false, error: true });
      }
    );

    return () => unsubscribe();
  }, []);

  const vendorActiveKey = useMemo(() => {
    const normalizedPath = location.pathname.replace(/\/+$/, "");
    if (normalizedPath.startsWith("/vendors/status/")) {
      const statusFromPath = normalizedPath.split("/vendors/status/")[1];
      const normalizedStatus = normalizeVendorStatus(statusFromPath);
      if (normalizedStatus && isVendorStatus(normalizedStatus))
        return normalizedStatus;
    }
    if (normalizedPath === "/vendors") {
      return "all";
    }
    return null;
  }, [location.pathname]);

  useEffect(() => {
    if (vendorActiveKey && !vendorMenuOpen) {
      setVendorMenuOpen(true);
    }
  }, [vendorActiveKey, vendorMenuOpen]);

  const getVendorCount = (key) => {
    if (key === "all") {
      return vendorStats.total;
    }
    return vendorStats.byStatus?.[key] ?? 0;
  };

  const renderVendorBadge = (key) => {
    if (vendorStatsState.loading) {
      return "—";
    }
    if (vendorStatsState.error) {
      return "!";
    }
    return getVendorCount(key);
  };

  const toggleVendorMenu = () => {
    setVendorMenuOpen((prev) => !prev);
  };

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

  console.log(vendorStats);
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
          <Link to="/vendor-products" style={{ textDecoration: "none" }}>
            <li>
              <Inventory2Icon className="icon" />
              <span>Produits vendeurs</span>
            </li>
          </Link>
          <li className={`menu-group ${vendorMenuOpen ? "open" : ""}`}>
            <Link to="/vendors" style={{ textDecoration: "none" }}>
              <li>
                <StorefrontIcon className="icon" />
                <span>Vendeurs</span>
              </li>
            </Link>

            {vendorMenuOpen && (
              <ul className="submenu" id="sidebar-vendors-submenu">
                {vendorMenuItems.map(({ key, label, to, Icon }) => {
                  const isActive = vendorActiveKey === key;
                  return (
                    <li
                      key={key}
                      className={`submenu__item ${isActive ? "active" : ""}`}
                    >
                      <Link
                        to={to}
                        className="submenu__link"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="submenu__linkLabel">
                          <Icon className="icon icon--sm" />
                          <span>{label}</span>
                        </div>
                        <span className="submenu__badge">
                          {renderVendorBadge(key)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
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
          {/*<Link to="/game_test" style={{ textDecoration: "none" }}>
            <li>
              <EmojiEventsIcon className="icon" />
              <span>Jeu Concours Test</span>
            </li>
          </Link>*/}
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
