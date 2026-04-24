/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Addiert neue Daten in der Datenbank {Products und Users}
 */
import { useState, useEffect, useRef } from "react";
import "./new.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { auth, db, functions, storage } from "../../firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

//Array fÃ¼r die User Kategorie
const categorieUser = ["ADMIN", "DRIVER"];
const ROLE_COLLECTION_MAP = {
  ADMIN: "admin",
  DRIVER: "drivers",
};

const createStaffAccountCallable = httpsCallable(functions, "createStaffAccount");

const STAFF_CREATION_ERROR_MESSAGES = {
  auth_required: "Tu dois être connecté pour créer ce compte.",
  admin_required: "Seul un administrateur peut créer ce compte.",
  super_admin_required:
    "Seul le super administrateur peut ajouter un administrateur.",
  invalid_role: "Le rôle demandé est invalide.",
  email_required: "L'email est obligatoire.",
  password_required: "Le mot de passe est obligatoire.",
  username_required:
    "Le nom d'utilisateur est obligatoire pour un administrateur.",
  username_already_exists:
    "Ce nom d'utilisateur est déjà utilisé par un autre administrateur.",
  email_already_exists: "Un compte Auth existe déjà avec cet email.",
  admin_already_exists: "Un administrateur avec cet email existe déjà.",
  drivers_already_exists: "Un driver avec cet email existe déjà.",
  invalid_password:
    "Le mot de passe fourni ne respecte pas les règles Firebase.",
  failed_to_load_auth_user:
    "Impossible de vérifier le compte utilisateur pour le moment.",
  failed_to_create_auth_user:
    "Impossible de créer le compte d'authentification pour le moment.",
};

const formatStaffCreationError = (error) => {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";
  const normalizedCode = code.startsWith("functions/")
    ? code.slice("functions/".length)
    : code;
  const normalizedMessage = message.replace(/^functions\/[a-z-]+:\s*/i, "").trim();

  if (STAFF_CREATION_ERROR_MESSAGES[normalizedMessage]) {
    return STAFF_CREATION_ERROR_MESSAGES[normalizedMessage];
  }
  if (STAFF_CREATION_ERROR_MESSAGES[normalizedCode]) {
    return STAFF_CREATION_ERROR_MESSAGES[normalizedCode];
  }
  return (
    normalizedMessage ||
    "Une erreur inattendue est survenue. Merci de réessayer."
  );
};
//Array fÃ¼r die Product Type
const categorieType = [
  "AUTRES",
  "BREAKFAST",
  "DEJEUNER",
  "CEREMONIE",
  "ENFANTS",
  "FEMMES",
];
//Array fÃ¼r die Produkt Kategorie
const categorieProduct = [
  "AUCUN",
  "ENFANT",
  "BEURE",
  "EAUX",
  "FOSCAO",
  "HUILE",
  "LAIT",
  "MAYONNAISE",
  "NESCAFE",
  "OIGNON",
  "POMMEDETERRE",
  "RIZ",
  "SAVON",
  "SUCCRE",
  "TOMATE",
  "THE",
  "PATTE",
  "HARICOTS",
  "JUS",
  "BISCUITS",
  "COUSCOUS",
  "HAMZA",
  "CHOCOLAT",
  "BONBON",
  "BISCUITS",
  "COTON",
  "CHIPS",
  "CORN FLAKES",
];
const New = ({ inputs, title, typeCmp }) => {
  const [file, setFile] = useState("");
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({});
  const [perc, setPerc] = useState(null);
  const [feedback, setFeedback] = useState({
    open: false,
    type: "info",
    title: "",
    message: "",
    actions: null,
  });
  const feedbackAfterCloseRef = useRef(null);
  const navigate = useNavigate();

  const showFeedback = ({
    type = "info",
    title: feedbackTitle,
    message,
    actions = null,
    afterClose,
  }) => {
    feedbackAfterCloseRef.current = afterClose || null;
    setFeedback({
      open: true,
      type,
      title: feedbackTitle,
      message,
      actions,
    });
  };

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false, actions: null }));
    const cb = feedbackAfterCloseRef.current;
    feedbackAfterCloseRef.current = null;
    if (typeof cb === "function") {
      cb();
    }
  };

  //waehlt die aufgerufene Kategorie und setzt Standardrollen
  useEffect(() => {
    if (typeCmp === "users") {
      setCategories(categorieUser);
      setData((prev) => {
        if (prev?.category && categorieUser.includes(prev.category)) {
          return prev;
        }
        return { ...prev, category: categorieUser[0] };
      });
    } else {
      setCategories(categorieProduct);
    }
  }, [typeCmp]);

  //Aufladung des Bildes
  useEffect(() => {
    const uploadFile = () => {
      const name = new Date().getTime() + file.name;
      const storageRef = ref(storage, name);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload is " + progress + "% done");
          setPerc(progress);
          switch (snapshot.state) {
            case "paused":
              console.log("Upload is paused");
              break;
            case "running":
              console.log("Upload is running");
              break;
            default:
              break;
          }
        },
        (error) => {
          console.log(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setData((prev) => ({ ...prev, img: downloadURL }));
          });
        }
      );
    };
    file && uploadFile();
  }, [file]);

  //Input Daten im Array speichern
  const handleInput = (e) => {
    const id = e.target.id;
    const value = e.target.value;

    setData({ ...data, [id]: value });
  };

  //Ã¼bernimmt die Ã„nderung der Ausgabe in der Input Komponent
  const handleChange = (e) => {
    setData({ ...data, category: e.target.value });
  };

  // zurÃ¼ck zu den vorherige Seite
  const onBack = (e) => {
    e.preventDefault();
    navigate(-1);
  };

  // Template email HTML pour ADMIN
  const adminHtmlTemplate = `
<div style="font-family: Arial, sans-serif; background-color:#f5f5f5; padding:20px;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden;">
    <div style="background-color:#ff6f00; color:#ffffff; padding:16px 24px;">
      <h2 style="margin:0; font-size:20px;">
        Bienvenue dans Monmarché – Accès administrateur
      </h2>
    </div>

    <div style="padding:24px;">
      <p>Bonjour,</p>

      <p>
        Vous avez été ajouté comme <strong>Administrateur</strong> sur la
        plateforme <strong>Monmarché</strong>.
      </p>

      <p>En tant qu'administrateur, vous pourrez notamment :</p>
      <ul>
        <li>Accéder au tableau de bord d'administration,</li>
        <li>Gérer les vendeurs et les produits,</li>
        <li>Consulter les commandes et le suivi de l'activité.</li>
      </ul>

      <h3>🔐 Première connexion</h3>
      <p>
        Pour des raisons de sécurité, vous devez
        <strong> définir votre mot de passe </strong>
        avant votre première connexion.
      </p>
      <p>
        Un email séparé vous a été envoyé par notre système
        d'authentification avec un lien pour
        <strong> créer ou réinitialiser votre mot de passe </strong>.
      </p>
      <p>
        <strong>
          Veuillez consulter votre boîte mail (et vos spams si besoin)
        </strong>
        et suivre les instructions de cet email pour définir votre mot de passe.
      </p>

      <h3>🔗 Accès à l'interface administrateur</h3>
      <p>
        Une fois votre mot de passe défini, vous pourrez vous connecter à
        l'interface administrateur Monmarché à l'adresse suivante :
      </p>
      <p>
        <a
          href="https://monmarhe.web.app/login"
          style="color:#ff6f00; text-decoration:none; font-weight:bold;"
        >
          https://monmarhe.web.app/login
        </a>
      </p>

      <p style="margin-top:24px;">
        Si vous n'êtes pas à l'origine de cette demande ou si vous pensez
        qu'il s'agit d'une erreur, merci de nous contacter immédiatement.
      </p>

      <p style="margin-top:24px;">
        À bientôt,<br>
        <strong>L'équipe Monmarché</strong>
      </p>
    </div>

    <div style="background-color:#f9fafb; color:#6b7280; padding:12px 24px; font-size:12px; text-align:center;">
      Cet email est destiné au nouveau compte administrateur enregistré sur
      Monmarché.
    </div>
  </div>
</div>
`;

  // Template email HTML pour DRIVER
  const driverHtmlTemplate = `
<div style="font-family: Arial, sans-serif; background-color:#f5f5f5; padding:20px;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden;">
    <div style="background-color:#ff6f00; color:#ffffff; padding:16px 24px;">
      <h2 style="margin:0; font-size:20px;">
        Bienvenue dans Monmarché – Accès livreur
      </h2>
    </div>

    <div style="padding:24px;">
      <p>Bonjour,</p>

      <p>
        Vous avez été ajouté comme <strong>Livreur</strong> sur la
        plateforme <strong>Monmarché</strong>.
      </p>

      <p>En tant que livreur, vous pourrez :</p>
      <ul>
        <li>Consulter les commandes qui vous sont attribuées,</li>
        <li>Voir les informations de livraison (adresse, contact, etc.),</li>
        <li>Mettre à jour le statut des livraisons (en cours, livrée, etc.).</li>
      </ul>

      <h3>🔐 Première connexion</h3>
      <p>
        Pour des raisons de sécurité, vous devez
        <strong> définir votre mot de passe </strong>
        avant votre première connexion.
      </p>
      <p>
        Un email séparé vous a été envoyé par notre système
        d'authentification avec un lien pour
        <strong> créer ou réinitialiser votre mot de passe </strong>.
      </p>
      <p>
        <strong>
          Veuillez consulter votre boîte mail (et vos spams si besoin)
        </strong>
        et suivre les instructions de cet email pour définir votre mot de
        passe.
      </p>

      <h3>🚚 Accès à votre espace livreur</h3>
      <p>
        Une fois votre mot de passe défini, vous pourrez vous connecter à
        votre espace livreur à l'adresse suivante :
      </p>
      <p>
        <a
          href="https://monmarhe.web.app/login"
          style="color:#ff6f00; text-decoration:none; font-weight:bold;"
        >
          https://monmarhe.web.app/login
        </a>
      </p>

      <p style="margin-top:24px;">
        Si vous n'êtes pas à l'origine de cette inscription ou si vous
        pensez qu'il s'agit d'une erreur, merci de nous contacter
        immédiatement.
      </p>

      <p style="margin-top:24px;">
        Bonne tournée !<br>
        <strong>L'équipe Monmarché</strong>
      </p>
    </div>

    <div style="background-color:#f9fafb; color:#6b7280; padding:12px 24px; font-size:12px; text-align:center;">
      Cet email est destiné au nouveau compte livreur enregistré sur
      Monmarché.
    </div>
  </div>
</div>
`;
  /**
   * Envoie l'email d'information Monmarché + l'email Firebase de reset mot de passe
   */
  const sendWelcomeEmails = async (email, normalizedRole, htmlTemplate) => {
    const subject =
      normalizedRole === "ADMIN"
        ? "Votre accès administrateur Monmarché"
        : "Votre accès livreur Monmarché";

    // 1️⃣ Envoi email Monmarché (via Firestore /mail)
    try {
      const mailRef = doc(collection(db, "mail"));
      await setDoc(mailRef, {
        to: email,
        message: {
          subject,
          text: "Bienvenue sur Monmarché",
          html: htmlTemplate,
        },
      });
      console.log("📨 Email Monmarché envoyé à :", email);
    } catch (mailErr) {
      console.error("❌ Erreur envoi email Monmarché :", mailErr);
    }

    // 2️⃣ Envoi email Firebase pour définir un mot de passe
    try {
      await sendPasswordResetEmail(auth, email);
      console.log("📧 Email de réinitialisation envoyé à :", email);
    } catch (resetErr) {
      console.error(
        "❌ Erreur sendPasswordResetEmail :",
        resetErr.code,
        resetErr.message
      );
    }
  };

  //wird ausgefÃ¼hrt nach dem Druck auf save Button
  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      if (typeCmp === "users") {
        const { password, category, ...userPayload } = data;
        const normalizedRole = (category || "").toUpperCase();
        const targetCollection = ROLE_COLLECTION_MAP[normalizedRole];

        if (!targetCollection) {
          throw new Error("Veuillez sélectionner un rôle Admin ou Driver.");
        }
        if (!userPayload.email || !password) {
          throw new Error("Email et mot de passe sont obligatoires.");
        }

        // 🔒 Si ADMIN : username obligatoire + unique
        if (normalizedRole === "ADMIN") {
          const username = (userPayload.username || "").trim();
          if (!username) {
            throw new Error(
              "Le nom d'utilisateur est obligatoire pour un administrateur."
            );
          }

          // Vérifier que le username n'est pas déjà utilisé dans la collection admin
          const usernameQuery = query(
            collection(db, "admin"),
            where("username", "==", username),
            limit(1)
          );
          const usernameSnap = await getDocs(usernameQuery);

          if (!usernameSnap.empty) {
            throw new Error(
              "Ce nom d'utilisateur est déjà utilisé par un autre administrateur."
            );
          }
        }

        // 1) Vérifier si cet email existe déjà dans la collection admin/drivers
        const roleQuery = query(
          collection(db, targetCollection),
          where("email", "==", userPayload.email),
          limit(1)
        );
        const roleSnap = await getDocs(roleQuery);

        if (!roleSnap.empty) {
          throw new Error(
            normalizedRole === "ADMIN"
              ? "Un administrateur avec cet email existe déjà."
              : "Un driver avec cet email existe déjà."
          );
        }

        const result = await createStaffAccountCallable({
          email: userPayload.email,
          password,
          role: normalizedRole,
          profile: userPayload,
        });

        const htmlTemplate =
          normalizedRole === "ADMIN" ? adminHtmlTemplate : driverHtmlTemplate;

        await sendWelcomeEmails(userPayload.email, normalizedRole, htmlTemplate);

        const response = result?.data || {};
        const linkedExistingAuthUser = response?.linkedExistingAuthUser === true;

        showFeedback({
          type: "success",
          title: "Opération réussie",
          message: linkedExistingAuthUser
            ? `Le compte existant a été ajouté comme ${
                normalizedRole === "ADMIN" ? "administrateur" : "driver"
              }.`
            : "Le compte a été créé avec succès.",
          afterClose: () => navigate(-1),
        });
        return;
      } else {
        // produits (inchangé)
        await addDoc(collection(db, typeCmp), {
          ...data,
          timeStamp: serverTimestamp(),
          status: false,
        });

        showFeedback({
          type: "success",
          title: "Opération réussie",
          message: "Les données ont été enregistrées avec succès.",
          afterClose: () => navigate(-1),
        });
      }
    } catch (err) {
      console.log(err);
      showFeedback({
        type: "error",
        title: "Échec de l'opération",
        message: formatStaffCreationError(err),
      });
    } finally {
      console.log("We do cleanup here");
    }
  };

  return (
    <>
      <div className="new">
        <Sidebar />
        <div className="newContainer">
          <Navbar />
          <div className="top">
            <h1>{title}</h1>
          </div>
          <div className="bottom">
            <div className="left">
              <img
                src={
                  file
                    ? URL.createObjectURL(file)
                    : "https://icon-library.com/images/no-image-icon/no-image-icon-0.jpg"
                }
                alt=""
                className="image"
              />
            </div>
            <div className="right">
              <form onSubmit={handleAdd}>
                <div className="formInput">
                  <label htmlFor="file">
                    Image <DriveFolderUploadOutlinedIcon className="icon" />
                  </label>
                  <input
                    type="file"
                    id="file"
                    onChange={(e) => setFile(e.target.files[0])}
                    style={{ display: "none" }}
                  />
                </div>
                <div className="formInput">
                  <label>
                    {typeCmp === "users" ? "Role" : `Category ${typeCmp}`}
                    <select
                      label={typeCmp}
                      onChange={handleChange}
                      value={data.category ?? (categories[0] || "")}
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {inputs.map((input) => (
                  <div className="formInput" key={input.id}>
                    <label> {input.label} </label>
                    <input
                      id={input.id}
                      type={input.type}
                      placeholder={input.placeholder}
                      onChange={handleInput}
                    />
                  </div>
                ))}

                {typeCmp === "products" && (
                  <div className="formInput">
                    <label> Description </label>
                    <textarea
                      id="description"
                      label="Description"
                      type="textarea"
                      rows={15}
                      cols={65}
                      onChange={handleInput}
                      placeholder="Product Description"
                      value={data.description}
                    />
                    <div className="formInput">
                      <label>
                        <select label="" onChange={handleChange}>
                          {categorieType.map((item) => (
                            <option value={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}
                <div>
                  <button onClick={onBack} type="submit">
                    back
                  </button>
                </div>
                <div>
                  <button disabled={perc !== null && perc < 100} type="submit">
                    save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
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
export default New;
