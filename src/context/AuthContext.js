/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Authentikation Context
 */
import { createContext, useReducer, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { SUPER_ADMIN_UID } from "../config/adminConfig";
import AuthReducer from "./AuthReducer";

const INITIAL_STATE = {
  currentUser: JSON.parse(localStorage.getItem("user")) || null,
  isAdmin: false,
  authChecked: false,
};

export const AuthContext = createContext(INITIAL_STATE);

export const AuthContextProvider = ({ children }) => {
  const [state, dispatch] = useReducer(AuthReducer, INITIAL_STATE);

  useEffect(() => {
      localStorage.setItem("user", JSON.stringify(state.currentUser))

  }, [state.currentUser])

  // Revalide le statut admin a chaque changement de session Firebase Auth
  // (pas seulement au moment du login), pour couvrir le cas d'une session
  // deja active (ex: token partage avec une autre app monmarchegn.com).
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        dispatch({ type: "AUTH_CHECKED", payload: { user: null, isAdmin: false } });
        return;
      }
      try {
        const isAdmin =
          user.uid === SUPER_ADMIN_UID ||
          (await getDoc(doc(db, "admin", user.uid))).exists();
        dispatch({ type: "AUTH_CHECKED", payload: { user, isAdmin } });
      } catch (err) {
        dispatch({ type: "AUTH_CHECKED", payload: { user, isAdmin: false } });
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser: state.currentUser,
        isAdmin: state.isAdmin,
        authChecked: state.authChecked,
        dispatch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};