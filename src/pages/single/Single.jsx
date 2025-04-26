import "./single.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import Chart from "../../components/chart/Chart";
import ListCommande from "../../components/table/Table";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

const Single = ({ title }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const defaultImage = "https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/Profile_neutre.png?alt=media&token=2ffd92da-f2c7-436c-9f2a-84dc2152e0f6"

  // Récupération des données d'un document spécifique
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, title, params.id),
      (docSnap) => {
        setData(docSnap.data());
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de la récupération :", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [title, params.id]);

  const handleToggleStatus = async () => {
    try {
      await updateDoc(doc(db, title, params.id), {
        status: !data.status,
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut :", err);
    }
  };

  if (loading || !data) {
    return <div>Chargement en cours...</div>;
  }

  return (
    <div className="single">
      <Sidebar />
      <div className="singleContainer">
        <Navbar />
        <div className="top">
          <div className="left">
            <div className="editButton" onClick={handleToggleStatus}>
              {data.status ? "Désactiver" : "Activer"}
            </div>
            <h1 className="title">Informations</h1>
            <div className="item">
              <img
                src={data.img || defaultImage}
                alt="Profil"
                className="itemImg"
              />
              <div className="details">
                <h2 className="itemTitle">{data.username || data.name || "Nom inconnu"}</h2>
                <div className="detailItem">
                  <span className="itemKey">Email :</span>
                  <span className="itemValue">{data.email || "N/A"}</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">Téléphone :</span>
                  <span className="itemValue">{data.phone || "N/A"}</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">Adresse :</span>
                  <span className="itemValue">{data.addresse || "N/A"}</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">Pays :</span>
                  <span className="itemValue">{data.country || "N/A"}</span>
                </div>
                <div className="detailItem">
                  <span className="itemKey">Statut :</span>
                  <span className="itemValue">
                    {data.status ? "Actif" : "Désactivé"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="right">
            <Chart
              aspect={3 / 1}
              title="Dépenses utilisateur (6 derniers mois)"
            />
          </div>
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
