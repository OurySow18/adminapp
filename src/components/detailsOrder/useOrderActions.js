import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { getOrCreateInvoiceNumber } from "../../utils/invoiceNumber";
import {
  buildArchivedOrderSnapshot,
  buildDeliveryEmailHtml,
  buildPaymentEmailHtml,
  collectZoneKeywords,
  fakeOrderEmailHtml,
  generateCompactPrintContent,
  normalizeText,
  resolveDriverUsername,
} from "./detailsOrderHelpers";

// Actions sur une commande (valider, archiver la livraison, marquer fausse,
// imprimer, envoyer les emails) et l'etat des modales qui les declenchent.
// Extrait de DetailsOrder.jsx tel quel : chaque action ecrit reellement en
// base et envoie de vrais emails, aucune logique n'a ete modifiee.
export const useOrderActions = ({ title, orderId, orderDetails, navigate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [fakeModalOpen, setFakeModalOpen] = useState(false);
  const [fakeOrderMessage, setFakeOrderMessage] = useState("");
  const [fakeModalError, setFakeModalError] = useState("");
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [driverModalError, setDriverModalError] = useState("");
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [selectedDriverUid, setSelectedDriverUid] = useState("");

  useEffect(() => {
    if (!actionFeedback) return undefined;
    const timer = setTimeout(() => setActionFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => {
    if (!actionError) return undefined;
    const timer = setTimeout(() => setActionError(null), 5000);
    return () => clearTimeout(timer);
  }, [actionError]);

  const resolveDeliveryAddress = useCallback(() => {
    const candidates = [
      orderDetails?.deliverInfos?.address,
      orderDetails?.deliverInfos?.adresse,
      orderDetails?.customerAddress,
      orderDetails?.deliveryAddress,
      orderDetails?.address,
    ];
    const hit = candidates.find(
      (value) => typeof value === "string" && value.trim()
    );
    return hit ? hit.trim() : "";
  }, [orderDetails]);

  const requiresDriverAssignmentForAddress = useCallback(async () => {
    const deliveryAddress = resolveDeliveryAddress();
    if (typeof deliveryAddress !== "string" || !deliveryAddress.trim()) {
      return false;
    }
    const normalizedAddress = normalizeText(deliveryAddress);
    if (!normalizedAddress) return false;

    // Déclenchement rapide même si les zones sont incomplètes en base.
    const conakryHints = [
      "conakry",
      "kaloum",
      "dixinn",
      "matam",
      "ratoma",
      "matoto",
    ];
    if (conakryHints.some((hint) => normalizedAddress.includes(hint))) {
      return true;
    }

    const zonesSnapshot = await getDocs(collection(db, "zones"));
    const conakryZones = [];

    zonesSnapshot.forEach((zoneSnap) => {
      const data = zoneSnap.data() || {};
      const city = normalizeText(
        data.city ??
          data.City ??
          data.location?.city ??
          data.address?.city ??
          ""
      );
      const zoneKeywords = collectZoneKeywords(data);
      const hasConakryHint = zoneKeywords.some((keyword) =>
        conakryHints.some((hint) => keyword.includes(hint))
      );
      if (city === "conakry" || hasConakryHint) {
        conakryZones.push(data);
      }
    });

    if (!conakryZones.length) return false;

    return conakryZones.some((zoneData) =>
      collectZoneKeywords(zoneData).some((keyword) =>
        normalizedAddress.includes(keyword)
      )
    );
  }, [resolveDeliveryAddress]);

  const loadActiveDrivers = useCallback(async () => {
    const driversSnapshot = await getDocs(
      query(collection(db, "drivers"), where("status", "==", true))
    );
    const rows = [];
    driversSnapshot.forEach((driverSnap) => {
      const data = driverSnap.data() || {};
      rows.push({
        uid: driverSnap.id,
        username: resolveDriverUsername(data, driverSnap.id),
      });
    });
    rows.sort((a, b) => a.username.localeCompare(b.username, "fr", { sensitivity: "base" }));
    return rows;
  }, []);

  const sendPerMail = useCallback(async () => {
    try {
      const newEmail = doc(collection(db, "mail"));
      const userMail = orderDetails?.mail_invoice;
      if (!userMail) return;
      const html = buildPaymentEmailHtml(orderDetails);

      await setDoc(newEmail, {
        to: userMail,
        message: {
          subject: "Paiement validé",
          text: "Merci pour votre Commande",
          html: html,
        },
      });
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }, [orderDetails]);

  const finalizeOrderValidation = useCallback(
    async (selectedDriver = null) => {
      setIsProcessing(true);
      setActionError(null);
      try {
        const actorUid = auth.currentUser?.uid || null;
        const actorLabel = auth.currentUser?.email || actorUid || "admin";
        const isPayedOnline = Boolean(orderDetails?.payedOnline);
        const updatePayload = {
          payed: true,
          lastModifiedBy: actorLabel,
          lastModifiedByUid: actorUid,
          lastModifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (isPayedOnline) {
          updatePayload.paymentType = "Orange Money en ligne";
        }

        if (selectedDriver?.uid) {
          updatePayload.assignedDriverUid = selectedDriver.uid;
          updatePayload.assignedDriverUsername = selectedDriver.username;
          updatePayload.driverUid = selectedDriver.uid;
          updatePayload.driverUsername = selectedDriver.username;
          updatePayload.assignedDriverAt = serverTimestamp();
        }

        await updateDoc(doc(db, "orders", orderId), {
          ...updatePayload,
        });
        await sendPerMail();
        setActionFeedback(
          selectedDriver?.uid
            ? `Commande validée, livreur "${selectedDriver.username}" attribué et email envoyé.`
            : "Commande validée et email envoyé."
        );
      } catch (error) {
        console.error("Erreur lors de la validation de la commande :", error);
        setActionError("Impossible de valider la commande.");
      } finally {
        setIsProcessing(false);
      }
    },
    [orderDetails, orderId, sendPerMail]
  );

  const validateOrder = useCallback(async () => {
    if (isProcessing || orderDetails?.payed) return;
    setActionFeedback(null);
    setActionError(null);
    setIsProcessing(true);
    try {
      const requiresDriverAssignment = await requiresDriverAssignmentForAddress();
      if (!requiresDriverAssignment) {
        setIsProcessing(false);
        await finalizeOrderValidation(null);
        return;
      }

      const drivers = await loadActiveDrivers();
      if (!drivers.length) {
        setActionError(
          "Aucun livreur actif (status=true) disponible pour une livraison à Conakry."
        );
        return;
      }

      setActiveDrivers(drivers);
      setSelectedDriverUid(drivers[0].uid);
      setDriverModalError("");
      setDriverModalOpen(true);
    } catch (error) {
      console.error("Erreur vérification attribution livreur:", error);
      setActionError("Impossible de vérifier l'attribution du livreur.");
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    orderDetails,
    requiresDriverAssignmentForAddress,
    finalizeOrderValidation,
    loadActiveDrivers,
  ]);

  const closeDriverModal = useCallback(() => {
    if (isProcessing) return;
    setDriverModalOpen(false);
    setDriverModalError("");
  }, [isProcessing]);

  const confirmDriverAssignmentAndValidate = useCallback(async () => {
    if (isProcessing) return;
    const selectedDriver = activeDrivers.find(
      (driver) => driver.uid === selectedDriverUid
    );
    if (!selectedDriver) {
      setDriverModalError("Veuillez choisir un livreur.");
      return;
    }
    setDriverModalOpen(false);
    setDriverModalError("");
    await finalizeOrderValidation(selectedDriver);
  }, [isProcessing, activeDrivers, selectedDriverUid, finalizeOrderValidation]);

  const printOrder = useCallback(async () => {
    let invoiceNumber = orderDetails?.invoiceNumber || null;
    if (!invoiceNumber) {
      try {
        invoiceNumber = await getOrCreateInvoiceNumber(title, orderId);
      } catch (error) {
        console.error("Erreur génération numéro de facture:", error);
      }
    }

    const printContent = generateCompactPrintContent(orderDetails, orderId, invoiceNumber);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setActionError("Impossible d'ouvrir la fenêtre d'impression.");
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onafterprint = () => printWindow.close();
    printWindow.print();
  }, [orderDetails, orderId, title]);

  const sendDeliveryMail = useCallback(async () => {
    try {
      const userMail = orderDetails?.mail_invoice;
      if (!userMail) return;
      const newEmail = doc(collection(db, "mail"));
      const html = buildDeliveryEmailHtml(orderDetails);

      await setDoc(newEmail, {
        to: userMail,
        message: {
          subject: "Commande livrée",
          text: "Commande livrée avec succès",
          html,
        },
      });
    } catch (error) {
      console.error("Error sending delivery email:", error);
    }
  }, [orderDetails]);

  const archiveDeliveryOrder = useCallback(async () => {
    if (isProcessing || orderDetails?.archived || orderDetails?.delivered) return;

    const ok = window.confirm(
      "Confirmer l’archivage de la livraison ?\nLa commande sera déplacée vers les archives."
    );
    if (!ok) return;

    setActionFeedback(null);
    setActionError(null);
    setIsProcessing(true);
    try {
      const archivedRef = doc(db, "archivedOrders", orderId);
      const alreadyArchived = await getDoc(archivedRef);
      if (alreadyArchived.exists()) {
        setActionError("Cette commande est déjà archivée.");
        return;
      }

      const orderRef = doc(db, title, orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        setActionError("Commande introuvable.");
        return;
      }

      const data = orderSnap.data() || {};
      const deliveredAtField = serverTimestamp();
      const archivedSnapshot = buildArchivedOrderSnapshot(data, deliveredAtField);

      const batch = writeBatch(db);
      batch.set(archivedRef, {
        ...data,
        delivered: true,
        archived: true,
        deliveredAt: deliveredAtField,
        orderSnapshot: archivedSnapshot,
        reviewJobId: `review_${orderId}`,
        timeStamp: serverTimestamp(),
      });
      batch.delete(orderRef);
      await batch.commit();

      await sendDeliveryMail();
      setActionFeedback("Commande archivée.");
      navigate("/delivery");
    } catch (error) {
      console.error("Erreur archivage livraison:", error);
      setActionError("Impossible d'archiver la livraison.");
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, orderDetails, orderId, title, sendDeliveryMail, navigate]);

  const notifyFakeOrder = useCallback(
    async (message) => {
      const to =
        orderDetails?.mail_invoice ||
        orderDetails?.email ||
        orderDetails?.deliverInfos?.email;
      if (!to) return;
      const newEmail = doc(collection(db, "mail"));
      await setDoc(newEmail, {
        to,
        message: {
          subject: "Commande signalée comme fausse",
          text: message,
          html: fakeOrderEmailHtml(message),
        },
      });
    },
    [orderDetails]
  );

  const openFakeOrderModal = useCallback(() => {
    if (orderDetails?.fakeOrder) {
      setActionError("Cette commande est déjà marquée comme fausse.");
      return;
    }
    const defaultMessage =
      "Votre commande a été marquée comme fausse. Si ce n’est pas le cas, merci de contacter le service client MonMarché. Si c’était juste pour tester, merci de ne plus recommencer. En cas de récidive, votre compte sera suspendu.";
    setFakeOrderMessage(orderDetails?.fakeOrderMessage || defaultMessage);
    setFakeModalError("");
    setFakeModalOpen(true);
  }, [orderDetails]);

  const closeFakeOrderModal = useCallback(() => {
    if (isProcessing) return;
    setFakeModalOpen(false);
    setFakeModalError("");
  }, [isProcessing]);

  const markAsFakeOrder = useCallback(async () => {
    if (isProcessing) return;
    if (orderDetails?.fakeOrder) {
      setActionError("Cette commande est déjà marquée comme fausse.");
      setFakeModalOpen(false);
      return;
    }

    const finalMessage = fakeOrderMessage.trim();
    if (!finalMessage) {
      setFakeModalError("Le message client est obligatoire.");
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        fakeOrder: true,
        fakeOrderMessage: finalMessage,
        fakeOrderAt: serverTimestamp(),
      });

      const userId = orderDetails?.userId;
      if (userId) {
        await updateDoc(doc(db, "users", userId), {
          fakeOrdersCount: increment(1),
        });
      } else {
        console.warn("Aucun userId sur la commande, compteur non mis à jour.");
      }

      await notifyFakeOrder(finalMessage);
      setActionFeedback("Commande marquée comme fausse.");
      setFakeModalOpen(false);
    } catch (e) {
      console.error("Erreur fake order:", e);
      setActionError("Une erreur est survenue lors du marquage.");
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, orderDetails, orderId, fakeOrderMessage, notifyFakeOrder]);

  const revertFakeOrder = useCallback(async () => {
    if (isProcessing || !orderDetails?.fakeOrder) return;
    const ok = window.confirm(
      'Annuler le marquage "fausse commande" ?\nLe compteur de fausses commandes du client sera décrémenté.'
    );
    if (!ok) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        fakeOrder: false,
        fakeOrderMessage: deleteField(),
        fakeOrderAt: deleteField(),
      });

      const userId = orderDetails?.userId;
      if (userId) {
        await updateDoc(doc(db, "users", userId), {
          fakeOrdersCount: increment(-1),
        });
      }

      setActionFeedback('Marquage "fausse commande" annulé.');
    } catch (e) {
      console.error("Erreur annulation fausse commande:", e);
      setActionError("Impossible d'annuler le marquage.");
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, orderDetails, orderId]);

  return {
    isProcessing,
    actionFeedback,
    actionError,
    fakeModalOpen,
    fakeOrderMessage,
    setFakeOrderMessage,
    fakeModalError,
    setFakeModalError,
    driverModalOpen,
    driverModalError,
    setDriverModalError,
    activeDrivers,
    selectedDriverUid,
    setSelectedDriverUid,
    validateOrder,
    closeDriverModal,
    confirmDriverAssignmentAndValidate,
    printOrder,
    archiveDeliveryOrder,
    openFakeOrderModal,
    closeFakeOrderModal,
    markAsFakeOrder,
    revertFakeOrder,
  };
};
