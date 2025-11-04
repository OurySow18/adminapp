//import "./DetailsDeliveryOrders.scss";
import "../../style/orderDetails.scss";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";
import { format } from "date-fns";

import { db } from "../../firebase";
import {
  collection, 
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch, 
} from "firebase/firestore";

const POINTS_PER_ORDER = 10;

export default function DetailsDeliveryOrders({ title, btnValidation }) {
  const [orderDetails, setOrderDetails] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const params = useParams();

  // ── RÉCUPÉRER LA COMMANDE EN LIVE
  useEffect(() => {
    const ref = doc(db, title, params.id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setOrderDetails(snap.data());
      },
      (err) => console.error("Snapshot order error:", err)
    );
    return () => unsub();
  }, [params.id, title]);

  // ── UTILITAIRES
  const formatPrice = (price) =>
    Number(price || 0).toLocaleString("fr-FR", {
      style: "currency",
      currency: "GNF",
    });

  // Flag dans "orders" (pour éviter re-traitement côté UI)
  const flagOrderDeliveredAndArchived = async () => {
    await updateDoc(doc(db, "orders", params.id), {
      delivered: true,
      archived: true,
    });
  };

  // ── IMPRESSION
  const generatePrintContent = () => {
    const d = orderDetails || {};
    const di = d.deliverInfos || {};
    const now = d?.timeStamp ? d.timeStamp.toDate() : new Date();
    const printedDate = format(now, "dd/MM/yyyy");

    const header = `
      <div class="invoice-header">
        <div class="company-info">
          <img src="https://firebasestorage.googleapis.com/v0/b/monmarhe.appspot.com/o/logo%2Ficon-192.png?alt=media&token=e0038238-452c-4940-bffd-2fed309ce07e" alt="Logo Monmarche" class="company-logo" />
          <div class="company-details">
            <h1>Monmarche</h1>
            <p>Bantounka 2</p>
            <p>Tel: +224 612 12 12 29</p>
            <p>infos@monmarchegn.com</p>
          </div>
        </div>
        <div class="invoice-info">
          <h2>Facture</h2>
          <p>Date: ${printedDate}</p>
        </div>
      </div>
    `;

    const customer = `
      <div class="customer-info">
        <h3>Coordonnées du client :</h3>
        <p>No Facture: ${d?.orderId ?? ""}</p>
        <p>Nom: ${di?.name ?? ""}</p>
        <p>Adresse: ${di?.address ?? ""}</p>
        <p>Téléphone: ${di?.phone ?? ""}</p>
        <p>Description: ${di?.additionalInfo ?? ""}</p>
      </div>
    `;

    const items = Array.isArray(d.cart) ? d.cart : [];
    const itemsTable = `
      <table class="invoice-items">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Poids</th> 
            <th>Quantité gros</th>
            <th>Montant gros</th>
            <th>Quantité détail</th>
            <th>Montant détail</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (p) => `
              <tr>
                <td class="product-name">${p?.name ?? ""}</td>
                <td class="product-poids">${p?.poids ?? ""}</td> 
                <td class="product-quantity">${
                  p?.quantityBulk
                    ? `${p.quantityBulk} x ${formatPrice(p.priceBulk)}`
                    : "0"
                }</td>
                <td class="product-amount">${
                  p?.amountBulk ? formatPrice(p.amountBulk) : "0 GNF"
                }</td>
                <td class="product-quantity">${
                  p?.quantityDetail
                    ? `${p.quantityDetail} x ${formatPrice(p.priceDetail)}`
                    : "0"
                }</td>
                <td class="product-amount">${
                  p?.amountDetail ? formatPrice(p.amountDetail) : "0 GNF"
                }</td>
                <td class="product-total">${
                  p?.totalAmount ? formatPrice(p.totalAmount) : "0 GNF"
                }</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;

    const footer = `
      <div class="invoice-footer">
        <p>Montant Livraison: ${formatPrice(d?.deliveryFee)}</p>
        <p>Total de la facture: ${formatPrice(d?.total)}</p>
        <p>Merci de votre achat.</p>
      </div>
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

    return `
      <style>
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f3f3f3; }
          .invoice { width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; border-radius: 10px; background: #fff; }
          .company-info { display: flex; align-items: center; margin-bottom: 20px; }
          .company-logo { max-width: 100px; margin-right: 20px; }
          .invoice-items { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .invoice-items th, .invoice-items td { border: 1px solid #ddd; padding: 10px; font-size: 14px; }
          .invoice-items th { background: #0b79d0; color: #fff; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .signature-input { width: 100%; margin-top: 40px; border: none; border-bottom: 1px solid #000; text-align: center; }
        }
      </style>
      <div class="invoice">
        ${header}
        ${customer}
        ${itemsTable}
        ${footer}
      </div>
    `;
  };

  const printOrder = () => {
    const html = generatePrintContent();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  // ── MAIL (via collection "mail")
  const emailHtml = (d) => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirmation de Livraison - MonMarche</title></head>
    <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
        <div style="background:#ff6f00;color:#fff;padding:12px;text-align:center">
          <h1 style="margin:0;font-size:22px">Commande Livrée avec Succès !</h1>
        </div>
        <div style="padding:20px;text-align:center">
          <p>Votre commande <strong>${
            d?.orderId ?? ""
          }</strong> a été livrée.</p>
          <p>Adresse : <strong>${d?.deliverInfos?.address ?? ""}</strong></p>
          <p>Merci pour votre achat 🙏</p>
        </div>
        <div style="background:#ff6f00;color:#fff;padding:10px;text-align:center;font-size:12px">
          &copy; ${new Date().getFullYear()} MonMarche
        </div>
      </div>
    </body></html>`;

  const sendPerMail = async () => {
    try {
      const to = orderDetails?.mail_invoice;
      if (!to) return;
      const newEmail = doc(collection(db, "mail"));
      await setDoc(newEmail, {
        to,
        message: {
          subject: "Commande livrée",
          text: "Commande livrée avec succès",
          html: emailHtml(orderDetails),
        },
      });
      console.log("Email queued:", to);
    } catch (e) {
      console.warn("Email non envoyé (non bloquant):", e);
    }
  };

  // ── ARCHIVAGE + POINTS
  const archivOrder = async () => {
    if (isProcessing) return;

    const ok = window.confirm(
      `Confirmer l’archivage :
- delivered=true
- Archive
- +${POINTS_PER_ORDER} points parrain
- +${POINTS_PER_ORDER} points acheteur`
    );
    if (!ok) return;

    setIsProcessing(true);
    try {
      // A) Anti double-traitement
      const archivedRef = doc(db, "archivedOrders", params.id);
      const already = await getDoc(archivedRef);
      if (already.exists()) {
        alert("Cette commande est déjà archivée.");
        setIsProcessing(false);
        return;
      }

      // 1) Flags dans orders
      await flagOrderDeliveredAndArchived();

      // 2) Lire commande + archiver via batch (puis supprimer)
      const orderRef = doc(db, title, params.id);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        alert("Commande introuvable.");
        setIsProcessing(false);
        return;
      }
      const data = orderSnap.data();

      const batch = writeBatch(db);
      batch.set(archivedRef, { ...data, timeStamp: serverTimestamp() });
      batch.delete(orderRef);
      await batch.commit();

      // 4) Mail (non bloquant)
      await sendPerMail();

      alert("Commande archivée");
      navigate("/delivery");
    } catch (e) {
      console.error("Archivage error:", e);
      alert("Une erreur est survenue pendant l’archivage.");
    } finally {
      setIsProcessing(false);
    }
  };
  // Gérer le retour en arrière
  const goBack = () => {
    navigate("/delivery");
  };
  // ── RENDER
  return (
    <div className="details">
      <Sidebar />
      <div className="detailsContainer">
        <Navbar />

        <div className="top">
          <h1>Détails de la Livraison</h1>
          <Link
            className={`link ${isProcessing ? "disabled" : ""}`}
            onClick={archivOrder}
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
}
