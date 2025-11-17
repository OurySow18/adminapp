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
import { auth, db, storage } from "../../firebase";
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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";

//Array fÃ¼r die User Kategorie
const categorieUser = ["ADMIN", "DRIVER"];
const ROLE_COLLECTION_MAP = {
  ADMIN: "admin",
  DRIVER: "drivers",
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

        let uid;

        // 2) Essayer de créer l'utilisateur dans Auth
        try {
          const res = await createUserWithEmailAndPassword(
            auth,
            userPayload.email,
            password
          );
          uid = res.user.uid;

          await setDoc(doc(db, targetCollection, uid), {
            ...userPayload,
            role: normalizedRole,
            timeStamp: serverTimestamp(),
            status: true,
          });

          showFeedback({
            type: "success",
            title: "Opération réussie",
            message: "Le compte a été créé avec succès.",
            afterClose: () => navigate(-1),
          });
          return;
        } catch (err) {
          // 3) Email déjà utilisé dans Firebase Auth
          if (err.code === "auth/email-already-in-use") {
            const userQuery = query(
              collection(db, "users"),
              where("email", "==", userPayload.email),
              limit(1)
            );
            const userSnap = await getDocs(userQuery);

            if (userSnap.empty) {
              throw new Error(
                "Cet email est déjà utilisé dans le système, mais aucun utilisateur associé n'a été trouvé dans la collection 'users'."
              );
            }

            const existingUserDoc = userSnap.docs[0];
            uid = existingUserDoc.id;

            // Popup de confirmation customisé
            showFeedback({
              type: "info",
              title: "Utilisateur existant",
              message: `Cet email est déjà utilisé par un autre compte.\n\nVoulez-vous quand même l'ajouter comme ${
                normalizedRole === "ADMIN" ? "administrateur" : "driver"
              } ?`,
              actions: (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleFeedbackClose}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      handleFeedbackClose();
                      try {
                        await setDoc(doc(db, targetCollection, uid), {
                          ...userPayload,
                          role: normalizedRole,
                          timeStamp: serverTimestamp(),
                          status: true,
                        });

                        showFeedback({
                          type: "success",
                          title: "Opération réussie",
                          message: `L'utilisateur existant a été ajouté comme ${
                            normalizedRole === "ADMIN"
                              ? "administrateur."
                              : "driver."
                          }`,
                          afterClose: () => navigate(-1),
                        });
                      } catch (e) {
                        console.error(e);
                        showFeedback({
                          type: "error",
                          title: "Échec de l'opération",
                          message:
                            e?.message ||
                            "Une erreur est survenue lors de l'ajout de l'utilisateur.",
                        });
                      }
                    }}
                  >
                    Oui, l'ajouter
                  </button>
                </>
              ),
            });

            return;
          }

          throw err;
        }
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
        message:
          err?.message ||
          "Une erreur inattendue est survenue. Merci de réessayer.",
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
