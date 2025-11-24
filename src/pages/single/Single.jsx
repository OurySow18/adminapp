import "./single.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ListCommande from "../../components/table/Table";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth, storage } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const Single = ({ title }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    surname: "",
    email: "",
    phone: "",
    addresse: "",
    country: "",
  });
  const [saveState, setSaveState] = useState({
    saving: false,
    error: null,
    success: null,
  });
  const [passwordResetState, setPasswordResetState] = useState({
    loading: false,
    error: null,
    success: null,
  });
  const [avatarUploadState, setAvatarUploadState] = useState({
    uploading: false,
    error: null,
    success: null,
    progress: 0,
  });
  const params = useParams();
  const defaultImage =
    "https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/Profile_neutre.png?alt=media&token=2ffd92da-f2c7-436c-9f2a-84dc2152e0f6";
  const editableFields = useMemo(
    () => ["username", "surname", "email", "phone", "addresse", "country"],
    []
  );
  const roleLabels = {
    admin: "Administrateur",
    drivers: "Livreur Monmarche",
    users: "Utilisateur Monmarche",
  };
  const roleLabel = roleLabels[title] || roleLabels.users;

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, title, params.id),
      (docSnap) => {
        setData(docSnap.data());
        setLoading(false);
        setSaveState({ saving: false, error: null, success: null });
        const snapshotData = docSnap.data() || {};
        setFormData((prev) => ({
          ...prev,
          ...editableFields.reduce(
            (acc, field) => ({ ...acc, [field]: snapshotData[field] || "" }),
            {}
          ),
        }));
      },
      (error) => {
        console.error("Erreur lors de la récupération :", error);
        setLoading(false);
        setSaveState({
          saving: false,
          error: "Impossible de récupérer les données.",
          success: null,
        });
      }
    );

    return () => unsub();
  }, [title, params.id, editableFields]);

  const handleToggleStatus = async () => {
    try {
      await updateDoc(doc(db, title, params.id), {
        status: !data.status,
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut :", err);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!data.email) {
      setPasswordResetState({
        loading: false,
        error: "Aucune adresse email n'est associée à ce compte.",
        success: null,
      });
      return;
    }
    setPasswordResetState({ loading: true, error: null, success: null });
    try {
      await sendPasswordResetEmail(auth, data.email);
      setPasswordResetState({
        loading: false,
        error: null,
        success: `Un email de réinitialisation a été envoyé à ${data.email}.`,
      });
    } catch (err) {
      console.error("Erreur lors de l'envoi du mail de réinitialisation :", err);
      setPasswordResetState({
        loading: false,
        error:
          err?.message ||
          "Impossible d'envoyer l'email de réinitialisation. Réessayez.",
        success: null,
      });
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaveState({ saving: true, error: null, success: null });
    try {
      const payload = editableFields.reduce((acc, field) => {
        if (Object.prototype.hasOwnProperty.call(formData, field)) {
          acc[field] = formData[field] ?? "";
        }
        return acc;
      }, {});
      await updateDoc(doc(db, title, params.id), payload);
      setSaveState({
        saving: false,
        error: null,
        success: "Données mises à jour avec succès.",
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour des données :", err);
      setSaveState({
        saving: false,
        error:
          err?.message || "Une erreur est survenue lors de l'enregistrement.",
        success: null,
      });
    }
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !params.id) return;
    const safeName = file.name.replace(/\s+/g, "_");
    const storagePath = `profile_photos/${params.id}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    setAvatarUploadState({
      uploading: true,
      error: null,
      success: null,
      progress: 0,
    });

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) ||
          0;
        setAvatarUploadState((prev) => ({
          ...prev,
          progress,
        }));
      },
      (error) => {
        console.error("Erreur upload photo:", error);
        setAvatarUploadState({
          uploading: false,
          error:
            error?.message ||
            "Impossible de téléverser la photo. Veuillez réessayer.",
          success: null,
          progress: 0,
        });
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, title, params.id), {
            img: downloadURL,
          });
          setAvatarUploadState({
            uploading: false,
            error: null,
            success: "Photo de profil mise à jour.",
            progress: 100,
          });
        } catch (err) {
          console.error("Erreur mise à jour photo:", err);
          setAvatarUploadState({
            uploading: false,
            error:
              err?.message ||
              "La photo a été envoyée mais n'a pas pu être enregistrée.",
            success: null,
            progress: 0,
          });
        }
      }
    );
  };

  if (loading || !data) {
    return <div>Chargement en cours...</div>;
  }

  const identityName = data.username || data.name || "Nom inconnu";
  const statusLabel = data.status ? "Actif" : "Désactivé";
  const infoRows = [
    { label: "Email", value: data.email || "N/A" },
    { label: "Téléphone", value: data.phone || "N/A" },
    { label: "Adresse", value: data.addresse || "N/A" },
    { label: "Pays", value: data.country || "N/A" },
  ];
  if (title === "drivers") {
    infoRows.push({
      label: "Zone",
      value: data.zone || data.deliveryZone || "N/A",
    });
  }

  return (
    <div className="single">
      <Sidebar />
      <div className="singleContainer">
        <Navbar />
        <div className="top">
          <section className="card card--profile">
            <header className="card__header">
              <div>
                <p className="card__eyebrow">{roleLabel}</p>
                <h1>{identityName}</h1>
                <p className="card__muted">ID #{params.id}</p>
              </div>
              <div className="card__actions">
                <span
                  className={`statusChip ${
                    data.status ? "statusChip--active" : "statusChip--inactive"
                  }`}
                >
                  {statusLabel}
                </span>
                <button
                  type="button"
                  className="primaryButton primaryButton--ghost"
                  onClick={handleToggleStatus}
                >
                  {data.status ? "Désactiver le compte" : "Activer le compte"}
                </button>
                <button
                  type="button"
                  className="primaryButton primaryButton--solid"
                  onClick={handleSendPasswordReset}
                  disabled={passwordResetState.loading}
                >
                  {passwordResetState.loading
                    ? "Envoi..."
                    : "Réinitialiser le mot de passe"}
                </button>
              </div>
            </header>
            {(passwordResetState.error || passwordResetState.success) && (
              <p
                className={`card__notice ${
                  passwordResetState.error
                    ? "card__notice--error"
                    : "card__notice--success"
                }`}
              >
                {passwordResetState.error || passwordResetState.success}
              </p>
            )}
              <div className="card__body">
                <div className="profileMain">
                  <img
                    src={data.img || defaultImage}
                    alt={identityName}
                    className="profileMain__avatar"
                  />
                  <div className="profileMain__contact">
                    <p>Contact principal</p>
                    <a href={`mailto:${data.email || ""}`}>
                      {data.email || "Adresse non fournie"}
                    </a>
                    <span>{data.phone || "Téléphone non renseigné"}</span>
                    <label
                      className={`uploadButton ${
                        avatarUploadState.uploading
                          ? "uploadButton--disabled"
                          : ""
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={avatarUploadState.uploading}
                      />
                      {avatarUploadState.uploading
                        ? `Téléchargement ${avatarUploadState.progress}%`
                        : "Changer la photo"}
                    </label>
                    {(avatarUploadState.error ||
                      avatarUploadState.success) && (
                      <span
                        className={`uploadButton__feedback ${
                          avatarUploadState.error
                            ? "uploadButton__feedback--error"
                            : "uploadButton__feedback--success"
                        }`}
                      >
                        {avatarUploadState.error ||
                          avatarUploadState.success}
                      </span>
                    )}
                  </div>
                </div>
              <dl className="profileDetails">
                {infoRows.map((row) => (
                  <div className="profileDetails__row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="card card--edit">
            <header className="card__header card__header--compact">
              <div>
                <p className="card__eyebrow">Edition</p>
                <h2>Modifier les informations</h2>
              </div>
            </header>
            <p className="card__muted">
              Mettez à jour les données visibles sur la fiche. Chaque
              modification est enregistrée instantanément dans Firestore.
            </p>
            <form className="editForm" onSubmit={handleSubmit}>
              <label>
                Identifiant
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Identifiant"
                />
              </label>
              <label>
                Nom et prénom
                <input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleInputChange}
                  placeholder="Nom complet"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="adresse@email.com"
                />
              </label>
              <label>
                Téléphone
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+224 ..."
                />
              </label>
              <label>
                Adresse
                <input
                  type="text"
                  name="addresse"
                  value={formData.addresse}
                  onChange={handleInputChange}
                  placeholder="Adresse complète"
                />
              </label>
              <label>
                Pays
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  placeholder="Pays"
                />
              </label>
              {saveState.error && (
                <p className="editForm__message editForm__message--error">
                  {saveState.error}
                </p>
              )}
              {saveState.success && (
                <p className="editForm__message editForm__message--success">
                  {saveState.success}
                </p>
              )}
              <button type="submit" disabled={saveState.saving}>
                {saveState.saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </section>
        </div>
        <div className="bottom">
          <h1 className="title">Historique</h1>
          <ListCommande userId={params.id} />
        </div>
      </div>
    </div>
  );
};

export default Single;
