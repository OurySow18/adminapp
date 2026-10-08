// Calcule l'activite commerciale d'un vendeur (nombre de produits, derniere
// vente, derniere connexion) pour le nettoyage de la liste des vendeurs.
// Critere d'inactivite volontairement conservateur (3 conditions a la fois)
// pour eviter de flaguer un vendeur simplement en creux :
//   1. Vendeur approuve (un draft/refuse n'est pas "un vendeur actif perdu")
//   2. Aucune vente depuis INACTIVE_VENDOR_DAYS jours (ou jamais vendu)
//   3. Aucun produit actuellement visible sur Monmarche
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { resolveVendorStatus } from "./vendorStatus";
import { loadVendorProductRows } from "./vendorProductsRepository";

export const INACTIVE_VENDOR_DAYS = 180;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

// vendor_balances/{vendorId}.updatedAt n'est touche par la Cloud Function
// que lorsqu'une nouvelle vente est appliquee pour ce vendeur : c'est donc
// la date de derniere vente sans avoir a scanner product_sales_ledger.
const loadLastSaleMap = async () => {
  const map = new Map();
  const snapshot = await getDocs(collection(db, "vendor_balances"));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const lastSaleAt = toDate(data.updatedAt);
    const lifetimeGrossAmount = Number(data.lifetimeGrossAmount) || 0;
    map.set(docSnap.id, {
      lastSaleAt,
      hasSales: lifetimeGrossAmount > 0 || Boolean(lastSaleAt),
    });
  });
  return map;
};

// Compte total de produits (toutes visibilites) + produits actuellement
// visibles sur Monmarche, par vendeur.
const loadVendorProductStatsMap = async () => {
  const map = new Map();
  const rows = await loadVendorProductRows();
  rows.forEach((row) => {
    const vendorId = row.vendorDisplayId || row.vendorId;
    if (!vendorId) return;
    const current = map.get(vendorId) || { totalCount: 0, activeCount: 0 };
    current.totalCount += 1;
    if (row.active) current.activeCount += 1;
    map.set(vendorId, current);
  });
  return map;
};

export const getVendorLastLogin = (vendorRow) =>
  toDate(
    vendorRow?.profile?.lastLoginAt ?? vendorRow?.lastLoginAt ?? vendorRow?.lastSignInAt
  );

// Charge une seule fois (getDocs, pas onSnapshot) les collections necessaires
// pour juger l'activite de chaque vendeur, et les combine. La derniere
// connexion n'est pas incluse ici : elle vit directement sur le document
// vendeur (voir getVendorLastLogin), pas dans une collection a part.
export const loadVendorActivityMap = async () => {
  const [lastSaleMap, productStatsMap] = await Promise.all([
    loadLastSaleMap(),
    loadVendorProductStatsMap(),
  ]);

  const vendorIds = new Set([...lastSaleMap.keys(), ...productStatsMap.keys()]);
  const activityMap = new Map();
  vendorIds.forEach((vendorId) => {
    const sales = lastSaleMap.get(vendorId) || { lastSaleAt: null, hasSales: false };
    const products = productStatsMap.get(vendorId) || { totalCount: 0, activeCount: 0 };
    activityMap.set(vendorId, {
      lastSaleAt: sales.lastSaleAt,
      hasSales: sales.hasSales,
      hasActiveProduct: products.activeCount > 0,
      totalProductCount: products.totalCount,
      activeProductCount: products.activeCount,
    });
  });
  return activityMap;
};

export const isVendorInactive = (
  vendorRow,
  activityInfo,
  { thresholdDays = INACTIVE_VENDOR_DAYS } = {}
) => {
  const status = resolveVendorStatus(vendorRow, "draft");
  if (status !== "approved") return false;

  const hasActiveProduct = activityInfo?.hasActiveProduct === true;
  if (hasActiveProduct) return false;

  const lastSaleAt = activityInfo?.lastSaleAt ?? null;
  if (!lastSaleAt) return true; // jamais vendu

  const daysSinceLastSale = (Date.now() - lastSaleAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastSale >= thresholdDays;
};

export const formatLastActivity = (lastSaleAt, neverLabel = "Jamais vendu") => {
  if (!lastSaleAt) return neverLabel;
  const days = Math.floor((Date.now() - lastSaleAt.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
};
