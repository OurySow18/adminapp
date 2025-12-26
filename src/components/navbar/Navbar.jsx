/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Navbar Komponent
 */
import "./navbar.scss";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { DarkModeContext } from "../../context/darkModeContext";
import { useSidebar } from "../../context/sidebarContext";
import { AuthContext } from "../../context/AuthContext";
import { db } from "../../firebase";
import { doc, getDoc, onSnapshot, Timestamp, runTransaction } from "firebase/firestore";
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
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [endTimeValue, setEndTimeValue] = useState("");
  const [endTimeError, setEndTimeError] = useState("");
  const resumePromptedRef = useRef(false);

  const ToggleIcon = isMobile
    ? isMobileOpen
      ? CloseIcon
      : MenuIcon
    : isCollapsed
    ? MenuIcon
    : MenuOpenIcon;

  const todayDocRef = useMemo(() => {
    if (!currentUser) return null;
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
    if (resumePromptedRef.current) return;
    if (!activeShift || activeShift.endTime) return;
    resumePromptedRef.current = true;
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
