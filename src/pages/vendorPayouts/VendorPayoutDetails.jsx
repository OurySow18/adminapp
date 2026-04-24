import "./vendorPayouts.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
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

const csvEscape = (value) => {
  const raw = value === undefined || value === null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
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
    const vendorRef = doc(db, "vendors", vendorId);
    const unsub = onSnapshot(
      vendorRef,
      (snap) => {
        if (!snap.exists()) {
          setVendorData(null);
          setVendorLabel("");
          setVendorLogo("");
          return;
        }
        const data = snap.data() || {};
        setVendorData(data);
        setVendorLogo(pickVendorLogo(data));
        setVendorLabel(pickVendorName(data));
      },
      () => {
        setVendorData(null);
        setVendorLabel("");
        setVendorLogo("");
      }
    );
    return () => unsub();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return undefined;
    const deletedVendorRef = doc(db, "deletedVendors", vendorId);
    const unsub = onSnapshot(
      deletedVendorRef,
      (snap) => {
        setDeletedVendorData(snap.exists() ? { id: snap.id, ...(snap.data() || {}) } : null);
      },
      (error) => {
        console.error("Erreur lecture deletedVendors:", error);
        setDeletedVendorData(null);
      }
    );
    return () => unsub();
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

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return entries.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const candidates = [row.orderId, row.title, row.productId];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [entries, normalizedSearch, statusFilter]);

  const rowsById = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [entries]);

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
      const result = await settleVendorPayoutCallable({
        vendorId,
        entryIds: pendingPayoutEntries.map((entry) => entry.id),
        forceSensitiveVendor: payoutRequiresReview ? true : false,
        forceReason: payoutRequiresReview ? forceReason : "",
      });
      const data = result.data || {};
      const paidCount = toNumber(data.entriesCount);
      const netAmount = toNumber(data.netAmount);

      setSelectionModel([]);
      setPendingPayoutEntries([]);
      setForceSensitivePayout(false);
      setSensitivePayoutReason("");
      setActionFeedback(
        `${paidCount} ligne(s) marquée(s) comme payée(s), total ${formatCurrency(netAmount)}.`
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
        row.orderId,
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
    const vendorPart = String(vendorId || "vendeur").replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadCsv(`paiements_${vendorPart}_${Date.now()}.csv`, rows);
    setActionError("");
    setActionFeedback(`${filteredRows.length} ligne(s) exportée(s) en CSV.`);
  };

  const handleCopyOrderId = useCallback(async (orderId) => {
    const value = typeof orderId === "string" ? orderId.trim() : "";
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
        field: "orderId",
        headerName: "Commande",
        minWidth: 360,
        flex: 1.4,
        renderCell: (params) => {
          const orderId = params.row.orderId || "—";
          return (
            <div className="vendorPayouts__orderIdCell">
              <span className="vendorPayouts__orderIdValue" title={orderId}>
                {orderId}
              </span>
              <button
                type="button"
                className="vendorPayouts__copyBtn"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCopyOrderId(orderId);
                }}
                title="Copier l'ID commande"
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
              <span>{payoutBatches.length} batch(s)</span>
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
