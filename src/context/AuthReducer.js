/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Authentikation reducer, initialisiert die ausgewählte Aktion
 */
const AuthReducer = (state, action) => {
    switch (action.type) {
      case "LOGIN": {
        return {
          ...state,
          currentUser: action.payload,
          isAdmin: true,
          authChecked: true,
        };
      }
      case "LOGOUT": {
        return {
            ...state,
            currentUser: null,
            isAdmin: false,
            authChecked: true,
        };
      }
      // Resultat de la verification admin/{uid} declenchee par onAuthStateChanged,
      // independante du flux de connexion manuel (couvre le cas d'une session
      // Firebase Auth deja active, par ex. partagee avec une autre app).
      case "AUTH_CHECKED": {
        return {
          ...state,
          currentUser: action.payload.user,
          isAdmin: action.payload.isAdmin,
          authChecked: true,
        };
      }

      default:
        return state;
    }
  };
  
  export default AuthReducer;