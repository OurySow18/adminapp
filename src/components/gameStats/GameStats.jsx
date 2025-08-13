import "./gameStats.scss";
import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useParams } from "react-router-dom"; // Importez le composant Link depuis React Router
import { DataGrid } from "@mui/x-data-grid";
import {
  getDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  collection as col,
  updateDoc
} from "firebase/firestore"; // Ajoute ces fonctions
import * as XLSX from "xlsx";

const GameStats = ({ typeColumns }) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);

  // Récupère les données de Firestore et met à jour l'état local
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "game"),
      (snapshot) => {
        let list = [];
        snapshot.docs.forEach((doc) => {
          const gamers = doc.data();
          list.push({ id: doc.id, ...gamers });
        });
        // Triez les données par date décroissante
        list.sort((a, b) => b.points - a.points);
        setData(list);
        setCount(list.length);
      },
      (error) => {
        console.log("Error fetching data: ", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

const copyCollection = async () => {
  const confirmed = window.confirm(
    "Cette opération va écraser la collection 'gameTest'. Voulez-vous continuer ?"
  );
  if (!confirmed) return;

  try {
   /* const gameTestRef = col(db, "gameTest");
    const gameTestSnapshot = await getDocs(gameTestRef);
    for (const docSnap of gameTestSnapshot.docs) {
      await deleteDoc(doc(db, "gameTest", docSnap.id));
    }*/

    const gameRef = col(db, "gameTest");
    const gameSnapshot = await getDocs(gameRef);
    for (const docSnap of gameSnapshot.docs) {
      await setDoc(doc(db, "game", docSnap.id), docSnap.data());
    }

    alert("La collection a été copiée avec succès !");
  } catch (err) {
    console.error("Erreur lors de la copie :", err); // ← regarde ici dans la console
    alert("Une erreur est survenue pendant la copie !");
  }
};

const verifyUsers = async () => {
  try {
    const gameTestRef = col(db, "gameTest");
    const gameTestSnap = await getDocs(gameTestRef);

    const topGamers = gameTestSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5); // Les 5 meilleurs

    console.log("🎮 Vérification des 5 meilleurs joueurs :\n");

    for (const gamer of topGamers) {
      const code = gamer.code;
      const pseudo = gamer.normalizedPseudo || "(pseudo inconnu)";
      const usedBy = gamer.usedBy || [];

      let total = usedBy.length;
      let valid = 0;

      for (const entry of usedBy) {
        const uid = entry.uid;
        if (!uid) continue;

        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.validatedCode === code) {
            valid++;
          }
        }
      }

      console.log(`👤 ${pseudo}`);
      console.log(`   → Utilisateurs ayant entré le code : ${total}`);
      console.log(`   → Utilisateurs encore valides (compte + code OK) : ${valid}`);
      console.log(`   → Inactifs ou supprimés : ${total - valid}\n`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la vérification :", error);
  }
};


 
  const actionColumn = [
    {
      field: "action",
      headername: "Action",
      width: 200,
      renderCell: (params) => {
        return (
          <div className="cellAction">
            <Link
              to={{ pathname: params.id }}
              style={{ textDecoration: "none" }}
            >
              <div className="viewButton">Details</div>
            </Link>
          </div>
        );
      },
    },
  ];
    const exportGamePointsExcel = async () => {
      try {
        const snapshot = await getDocs(collection(db, "gameTest"));
  
        const data = [];
  
        snapshot.forEach((doc) => {
          const d = doc.data();
          data.push({
            pseudo: d.pseudo || "",
            normalizedPseudo: d.normalizedPseudo || "",
            points: d.points || 0,
            pointJuly: d.pointJuly || 0,
            nombreUsedBy: Array.isArray(d.usedBy) ? d.usedBy.length : 0,
          });
        });
  
        // ✅ Trie les données par points décroissants
        data.sort((a, b) => b.points - a.points);
  
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Points");
  
        const excelBuffer = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
        });
  
        const blob = new Blob([excelBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
  
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "monmarche-points.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Erreur d’export Excel :", err);
        alert("Une erreur est survenue lors de l’exportation Excel.");
      }
    };
    
      const resetGameForAugust = async () => {
        const confirmed = window.confirm(
          "Cette opération va réinitialiser tous les points des joueurs et archiver les points de Juillet. Voulez-vous continuer ?"
        );
        if (!confirmed) return;
    
        try {
          const gameTestRef = collection(db, "game");
          const snapshot = await getDocs(gameTestRef);
    
          const updates = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
    
            // Archive les points actuels
            const archivedPoints = data.points || 0;
    
            // Mise à jour de usedBy avec validatedIn = "July"
            const updatedUsedBy = Array.isArray(data.usedBy)
              ? data.usedBy.map((entry) => ({
                  ...entry,
                  validatedIn: "July",
                }))
              : [];
    
            const ref = doc(db, "game", docSnap.id);
            await updateDoc(ref, {
              points: 0,
              pointJuly: archivedPoints,
              usedBy: updatedUsedBy,
            });
          });
    
          await Promise.all(updates);
          alert("✔️ Jeu remis à zéro et points archivés avec succès !");
        } catch (err) {
          console.error("❌ Erreur lors de la mise à jour :", err);
          alert("Une erreur est survenue pendant la réinitialisation.");
        }
      };

  return (
    <div className="gameStats">
      <div className="listOrderTitel">
        Nombre de Joueurs: {count}
      {/*  <button className="link" onClick={exportGamePointsExcel}>
          Exporter en Excel
        </button>
        <button className="link" onClick={resetGameForAugust}>
          Réinitialiser le jeu pour Août
        </button>
        <button className="link" onClick={copyCollection}>
          Copier
        </button>
        <button className="link" onClick={verifyUsers}>
          Verifier
        </button>*/}
      </div>
      <DataGrid
        className="datagrid"
        rows={data}
        columns={typeColumns.concat(actionColumn)}
        pageSize={9}
        rowsPerPageOptions={[9]}
        checkboxSelection
      />
    </div>
  );
};

export default GameStats;
