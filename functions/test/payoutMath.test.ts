import * as admin from "firebase-admin";
import {
  PLATFORM_COMMISSION_RATE,
  OrderSnapshotMinimal,
  buildLedgerEntryId,
  computeVendorLedger,
  isOrderEligibleForVendorPayout,
  roundMoney,
} from "../src/payoutMath";

const deliveredAt = admin.firestore.Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));

const buildSnapshot = (items: OrderSnapshotMinimal["items"]): OrderSnapshotMinimal => ({
  items,
  total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
  currency: "GNF",
  deliveredAt,
});

describe("roundMoney", () => {
  it("arrondit au centime", () => {
    expect(roundMoney(19.999)).toBe(20);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1234.5678)).toBe(1234.57);
  });

  it("retombe sur 0 pour une valeur non numerique", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
  });
});

describe("isOrderEligibleForVendorPayout", () => {
  it("refuse une commande non payee", () => {
    const result = isOrderEligibleForVendorPayout({ payed: false, delivered: true });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("order_not_paid");
  });

  it("refuse une commande non livree", () => {
    const result = isOrderEligibleForVendorPayout({ payed: true, delivered: false });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("order_not_delivered");
  });

  it("refuse une fausse commande (fakeOrder)", () => {
    const result = isOrderEligibleForVendorPayout({
      payed: true,
      delivered: true,
      fakeOrder: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("order_marked_fake");
  });

  it("accepte une commande payee, livree et non fictive", () => {
    const result = isOrderEligibleForVendorPayout({ payed: true, delivered: true });
    expect(result.eligible).toBe(true);
  });
});

describe("computeVendorLedger", () => {
  it("ne genere aucune entree pour une commande non eligible", () => {
    const snapshot = buildSnapshot([
      { title: "Produit A", qty: 1, price: 1000, vendorId: "v1" },
    ]);
    const result = computeVendorLedger("order1", { payed: false, delivered: true }, snapshot);
    expect(result.eligible).toBe(false);
    expect(result.entries).toHaveLength(0);
  });

  it("calcule la commission a 5% et le net = brut - commission", () => {
    const snapshot = buildSnapshot([
      { title: "Produit A", qty: 2, price: 10000, vendorId: "v1", vendorName: "Vendeur 1" },
    ]);
    const result = computeVendorLedger(
      "order1",
      { payed: true, delivered: true },
      snapshot
    );

    expect(result.eligible).toBe(true);
    expect(result.entries).toHaveLength(1);

    const [entry] = result.entries;
    expect(entry.grossAmount).toBe(20000);
    expect(entry.commissionRate).toBe(PLATFORM_COMMISSION_RATE);
    expect(entry.commissionAmount).toBe(1000);
    expect(entry.netAmount).toBe(19000);
    // Invariant comptable: le brut doit toujours se repartir exactement
    // entre commission et net, sans perte ni gain d'arrondi.
    expect(roundMoney(entry.commissionAmount + entry.netAmount)).toBe(entry.grossAmount);
  });

  it("agrege correctement les totaux sur plusieurs lignes du meme vendeur", () => {
    const snapshot = buildSnapshot([
      { title: "Produit A", qty: 1, price: 10000, vendorId: "v1" },
      { title: "Produit B", qty: 3, price: 5000, vendorId: "v1" },
    ]);
    const result = computeVendorLedger("order1", { payed: true, delivered: true }, snapshot);

    expect(result.entries).toHaveLength(2);
    expect(result.totals.grossAmount).toBe(25000);
    expect(result.totals.commissionAmount).toBe(1250);
    expect(result.totals.netAmount).toBe(23750);
  });

  it("classe en missingVendorItems une ligne sans vendorId, sans la compter dans entries", () => {
    const snapshot = buildSnapshot([
      { title: "Produit orphelin", qty: 1, price: 5000 },
    ]);
    const result = computeVendorLedger("order1", { payed: true, delivered: true }, snapshot);

    expect(result.entries).toHaveLength(0);
    expect(result.missingVendorItems).toHaveLength(1);
    expect(result.missingVendorItems[0].title).toBe("Produit orphelin");
    // Le montant reste comptabilise dans les totaux globaux de la commande,
    // meme s'il n'est affecte a aucun vendeur.
    expect(result.totals.grossAmount).toBe(5000);
  });

  it("ignore une ligne a montant nul ou negatif", () => {
    const snapshot = buildSnapshot([
      { title: "Produit gratuit", qty: 1, price: 0, vendorId: "v1" },
      { title: "Produit valide", qty: 1, price: 1000, vendorId: "v1" },
    ]);
    const result = computeVendorLedger("order1", { payed: true, delivered: true }, snapshot);

    expect(result.entries).toHaveLength(1);
    expect(result.totals.grossAmount).toBe(1000);
  });
});

describe("buildLedgerEntryId", () => {
  it("est deterministe pour les memes entrees", () => {
    const id1 = buildLedgerEntryId("order1", 0, "vendorA", "prodX");
    const id2 = buildLedgerEntryId("order1", 0, "vendorA", "prodX");
    expect(id1).toBe(id2);
    expect(id1.startsWith("vled_")).toBe(true);
  });

  it("differe si l'une des entrees change", () => {
    const base = buildLedgerEntryId("order1", 0, "vendorA", "prodX");
    expect(buildLedgerEntryId("order2", 0, "vendorA", "prodX")).not.toBe(base);
    expect(buildLedgerEntryId("order1", 1, "vendorA", "prodX")).not.toBe(base);
    expect(buildLedgerEntryId("order1", 0, "vendorB", "prodX")).not.toBe(base);
  });
});
