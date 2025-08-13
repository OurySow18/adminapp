import "./gameDetails_test.scss";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../../firebase";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const GameDetails_test = () => {
  const { code } = useParams();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const ref = doc(db, "game", code);
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          setGameData(snapshot.data());
        } else {
          setGameData(null);
        }
      } catch (e) {
        console.error("Erreur récupération code :", e);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [code]);

  if (loading) {
    return <div className="loader">Chargement...</div>;
  }

  if (!gameData) {
    return (
      <div className="error">
        Code introuvable.
        <br />
        <Link to="/game" className="backButton">
          <ArrowBackIcon /> Retour
        </Link>
      </div>
    );
  }
  const goBack = () => {
    navigate("/game"); // Rediriger vers la page des produits
  };

  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="gameDetails">
          <h1>
            <EmojiEventsIcon style={{ color: "#ff6f00", marginRight: 8 }} />
            Détails du Code Concours
          </h1>
          <div className="card">
            <p>
              <strong>Code :</strong> {gameData.code}
            </p>
            <p>
              <strong>Pseudo :</strong> {gameData.pseudo}
            </p>
            <p>
              <strong>Points :</strong> {gameData.points}
            </p>
            <p>
              <strong>Date de création :</strong>{" "}
              {gameData.createdAt?.toDate
                ? gameData.createdAt.toDate().toLocaleString()
                : "-"}
            </p>
            <p>
              <strong>Nombre de validations :</strong>{" "}
              {gameData.usedBy?.length || 0}
            </p>
          </div>

          <h2>Utilisateurs ayant validé ce code</h2>
          {gameData.usedBy && gameData.usedBy.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>UID</th>
                </tr>
              </thead>
              <tbody>
                {gameData.usedBy.map((user, idx) => (
                  <tr key={idx}>
                    <td>{user.email}</td>
                    <td>{user.uid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Aucun utilisateur n'a encore validé ce code.</p>
          )}
        </div>
      </div>

      <div>
        <button onClick={goBack}>Revenir en arrière</button>
      </div>
    </div>
  );
};

export default GameDetails_test;
