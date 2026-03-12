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
exports.submitReview = exports.validateReviewLink = exports.processScheduledReviewJobs = exports.onArchivedOrderCreated = void 0;
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
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DELAY_MS = DAY_MS;
const LINK_TTL_MS = 14 * DAY_MS;
const MAX_ATTEMPTS = 3;
const PLATFORM_COMMISSION_RATE = 0.05;
const VENDOR_LEDGER_VERSION = 1;
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
            };
            current.grossAmount = roundMoney(current.grossAmount + entry.grossAmount);
            current.commissionAmount = roundMoney(current.commissionAmount + entry.commissionAmount);
            current.netAmount = roundMoney(current.netAmount + entry.netAmount);
            current.entriesCount += 1;
            deltasByVendor.set(entry.vendorId, current);
        });
        deltasByVendor.forEach((delta, vendorId) => {
            const balanceRef = db.doc(`vendor_balances/${vendorId}`);
            tx.set(balanceRef, {
                vendorId,
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
    logger.info("review job + vendor payout ledger processed", {
        orderId,
        jobId,
        payoutStatus: payoutResult.status,
        payoutEntriesTotal: payoutResult.entriesTotal,
        payoutEntriesCreated: payoutResult.entriesCreated,
        payoutMissingVendorItems: payoutResult.missingVendorItems,
        ...(payoutResult.reason ? { payoutReason: payoutResult.reason } : {}),
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
