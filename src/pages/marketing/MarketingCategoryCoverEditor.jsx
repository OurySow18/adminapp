import "./MarketingPage.scss";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import ConfirmModal from "../../components/modal/ConfirmModal";
import {
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../firebase";

const isHttpImageUrl = (value) =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const getCategoryCoverSource = (category) => {
  if (normalizeString(category?.coverImage)) {
    return { url: category.coverImage, label: "source: coverImage", tone: "green" };
  }
  if (normalizeString(category?.coverImageUrl)) {
    return {
      url: category.coverImageUrl,
      label: "source: coverImageUrl",
      tone: "blue",
    };
  }
  if (normalizeString(category?.imageURL)) {
    return {
      url: category.imageURL,
      label: "source: imageURL (fallback)",
      tone: "blue",
    };
  }
  return { url: "", label: "sans image", tone: "gray" };
};

const resolveCoverPreview = (category, draftCoverImage) => {
  const draft = normalizeString(draftCoverImage);
  if (isHttpImageUrl(draft)) return draft;
  return (
    category?.coverImage ||
    category?.coverImageUrl ||
    category?.imageURL ||
    ""
  );
};

const MarketingCategoryCoverEditor = () => {
  const { categoryId: categoryIdParam } = useParams();
  let categoryId = "";
  try {
    categoryId = decodeURIComponent(categoryIdParam || "");
  } catch (error) {
    categoryId = "";
  }
  const navigate = useNavigate();

  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coverImageInput, setCoverImageInput] = useState("");
  const [formError, setFormError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setCategory(null);
      setLoading(false);
      setError("Catégorie invalide.");
      return undefined;
    }

    setLoading(true);
    setError(null);
    const categoryRef = doc(db, "categories", categoryId);
    const unsubscribe = onSnapshot(
      categoryRef,
      (snap) => {
        if (!snap.exists()) {
          setCategory(null);
          setError("Catégorie introuvable.");
        } else {
          setCategory({ id: snap.id, ...snap.data() });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load category:", err);
        setCategory(null);
        setLoading(false);
        setError("Impossible de charger la catégorie.");
      }
    );

    return () => unsubscribe();
  }, [categoryId]);

  useEffect(() => {
    setCoverImageInput(category?.coverImage || "");
    setFormError(null);
    setSelectedFile(null);
    setUploadError(null);
  }, [category?.id, category?.coverImage]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const previewUrl = resolveCoverPreview(category, coverImageInput);
  const savedCoverValue = normalizeString(category?.coverImage);
  const currentCoverValue = normalizeString(coverImageInput);
  const hasCoverInputChanged = currentCoverValue !== savedCoverValue;
  const hasPendingFile = Boolean(selectedFile);
  const hasUnsavedChanges = Boolean(
    category && (hasCoverInputChanged || hasPendingFile)
  );
  const currentSourceMeta = getCategoryCoverSource(category);
  const hasCoverField = useMemo(
    () =>
      Boolean(normalizeString(category?.coverImage)) ||
      Boolean(normalizeString(category?.coverImageUrl)),
    [category]
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmLeaveIfDirty = () => {
    if (!hasUnsavedChanges || saving || uploading) return true;
    return window.confirm(
      "Vous avez des modifications non enregistrées. Voulez-vous quitter cette page ?"
    );
  };

  const goBackToList = () => {
    if (!confirmLeaveIfDirty()) return;
    navigate("/admin/marketing/categories");
  };

  const handleSave = async () => {
    if (!category) return;

    const trimmed = normalizeString(coverImageInput);
    if (trimmed && !isHttpImageUrl(trimmed)) {
      setFormError(
        "URL invalide. Utilisez une URL commençant par http:// ou https://."
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    setFeedback(null);
    try {
      const payload = { updatedAt: serverTimestamp() };
      if (trimmed) {
        payload.coverImage = trimmed;
      } else {
        payload.coverImage = deleteField();
      }

      await setDoc(doc(db, "categories", category.id), payload, { merge: true });
      setCoverImageInput(trimmed);
      setCategory((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (trimmed) {
          next.coverImage = trimmed;
        } else {
          delete next.coverImage;
        }
        return next;
      });

      setFeedback({
        type: "success",
        message: `Catégorie "${category.name || category.id}" mise à jour.`,
      });
    } catch (err) {
      console.error("Failed to save category cover image:", err);
      setFeedback({
        type: "error",
        message: "Impossible d'enregistrer l'image de couverture.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCover = async () => {
    if (!category) return;
    setSaving(true);
    setFormError(null);
    setUploadError(null);
    setFeedback(null);
    try {
      await setDoc(
        doc(db, "categories", category.id),
        {
          coverImage: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setCoverImageInput("");
      setSelectedFile(null);
      setCategory((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next.coverImage;
        return next;
      });
      setDeleteConfirmOpen(false);
      setFeedback({
        type: "success",
        message: `coverImage supprimé pour "${category.name || category.id}".`,
      });
    } catch (err) {
      console.error("Failed to delete category cover image:", err);
      setDeleteConfirmOpen(false);
      setFeedback({
        type: "error",
        message: "Impossible de supprimer l'image de couverture.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setSelectedFile(null);
      setUploadError("Fichier invalide. Sélectionnez une image (png, jpg, webp...).");
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadFile = async () => {
    if (!category) return;
    if (!selectedFile) {
      setUploadError("Choisissez une image sur votre ordinateur avant de téléverser.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setFeedback(null);
    try {
      const safeName = selectedFile.name.replace(/[^\w.-]+/g, "_");
      const storageRef = ref(
        storage,
        `categories/covers/${category.id}/${Date.now()}-${safeName}`
      );
      await uploadBytes(storageRef, selectedFile);
      const url = await getDownloadURL(storageRef);
      setCoverImageInput(url);
      setSelectedFile(null);
      setFeedback({
        type: "success",
        message:
          "Image téléversée avec succès. Vérifiez l’aperçu puis cliquez sur Enregistrer.",
      });
    } catch (err) {
      console.error("Failed to upload category cover image:", err);
      setUploadError("Impossible de téléverser l'image pour le moment.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="marketingPage">
      <Sidebar />
      <div className="marketingPage__container">
        <Navbar />
        <div className="marketingPage__content">
          <div className="marketingPage__header marketingPage__header--between">
            <div>
              <p className="eyebrow">Marketing / Catégories</p>
              <h1>Modifier la cover catégorie</h1>
              <p className="subtitle">
                Champ Firestore mis à jour: `coverImage` (fallbacks conservés).
              </p>
            </div>
            <div className="marketingPage__listMeta">
              <button
                type="button"
                className="ghost"
                onClick={goBackToList}
                disabled={saving || uploading}
              >
                Retour à la liste
              </button>
            </div>
          </div>

          {hasUnsavedChanges && (
            <div className="feedback feedback--warning" aria-live="polite">
              {hasPendingFile && !hasCoverInputChanged
                ? "Un fichier est sélectionné mais pas encore téléversé/enregistré."
                : "Modifications non enregistrées. Pensez à cliquer sur Enregistrer avant de quitter."}
            </div>
          )}

          {feedback && (
            <div
              className={`feedback feedback--${feedback.type || "success"}`}
              aria-live="polite"
            >
              {feedback.message}
            </div>
          )}

          {loading ? (
            <div className="marketingPage__list">
              <p className="helper">Chargement de la catégorie...</p>
            </div>
          ) : error || !category ? (
            <div className="marketingPage__list">
              <p className="error">{error || "Catégorie introuvable."}</p>
              <div className="formActions">
                <button
                  type="button"
                  onClick={goBackToList}
                >
                  Revenir à la liste
                </button>
              </div>
            </div>
          ) : (
            <div className="marketingPage__form">
              <div className="marketingPage__header marketingPage__header--between">
                <div>
                  <p className="eyebrow">Édition</p>
                  <h2>{category.name || category.id}</h2>
                  <p className="subtitle">
                    Ajoutez `coverImage` (prioritaire), compatibilité avec `coverImageUrl` / `imageURL`.
                  </p>
                </div>
              </div>

              <div className="categoryEditor">
                <div className="formGrid">
                  <div className="formRow">
                    <label>ID</label>
                    <input type="text" value={category.id} readOnly />
                  </div>
                  <div className="formRow">
                    <label>Nom</label>
                    <input type="text" value={category.name || ""} readOnly />
                  </div>
                  <div className="formRow">
                    <label>Ordre</label>
                    <input type="text" value={category.order ?? ""} readOnly />
                  </div>
                  <div className="formRow">
                    <label>Parent ID</label>
                    <input type="text" value={category.parentId || ""} readOnly />
                  </div>
                  <div className="formRow">
                    <label>Image existante (`imageURL`)</label>
                    <input type="text" value={category.imageURL || ""} readOnly />
                  </div>
                  <div className="formRow">
                    <label>Image existante (`coverImageUrl`)</label>
                    <input type="text" value={category.coverImageUrl || ""} readOnly />
                  </div>
                  <div className="formRow categoryEditor__wide">
                    <label>Image de couverture (URL)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={coverImageInput}
                      onChange={(e) => {
                        setCoverImageInput(e.target.value);
                        if (formError) setFormError(null);
                      }}
                    />
                    <span className="helper">
                      Recommandé: image rectangulaire verticale ou carrée, fond clair.
                    </span>
                    {formError ? (
                      <span className="helper helper--error">{formError}</span>
                    ) : null}
                  </div>
                  <div className="formRow categoryEditor__wide">
                    <label>Téléverser depuis l’ordinateur</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                    <div className="categoryEditor__uploadRow">
                      <button
                        type="button"
                        className="ghost secondary"
                        onClick={handleUploadFile}
                        disabled={uploading || !selectedFile}
                      >
                        {uploading ? "Téléversement..." : "Téléverser l'image"}
                      </button>
                      <span className="helper">
                        {selectedFile
                          ? `Fichier sélectionné: ${selectedFile.name}`
                          : "Aucun fichier sélectionné"}
                      </span>
                    </div>
                    {uploadError ? (
                      <span className="helper helper--error">{uploadError}</span>
                    ) : null}
                    <span className="helper">
                      Le téléversement remplit automatiquement le champ URL `coverImage`.
                    </span>
                  </div>
                </div>

                <div className="categoryEditor__preview">
                  <div className="categoryEditor__previewHeader">
                    <h3>Aperçu</h3>
                    <button
                      type="button"
                      className="ghost secondary"
                      onClick={() => setCoverImageInput(previewUrl || "")}
                      disabled={!previewUrl}
                    >
                      Tester dans la Home
                    </button>
                  </div>
                  {isHttpImageUrl(previewUrl) ? (
                    <img
                      src={previewUrl}
                      alt={`Aperçu ${category.name || category.id}`}
                      className="imagePreview__img categoryEditor__previewImg"
                    />
                  ) : (
                    <div className="categoryEditor__previewFallback">
                      Aucune image prévisualisable (URL coverImage invalide ou absente).
                    </div>
                  )}
                  <div className="categoryEditor__previewMeta">
                    <span className="pill pill--blue">
                      Priorité mobile: coverImage → coverImageUrl → fallback local
                    </span>
                    <span
                      className={`pill ${
                        currentSourceMeta.tone === "green"
                          ? "pill--green"
                          : currentSourceMeta.tone === "blue"
                          ? "pill--blue"
                          : "pill--gray"
                      }`}
                    >
                      {currentSourceMeta.label}
                    </span>
                    {!hasCoverField ? (
                      <span className="pill pill--gray">
                        Aucune image de couverture définie
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="formActions">
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={saving || uploading || !savedCoverValue}
                  >
                    Supprimer la cover
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || uploading}
                  >
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        open={deleteConfirmOpen}
        title="Supprimer la cover"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteCover}
        confirmText="Supprimer"
        cancelText="Annuler"
        loading={saving}
      >
        <p className="helper">
          Cette action supprimera le champ `coverImage` de la catégorie.
        </p>
        <p className="helper">
          Les champs `coverImageUrl` et `imageURL` (si présents) resteront
          inchangés.
        </p>
      </ConfirmModal>
    </div>
  );
};

export default MarketingCategoryCoverEditor;
