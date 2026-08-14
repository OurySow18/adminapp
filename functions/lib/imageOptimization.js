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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImageOptimizationBatch = exports.startImageOptimizationJob = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const logger = __importStar(require("firebase-functions/logger"));
const https_1 = require("firebase-functions/v2/https");
const sharp_1 = __importDefault(require("sharp"));
const REGION = "europe-west1";
const VERSION = 1;
const DEFAULT_BATCH_SIZE = 15;
const MAX_BATCH_SIZE = 20;
const TEST_LIMIT = 5;
const SUPER_ADMIN_UID = "rgFo1YPQNDdJxyfRCiWFXETpJHB2";
const PRODUCT_COLLECTIONS = ["vendor_products", "products_public"];
const getDb = () => admin.firestore();
const requireAdmin = async (uid) => {
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "auth_required");
    if (uid === SUPER_ADMIN_UID)
        return;
    const snapshot = await getDb().doc(`admin/${uid}`).get();
    if (!snapshot.exists)
        throw new https_1.HttpsError("permission-denied", "admin_required");
};
const nonEmptyString = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const parseMode = (value) => {
    if (["simulation", "test", "full", "retry"].includes(String(value))) {
        return String(value);
    }
    throw new https_1.HttpsError("invalid-argument", "invalid_mode");
};
const parseStorageLocation = (url) => {
    if (url.startsWith("gs://")) {
        const withoutScheme = url.slice(5);
        const slash = withoutScheme.indexOf("/");
        if (slash <= 0)
            throw new Error("storage_url_invalid");
        return { bucket: withoutScheme.slice(0, slash), path: withoutScheme.slice(slash + 1) };
    }
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new Error("storage_url_invalid");
    }
    if (parsed.hostname === "firebasestorage.googleapis.com") {
        const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (!match)
            throw new Error("firebase_storage_url_invalid");
        return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
    }
    if (parsed.hostname === "storage.googleapis.com") {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length < 2)
            throw new Error("google_storage_url_invalid");
        return { bucket: decodeURIComponent(parts[0]), path: decodeURIComponent(parts.slice(1).join("/")) };
    }
    throw new Error("not_a_firebase_storage_url");
};
const downloadUrlFor = (bucket, path, token) => `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
const uploadWebp = async (sourceUrl, productId, variant, maxDimension, dryRun) => {
    const source = parseStorageLocation(sourceUrl);
    const sourceBucket = admin.storage().bucket(source.bucket);
    const [buffer] = await sourceBucket.file(source.path).download();
    const optimized = await (0, sharp_1.default)(buffer, { limitInputPixels: false })
        .rotate()
        .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
    })
        .webp({ quality: 82 })
        .toBuffer();
    if (dryRun)
        return sourceUrl;
    const fingerprint = crypto
        .createHash("sha256")
        .update(`${sourceUrl}|${variant}|v${VERSION}`)
        .digest("hex")
        .slice(0, 24);
    const safeProductId = productId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
    const destinationPath = `image-optimization/v${VERSION}/${safeProductId}/${fingerprint}-${variant}.webp`;
    const destination = sourceBucket.file(destinationPath);
    const [exists] = await destination.exists();
    let token;
    if (exists) {
        const [metadata] = await destination.getMetadata();
        token = nonEmptyString(metadata.metadata?.firebaseStorageDownloadTokens) || undefined;
    }
    if (!token)
        token = crypto.randomUUID();
    await destination.save(optimized, {
        resumable: false,
        metadata: {
            contentType: "image/webp",
            cacheControl: "public,max-age=31536000,immutable",
            metadata: { firebaseStorageDownloadTokens: token },
        },
    });
    return downloadUrlFor(source.bucket, destinationPath, token);
};
const optimizeNestedUrls = async (value, productId, variantPrefix, dryRun, counter) => {
    if (typeof value === "string") {
        if (!value.startsWith("http") && !value.startsWith("gs://"))
            return value;
        const variant = `${variantPrefix}-${counter.value++}`;
        return uploadWebp(value, productId, variant, 1600, dryRun);
    }
    if (Array.isArray(value)) {
        return Promise.all(value.map((entry, index) => optimizeNestedUrls(entry, productId, `${variantPrefix}-${index}`, dryRun, counter)));
    }
    if (value && typeof value === "object") {
        const entries = await Promise.all(Object.entries(value).map(async ([key, entry]) => [
            key,
            await optimizeNestedUrls(entry, productId, `${variantPrefix}-${key}`, dryRun, counter),
        ]));
        return Object.fromEntries(entries);
    }
    return value;
};
const hasMediaUrls = (media) => {
    const visit = (value) => {
        if (typeof value === "string")
            return value.startsWith("http") || value.startsWith("gs://");
        if (Array.isArray(value))
            return value.some(visit);
        if (value && typeof value === "object")
            return Object.values(value).some(visit);
        return false;
    };
    return visit(media.cover) || visit(media.gallery) || visit(media.byOption);
};
const hasStringUrl = (value) => typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("gs://"));
const isFullyOptimized = (product) => {
    if (Number(product.imageOptimization?.version || 0) < VERSION)
        return false;
    const cover = product.media?.cover;
    return !hasStringUrl(cover) || hasStringUrl(product.media?.thumbnail);
};
const optimizeProduct = async (collectionName, productId, dryRun) => {
    const db = getDb();
    const productRef = db.doc(`${collectionName}/${productId}`);
    const snapshot = await productRef.get();
    if (!snapshot.exists)
        return { status: "skipped", message: "product_missing", images: 0, originalCover: null, optimizedCover: null, thumbnail: null };
    const product = snapshot.data() || {};
    if (isFullyOptimized(product)) {
        return { status: "skipped", message: "already_optimized", images: 0, originalCover: product.media?.cover || null, optimizedCover: product.media?.cover || null, thumbnail: product.media?.thumbnail || null };
    }
    const media = product.media && typeof product.media === "object" ? product.media : {};
    if (!hasMediaUrls(media)) {
        return { status: "skipped", message: "no_media_urls", images: 0, originalCover: media.cover || null, optimizedCover: null, thumbnail: null };
    }
    const thumbnailRepairOnly = Number(product.imageOptimization?.version || 0) >= VERSION &&
        hasStringUrl(media.cover) &&
        !hasStringUrl(media.thumbnail);
    if (thumbnailRepairOnly) {
        const thumbnail = await uploadWebp(media.cover, productId, "thumbnail", 240, dryRun);
        if (!dryRun) {
            await db.runTransaction(async (transaction) => {
                const fresh = await transaction.get(productRef);
                if (!fresh.exists)
                    throw new Error("product_removed_during_thumbnail_repair");
                if (hasStringUrl(fresh.data()?.media?.thumbnail))
                    return;
                if (fresh.data()?.media?.cover !== media.cover) {
                    throw new Error("product_cover_changed_during_thumbnail_repair");
                }
                transaction.update(productRef, {
                    "media.thumbnail": thumbnail,
                    "imageOptimization.thumbnailRepairedAt": admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        }
        return {
            status: "succeeded",
            message: dryRun ? "thumbnail_repair_simulated" : "thumbnail_repaired",
            images: 1,
            originalCover: media.cover,
            optimizedCover: media.cover,
            thumbnail,
        };
    }
    const originalMedia = {
        cover: media.cover ?? null,
        gallery: media.gallery ?? null,
        byOption: media.byOption ?? null,
        thumbnail: media.thumbnail ?? null,
    };
    const counter = { value: 0 };
    const optimizedMedia = { ...media };
    if (typeof media.cover === "string" && media.cover.trim()) {
        optimizedMedia.cover = await uploadWebp(media.cover, productId, "cover", 1600, dryRun);
        optimizedMedia.thumbnail = await uploadWebp(media.cover, productId, "thumbnail", 240, dryRun);
        counter.value += 2;
    }
    if (media.gallery !== undefined) {
        optimizedMedia.gallery = await optimizeNestedUrls(media.gallery, productId, "gallery", dryRun, counter);
    }
    if (media.byOption !== undefined) {
        optimizedMedia.byOption = await optimizeNestedUrls(media.byOption, productId, "option", dryRun, counter);
    }
    if (!dryRun) {
        await db.runTransaction(async (transaction) => {
            const fresh = await transaction.get(productRef);
            if (!fresh.exists)
                throw new Error("product_removed_during_processing");
            if (isFullyOptimized(fresh.data() || {}))
                return;
            if (JSON.stringify(fresh.data()?.media || {}) !== JSON.stringify(media)) {
                throw new Error("product_media_changed_during_processing");
            }
            transaction.update(productRef, {
                media: optimizedMedia,
                imageOptimization: {
                    version: VERSION,
                    status: "complete",
                    optimizedAt: admin.firestore.FieldValue.serverTimestamp(),
                    originalMedia,
                },
            });
        });
    }
    return {
        status: "succeeded",
        message: dryRun ? "simulation_complete" : "optimization_complete",
        images: counter.value,
        originalCover: typeof media.cover === "string" ? media.cover : null,
        optimizedCover: typeof optimizedMedia.cover === "string" ? optimizedMedia.cover : null,
        thumbnail: typeof optimizedMedia.thumbnail === "string" ? optimizedMedia.thumbnail : null,
    };
};
const finishJobIfComplete = async (jobId) => {
    const db = getDb();
    const jobRef = db.doc(`image_optimization_jobs/${jobId}`);
    const configRef = db.doc("image_optimization_config/current");
    await db.runTransaction(async (transaction) => {
        const [jobSnapshot, configSnapshot] = await transaction.getAll(jobRef, configRef);
        if (!jobSnapshot.exists)
            return;
        const job = jobSnapshot.data() || {};
        const processed = Number(job.succeeded || 0) + Number(job.skipped || 0) + Number(job.failed || 0);
        if (processed < Number(job.total || 0))
            return;
        transaction.update(jobRef, {
            status: "complete",
            processed,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            batchLeaseToken: admin.firestore.FieldValue.delete(),
            batchLeaseUntil: admin.firestore.FieldValue.delete(),
        });
        if (configSnapshot.data()?.activeJobId === jobId) {
            transaction.set(configRef, { activeJobId: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
    });
};
exports.startImageOptimizationJob = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
    await requireAdmin(request.auth?.uid);
    const payload = (request.data || {});
    const mode = parseMode(payload.mode);
    const sourceJobId = nonEmptyString(payload.sourceJobId);
    if (mode === "retry" && !sourceJobId) {
        throw new https_1.HttpsError("invalid-argument", "sourceJobId_required");
    }
    const db = getDb();
    const configRef = db.doc("image_optimization_config/current");
    const jobRef = db.collection("image_optimization_jobs").doc();
    const existingJobId = await db.runTransaction(async (transaction) => {
        const configSnapshot = await transaction.get(configRef);
        const activeJobId = nonEmptyString(configSnapshot.data()?.activeJobId);
        if (activeJobId) {
            const activeJob = await transaction.get(db.doc(`image_optimization_jobs/${activeJobId}`));
            if (activeJob.exists && activeJob.data()?.status === "running") {
                return activeJobId;
            }
            if (activeJob.exists && activeJob.data()?.status === "initializing") {
                const createdAt = activeJob.data()?.createdAt?.toMillis?.() || Date.now();
                if (createdAt > Date.now() - 10 * 60 * 1000) {
                    throw new https_1.HttpsError("aborted", "job_initialization_in_progress");
                }
                transaction.update(activeJob.ref, {
                    status: "failed",
                    initializationError: "initialization_timeout",
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
        transaction.set(jobRef, {
            mode,
            status: "initializing",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth?.uid,
        });
        transaction.set(configRef, { activeJobId: jobRef.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return null;
    });
    if (existingJobId)
        return { ok: true, jobId: existingJobId, resumed: true };
    const candidates = [];
    if (mode === "retry") {
        const sourceJob = await db.doc(`image_optimization_jobs/${sourceJobId}`).get();
        if (!sourceJob.exists)
            throw new https_1.HttpsError("not-found", "source_job_not_found");
        const failedItems = await db
            .collection(`image_optimization_jobs/${sourceJobId}/items`)
            .where("status", "==", "failed")
            .get();
        failedItems.forEach((item) => {
            const data = item.data();
            if (PRODUCT_COLLECTIONS.includes(data.collectionName)) {
                candidates.push({
                    collectionName: data.collectionName,
                    productId: data.productId,
                    data: {
                        title: data.title || data.productTitle || null,
                        media: { cover: data.coverUrl || data.originalImageUrl || null },
                    },
                });
            }
        });
    }
    else {
        const limit = mode === "full" ? Number.POSITIVE_INFINITY : TEST_LIMIT;
        for (const collectionName of PRODUCT_COLLECTIONS) {
            if (candidates.length >= limit)
                break;
            const snapshot = await db.collection(collectionName).get();
            for (const product of snapshot.docs) {
                if (candidates.length >= limit)
                    break;
                candidates.push({ collectionName, productId: product.id, data: product.data() });
            }
        }
    }
    let skipped = 0;
    const pending = [];
    candidates.forEach((candidate) => {
        if (isFullyOptimized(candidate.data || {}))
            skipped += 1;
        else if (mode !== "retry" && !hasMediaUrls(candidate.data?.media || {}))
            skipped += 1;
        else
            pending.push(candidate);
    });
    const now = admin.firestore.FieldValue.serverTimestamp();
    const total = candidates.length;
    const batches = [];
    let batch = db.batch();
    let operationCount = 0;
    const push = (ref, data) => {
        batch.set(ref, data);
        operationCount += 1;
        if (operationCount === 450) {
            batches.push(batch);
            batch = db.batch();
            operationCount = 0;
        }
    };
    push(jobRef, {
        mode,
        dryRun: mode === "simulation",
        sourceJobId: sourceJobId || null,
        status: pending.length ? "running" : "complete",
        version: VERSION,
        total,
        processed: skipped,
        pending: pending.length,
        succeeded: 0,
        skipped,
        failed: 0,
        imagesProcessed: 0,
        createdAt: now,
        createdBy: request.auth?.uid,
        updatedAt: now,
        ...(pending.length ? {} : { completedAt: now }),
    });
    pending.forEach(({ collectionName, productId, data }) => {
        const id = `${collectionName}__${productId}`.replace(/\//g, "_");
        push(jobRef.collection("items").doc(id), {
            collectionName,
            productId,
            title: data?.title || data?.name || data?.core?.title || productId,
            coverUrl: data?.media?.cover || null,
            status: "pending",
            attempts: 0,
            createdAt: now,
            updatedAt: now,
        });
    });
    if (operationCount)
        batches.push(batch);
    for (const writeBatch of batches)
        await writeBatch.commit();
    if (!pending.length) {
        await configRef.set({ activeJobId: admin.firestore.FieldValue.delete(), updatedAt: now }, { merge: true });
    }
    logger.info("image optimization job created", { jobId: jobRef.id, mode, total, skipped });
    return { ok: true, jobId: jobRef.id, resumed: false };
});
exports.processImageOptimizationBatch = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 540, memory: "2GiB" }, async (request) => {
    await requireAdmin(request.auth?.uid);
    const payload = (request.data || {});
    const jobId = nonEmptyString(payload.jobId);
    if (!jobId)
        throw new https_1.HttpsError("invalid-argument", "jobId_required");
    const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(Number(payload.batchSize) || DEFAULT_BATCH_SIZE)));
    const db = getDb();
    const jobRef = db.doc(`image_optimization_jobs/${jobId}`);
    const leaseToken = crypto.randomUUID();
    const leaseUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 9 * 60 * 1000);
    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(jobRef);
        if (!snapshot.exists)
            throw new https_1.HttpsError("not-found", "job_not_found");
        const job = snapshot.data() || {};
        if (job.status === "complete")
            return;
        if (job.status !== "running")
            throw new https_1.HttpsError("failed-precondition", "job_not_running");
        const currentLease = job.batchLeaseUntil?.toMillis?.() || 0;
        if (currentLease > Date.now())
            throw new https_1.HttpsError("aborted", "batch_already_running");
        transaction.update(jobRef, {
            batchLeaseToken: leaseToken,
            batchLeaseUntil: leaseUntil,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    const staleProcessing = await jobRef.collection("items").where("status", "==", "processing").get();
    if (!staleProcessing.empty) {
        const resetBatches = [];
        let resetBatch = db.batch();
        let resetCount = 0;
        staleProcessing.docs.forEach((item) => {
            resetBatch.update(item.ref, {
                status: "pending",
                recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            resetCount += 1;
            if (resetCount === 450) {
                resetBatches.push(resetBatch);
                resetBatch = db.batch();
                resetCount = 0;
            }
        });
        if (resetCount)
            resetBatches.push(resetBatch);
        for (const reset of resetBatches)
            await reset.commit();
    }
    const jobSnapshot = await jobRef.get();
    if (jobSnapshot.data()?.status === "complete") {
        return { ok: true, complete: true, processedInBatch: 0 };
    }
    const dryRun = Boolean(jobSnapshot.data()?.dryRun);
    const itemsSnapshot = await jobRef.collection("items").where("status", "==", "pending").limit(batchSize).get();
    try {
        for (const item of itemsSnapshot.docs) {
            const itemData = item.data();
            await item.ref.update({
                status: "processing",
                attempts: admin.firestore.FieldValue.increment(1),
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            let result;
            let errorMessage = null;
            try {
                result = await optimizeProduct(itemData.collectionName, itemData.productId, dryRun);
            }
            catch (error) {
                errorMessage = error instanceof Error ? error.message : String(error);
                result = {
                    status: "failed",
                    message: errorMessage,
                    images: 0,
                    originalCover: itemData.coverUrl || null,
                    optimizedCover: null,
                    thumbnail: null,
                };
            }
            const status = result.status === "succeeded" ? "succeeded" : result.status === "skipped" ? "skipped" : "failed";
            await db.runTransaction(async (transaction) => {
                const freshItem = await transaction.get(item.ref);
                if (freshItem.data()?.status !== "processing")
                    return;
                transaction.update(item.ref, {
                    status,
                    message: result.message,
                    error: errorMessage,
                    imagesProcessed: result.images,
                    originalImageUrl: result.originalCover || itemData.coverUrl || null,
                    imageUrl: result.optimizedCover || itemData.coverUrl || null,
                    thumbnailUrl: result.thumbnail || null,
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                transaction.update(jobRef, {
                    processed: admin.firestore.FieldValue.increment(1),
                    pending: admin.firestore.FieldValue.increment(-1),
                    [status]: admin.firestore.FieldValue.increment(1),
                    imagesProcessed: admin.firestore.FieldValue.increment(result.images),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                transaction.set(jobRef.collection("logs").doc(), {
                    level: status === "failed" ? "error" : "info",
                    status,
                    collectionName: itemData.collectionName,
                    productId: itemData.productId,
                    title: itemData.title || itemData.productId,
                    message: result.message,
                    error: errorMessage,
                    imagesProcessed: result.images,
                    originalImageUrl: result.originalCover || itemData.coverUrl || null,
                    imageUrl: result.optimizedCover || itemData.coverUrl || null,
                    thumbnailUrl: result.thumbnail || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        }
    }
    finally {
        await jobRef.update({
            batchLeaseToken: admin.firestore.FieldValue.delete(),
            batchLeaseUntil: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await finishJobIfComplete(jobId);
    const finalSnapshot = await jobRef.get();
    return {
        ok: true,
        complete: finalSnapshot.data()?.status === "complete",
        processedInBatch: itemsSnapshot.size,
    };
});
