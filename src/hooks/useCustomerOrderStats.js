import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

const EMPTY_STATE = { loading: false, realOrdersCount: 0, fakeOrdersCount: 0 };

// Stats client reutilisees sur la fiche utilisateur et sur le detail d'une
// commande : nombre de vraies commandes (orders + archivedOrders, hors
// fakeOrder, requete where(userId==)) et fakeOrdersCount (deja stocke sur
// le document utilisateur, incremente/decremente par markAsFakeOrder /
// revertFakeOrder).
export const useCustomerOrderStats = (userId) => {
  const [state, setState] = useState({ ...EMPTY_STATE, loading: Boolean(userId) });

  useEffect(() => {
    if (!userId) {
      setState(EMPTY_STATE);
      return undefined;
    }
    setState({ ...EMPTY_STATE, loading: true });

    const counts = { active: 0, archived: 0, fake: 0 };
    const loaded = { active: false, archived: false, user: false };
    const updateTotal = () => {
      if (loaded.active && loaded.archived && loaded.user) {
        setState({
          loading: false,
          realOrdersCount: counts.active + counts.archived,
          fakeOrdersCount: counts.fake,
        });
      }
    };

    const unsubUser = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        counts.fake = Number(snapshot.data()?.fakeOrdersCount) || 0;
        loaded.user = true;
        updateTotal();
      },
      (error) => {
        console.error("Erreur chargement stats client (users):", error);
        loaded.user = true;
        updateTotal();
      }
    );

    const unsubActive = onSnapshot(
      query(collection(db, "orders"), where("userId", "==", userId)),
      (snapshot) => {
        counts.active = snapshot.docs.filter((d) => d.data()?.fakeOrder !== true).length;
        loaded.active = true;
        updateTotal();
      },
      (error) => {
        console.error("Erreur chargement stats client (orders):", error);
        loaded.active = true;
        updateTotal();
      }
    );

    const unsubArchived = onSnapshot(
      query(collection(db, "archivedOrders"), where("userId", "==", userId)),
      (snapshot) => {
        counts.archived = snapshot.docs.filter((d) => d.data()?.fakeOrder !== true).length;
        loaded.archived = true;
        updateTotal();
      },
      (error) => {
        console.error("Erreur chargement stats client (archivedOrders):", error);
        loaded.archived = true;
        updateTotal();
      }
    );

    return () => {
      unsubUser();
      unsubActive();
      unsubArchived();
    };
  }, [userId]);

  return state;
};
