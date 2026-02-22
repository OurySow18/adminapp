import "../../style/orderDetails.scss"
import "./detailsOrderPage.scss";
import { useState, useEffect } from "react";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { resolveOrderDate } from "../../utils/orderDate";
import ConfirmModal from "../modal/ConfirmModal";

import { db } from "../../firebase";
import {
  serverTimestamp,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  collection,
  increment,
} from "firebase/firestore";

const DetailsOrder = ({ title, btnValidation }) => {
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [fakeModalOpen, setFakeModalOpen] = useState(false);
  const [fakeOrderMessage, setFakeOrderMessage] = useState("");
  const [fakeModalError, setFakeModalError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const listRoute = location.pathname.startsWith("/fake-orders")
    ? "/fake-orders"
    : "/orders";

  // Récupérer les détails de la commande depuis Firestore
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const unsubscribe = onSnapshot(
      doc(db, title, params.id),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrderDetails(null);
          setLoadError("Commande introuvable.");
          setLoading(false);
          return;
        }
        setOrderDetails(snapshot.data());
        setLoading(false);
      },
      (error) => {
        console.log(error);
        setLoadError("Impossible de charger la commande.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [params.id, title]);

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

  // Gérer le retour en arrière
  const goBack = () => {
    navigate(listRoute);
  };

  const formatPrice = (price) => {
    const safe = Number(price);
    return (Number.isFinite(safe) ? safe : 0).toLocaleString("fr-FR", {
      style: "currency",
      currency: "GNF",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "—";
    if (typeof value?.toDate === "function") {
      return format(value.toDate(), "dd/MM/yyyy HH:mm:ss");
    }
    if (value instanceof Date) {
      return format(value, "dd/MM/yyyy HH:mm:ss");
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "—"
      : format(parsed, "dd/MM/yyyy HH:mm:ss");
  };

  const validateOrder = async () => {
    if (isProcessing || orderDetails?.payed) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await updateDoc(doc(db, "orders", params.id), {
        payed: true,
      });
      await sendPerMail();
      setActionFeedback("Commande validée et email envoyé.");
    } catch (error) {
      console.error("Erreur lors de la validation de la commande :", error);
      setActionError("Impossible de valider la commande.");
    } finally {
      setIsProcessing(false);
    }
  };
  const generatePrintContent = () => {
    const details = orderDetails || {};
    const delivery = details.deliverInfos || {};
    const cart = Array.isArray(details.cart) ? details.cart : [];
    const orderDate = resolveOrderDate(details);
    const formattedDate = format(orderDate, "dd/MM/yyyy");

    const headerContent = `
      <div class="invoice-header">
        <div class="company-info">
          <img src="https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/logo%2Ficon-192.png?alt=media&token=e0038238-452c-4940-bffd-2fed309ce07e"  alt="Logo de Monmarche" class="company-logo" />
          <div class="company-details">
            <h1>Monmarche</h1>
            <p>Bantounka 2</p>
            <p>Tel: +224 612 12 12 29</p>
            <p>infos@monmarchegn.com</p>
          </div>
        </div>
        <div class="invoice-info">
          <h2>Facture</h2>
          <p>Date: ${formattedDate}</p>
        </div>
      </div>
    `;
    const customerInfo = `
      <div class="customer-info">
        <h3>Coordonnées du client :</h3>
        <p>No Facture: ${details.orderId || ""}</p>
        <p>Nom: ${delivery.name || ""}</p>
        <p>Adresse: ${delivery.address || ""}</p>
        <p>Téléphone: ${delivery.phone || ""}</p>
        <p>Description: ${delivery.additionalInfo || ""}</p>
      </div>
    `;

    const footerContent = `
    <div class="invoice-footer">
      <p>Montant Livraison: ${details.deliveryFee || 0} GNF</p> 
      <p>Total de la facture: ${details.total || 0} GNF</p>
      <p>Merci de votre achat.</p>
    </div>
    <!-- Signatures -->
    <div class="signatures">
      <div class="signature">
        <input type="text" placeholder="X" class="signature-input" />
        <h3>Signature du client :</h3>
      </div>
      <div class="signature">
        <input type="text" placeholder="X" class="signature-input" />
        <h3>Signature du livreur :</h3>
      </div>
    </div>
  `;
    let itemsContent = `
  <table class="invoice-items">
    <thead>
      <tr>
        <th>Produit</th> 
        <th>Poids</th> 
        <th>Quantité en gros</th>
        <th>Montant en gros</th> 
        <th>Quantité détail</th>
        <th>Montant détail</th> 
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${cart
        .map(
          (product) => `
        <tr>
          <td class="product-name">${product.name}</td> 
          <td class="product-poids">${product.poids}</td> 
          <td class="product-quantity">${
            product.quantityBulk
              ? product.quantityBulk + " x " + formatPrice(product.priceBulk)
              : "0"
          }</td> 
          <td class="product-amount">${product.amountBulk || "0"} GNF</td>
          <td class="product-quantity">${
            product.quantityDetail
              ? product.quantityDetail +
                " x " +
                formatPrice(product.priceDetail)
              : "0"
          }</td>
          <td class="product-amount">${product.amountDetail || "0"} GNF</td> 
          <td class="product-total">${product.totalAmount || "0"} GNF</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
`;

    const printContent = `
    <style>
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background-color: #f3f3f3;
        }
        .invoice {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ccc;
          border-radius: 10px;
          background-color: #fff;
        }
        .company-info {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }
        .company-logo {
          max-width: 100px;
          margin-right: 20px;
        }
        .company-details h1 {
          font-size: 28px;
          margin: 0;
          color: #333;
        }
        .company-details p {
          margin: 5px 0;
          color: #555;
        }
        .invoice-info {
          flex-grow: 1;
          text-align: right;
        }
        .invoice-info h2 {
          font-size: 24px;
          margin: 0;
          color: #444;
        }
        .invoice-info p {
          margin: 5px 0;
          color: #666;
        }
        .customer-info {
          margin-bottom: 20px;
          padding: 10px;
          border-radius: 5px;
          background-color: #f9f9f9;
          border-left: 5px solid #0b79d0;
        }
        .customer-info h3 {
          margin-top: 0;
          color: #333;
        }
        .customer-info p {
          margin: 5px 0;
          color: #555;
        }
        .invoice-footer {
          text-align: center;
          margin-top: 20px;
        }
        .invoice-footer p {
          margin: 5px 0;
          color: #333;
          font-weight: bold;
        }
        .invoice-items {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .invoice-items th, .invoice-items td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
          font-size: 14px;
        }
        .invoice-items th {
          background-color: #0b79d0;
          color: #fff;
          font-weight: bold;
        }
        .product-name {
          font-weight: bold;
          color: #333;
        }
        .product-quantity, .product-amount, .product-total {
          color: #555;
        }
        .product-quantity {
          text-align: center;
        }
        .product-amount, .product-total {
          text-align: right;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
        }
        .signature {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          page-break-inside: avoid;
        }
        .signature-input {
          width: 100%;
          margin-top: 40px;
          margin-bottom: 10px;
          border: none;
          border-bottom: 1px solid #000;
          text-align: center;
          font-size: 14px;
        }
        .signature h3 {
          margin: 0;
          color: #333;
        }
      }
    </style>
    <div class="invoice">
      ${headerContent}
      ${customerInfo}
      ${itemsContent}
      ${footerContent}
    </div>
  `;

    return printContent;
  };

  const printOrder = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setActionError("Impossible d'ouvrir la fenêtre d'impression.");
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const buildPaymentEmailHtml = (details) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
      <title>Votre Facture - MonMarche</title>
      <style>
        body {
          background-color: #ffffff;
          color: #333;
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td {
          padding: 15px;
          text-align: left;
        }
        th {
          background-color: #ff6f00;
          color: #fff;
          padding: 15px;
          text-align: left;
        }
        tr:nth-child(even) {
          background-color: #f4f4f4;
        }
        .header, .footer {
          background-color: #ff6f00;
          color: #fff;
          text-align: center;
          padding: 10px;
        }
        .footer {
          position: fixed;
          bottom: 0;
          width: 100%;
        }
        .important {
          color: #4a148c;
        }
        img {
          max-width: 100%;
          height: auto;
          display: block;
        }
        @media only screen and (max-width: 600px) {
          .responsive-table {
            width: 100% !important;
          }
        }
      </style>
    </head>
    <body>
      <table class="header">
        <tr>
          <td>
            <h1>Merci pour votre achat</h1>
          <td>
            <img src="https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/logo%2Ficon-192.png?alt=media&token=e0038238-452c-4940-bffd-2fed309ce07e" alt="Logo MonMarche" style="max-width: 60%; height: auto;">
          </td>
          </td>
        </tr>
      </table>
      <table class="responsive-table">
        <tr>
          <td>
            <p><strong>No Facture:</strong> ${details?.orderId || ""}</p>
            <p><strong>Nom:</strong> ${details?.deliverInfos?.name || ""} </p>
            <p><strong>Adresse:</strong> ${
              details?.deliverInfos?.address || ""
            }</p>
            <p><strong>Téléphone:</strong> ${
              details?.deliverInfos?.phone || ""
            }</p>
            <p><strong>Informations supplémentaires:</strong> ${
              details?.deliverInfos?.additionalInfo || ""
            }</p>
            <p><strong>Type de paiement:</strong> ${
              details?.paymentType || ""
            }</p>
            <p><strong>Montant Total de la Facture:</strong> ${
              details?.total || 0
            }</p>
          </td>
        </tr>
      </table>
      <table>
        <tr>
          <td>
            <h2>Infos sur le paiement</h2>
            <p>Votre paiement a été accepté. Vous recevrez votre commande sous 48 heures. Un de nos livreurs vous contactera à ce numéro de téléphone : ${
              details?.deliverInfos?.phone || ""
            }</p>
            <p>Veuillez vous assurer que ce numéro soit joignable entre 8h et 17h.</p>
          </td>
        </tr>
      </table>
      <table>
        <tr>
          <td>
            <h2>Code de Scan</h2>
            <div style="text-align: center;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${
                details?.scanNum || ""
              }" alt="QR Code pour la commande">
            </div>
          </td>
        </tr>
      </table>
      <table>
        <tr>
          <td>
            <h2><span class="important">Important</span></h2>
            <p>Au cas où nous ne pourrions pas vous joindre à ce numéro, aucune livraison ne sera effectuée. 
            Un délai d'une semaine vous sera attribué pour prendre contact avec nous et décider de la livraison ou d'un remboursement.</p>
          </td>
        </tr>
      </table>
      <table class="footer">
        <tr>
          <td>
            <p>&copy; ${new Date().getFullYear()} Monmarche. Cosa rond point, immeuble Elhadj Chérif. +224 612121229. Tous droits réservés.</p>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  const sendPerMail = async () => {
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
  };

  const fakeOrderEmailHtml = (message) => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Information sur votre commande - MonMarche</title></head>
    <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
        <div style="background:#ff6f00;color:#fff;padding:12px;text-align:center">
          <h1 style="margin:0;font-size:20px">Information Importante</h1>
        </div>
        <div style="padding:20px">
          <p>Bonjour,</p>
          <p>${message}</p>
          <p>Merci,</p>
          <p>Service Client MonMarché</p>
        </div>
        <div style="background:#ff6f00;color:#fff;padding:10px;text-align:center;font-size:12px">
          &copy; ${new Date().getFullYear()} MonMarche
        </div>
      </div>
    </body></html>`;

  const notifyFakeOrder = async (message) => {
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
  };

  const openFakeOrderModal = () => {
    if (orderDetails?.fakeOrder) {
      setActionError("Cette commande est déjà marquée comme fausse.");
      return;
    }
    const defaultMessage =
      "Votre commande a été marquée comme fausse. Si ce n’est pas le cas, merci de contacter le service client MonMarché. Si c’était juste pour tester, merci de ne plus recommencer. En cas de récidive, votre compte sera suspendu.";
    setFakeOrderMessage(orderDetails?.fakeOrderMessage || defaultMessage);
    setFakeModalError("");
    setFakeModalOpen(true);
  };

  const closeFakeOrderModal = () => {
    if (isProcessing) return;
    setFakeModalOpen(false);
    setFakeModalError("");
  };

  const markAsFakeOrder = async () => {
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
      const orderRef = doc(db, "orders", params.id);
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
  };

  const paymentLabel = orderDetails?.payed ? "Payé" : "En attente";
  const deliveryLabel = orderDetails?.delivered ? "Livré" : "Non livré";
  const fakeLabel = orderDetails?.fakeOrder ? "Fausse commande" : "Non";
  const orderDate = resolveOrderDate(orderDetails || {});
  const orderDateLabel = format(orderDate, "dd/MM/yyyy HH:mm:ss");
  const cartItems = Array.isArray(orderDetails?.cart) ? orderDetails.cart : [];
  const cartTotal = cartItems.reduce(
    (sum, product) => sum + (Number(product?.totalAmount) || 0),
    0
  );

  if (loading) {
    return (
      <div className="details">
        <Sidebar />
        <div className="detailsContainer">
          <Navbar />
          <div className="detailsOrderPage__state">Chargement de la commande...</div>
        </div>
      </div>
    );
  }

  if (loadError || !orderDetails) {
    return (
      <div className="details">
        <Sidebar />
        <div className="detailsContainer">
          <Navbar />
          <div className="detailsOrderPage__state detailsOrderPage__state--error">
            {loadError || "Commande introuvable."}
          </div>
          <div className="actionsBar">
            <button className="btnSecondary" onClick={goBack}>
              Revenir en arrière
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="details detailsOrderPage">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />

        <div className="top detailsOrderPage__top">
          <div>
            <h1>Détails de la commande</h1>
            <p className="detailsOrderPage__subtitle">
              Commande #{orderDetails?.orderId || params.id}
            </p>
          </div>
          <div className="detailsOrderPage__topActions">
            <button
              className="btnPrimary"
              onClick={validateOrder}
              disabled={isProcessing || orderDetails?.payed}
            >
              {orderDetails?.payed
                ? "Commande déjà validée"
                : isProcessing
                ? "Traitement..."
                : btnValidation}
            </button>
          </div>
        </div>

        {(actionFeedback || actionError) && (
          <div className={`detailsOrderPage__alert ${actionError ? "detailsOrderPage__alert--error" : ""}`}>
            {actionError || actionFeedback}
          </div>
        )}

        <div className="detailsOrderPage__statusRow">
          <span className={`statusBadge ${orderDetails?.payed ? "statusBadge--success" : "statusBadge--warning"}`}>
            Paiement: {paymentLabel}
          </span>
          <span className={`statusBadge ${orderDetails?.delivered ? "statusBadge--success" : "statusBadge--warning"}`}>
            Livraison: {deliveryLabel}
          </span>
          <span className={`statusBadge ${orderDetails?.fakeOrder ? "statusBadge--danger" : "statusBadge--neutral"}`}>
            Fausse commande: {fakeLabel}
          </span>
        </div>

        <div className="formContainer detailsOrderPage__grid">
          <div className="detailsOrderPage__card">
            <h2>Commande</h2>
            <div className="detailsOrderPage__kv"><span>ID</span><strong>{orderDetails?.orderId || params.id}</strong></div>
            <div className="detailsOrderPage__kv"><span>Date</span><strong>{orderDateLabel}</strong></div>
            <div className="detailsOrderPage__kv"><span>Total</span><strong>{formatPrice(orderDetails?.total)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Mode de paiement</span><strong>{orderDetails?.paymentType || "—"}</strong></div>
          </div>

          <div className="detailsOrderPage__card">
            <h2>Client & livraison</h2>
            <div className="detailsOrderPage__kv"><span>Email</span><strong>{orderDetails?.mail_invoice || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Nom</span><strong>{orderDetails?.deliverInfos?.name || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Téléphone</span><strong>{orderDetails?.deliverInfos?.phone || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Adresse</span><strong>{orderDetails?.deliverInfos?.address || "—"}</strong></div>
            <div className="detailsOrderPage__kv"><span>Description</span><strong>{orderDetails?.deliverInfos?.additionalInfo || "—"}</strong></div>
          </div>

          <div className="detailsOrderPage__card">
            <h2>Historique</h2>
            <div className="detailsOrderPage__kv"><span>Commande créée</span><strong>{formatDateTime(orderDetails?.timeStamp)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Marquée fausse le</span><strong>{formatDateTime(orderDetails?.fakeOrderAt)}</strong></div>
            <div className="detailsOrderPage__kv"><span>Message client</span><strong>{orderDetails?.fakeOrderMessage || "—"}</strong></div>
          </div>

          {/* === Produits commandés === */}
          <div className="orderItems detailsOrderPage__products">
            <h2>Produits commandés</h2>

            {cartItems.length > 0 ? (
              <>
                {/* Tableau (desktop) */}
                <div className="orderTableWrap">
                  <table className="orderTable">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th className="num">Qté gros</th>
                        <th className="money">Montant gros</th>
                        <th className="num">Qté détail</th>
                        <th className="money">Montant détail</th>
                        <th className="money">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((p, i) => (
                        <tr key={i}>
                          <td className="name">
                            <span className="dot" />
                            {p?.name ?? ""}
                          </td>
                          <td className="num">{p?.quantityBulk ?? 0}</td>
                          <td className="money">
                            {p?.amountBulk ? formatPrice(p.amountBulk) : "—"}
                          </td>
                          <td className="num">{p?.quantityDetail ?? 0}</td>
                          <td className="money">
                            {p?.amountDetail
                              ? formatPrice(p.amountDetail)
                              : "—"}
                          </td>
                          <td className="money totalCell">
                            {p?.totalAmount ? formatPrice(p.totalAmount) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="tfootLabel">
                          Total commande
                        </td>
                        <td className="money tfootTotal">
                          {formatPrice(
                            cartTotal
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Cartes (mobile) */}
                <div className="orderCards">
                  {cartItems.map((p, i) => (
                    <div className="orderCard" key={`card-${i}`}>
                      <div className="row">
                        <span className="label">Produit</span>
                        <span className="value name">
                          <span className="dot" />
                          {p?.name ?? ""}
                        </span>
                      </div>
                      <div className="row">
                        <span className="label">Qté gros</span>
                        <span className="value">{p?.quantityBulk ?? 0}</span>
                      </div>
                      <div className="row">
                        <span className="label">Montant gros</span>
                        <span className="value">
                          {p?.amountBulk ? formatPrice(p.amountBulk) : "—"}
                        </span>
                      </div>
                      <div className="row">
                        <span className="label">Qté détail</span>
                        <span className="value">{p?.quantityDetail ?? 0}</span>
                      </div>
                      <div className="row">
                        <span className="label">Montant détail</span>
                        <span className="value">
                          {p?.amountDetail ? formatPrice(p.amountDetail) : "—"}
                        </span>
                      </div>
                      <div className="divider" />
                      <div className="row total">
                        <span className="label">Total</span>
                        <span className="value">
                          {p?.totalAmount ? formatPrice(p.totalAmount) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="grandTotalCard">
                    <span className="label">Total commande</span>
                    <span className="value">
                      {formatPrice(
                        cartTotal
                      )}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="empty">Aucun produit dans cette commande.</p>
            )}
          </div>
        </div>
        <div className="actionsBar">
          <button className="btnSecondary" onClick={goBack} disabled={isProcessing}>
            Revenir en arrière
          </button>
          <button className="btnPrimary" onClick={printOrder} disabled={isProcessing}>
            Imprimer la commande
          </button>
          <button
            className="btnDanger"
            onClick={openFakeOrderModal}
            disabled={isProcessing || orderDetails?.fakeOrder}
          >
            Fausse commande
          </button>
        </div>
        <ConfirmModal
          open={fakeModalOpen}
          title="Marquer comme fausse commande"
          onClose={closeFakeOrderModal}
          onConfirm={markAsFakeOrder}
          confirmText="Confirmer"
          cancelText="Annuler"
          loading={isProcessing}
        >
          <p className="workModal__text">
            Cette action notifiera le client et incrémentera son compteur de fausses commandes.
          </p>
          <div className="workModal__field">
            <label htmlFor="fake-order-message">Message envoyé au client</label>
            <textarea
              id="fake-order-message"
              value={fakeOrderMessage}
              onChange={(event) => {
                setFakeOrderMessage(event.target.value);
                if (fakeModalError) setFakeModalError("");
              }}
              rows={5}
              disabled={isProcessing}
            />
          </div>
          {fakeModalError ? (
            <p className="workModal__error">{fakeModalError}</p>
          ) : null}
        </ConfirmModal>
      </div>
    </div>
  );
};

export default DetailsOrder;
