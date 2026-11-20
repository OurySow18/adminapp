// Donnees de tracabilite des ventes d'un vendeur : chaque ligne vendue
// (vendor_ledger, alimente par la Cloud Function a l'archivage d'une
// commande) + les commandes en cours (collection orders, pas encore
// livrees/payees/archivees) qui contiennent un produit de ce vendeur.
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

// Meme resolution que DetailsOrder.jsx / useOrderData.js, pour identifier a
// quel vendeur appartient un article du panier d'une commande.
const resolveCartItemVendorId = (item) =>
  item?.vendorId ||
  item?.vendor?.vendorId ||
  item?.vendor?.id ||
  item?.vendor?.uid ||
  item?.sellerId ||
  item?.storeId ||
  null;

const resolveCartItemProductId = (item) =>
  item?.productId || item?.id || item?.product?.id || null;

const resolveCartItemTitle = (item) =>
  item?.name || item?.title || item?.productName || "Produit sans nom";

const resolveCartItemAmount = (item) =>
  toNumber(item?.totalAmount ?? item?.total ?? item?.amount, 0);

const resolveCartItemQty = (item) => {
  const bulk = Math.max(0, toNumber(item?.quantityBulk, 0));
  const detail = Math.max(0, toNumber(item?.quantityDetail, 0));
  if (bulk + detail > 0) return bulk + detail;
  return Math.max(1, toNumber(item?.quantity ?? item?.qty, 1));
};

// Toutes les lignes vendues (vendor_ledger) de ce vendeur, triees de la plus
// recente a la plus ancienne. Un seul filtre d'egalite (vendorId) : pas
// d'index composite necessaire (meme requete que VendorPayoutDetails.jsx).
export const loadVendorLedgerEntries = async (vendorId) => {
  const q = query(collection(db, "vendor_ledger"), where("vendorId", "==", vendorId));
  const snap = await getDocs(q);
  const entries = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      vendorId: data.vendorId || vendorId,
      orderId: data.orderId || null,
      lineIndex: data.lineIndex ?? null,
      productId: data.productId || null,
      title: data.title || "Produit sans nom",
      qty: toNumber(data.qty),
      unitPrice: toNumber(data.unitPrice),
      grossAmount: toNumber(data.grossAmount),
      commissionAmount: toNumber(data.commissionAmount),
      netAmount: toNumber(data.netAmount),
      currency: data.currency || "GNF",
      status: data.status || "pending",
      deliveredAt: data.deliveredAt || null,
      createdAt: data.createdAt || null,
      paidAt: data.paidAt || null,
      paidByEmail: data.paidByEmail || null,
      paidBatchId: data.paidBatchId || null,
    };
  });
  entries.sort((a, b) => toMillis(b.deliveredAt) - toMillis(a.deliveredAt));
  return entries;
};

// Articles de ce vendeur presents dans des commandes encore actives (pas
// archivees -> pas encore livrees/payees, ou en tout cas pas encore passees
// par le ledger). orders ne contient que les commandes non archivees : lot
// borne, pas un scan d'une grosse collection.
export const loadVendorPendingOrderItems = async (vendorId) => {
  const snap = await getDocs(collection(db, "orders"));
  const items = [];
  snap.forEach((docSnap) => {
    const order = docSnap.data() || {};
    const cart = Array.isArray(order.cart) ? order.cart : [];
    cart.forEach((item, index) => {
      if (resolveCartItemVendorId(item) !== vendorId) return;
      items.push({
        orderDocId: docSnap.id,
        orderId: order.orderId || docSnap.id,
        lineIndex: index,
        productId: resolveCartItemProductId(item),
        title: resolveCartItemTitle(item),
        qty: resolveCartItemQty(item),
        amount: resolveCartItemAmount(item),
        payed: order.payed === true,
        delivered: order.delivered === true,
        fakeOrder: order.fakeOrder === true,
        timeStamp: order.timeStamp || null,
      });
    });
  });
  items.sort((a, b) => toMillis(b.timeStamp) - toMillis(a.timeStamp));
  return items;
};

// Regroupe les lignes vendues + les articles en cours par produit, pour la
// liste "Ventes du vendeur" (un produit = une ligne de synthese).
export const aggregateVendorSalesByProduct = (ledgerEntries, pendingItems) => {
  const byProduct = new Map();

  const ensure = (productId, title) => {
    const key = productId || `__no_id__${title}`;
    if (!byProduct.has(key)) {
      byProduct.set(key, {
        productId: productId || null,
        title,
        unitsSold: 0,
        grossAmount: 0,
        orderIds: new Set(),
        paidCount: 0,
        pendingPaymentCount: 0,
        reversedCount: 0,
        pendingLiveUnits: 0,
        pendingLiveOrderIds: new Set(),
        lastSoldAt: null,
      });
    }
    return byProduct.get(key);
  };

  ledgerEntries.forEach((entry) => {
    const row = ensure(entry.productId, entry.title);
    row.unitsSold += entry.qty;
    row.grossAmount += entry.grossAmount;
    if (entry.orderId) row.orderIds.add(entry.orderId);
    if (entry.status === "paid") row.paidCount += 1;
    else if (entry.status === "reversed") row.reversedCount += 1;
    else row.pendingPaymentCount += 1;
    const deliveredMillis = toMillis(entry.deliveredAt);
    if (!row.lastSoldAt || deliveredMillis > toMillis(row.lastSoldAt)) {
      row.lastSoldAt = entry.deliveredAt;
    }
  });

  pendingItems.forEach((item) => {
    const row = ensure(item.productId, item.title);
    row.pendingLiveUnits += item.qty;
    if (item.orderDocId) row.pendingLiveOrderIds.add(item.orderDocId);
  });

  return Array.from(byProduct.values())
    .map((row) => ({
      ...row,
      ordersCount: row.orderIds.size,
      pendingLiveOrdersCount: row.pendingLiveOrderIds.size,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);
};
