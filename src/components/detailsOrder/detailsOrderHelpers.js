// Fonctions pures utilisees par DetailsOrder.jsx : formatage, generation du
// contenu imprimable et des templates email. Extrait pour reduire la taille
// du composant ; aucune logique modifiee lors du deplacement.
import { format } from "date-fns";
import { resolveOrderDate } from "../../utils/orderDate";

// Echappe les valeurs injectees dans les templates HTML d'email (nom,
// adresse, message...) qui peuvent contenir du texte fourni par le client.
// Sans ca, un client pourrait injecter du HTML/liens dans les emails
// envoyes en son nom (meme correctif que vendorDetailsHelpers.js).
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

export const formatPrice = (price) => {
  const safe = Number(price);
  return (Number.isFinite(safe) ? safe : 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "GNF",
  });
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildArchivedOrderSnapshot = (orderData, deliveredAtFieldValue) => {
  const cart = Array.isArray(orderData?.cart) ? orderData.cart : [];
  const items = cart
    .map((item) => {
      const title = item?.name || item?.title || item?.productName;
      if (!title) return null;

      const qtyBulk = Math.max(0, Math.floor(toNumber(item?.quantityBulk, 0)));
      const qtyDetail = Math.max(0, Math.floor(toNumber(item?.quantityDetail, 0)));
      const qty = qtyBulk + qtyDetail;
      const lineTotal = toNumber(
        item?.totalAmount ?? item?.amount ?? item?.amountDetail ?? item?.amountBulk,
        0
      );
      const unitPrice =
        qty > 0 ? lineTotal / qty : toNumber(item?.priceDetail ?? item?.priceBulk, 0);
      const productId =
        item?.productId || item?.id || item?.product?.id || undefined;
      const vendorId =
        item?.vendorId ||
        item?.vendor?.vendorId ||
        item?.vendor?.id ||
        item?.vendor?.uid ||
        item?.sellerId ||
        item?.storeId ||
        undefined;
      const vendorName =
        item?.vendorName || item?.vendor?.name || item?.vendor?.vendorName || undefined;

      return {
        title,
        qty: qty > 0 ? qty : 1,
        price: Number.isFinite(unitPrice) ? unitPrice : 0,
        ...(productId ? { productId } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(vendorName ? { vendorName } : {}),
      };
    })
    .filter(Boolean);

  const itemsTotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const total = toNumber(orderData?.total ?? orderData?.totalAmount, itemsTotal);
  const currency = orderData?.currency || "GNF";

  return {
    items,
    total,
    currency,
    deliveredAt: deliveredAtFieldValue,
  };
};

export const formatDateTime = (value) => {
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

export const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export const resolveDriverUsername = (driverData, fallbackId) => {
  const candidates = [
    driverData?.username,
    driverData?.surname,
    driverData?.name,
    driverData?.displayName,
    driverData?.email,
    fallbackId,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim() : fallbackId;
};

export const collectZoneKeywords = (zoneData) => {
  if (!zoneData || typeof zoneData !== "object") return [];
  const values = [];
  const push = (value) => {
    if (typeof value === "string" && value.trim()) {
      values.push(normalizeText(value));
    }
  };
  const pushList = (value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => push(item));
    }
  };

  push(zoneData.zoneName);
  push(zoneData.nameZone);
  push(zoneData.name);
  push(zoneData.label);
  push(zoneData.commune);
  push(zoneData.district);
  push(zoneData.quarter);
  push(zoneData.quartier);
  pushList(zoneData.quarters);
  pushList(zoneData.quartiers);
  pushList(zoneData.neighborhoods);
  pushList(zoneData.neighbourhoods);

  return Array.from(new Set(values)).filter((value) => value.length >= 3);
};

export const formatPackaging = (value, fallbackUnit = "") => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") {
    const objectValue = [
      value.label,
      value.displayName,
      value.value,
      value.amount,
      value.weight
    ].find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
    const unit = [value.unit, value.symbol, fallbackUnit].find(Boolean);
    return objectValue !== undefined
      ? `${objectValue}${unit ? ` ${unit}` : ""}`
      : null;
  }
  return `${value}${fallbackUnit ? ` ${fallbackUnit}` : ""}`;
};

export const buildPaymentEmailHtml = (details) => `
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
            <p><strong>No Facture:</strong> ${escapeHtml(details?.orderId || "")}</p>
            <p><strong>Nom:</strong> ${escapeHtml(details?.deliverInfos?.name || "")} </p>
            <p><strong>Adresse:</strong> ${
              escapeHtml(details?.deliverInfos?.address || "")
            }</p>
            <p><strong>Téléphone:</strong> ${
              escapeHtml(details?.deliverInfos?.phone || "")
            }</p>
            <p><strong>Informations supplémentaires:</strong> ${
              escapeHtml(details?.deliverInfos?.additionalInfo || "")
            }</p>
            <p><strong>Type de paiement:</strong> ${
              escapeHtml(details?.paymentType || "")
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
              escapeHtml(details?.deliverInfos?.phone || "")
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
                escapeHtml(details?.scanNum || "")
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

export const buildDeliveryEmailHtml = (details) => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirmation de Livraison - MonMarche</title></head>
    <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
        <div style="background:#ff6f00;color:#fff;padding:12px;text-align:center">
          <h1 style="margin:0;font-size:22px">Commande Livrée avec Succès !</h1>
        </div>
        <div style="padding:20px;text-align:center">
          <p>Votre commande <strong>${escapeHtml(details?.orderId ?? "")}</strong> a été livrée.</p>
          <p>Adresse : <strong>${escapeHtml(details?.deliverInfos?.address ?? "")}</strong></p>
          <p>Merci pour votre achat.</p>
        </div>
        <div style="background:#ff6f00;color:#fff;padding:10px;text-align:center;font-size:12px">
          &copy; ${new Date().getFullYear()} MonMarche
        </div>
      </div>
    </body></html>`;

export const fakeOrderEmailHtml = (message) => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Information sur votre commande - MonMarche</title></head>
    <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
        <div style="background:#ff6f00;color:#fff;padding:12px;text-align:center">
          <h1 style="margin:0;font-size:20px">Information Importante</h1>
        </div>
        <div style="padding:20px">
          <p>Bonjour,</p>
          <p>${escapeHtml(message)}</p>
          <p>Merci,</p>
          <p>Service Client MonMarché</p>
        </div>
        <div style="background:#ff6f00;color:#fff;padding:10px;text-align:center;font-size:12px">
          &copy; ${new Date().getFullYear()} MonMarche
        </div>
      </div>
    </body></html>`;

// orderDetails, orderId : passes explicitement plutot que captures par
// fermeture, pour que cette fonction reste testable independamment du
// composant.
export const generateCompactPrintContent = (orderDetails, orderId) => {
  const details = orderDetails || {};
  const delivery = details.deliverInfos || {};
  const cart = Array.isArray(details.cart) ? details.cart : [];
  const money = (value) =>
    `${toNumber(value, 0).toLocaleString("fr-FR")} GNF`;
  const invoiceLines = cart.flatMap((product) => {
    const name = product?.name || product?.title || product?.productName || "Produit";
    const packaging =
      product?.poids || product?.weight || product?.conditionnement || product?.unit || "—";
    const lines = [];
    const bulkQuantity = Math.max(0, toNumber(product?.quantityBulk, 0));
    const detailQuantity = Math.max(0, toNumber(product?.quantityDetail, 0));
    const bulkAmount = toNumber(product?.amountBulk, 0);
    const detailAmount = toNumber(product?.amountDetail, 0);
    if (bulkQuantity > 0 || bulkAmount > 0) {
      lines.push({
        name,
        packaging,
        quantity: bulkQuantity,
        unitPrice: toNumber(product?.priceBulk, bulkQuantity ? bulkAmount / bulkQuantity : 0),
        total: bulkAmount,
      });
    }
    if (detailQuantity > 0 || detailAmount > 0) {
      lines.push({
        name,
        packaging,
        quantity: detailQuantity,
        unitPrice: toNumber(
          product?.priceDetail,
          detailQuantity ? detailAmount / detailQuantity : 0
        ),
        total: detailAmount,
      });
    }
    if (!lines.length) {
      const quantity = Math.max(1, toNumber(product?.quantity ?? product?.qty, 1));
      const total = toNumber(product?.totalAmount ?? product?.total ?? product?.amount, 0);
      lines.push({
        name,
        packaging,
        quantity,
        unitPrice: toNumber(product?.price ?? product?.unitPrice, total / quantity),
        total,
      });
    }
    return lines;
  });
  const productsSubtotal = invoiceLines.reduce((sum, line) => sum + line.total, 0);
  const deliveryFee = toNumber(details.deliveryFee, 0);
  const invoiceTotal = toNumber(
    details.total ?? details.totalAmount,
    productsSubtotal + deliveryFee
  );
  const invoiceNumber = details.orderId || orderId || "—";
  const formattedDate = format(resolveOrderDate(details), "dd/MM/yyyy à HH:mm");
  const optionalCustomerFields = [
    delivery.phone
      ? `<div><span>Téléphone</span><strong>${escapeHtml(delivery.phone)}</strong></div>`
      : "",
    details.mail_invoice
      ? `<div><span>E-mail</span><strong>${escapeHtml(details.mail_invoice)}</strong></div>`
      : "",
    delivery.additionalInfo
      ? `<div class="full"><span>Instructions</span><strong>${escapeHtml(delivery.additionalInfo)}</strong></div>`
      : "",
  ].join("");

  return `<!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Facture ${escapeHtml(invoiceNumber)}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #1f2937; background: #fff; font: 12px Arial, sans-serif; }
            .invoice { width: 100%; max-width: 900px; margin: 0 auto; }
            header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 3px solid #ff6f00; }
            .brand h1 { margin: 0 0 5px; color: #ff6f00; font-size: 25px; }
            .brand p, .meta p { margin: 3px 0; color: #64748b; }
            .meta { text-align: right; }
            .meta h2 { margin: 0 0 7px; color: #111827; font-size: 22px; }
            .meta strong { color: #111827; }
            .customer { margin: 18px 0; padding: 14px 16px; border-radius: 8px; background: #f8fafc; }
            .customer h3 { margin: 0 0 11px; color: #111827; font-size: 14px; }
            .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 22px; }
            .customer-grid div { display: flex; gap: 8px; }
            .customer-grid .full { grid-column: 1 / -1; }
            .customer-grid span { min-width: 70px; color: #64748b; }
            .customer-grid strong { color: #111827; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; }
            th { padding: 9px 8px; color: #475569; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-align: left; font-size: 10px; text-transform: uppercase; }
            td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
            tr { page-break-inside: avoid; }
            .product { color: #111827; font-weight: 700; }
            .number { text-align: right; white-space: nowrap; }
            .line-total { color: #111827; font-weight: 700; }
            .summary { width: 310px; margin: 18px 0 0 auto; }
            .summary div { display: flex; justify-content: space-between; padding: 6px 0; }
            .summary span { color: #64748b; }
            .summary .total { margin-top: 5px; padding-top: 10px; border-top: 2px solid #ff6f00; color: #111827; font-size: 15px; font-weight: 800; }
            .thanks { margin: 22px 0 0; color: #64748b; text-align: center; }
            .signatures { display: flex; gap: 50px; margin-top: 55px; page-break-inside: avoid; }
            .signature { flex: 1; padding-top: 8px; border-top: 1px solid #64748b; text-align: center; color: #475569; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main class="invoice">
            <header>
              <div class="brand"><h1>Monmarché</h1><p>+224 612 12 12 29 · infos@monmarchegn.com</p></div>
              <div class="meta"><h2>Facture</h2><p>N° <strong>${escapeHtml(invoiceNumber)}</strong></p><p>${formattedDate}</p></div>
            </header>
            <section class="customer">
              <h3>Livraison</h3>
              <div class="customer-grid">
                <div><span>Client</span><strong>${escapeHtml(delivery.name || "—")}</strong></div>
                <div><span>Adresse</span><strong>${escapeHtml(delivery.address || "—")}</strong></div>
                ${optionalCustomerFields}
              </div>
            </section>
            <table>
              <thead><tr><th>Produit</th><th>Format</th><th class="number">Qté</th><th class="number">Prix unitaire</th><th class="number">Total</th></tr></thead>
              <tbody>${invoiceLines
                .map(
                  (line) => `<tr><td class="product">${escapeHtml(line.name)}</td><td>${escapeHtml(line.packaging)}</td><td class="number">${line.quantity}</td><td class="number">${money(line.unitPrice)}</td><td class="number line-total">${money(line.total)}</td></tr>`
                )
                .join("")}</tbody>
            </table>
            <section class="summary">
              <div><span>Sous-total produits</span><strong>${money(productsSubtotal)}</strong></div>
              <div><span>Livraison</span><strong>${deliveryFee > 0 ? money(deliveryFee) : "Offerte"}</strong></div>
              <div class="total"><span>Total à payer</span><strong>${money(invoiceTotal)}</strong></div>
            </section>
            <p class="thanks">Merci pour votre commande.</p>
            <div class="signatures"><div class="signature">Signature du client</div><div class="signature">Signature du livreur</div></div>
          </main>
        </body>
      </html>`;
};
