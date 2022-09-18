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
          currentUser: action.payload,
        };
      }
      case "LOGOUT": {
        return {
            currentUser: null,
        };
      }
       
      default:
        return state;
    }
  };
  
  export default AuthReducer;