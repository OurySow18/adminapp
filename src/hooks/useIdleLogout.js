import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

// Deconnexion automatique apres inactivite prolongee, avec avertissement
// avant la deconnexion effective. Protection standard pour un back-office
// qui peut bloquer/supprimer des comptes vendeurs et voir des donnees
// financieres.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 60 * 1000; // avertir 1 minute avant la deconnexion

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

export const useIdleLogout = (active) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.round(WARNING_BEFORE_MS / 1000)
  );
  const showWarningRef = useRef(false);
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const clearTimers = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    clearInterval(countdownIntervalRef.current);
  }, []);

  const startWarning = useCallback(() => {
    showWarningRef.current = true;
    setShowWarning(true);
    setRemainingSeconds(Math.round(WARNING_BEFORE_MS / 1000));
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    showWarningRef.current = false;
    setShowWarning(false);
    warningTimerRef.current = setTimeout(
      startWarning,
      IDLE_TIMEOUT_MS - WARNING_BEFORE_MS
    );
    logoutTimerRef.current = setTimeout(() => {
      signOut(auth).catch(() => {});
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers, startWarning]);

  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  const logoutNow = useCallback(() => {
    clearTimers();
    signOut(auth).catch(() => {});
  }, [clearTimers]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      showWarningRef.current = false;
      setShowWarning(false);
      return undefined;
    }

    resetTimers();

    const handleActivity = () => {
      // Une fois l'avertissement affiche, seul le clic "Rester connecte"
      // le fait disparaitre : on evite qu'un simple mouvement de souris
      // masque l'avertissement sans intention explicite de l'admin.
      if (showWarningRef.current) return;
      resetTimers();
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      clearTimers();
    };
  }, [active, resetTimers, clearTimers]);

  return { showWarning, remainingSeconds, stayLoggedIn, logoutNow };
};
