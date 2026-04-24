import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

const REGION = "europe-west1";
const REVIEW_PAGE_URL = "https://monmarchegn.com/avis";
const REVIEW_LINK_SECRET = defineSecret("REVIEW_LINK_SECRET");

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DELAY_MS = DAY_MS;
const LINK_TTL_MS = 14 * DAY_MS;
const MAX_ATTEMPTS = 3;

type ReviewJobStatus = "scheduled" | "sent" | "failed" | "used" | "revoked";
type VendorLedgerStatus = "pending" | "paid" | "reversed";

const PLATFORM_COMMISSION_RATE = 0.05;
const VENDOR_LEDGER_VERSION = 1;

interface OrderItemSummary {
  title: string;
  qty: number;
  price: number;
  productId?: string;
  vendorId?: string;
  vendorName?: string;
}

interface OrderSnapshotMinimal {
  items: OrderItemSummary[];
  total: number;
  currency: string;
  deliveredAt: FirebaseFirestore.Timestamp;
}

interface ReviewJobDoc {
  orderId: string;
  userId: string;
  to: string;
  status: ReviewJobStatus;
  attempts: number;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  deliveredAt: FirebaseFirestore.Timestamp;
  sendAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  sentAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  usedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  lastError?: string;
}

interface VendorLedgerEntryDraft {
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

interface VendorLedgerComputation {
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

interface VendorLedgerApplyResult {
  status: "blocked" | "no_items" | "pending" | "pending_with_issues";
  reason?: string;
  entriesTotal: number;
  entriesCreated: number;
  missingVendorItems: number;
}

type StaffRole = "ADMIN" | "DRIVER";

interface CreateStaffAccountPayload {
  email?: unknown;
  password?: unknown;
  role?: unknown;
  profile?: unknown;
}

interface SettleVendorPayoutPayload {
  vendorId?: unknown;
  entryIds?: unknown;
  forceSensitiveVendor?: unknown;
  forceReason?: unknown;
}

interface VendorPayoutAccountState {
  key: "active" | "blocked" | "deleted" | "missing" | "review";
  label: string;
  requiresReview: boolean;
  reason?: string | null;
}

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(
        maybeTimestamp.seconds * 1000 + Math.floor((maybeTimestamp.nanoseconds ?? 0) / 1e6)
      );
    }
  }
  return null;
};

const asTimestamp = (value: unknown, fallback?: Date): FirebaseFirestore.Timestamp => {
  const date = asDate(value) ?? fallback ?? new Date();
  return admin.firestore.Timestamp.fromDate(date);
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value: number): number =>
  Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

const nonEmptyString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const normalizeDocIdPart = (value: unknown, fallback = "unknown"): string => {
  const source = nonEmptyString(value);
  if (!source) return fallback;
  const normalized = source.replace(/[^a-zA-Z0-9_-]/g, "_");
  return normalized.length ? normalized.slice(0, 80) : fallback;
};

const isTrue = (value: unknown): boolean => value === true;

const normalizeStatusText = (value: unknown): string | null => {
  const raw = nonEmptyString(value);
  if (!raw) return null;
  return raw.replace(/\s+/g, "_").toLowerCase();
};

const isBlockedStatus = (value: unknown): boolean => {
  const normalized = normalizeStatusText(value);
  return Boolean(
    normalized &&
      ["blocked", "disabled", "inactive", "suspended", "bloque", "bloqué"].includes(normalized)
  );
};

const resolveVendorPayoutAccountState = (
  vendorSnap: FirebaseFirestore.DocumentSnapshot,
  deletedVendorSnap: FirebaseFirestore.DocumentSnapshot
): VendorPayoutAccountState => {
  if (deletedVendorSnap.exists) {
    const data = deletedVendorSnap.data() || {};
    return {
      key: "deleted",
      label: "Supprimé",
      requiresReview: true,
      reason: nonEmptyString(data.deleteReason, data.deletedReason, data.reason),
    };
  }

  if (!vendorSnap.exists) {
    return {
      key: "missing",
      label: "Introuvable",
      requiresReview: true,
      reason: null,
    };
  }

  const data = vendorSnap.data() || {};
  const explicitBlocked =
    data.blocked === true ||
    data.profile?.blocked === true ||
    data.company?.blocked === true ||
    data.vendor?.blocked === true;
  const blocked =
    explicitBlocked ||
    isBlockedStatus(data.status) ||
    isBlockedStatus(data.vendorStatus) ||
    isBlockedStatus(data.profile?.status) ||
    isBlockedStatus(data.company?.status) ||
    isBlockedStatus(data.vendor?.status);

  if (blocked) {
    return {
      key: "blocked",
      label: "Bloqué",
      requiresReview: true,
      reason: nonEmptyString(
        data.blockedReason,
        data.profile?.blockedReason,
        data.company?.blockedReason,
        data.vendor?.blockedReason
      ),
    };
  }

  const explicitActive =
    data.active ??
    data.isActive ??
    data.profile?.active ??
    data.profile?.isActive ??
    data.company?.active ??
    data.vendor?.active;
  if (explicitActive === false) {
    return {
      key: "review",
      label: "Inactif",
      requiresReview: true,
      reason: null,
    };
  }

  const status =
    normalizeStatusText(data.status) ||
    normalizeStatusText(data.vendorStatus) ||
    normalizeStatusText(data.profile?.status);

  if (status && !["approved", "active", "validated"].includes(status)) {
    return {
      key: "review",
      label: status,
      requiresReview: true,
      reason: null,
    };
  }

  return {
    key: "active",
    label: "Actif",
    requiresReview: false,
    reason: null,
  };
};

const SUPER_ADMIN_UID = "rgFo1YPQNDdJxyfRCiWFXETpJHB2";
const STAFF_ROLE_COLLECTION: Record<StaffRole, "admin" | "drivers"> = {
  ADMIN: "admin",
  DRIVER: "drivers",
};

const isSuperAdminUid = (uid: string | null | undefined): boolean =>
  Boolean(uid && uid === SUPER_ADMIN_UID);

const isAdminUid = async (uid: string | null | undefined): Promise<boolean> => {
  if (!uid) return false;
  if (isSuperAdminUid(uid)) return true;
  const snap = await db.doc(`admin/${uid}`).get();
  return snap.exists;
};

const ensureNonEmptyString = (value: unknown, field: string): string => {
  const normalized = nonEmptyString(value);
  if (!normalized) {
    throw new HttpsError("invalid-argument", `${field}_required`);
  }
  return normalized;
};

const parseStaffRole = (value: unknown): StaffRole => {
  const normalized = nonEmptyString(value)?.toUpperCase();
  if (normalized === "ADMIN" || normalized === "DRIVER") {
    return normalized;
  }
  throw new HttpsError("invalid-argument", "invalid_role");
};

const isOrderEligibleForVendorPayout = (order: Record<string, any>): VendorLedgerComputation => {
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

const tsToMillis = (value: unknown): number => {
  const date = asDate(value);
  return date ? date.getTime() : 0;
};

const pickUserId = (order: Record<string, any>): string | null =>
  nonEmptyString(order.userId, order.uid, order.customerId, order.user?.uid, order.client?.uid);

const pickEmail = (order: Record<string, any>): string | null =>
  nonEmptyString(
    order.mail_invoice,
    order.email,
    order.userEmail,
    order.customerEmail,
    order.user?.email,
    order.client?.email,
    order.deliverInfos?.email
  );

const signToken = (token: string, expiresAtMs: number, secret: string): string =>
  crypto.createHmac("sha256", secret).update(`${token}${expiresAtMs}`).digest("hex");

const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const normalizeOrderItems = (order: Record<string, any>): OrderItemSummary[] => {
  const source = Array.isArray(order.cart)
    ? order.cart
    : Array.isArray(order.items)
      ? order.items
      : Array.isArray(order.orderSnapshot?.items)
        ? order.orderSnapshot.items
        : [];

  return source
    .map((item: any) => {
      const title = nonEmptyString(item.title, item.name, item.productName, item.product?.title);
      if (!title) return null;

      const qtyBulk = Math.max(0, Math.floor(toNumber(item.quantityBulk, 0)));
      const qtyDetail = Math.max(0, Math.floor(toNumber(item.quantityDetail, 0)));
      const qtyRaw = Math.max(0, Math.floor(toNumber(item.qty ?? item.quantity ?? item.count, 0)));
      const qty = qtyRaw > 0 ? qtyRaw : qtyBulk + qtyDetail;

      const lineTotal = toNumber(
        item.totalAmount ?? item.total ?? item.amount ?? item.amountDetail ?? item.amountBulk,
        0
      );
      const fallbackPrice = toNumber(item.price ?? item.priceDetail ?? item.priceBulk, 0);
      const unitPrice = qty > 0 ? lineTotal / qty : fallbackPrice;

      const productId =
        nonEmptyString(item.productId, item.product?.id, item.id) ?? undefined;
      const vendorId =
        nonEmptyString(
          item.vendorId,
          item.vendor?.vendorId,
          item.vendor?.id,
          item.vendor?.uid,
          item.sellerId,
          item.storeId
        ) ?? undefined;
      const vendorName = nonEmptyString(item.vendorName, item.vendor?.name) ?? undefined;

      return {
        title,
        qty: qty > 0 ? qty : 1,
        price: Number.isFinite(unitPrice) ? unitPrice : 0,
        ...(productId ? { productId } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(vendorName ? { vendorName } : {}),
      };
    })
    .filter(Boolean) as OrderItemSummary[];
};

type NotificationSeverity = "info" | "warning" | "danger";
type NotificationType = "order" | "vendor" | "product" | "system";
type NotificationSource = "app" | "vendor" | "delivery" | "admin";

interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  severity?: NotificationSeverity;
  source?: NotificationSource;
  entity?: {
    kind: "order" | "vendor" | "user" | "product";
    id: string;
  };
}

const createNotificationAndFanout = async (payload: NotificationPayload) => {
  const createdAt = admin.firestore.FieldValue.serverTimestamp();
  const notificationRef = db.collection("notifications").doc(payload.id);

  try {
    await notificationRef.create({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      severity: payload.severity ?? "info",
      source: payload.source ?? "app",
      entity: payload.entity ?? null,
      createdAt,
    });
  } catch (err: any) {
    if (err?.code === 6 || err?.code === "already-exists") {
      return;
    }
    throw err;
  }

  const adminSnapshot = await db.collection("admin").get();
  if (adminSnapshot.empty) return;

  const docs = adminSnapshot.docs;
  const chunkSize = 450;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    docs.slice(i, i + chunkSize).forEach((adminDoc) => {
      const inboxRef = db
        .collection("admin")
        .doc(adminDoc.id)
        .collection("notifications")
        .doc(payload.id);
      batch.set(inboxRef, {
        notificationId: payload.id,
        readAt: null,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link ?? null,
        severity: payload.severity ?? "info",
        source: payload.source ?? "app",
        entity: payload.entity ?? null,
        createdAt,
      });
    });
    await batch.commit();
  }
};

const hasDraftPending = (raw: Record<string, any>): boolean => {
  const draftStatus =
    raw?.draft_status ??
    raw?.draftStatus ??
    raw?.core?.draft_status ??
    raw?.core?.draftStatus ??
    raw?.draft?.core?.draft_status ??
    raw?.draft?.core?.draftStatus ??
    false;
  const draftChanges =
    raw?.draftChanges ??
    raw?.core?.draftChanges ??
    raw?.draft?.core?.draftChanges ??
    [];
  return Boolean(draftStatus) && Array.isArray(draftChanges) && draftChanges.length > 0;
};

const buildOrderSnapshot = (order: Record<string, any>): OrderSnapshotMinimal => {
  const deliveredAt = asTimestamp(
    order.orderSnapshot?.deliveredAt ?? order.deliveredAt ?? order.timeStamp ?? order.createdAt
  );

  const items = normalizeOrderItems(order);
  const itemsTotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);

  const total = toNumber(
    order.orderSnapshot?.total ?? order.total ?? order.totalAmount ?? order.pricing?.total,
    itemsTotal
  );

  const currency =
    nonEmptyString(order.orderSnapshot?.currency, order.currency, order.pricing?.currency, "GNF") ??
    "GNF";

  return {
    items,
    total,
    currency,
    deliveredAt,
  };
};

const buildLedgerEntryId = (
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

const computeVendorLedger = (
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

const applyVendorLedgerForArchivedOrder = async (
  archivedRef: FirebaseFirestore.DocumentReference,
  orderId: string,
  archivedOrder: Record<string, any>,
  snapshot: OrderSnapshotMinimal
): Promise<VendorLedgerApplyResult> => {
  const computed = computeVendorLedger(orderId, archivedOrder, snapshot);
  const baseStatus: VendorLedgerApplyResult["status"] = !computed.eligible
    ? "blocked"
    : computed.entries.length === 0
      ? "no_items"
      : computed.missingVendorItems.length > 0
        ? "pending_with_issues"
        : "pending";

  if (!computed.eligible) {
    await archivedRef.set(
      {
        vendorPayoutEligible: false,
        vendorPayoutReason: computed.reason ?? "not_eligible",
        vendorPayoutStatus: baseStatus,
        vendorPayoutLedgerVersion: VENDOR_LEDGER_VERSION,
        vendorPayoutCommissionRate: PLATFORM_COMMISSION_RATE,
        vendorPayoutEntriesCount: 0,
        vendorPayoutMissingVendorItemsCount: 0,
        vendorPayoutTotals: computed.totals,
        vendorPayoutLedgerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return {
      status: baseStatus,
      reason: computed.reason,
      entriesTotal: 0,
      entriesCreated: 0,
      missingVendorItems: 0,
    };
  }

  let createdEntries = 0;

  await db.runTransaction(async (tx) => {
    let createdEntriesInTx = 0;
    const ledgerRefs = computed.entries.map((entry) => db.doc(`vendor_ledger/${entry.entryId}`));
    const existingSnaps = ledgerRefs.length ? await tx.getAll(...ledgerRefs) : [];
    const deltasByVendor = new Map<
      string,
      {
        grossAmount: number;
        commissionAmount: number;
        netAmount: number;
        entriesCount: number;
        vendorName?: string;
      }
    >();

    computed.entries.forEach((entry, index) => {
      const existing = existingSnaps[index];
      if (existing?.exists) {
        return;
      }
      createdEntriesInTx += 1;

      tx.set(ledgerRefs[index], {
        ...entry,
        status: "pending" as VendorLedgerStatus,
        ledgerVersion: VENDOR_LEDGER_VERSION,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const current = deltasByVendor.get(entry.vendorId) ?? {
        grossAmount: 0,
        commissionAmount: 0,
        netAmount: 0,
        entriesCount: 0,
        ...(entry.vendorName ? { vendorName: entry.vendorName } : {}),
      };
      current.grossAmount = roundMoney(current.grossAmount + entry.grossAmount);
      current.commissionAmount = roundMoney(current.commissionAmount + entry.commissionAmount);
      current.netAmount = roundMoney(current.netAmount + entry.netAmount);
      current.entriesCount += 1;
      if (!current.vendorName && entry.vendorName) {
        current.vendorName = entry.vendorName;
      }
      deltasByVendor.set(entry.vendorId, current);
    });

    deltasByVendor.forEach((delta, vendorId) => {
      const balanceRef = db.doc(`vendor_balances/${vendorId}`);
      tx.set(
        balanceRef,
        {
          vendorId,
          ...(delta.vendorName ? { vendorName: delta.vendorName } : {}),
          pendingGrossAmount: admin.firestore.FieldValue.increment(delta.grossAmount),
          pendingCommissionAmount: admin.firestore.FieldValue.increment(delta.commissionAmount),
          pendingNetAmount: admin.firestore.FieldValue.increment(delta.netAmount),
          lifetimeGrossAmount: admin.firestore.FieldValue.increment(delta.grossAmount),
          lifetimeCommissionAmount: admin.firestore.FieldValue.increment(delta.commissionAmount),
          lifetimeNetAmount: admin.firestore.FieldValue.increment(delta.netAmount),
          pendingEntriesCount: admin.firestore.FieldValue.increment(delta.entriesCount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    tx.set(
      archivedRef,
      {
        vendorPayoutEligible: true,
        vendorPayoutReason: admin.firestore.FieldValue.delete(),
        vendorPayoutStatus: baseStatus,
        vendorPayoutLedgerVersion: VENDOR_LEDGER_VERSION,
        vendorPayoutCommissionRate: PLATFORM_COMMISSION_RATE,
        vendorPayoutEntriesCount: computed.entries.length,
        vendorPayoutNewEntriesCount: createdEntriesInTx,
        vendorPayoutMissingVendorItemsCount: computed.missingVendorItems.length,
        vendorPayoutMissingVendorItems: computed.missingVendorItems.slice(0, 25),
        vendorPayoutTotals: computed.totals,
        vendorPayoutLedgerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    createdEntries = createdEntriesInTx;
  });

  return {
    status: baseStatus,
    entriesTotal: computed.entries.length,
    entriesCreated: createdEntries,
    missingVendorItems: computed.missingVendorItems.length,
  };
};

const buildPublicReviewPayload = (orderId: string, snapshot: OrderSnapshotMinimal) => ({
  ok: true,
  orderId,
  deliveredAt: snapshot.deliveredAt.toDate().toISOString(),
  items: snapshot.items.map((item) => ({
    title: item.title,
    qty: item.qty,
    price: item.price,
    ...(item.vendorName ? { vendorName: item.vendorName } : {}),
  })),
  total: snapshot.total,
  currency: snapshot.currency,
});

export const onArchivedOrderCreated = onDocumentCreated(
  {
    region: REGION,
    document: "archivedOrders/{orderId}",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const archivedOrder = snapshot.data() || {};
    const orderId = event.params.orderId;
    const jobId = `review_${orderId}`;
    const jobRef = db.doc(`reviewJobs/${jobId}`);

    const orderSnapshot = buildOrderSnapshot(archivedOrder);
    const deliveredAtDate = orderSnapshot.deliveredAt.toDate();
    const sendAt = new Date(deliveredAtDate.getTime() + REVIEW_DELAY_MS);
    const expiresAt = new Date(sendAt.getTime() + LINK_TTL_MS);

    const userId = pickUserId(archivedOrder) ?? "";
    const to = pickEmail(archivedOrder) ?? "";
    const canSchedule = Boolean(userId && to);

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(jobRef);
      if (existing.exists) return;

      const job: ReviewJobDoc = {
        orderId,
        userId,
        to,
        status: canSchedule ? "scheduled" : "failed",
        attempts: canSchedule ? 0 : MAX_ATTEMPTS,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveredAt: orderSnapshot.deliveredAt,
        sendAt: admin.firestore.Timestamp.fromDate(sendAt),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        ...(canSchedule ? {} : { lastError: "Missing userId or email in archived order" }),
      };

      tx.set(jobRef, job);
      tx.set(
        snapshot.ref,
        {
          reviewJobId: jobId,
          orderSnapshot,
        },
        { merge: true }
      );
    });

    const payoutResult = await applyVendorLedgerForArchivedOrder(
      snapshot.ref,
      orderId,
      archivedOrder,
      orderSnapshot
    );

    logger.info("review job + vendor payout ledger processed", {
      orderId,
      jobId,
      payoutStatus: payoutResult.status,
      payoutEntriesTotal: payoutResult.entriesTotal,
      payoutEntriesCreated: payoutResult.entriesCreated,
      payoutMissingVendorItems: payoutResult.missingVendorItems,
      ...(payoutResult.reason ? { payoutReason: payoutResult.reason } : {}),
    });
  }
);

export const processScheduledReviewJobs = onSchedule(
  {
    region: REGION,
    schedule: "every 10 minutes",
    timeZone: "Africa/Conakry",
    maxInstances: 1,
    secrets: [REVIEW_LINK_SECRET],
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const secret = REVIEW_LINK_SECRET.value();

    const dueJobs = await db
      .collection("reviewJobs")
      .where("status", "==", "scheduled")
      .where("sendAt", "<=", now)
      .orderBy("sendAt", "asc")
      .limit(200)
      .get();

    for (const docSnap of dueJobs.docs) {
      const job = docSnap.data() as ReviewJobDoc;
      const attempts = toNumber(job.attempts, 0);

      try {
        if (!job.to || !job.userId || !job.orderId) {
          throw new Error("Missing job recipient or identifiers");
        }

        const expiresAtMs = tsToMillis(job.expiresAt);
        if (!expiresAtMs) {
          throw new Error("Invalid job expiration timestamp");
        }

        if (Date.now() > expiresAtMs) {
          await docSnap.ref.update({
            status: "revoked",
            lastError: "Link expired before send",
          });
          continue;
        }

        const sig = signToken(docSnap.id, expiresAtMs, secret);
        const link = `${REVIEW_PAGE_URL}?token=${encodeURIComponent(docSnap.id)}&sig=${encodeURIComponent(sig)}`;

        const subject = "Monmarché - Donnez votre avis";
        const text = [
          "Merci pour votre commande.",
          "Votre avis nous aide a ameliorer Monmarche.",
          `Donner mon avis: ${link}`,
        ].join("\n\n");

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:16px;border:1px solid #eee;border-radius:8px">
            <h2 style="margin-top:0">Merci pour votre commande</h2>
            <p>Votre avis nous aide a ameliorer Monmarche.</p>
            <p>
              <a href="${link}" style="display:inline-block;background:#ff6f00;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">
                Donner mon avis
              </a>
            </p>
            <p style="font-size:12px;color:#555">Si le bouton ne fonctionne pas, utilisez ce lien :<br/>${link}</p>
          </div>
        `;

        await db.collection("mail").add({
          to: job.to,
          message: {
            subject,
            text,
            html,
          },
        });

        await docSnap.ref.update({
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastError: admin.firestore.FieldValue.delete(),
        });
      } catch (error: any) {
        const nextAttempts = attempts + 1;
        await docSnap.ref.update({
          attempts: nextAttempts,
          status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "scheduled",
          lastError: String(error?.message ?? error),
        });
      }
    }
  }
);

const verifyReviewLinkAndLoad = async (token: string, sig: string, secret: string) => {
  const jobRef = db.doc(`reviewJobs/${token}`);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new Error("invalid_token");
  }

  const job = jobSnap.data() as ReviewJobDoc;
  const expiresAtMs = tsToMillis(job.expiresAt);
  if (!expiresAtMs) {
    throw new Error("invalid_expiry");
  }

  const expectedSig = signToken(token, expiresAtMs, secret);
  if (!safeEqual(expectedSig, sig)) {
    throw new Error("bad_signature");
  }

  if (Date.now() > expiresAtMs) {
    throw new Error("expired");
  }

  if (job.status === "used" || job.status === "revoked") {
    throw new Error("not_allowed");
  }

  const archivedRef = db.doc(`archivedOrders/${job.orderId}`);
  const archivedSnap = await archivedRef.get();
  if (!archivedSnap.exists) {
    throw new Error("archived_order_not_found");
  }

  const archivedData = archivedSnap.data() || {};
  const orderSnapshot = buildOrderSnapshot(archivedData);

  return {
    jobRef,
    job,
    archivedRef,
    orderSnapshot,
  };
};

export const validateReviewLink = onRequest(
  {
    region: REGION,
    secrets: [REVIEW_LINK_SECRET],
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const token = nonEmptyString(req.query.token) ?? "";
    const sig = nonEmptyString(req.query.sig) ?? "";

    if (!token || !sig) {
      res.status(400).json({ ok: false, error: "missing_token_or_sig" });
      return;
    }

    try {
      const secret = REVIEW_LINK_SECRET.value();
      const validated = await verifyReviewLinkAndLoad(token, sig, secret);
      res.status(200).json(buildPublicReviewPayload(validated.job.orderId, validated.orderSnapshot));
    } catch (error: any) {
      res.status(400).json({ ok: false, error: String(error?.message ?? error) });
    }
  }
);

export const submitReview = onRequest(
  {
    region: REGION,
    secrets: [REVIEW_LINK_SECRET],
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const token = nonEmptyString(req.body?.token) ?? "";
    const sig = nonEmptyString(req.body?.sig) ?? "";
    const rating = Number(req.body?.rating);
    const rawComment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    const comment = rawComment ? rawComment.slice(0, 2000) : undefined;

    if (!token || !sig) {
      res.status(400).json({ ok: false, error: "missing_token_or_sig" });
      return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ ok: false, error: "invalid_rating" });
      return;
    }

    try {
      const secret = REVIEW_LINK_SECRET.value();
      const verified = await verifyReviewLinkAndLoad(token, sig, secret);
      const reviewRef = db.doc(`reviews/${token}`);

      await db.runTransaction(async (tx) => {
        const [jobSnap, reviewSnap] = await Promise.all([
          tx.get(verified.jobRef),
          tx.get(reviewRef),
        ]);

        if (!jobSnap.exists) {
          throw new Error("invalid_token");
        }

        const job = jobSnap.data() as ReviewJobDoc;
        const expiresAtMs = tsToMillis(job.expiresAt);
        const expectedSig = signToken(token, expiresAtMs, secret);

        if (!safeEqual(expectedSig, sig)) {
          throw new Error("bad_signature");
        }

        if (Date.now() > expiresAtMs) {
          throw new Error("expired");
        }

        if (job.status === "used" || job.status === "revoked") {
          throw new Error("not_allowed");
        }

        if (reviewSnap.exists) {
          return;
        }

        tx.set(reviewRef, {
          orderId: job.orderId,
          userId: job.userId,
          rating,
          ...(comment ? { comment } : {}),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: "email_link",
          tokenId: token,
        });

        tx.update(verified.jobRef, {
          status: "used",
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastError: admin.firestore.FieldValue.delete(),
        });

        tx.set(
          verified.archivedRef,
          { reviewSubmittedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      });

      res.status(200).json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ ok: false, error: String(error?.message ?? error) });
    }
  }
);

export const createStaffAccount = onCall(
  {
    region: REGION,
  },
  async (request) => {
    const callerUid = request.auth?.uid ?? null;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "auth_required");
    }

    const payload = (request.data ?? {}) as CreateStaffAccountPayload;
    const email = ensureNonEmptyString(payload.email, "email").toLowerCase();
    const password = ensureNonEmptyString(payload.password, "password");
    const role = parseStaffRole(payload.role);
    const profile =
      payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)
        ? { ...(payload.profile as Record<string, unknown>) }
        : {};

    const callerIsAdmin = await isAdminUid(callerUid);
    if (!callerIsAdmin) {
      throw new HttpsError("permission-denied", "admin_required");
    }
    if (role === "ADMIN" && !isSuperAdminUid(callerUid)) {
      throw new HttpsError("permission-denied", "super_admin_required");
    }

    const targetCollection = STAFF_ROLE_COLLECTION[role];
    const username =
      role === "ADMIN" ? ensureNonEmptyString(profile.username, "username") : null;

    if (username) {
      const usernameSnap = await db
        .collection("admin")
        .where("username", "==", username)
        .limit(1)
        .get();
      if (!usernameSnap.empty) {
        throw new HttpsError("already-exists", "username_already_exists");
      }
    }

    let authUser: admin.auth.UserRecord;
    let authUserCreated = false;
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") {
        logger.error("Failed to load auth user before staff creation", error);
        throw new HttpsError("internal", "failed_to_load_auth_user");
      }

      try {
        authUser = await admin.auth().createUser({
          email,
          password,
          displayName:
            nonEmptyString(profile.username, profile.firstName, profile.lastName, profile.name) ??
            undefined,
        });
        authUserCreated = true;
      } catch (createError: any) {
        logger.error("Failed to create auth user for staff account", createError);
        const code = String(createError?.code ?? "");
        if (code === "auth/email-already-exists") {
          throw new HttpsError("already-exists", "email_already_exists");
        }
        if (code === "auth/invalid-password") {
          throw new HttpsError("invalid-argument", "invalid_password");
        }
        throw new HttpsError("internal", "failed_to_create_auth_user");
      }
    }

    const roleDocRef = db.doc(`${targetCollection}/${authUser.uid}`);
    const roleDocSnap = await roleDocRef.get();
    if (roleDocSnap.exists) {
      throw new HttpsError("already-exists", `${targetCollection}_already_exists`);
    }

    await roleDocRef.set({
      ...profile,
      email,
      role,
      status: true,
      timeStamp: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: callerUid,
      updatedByUid: callerUid,
    });

    return {
      ok: true,
      uid: authUser.uid,
      role,
      collection: targetCollection,
      authUserCreated,
      linkedExistingAuthUser: !authUserCreated,
    };
  }
);

export const settleVendorPayout = onCall(
  {
    region: REGION,
  },
  async (request) => {
    const callerUid = request.auth?.uid ?? null;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "auth_required");
    }
    if (!(await isAdminUid(callerUid))) {
      throw new HttpsError("permission-denied", "admin_required");
    }

    const payload = (request.data ?? {}) as SettleVendorPayoutPayload;
    const vendorId = ensureNonEmptyString(payload.vendorId, "vendorId");
    const rawEntryIds = Array.isArray(payload.entryIds) ? payload.entryIds : [];
    const entryIds = Array.from(
      new Set(
        rawEntryIds
          .map((value) => nonEmptyString(value))
          .filter((value): value is string => Boolean(value))
      )
    );

    if (!entryIds.length) {
      throw new HttpsError("invalid-argument", "entryIds_required");
    }
    if (entryIds.length > 1000) {
      throw new HttpsError("invalid-argument", "too_many_entries");
    }

    const [vendorSnap, deletedVendorSnap] = await Promise.all([
      db.doc(`vendors/${vendorId}`).get(),
      db.doc(`deletedVendors/${vendorId}`).get(),
    ]);
    const vendorAccountState = resolveVendorPayoutAccountState(vendorSnap, deletedVendorSnap);
    const forceSensitiveVendor = payload.forceSensitiveVendor === true;
    const forceReason = nonEmptyString(payload.forceReason);

    if (vendorAccountState.requiresReview && (!forceSensitiveVendor || !forceReason)) {
      throw new HttpsError(
        "failed-precondition",
        `vendor_${vendorAccountState.key}_requires_manual_confirmation`
      );
    }

    const actorRecord = await admin.auth().getUser(callerUid).catch(() => null);
    const actorEmail = actorRecord?.email ?? request.auth?.token?.email ?? null;
    const actorLabel = actorEmail ?? callerUid;
    const batchId = `manual_${Date.now()}_${normalizeDocIdPart(callerUid, "admin")}`;
    const batchRef = db.doc(`vendor_payout_batches/${batchId}`);
    const balanceRef = db.doc(`vendor_balances/${vendorId}`);
    const chunkSize = 400;
    const paidEntryIds: string[] = [];
    const totals = {
      grossAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      entriesCount: 0,
    };
    let currency = "GNF";

    await batchRef.create({
      batchId,
      vendorId,
      status: "processing",
      requestedEntryIds: entryIds,
      requestedEntriesCount: entryIds.length,
      paidEntryIds: [],
      paidEntriesCount: 0,
      grossAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: callerUid,
      createdByEmail: actorEmail,
      createdByLabel: actorLabel,
      vendorAccountStatus: vendorAccountState.key,
      vendorAccountLabel: vendorAccountState.label,
      vendorAccountReason: vendorAccountState.reason ?? null,
      sensitiveVendorOverride: vendorAccountState.requiresReview,
      sensitiveVendorOverrideReason: forceReason,
    });

    try {
      for (let start = 0; start < entryIds.length; start += chunkSize) {
        const chunkIds = entryIds.slice(start, start + chunkSize);
        const chunkResult = await db.runTransaction(async (tx) => {
          const refs = chunkIds.map((entryId) => db.doc(`vendor_ledger/${entryId}`));
          const snaps = await tx.getAll(...refs);
          const freshEntries = snaps.map((snap, index) => {
            const entryId = chunkIds[index];
            if (!snap.exists) {
              throw new HttpsError("failed-precondition", `entry_missing:${entryId}`);
            }
            const data = snap.data() || {};
            const currentVendorId = nonEmptyString(data.vendorId);
            const currentStatus = nonEmptyString(data.status) ?? "pending";
            if (currentVendorId !== vendorId) {
              throw new HttpsError("failed-precondition", `entry_vendor_mismatch:${entryId}`);
            }
            if (currentStatus !== "pending") {
              throw new HttpsError("failed-precondition", `entry_not_pending:${entryId}`);
            }
            return {
              ref: refs[index],
              id: entryId,
              grossAmount: roundMoney(toNumber(data.grossAmount, 0)),
              commissionAmount: roundMoney(toNumber(data.commissionAmount, 0)),
              netAmount: roundMoney(toNumber(data.netAmount, 0)),
              currency: nonEmptyString(data.currency) ?? "GNF",
              orderId: nonEmptyString(data.orderId),
              productId: nonEmptyString(data.productId),
              title: nonEmptyString(data.title),
            };
          });

          const chunkTotals = freshEntries.reduce(
            (acc, entry) => {
              acc.grossAmount = roundMoney(acc.grossAmount + entry.grossAmount);
              acc.commissionAmount = roundMoney(acc.commissionAmount + entry.commissionAmount);
              acc.netAmount = roundMoney(acc.netAmount + entry.netAmount);
              acc.entriesCount += 1;
              return acc;
            },
            { grossAmount: 0, commissionAmount: 0, netAmount: 0, entriesCount: 0 }
          );
          const chunkCurrency = freshEntries[0]?.currency ?? "GNF";

          freshEntries.forEach((entry) => {
            tx.update(entry.ref, {
              status: "paid" as VendorLedgerStatus,
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
              paidBatchId: batchId,
              paidByUid: callerUid,
              paidByEmail: actorEmail,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          tx.set(
            balanceRef,
            {
              vendorId,
              pendingGrossAmount: admin.firestore.FieldValue.increment(-chunkTotals.grossAmount),
              pendingCommissionAmount: admin.firestore.FieldValue.increment(
                -chunkTotals.commissionAmount
              ),
              pendingNetAmount: admin.firestore.FieldValue.increment(-chunkTotals.netAmount),
              pendingEntriesCount: admin.firestore.FieldValue.increment(-chunkTotals.entriesCount),
              paidGrossAmount: admin.firestore.FieldValue.increment(chunkTotals.grossAmount),
              paidCommissionAmount: admin.firestore.FieldValue.increment(
                chunkTotals.commissionAmount
              ),
              paidNetAmount: admin.firestore.FieldValue.increment(chunkTotals.netAmount),
              paidEntriesCount: admin.firestore.FieldValue.increment(chunkTotals.entriesCount),
              lastPaidBatchId: batchId,
              lastPaidAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          tx.set(
            batchRef,
            {
              paidEntryIds: admin.firestore.FieldValue.arrayUnion(...freshEntries.map((e) => e.id)),
              paidEntriesCount: admin.firestore.FieldValue.increment(chunkTotals.entriesCount),
              grossAmount: admin.firestore.FieldValue.increment(chunkTotals.grossAmount),
              commissionAmount: admin.firestore.FieldValue.increment(chunkTotals.commissionAmount),
              netAmount: admin.firestore.FieldValue.increment(chunkTotals.netAmount),
              currency: chunkCurrency,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return {
            ...chunkTotals,
            currency: chunkCurrency,
            entryIds: freshEntries.map((entry) => entry.id),
          };
        });

        totals.grossAmount = roundMoney(totals.grossAmount + chunkResult.grossAmount);
        totals.commissionAmount = roundMoney(
          totals.commissionAmount + chunkResult.commissionAmount
        );
        totals.netAmount = roundMoney(totals.netAmount + chunkResult.netAmount);
        totals.entriesCount += chunkResult.entriesCount;
        currency = chunkResult.currency;
        paidEntryIds.push(...chunkResult.entryIds);
      }

      await batchRef.set(
        {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          paidEntryIds,
          paidEntriesCount: totals.entriesCount,
          grossAmount: totals.grossAmount,
          commissionAmount: totals.commissionAmount,
          netAmount: totals.netAmount,
          currency,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("vendor payout settled", {
        batchId,
        vendorId,
        entriesCount: totals.entriesCount,
        netAmount: totals.netAmount,
        actorUid: callerUid,
        vendorAccountStatus: vendorAccountState.key,
      });

      return {
        ok: true,
        batchId,
        vendorId,
        entriesCount: totals.entriesCount,
        grossAmount: totals.grossAmount,
        commissionAmount: totals.commissionAmount,
        netAmount: totals.netAmount,
        currency,
        vendorAccountStatus: vendorAccountState.key,
      };
    } catch (error) {
      await batchRef.set(
        {
          status: "failed",
          failureReason:
            error instanceof HttpsError
              ? error.message
              : error instanceof Error
                ? error.message
                : "unknown_error",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw error;
    }
  }
);

export const onOrderCreatedNotifyAdmins = onDocumentCreated(
  { region: REGION, document: "orders/{orderId}" },
  async (event) => {
    const orderId = event.params.orderId as string;
    const data = event.data?.data() || {};
    const total = toNumber(data.total ?? data.totalAmount, 0);
    const currency = nonEmptyString(data.currency) ?? "GNF";
    const orderLabel = nonEmptyString(data.orderId, orderId) ?? orderId;

    await createNotificationAndFanout({
      id: `order_created_${normalizeDocIdPart(orderId)}`,
      type: "order",
      title: "Nouvelle commande",
      message: `Commande ${orderLabel} (${total.toLocaleString("fr-FR")} ${currency})`,
      link: `/orders/${orderId}`,
      severity: "info",
      source: "app",
      entity: { kind: "order", id: orderId },
    });
  }
);

export const onVendorCreatedNotifyAdmins = onDocumentCreated(
  { region: REGION, document: "vendors/{vendorId}" },
  async (event) => {
    const vendorId = event.params.vendorId as string;
    const data = event.data?.data() || {};
    const vendorName =
      nonEmptyString(
        data.displayName,
        data.company?.name,
        data.name,
        data.companyName,
        data.profile?.company?.name,
        data.profile?.name,
        vendorId
      ) ?? vendorId;

    await createNotificationAndFanout({
      id: `vendor_created_${normalizeDocIdPart(vendorId)}`,
      type: "vendor",
      title: "Nouvelle boutique vendeur",
      message: vendorName,
      link: `/vendors/${vendorId}`,
      severity: "info",
      source: "vendor",
      entity: { kind: "vendor", id: vendorId },
    });
  }
);

export const onVendorProductCreatedNotifyAdmins = onDocumentCreated(
  { region: REGION, document: "vendor_products/{productId}" },
  async (event) => {
    const productId = event.params.productId as string;
    const data = event.data?.data() || {};
    const mmStatus =
      data?.mm_status ??
      data?.mmStatus ??
      data?.core?.mm_status ??
      data?.draft?.core?.mm_status ??
      undefined;
    const pending =
      hasDraftPending(data) || mmStatus === false || mmStatus === undefined;
    if (!pending) return;

    const productTitle =
      nonEmptyString(
        data.title,
        data.name,
        data.core?.title,
        data.core?.name,
        data.draft?.core?.title,
        data.draft?.core?.name,
        productId
      ) ?? productId;
    const vendorName =
      nonEmptyString(
        data.vendorName,
        data.vendor?.name,
        data.vendor?.displayName,
        data.core?.vendorName,
        data.core?.vendor?.name,
        data.core?.vendor?.displayName,
        data.draft?.core?.vendorName,
        data.draft?.core?.vendor?.name,
        data.draft?.core?.vendor?.displayName
      ) ?? "Vendeur";

    await createNotificationAndFanout({
      id: `product_pending_${normalizeDocIdPart(productId)}`,
      type: "product",
      title: "Nouveau produit à valider",
      message: `${productTitle} - ${vendorName}`,
      link: `/vendor-products/${productId}`,
      severity: "warning",
      source: "vendor",
      entity: { kind: "product", id: productId },
    });
  }
);
