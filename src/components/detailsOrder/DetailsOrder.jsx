//import "./detailsOrder.scss";
import "../../style/orderDetails.scss"
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";

import { db } from "../../firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  collection,
} from "firebase/firestore";

const DetailsOrder = ({ title, btnValidation }) => {
  const [orderDetails, setOrderDetails] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const params = useParams();

  // Récupérer les détails de la commande depuis Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, title, params.id),
      (snapshot) => {
        setOrderDetails(snapshot.data());
      },
      (error) => {
        console.log(error);
      }
    );

    return () => unsubscribe();
  }, [params.id, title]);

  // Gérer le retour en arrière
  const goBack = () => {
    navigate("/orders"); // Rediriger vers la page des produits
  };
  function formatPrice(price) {
    return parseFloat(price).toLocaleString("fr-FR", {
      style: "currency",
      currency: "GNF",
    });
  }

  const validateOrder = async () => {
    try {
      await updateDoc(doc(db, "orders", params.id), {
        payed: true,
      });
      await sendPerMail();
      console.log("La commande a été validée avec succès !");
    } catch (error) {
      console.error("Erreur lors de la validation de la commande :", error);
    }
  };
  const generatePrintContent = () => {
    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate()}/${
      currentDate.getMonth() + 1
    }/${currentDate.getFullYear()}`;

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
        <p>No Facture: ${orderDetails.orderId}</p>
        <p>Nom: ${orderDetails.deliverInfos.name}</p>
        <p>Adresse: ${orderDetails.deliverInfos.address}</p>
        <p>Téléphone: ${orderDetails.deliverInfos.phone}</p>
        <p>Description: ${orderDetails.deliverInfos.additionalInfo}</p>
      </div>
    `;

    const footerContent = `
    <div class="invoice-footer">
      <p>Montant Livraison: ${orderDetails.deliveryFee} GNF</p> 
      <p>Total de la facture: ${orderDetails.total} GNF</p>
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
      ${orderDetails.cart
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
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const html = `
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
            <p><strong>No Facture:</strong> ${orderDetails.orderId}</p>
            <p><strong>Nom:</strong> ${orderDetails.deliverInfos?.name} </p>
            <p><strong>Adresse:</strong> ${
              orderDetails.deliverInfos?.address
            }</p>
            <p><strong>Téléphone:</strong> ${
              orderDetails.deliverInfos?.phone
            }</p>
            <p><strong>Informations supplémentaires:</strong> ${
              orderDetails.deliverInfos?.additionalInfo
            }</p>
            <p><strong>Type de paiement:</strong> ${
              orderDetails.paymentType
            }</p>
            <p><strong>Montant Total de la Facture:</strong> ${
              orderDetails.total
            }</p>
          </td>
        </tr>
      </table>
      <table>
        <tr>
          <td>
            <h2>Infos sur le paiement</h2>
            <p>Votre paiement a été accepté. Vous recevrez votre commande sous 48 heures. Un de nos livreurs vous contactera à ce numéro de téléphone : ${
              orderDetails.deliverInfos?.phone
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
                orderDetails?.scanNum
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
      // Add a new document with a generated id
      const newEmail = doc(collection(db, "mail"));

      // Récupérer le document utilisateur
      //  const userDoc = await getDoc(doc(db, "users", orderDetails.userId));

      const userMail = orderDetails?.mail_invoice;
      console.log("User email:", userMail);
      //if (userMail) {

      // Créer un nouveau document dans la collection "mail"
      await setDoc(newEmail, {
        to: userMail,
        message: {
          subject: "Paiement validé",
          text: "Merci pour votre Commande",
          html: html,
          /* attachments: [
              {
                content: html,
                filename: uri
              }
            ]*/
        },
      });

      // Afficher une alerte indiquant que la confirmation a été envoyée avec succès au client
      window.alert("La confirmation a été envoyée avec succès au client.");
      navigate("/orders");
      /* } else {
        console.error("No such user document!");
        window.alert("Erreur : Utilisateur introuvable.");
      }*/
    } catch (error) {
      console.error("Error sending email:", error);
      window.alert(
        "Une erreur s'est produite lors de l'envoi de l'email. Veuillez réessayer."
      );
    }
  };

  return (
    <div className="details">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />

        <div className="top">
          <h1>Détails de la Livraison</h1>
          <Link
            className={`link ${isProcessing ? "disabled" : ""}`}
            onClick={validateOrder}
          >
            {isProcessing ? "Traitement..." : btnValidation}
          </Link>
        </div>

        <div className="formContainer">
          <div className="formGroup">
            <label>ID de la commande:</label>
            <input type="text" value={orderDetails?.orderId || ""} disabled />
          </div>

          <div className="formGroup">
            <label>Email de facturation: </label>
            <input
              type="text"
              value={orderDetails?.mail_invoice || ""}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Nom du récepteur:</label>
            <input
              type="text"
              value={orderDetails?.deliverInfos?.name || ""}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Adresse de livraison:</label>
            <input
              type="text"
              value={orderDetails?.deliverInfos?.address || ""}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Téléphone du receveur:</label>
            <input
              type="text"
              value={orderDetails?.deliverInfos?.phone || ""}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Description de la livraison:</label>
            <textarea
              value={orderDetails?.deliverInfos?.additionalInfo || ""}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Status du payement:</label>
            <input
              type="text"
              value={orderDetails?.payed ? "Payé" : "En attente de paiement"}
              className={orderDetails?.payed ? "paid" : "pending"}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Status de la livraison:</label>
            <input
              type="text"
              value={orderDetails?.delivered ? "Livré" : "Non livré"}
              className={orderDetails?.delivered ? "delivered" : "notDelivered"}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Total:</label>
            <input
              type="text"
              value={formatPrice(orderDetails?.total)}
              disabled
            />
          </div>

          <div className="formGroup">
            <label>Date et heure:</label>
            <input
              type="text"
              value={
                orderDetails?.timeStamp
                  ? format(
                      orderDetails.timeStamp.toDate(),
                      "dd/MM/yyyy HH:mm:ss"
                    )
                  : ""
              }
              disabled
            />
          </div>

          {/* === Produits commandés === */}
          <div className="orderItems">
            <h2>Produits commandés</h2>

            {Array.isArray(orderDetails?.cart) &&
            orderDetails.cart.length > 0 ? (
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
                      {orderDetails.cart.map((p, i) => (
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
                            (orderDetails.cart || []).reduce(
                              (sum, p) => sum + (Number(p?.totalAmount) || 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Cartes (mobile) */}
                <div className="orderCards">
                  {orderDetails.cart.map((p, i) => (
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
                        (orderDetails.cart || []).reduce(
                          (sum, p) => sum + (Number(p?.totalAmount) || 0),
                          0
                        )
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
          <button onClick={goBack}>Revenir en arrière</button>
          <button onClick={printOrder}>Imprimer la commande</button>
        </div>
      </div>
    </div>
  );
};

export default DetailsOrder;
