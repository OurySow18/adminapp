import "./gameList.scss";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  startAfter,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SearchIcon from "@mui/icons-material/Search";

const GameList = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [history, setHistory] = useState([]);
  const [hasNext, setHasNext] = useState(true);
  const [hasPrev, setHasPrev] = useState(false);
  const [search, setSearch] = useState("");

  const PAGE_SIZE = 20;

  const fetchFirstPage = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "game"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setCodes([]);
        setHasNext(false);
        setHasPrev(false);
      } else {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCodes(data);
        setFirstVisible(snapshot.docs[0]);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasNext(snapshot.docs.length === PAGE_SIZE);
        setHasPrev(false);
        setHistory([]);
      }
    } catch (e) {
      console.error("Erreur:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextPage = async () => {
    if (!lastVisible) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "game"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setHasNext(false);
      } else {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCodes(data);
        setFirstVisible(snapshot.docs[0]);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHistory((prev) => [...prev, firstVisible]);
        setHasPrev(true);
        setHasNext(snapshot.docs.length === PAGE_SIZE);
      }
    } catch (e) {
      console.error("Erreur:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrevPage = async () => {
    if (history.length === 0) return;
    const prevCursor = history[history.length - 1];
    setLoading(true);
    try {
      const q = query(
        collection(db, "game"),
        orderBy("createdAt", "desc"),
        startAfter(prevCursor),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCodes(data);
        setFirstVisible(snapshot.docs[0]);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        const newHistory = [...history];
        newHistory.pop();
        setHistory(newHistory);
        setHasPrev(newHistory.length > 0);
        setHasNext(true);
      }
    } catch (e) {
      console.error("Erreur:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (search.trim() === "") {
      fetchFirstPage();
      return;
    }
    setLoading(true);
    try {
      const normalized = search.trim().toLowerCase();
      const q = query(
        collection(db, "game"),
        where("normalizedPseudo", "==", normalized)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setCodes([]);
      } else {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCodes(data);
        setHasNext(false);
        setHasPrev(false);
      }
    } catch (e) {
      console.error("Erreur recherche:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirstPage();
  }, []);

  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="gameList">
          <h1>
            <EmojiEventsIcon style={{ color: "#ff6f00", marginRight: 8 }} />
            Gestion du Jeu Concours
          </h1>

          {/* Search bar */}
          <div className="searchBar">
            <input
              type="text"
              placeholder="Rechercher un pseudo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={handleSearch} className="button">
              <SearchIcon />
            </button>
          </div>

          {loading ? (
            <div className="loader">Chargement...</div>
          ) : (
            <>
              {codes.length === 0 ? (
                <p style={{ textAlign: "center" }}>Aucune donnée disponible.</p>
              ) : (
                <>
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Pseudo</th>
                        <th>Points</th>
                        <th>Utilisateurs</th>
                        <th>Créé le</th>
                        <th>Détails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map((item) => (
                        <tr key={item.id}>
                          <td>{item.code}</td>
                          <td>{item.pseudo}</td>
                          <td>{item.points}</td>
                          <td>{item.usedBy?.length || 0}</td>
                          <td>
                            {item.createdAt?.toDate
                              ? item.createdAt.toDate().toLocaleDateString()
                              : "-"}
                          </td>
                          <td>
                            <Link to={`/game/${item.code}`}>
                              <button className="detailsButton">Voir</button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {search.trim() === "" && (
                    <div className="paginationControls">
                      <button
                        className="pageButton"
                        onClick={fetchPrevPage}
                        disabled={!hasPrev}
                      >
                        Précédent
                      </button>
                      <button
                        className="pageButton"
                        onClick={fetchNextPage}
                        disabled={!hasNext}
                      >
                        Suivant
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameList;
