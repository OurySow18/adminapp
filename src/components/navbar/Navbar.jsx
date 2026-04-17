/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Navbar Komponent
 */
import "./navbar.scss";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../../context/darkModeContext";
import { useSidebar } from "../../context/sidebarContext";
import { AuthContext } from "../../context/AuthContext";
import { auth, db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import ConfirmModal from "../modal/ConfirmModal";

import Bild from "../../images/Bild_Sow.jpeg";

import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import FullscreenExitOutlinedIcon from "@mui/icons-material/FullscreenExitOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

const SUPER_ADMIN_UID = "rgFo1YPQNDdJxyfRCiWFXETpJHB2";

const getTodayId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const Navbar = () => {
  const { dispatch } = useContext(DarkModeContext);
  const { toggleSidebar, isCollapsed, isMobile, isMobileOpen } = useSidebar();
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [roleLabel, setRoleLabel] = useState("");
  const [userLabel, setUserLabel] = useState("");
  const [workSession, setWorkSession] = useState(null);
  const [workLoading, setWorkLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    open: false,
    action: null,
  });
  const [startTasks, setStartTasks] = useState("");
  const [stopSummary, setStopSummary] = useState("");
  const [stopAchieved, setStopAchieved] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [endTimeValue, setEndTimeValue] = useState("");
  const [endTimeError, setEndTimeError] = useState("");
  const resumePromptedRef = useRef(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  const ToggleIcon = isMobile
    ? isMobileOpen
      ? CloseIcon
      : MenuIcon
    : isCollapsed
    ? MenuIcon
    : MenuOpenIcon;

  const todayDocRef = useMemo(() => {
    if (!currentUser || typeof currentUser.uid !== "string" || !currentUser.uid.trim()) {
      return null;
    }
    return doc(db, "admin", currentUser.uid, "workSessions", getTodayId());
  }, [currentUser]);

  const parseShifts = (data) => {
    const shifts = Array.isArray(data?.shifts) ? data.shifts : [];
    if (shifts.length) return shifts;
    if (data?.startTime) {
      return [
        {
          startTime: data.startTime,
          plannedTasks: data.plannedTasks || "",
          pauses: Array.isArray(data.pauses) ? data.pauses : [],
          endTime: data.endTime || null,
          summary: data.summary || "",
          achievedGoals: data.achievedGoals ?? null,
          status: data.status || (data.endTime ? "finished" : "working"),
        },
      ];
    }
    return [];
  };

  const shifts = useMemo(() => parseShifts(workSession), [workSession]);
  const activeShift = shifts[shifts.length - 1] || null;
  const activeShiftStart = activeShift?.startTime || workSession?.startTime || null;
  const activeShiftTasks =
    activeShift?.plannedTasks || workSession?.plannedTasks || startTasks || "";

  const formatDateTimeInput = (date) => {
    if (!date) return "";
    const local = new Date(date);
    if (Number.isNaN(local.getTime())) return "";
    const pad = (value) => String(value).padStart(2, "0");
    return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(
      local.getDate()
    )}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
  };

  const toDateValue = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (
      typeof value === "object" &&
      typeof value.seconds === "number" &&
      typeof value.nanoseconds === "number"
    ) {
      return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6));
    }
    return null;
  };

  const formatDateTimeLabel = (value) => {
    const date = toDateValue(value);
    return date
      ? date.toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  };

  const formatNotificationDate = (value) => {
    const date = toDateValue(value);
    return date
      ? date.toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  };

  useEffect(() => {
    const fetchRole = async () => {
      if (!currentUser) {
        setRoleLabel("");
        setUserLabel("");
        setAdminProfile(null);
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
          setAdminProfile(adminDocSnap.data() || null);
          setRoleLabel("Administrateur");
        } else {
          setAdminProfile(null);
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

  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    const inboxRef = collection(db, "admin", currentUser.uid, "notifications");
    const q = query(inboxRef, orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setNotifications(rows);
      const unread = rows.filter((item) => !item.readAt).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!notificationsRef.current) return;
      if (!notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [notificationsOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [accountMenuOpen]);

  const toggleNotifications = () => {
    setNotificationsOpen((prev) => !prev);
  };

  const toggleAccountMenu = () => {
    setAccountMenuOpen((prev) => !prev);
  };

  const markAllNotificationsRead = async () => {
    if (!currentUser?.uid) return;
    const unread = notifications.filter((item) => !item.readAt);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((item) => {
      const ref = doc(db, "admin", currentUser.uid, "notifications", item.id);
      batch.update(ref, { readAt: Timestamp.now() });
    });
    await batch.commit();
  };

  const clearAllNotifications = async () => {
    if (!currentUser?.uid) return;
    if (!notifications.length) return;
    const ok = window.confirm(
      "Supprimer toutes les notifications ? Cette action est irreversible."
    );
    if (!ok) return;
    const batch = writeBatch(db);
    notifications.forEach((item) => {
      const ref = doc(db, "admin", currentUser.uid, "notifications", item.id);
      batch.delete(ref);
    });
    await batch.commit();
  };

  const handleNotificationClick = async (notif) => {
    if (!currentUser?.uid) return;
    if (!notif.readAt) {
      const ref = doc(db, "admin", currentUser.uid, "notifications", notif.id);
      updateDoc(ref, { readAt: Timestamp.now() }).catch(() => {});
    }
    setNotificationsOpen(false);
    if (typeof notif.link === "string" && notif.link.trim()) {
      if (notif.link.startsWith("/")) {
        navigate(notif.link);
      } else {
        window.open(notif.link, "_blank", "noopener");
      }
    }
  };

  const handleAccountLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Erreur deconnexion:", error);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) {
      window.alert("Email introuvable pour ce compte.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      window.alert("Un email de réinitialisation a été envoyé.");
    } catch (error) {
      console.error("Erreur reset mot de passe:", error);
      window.alert("Impossible d'envoyer l'email de réinitialisation.");
    }
  };

  const adminAvatar = useMemo(() => {
    if (adminProfile?.img) return adminProfile.img;
    if (adminProfile?.photoURL) return adminProfile.photoURL;
    if (adminProfile?.avatarUrl) return adminProfile.avatarUrl;
    if (adminProfile?.profile?.avatarUrl) return adminProfile.profile.avatarUrl;
    if (adminProfile?.profile?.photoURL) return adminProfile.profile.photoURL;
    if (currentUser?.photoURL) return currentUser.photoURL;
    return Bild;
  }, [adminProfile, currentUser]);

  useEffect(() => {
    if (!todayDocRef) {
      setWorkSession(null);
      return undefined;
    }
    const unsubscribe = onSnapshot(todayDocRef, (snapshot) => {
      setWorkSession(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    });
    return () => unsubscribe();
  }, [todayDocRef]);

  useEffect(() => {
    if (!currentUser) {
      resumePromptedRef.current = false;
      setResumePromptOpen(false);
      setEndPromptOpen(false);
      return;
    }
    const promptKey = `workSessionPrompted:${currentUser.uid}:${getTodayId()}`;
    if (resumePromptedRef.current) return;
    if (sessionStorage.getItem(promptKey) === "true") return;
    if (!activeShift || activeShift.endTime) return;
    resumePromptedRef.current = true;
    sessionStorage.setItem(promptKey, "true");
    setResumePromptOpen(true);
  }, [currentUser, activeShift]);

  const workStatus = useMemo(() => {
    if (!activeShift) return "idle";
    if (activeShift.endTime) return "idle";
    const pauses = Array.isArray(activeShift.pauses) ? activeShift.pauses : [];
    const lastPause = pauses[pauses.length - 1];
    if (lastPause && !lastPause.end) return "paused";
    return "working";
  }, [activeShift]);

  const ensureDocRef = () => {
    if (!todayDocRef) throw new Error("Utilisateur non connecté");
    return todayDocRef;
  };

  const handleStartWork = async (plannedTasks) => {
    if (workStatus !== "idle") return;
    try {
      setWorkLoading(true);
      const docRef = ensureDocRef();
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        const data = snap.data() || {};
        const currentShifts = parseShifts(data);
        const newShift = {
          startTime: Timestamp.now(),
          plannedTasks: plannedTasks.trim(),
          status: "working",
          pauses: [],
          endTime: null,
          summary: "",
          achievedGoals: null,
        };
        transaction.set(
          docRef,
          { shifts: [...currentShifts, newShift] },
          { merge: true }
        );
      });
    } catch (error) {
      console.error("Erreur lors du démarrage du travail:", error);
      alert("Impossible de démarrer la session de travail.");
    } finally {
      setWorkLoading(false);
    }
  };

  const handlePause = async () => {
    if (workStatus !== "working") return;
    try {
      setWorkLoading(true);
      const docRef = ensureDocRef();
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        const data = snap.data() || {};
        const currentShifts = parseShifts(data);
        if (!currentShifts.length) throw new Error("Aucune session active");
        const updatedShifts = currentShifts.slice();
        const last = { ...updatedShifts[updatedShifts.length - 1] };
        const pauses = Array.isArray(last.pauses) ? last.pauses.slice() : [];
        pauses.push({ start: Timestamp.now(), end: null });
        last.pauses = pauses;
        last.status = "paused";
        updatedShifts[updatedShifts.length - 1] = last;
        transaction.set(docRef, { shifts: updatedShifts }, { merge: true });
      });
    } catch (error) {
      console.error("Erreur lors de la mise en pause:", error);
      alert("Impossible de mettre en pause.");
    } finally {
      setWorkLoading(false);
    }
  };

  const handleResume = async () => {
    if (workStatus !== "paused") return;
    try {
      setWorkLoading(true);
      const docRef = ensureDocRef();
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        const data = snap.data() || {};
        const currentShifts = parseShifts(data);
        if (!currentShifts.length) throw new Error("Aucune session active");
        const updatedShifts = currentShifts.slice();
        const last = { ...updatedShifts[updatedShifts.length - 1] };
        const pauses = Array.isArray(last.pauses) ? last.pauses.slice() : [];
        const idx = pauses.length - 1;
        if (idx >= 0) {
          pauses[idx] = { ...pauses[idx], end: Timestamp.now() };
        }
        last.pauses = pauses;
        last.status = "working";
        updatedShifts[updatedShifts.length - 1] = last;
        transaction.set(docRef, { shifts: updatedShifts }, { merge: true });
      });
    } catch (error) {
      console.error("Erreur lors de la reprise:", error);
      alert("Impossible de reprendre la session.");
    } finally {
      setWorkLoading(false);
    }
  };

  const handleStop = async ({ summary, achievedGoals }) => {
    if (workStatus !== "working" && workStatus !== "paused") return;
    try {
      setWorkLoading(true);
      const docRef = ensureDocRef();
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        const data = snap.data() || {};
        const currentShifts = parseShifts(data);
        if (!currentShifts.length) throw new Error("Aucune session active");
        const updatedShifts = currentShifts.slice();
        const last = { ...updatedShifts[updatedShifts.length - 1] };
        const pauses = Array.isArray(last.pauses) ? last.pauses.slice() : [];
        const idx = pauses.length - 1;
        if (workStatus === "paused" && idx >= 0 && !pauses[idx].end) {
          pauses[idx] = { ...pauses[idx], end: Timestamp.now() };
        }
        last.pauses = pauses;
        last.endTime = Timestamp.now();
        last.summary = summary.trim();
        last.achievedGoals = achievedGoals ?? null;
        last.status = "finished";
        updatedShifts[updatedShifts.length - 1] = last;
        transaction.set(docRef, { shifts: updatedShifts }, { merge: true });
      });
    } catch (error) {
      console.error("Erreur lors de l'arrêt:", error);
      alert("Impossible de terminer la session.");
    } finally {
      setWorkLoading(false);
    }
  };

  const handleForceStop = async (endDate) => {
    if (!endDate) return;
    try {
      setWorkLoading(true);
      const docRef = ensureDocRef();
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        const data = snap.data() || {};
        const currentShifts = parseShifts(data);
        const updatedShifts = currentShifts.slice();
        if (!updatedShifts.length && data.startTime) {
          updatedShifts.push({
            startTime: data.startTime,
            endTime: null,
            status: data.status || "working",
          });
        }
        if (!updatedShifts.length) throw new Error("Aucune session active");
        const last = { ...updatedShifts[updatedShifts.length - 1] };
        if (last.endTime) return;
        const pauses = Array.isArray(last.pauses) ? last.pauses.slice() : [];
        const idx = pauses.length - 1;
        if (idx >= 0 && !pauses[idx]?.end) {
          pauses[idx] = { ...pauses[idx], end: Timestamp.fromDate(endDate) };
        }
        last.pauses = pauses;
        last.endTime = Timestamp.fromDate(endDate);
        last.status = "finished";
        updatedShifts[updatedShifts.length - 1] = last;
        transaction.set(docRef, { shifts: updatedShifts }, { merge: true });
      });
    } catch (error) {
      console.error("Erreur lors de la clôture:", error);
      alert("Impossible de terminer la session.");
    } finally {
      setWorkLoading(false);
    }
  };

  const openModal = (action) => {
    setModalConfig({ open: true, action });
    if (action === "start") setStartTasks(workSession?.plannedTasks || "");
    if (action === "stop") {
      setStopSummary("");
      setStopAchieved(null);
    }
  };

  const closeModal = () => setModalConfig({ open: false, action: null });

  const handleConfirmModal = async () => {
    const action = modalConfig.action;
    if (!action) return;
    if (action === "start") {
      await handleStartWork(startTasks || "");
      closeModal();
      return;
    }
    if (action === "pause") {
      await handlePause();
      closeModal();
      return;
    }
    if (action === "resume") {
      await handleResume();
      closeModal();
      return;
    }
    if (action === "stop") {
      await handleStop({
        summary: stopSummary || "",
        achievedGoals: stopAchieved,
      });
      closeModal();
    }
  };

  const handleResumePromptContinue = () => {
    setResumePromptOpen(false);
  };

  const handleResumePromptTerminate = () => {
    const now = new Date();
    setEndTimeValue(formatDateTimeInput(now));
    setEndTimeError("");
    setResumePromptOpen(false);
    setEndPromptOpen(true);
  };

  const handleEndPromptClose = () => {
    setEndTimeError("");
    setEndPromptOpen(false);
  };

  const handleEndPromptConfirm = async () => {
    const parsed = endTimeValue ? new Date(endTimeValue) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      setEndTimeError("Merci de renseigner une date et une heure valides.");
      return;
    }
    const now = new Date();
    if (parsed.getTime() > now.getTime()) {
      setEndTimeError("La date de fin ne peut pas être dans le futur.");
      return;
    }
    const startDate = toDateValue(activeShiftStart);
    if (startDate && parsed.getTime() < startDate.getTime()) {
      setEndTimeError("La date de fin doit être après la date de début.");
      return;
    }
    setEndTimeError("");
    await handleForceStop(parsed);
    setEndPromptOpen(false);
  };

  const renderWorkControls = () => {
    if (!currentUser) return null;
    switch (workStatus) {
      case "idle":
        return (
          <button
            type="button"
            className="navbar__workButton navbar__workButton--start"
            onClick={() => openModal("start")}
            disabled={workLoading}
          >
            Commencer
          </button>
        );
      case "working":
        return (
          <>
            <button
              type="button"
              className="navbar__workButton navbar__workButton--pause"
              onClick={() => openModal("pause")}
              disabled={workLoading}
            >
              Pause
            </button>
            <button
              type="button"
              className="navbar__workButton navbar__workButton--stop"
              onClick={() => openModal("stop")}
              disabled={workLoading}
            >
              Terminer
            </button>
          </>
        );
      case "paused":
        return (
          <>
            <button
              type="button"
              className="navbar__workButton navbar__workButton--resume"
              onClick={() => openModal("resume")}
              disabled={workLoading}
            >
              Recommencer
            </button>
            <button
              type="button"
              className="navbar__workButton navbar__workButton--stop"
              onClick={() => openModal("stop")}
              disabled={workLoading}
            >
              Terminer
            </button>
          </>
        );
      case "finished":
        return (
          <button
            type="button"
            className="navbar__workButton navbar__workButton--start"
            onClick={() => openModal("start")}
            disabled={workLoading}
          >
            Commencer
          </button>
        );
      default:
        return null;
    }
  };

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
          <div className="item navbar__workControls">{renderWorkControls()}</div>
          <div className="navbar__groupDivider" />
          {/* Badge rôle Admin / SuperAdmin */}
          {roleLabel && (
            <div className="item item--role">
              <span className="navbar__roleBadge">{roleLabel}</span>
            </div>
          )}

          {/* Email (facultatif, tu peux enlever si tu veux) */}
          {userLabel && (
            <div className="item item--user">
              <span className="navbar__userLabel">{userLabel}</span>
            </div>
          )}
          <div className="navbar__groupDivider" />

          <div className="item item--language">
            <LanguageOutlinedIcon />
            Français
          </div>
          <div className="item">
            <button
              type="button"
              className="navbar__iconButton"
              onClick={() => dispatch({ type: "TOGGLE" })}
              aria-label="Basculer le thème"
              title="Basculer le thème"
            >
              <DarkModeOutlinedIcon className="icon" />
            </button>
          </div>
          <div className="item item--fullscreen">
            <FullscreenExitOutlinedIcon className="icon" />
          </div>
          <div className="navbar__groupDivider" />
          <div className="item navbar__notifications" ref={notificationsRef}>
            <button
              type="button"
              className="navbar__iconButton"
              onClick={toggleNotifications}
              aria-label="Notifications"
            >
              <NotificationsNoneOutlinedIcon className="icon" />
              {unreadCount > 0 && (
                <span className="counter">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className="navbar__notificationsPanel">
                <div className="navbar__notificationsHeader">
                  <span>Notifications</span>
                  <div className="navbar__notificationsActions">
                    <button
                      type="button"
                      className="navbar__notificationsAction"
                      onClick={markAllNotificationsRead}
                      disabled={unreadCount === 0}
                    >
                      Tout marquer lu
                    </button>
                    <button
                      type="button"
                      className="navbar__notificationsAction navbar__notificationsAction--danger"
                      onClick={clearAllNotifications}
                      disabled={notifications.length === 0}
                    >
                      Tout supprimer
                    </button>
                  </div>
                </div>
                <div className="navbar__notificationsList">
                  {notifications.length === 0 ? (
                    <div className="navbar__notificationsEmpty">
                      Aucune notification récente.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        type="button"
                        className={`navbar__notificationItem ${
                          notif.readAt ? "" : "navbar__notificationItem--unread"
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="navbar__notificationTitle">
                          {notif.title || "Notification"}
                        </div>
                        {notif.message && (
                          <div className="navbar__notificationMessage">{notif.message}</div>
                        )}
                        <div className="navbar__notificationMeta">
                          {notif.createdAt ? formatNotificationDate(notif.createdAt) : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="item item--chat">
            <ChatBubbleOutlineOutlinedIcon className="icon" />
            <div className="counter">2</div>
          </div>
          <div className="navbar__groupDivider" />
          <div className="item">
            <div className="navbar__account" ref={accountMenuRef}>
              <button
                type="button"
                className="navbar__accountButton"
                onClick={toggleAccountMenu}
                aria-label="Compte"
              >
                <img
                  src={adminAvatar}
                  alt={`Profil ${userLabel || "administrateur"}`}
                  className="avatar"
                />
              </button>
              {accountMenuOpen && (
                <div className="navbar__accountMenu">
                  <div className="navbar__accountHeader">
                    <div className="navbar__accountName">
                      {userLabel || "Administrateur"}
                    </div>
                    <div className="navbar__accountSub">Compte admin</div>
                  </div>
                  <button
                    type="button"
                    className="navbar__accountItem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      if (currentUser?.uid) {
                        navigate(`/admins/${currentUser.uid}`);
                      }
                    }}
                  >
                    <PersonOutlineOutlinedIcon className="navbar__accountIcon" />
                    Mes Infos
                  </button>
                  <button
                    type="button"
                    className="navbar__accountItem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handlePasswordReset();
                    }}
                  >
                    <VpnKeyOutlinedIcon className="navbar__accountIcon" />
                    Changer mot de passe
                  </button>
                  <button
                    type="button"
                    className="navbar__accountItem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      window.open("mailto:infos@monmarchegn.com", "_blank");
                    }}
                  >
                    <SupportAgentOutlinedIcon className="navbar__accountIcon" />
                    Support
                  </button>
                  <div className="navbar__accountDivider" />
                  <button
                    type="button"
                    className="navbar__accountItem navbar__accountItem--danger"
                    onClick={handleAccountLogout}
                  >
                    <LogoutOutlinedIcon className="navbar__accountIcon" />
                    Deconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        open={modalConfig.open}
        onClose={closeModal}
        onConfirm={handleConfirmModal}
        confirmText={
          modalConfig.action === "stop"
            ? "Terminer"
            : modalConfig.action === "pause"
            ? "Mettre en pause"
            : modalConfig.action === "resume"
            ? "Recommencer"
            : "Commencer"
        }
        title={
          modalConfig.action === "stop"
            ? "Terminer ta journée"
            : modalConfig.action === "pause"
            ? "Mettre en pause"
            : modalConfig.action === "resume"
            ? "Reprendre le travail"
            : "Commencer le travail"
        }
        loading={workLoading}
      >
        {modalConfig.action === "start" && (
          <div className="workModal__field">
            <label htmlFor="plannedTasks">Tâches prévues</label>
            <textarea
              id="plannedTasks"
              value={startTasks}
              onChange={(e) => setStartTasks(e.target.value)}
              placeholder="Décris les tâches que tu prévois aujourd'hui..."
              rows={3}
            />
          </div>
        )}

        {modalConfig.action === "stop" && (
          <>
            <div className="workModal__field">
              <label htmlFor="stopSummary">Ce que tu as accompli</label>
              <textarea
                id="stopSummary"
                value={stopSummary}
                onChange={(e) => setStopSummary(e.target.value)}
                placeholder="Résume tes tâches réalisées..."
                rows={3}
              />
            </div>
            <div className="workModal__field">
              <span>Objectifs atteints ?</span>
              <div className="workModal__choices">
                <label>
                  <input
                    type="radio"
                    name="achievedGoals"
                    value="yes"
                    checked={stopAchieved === true}
                    onChange={() => setStopAchieved(true)}
                  />
                  Oui
                </label>
                <label>
                  <input
                    type="radio"
                    name="achievedGoals"
                    value="no"
                    checked={stopAchieved === false}
                    onChange={() => setStopAchieved(false)}
                  />
                  Non
                </label>
              </div>
            </div>
          </>
        )}

        {modalConfig.action === "pause" && (
          <p className="workModal__text">
            Tu es sur le point de mettre ta session en pause. Tu pourras la reprendre plus tard.
          </p>
        )}

        {modalConfig.action === "resume" && (
          <p className="workModal__text">
            Reprendre la session et continuer le suivi de ton temps.
          </p>
        )}
      </ConfirmModal>
      <ConfirmModal
        open={resumePromptOpen}
        onClose={handleResumePromptContinue}
        onConfirm={handleResumePromptTerminate}
        title="Session en cours détectée"
        confirmText="Terminer"
        cancelText="Continuer"
        loading={workLoading}
      >
        <p className="workModal__text">
          Une session a été démarrée et n'a pas encore été terminée.
        </p>
        {activeShiftStart && (
          <p className="workModal__text">
            Début : <strong>{formatDateTimeLabel(activeShiftStart)}</strong>
          </p>
        )}
        {activeShiftTasks && (
          <p className="workModal__text">
            Description : <strong>{activeShiftTasks}</strong>
          </p>
        )}
        <p className="workModal__text">
          Souhaites-tu continuer cette session ou la terminer maintenant ?
        </p>
      </ConfirmModal>
      <ConfirmModal
        open={endPromptOpen}
        onClose={handleEndPromptClose}
        onConfirm={handleEndPromptConfirm}
        title="Terminer la session"
        confirmText="Confirmer la fin"
        cancelText="Annuler"
        loading={workLoading}
      >
        <div className="workModal__field">
          <label htmlFor="endTime">Date et heure de fin</label>
          <input
            id="endTime"
            type="datetime-local"
            value={endTimeValue}
            onChange={(event) => setEndTimeValue(event.target.value)}
          />
          {endTimeError && <span className="workModal__error">{endTimeError}</span>}
          {!endTimeError && (
            <span className="workModal__hint">
              Proposition : {formatDateTimeLabel(new Date())}
            </span>
          )}
        </div>
        {activeShiftTasks && (
          <p className="workModal__text">
            Description : <strong>{activeShiftTasks}</strong>
          </p>
        )}
      </ConfirmModal>
    </div>
  );
};

export default Navbar;
