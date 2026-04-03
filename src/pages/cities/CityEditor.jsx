import "./cityEditor.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getDoc, runTransaction } from "firebase/firestore";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { db } from "../../firebase";
import {
  buildCityItemId,
  findCityById,
  getCitiesConfigRef,
  normalizeCitiesDocument,
  normalizeCityItem,
  sortCityItems,
} from "../../utils/citiesConfig";

const initialForm = {
  city: "",
  region: "",
  type: "Chef-lieu de prefecture",
};

const CityEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isCreateMode = id === "new";
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({
    open: false,
    type: "info",
    title: "",
    message: "",
    afterClose: null,
  });

  useEffect(() => {
    if (isCreateMode) {
      setFormData(initialForm);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadCity = async () => {
      setLoading(true);
      try {
        const citiesRef = getCitiesConfigRef(db);
        const citiesSnapshot = await getDoc(citiesRef);
        const citiesData = citiesSnapshot.exists() ? citiesSnapshot.data() || {} : {};
        const citiesDocument = normalizeCitiesDocument(citiesData);
        const cityItem = findCityById(citiesDocument.items, id);

        if (!cityItem) {
          if (!cancelled) {
            setFeedback({
              open: true,
              type: "error",
              title: "Ville introuvable",
              message: "Le document demande n'existe pas.",
              afterClose: () => navigate("/cities"),
            });
          }
          return;
        }

        if (!cancelled) {
          setFormData({
            city: cityItem.city || "",
            region: cityItem.region || "",
            type: cityItem.type || "Chef-lieu de prefecture",
          });
        }
      } catch (error) {
        console.error("Erreur chargement ville:", error);
        if (!cancelled) {
          setFeedback({
            open: true,
            type: "error",
            title: "Chargement impossible",
            message: "La ville n'a pas pu etre chargee.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCity();

    return () => {
      cancelled = true;
    };
  }, [id, isCreateMode, navigate]);

  const pageTitle = useMemo(
    () => (isCreateMode ? "Ajouter une ville" : "Modifier une ville"),
    [isCreateMode]
  );

  const handleInputChange = (event) => {
    const { id: fieldId, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const closeFeedback = () => {
    const afterClose = feedback.afterClose;
    setFeedback((prev) => ({
      ...prev,
      open: false,
      afterClose: null,
    }));
    if (typeof afterClose === "function") {
      afterClose();
    }
  };

  const validateForm = () => {
    if (!formData.city.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Ville requise",
        message: "Le nom de la ville est obligatoire.",
      });
      return false;
    }

    if (!formData.region.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Region requise",
        message: "La region est obligatoire.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || !validateForm()) return;

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();

      if (isCreateMode) {
        const newItem = normalizeCityItem({
          id: buildCityItemId(formData.city, formData.region),
          city: formData.city,
          region: formData.region,
          type: formData.type,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        const citiesRef = getCitiesConfigRef(db);

        await runTransaction(db, async (transaction) => {
          const citiesSnapshot = await transaction.get(citiesRef);
          const citiesData = citiesSnapshot.exists() ? citiesSnapshot.data() || {} : {};
          const citiesDocument = normalizeCitiesDocument(citiesData);

          if (findCityById(citiesDocument.items, newItem.id)) {
            throw new Error("duplicate_city");
          }

          const nextItems = sortCityItems([...citiesDocument.items, newItem]);

          transaction.set(
            citiesRef,
            {
              items: nextItems,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        });

        setFeedback({
          open: true,
          type: "success",
          title: "Ville creee",
          message: "La nouvelle ville a ete ajoutee dans Firestore.",
          afterClose: () => navigate("/cities"),
        });
        return;
      }

      const citiesRef = getCitiesConfigRef(db);
      await runTransaction(db, async (transaction) => {
        const citiesSnapshot = await transaction.get(citiesRef);
        const citiesData = citiesSnapshot.exists() ? citiesSnapshot.data() || {} : {};
        const citiesDocument = normalizeCitiesDocument(citiesData);
        const currentItem = findCityById(citiesDocument.items, id);

        if (!currentItem) {
          throw new Error("city_not_found");
        }

        const nextId = buildCityItemId(formData.city, formData.region);
        const duplicateItem = citiesDocument.items.find(
          (item) => item.id === nextId && item.id !== id
        );
        if (duplicateItem) {
          throw new Error("duplicate_city");
        }

        const updatedItem = normalizeCityItem({
          ...currentItem,
          id: nextId,
          city: formData.city,
          region: formData.region,
          type: formData.type,
          updatedAt: nowIso,
        });

        const nextItems = sortCityItems(
          citiesDocument.items.map((item) => (item.id === id ? updatedItem : item))
        );

        transaction.set(
          citiesRef,
          {
            items: nextItems,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      });

      setFeedback({
        open: true,
        type: "success",
        title: "Ville mise a jour",
        message: "Les modifications ont ete enregistrees.",
        afterClose:
          id !== buildCityItemId(formData.city, formData.region)
            ? () => navigate(`/cities/${buildCityItemId(formData.city, formData.region)}`)
            : null,
      });
    } catch (error) {
      console.error("Erreur enregistrement ville:", error);
      const message =
        error?.message === "duplicate_city"
          ? "Une ville avec ce nom et cette region existe deja."
          : error?.message === "city_not_found"
            ? "La ville demandee n'existe plus dans le document partage."
            : "La ville n'a pas pu etre enregistree.";
      setFeedback({
        open: true,
        type: "error",
        title: "Enregistrement impossible",
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isCreateMode || saving) return;

    const confirmed = window.confirm(
      "Confirmer la suppression de cette ville ? Cette action est irreversible."
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const citiesRef = getCitiesConfigRef(db);
      await runTransaction(db, async (transaction) => {
        const citiesSnapshot = await transaction.get(citiesRef);
        const citiesData = citiesSnapshot.exists() ? citiesSnapshot.data() || {} : {};
        const citiesDocument = normalizeCitiesDocument(citiesData);
        const nextItems = citiesDocument.items.filter((item) => item.id !== id);

        if (nextItems.length === citiesDocument.items.length) {
          throw new Error("city_not_found");
        }

        transaction.set(
          citiesRef,
          {
            items: nextItems,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
      setFeedback({
        open: true,
        type: "success",
        title: "Ville supprimee",
        message: "La ville a ete supprimee du document partage des villes.",
        afterClose: () => navigate("/cities"),
      });
    } catch (error) {
      console.error("Erreur suppression ville:", error);
      const message =
        error?.message === "city_not_found"
          ? "La ville demandee n'existe plus dans le document partage."
          : "La ville n'a pas pu etre supprimee.";
      setFeedback({
        open: true,
        type: "error",
        title: "Suppression impossible",
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cityEditor">
      <Sidebar />
      <div className="cityEditor__content">
        <Navbar />
        <div className="cityEditor__card">
          <div className="cityEditor__top">
            <div>
              <h1>{pageTitle}</h1>
              <p>Document cible: `app_config/cities`</p>
            </div>
            <Link to="/cities" className="cityEditor__backLink">
              Retour a la liste
            </Link>
          </div>

          <div className="cityEditor__body">
            {loading ? (
              <div className="cityEditor__loading">Chargement...</div>
            ) : (
              <form onSubmit={handleSubmit} className="cityEditor__form">
                {!isCreateMode && (
                  <div className="cityEditor__field">
                    <label>ID document</label>
                    <input type="text" value={id || ""} disabled />
                  </div>
                )}

                <div className="cityEditor__field">
                  <label>Ville</label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Conakry"
                  />
                </div>

                <div className="cityEditor__field">
                  <label>Region</label>
                  <input
                    id="region"
                    type="text"
                    value={formData.region}
                    onChange={handleInputChange}
                    placeholder="Conakry"
                  />
                </div>

                <div className="cityEditor__field">
                  <label>Type</label>
                  <input
                    id="type"
                    type="text"
                    value={formData.type}
                    onChange={handleInputChange}
                    placeholder="Chef-lieu de prefecture"
                  />
                </div>

                <div className="cityEditor__actions">
                  {!isCreateMode && (
                    <button
                      type="button"
                      className="cityEditor__dangerButton"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      Supprimer
                    </button>
                  )}
                  <button
                    type="button"
                    className="cityEditor__secondaryButton"
                    onClick={() => navigate("/cities")}
                    disabled={saving}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="cityEditor__primaryButton"
                    disabled={saving}
                  >
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <FeedbackPopup
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
      />
    </div>
  );
};

export default CityEditor;
