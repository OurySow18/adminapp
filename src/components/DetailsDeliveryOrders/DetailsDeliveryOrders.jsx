import "./DetailsDeliveryOrders.scss";
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
  setDoc,
  collection,
  getDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const DetailsDeliveryOrders = ({ title, btnValidation }) => {
  const [orderDetails, setOrderDetails] = useState({});
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

  // formatter prix
  const formatPrice = (price) =>
    parseFloat(price).toLocaleString("fr-FR", {
      style: "currency",
      currency: "GNF",
    });

  const updateOrder = async () => {
    try {
      // Mettez à jour la valeur payed dans la base de données
      await updateDoc(doc(db, "orders", params.id), {
        delivered: true,
      });
      // Mettre à jour l'état local si nécessaire
      // setData({ ...data, payed: true });
      alert("La commande a été archivée avec succès !");
    } catch (error) {
      console.error("Erreur lors de la validation de la commande :", error);
    }
  };

  // Gérer le retour en arrière
  const goBack = () => {
    navigate("/delivery"); // Rediriger vers la page des produits
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
      <p>Montant Livraison: ${formatPrice(orderDetails.deliveryFee)} GNF</p> 
      <p>Total de la facture: ${formatPrice(orderDetails.total)} GNF</p>
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
    <title>Confirmation de Livraison - MonMarche</title>
    <style>
      body {
        background-color: #f9f9f9;
        color: #333;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 0;
        line-height: 1.6;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .header {
        background-color: #ff6f00;
        color: #ffffff;
        padding: 10px;
        border-radius: 8px 8px 0 0;
        text-align: center;
      }
      .header img {
        max-width: 100px;
        margin-bottom: 10px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
      }
      .content {
        padding: 20px;
        text-align: center;
      }
      .content h2 {
        color: #ff6f00;
        font-size: 20px;
      }
      .content p {
        margin: 15px 0;
      }
      .button {
        background-color: #ff6f00;
        color: #ffffff;
        padding: 10px 20px;
        text-decoration: none;
        border-radius: 5px;
        display: inline-block;
        margin-top: 20px;
      }
      .footer {
        background-color: #ff6f00;
        color: #ffffff;
        padding: 10px;
        border-radius: 0 0 8px 8px;
        text-align: center;
        font-size: 12px;
      }
      .footer p {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/logo%2Ficon-192.png?alt=media&token=e0038238-452c-4940-bffd-2fed309ce07e" alt="MonMarche Logo" />
        <h1>Commande Livrée avec Succès !</h1>
      </div>
      <div class="content">
        <h2>Merci pour votre achat !</h2>
        <p>Bonjour chèr(e) Client(e),</p>
        <p>Nous vous informons que votre commande <strong>${
          orderDetails?.orderId
        }</strong> a été livrée avec succès à l'adresse suivante :</p>
        <p><strong>${orderDetails?.deliverInfos?.address}</strong></p>
        <p>Nous espérons que vous êtes satisfait de votre achat.</p>
        <p>Si vous avez des questions ou des préoccupations, n'hésitez pas à nous contacter à tout moment.</p>
        <p>À très bientôt sur MonMarche !</p> 
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} MonMarche. Tous droits réservés.</p>
        <p>Cosa rond point, immeuble Elhadj Chérif. +224 612121229.</p>
      </div>
    </div>
  </body>
</html>
  `;

  const sendPerMail = async () => {
    try {
      // Add a new document with a generated id
      const newEmail = doc(collection(db, "mail"));

      // Récupérer le document utilisateur
      //const userDoc = await getDoc(doc(db, "users", orderDetails.userId));

      //  if (userDoc.exists()) {
      //   const userMail = userDoc.data().email;

      const userMail = orderDetails?.mail_invoice;
      console.log("User email:", userMail);

      // Créer un nouveau document dans la collection "mail"
      await setDoc(newEmail, {
        to: userMail,
        message: {
          subject: "Commande livrée",
          text: "Commande livrée avec succès",
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
      /*} else {
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

  const archivOrder = async () => {
    try {
      updateOrder();
      // Récupérer les données de la commande depuis la collection actuelle
      const orderSnapshot = doc(db, title, params.id);
      const orderData = await getDoc(orderSnapshot);

      const dataRef = collection(db, "archivedOrders");

      const deliveryData = orderData.data();

      // Ajouter les données à la nouvelle collection "archivedOrders"
      await setDoc(doc(dataRef, params.id), {
        ...deliveryData,
        timeStamp: serverTimestamp(),
      });

      // Supprimer la commande de la collection actuelle
      await deleteDoc(doc(db, title, params.id));

      // 4. Vérifier si l'utilisateur avait validé un code
      const userDoc = await getDoc(doc(db, "users", orderDetails.userId));
      if (userDoc.exists()) {
        const validatedCode = userDoc.data().validatedCode;
        if (validatedCode) {
          const gameRef = doc(db, "game", validatedCode);
          const gameSnap = await getDoc(gameRef);
          if (gameSnap.exists()) {
            const gameData = gameSnap.data();

            // 1. on met à jour global points
            const newPoints = (gameData.points || 0) + 10;
            const newGivenPoints = (gameData.givenPoints || 0) + 10;

            // 2. on cherche l'élément dans usedBy correspondant à l'utilisateur
            const usedByList = gameData.usedBy || [];
            const updatedUsedBy = usedByList.map((item) => {
              if (item.uid === orderDetails.userId) {
                return {
                  ...item,
                  givenPoint: (item.givenPoint || 0) + 10,
                };
              }
              return item;
            });

            // 3. update Firestore
            await updateDoc(gameRef, {
              points: newPoints,
              givenPoints: newGivenPoints,
              usedBy: updatedUsedBy,
            });

            console.log(
              "10 points ajoutés et givenPoint mis à jour dans usedBy"
            );
          }
        }
      }

      console.log("La commande a été archivée avec succès !");
      await sendPerMail();
      navigate("/delivery");
    } catch (error) {
      console.error("Erreur lors de l'archivage de la commande :", error);
    }
  };

  return (
    <div className="details">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />

        <div className="top">
          <h1>Détails de la Livraison</h1>
          <Link className="link" onClick={archivOrder}>
            {btnValidation}
          </Link>
        </div>

        <div className="formContainer">
          <form>
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
              ></textarea>
            </div>

            <div className="formGroup">
              <label>Status du payement:</label>
              <input
                type="text"
                value={orderDetails?.payed ? "Payer" : "En attente de payement"}
                className={orderDetails?.payed ? "paid" : "pending"}
                disabled
              />
            </div>
            <div className="formGroup">
              <label>Status de la livraison:</label>
              <input
                type="text"
                value={orderDetails?.delivered ? "Livrer" : "Pas encore livrer"}
                className={
                  orderDetails?.delivered ? "delivered" : "notDelivered"
                }
                disabled
              />
            </div>
            <div className="formGroup">
              <label>Total:</label>
              <input type="text" value={orderDetails?.total || ""} disabled />
            </div>
            <div className="formGroup">
              <label>Date et heure:</label>
              <input
                type="text"
                value={
                  orderDetails?.timeStamp &&
                  format(
                    orderDetails?.timeStamp.toDate(),
                    "dd/MM/yyyy HH:mm:ss"
                  )
                }
                disabled
              />
            </div>
            <div className="orderItems">
              <h2>Produits commandés</h2>
              <ul>
                {orderDetails?.cart?.map((product, index) => (
                  <li key={index}>
                    <div>
                      <span>{product.name}</span>
                    </div>
                    {/* Ajout des nouvelles informations ici */}
                    <div>
                      <span>
                        Quantité en gros:{" "}
                        {formatPrice(product.amountBulk) || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span>
                        Quantité en détail:{" "}
                        {formatPrice(product.amountDetail) || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span>
                        Prix en gros: {formatPrice(product.priceBulk) || "N/A"}{" "}
                        GNF
                      </span>
                    </div>
                    <div>
                      <span>
                        Prix en détail:{" "}
                        {formatPrice(product.priceDetail) || "N/A"} GNF
                      </span>
                    </div>
                    <div>
                      <span>
                        Quantité en détail: {product.quantityDetail || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span>
                        Seconde quantité: {product.secondQuantity || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span>
                        Montant total:{" "}
                        {formatPrice(product.totalAmount) || "N/A"} GNF
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </form>
        </div>

        <div>
          <button onClick={goBack}>Revenir en arrière</button>

          <button onClick={printOrder}>Imprimer la commande</button>
        </div>
      </div>
    </div>
  );
};

export default DetailsDeliveryOrders;
