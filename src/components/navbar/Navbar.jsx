/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Navbar Komponent
 */
import "./navbar.scss";
import { useContext, useEffect, useState } from "react";
import { DarkModeContext } from "../../context/darkModeContext";
import { useSidebar } from "../../context/sidebarContext";
import { AuthContext } from "../../context/AuthContext";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

import Bild from "../../images/Bild_Sow.jpeg";

import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import FullscreenExitOutlinedIcon from "@mui/icons-material/FullscreenExitOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import CloseIcon from "@mui/icons-material/Close";

const SUPER_ADMIN_UID = "To3bnfOHvgf2S4ZIEX9TWZEbl1l2";

const Navbar = () => {
  const { dispatch } = useContext(DarkModeContext);
  const { toggleSidebar, isCollapsed, isMobile, isMobileOpen } = useSidebar();
  const { currentUser } = useContext(AuthContext);

  const [roleLabel, setRoleLabel] = useState("");
  const [userLabel, setUserLabel] = useState("");

  const ToggleIcon = isMobile
    ? isMobileOpen
      ? CloseIcon
      : MenuIcon
    : isCollapsed
    ? MenuIcon
    : MenuOpenIcon;

  useEffect(() => {
    const fetchRole = async () => {
      if (!currentUser) {
        setRoleLabel("");
        setUserLabel("");
        return;
      }

      // Texte affiché sous forme de label pour l'utilisateur
      setUserLabel(currentUser.email || "");

      // SuperAdmin
      if (currentUser.uid === SUPER_ADMIN_UID) {
        setRoleLabel("Super Administrateur");
        return;
      }

      try {
        // Vérifier si le user est dans la collection admin
        const adminDocRef = doc(db, "admin", currentUser.uid);
        const adminDocSnap = await getDoc(adminDocRef);

        if (adminDocSnap.exists()) {
          setRoleLabel("Administrateur");
        } else {
          // Si tu veux, tu peux laisser vide ou mettre "Utilisateur"
          setRoleLabel("");
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du rôle :", err);
        setRoleLabel("");
      }
    };

    fetchRole();
  }, [currentUser]);

  return (
    <div className="navbar">
      <div className="wrapper">
        <div className="left">
          <button
            type="button"
            className="navbar__menuButton"
            onClick={toggleSidebar}
            aria-label={
              isMobile
                ? isMobileOpen
                  ? "Fermer la navigation"
                  : "Ouvrir la navigation"
                : isCollapsed
                ? "Déplier la navigation"
                : "Replier la navigation"
            }
          >
            <ToggleIcon className="navbar__menuIcon" />
          </button>
          {/* <div className="search">
            <input type="text" placeholder="Search..." />
            <SearchOutlinedIcon />
          </div> */}
        </div>
        <div className="items">
          {/* Badge rôle Admin / SuperAdmin */}
          {roleLabel && (
            <div className="item">
              <span className="navbar__roleBadge">{roleLabel}</span>
            </div>
          )}

          {/* Email (facultatif, tu peux enlever si tu veux) */}
          {userLabel && (
            <div className="item">
              <span className="navbar__userLabel">{userLabel}</span>
            </div>
          )}

          <div className="item item--language">
            <LanguageOutlinedIcon />
            English
          </div>
          <div className="item">
            <DarkModeOutlinedIcon
              className="icon"
              onClick={() => dispatch({ type: "TOGGLE" })}
            />
          </div>
          <div className="item">
            <FullscreenExitOutlinedIcon className="icon" />
          </div>
          <div className="item">
            <NotificationsNoneOutlinedIcon className="icon" />
            <div className="counter">1</div>
          </div>
          <div className="item">
            <ChatBubbleOutlineOutlinedIcon className="icon" />
            <div className="counter">2</div>
          </div>
          <div className="item">
            <img src={Bild} alt="" className="avatar" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
