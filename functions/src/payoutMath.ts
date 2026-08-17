// Logique de calcul des commissions et du ledger vendeur.
// Extrait de index.ts pour permettre des tests unitaires sans dependre
// du SDK Firebase Admin initialise (admin.initializeApp()) ni de Firestore.

import * as crypto from "crypto";

export const PLATFORM_COMMISSION_RATE = 0.05;

export interface OrderItemSummary {
  title: string;
  qty: number;
  price: number;
  productId?: string;
  vendorId?: string;
  vendorName?: string;
}

export interface OrderSnapshotMinimal {
  items: OrderItemSummary[];
  total: number;
  currency: string;
  deliveredAt: FirebaseFirestore.Timestamp;
}

export interface VendorLedgerEntryDraft {
  entryId: string;
  orderId: string;
  lineIndex: number;
  productId?: string;
  title: string;
  qty: number;
  unitPrice: number;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  vendorId: string;
  vendorName?: string;
  currency: string;
  deliveredAt: FirebaseFirestore.Timestamp;
}

export interface VendorLedgerComputation {
  eligible: boolean;
  reason?: string;
  entries: VendorLedgerEntryDraft[];
  missingVendorItems: Array<{
    lineIndex: number;
    title: string;
    productId?: string;
    vendorName?: string;
    vendorId?: string;
  }>;
  totals: {
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
  };
}

export const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const roundMoney = (value: number): number =>
  Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

export const nonEmptyString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

export const normalizeDocIdPart = (value: unknown, fallback = "unknown"): string => {
  const source = nonEmptyString(value);
  if (!source) return fallback;
  const normalized = source.replace(/[^a-zA-Z0-9_-]/g, "_");
  return normalized.length ? normalized.slice(0, 80) : fallback;
};

export const isTrue = (value: unknown): boolean => value === true;

export const normalizeStatusText = (value: unknown): string | null => {
  const raw = nonEmptyString(value);
  if (!raw) return null;
  return raw.replace(/\s+/g, "_").toLowerCase();
};

export const isBlockedStatus = (value: unknown): boolean => {
  const normalized = normalizeStatusText(value);
  return Boolean(
    normalized &&
      ["blocked", "disabled", "inactive", "suspended", "bloque", "bloqué"].includes(normalized)
  );
};

export const isOrderEligibleForVendorPayout = (
  order: Record<string, any>
): VendorLedgerComputation => {
  if (!isTrue(order.payed)) {
    return {
      eligible: false,
      reason: "order_not_paid",
      entries: [],
      missingVendorItems: [],
      totals: { grossAmount: 0, commissionAmount: 0, netAmount: 0 },
    };
  }
  if (!isTrue(order.delivered)) {
    return {
      eligible: false,
      reason: "order_not_delivered",
      entries: [],
      missingVendorItems: [],
      totals: { grossAmount: 0, commissionAmount: 0, netAmount: 0 },
    };
  }
  if (isTrue(order.fakeOrder)) {
    return {
      eligible: false,
      reason: "order_marked_fake",
      entries: [],
      missingVendorItems: [],
      totals: { grossAmount: 0, commissionAmount: 0, netAmount: 0 },
    };
  }
  return {
    eligible: true,
    entries: [],
    missingVendorItems: [],
    totals: { grossAmount: 0, commissionAmount: 0, netAmount: 0 },
  };
};

export const buildLedgerEntryId = (
  orderId: string,
  lineIndex: number,
  vendorId: string,
  productId?: string
): string => {
  const orderPart = normalizeDocIdPart(orderId, "order");
  const vendorPart = normalizeDocIdPart(vendorId, "vendor");
  const productPart = normalizeDocIdPart(productId, "item");
  const hash = crypto
    .createHash("sha1")
    .update(`${orderId}|${lineIndex}|${vendorId}|${productId ?? ""}`)
    .digest("hex")
    .slice(0, 16);
  return `vled_${orderPart}_${vendorPart}_${lineIndex}_${productPart}_${hash}`;
};

export const computeVendorLedger = (
  orderId: string,
  archivedOrder: Record<string, any>,
  snapshot: OrderSnapshotMinimal
): VendorLedgerComputation => {
  const eligibility = isOrderEligibleForVendorPayout(archivedOrder);
  if (!eligibility.eligible) {
    return eligibility;
  }

  const entries: VendorLedgerEntryDraft[] = [];
  const missingVendorItems: VendorLedgerComputation["missingVendorItems"] = [];
  const totals = {
    grossAmount: 0,
    commissionAmount: 0,
    netAmount: 0,
  };

  snapshot.items.forEach((item, index) => {
    const qty = Math.max(1, Math.floor(toNumber(item.qty, 1)));
    const unitPrice = roundMoney(toNumber(item.price, 0));
    const grossAmount = roundMoney(qty * unitPrice);
    if (grossAmount <= 0) {
      return;
    }

    const commissionAmount = roundMoney(grossAmount * PLATFORM_COMMISSION_RATE);
    const netAmount = roundMoney(grossAmount - commissionAmount);
    const vendorId = nonEmptyString(item.vendorId) ?? undefined;
    const vendorName = nonEmptyString(item.vendorName) ?? undefined;
    const productId = nonEmptyString(item.productId) ?? undefined;

    totals.grossAmount = roundMoney(totals.grossAmount + grossAmount);
    totals.commissionAmount = roundMoney(totals.commissionAmount + commissionAmount);
    totals.netAmount = roundMoney(totals.netAmount + netAmount);

    if (!vendorId) {
      missingVendorItems.push({
        lineIndex: index,
        title: item.title,
        ...(productId ? { productId } : {}),
        ...(vendorName ? { vendorName } : {}),
      });
      return;
    }

    entries.push({
      entryId: buildLedgerEntryId(orderId, index, vendorId, productId),
      orderId,
      lineIndex: index,
      ...(productId ? { productId } : {}),
      title: item.title,
      qty,
      unitPrice,
      grossAmount,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmount,
      netAmount,
      vendorId,
      ...(vendorName ? { vendorName } : {}),
      currency: snapshot.currency,
      deliveredAt: snapshot.deliveredAt,
    });
  });

  return {
    eligible: true,
    entries,
    missingVendorItems,
    totals,
  };
};
