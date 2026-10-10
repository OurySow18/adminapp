import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const EMPTY_STATE = { loading: false, realOrdersCount: 0, fakeOrdersCount: 0 };

// Stats client reutilisees sur la fiche utilisateur et sur le detail d'une
// commande. Les deux compteurs vivent sur users/{uid} :
//  - fakeOrdersCount : incremente/decremente par markAsFakeOrder/revertFakeOrder.
//  - realOrdersCount : incremente uniquement a la validation de la commande
//    (finalizeOrderValidation), jamais a la creation. Une commande encore en
//    attente peut finir fausse, annulee ou supprimee sans etre une vente
//    reelle, donc elle ne doit pas compter avant d'etre validee.
export const useCustomerOrderStats = (userId) => {
  const [state, setState] = useState({ ...EMPTY_STATE, loading: Boolean(userId) });

  useEffect(() => {
    if (!userId) {
      setState(EMPTY_STATE);
      return undefined;
    }
    setState((prev) => ({ ...prev, loading: true }));

    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        const data = snapshot.data() || {};
        setState({
          loading: false,
          realOrdersCount: Number(data.realOrdersCount) || 0,
          fakeOrdersCount: Number(data.fakeOrdersCount) || 0,
        });
      },
      (error) => {
        console.error("Erreur chargement stats client (users):", error);
        setState({ ...EMPTY_STATE, loading: false });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return state;
};
