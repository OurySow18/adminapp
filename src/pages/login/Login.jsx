/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Login Seite
 */
import "./login.scss";
import { useState, useContext } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

const SUPER_ADMIN_UID = "rgFo1YPQNDdJxyfRCiWFXETpJHB2"; // ton UID superAdmin

const Login = () => {
  const [error, setError] = useState(false);
  const [identifier, setIdentifier] = useState(""); // username ou email
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [feedback, setFeedback] = useState({
    open: false,
    type: "error",
    title: "Erreur de connexion",
    message: "",
    actions: null,
  });

  const navigate = useNavigate();
  const { dispatch } = useContext(AuthContext);

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false, actions: null }));
  };

  const showErrorPopup = (message) => {
    setFeedback({
      open: true,
      type: "error",
      title: "Erreur de connexion",
      message, // <-- ici on utilise bien le message passé
      actions: null,
    });
  };

  const mapErrorCodeToMessage = (code) => {
    switch (code) {
      case "auth/invalid-email":
        return "L'adresse e-mail est invalide. Vérifiez le format.";
      case "auth/user-disabled":
        return "Ce compte a été désactivé. Veuillez contacter un administrateur.";
      case "auth/user-not-found":
        return "Aucun compte trouvé avec ces identifiants.";
      case "auth/wrong-password":
        return "Le mot de passe est incorrect.";
      case "auth/too-many-requests":
        return "Trop de tentatives de connexion. Veuillez réessayer plus tard.";
      case "auth/network-request-failed":
        return "Problème de connexion réseau. Vérifiez votre connexion internet.";
      default:
        return "Une erreur inattendue est survenue. Merci de réessayer.";
    }
  };

  const resolveEmailFromIdentifier = async (identifierValue) => {
    const trimmed = (identifierValue || "").trim();

    // Si ça ressemble à un email => on le garde tel quel
    if (trimmed.includes("@")) {
      return trimmed;
    }

    // Sinon, on considère que c'est un username d'ADMIN
    const adminQuery = query(
      collection(db, "admin"),
      where("username", "==", trimmed),
      limit(1)
    );
    const snap = await getDocs(adminQuery);

    if (snap.empty) {
      throw new Error(
        "Aucun administrateur trouvé avec ce nom d'utilisateur."
      );
    }

    const adminData = snap.docs[0].data();
    if (!adminData.email) {
      throw new Error(
        "Ce compte administrateur n'a pas d'adresse e-mail associée."
      );
    }

    return adminData.email;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!identifier || !password) {
      setError(true);
      showErrorPopup(
        "Veuillez saisir votre nom d'utilisateur (ou email) et votre mot de passe."
      );
      return;
    }

    try {
      // 1) On récupère l'email à partir du username ou de l'email
      const emailToUse = await resolveEmailFromIdentifier(identifier);

      // 2) On tente la connexion Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        emailToUse,
        password
      );
      const user = userCredential.user;

      // 3) Vérifier si c'est un admin ou superAdmin
      let isAdmin = false;
      let adminData = null;

      if (user.uid === SUPER_ADMIN_UID) {
        isAdmin = true;
      } else {
        const adminDocRef = doc(db, "admin", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          isAdmin = true;
          adminData = adminDocSnap.data();
        }
      }

      if (!isAdmin) {
        // Pas admin => on le déconnecte et on affiche une erreur claire
        await signOut(auth);
        setError(true);
        showErrorPopup(
          "Vous n'êtes pas autorisé à accéder à cette interface administrateur."
        );
        return;
      }

      // 3b) Admin désactivé (status === false)
      const isRegularAdmin = adminData?.role
        ? String(adminData.role).toLowerCase() === "admin"
        : true;
      if (isRegularAdmin && adminData?.status === false) {
        await signOut(auth);
        setError(true);
        showErrorPopup(
          "Ce compte administrateur est désactivé. Contactez un super administrateur."
        );
        return;
      }

      // 4) OK, c'est un admin / superAdmin => on continue le flux normal
      dispatch({ type: "LOGIN", payload: user });
      setError(false);
      handleFeedbackClose();
      navigate("/");
    } catch (err) {
      console.log(err.code, err.message);
      setError(true);

      // Erreurs locales (throw new Error(...))
      if (!err.code) {
        showErrorPopup(err.message || "Erreur lors de la connexion.");
        return;
      }

      const friendlyMessage = mapErrorCodeToMessage(err.code);
      showErrorPopup(friendlyMessage);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <>
      <div className="login">
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Nom d'utilisateur ou email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="password-toggle"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit">Login</button>

          {error && (
            <span>Impossible de se connecter. Vérifiez vos identifiants.</span>
          )}
        </form>
      </div>

      <FeedbackPopup
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={handleFeedbackClose}
        actions={feedback.actions}
      />
    </>
  );
};

export default Login;
