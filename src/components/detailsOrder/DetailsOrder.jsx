import "./detailsOrder.scss";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns"; 

import { getAuth } from "firebase/auth";
import { db } from "../../firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  collection,
} from "firebase/firestore";

const DetailsOrder = ({ title, btnValidation }) => {
  const [orderDetails, setOrderDetails] = useState([]);
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
  }, []);

  // Gérer le retour en arrière
  const goBack = () => {
    navigate("/orders"); // Rediriger vers la page des produits
  };

  console.log(orderDetails);
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
            <p>monmarchegn@gmail.com</p>
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
        <p>Description: ${orderDetails.deliverInfos.deliv_description}</p>
      </div>
    `;

    const footerContent = `
    <div class="invoice-footer">
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
            <th>Prix unitaire</th>
            <th>Quantité</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${orderDetails.cart
            .map(
              (product, index) => `
            <tr> 
              <td>${product.name}</td>
              <td>${product.price} GNF</td>
              <td>${product.quantity}</td>
              <td>${product.quantity * product.price} GNF</td>
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
          }
          .invoice {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 5px;
            background-color: #f9f9f9;
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
            font-size: 24px;
            margin: 0;
          }
          .company-details p {
            margin: 5px 0;
          }
          .invoice-info {
            flex-grow: 1;
            text-align: right;
          }
          .invoice-info h2 {
            font-size: 24px;
            margin: 0;
          }
          .invoice-info p {
            margin: 5px 0;
          }
          .customer-info {
            margin-bottom: 20px;
          }
          .customer-info h3 {
            margin-top: 0;
          }
          .customer-info p {
            margin: 5px 0;
          }
          .invoice-footer {
            text-align: center;
            margin-top: 20px;
          }
          .invoice-footer p {
            margin: 5px 0;
          }
          .invoice-items {
            border-collapse: collapse;
            width: 100%;
          }
          .invoice-items th, .invoice-items td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .invoice-items th {
            background-color: #f2f2f2;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
          }
          
          .signature {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 20px; /* Espace réservé pour chaque signature en haut de la ligne */
            page-break-inside: avoid;
          }
          
          .signature-input {
            width: 100%;
            margin-top: 200px;
            margin-bottom: 10px; /* Espacement entre la signature et le titre */
          }
          
          .signature h3 {
            margin: 0;
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
  <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
      <style>
        body {
          background-color: #ffffff;
          color: #333;
          font-family: Arial, sans-serif;
        }
        header {
          background-color: #ff6f00;
          color: #fff;
          text-align: center;
          padding: 10px;
        }
        footer {
          background-color: #ff6f00;
          color: #fff;
          text-align: center;
          padding: 10px;
          position: fixed;
          bottom: 0;
          width: 100%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        table, th, td {
          border: 1px solid #ddd;
        }
        th, td {
          padding: 15px;
          text-align: left;
        }
        th {
          background-color: #ff6f00;
          color: #fff;
        }
        tr:nth-child(even) {
          background-color: #ff6f00;
        }
        span {
          font-weight: bold;
        }
        .important {
          color: #4a148c;
        }
      </style></head>
    <body>
    <header>
    <h1>Facture</h1>
    
    <table style="width: 100%"> 
    <tr>
       <td >
       <p>No Facture: ${orderDetails.orderId}</p>
       <p>Nom: ${orderDetails.deliverInfos?.name}</p>
       <p>Adresse: ${orderDetails.deliverInfos?.address}</p>
       <p>Telephone: ${orderDetails.deliverInfos?.phone}</p>
       <p>Telephone: ${orderDetails.deliverInfos?.deliv_description}</p>
       <p>Type de Payement: ${orderDetails.paymentType} </p> 
       <p>Montant Total de la Facture: ${orderDetails.total} </p> 
       </td>
       <td >
       <img src="https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/logo%2Ficon-192.png?alt=media&token=e0038238-452c-4940-bffd-2fed309ce07e" alt="HTML5 Icon" style="max-width: 60%; height: auto; float: right;">
       </td>
    </tr> 
  </table> 
    <h1>Infos sur le payement</h1>
  <payement> 
  <p>Votre paiement a été accepté, vous recevrez votre commande sous 48 heures. Un de nos livreurs contactera ce numéro de téléphone: ${
    orderDetails.deliverInfos?.phone
  }</p>
  <p>Assurez-vous que ce numéro soit accessible entre 8h-17h.</p>
  </payement>
  </header> 
  <article>
    <h1>Code de Scan</h1>     
    <article> 
    <div style="height: auto; margin: 0 auto; max-width: 200px; width: 100%;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${
      orderDetails?.scanNum
    }" alt="Code-barres de la commande" style="max-width: 100%; height: auto;">
  </div>
    </article> 
  </article>  
  <aside>
    <h1><span>Important</span></h1>
    <div>
      <p>Au cas oü on n´arriverait pas ä vous joindre sur ce numero, aucune livraison ne serra effectuez et un delais d´une semaine<br/>
       vous serra attribuer pour rentrer en contact avec nous et decider de la livraison ou d´un remboursement.</p>
    </div>
  </aside> 
  <footer>
  <p>&copy; ${new Date().getFullYear()} MonMarche. Cosa rond point, immeuble Elhadj Chérif. +224 612121229. Tous droits réservés.</p>
  
  </footer>
    </body>
  </html>
  `;
  const sendPerMail = async () => {
    // Add a new document with a generated id
    const newEmail = doc(collection(db, "mail"));
    var user = getAuth().currentUser;
    var userMail = user.email; 

    await setDoc(newEmail, {
      //to: [userMail],
      to: "amadourys15@yahoo.com",
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
  };

  const validateOrder = async () => {
    try {
      // Mettez à jour la valeur payed dans la base de données
      await updateDoc(doc(db, "orders", params.id), {
        payed: true,
      });
      // Mettre à jour l'état local si nécessaire
      // setData({ ...data, payed: true });
      await sendPerMail();
      console.log("La commande a été validée avec succès !");
    } catch (error) {
      console.error("Erreur lors de la validation de la commande :", error);
    }
  };

  return (
    <div className="details">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />

        <div className="top">
          <h1>Détails de la commande</h1>
          <Link className="link" onClick={validateOrder}>
            {btnValidation}
          </Link>
        </div>

        <div className="formContainer">
          <form>
            <div className="formGroup">
              <label>ID de l'utilisateur: </label>
              <input type="text" value={orderDetails?.userId || ""} disabled />
            </div>
            <div className="formGroup">
              <label>ID de la commande:</label>
              <input type="text" value={orderDetails?.orderId || ""} disabled />
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
                className={orderDetails?.delivered ? "delivered" : "notDelivered"}
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
                    <span>
                      {product.quantity} x {product.name}
                    </span>
                    <span>{product.price} GNF</span>
                    <span>{product.quantity * product.price} GNF</span>
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

export default DetailsOrder;
