import "./vendorPayouts.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db, functions } from "../../firebase";
import { resolveVendorAccountState } from "../../utils/vendorStatus";

const settleVendorPayoutCallable = httpsCallable(functions, "settleVendorPayout");
const deletePendingVendorPayoutEntriesCallable = httpsCallable(
  functions,
  "deletePendingVendorPayoutEntries"
);
const VENDOR_PAYOUT_NOTIFY_EMAIL = "infos@monmarchegn.com";

const vendorIdLookupFields = [
  "vendorId",
  "uid",
  "userId",
  "ownerId",
  "profile.uid",
  "profile.vendorId",
];

const dataGridFrLocaleText = {
  noRowsLabel: "Aucune ligne",
  noResultsOverlayLabel: "Aucun résultat",
  errorOverlayDefaultLabel: "Une erreur est survenue.",
  footerRowSelected: (count) =>
    count > 1 ? `${count.toLocaleString()} lignes sélectionnées` : `${count.toLocaleString()} ligne sélectionnée`,
  footerTotalRows: "Total lignes:",
  MuiTablePagination: {
    labelRowsPerPage: "Lignes par page",
    labelDisplayedRows: ({ from, to, count }) =>
      `${from}-${to} sur ${count !== -1 ? count : `plus de ${to}`}`,
  },
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickVendorLogo = (data) => {
  const candidates = [
    data?.profile?.logo,
    data?.profile?.company?.logoUrl,
    data?.company?.logoUrl,
    data?.logo,
    data?.companyLogo,
    data?.image,
    Array.isArray(data?.images) ? data.images[0] : null,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim() : "";
};

const pickVendorName = (data) => {
  const candidates = [
    data?.vendorName,
    data?.displayName,
    data?.profile?.displayName,
    data?.profile?.company?.name,
    data?.company?.name,
    data?.companyName,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim() : "";
};

const pickVendorEmail = (data) => {
  const candidates = [
    data?.company?.email,
    data?.email,
    data?.contactEmail,
    data?.profile?.email,
    data?.profile?.company?.email,
    data?.company?.contact?.email,
    data?.contact?.email,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim().toLowerCase() : "";
};

const pickOrderDisplayId = (data) => {
  const candidates = [
    data?.orderId,
    data?.orderNumber,
    data?.invoiceNumber,
    data?.invoiceId,
    data?.noFacture,
    data?.number,
    data?.orderSnapshot?.orderId,
    data?.orderSnapshot?.orderNumber,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim() : "";
};

const findVendorByKnownId = async (collectionName, vendorId) => {
  const cleanVendorId =
    typeof vendorId === "string" && vendorId.trim() ? vendorId.trim() : "";
  if (!cleanVendorId) return null;

  const directSnap = await getDoc(doc(db, collectionName, cleanVendorId));
  if (directSnap.exists()) {
    return { id: directSnap.id, ...(directSnap.data() || {}) };
  }

  for (const field of vendorIdLookupFields) {
    const fallbackQuery = query(
      collection(db, collectionName),
      where(field, "==", cleanVendorId),
      limit(1)
    );
    const fallbackSnap = await getDocs(fallbackQuery);
    if (!fallbackSnap.empty) {
      const docSnap = fallbackSnap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() || {}) };
    }
  }

  return null;
};

const pickProductImage = (data) => {
  const candidates = [
    data?.img,
    data?.image,
    Array.isArray(data?.images) ? data.images[0] : null,
    data?.media?.cover,
    data?.core?.media?.cover,
    data?.draft?.core?.media?.cover,
  ];
  const hit = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );
  return hit ? hit.trim() : "";
};

const getInitials = (name = "") => {
  const clean = String(name || "").trim();
  if (!clean) return "V";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const formatDateTime = (value) => {
  if (!value) return "—";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString("fr-FR");
  }
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("fr-FR");
};

const formatCurrency = (value, currency = "GNF") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatCurrency(0, currency);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(amount);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildPayoutOrderGroups = (entries) => {
  const groups = new Map();
  entries.forEach((entry) => {
    const orderKey =
      (typeof entry?.orderId === "string" && entry.orderId.trim()) ||
      "unknown_order";
    const orderLabel =
      (typeof entry?.orderDisplayId === "string" && entry.orderDisplayId.trim()) ||
      orderKey;
    const current = groups.get(orderKey) || {
      orderLabel,
      grossAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      items: [],
    };
    current.grossAmount += toNumber(entry?.grossAmount);
    current.commissionAmount += toNumber(entry?.commissionAmount);
    current.netAmount += toNumber(entry?.netAmount);
    current.items.push(entry);
    groups.set(orderKey, current);
  });
  return Array.from(groups.values()).sort((left, right) =>
    left.orderLabel.localeCompare(right.orderLabel, "fr")
  );
};

const sendVendorPayoutEmails = async ({
  vendorId,
  vendorName,
  vendorEmail,
  entries,
  batchId,
  currency,
  totals,
}) => {
  const mailCollection = collection(db, "mail");
  const paidAtText = new Date().toLocaleString("fr-FR");
  const orderGroups = buildPayoutOrderGroups(entries);

  const orderSectionsHtml = orderGroups
    .map((group) => {
      const itemsHtml = group.items
        .map(
          (item) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(item.title || "Produit")}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${toNumber(item.qty)}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${escapeHtml(
                formatCurrency(toNumber(item.grossAmount), item.currency || currency)
              )}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${escapeHtml(
                formatCurrency(toNumber(item.netAmount), item.currency || currency)
              )}</td>
            </tr>
          `
        )
        .join("");

      return `
        <div style="margin-top:24px">
          <h3 style="margin:0 0 8px;font-size:16px;color:#111827">Commande ${escapeHtml(
            group.orderLabel
          )}</h3>
          <p style="margin:0 0 12px;color:#4b5563;font-size:14px">
            Brut ${escapeHtml(formatCurrency(group.grossAmount, currency))} |
            Commission ${escapeHtml(formatCurrency(group.commissionAmount, currency))} |
            Net ${escapeHtml(formatCurrency(group.netAmount, currency))}
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

  const vendorText = [
    `Bonjour ${vendorName},`,
    "",
    `Votre paiement vendeur a ete effectue le ${paidAtText}.`,
    `Batch: ${batchId}`,
    `Commandes reglees: ${orderGroups.length}`,
    `Produits/lignes regles: ${toNumber(totals.count)}`,
    `Montant brut: ${formatCurrency(toNumber(totals.gross), currency)}`,
    `Commission: ${formatCurrency(toNumber(totals.commission), currency)}`,
    `Net verse: ${formatCurrency(toNumber(totals.net), currency)}`,
    "",
    "Detail des commandes et produits vendus:",
    ...orderGroups.flatMap((group) => [
      `- Commande ${group.orderLabel}: brut ${formatCurrency(
        group.grossAmount,
        currency
      )}, commission ${formatCurrency(
        group.commissionAmount,
        currency
      )}, net ${formatCurrency(group.netAmount, currency)}`,
      ...group.items.map(
        (item) =>
          `  - ${item.title || "Produit"} x${toNumber(item.qty)} | brut ${formatCurrency(
            toNumber(item.grossAmount),
            item.currency || currency
          )} | net ${formatCurrency(
            toNumber(item.netAmount),
            item.currency || currency
          )}`
      ),
    ]),
  ].join("\n");

  const vendorHtml = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Paiement vendeur effectué - Monmarché</title></head>
    <body style="margin:0;padding:24px;background:#f9fafb;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#111827">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="padding:18px 24px;background:#111827;color:#ffffff">
          <h1 style="margin:0;font-size:22px">Paiement vendeur effectué</h1>
        </div>
        <div style="padding:24px">
          <p style="margin-top:0">Bonjour <strong>${escapeHtml(vendorName)}</strong>,</p>
          <p>Votre paiement vendeur a été effectué le <strong>${escapeHtml(
            paidAtText
          )}</strong>.</p>
          <div style="padding:16px;background:#f3f4f6;border-radius:10px">
            <p style="margin:0 0 8px"><strong>Batch :</strong> ${escapeHtml(batchId)}</p>
            <p style="margin:0 0 8px"><strong>Commandes réglées :</strong> ${orderGroups.length}</p>
            <p style="margin:0 0 8px"><strong>Lignes réglées :</strong> ${toNumber(
              totals.count
            )}</p>
            <p style="margin:0 0 8px"><strong>Montant brut :</strong> ${escapeHtml(
              formatCurrency(toNumber(totals.gross), currency)
            )}</p>
            <p style="margin:0 0 8px"><strong>Commission :</strong> ${escapeHtml(
              formatCurrency(toNumber(totals.commission), currency)
            )}</p>
            <p style="margin:0"><strong>Net versé :</strong> ${escapeHtml(
              formatCurrency(toNumber(totals.net), currency)
            )}</p>
          </div>
          ${orderSectionsHtml}
          <p style="margin:24px 0 0;color:#4b5563">Merci,<br />Equipe Monmarché</p>
        </div>
      </div>
    </body></html>`;

  const adminText = [
    "Notification admin de paiement vendeur.",
    "",
    `Vendeur: ${vendorName}`,
    `Vendor ID: ${vendorId}`,
    `Email vendeur: ${vendorEmail || "-"}`,
    `Paiement effectue le: ${paidAtText}`,
    `Batch: ${batchId}`,
    `Commandes reglees: ${orderGroups.length}`,
    `Produits/lignes regles: ${toNumber(totals.count)}`,
    `Montant brut: ${formatCurrency(toNumber(totals.gross), currency)}`,
    `Commission: ${formatCurrency(toNumber(totals.commission), currency)}`,
    `Net verse: ${formatCurrency(toNumber(totals.net), currency)}`,
    "",
    "Detail des commandes et produits vendus:",
    ...orderGroups.flatMap((group) => [
      `- Commande ${group.orderLabel}: brut ${formatCurrency(
        group.grossAmount,
        currency
      )}, commission ${formatCurrency(
        group.commissionAmount,
        currency
      )}, net ${formatCurrency(group.netAmount, currency)}`,
      ...group.items.map(
        (item) =>
          `  - ${item.title || "Produit"} x${toNumber(item.qty)} | brut ${formatCurrency(
            toNumber(item.grossAmount),
            item.currency || currency
          )} | net ${formatCurrency(
            toNumber(item.netAmount),
            item.currency || currency
          )}`
      ),
    ]),
  ].join("\n");

  const adminHtml = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Paiement vendeur (admin) - Monmarché</title></head>
    <body style="margin:0;padding:24px;background:#f9fafb;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#111827">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="padding:18px 24px;background:#111827;color:#ffffff">
          <h1 style="margin:0;font-size:22px">Notification admin paiement vendeur</h1>
        </div>
        <div style="padding:24px">
          <p style="margin-top:0"><strong>Vendeur :</strong> ${escapeHtml(vendorName)}</p>
          <p><strong>Vendor ID :</strong> ${escapeHtml(vendorId)}</p>
          <p><strong>Email vendeur :</strong> ${escapeHtml(vendorEmail || "-")}</p>
          <p><strong>Paiement effectué le :</strong> ${escapeHtml(paidAtText)}</p>
          <div style="padding:16px;background:#f3f4f6;border-radius:10px">
            <p style="margin:0 0 8px"><strong>Batch :</strong> ${escapeHtml(batchId)}</p>
            <p style="margin:0 0 8px"><strong>Commandes réglées :</strong> ${orderGroups.length}</p>
            <p style="margin:0 0 8px"><strong>Lignes réglées :</strong> ${toNumber(
              totals.count
            )}</p>
            <p style="margin:0 0 8px"><strong>Montant brut :</strong> ${escapeHtml(
              formatCurrency(toNumber(totals.gross), currency)
            )}</p>
            <p style="margin:0 0 8px"><strong>Commission :</strong> ${escapeHtml(
              formatCurrency(toNumber(totals.commission), currency)
            )}</p>
            <p style="margin:0"><strong>Net versé :</strong> ${escapeHtml(
              formatCurrency(toNumber(totals.net), currency)
            )}</p>
          </div>
          ${orderSectionsHtml}
        </div>
      </div>
    </body></html>`;

  const mailWrites = [
    addDoc(mailCollection, {
      to: VENDOR_PAYOUT_NOTIFY_EMAIL,
      message: {
        subject: `Paiement vendeur effectué - ${vendorName}`,
        text: adminText,
        html: adminHtml,
      },
    }),
  ];

  if (vendorEmail) {
    mailWrites.push(
      addDoc(mailCollection, {
        to: vendorEmail,
        message: {
          subject: "Paiement effectué pour vos ventes Monmarché",
          text: vendorText,
          html: vendorHtml,
        },
      })
    );
  }

  await Promise.all(mailWrites);
  return { vendorQueued: Boolean(vendorEmail), adminQueued: true };
};

const csvEscape = (value) => {
  const raw = value === undefined || value === null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const preserveSpreadsheetText = (value) => {
  const raw = value === undefined || value === null ? "" : String(value).trim();
  if (!raw) return "";
  return `="${raw.replace(/"/g, '""')}"`;
};

const formatFileDate = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sanitizeFilePart = (value, fallback) => {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
};

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const VendorPayoutDetails = () => {
  const navigate = useNavigate();
  const { vendorId } = useParams();

  const [balance, setBalance] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [deletedVendorData, setDeletedVendorData] = useState(null);
  const [vendorLabel, setVendorLabel] = useState("");
  const [vendorLogo, setVendorLogo] = useState("");
  const [entries, setEntries] = useState([]);
  const [payoutBatches, setPayoutBatches] = useState([]);
  const [productImagesById, setProductImagesById] = useState({});
  const [orderLabelsById, setOrderLabelsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionModel, setSelectionModel] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [pendingPayoutEntries, setPendingPayoutEntries] = useState([]);
  const [forceSensitivePayout, setForceSensitivePayout] = useState(false);
  const [sensitivePayoutReason, setSensitivePayoutReason] = useState("");
  const [pendingDeletionEntries, setPendingDeletionEntries] = useState([]);
  const [deleteEntriesReason, setDeleteEntriesReason] = useState("");
  const [imagePreview, setImagePreview] = useState({
    url: "",
    alt: "",
  });

  const closeImagePreview = useCallback(() => {
    setImagePreview({ url: "", alt: "" });
  }, []);

  const openImagePreview = useCallback((url, alt) => {
    if (typeof url !== "string" || !url.trim()) return;
    setImagePreview({
      url: url.trim(),
      alt: typeof alt === "string" && alt.trim() ? alt.trim() : "Aperçu image",
    });
  }, []);

  useEffect(() => {
    if (!imagePreview.url) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeImagePreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imagePreview.url, closeImagePreview]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const unsub = onSnapshot(
      doc(db, "vendor_balances", vendorId),
      (snap) => {
        if (!snap.exists()) {
          setBalance(null);
          return;
        }
        setBalance({ id: snap.id, ...(snap.data() || {}) });
      },
      (error) => {
        console.error("Erreur lecture vendor_balances:", error);
        setBalance(null);
      }
    );

    return () => unsub();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    let cancelled = false;
    const loadVendor = async () => {
      try {
        const data = await findVendorByKnownId("vendors", vendorId);
        if (cancelled) return;
        if (!data) {
          setVendorData(null);
          setVendorLabel("");
          setVendorLogo("");
          return;
        }
        setVendorData(data);
        setVendorLogo(pickVendorLogo(data));
        setVendorLabel(pickVendorName(data));
      } catch (error) {
        if (cancelled) return;
        console.error("Erreur lecture vendors:", error);
        setVendorData(null);
        setVendorLabel("");
        setVendorLogo("");
      }
    };
    loadVendor();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    let cancelled = false;
    const loadDeletedVendor = async () => {
      try {
        const data = await findVendorByKnownId("deletedVendors", vendorId);
        if (!cancelled) {
          setDeletedVendorData(data);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Erreur lecture deletedVendors:", error);
        setDeletedVendorData(null);
      }
    };
    loadDeletedVendor();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const ledgerQuery = query(
      collection(db, "vendor_ledger"),
      where("vendorId", "==", vendorId)
    );
    const unsub = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            vendorId: data.vendorId || vendorId || "",
            orderId: data.orderId || "—",
            title: data.title || "—",
            productId: data.productId || "—",
            vendorName: data.vendorName || "",
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
          };
        });

        list.sort(
          (a, b) =>
            toMillis(b.deliveredAt) - toMillis(a.deliveredAt) ||
            toMillis(b.createdAt) - toMillis(a.createdAt)
        );
        setEntries(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lecture vendor_ledger:", error);
        setEntries([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const batchesQuery = query(
      collection(db, "vendor_payout_batches"),
      where("vendorId", "==", vendorId)
    );
    const unsub = onSnapshot(
      batchesQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            batchId: data.batchId || docSnap.id,
            status: data.status || "completed",
            grossAmount: toNumber(data.grossAmount),
            commissionAmount: toNumber(data.commissionAmount),
            netAmount: toNumber(data.netAmount),
            paidEntriesCount: toNumber(data.paidEntriesCount),
            currency: data.currency || "GNF",
            createdAt: data.createdAt || null,
            completedAt: data.completedAt || null,
            createdByLabel:
              data.createdByLabel ||
              data.createdByEmail ||
              data.createdByUid ||
              "admin",
          };
        });
        list.sort(
          (a, b) =>
            toMillis(b.completedAt || b.createdAt) -
            toMillis(a.completedAt || a.createdAt)
        );
        setPayoutBatches(list);
      },
      (error) => {
        console.error("Erreur lecture vendor_payout_batches:", error);
        setPayoutBatches([]);
      }
    );
    return () => unsub();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const productIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.productId)
          .filter(
            (value) => typeof value === "string" && value.trim() && value !== "—"
          )
      )
    );

    if (!productIds.length) {
      setProductImagesById({});
      return undefined;
    }

    let cancelled = false;
    const loadProductImages = async () => {
      const nextMap = {};

      await Promise.all(
        productIds.map(async (productId) => {
          const refs = [
            doc(db, "vendor_products", vendorId, "products", productId),
            doc(db, "vendor_products", productId),
            doc(db, "products", productId),
            doc(db, "products_public", productId),
          ];

          for (const ref of refs) {
            try {
              const snap = await getDoc(ref);
              if (!snap.exists()) continue;
              const image = pickProductImage(snap.data() || {});
              if (image) {
                nextMap[productId] = image;
                break;
              }
            } catch (error) {
              // Non bloquant: on tente le prochain fallback.
            }
          }
        })
      );

      if (!cancelled) {
        setProductImagesById(nextMap);
      }
    };

    loadProductImages();
    return () => {
      cancelled = true;
    };
  }, [entries, vendorId]);

  useEffect(() => {
    const orderIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.orderId)
          .filter(
            (value) => typeof value === "string" && value.trim() && value !== "—"
          )
      )
    );

    if (!orderIds.length) {
      setOrderLabelsById({});
      return undefined;
    }

    let cancelled = false;
    const loadOrderLabels = async () => {
      const nextMap = {};

      await Promise.all(
        orderIds.map(async (orderDocId) => {
          const refs = [
            doc(db, "archivedOrders", orderDocId),
            doc(db, "orders", orderDocId),
          ];

          for (const ref of refs) {
            try {
              const snap = await getDoc(ref);
              if (!snap.exists()) continue;
              const label = pickOrderDisplayId(snap.data() || {});
              if (label) {
                nextMap[orderDocId] = label;
                break;
              }
            } catch (error) {
              // Non bloquant: on tente le prochain fallback.
            }
          }
        })
      );

      if (!cancelled) {
        setOrderLabelsById(nextMap);
      }
    };

    loadOrderLabels();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const rowsWithOrderLabels = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        orderDisplayId: orderLabelsById[entry.orderId] || entry.orderId,
      })),
    [entries, orderLabelsById]
  );

  const filteredRows = useMemo(() => {
    return rowsWithOrderLabels.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const candidates = [row.orderDisplayId, row.orderId, row.title, row.productId];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [rowsWithOrderLabels, normalizedSearch, statusFilter]);

  const rowsById = useMemo(() => {
    const map = new Map();
    rowsWithOrderLabels.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [rowsWithOrderLabels]);

  const selectedPendingEntries = useMemo(
    () =>
      selectionModel
        .map((id) => rowsById.get(id))
        .filter((entry) => entry && entry.status === "pending"),
    [rowsById, selectionModel]
  );

  const summary = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.gross += row.grossAmount;
          acc.commission += row.commissionAmount;
          acc.net += row.netAmount;
          acc.count += 1;
          return acc;
        },
        { gross: 0, commission: 0, net: 0, count: 0 }
      ),
    [filteredRows]
  );

  const payoutConfirmationSummary = useMemo(
    () =>
      pendingPayoutEntries.reduce(
        (acc, row) => {
          acc.gross += row.grossAmount;
          acc.commission += row.commissionAmount;
          acc.net += row.netAmount;
          acc.count += 1;
          if (!acc.currency && row.currency) acc.currency = row.currency;
          return acc;
        },
        { gross: 0, commission: 0, net: 0, count: 0, currency: "GNF" }
      ),
    [pendingPayoutEntries]
  );

  const vendorAccount = useMemo(
    () => resolveVendorAccountState(vendorData, deletedVendorData),
    [vendorData, deletedVendorData]
  );

  const payoutRequiresReview = Boolean(vendorAccount?.requiresPayoutReview);

  const requestSettleEntries = (entriesToSettle) => {
    if (!vendorId || !entriesToSettle.length || isProcessing) return;
    setActionError("");
    setActionFeedback("");
    setForceSensitivePayout(false);
    setSensitivePayoutReason("");
    setPendingPayoutEntries(entriesToSettle);
  };

  const closePayoutConfirmation = () => {
    if (isProcessing) return;
    setPendingPayoutEntries([]);
    setForceSensitivePayout(false);
    setSensitivePayoutReason("");
  };

  const requestDeleteEntries = (entriesToDelete) => {
    if (!vendorId || !entriesToDelete.length || isProcessing) return;
    setActionError("");
    setActionFeedback("");
    setDeleteEntriesReason("");
    setPendingDeletionEntries(entriesToDelete);
  };

  const closeDeleteEntriesConfirmation = () => {
    if (isProcessing) return;
    setPendingDeletionEntries([]);
    setDeleteEntriesReason("");
  };

  const confirmSettleEntries = async () => {
    if (!vendorId || !pendingPayoutEntries.length || isProcessing) return;

    setActionError("");
    setActionFeedback("");

    const forceReason = sensitivePayoutReason.trim();
    if (payoutRequiresReview && (!forceSensitivePayout || !forceReason)) {
      setActionError(
        "Ce vendeur nécessite un contrôle. Coche la validation exceptionnelle et indique un motif avant de payer."
      );
      return;
    }

    setIsProcessing(true);
    try {
      const settledEntries = [...pendingPayoutEntries];
      const vendorSource = vendorData || deletedVendorData || null;
      const vendorName =
        pickVendorName(vendorSource) ||
        displayVendorName ||
        vendorId ||
        "Boutique";
      const vendorEmail = pickVendorEmail(vendorSource);
      const result = await settleVendorPayoutCallable({
        vendorId,
        entryIds: settledEntries.map((entry) => entry.id),
        forceSensitiveVendor: payoutRequiresReview ? true : false,
        forceReason: payoutRequiresReview ? forceReason : "",
      });
      const data = result.data || {};
      const paidCount = toNumber(data.entriesCount);
      const netAmount = toNumber(data.netAmount);
      const payoutCurrency =
        data.currency ||
        settledEntries.find((entry) => entry?.currency)?.currency ||
        "GNF";
      let mailFeedback = "";

      try {
        const mailResult = await sendVendorPayoutEmails({
          vendorId,
          vendorName,
          vendorEmail,
          entries: settledEntries,
          batchId: data.batchId || `manual_${Date.now()}`,
          currency: payoutCurrency,
          totals: {
            count: paidCount,
            gross: settledEntries.reduce(
              (sum, entry) => sum + toNumber(entry.grossAmount),
              0
            ),
            commission: settledEntries.reduce(
              (sum, entry) => sum + toNumber(entry.commissionAmount),
              0
            ),
            net: netAmount,
          },
        });
        mailFeedback = mailResult.vendorQueued
          ? " Emails vendeur et admin envoyés."
          : " Email admin envoyé.";
      } catch (mailError) {
        console.error("Erreur envoi emails paiement vendeur:", mailError);
        mailFeedback = " Paiement effectué, mais l'envoi des emails a échoué.";
      }

      setSelectionModel([]);
      setPendingPayoutEntries([]);
      setForceSensitivePayout(false);
      setSensitivePayoutReason("");
      setActionFeedback(
        `${paidCount} ligne(s) marquée(s) comme payée(s), total ${formatCurrency(
          netAmount,
          payoutCurrency
        )}.${mailFeedback}`
      );
    } catch (error) {
      console.error("Erreur paiement vendeur:", error);
      const message =
        typeof error?.message === "string" && error.message.trim()
          ? error.message.trim()
          : "Impossible de marquer ces lignes comme payées.";
      setActionError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettleSelected = async () => {
    if (!selectedPendingEntries.length) {
      setActionError("Sélectionne au moins une ligne en attente.");
      return;
    }
    requestSettleEntries(selectedPendingEntries);
  };

  const handleSettleAllFilteredPending = async () => {
    const pendingEntries = filteredRows.filter((row) => row.status === "pending");
    if (!pendingEntries.length) {
      setActionError("Aucune ligne en attente dans le filtre actuel.");
      return;
    }
    requestSettleEntries(pendingEntries);
  };

  const confirmDeleteEntries = async () => {
    if (!vendorId || !pendingDeletionEntries.length || isProcessing) return;

    setActionError("");
    setActionFeedback("");
    setIsProcessing(true);

    try {
      const entriesToDelete = [...pendingDeletionEntries];
      const result = await deletePendingVendorPayoutEntriesCallable({
        vendorId,
        entryIds: entriesToDelete.map((entry) => entry.id),
        reason: deleteEntriesReason.trim(),
      });
      const data = result.data || {};
      const deletedCount = toNumber(data.entriesCount);
      const netAmount = toNumber(data.netAmount);
      const payoutCurrency =
        data.currency ||
        entriesToDelete.find((entry) => entry?.currency)?.currency ||
        "GNF";

      setPendingDeletionEntries([]);
      setDeleteEntriesReason("");
      setSelectionModel([]);
      setActionFeedback(
        `${deletedCount} ligne(s) supprimée(s), total ${formatCurrency(
          netAmount,
          payoutCurrency
        )}. Email admin envoyé.`
      );
    } catch (error) {
      console.error("Erreur suppression paiement vendeur:", error);
      const message =
        typeof error?.message === "string" && error.message.trim()
          ? error.message.trim()
          : "Impossible de supprimer ce paiement.";
      setActionError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelectedPending = async () => {
    if (!selectedPendingEntries.length) {
      setActionError("Sélectionne au moins une ligne en attente à supprimer.");
      return;
    }
    requestDeleteEntries(selectedPendingEntries);
  };

  const handleExportFilteredCsv = () => {
    if (!filteredRows.length) {
      setActionError("Aucune ligne à exporter dans le filtre actuel.");
      return;
    }
    const rows = [
      [
        "Commande",
        "Produit",
        "Produit ID",
        "Quantité",
        "Brut",
        "Commission",
        "Net vendeur",
        "Devise",
        "Statut",
        "Livré le",
        "Payé le",
      ],
      ...filteredRows.map((row) => [
        preserveSpreadsheetText(row.orderDisplayId || row.orderId),
        row.title,
        row.productId,
        row.qty,
        row.grossAmount,
        row.commissionAmount,
        row.netAmount,
        row.currency,
        row.status,
        formatDateTime(row.deliveredAt),
        formatDateTime(row.paidAt),
      ]),
    ];
    const vendorPart = sanitizeFilePart(
      displayVendorName || vendorLabel || vendorId || "vendeur",
      "vendeur"
    );
    const paymentDatePart = formatFileDate(new Date());
    downloadCsv(`paiements_${vendorPart}_${paymentDatePart}.csv`, rows);
    setActionError("");
    setActionFeedback(`${filteredRows.length} ligne(s) exportée(s) en CSV.`);
  };

  const handleCopyOrderId = useCallback(async (orderLabel) => {
    const value = typeof orderLabel === "string" ? orderLabel.trim() : "";
    if (!value || value === "—") return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("input");
        input.value = value;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setActionError("");
      setActionFeedback(`ID commande copié: ${value}`);
    } catch (error) {
      console.error("Erreur copie ID commande:", error);
      setActionError("Impossible de copier l'ID commande.");
    }
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "orderDisplayId",
        headerName: "Commande",
        minWidth: 360,
        flex: 1.4,
        renderCell: (params) => {
          const orderId = params.row.orderId || "—";
          const orderLabel = params.row.orderDisplayId || orderId;
          return (
            <div className="vendorPayouts__orderIdCell">
              <span className="vendorPayouts__orderIdValue" title={`UID: ${orderId}`}>
                {orderLabel}
              </span>
              <button
                type="button"
                className="vendorPayouts__copyBtn"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCopyOrderId(orderLabel);
                }}
                title="Copier le numero de commande"
              >
                Copier
              </button>
            </div>
          );
        },
      },
      {
        field: "productImage",
        headerName: "Photo",
        width: 90,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const productId = params.row.productId;
          const imageUrl =
            (typeof productId === "string" && productImagesById[productId]) || "";
          if (imageUrl) {
            return (
              <div className="vendorPayouts__logoCell">
                <button
                  type="button"
                  className="vendorPayouts__thumbButton"
                  onClick={(event) => {
                    event.stopPropagation();
                    openImagePreview(imageUrl, `Produit ${params.row.title || ""}`);
                  }}
                  title="Voir l'image en grand"
                >
                  <img
                    src={imageUrl}
                    alt={`Produit ${params.row.title || ""}`}
                    className="vendorPayouts__productThumb"
                  />
                </button>
              </div>
            );
          }
          return (
            <div className="vendorPayouts__logoCell">
              <span className="vendorPayouts__logoFallback vendorPayouts__logoFallback--sm">
                {getInitials(params.row.title)}
              </span>
            </div>
          );
        },
      },
      { field: "title", headerName: "Produit", minWidth: 220, flex: 1 },
      { field: "productId", headerName: "Produit ID", minWidth: 150, flex: 0.8 },
      { field: "qty", headerName: "Qté", width: 90 },
      {
        field: "grossAmount",
        headerName: "Brut",
        minWidth: 140,
        flex: 0.7,
        valueGetter: (params) => formatCurrency(params.row.grossAmount, params.row.currency),
      },
      {
        field: "commissionAmount",
        headerName: "Commission",
        minWidth: 140,
        flex: 0.7,
        valueGetter: (params) =>
          formatCurrency(params.row.commissionAmount, params.row.currency),
      },
      {
        field: "netAmount",
        headerName: "Net vendeur",
        minWidth: 150,
        flex: 0.7,
        valueGetter: (params) => formatCurrency(params.row.netAmount, params.row.currency),
      },
      {
        field: "deliveredAt",
        headerName: "Livré le",
        minWidth: 170,
        flex: 0.7,
        valueGetter: (params) => formatDateTime(params.row.deliveredAt),
      },
      {
        field: "paidAt",
        headerName: "Payé le",
        minWidth: 170,
        flex: 0.7,
        valueGetter: (params) => formatDateTime(params.row.paidAt),
      },
      {
        field: "status",
        headerName: "Statut",
        width: 130,
        renderCell: (params) => (
          <span className={`statusChip statusChip--${params.value || "pending"}`}>
            {params.value === "paid"
              ? "Payé"
              : params.value === "reversed"
              ? "Annulé"
              : "En attente"}
          </span>
        ),
      },
    ],
    [productImagesById, handleCopyOrderId, openImagePreview]
  );

  const displayVendorName =
    vendorLabel ||
    pickVendorName(deletedVendorData) ||
    balance?.vendorName ||
    entries.find((entry) => entry.vendorName)?.vendorName ||
    "";

  const displayVendorLogo = vendorLogo || pickVendorLogo(deletedVendorData);
  const canConfirmPayout =
    !isProcessing &&
    (!payoutRequiresReview ||
      (forceSensitivePayout && sensitivePayoutReason.trim().length > 0));

  const deletionConfirmationSummary = useMemo(
    () =>
      pendingDeletionEntries.reduce(
        (acc, row) => {
          acc.gross += row.grossAmount;
          acc.commission += row.commissionAmount;
          acc.net += row.netAmount;
          acc.count += 1;
          if (!acc.currency && row.currency) acc.currency = row.currency;
          return acc;
        },
        { gross: 0, commission: 0, net: 0, count: 0, currency: "GNF" }
      ),
    [pendingDeletionEntries]
  );

  const canConfirmDeleteEntries = !isProcessing && pendingDeletionEntries.length > 0;

  return (
    <div className="vendorPayouts">
      <Sidebar />
      <div className="vendorPayoutsContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Détail paiement vendeur</div>

          <div className="vendorPayouts__heading">
            <div>
              <div className="vendorPayouts__vendorHeader">
                {displayVendorLogo ? (
                  <button
                    type="button"
                    className="vendorPayouts__logoButton"
                    onClick={() =>
                      openImagePreview(
                        displayVendorLogo,
                        `Logo ${displayVendorName || vendorId}`
                      )
                    }
                    title="Voir le logo en grand"
                  >
                    <img
                      src={displayVendorLogo}
                      alt={`Logo ${displayVendorName || vendorId}`}
                      className="vendorPayouts__vendorLogoLg"
                    />
                  </button>
                ) : (
                  <span className="vendorPayouts__logoFallback vendorPayouts__logoFallback--lg">
                    {getInitials(displayVendorName || vendorId)}
                  </span>
                )}
                <p className="vendorPayouts__subtitle">
                  {displayVendorName ? `${displayVendorName} - ` : ""}
                  <strong>{vendorId}</strong>
                </p>
                <span className={`statusChip statusChip--${vendorAccount.key}`}>
                  {vendorAccount.label}
                </span>
              </div>
            </div>
            <div className="vendorPayouts__headingActions">
              <Link to="/vendor-payouts" className="vendorPayouts__btn vendorPayouts__btn--light">
                Retour liste
              </Link>
              <button
                className="vendorPayouts__btn vendorPayouts__btn--primary"
                onClick={handleSettleSelected}
                disabled={isProcessing}
              >
                Payer sélection
              </button>
              <button
                className="vendorPayouts__btn vendorPayouts__btn--danger"
                onClick={handleDeleteSelectedPending}
                disabled={isProcessing || !selectedPendingEntries.length}
              >
                Supprimer sélection
              </button>
              <button
                className="vendorPayouts__btn vendorPayouts__btn--secondary"
                onClick={handleSettleAllFilteredPending}
                disabled={isProcessing}
              >
                Payer tout (filtre)
              </button>
              <button
                className="vendorPayouts__btn vendorPayouts__btn--light"
                onClick={handleExportFilteredCsv}
                disabled={!filteredRows.length}
              >
                Export CSV
              </button>
            </div>
          </div>

          {payoutRequiresReview ? (
            <div className="vendorPayouts__reviewBanner">
              <strong>Contrôle requis avant paiement.</strong>
              <span>{vendorAccount.description}</span>
              {vendorAccount.reason ? <span>Motif : {vendorAccount.reason}</span> : null}
              {vendorAccount.deletedAt ? (
                <span>Suppression : {formatDateTime(vendorAccount.deletedAt)}</span>
              ) : null}
            </div>
          ) : null}

          {(actionError || actionFeedback) && (
            <div
              className={`vendorPayouts__alert ${
                actionError ? "vendorPayouts__alert--error" : "vendorPayouts__alert--success"
              }`}
            >
              {actionError || actionFeedback}
            </div>
          )}

          <div className="vendorPayouts__summary">
            <div className="vendorPayouts__card">
              <span className="label">Net en attente (solde)</span>
              <strong>{formatCurrency(toNumber(balance?.pendingNetAmount))}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">Lignes en attente (solde)</span>
              <strong>{toNumber(balance?.pendingEntriesCount)}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">Net déjà payé</span>
              <strong>{formatCurrency(toNumber(balance?.paidNetAmount))}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">Net (filtre actuel)</span>
              <strong>{formatCurrency(summary.net)}</strong>
            </div>
          </div>

          <div className="vendorPayouts__toolbar">
            <select
              className="vendorPayouts__select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tous statuts</option>
              <option value="pending">En attente</option>
              <option value="paid">Payé</option>
              <option value="reversed">Annulé</option>
            </select>
            <input
              type="search"
              className="vendorPayouts__searchInput"
              placeholder="Rechercher commande / produit..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="vendorPayouts__meta">
            {filteredRows.length} ligne(s) affichée(s) -{" "}
            {selectedPendingEntries.length} ligne(s) pending sélectionnée(s)
          </div>

          <div className="vendorPayouts__gridWrapper">
            <DataGrid
              className="datagrid"
              rows={filteredRows}
              columns={columns}
              pagination
              pageSize={9}
              rowsPerPageOptions={[9, 25, 50]}
              checkboxSelection
              disableSelectionOnClick
              autoHeight
              loading={loading}
              selectionModel={selectionModel}
              localeText={dataGridFrLocaleText}
              onSelectionModelChange={(newSelection) => {
                setSelectionModel(Array.isArray(newSelection) ? newSelection : []);
              }}
              isRowSelectable={(params) => params.row.status === "pending"}
            />
          </div>

          <section className="vendorPayouts__history">
            <div className="vendorPayouts__historyHeader">
              <h2>Historique des paiements</h2>
              <span>{payoutBatches.length} lot(s) de paiement</span>
            </div>
            {payoutBatches.length ? (
              <div className="vendorPayouts__historyList">
                {payoutBatches.slice(0, 8).map((batch) => (
                  <div className="vendorPayouts__historyItem" key={batch.id}>
                    <div>
                      <strong>{formatCurrency(batch.netAmount, batch.currency)}</strong>
                      <span>{batch.paidEntriesCount} ligne(s)</span>
                    </div>
                    <div>
                      <span className={`statusChip statusChip--${batch.status || "completed"}`}>
                        {batch.status === "failed"
                          ? "Erreur"
                          : batch.status === "processing"
                          ? "En cours"
                          : "Payé"}
                      </span>
                      <span>{formatDateTime(batch.completedAt || batch.createdAt)}</span>
                      <span>{batch.createdByLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="vendorPayouts__emptyText">
                Aucun paiement enregistré pour ce vendeur.
              </p>
            )}
          </section>

          <div className="vendorPayouts__footer">
            <button className="vendorPayouts__btn vendorPayouts__btn--light" onClick={() => navigate(-1)}>
              Revenir en arrière
            </button>
          </div>
        </div>

        {pendingPayoutEntries.length > 0 ? (
          <div
            className="vendorPayouts__confirmOverlay"
            onClick={closePayoutConfirmation}
            role="presentation"
          >
            <div
              className="vendorPayouts__confirmModal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Confirmer le paiement vendeur"
            >
              <div className="vendorPayouts__confirmHeader">
                <div>
                  <h2>Confirmer le paiement vendeur</h2>
                  <p>
                    {displayVendorName ? `${displayVendorName} - ` : ""}
                    <strong>{vendorId}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="vendorPayouts__imageClose"
                  onClick={closePayoutConfirmation}
                  aria-label="Fermer la confirmation"
                  disabled={isProcessing}
                >
                  ×
                </button>
              </div>
              <div className="vendorPayouts__confirmGrid">
                <div className="vendorPayouts__confirmItem">
                  <span>Nombre de lignes</span>
                  <strong>{payoutConfirmationSummary.count}</strong>
                </div>
                <div className="vendorPayouts__confirmItem">
                  <span>Brut</span>
                  <strong>
                    {formatCurrency(
                      payoutConfirmationSummary.gross,
                      payoutConfirmationSummary.currency
                    )}
                  </strong>
                </div>
                <div className="vendorPayouts__confirmItem">
                  <span>Commission</span>
                  <strong>
                    {formatCurrency(
                      payoutConfirmationSummary.commission,
                      payoutConfirmationSummary.currency
                    )}
                  </strong>
                </div>
                <div className="vendorPayouts__confirmItem vendorPayouts__confirmItem--net">
                  <span>Net à payer</span>
                  <strong>
                    {formatCurrency(
                      payoutConfirmationSummary.net,
                      payoutConfirmationSummary.currency
                    )}
                  </strong>
                </div>
              </div>
              {payoutRequiresReview ? (
                <div className="vendorPayouts__sensitiveConfirm">
                  <div>
                    <strong>Paiement sensible</strong>
                    <p>
                      Compte vendeur : {vendorAccount.label}. {vendorAccount.description}
                    </p>
                    {vendorAccount.reason ? <p>Motif existant : {vendorAccount.reason}</p> : null}
                  </div>
                  <label className="vendorPayouts__toggle">
                    <input
                      type="checkbox"
                      checked={forceSensitivePayout}
                      onChange={(event) => setForceSensitivePayout(event.target.checked)}
                      disabled={isProcessing}
                    />
                    <span>Je valide ce paiement exceptionnel</span>
                  </label>
                  <textarea
                    className="vendorPayouts__reasonInput"
                    value={sensitivePayoutReason}
                    onChange={(event) => setSensitivePayoutReason(event.target.value)}
                    placeholder="Motif du paiement malgré ce statut vendeur..."
                    disabled={isProcessing}
                  />
                </div>
              ) : null}
              <div className="vendorPayouts__confirmActions">
                <button
                  type="button"
                  className="vendorPayouts__btn vendorPayouts__btn--light"
                  onClick={closePayoutConfirmation}
                  disabled={isProcessing}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="vendorPayouts__btn vendorPayouts__btn--primary"
                  onClick={confirmSettleEntries}
                  disabled={!canConfirmPayout}
                >
                  {isProcessing ? "Paiement en cours..." : "Confirmer le paiement"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pendingDeletionEntries.length > 0 ? (
          <div
            className="vendorPayouts__confirmOverlay"
            onClick={closeDeleteEntriesConfirmation}
            role="presentation"
          >
            <div
              className="vendorPayouts__confirmModal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Confirmer la suppression des lignes de paiement vendeur"
            >
              <div className="vendorPayouts__confirmHeader">
                <div>
                  <h2>Supprimer les lignes sélectionnées</h2>
                  <p>
                    {displayVendorName ? `${displayVendorName} - ` : ""}
                    <strong>{vendorId}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="vendorPayouts__imageClose"
                  onClick={closeDeleteEntriesConfirmation}
                  aria-label="Fermer la suppression"
                  disabled={isProcessing}
                >
                  ×
                </button>
              </div>
              <div className="vendorPayouts__confirmGrid">
                <div className="vendorPayouts__confirmItem">
                  <span>Lignes à supprimer</span>
                  <strong>{deletionConfirmationSummary.count}</strong>
                </div>
                <div className="vendorPayouts__confirmItem">
                  <span>Brut</span>
                  <strong>
                    {formatCurrency(
                      deletionConfirmationSummary.gross,
                      deletionConfirmationSummary.currency
                    )}
                  </strong>
                </div>
                <div className="vendorPayouts__confirmItem">
                  <span>Commission</span>
                  <strong>
                    {formatCurrency(
                      deletionConfirmationSummary.commission,
                      deletionConfirmationSummary.currency
                    )}
                  </strong>
                </div>
                <div className="vendorPayouts__confirmItem vendorPayouts__confirmItem--net">
                  <span>Net concerné</span>
                  <strong>
                    {formatCurrency(
                      deletionConfirmationSummary.net,
                      deletionConfirmationSummary.currency
                    )}
                  </strong>
                </div>
              </div>
              <div className="vendorPayouts__sensitiveConfirm">
                <div>
                  <strong>Cette action supprime uniquement les lignes pending sélectionnées</strong>
                  <p>
                    Les lignes disparaîtront de la liste et un email sera envoyé à
                    l'administration.
                  </p>
                </div>
                <textarea
                  className="vendorPayouts__reasonInput"
                  value={deleteEntriesReason}
                  onChange={(event) => setDeleteEntriesReason(event.target.value)}
                  placeholder="Motif de suppression (optionnel)..."
                  disabled={isProcessing}
                />
              </div>
              <div className="vendorPayouts__confirmActions">
                <button
                  type="button"
                  className="vendorPayouts__btn vendorPayouts__btn--light"
                  onClick={closeDeleteEntriesConfirmation}
                  disabled={isProcessing}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="vendorPayouts__btn vendorPayouts__btn--danger"
                  onClick={confirmDeleteEntries}
                  disabled={!canConfirmDeleteEntries}
                >
                  {isProcessing ? "Suppression..." : "Supprimer la sélection"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {imagePreview.url ? (
          <div
            className="vendorPayouts__imageOverlay"
            onClick={closeImagePreview}
            role="presentation"
          >
            <div
              className="vendorPayouts__imageModal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Aperçu image"
            >
              <button
                type="button"
                className="vendorPayouts__imageClose"
                onClick={closeImagePreview}
                aria-label="Fermer l'aperçu"
              >
                ×
              </button>
              <img src={imagePreview.url} alt={imagePreview.alt} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default VendorPayoutDetails;
