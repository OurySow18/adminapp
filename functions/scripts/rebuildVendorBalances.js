"use strict";

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const WRITE_BATCH_LIMIT = 400;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) =>
  Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

const nonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const asDate = (value) => {
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
    if (typeof value.toDate === "function") {
      return value.toDate();
    }
    if (typeof value.seconds === "number") {
      return new Date(
        value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6)
      );
    }
  }
  return null;
};

const toMillis = (value) => {
  const date = asDate(value);
  return date ? date.getTime() : 0;
};

const asTimestamp = (value) => {
  const date = asDate(value);
  return date ? Timestamp.fromDate(date) : null;
};

const parseArgs = (argv) => {
  const options = {
    apply: false,
    help: false,
    vendorId: null,
    verbose: false,
  };

  argv.forEach((arg) => {
    if (arg === "--apply") {
      options.apply = true;
      return;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      return;
    }
    if (arg.startsWith("--vendor=")) {
      const vendorId = arg.slice("--vendor=".length).trim();
      options.vendorId = vendorId || null;
    }
  });

  return options;
};

const printHelp = () => {
  console.log("Rebuild vendor_balances from vendor_ledger");
  console.log("");
  console.log("Usage:");
  console.log("  npm run rebuild:vendor-balances -- [--apply] [--vendor=<vendorId>] [--verbose]");
  console.log("");
  console.log("Examples:");
  console.log("  npm run rebuild:vendor-balances --");
  console.log("  npm run rebuild:vendor-balances -- --apply");
  console.log("  npm run rebuild:vendor-balances -- --apply --vendor=VENDOR_UID");
};

const createAggregate = (vendorId) => ({
  vendorId,
  vendorName: null,
  pendingGrossAmount: 0,
  pendingCommissionAmount: 0,
  pendingNetAmount: 0,
  pendingEntriesCount: 0,
  paidGrossAmount: 0,
  paidCommissionAmount: 0,
  paidNetAmount: 0,
  paidEntriesCount: 0,
  lifetimeGrossAmount: 0,
  lifetimeCommissionAmount: 0,
  lifetimeNetAmount: 0,
  lifetimeEntriesCount: 0,
  lastPaidAtMs: 0,
  lastPaidBatchId: null,
  statuses: {
    pending: 0,
    paid: 0,
    reversed: 0,
    other: 0,
  },
});

const buildBalancePayload = (aggregate) => {
  const payload = {
    vendorId: aggregate.vendorId,
    pendingGrossAmount: roundMoney(aggregate.pendingGrossAmount),
    pendingCommissionAmount: roundMoney(aggregate.pendingCommissionAmount),
    pendingNetAmount: roundMoney(aggregate.pendingNetAmount),
    pendingEntriesCount: aggregate.pendingEntriesCount,
    paidGrossAmount: roundMoney(aggregate.paidGrossAmount),
    paidCommissionAmount: roundMoney(aggregate.paidCommissionAmount),
    paidNetAmount: roundMoney(aggregate.paidNetAmount),
    paidEntriesCount: aggregate.paidEntriesCount,
    lifetimeGrossAmount: roundMoney(aggregate.lifetimeGrossAmount),
    lifetimeCommissionAmount: roundMoney(aggregate.lifetimeCommissionAmount),
    lifetimeNetAmount: roundMoney(aggregate.lifetimeNetAmount),
    lifetimeEntriesCount: aggregate.lifetimeEntriesCount,
    rebuiltAt: FieldValue.serverTimestamp(),
    rebuiltFrom: "vendor_ledger",
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (aggregate.vendorName) {
    payload.vendorName = aggregate.vendorName;
  }

  if (aggregate.lastPaidBatchId) {
    payload.lastPaidBatchId = aggregate.lastPaidBatchId;
  }

  const lastPaidAt = asTimestamp(aggregate.lastPaidAtMs);
  if (lastPaidAt) {
    payload.lastPaidAt = lastPaidAt;
  }

  return payload;
};

const aggregateLedger = (docs, options) => {
  const aggregates = new Map();
  let skippedWithoutVendor = 0;

  docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const vendorId = nonEmptyString(data.vendorId);
    if (!vendorId) {
      skippedWithoutVendor += 1;
      if (options.verbose) {
        console.warn(`[skip] vendorId missing for ledger entry ${docSnap.id}`);
      }
      return;
    }

    const aggregate = aggregates.get(vendorId) || createAggregate(vendorId);
    const status = nonEmptyString(data.status, "pending").toLowerCase();
    const vendorName = nonEmptyString(data.vendorName);
    const grossAmount = roundMoney(toNumber(data.grossAmount));
    const commissionAmount = roundMoney(toNumber(data.commissionAmount));
    const netAmount = roundMoney(toNumber(data.netAmount));

    if (!aggregate.vendorName && vendorName) {
      aggregate.vendorName = vendorName;
    }

    aggregate.lifetimeGrossAmount = roundMoney(
      aggregate.lifetimeGrossAmount + grossAmount
    );
    aggregate.lifetimeCommissionAmount = roundMoney(
      aggregate.lifetimeCommissionAmount + commissionAmount
    );
    aggregate.lifetimeNetAmount = roundMoney(
      aggregate.lifetimeNetAmount + netAmount
    );
    aggregate.lifetimeEntriesCount += 1;

    if (status === "pending") {
      aggregate.pendingGrossAmount = roundMoney(
        aggregate.pendingGrossAmount + grossAmount
      );
      aggregate.pendingCommissionAmount = roundMoney(
        aggregate.pendingCommissionAmount + commissionAmount
      );
      aggregate.pendingNetAmount = roundMoney(
        aggregate.pendingNetAmount + netAmount
      );
      aggregate.pendingEntriesCount += 1;
      aggregate.statuses.pending += 1;
    } else if (status === "paid") {
      aggregate.paidGrossAmount = roundMoney(
        aggregate.paidGrossAmount + grossAmount
      );
      aggregate.paidCommissionAmount = roundMoney(
        aggregate.paidCommissionAmount + commissionAmount
      );
      aggregate.paidNetAmount = roundMoney(
        aggregate.paidNetAmount + netAmount
      );
      aggregate.paidEntriesCount += 1;
      aggregate.statuses.paid += 1;

      const paidAtMs = toMillis(data.paidAt);
      if (paidAtMs >= aggregate.lastPaidAtMs) {
        aggregate.lastPaidAtMs = paidAtMs;
        aggregate.lastPaidBatchId = nonEmptyString(data.paidBatchId);
      }
    } else if (status === "reversed") {
      aggregate.statuses.reversed += 1;
    } else {
      aggregate.statuses.other += 1;
      if (options.verbose) {
        console.warn(
          `[warn] unknown ledger status "${status}" for entry ${docSnap.id}; kept in lifetime totals only`
        );
      }
    }

    aggregates.set(vendorId, aggregate);
  });

  return { aggregates, skippedWithoutVendor };
};

const loadCollectionDocs = async (collectionName, vendorId) => {
  if (vendorId && collectionName === "vendor_balances") {
    const snap = await db.collection(collectionName).doc(vendorId).get();
    return snap.exists ? [snap] : [];
  }

  let query = db.collection(collectionName);
  if (vendorId) {
    query = query.where("vendorId", "==", vendorId);
  }

  const snapshot = await query.get();
  return snapshot.docs;
};

const writeBatches = async (operations) => {
  let committed = 0;

  for (let index = 0; index < operations.length; index += WRITE_BATCH_LIMIT) {
    const slice = operations.slice(index, index + WRITE_BATCH_LIMIT);
    const batch = db.batch();

    slice.forEach((operation) => {
      if (operation.type === "set") {
        batch.set(operation.ref, operation.data);
        return;
      }
      if (operation.type === "delete") {
        batch.delete(operation.ref);
      }
    });

    await batch.commit();
    committed += slice.length;
    console.log(
      `[apply] committed ${committed}/${operations.length} balance operations`
    );
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  console.log(
    `[start] rebuild vendor_balances (${options.apply ? "apply" : "dry-run"})`
  );
  if (options.vendorId) {
    console.log(`[filter] vendorId=${options.vendorId}`);
  }

  const [ledgerDocs, balanceDocs] = await Promise.all([
    loadCollectionDocs("vendor_ledger", options.vendorId),
    loadCollectionDocs("vendor_balances", options.vendorId),
  ]);

  const { aggregates, skippedWithoutVendor } = aggregateLedger(ledgerDocs, options);
  const existingBalanceIds = new Set(balanceDocs.map((docSnap) => docSnap.id));
  const aggregateIds = new Set(aggregates.keys());
  const operations = [];

  aggregates.forEach((aggregate, vendorId) => {
    operations.push({
      type: "set",
      ref: db.collection("vendor_balances").doc(vendorId),
      data: buildBalancePayload(aggregate),
    });
  });

  balanceDocs.forEach((docSnap) => {
    if (aggregateIds.has(docSnap.id)) return;
    operations.push({
      type: "delete",
      ref: docSnap.ref,
    });
  });

  const totals = {
    vendorsFromLedger: aggregates.size,
    existingBalances: balanceDocs.length,
    balancesToSet: operations.filter((operation) => operation.type === "set").length,
    balancesToDelete: operations.filter((operation) => operation.type === "delete").length,
    ledgerEntries: ledgerDocs.length,
    skippedWithoutVendor,
  };

  console.log("[summary]", JSON.stringify(totals, null, 2));

  if (options.verbose) {
    Array.from(aggregates.values())
      .sort((left, right) => right.pendingNetAmount - left.pendingNetAmount)
      .forEach((aggregate) => {
        console.log(
          `[vendor] ${aggregate.vendorId} | pending=${aggregate.pendingNetAmount} | paid=${aggregate.paidNetAmount} | lifetime=${aggregate.lifetimeNetAmount}`
        );
      });
  }

  if (!options.apply) {
    console.log(
      `[dry-run] no changes written. Existing balances seen: ${existingBalanceIds.size}`
    );
    return;
  }

  await writeBatches(operations);
  console.log("[done] vendor_balances rebuilt from vendor_ledger");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[error] rebuild vendor_balances failed");
    console.error(error);
    process.exit(1);
  });
