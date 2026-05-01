"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onVendorProductCreatedNotifyAdmins = exports.onVendorCreatedNotifyAdmins = exports.onOrderCreatedNotifyAdmins = exports.settleVendorPayout = exports.createStaffAccount = exports.submitReview = exports.validateReviewLink = exports.processScheduledReviewJobs = exports.onArchivedOrderCreated = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
admin.initializeApp();
const db = admin.firestore();
const REGION = "europe-west1";
const REVIEW_PAGE_URL = "https://monmarchegn.com/avis";
const REVIEW_LINK_SECRET = (0, params_1.defineSecret)("REVIEW_LINK_SECRET");
const VENDOR_PAYOUT_NOTIFY_EMAIL = "infos@monmarchegn.com";
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DELAY_MS = DAY_MS;
const LINK_TTL_MS = 14 * DAY_MS;
const MAX_ATTEMPTS = 3;
const PLATFORM_COMMISSION_RATE = 0.05;
const VENDOR_LEDGER_VERSION = 1;
const PRODUCT_SALES_LEDGER_VERSION = 1;
const asDate = (value) => {
    if (!value)
        return null;
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return value;
    if (typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "object") {
        const maybeTimestamp = value;
        if (typeof maybeTimestamp.toDate === "function") {
            return maybeTimestamp.toDate();
        }
        if (typeof maybeTimestamp.seconds === "number") {
            return new Date(maybeTimestamp.seconds * 1000 + Math.floor((maybeTimestamp.nanoseconds ?? 0) / 1e6));
        }
    }
    return null;
};
const asTimestamp = (value, fallback) => {
    const date = asDate(value) ?? fallback ?? new Date();
    return admin.firestore.Timestamp.fromDate(date);
};
const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const roundMoney = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
const nonEmptyString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return null;
};
const normalizeDocIdPart = (value, fallback = "unknown") => {
    const source = nonEmptyString(value);
    if (!source)
        return fallback;
    const normalized = source.replace(/[^a-zA-Z0-9_-]/g, "_");
    return normalized.length ? normalized.slice(0, 80) : fallback;
};
const isTrue = (value) => value === true;
const normalizeStatusText = (value) => {
    const raw = nonEmptyString(value);
    if (!raw)
        return null;
    return raw.replace(/\s+/g, "_").toLowerCase();
};
const isBlockedStatus = (value) => {
    const normalized = normalizeStatusText(value);
    return Boolean(normalized &&
        ["blocked", "disabled", "inactive", "suspended", "bloque", "bloqué"].includes(normalized));
};
const resolveVendorPayoutAccountState = (vendorSnap, deletedVendorSnap) => {
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
    const explicitBlocked = data.blocked === true ||
        data.profile?.blocked === true ||
        data.company?.blocked === true ||
        data.vendor?.blocked === true;
    const blocked = explicitBlocked ||
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
            reason: nonEmptyString(data.blockedReason, data.profile?.blockedReason, data.company?.blockedReason, data.vendor?.blockedReason),
        };
    }
    const explicitActive = data.active ??
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
    const status = normalizeStatusText(data.status) ||
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
const STAFF_ROLE_COLLECTION = {
    ADMIN: "admin",
    DRIVER: "drivers",
};
const isSuperAdminUid = (uid) => Boolean(uid && uid === SUPER_ADMIN_UID);
const isAdminUid = async (uid) => {
    if (!uid)
        return false;
    if (isSuperAdminUid(uid))
        return true;
    const snap = await db.doc(`admin/${uid}`).get();
    return snap.exists;
};
const ensureNonEmptyString = (value, field) => {
    const normalized = nonEmptyString(value);
    if (!normalized) {
        throw new https_1.HttpsError("invalid-argument", `${field}_required`);
    }
    return normalized;
};
const parseStaffRole = (value) => {
    const normalized = nonEmptyString(value)?.toUpperCase();
    if (normalized === "ADMIN" || normalized === "DRIVER") {
        return normalized;
    }
    throw new https_1.HttpsError("invalid-argument", "invalid_role");
};
const isOrderEligibleForVendorPayout = (order) => {
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
const tsToMillis = (value) => {
    const date = asDate(value);
    return date ? date.getTime() : 0;
};
const pickUserId = (order) => nonEmptyString(order.userId, order.uid, order.customerId, order.user?.uid, order.client?.uid);
const pickEmail = (order) => nonEmptyString(order.mail_invoice, order.email, order.userEmail, order.customerEmail, order.user?.email, order.client?.email, order.deliverInfos?.email);
const pickVendorEmail = (vendor) => nonEmptyString(vendor?.company?.email, vendor?.email, vendor?.profile?.email, vendor?.profile?.company?.email, vendor?.company?.contact?.email, vendor?.contact?.email);
const pickVendorDisplayName = (vendor) => nonEmptyString(vendor?.vendorName, vendor?.displayName, vendor?.profile?.displayName, vendor?.profile?.company?.name, vendor?.company?.name, vendor?.companyName, vendor?.name) ?? "Boutique";
const pickOrderDisplayId = (order) => nonEmptyString(order?.orderId, order?.orderNumber, order?.invoiceNumber, order?.invoiceId, order?.noFacture, order?.number, order?.orderSnapshot?.orderId, order?.orderSnapshot?.orderNumber);
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const formatCurrencyForEmail = (value, currency = "GNF") => new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
}).format(toNumber(value, 0));
const formatDateTimeForEmail = (value) => new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Conakry",
}).format(value);
const sendVendorPayoutSummaryEmail = async (params) => {
    const vendorSource = params.vendorData ?? params.deletedVendorData ?? null;
    const vendorEmail = pickVendorEmail(vendorSource);
    const vendorName = pickVendorDisplayName(vendorSource);
    const paidAt = new Date();
    const uniqueOrderIds = Array.from(new Set(params.settledEntries
        .map((entry) => nonEmptyString(entry.orderId))
        .filter((value) => Boolean(value))));
    const orderDisplayIdMap = new Map();
    await Promise.all(uniqueOrderIds.map(async (orderId) => {
        const refs = [db.doc(`archivedOrders/${orderId}`), db.doc(`orders/${orderId}`)];
        for (const ref of refs) {
            const snap = await ref.get().catch(() => null);
            if (!snap?.exists)
                continue;
            const label = pickOrderDisplayId(snap.data() || {});
            if (label) {
                orderDisplayIdMap.set(orderId, label);
                break;
            }
        }
    }));
    const groupedOrders = new Map();
    params.settledEntries.forEach((entry) => {
        const orderId = nonEmptyString(entry.orderId) ?? "unknown_order";
        const orderDisplayId = orderDisplayIdMap.get(orderId) ?? orderId;
        const current = groupedOrders.get(orderId) ?? {
            orderDisplayId,
            grossAmount: 0,
            commissionAmount: 0,
            netAmount: 0,
            items: [],
        };
        current.grossAmount = roundMoney(current.grossAmount + entry.grossAmount);
        current.commissionAmount = roundMoney(current.commissionAmount + entry.commissionAmount);
        current.netAmount = roundMoney(current.netAmount + entry.netAmount);
        current.items.push(entry);
        groupedOrders.set(orderId, current);
    });
    const orderSectionsHtml = Array.from(groupedOrders.values())
        .sort((left, right) => left.orderDisplayId.localeCompare(right.orderDisplayId, "fr"))
        .map((group) => {
        const itemsHtml = group.items
            .map((item) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(item.title ?? "Produit")}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${item.qty}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${escapeHtml(formatCurrencyForEmail(item.grossAmount, item.currency))}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${escapeHtml(formatCurrencyForEmail(item.netAmount, item.currency))}</td>
            </tr>
          `)
            .join("");
        return `
        <div style="margin-top:24px">
          <h3 style="margin:0 0 8px;font-size:16px;color:#111827">Commande ${escapeHtml(group.orderDisplayId)}</h3>
          <p style="margin:0 0 12px;color:#4b5563;font-size:14px">
            Brut ${escapeHtml(formatCurrencyForEmail(group.grossAmount, params.currency))} |
            Commission ${escapeHtml(formatCurrencyForEmail(group.commissionAmount, params.currency))} |
            Net ${escapeHtml(formatCurrencyForEmail(group.netAmount, params.currency))}
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Produit</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:center">Qté</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Montant brut</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Net vendeur</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
      `;
    })
        .join("");
    const subject = "Paiement effectue pour vos ventes Monmarche";
    const adminSubject = `Paiement vendeur effectue - ${vendorName}`;
    const textLines = [
        `Bonjour ${vendorName},`,
        "",
        `Votre paiement vendeur a ete effectue le ${formatDateTimeForEmail(paidAt)}.`,
        `Batch: ${params.batchId}`,
        `Commandes reglees: ${groupedOrders.size}`,
        `Produits/lignes regles: ${params.totals.entriesCount}`,
        `Montant brut: ${formatCurrencyForEmail(params.totals.grossAmount, params.currency)}`,
        `Commission: ${formatCurrencyForEmail(params.totals.commissionAmount, params.currency)}`,
        `Net verse: ${formatCurrencyForEmail(params.totals.netAmount, params.currency)}`,
        "",
        "Detail des commandes et produits vendus:",
        ...Array.from(groupedOrders.values())
            .sort((left, right) => left.orderDisplayId.localeCompare(right.orderDisplayId, "fr"))
            .flatMap((group) => [
            `- Commande ${group.orderDisplayId}: brut ${formatCurrencyForEmail(group.grossAmount, params.currency)}, commission ${formatCurrencyForEmail(group.commissionAmount, params.currency)}, net ${formatCurrencyForEmail(group.netAmount, params.currency)}`,
            ...group.items.map((item) => `  - ${item.title ?? "Produit"} x${item.qty} | brut ${formatCurrencyForEmail(item.grossAmount, item.currency)} | net ${formatCurrencyForEmail(item.netAmount, item.currency)}`),
        ]),
    ];
    const html = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:24px;background:#f9fafb;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#111827">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="padding:18px 24px;background:#111827;color:#ffffff">
            <h1 style="margin:0;font-size:22px">Paiement vendeur effectue</h1>
          </div>
          <div style="padding:24px">
            <p style="margin-top:0">Bonjour <strong>${escapeHtml(vendorName)}</strong>,</p>
            <p>Votre paiement vendeur a ete effectue le <strong>${escapeHtml(formatDateTimeForEmail(paidAt))}</strong>.</p>
            <div style="padding:16px;background:#f3f4f6;border-radius:10px">
              <p style="margin:0 0 8px"><strong>Batch :</strong> ${escapeHtml(params.batchId)}</p>
              <p style="margin:0 0 8px"><strong>Commandes reglees :</strong> ${groupedOrders.size}</p>
              <p style="margin:0 0 8px"><strong>Lignes reglees :</strong> ${params.totals.entriesCount}</p>
              <p style="margin:0 0 8px"><strong>Montant brut :</strong> ${escapeHtml(formatCurrencyForEmail(params.totals.grossAmount, params.currency))}</p>
              <p style="margin:0 0 8px"><strong>Commission :</strong> ${escapeHtml(formatCurrencyForEmail(params.totals.commissionAmount, params.currency))}</p>
              <p style="margin:0"><strong>Net verse :</strong> ${escapeHtml(formatCurrencyForEmail(params.totals.netAmount, params.currency))}</p>
            </div>
            ${orderSectionsHtml}
            <p style="margin:24px 0 0;color:#4b5563">Merci,<br />Equipe Monmarche</p>
          </div>
        </div>
      </body>
    </html>
  `;
    const adminTextLines = [
        "Notification admin de paiement vendeur.",
        "",
        `Vendeur: ${vendorName}`,
        `Vendor ID: ${params.vendorId}`,
        `Email vendeur: ${vendorEmail ?? "-"}`,
        `Paiement effectue le: ${formatDateTimeForEmail(paidAt)}`,
        `Batch: ${params.batchId}`,
        `Commandes reglees: ${groupedOrders.size}`,
        `Produits/lignes regles: ${params.totals.entriesCount}`,
        `Montant brut: ${formatCurrencyForEmail(params.totals.grossAmount, params.currency)}`,
        `Commission: ${formatCurrencyForEmail(params.totals.commissionAmount, params.currency)}`,
        `Net verse: ${formatCurrencyForEmail(params.totals.netAmount, params.currency)}`,
        "",
        "Detail des commandes et produits vendus:",
        ...Array.from(groupedOrders.values())
            .sort((left, right) => left.orderDisplayId.localeCompare(right.orderDisplayId, "fr"))
            .flatMap((group) => [
            `- Commande ${group.orderDisplayId}: brut ${formatCurrencyForEmail(group.grossAmount, params.currency)}, commission ${formatCurrencyForEmail(group.commissionAmount, params.currency)}, net ${formatCurrencyForEmail(group.netAmount, params.currency)}`,
            ...group.items.map((item) => `  - ${item.title ?? "Produit"} x${item.qty} | brut ${formatCurrencyForEmail(item.grossAmount, item.currency)} | net ${formatCurrencyForEmail(item.netAmount, item.currency)}`),
        ]),
    ];
    const adminHtml = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(adminSubject)}</title>
      </head>
      <body style="margin:0;padding:24px;background:#f9fafb;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#111827">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="padding:18px 24px;background:#111827;color:#ffffff">
            <h1 style="margin:0;font-size:22px">Notification admin paiement vendeur</h1>
          </div>
          <div style="padding:24px">
            <p style="margin-top:0"><strong>Vendeur :</strong> ${escapeHtml(vendorName)}</p>
            <p><strong>Vendor ID :</strong> ${escapeHtml(params.vendorId)}</p>
            <p><strong>Email vendeur :</strong> ${escapeHtml(vendorEmail ?? "-")}</p>
            <p><strong>Paiement effectue le :</strong> ${escapeHtml(formatDateTimeForEmail(paidAt))}</p>
            <div style="padding:16px;background:#f3f4f6;border-radius:10px">
              <p style="margin:0 0 8px"><strong>Batch :</strong> ${escapeHtml(params.batchId)}</p>
              <p style="margin:0 0 8px"><strong>Commandes reglees :</strong> ${groupedOrders.size}</p>
              <p style="margin:0 0 8px"><strong>Lignes reglees :</strong> ${params.totals.entriesCount}</p>
              <p style="margin:0 0 8px"><strong>Montant brut :</strong> ${escapeHtml(formatCurrencyForEmail(params.totals.grossAmount, params.currency))}</p>
              <p style="margin:0 0 8px"><strong>Commission :</strong> ${escapeHtml(formatCurrencyForEmail(params.totals.commissionAmount, params.currency))}</p>
              <p style="margin:0"><strong>Net verse :</strong> ${escapeHtml(formatCurrencyForEmail(params.totals.netAmount, params.currency))}</p>
            </div>
            ${orderSectionsHtml}
          </div>
        </div>
      </body>
    </html>
  `;
    const mailWrites = [
        db.collection("mail").add({
            to: VENDOR_PAYOUT_NOTIFY_EMAIL,
            message: {
                subject: adminSubject,
                text: adminTextLines.join("\n"),
                html: adminHtml,
            },
            meta: {
                type: "vendor_payout_settled_admin",
                vendorId: params.vendorId,
                batchId: params.batchId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        }),
    ];
    if (vendorEmail) {
        mailWrites.push(db.collection("mail").add({
            to: vendorEmail,
            message: {
                subject,
                text: textLines.join("\n"),
                html,
            },
            meta: {
                type: "vendor_payout_settled",
                vendorId: params.vendorId,
                batchId: params.batchId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        }));
    }
    await Promise.all(mailWrites);
    return vendorEmail ? "sent" : "sent_admin_only";
};
const signToken = (token, expiresAtMs, secret) => crypto.createHmac("sha256", secret).update(`${token}${expiresAtMs}`).digest("hex");
const safeEqual = (left, right) => {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    if (a.length !== b.length)
        return false;
    return crypto.timingSafeEqual(a, b);
};
const normalizeOrderItems = (order) => {
    const source = Array.isArray(order.cart)
        ? order.cart
        : Array.isArray(order.items)
            ? order.items
            : Array.isArray(order.orderSnapshot?.items)
                ? order.orderSnapshot.items
                : [];
    return source
        .map((item) => {
        const title = nonEmptyString(item.title, item.name, item.productName, item.product?.title);
        if (!title)
            return null;
        const qtyBulk = Math.max(0, Math.floor(toNumber(item.quantityBulk, 0)));
        const qtyDetail = Math.max(0, Math.floor(toNumber(item.quantityDetail, 0)));
        const qtyRaw = Math.max(0, Math.floor(toNumber(item.qty ?? item.quantity ?? item.count, 0)));
        const qty = qtyRaw > 0 ? qtyRaw : qtyBulk + qtyDetail;
        const lineTotal = toNumber(item.totalAmount ?? item.total ?? item.amount ?? item.amountDetail ?? item.amountBulk, 0);
        const fallbackPrice = toNumber(item.price ?? item.priceDetail ?? item.priceBulk, 0);
        const unitPrice = qty > 0 ? lineTotal / qty : fallbackPrice;
        const productId = nonEmptyString(item.productId, item.product?.id, item.id) ?? undefined;
        const vendorId = nonEmptyString(item.vendorId, item.vendor?.vendorId, item.vendor?.id, item.vendor?.uid, item.sellerId, item.storeId) ?? undefined;
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
        .filter(Boolean);
};
const createNotificationAndFanout = async (payload) => {
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
    }
    catch (err) {
        if (err?.code === 6 || err?.code === "already-exists") {
            return;
        }
        throw err;
    }
    const adminSnapshot = await db.collection("admin").get();
    if (adminSnapshot.empty)
        return;
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
const hasDraftPending = (raw) => {
    const draftStatus = raw?.draft_status ??
        raw?.draftStatus ??
        raw?.core?.draft_status ??
        raw?.core?.draftStatus ??
        raw?.draft?.core?.draft_status ??
        raw?.draft?.core?.draftStatus ??
        false;
    const draftChanges = raw?.draftChanges ??
        raw?.core?.draftChanges ??
        raw?.draft?.core?.draftChanges ??
        [];
    return Boolean(draftStatus) && Array.isArray(draftChanges) && draftChanges.length > 0;
};
const buildOrderSnapshot = (order) => {
    const deliveredAt = asTimestamp(order.orderSnapshot?.deliveredAt ?? order.deliveredAt ?? order.timeStamp ?? order.createdAt);
    const items = normalizeOrderItems(order);
    const itemsTotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const total = toNumber(order.orderSnapshot?.total ?? order.total ?? order.totalAmount ?? order.pricing?.total, itemsTotal);
    const currency = nonEmptyString(order.orderSnapshot?.currency, order.currency, order.pricing?.currency, "GNF") ??
        "GNF";
    return {
        items,
        total,
        currency,
        deliveredAt,
    };
};
const buildLedgerEntryId = (orderId, lineIndex, vendorId, productId) => {
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
const buildProductSalesEntryId = (orderId, lineIndex, productId) => {
    const orderPart = normalizeDocIdPart(orderId, "order");
    const productPart = normalizeDocIdPart(productId, "product");
    const hash = crypto
        .createHash("sha1")
        .update(`${orderId}|${lineIndex}|${productId}`)
        .digest("hex")
        .slice(0, 16);
    return `psled_${orderPart}_${lineIndex}_${productPart}_${hash}`;
};
const computeVendorLedger = (orderId, archivedOrder, snapshot) => {
    const eligibility = isOrderEligibleForVendorPayout(archivedOrder);
    if (!eligibility.eligible) {
        return eligibility;
    }
    const entries = [];
    const missingVendorItems = [];
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
const computeProductSales = (orderId, archivedOrder, snapshot) => {
    const eligibility = isOrderEligibleForVendorPayout(archivedOrder);
    if (!eligibility.eligible) {
        return {
            eligible: false,
            reason: eligibility.reason,
            entries: [],
            missingProductItems: [],
            totals: { grossAmount: 0, unitsSold: 0 },
        };
    }
    const entries = [];
    const missingProductItems = [];
    const totals = {
        grossAmount: 0,
        unitsSold: 0,
    };
    snapshot.items.forEach((item, index) => {
        const qty = Math.max(1, Math.floor(toNumber(item.qty, 1)));
        const unitPrice = roundMoney(toNumber(item.price, 0));
        const grossAmount = roundMoney(qty * unitPrice);
        if (grossAmount <= 0) {
            return;
        }
        const productId = nonEmptyString(item.productId) ?? undefined;
        const vendorId = nonEmptyString(item.vendorId) ?? undefined;
        const vendorName = nonEmptyString(item.vendorName) ?? undefined;
        totals.grossAmount = roundMoney(totals.grossAmount + grossAmount);
        totals.unitsSold += qty;
        if (!productId) {
            missingProductItems.push({
                lineIndex: index,
                title: item.title,
                ...(vendorId ? { vendorId } : {}),
                ...(vendorName ? { vendorName } : {}),
            });
            return;
        }
        entries.push({
            entryId: buildProductSalesEntryId(orderId, index, productId),
            orderId,
            lineIndex: index,
            productId,
            title: item.title,
            qty,
            unitPrice,
            grossAmount,
            ...(vendorId ? { vendorId } : {}),
            ...(vendorName ? { vendorName } : {}),
            currency: snapshot.currency,
            deliveredAt: snapshot.deliveredAt,
        });
    });
    return {
        eligible: true,
        entries,
        missingProductItems,
        totals,
    };
};
const applyVendorLedgerForArchivedOrder = async (archivedRef, orderId, archivedOrder, snapshot) => {
    const computed = computeVendorLedger(orderId, archivedOrder, snapshot);
    const baseStatus = !computed.eligible
        ? "blocked"
        : computed.entries.length === 0
            ? "no_items"
            : computed.missingVendorItems.length > 0
                ? "pending_with_issues"
                : "pending";
    if (!computed.eligible) {
        await archivedRef.set({
            vendorPayoutEligible: false,
            vendorPayoutReason: computed.reason ?? "not_eligible",
            vendorPayoutStatus: baseStatus,
            vendorPayoutLedgerVersion: VENDOR_LEDGER_VERSION,
            vendorPayoutCommissionRate: PLATFORM_COMMISSION_RATE,
            vendorPayoutEntriesCount: 0,
            vendorPayoutMissingVendorItemsCount: 0,
            vendorPayoutTotals: computed.totals,
            vendorPayoutLedgerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
        const deltasByVendor = new Map();
        computed.entries.forEach((entry, index) => {
            const existing = existingSnaps[index];
            if (existing?.exists) {
                return;
            }
            createdEntriesInTx += 1;
            tx.set(ledgerRefs[index], {
                ...entry,
                status: "pending",
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
            tx.set(balanceRef, {
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
            }, { merge: true });
        });
        tx.set(archivedRef, {
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
        }, { merge: true });
        createdEntries = createdEntriesInTx;
    });
    return {
        status: baseStatus,
        entriesTotal: computed.entries.length,
        entriesCreated: createdEntries,
        missingVendorItems: computed.missingVendorItems.length,
    };
};
const buildProductStatsRefs = (productId, vendorId) => {
    const refs = [db.doc(`products_public/${productId}`), db.doc(`products/${productId}`)];
    refs.push(db.doc(`vendor_products/${productId}`));
    if (vendorId) {
        refs.push(db.doc(`vendor_products/${vendorId}/products/${productId}`));
    }
    const uniqueByPath = new Map();
    refs.forEach((ref) => uniqueByPath.set(ref.path, ref));
    return Array.from(uniqueByPath.values());
};
const applyProductSalesForArchivedOrder = async (archivedRef, orderId, archivedOrder, snapshot) => {
    const computed = computeProductSales(orderId, archivedOrder, snapshot);
    const baseStatus = !computed.eligible
        ? "blocked"
        : computed.entries.length === 0
            ? "no_items"
            : computed.missingProductItems.length > 0
                ? "pending_with_issues"
                : "pending";
    if (!computed.eligible) {
        await archivedRef.set({
            productSalesEligible: false,
            productSalesReason: computed.reason ?? "not_eligible",
            productSalesStatus: baseStatus,
            productSalesLedgerVersion: PRODUCT_SALES_LEDGER_VERSION,
            productSalesEntriesCount: 0,
            productSalesMissingProductItemsCount: 0,
            productSalesTotals: computed.totals,
            productSalesLedgerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            status: baseStatus,
            reason: computed.reason,
            entriesTotal: 0,
            entriesCreated: 0,
            missingProductItems: 0,
            productDocsUpdated: 0,
        };
    }
    let createdEntries = 0;
    let productDocsUpdated = 0;
    await db.runTransaction(async (tx) => {
        let createdEntriesInTx = 0;
        let updatedProductDocsInTx = 0;
        const ledgerRefs = computed.entries.map((entry) => db.doc(`product_sales_ledger/${entry.entryId}`));
        const existingSnaps = ledgerRefs.length ? await tx.getAll(...ledgerRefs) : [];
        const ledgerWrites = [];
        const deltasByProduct = new Map();
        const existingProductIds = new Set();
        computed.entries.forEach((entry, index) => {
            const existing = existingSnaps[index];
            if (existing?.exists) {
                existingProductIds.add(entry.productId);
                return;
            }
            createdEntriesInTx += 1;
            ledgerWrites.push({
                ref: ledgerRefs[index],
                entry,
            });
            const current = deltasByProduct.get(entry.productId) ?? {
                grossAmount: 0,
                unitsSold: 0,
                entriesCount: 0,
                ordersCount: 0,
                ...(entry.title ? { title: entry.title } : {}),
                ...(entry.vendorId ? { vendorId: entry.vendorId } : {}),
                ...(entry.vendorName ? { vendorName: entry.vendorName } : {}),
                deliveredAt: entry.deliveredAt,
            };
            current.grossAmount = roundMoney(current.grossAmount + entry.grossAmount);
            current.unitsSold += entry.qty;
            current.entriesCount += 1;
            current.deliveredAt =
                tsToMillis(entry.deliveredAt) > tsToMillis(current.deliveredAt)
                    ? entry.deliveredAt
                    : current.deliveredAt;
            if (!current.title && entry.title) {
                current.title = entry.title;
            }
            if (!current.vendorId && entry.vendorId) {
                current.vendorId = entry.vendorId;
            }
            if (!current.vendorName && entry.vendorName) {
                current.vendorName = entry.vendorName;
            }
            deltasByProduct.set(entry.productId, current);
        });
        deltasByProduct.forEach((delta, productId) => {
            if (!existingProductIds.has(productId)) {
                delta.ordersCount = 1;
            }
        });
        const statsRefByPath = new Map();
        deltasByProduct.forEach((delta, productId) => {
            buildProductStatsRefs(productId, delta.vendorId).forEach((ref) => {
                statsRefByPath.set(ref.path, ref);
            });
        });
        const statsRefs = Array.from(statsRefByPath.values());
        const statsSnaps = statsRefs.length ? await tx.getAll(...statsRefs) : [];
        const statsSnapByPath = new Map();
        statsRefs.forEach((ref, index) => {
            statsSnapByPath.set(ref.path, statsSnaps[index]);
        });
        ledgerWrites.forEach(({ ref, entry }) => {
            tx.set(ref, {
                ...entry,
                ledgerVersion: PRODUCT_SALES_LEDGER_VERSION,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        deltasByProduct.forEach((delta, productId) => {
            buildProductStatsRefs(productId, delta.vendorId).forEach((ref) => {
                const statsSnap = statsSnapByPath.get(ref.path);
                if (!statsSnap?.exists) {
                    return;
                }
                updatedProductDocsInTx += 1;
                const statsData = statsSnap.data() || {};
                const existingSales = statsData.stats?.sales || {};
                const existingFirstSoldAt = asDate(existingSales.firstSoldAt);
                const existingLastSoldAt = asDate(existingSales.lastSoldAt);
                const deliveredAtDate = delta.deliveredAt.toDate();
                const firstSoldAt = !existingFirstSoldAt || deliveredAtDate.getTime() < existingFirstSoldAt.getTime()
                    ? delta.deliveredAt
                    : existingSales.firstSoldAt;
                const lastSoldAt = !existingLastSoldAt || deliveredAtDate.getTime() > existingLastSoldAt.getTime()
                    ? delta.deliveredAt
                    : existingSales.lastSoldAt;
                tx.set(ref, {
                    stats: {
                        sales: {
                            ordersCount: admin.firestore.FieldValue.increment(delta.ordersCount),
                            unitsSold: admin.firestore.FieldValue.increment(delta.unitsSold),
                            grossRevenue: admin.firestore.FieldValue.increment(delta.grossAmount),
                            firstSoldAt,
                            lastSoldAt,
                            lastOrderId: orderId,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                    },
                }, { merge: true });
            });
        });
        tx.set(archivedRef, {
            productSalesEligible: true,
            productSalesReason: admin.firestore.FieldValue.delete(),
            productSalesStatus: baseStatus,
            productSalesLedgerVersion: PRODUCT_SALES_LEDGER_VERSION,
            productSalesEntriesCount: computed.entries.length,
            productSalesNewEntriesCount: createdEntriesInTx,
            productSalesMissingProductItemsCount: computed.missingProductItems.length,
            productSalesMissingProductItems: computed.missingProductItems.slice(0, 25),
            productSalesTotals: computed.totals,
            productSalesUpdatedDocsCount: updatedProductDocsInTx,
            productSalesLedgerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        createdEntries = createdEntriesInTx;
        productDocsUpdated = updatedProductDocsInTx;
    });
    return {
        status: baseStatus,
        entriesTotal: computed.entries.length,
        entriesCreated: createdEntries,
        missingProductItems: computed.missingProductItems.length,
        productDocsUpdated,
    };
};
const buildPublicReviewPayload = (orderId, snapshot) => ({
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
exports.onArchivedOrderCreated = (0, firestore_1.onDocumentCreated)({
    region: REGION,
    document: "archivedOrders/{orderId}",
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
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
        if (existing.exists)
            return;
        const job = {
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
        tx.set(snapshot.ref, {
            reviewJobId: jobId,
            orderSnapshot,
        }, { merge: true });
    });
    const payoutResult = await applyVendorLedgerForArchivedOrder(snapshot.ref, orderId, archivedOrder, orderSnapshot);
    const productSalesResult = await applyProductSalesForArchivedOrder(snapshot.ref, orderId, archivedOrder, orderSnapshot);
    logger.info("review job + vendor payout ledger + product sales processed", {
        orderId,
        jobId,
        payoutStatus: payoutResult.status,
        payoutEntriesTotal: payoutResult.entriesTotal,
        payoutEntriesCreated: payoutResult.entriesCreated,
        payoutMissingVendorItems: payoutResult.missingVendorItems,
        productSalesStatus: productSalesResult.status,
        productSalesEntriesTotal: productSalesResult.entriesTotal,
        productSalesEntriesCreated: productSalesResult.entriesCreated,
        productSalesMissingProductItems: productSalesResult.missingProductItems,
        productSalesDocsUpdated: productSalesResult.productDocsUpdated,
        ...(payoutResult.reason ? { payoutReason: payoutResult.reason } : {}),
        ...(productSalesResult.reason ? { productSalesReason: productSalesResult.reason } : {}),
    });
});
exports.processScheduledReviewJobs = (0, scheduler_1.onSchedule)({
    region: REGION,
    schedule: "every 10 minutes",
    timeZone: "Africa/Conakry",
    maxInstances: 1,
    secrets: [REVIEW_LINK_SECRET],
}, async () => {
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
        const job = docSnap.data();
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
        }
        catch (error) {
            const nextAttempts = attempts + 1;
            await docSnap.ref.update({
                attempts: nextAttempts,
                status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "scheduled",
                lastError: String(error?.message ?? error),
            });
        }
    }
});
const verifyReviewLinkAndLoad = async (token, sig, secret) => {
    const jobRef = db.doc(`reviewJobs/${token}`);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        throw new Error("invalid_token");
    }
    const job = jobSnap.data();
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
exports.validateReviewLink = (0, https_1.onRequest)({
    region: REGION,
    secrets: [REVIEW_LINK_SECRET],
    cors: true,
}, async (req, res) => {
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
    }
    catch (error) {
        res.status(400).json({ ok: false, error: String(error?.message ?? error) });
    }
});
exports.submitReview = (0, https_1.onRequest)({
    region: REGION,
    secrets: [REVIEW_LINK_SECRET],
    cors: true,
}, async (req, res) => {
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
            const job = jobSnap.data();
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
            tx.set(verified.archivedRef, { reviewSubmittedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        res.status(200).json({ ok: true });
    }
    catch (error) {
        res.status(400).json({ ok: false, error: String(error?.message ?? error) });
    }
});
exports.createStaffAccount = (0, https_1.onCall)({
    region: REGION,
}, async (request) => {
    const callerUid = request.auth?.uid ?? null;
    if (!callerUid) {
        throw new https_1.HttpsError("unauthenticated", "auth_required");
    }
    const payload = (request.data ?? {});
    const email = ensureNonEmptyString(payload.email, "email").toLowerCase();
    const password = ensureNonEmptyString(payload.password, "password");
    const role = parseStaffRole(payload.role);
    const profile = payload.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)
        ? { ...payload.profile }
        : {};
    const callerIsAdmin = await isAdminUid(callerUid);
    if (!callerIsAdmin) {
        throw new https_1.HttpsError("permission-denied", "admin_required");
    }
    if (role === "ADMIN" && !isSuperAdminUid(callerUid)) {
        throw new https_1.HttpsError("permission-denied", "super_admin_required");
    }
    const targetCollection = STAFF_ROLE_COLLECTION[role];
    const username = role === "ADMIN" ? ensureNonEmptyString(profile.username, "username") : null;
    if (username) {
        const usernameSnap = await db
            .collection("admin")
            .where("username", "==", username)
            .limit(1)
            .get();
        if (!usernameSnap.empty) {
            throw new https_1.HttpsError("already-exists", "username_already_exists");
        }
    }
    let authUser;
    let authUserCreated = false;
    try {
        authUser = await admin.auth().getUserByEmail(email);
    }
    catch (error) {
        if (error?.code !== "auth/user-not-found") {
            logger.error("Failed to load auth user before staff creation", error);
            throw new https_1.HttpsError("internal", "failed_to_load_auth_user");
        }
        try {
            authUser = await admin.auth().createUser({
                email,
                password,
                displayName: nonEmptyString(profile.username, profile.firstName, profile.lastName, profile.name) ??
                    undefined,
            });
            authUserCreated = true;
        }
        catch (createError) {
            logger.error("Failed to create auth user for staff account", createError);
            const code = String(createError?.code ?? "");
            if (code === "auth/email-already-exists") {
                throw new https_1.HttpsError("already-exists", "email_already_exists");
            }
            if (code === "auth/invalid-password") {
                throw new https_1.HttpsError("invalid-argument", "invalid_password");
            }
            throw new https_1.HttpsError("internal", "failed_to_create_auth_user");
        }
    }
    const roleDocRef = db.doc(`${targetCollection}/${authUser.uid}`);
    const roleDocSnap = await roleDocRef.get();
    if (roleDocSnap.exists) {
        throw new https_1.HttpsError("already-exists", `${targetCollection}_already_exists`);
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
});
exports.settleVendorPayout = (0, https_1.onCall)({
    region: REGION,
}, async (request) => {
    const callerUid = request.auth?.uid ?? null;
    if (!callerUid) {
        throw new https_1.HttpsError("unauthenticated", "auth_required");
    }
    if (!(await isAdminUid(callerUid))) {
        throw new https_1.HttpsError("permission-denied", "admin_required");
    }
    const payload = (request.data ?? {});
    const vendorId = ensureNonEmptyString(payload.vendorId, "vendorId");
    const rawEntryIds = Array.isArray(payload.entryIds) ? payload.entryIds : [];
    const entryIds = Array.from(new Set(rawEntryIds
        .map((value) => nonEmptyString(value))
        .filter((value) => Boolean(value))));
    if (!entryIds.length) {
        throw new https_1.HttpsError("invalid-argument", "entryIds_required");
    }
    if (entryIds.length > 1000) {
        throw new https_1.HttpsError("invalid-argument", "too_many_entries");
    }
    const [vendorSnap, deletedVendorSnap] = await Promise.all([
        db.doc(`vendors/${vendorId}`).get(),
        db.doc(`deletedVendors/${vendorId}`).get(),
    ]);
    const vendorAccountState = resolveVendorPayoutAccountState(vendorSnap, deletedVendorSnap);
    const forceSensitiveVendor = payload.forceSensitiveVendor === true;
    const forceReason = nonEmptyString(payload.forceReason);
    if (vendorAccountState.requiresReview && (!forceSensitiveVendor || !forceReason)) {
        throw new https_1.HttpsError("failed-precondition", `vendor_${vendorAccountState.key}_requires_manual_confirmation`);
    }
    const actorRecord = await admin.auth().getUser(callerUid).catch(() => null);
    const actorEmail = actorRecord?.email ?? request.auth?.token?.email ?? null;
    const actorLabel = actorEmail ?? callerUid;
    const batchId = `manual_${Date.now()}_${normalizeDocIdPart(callerUid, "admin")}`;
    const batchRef = db.doc(`vendor_payout_batches/${batchId}`);
    const balanceRef = db.doc(`vendor_balances/${vendorId}`);
    const chunkSize = 400;
    const paidEntryIds = [];
    const settledEntries = [];
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
                        throw new https_1.HttpsError("failed-precondition", `entry_missing:${entryId}`);
                    }
                    const data = snap.data() || {};
                    const currentVendorId = nonEmptyString(data.vendorId);
                    const currentStatus = nonEmptyString(data.status) ?? "pending";
                    if (currentVendorId !== vendorId) {
                        throw new https_1.HttpsError("failed-precondition", `entry_vendor_mismatch:${entryId}`);
                    }
                    if (currentStatus !== "pending") {
                        throw new https_1.HttpsError("failed-precondition", `entry_not_pending:${entryId}`);
                    }
                    return {
                        ref: refs[index],
                        id: entryId,
                        qty: Math.max(1, Math.floor(toNumber(data.qty, 1))),
                        unitPrice: roundMoney(toNumber(data.unitPrice, 0)),
                        grossAmount: roundMoney(toNumber(data.grossAmount, 0)),
                        commissionAmount: roundMoney(toNumber(data.commissionAmount, 0)),
                        netAmount: roundMoney(toNumber(data.netAmount, 0)),
                        currency: nonEmptyString(data.currency) ?? "GNF",
                        orderId: nonEmptyString(data.orderId),
                        productId: nonEmptyString(data.productId),
                        title: nonEmptyString(data.title),
                    };
                });
                const chunkTotals = freshEntries.reduce((acc, entry) => {
                    acc.grossAmount = roundMoney(acc.grossAmount + entry.grossAmount);
                    acc.commissionAmount = roundMoney(acc.commissionAmount + entry.commissionAmount);
                    acc.netAmount = roundMoney(acc.netAmount + entry.netAmount);
                    acc.entriesCount += 1;
                    return acc;
                }, { grossAmount: 0, commissionAmount: 0, netAmount: 0, entriesCount: 0 });
                const chunkCurrency = freshEntries[0]?.currency ?? "GNF";
                freshEntries.forEach((entry) => {
                    tx.update(entry.ref, {
                        status: "paid",
                        paidAt: admin.firestore.FieldValue.serverTimestamp(),
                        paidBatchId: batchId,
                        paidByUid: callerUid,
                        paidByEmail: actorEmail,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
                tx.set(balanceRef, {
                    vendorId,
                    pendingGrossAmount: admin.firestore.FieldValue.increment(-chunkTotals.grossAmount),
                    pendingCommissionAmount: admin.firestore.FieldValue.increment(-chunkTotals.commissionAmount),
                    pendingNetAmount: admin.firestore.FieldValue.increment(-chunkTotals.netAmount),
                    pendingEntriesCount: admin.firestore.FieldValue.increment(-chunkTotals.entriesCount),
                    paidGrossAmount: admin.firestore.FieldValue.increment(chunkTotals.grossAmount),
                    paidCommissionAmount: admin.firestore.FieldValue.increment(chunkTotals.commissionAmount),
                    paidNetAmount: admin.firestore.FieldValue.increment(chunkTotals.netAmount),
                    paidEntriesCount: admin.firestore.FieldValue.increment(chunkTotals.entriesCount),
                    lastPaidBatchId: batchId,
                    lastPaidAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                tx.set(batchRef, {
                    paidEntryIds: admin.firestore.FieldValue.arrayUnion(...freshEntries.map((e) => e.id)),
                    paidEntriesCount: admin.firestore.FieldValue.increment(chunkTotals.entriesCount),
                    grossAmount: admin.firestore.FieldValue.increment(chunkTotals.grossAmount),
                    commissionAmount: admin.firestore.FieldValue.increment(chunkTotals.commissionAmount),
                    netAmount: admin.firestore.FieldValue.increment(chunkTotals.netAmount),
                    currency: chunkCurrency,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                return {
                    ...chunkTotals,
                    currency: chunkCurrency,
                    entryIds: freshEntries.map((entry) => entry.id),
                    settledEntries: freshEntries.map((entry) => ({
                        id: entry.id,
                        orderId: entry.orderId ?? null,
                        productId: entry.productId ?? null,
                        title: entry.title ?? null,
                        qty: entry.qty,
                        unitPrice: entry.unitPrice,
                        grossAmount: entry.grossAmount,
                        commissionAmount: entry.commissionAmount,
                        netAmount: entry.netAmount,
                        currency: entry.currency,
                    })),
                };
            });
            totals.grossAmount = roundMoney(totals.grossAmount + chunkResult.grossAmount);
            totals.commissionAmount = roundMoney(totals.commissionAmount + chunkResult.commissionAmount);
            totals.netAmount = roundMoney(totals.netAmount + chunkResult.netAmount);
            totals.entriesCount += chunkResult.entriesCount;
            currency = chunkResult.currency;
            paidEntryIds.push(...chunkResult.entryIds);
            settledEntries.push(...chunkResult.settledEntries);
        }
        await batchRef.set({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            paidEntryIds,
            paidEntriesCount: totals.entriesCount,
            grossAmount: totals.grossAmount,
            commissionAmount: totals.commissionAmount,
            netAmount: totals.netAmount,
            currency,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        let emailStatus = "failed";
        try {
            emailStatus = await sendVendorPayoutSummaryEmail({
                vendorId,
                vendorData: vendorSnap.data() || null,
                deletedVendorData: deletedVendorSnap.data() || null,
                batchId,
                totals,
                currency,
                settledEntries,
            });
        }
        catch (mailError) {
            logger.error("vendor payout email failed", {
                batchId,
                vendorId,
                error: mailError instanceof Error ? mailError.message : String(mailError),
            });
        }
        logger.info("vendor payout settled", {
            batchId,
            vendorId,
            entriesCount: totals.entriesCount,
            netAmount: totals.netAmount,
            actorUid: callerUid,
            vendorAccountStatus: vendorAccountState.key,
            emailStatus,
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
            emailStatus,
        };
    }
    catch (error) {
        await batchRef.set({
            status: "failed",
            failureReason: error instanceof https_1.HttpsError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : "unknown_error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        throw error;
    }
});
exports.onOrderCreatedNotifyAdmins = (0, firestore_1.onDocumentCreated)({ region: REGION, document: "orders/{orderId}" }, async (event) => {
    const orderId = event.params.orderId;
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
});
exports.onVendorCreatedNotifyAdmins = (0, firestore_1.onDocumentCreated)({ region: REGION, document: "vendors/{vendorId}" }, async (event) => {
    const vendorId = event.params.vendorId;
    const data = event.data?.data() || {};
    const vendorName = nonEmptyString(data.displayName, data.company?.name, data.name, data.companyName, data.profile?.company?.name, data.profile?.name, vendorId) ?? vendorId;
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
});
exports.onVendorProductCreatedNotifyAdmins = (0, firestore_1.onDocumentCreated)({ region: REGION, document: "vendor_products/{productId}" }, async (event) => {
    const productId = event.params.productId;
    const data = event.data?.data() || {};
    const mmStatus = data?.mm_status ??
        data?.mmStatus ??
        data?.core?.mm_status ??
        data?.draft?.core?.mm_status ??
        undefined;
    const pending = hasDraftPending(data) || mmStatus === false || mmStatus === undefined;
    if (!pending)
        return;
    const productTitle = nonEmptyString(data.title, data.name, data.core?.title, data.core?.name, data.draft?.core?.title, data.draft?.core?.name, productId) ?? productId;
    const vendorName = nonEmptyString(data.vendorName, data.vendor?.name, data.vendor?.displayName, data.core?.vendorName, data.core?.vendor?.name, data.core?.vendor?.displayName, data.draft?.core?.vendorName, data.draft?.core?.vendor?.name, data.draft?.core?.vendor?.displayName) ?? "Vendeur";
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
});
