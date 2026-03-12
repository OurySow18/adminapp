import "./vendorPayouts.scss";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db } from "../../firebase";

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

const VendorPayoutDetails = () => {
  const navigate = useNavigate();
  const { vendorId } = useParams();

  const [balance, setBalance] = useState(null);
  const [vendorLabel, setVendorLabel] = useState("");
  const [vendorLogo, setVendorLogo] = useState("");
  const [entries, setEntries] = useState([]);
  const [productImagesById, setProductImagesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionModel, setSelectionModel] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
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
          setVendorLabel("");
          setVendorLogo("");
          return;
        }
        const data = snap.data() || {};
        setVendorLogo(pickVendorLogo(data));
        const name =
          data.vendorName ||
          data.displayName ||
          data.profile?.displayName ||
          data.profile?.company?.name ||
          data.company?.name ||
          "";
        setVendorLabel(typeof name === "string" ? name : "");
      },
      () => {
        setVendorLabel("");
        setVendorLogo("");
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

  const settleEntries = async (entriesToSettle) => {
    if (!vendorId || !entriesToSettle.length || isProcessing) return;

    const payoutTotal = entriesToSettle.reduce((sum, entry) => sum + entry.netAmount, 0);
    const ok = window.confirm(
      `Confirmer le paiement de ${entriesToSettle.length} ligne(s) pour un total de ${formatCurrency(
        payoutTotal
      )} ?`
    );
    if (!ok) return;

    setActionError("");
    setActionFeedback("");
    setIsProcessing(true);
    try {
      const grossDelta = entriesToSettle.reduce((sum, entry) => sum + entry.grossAmount, 0);
      const commissionDelta = entriesToSettle.reduce(
        (sum, entry) => sum + entry.commissionAmount,
        0
      );
      const netDelta = entriesToSettle.reduce((sum, entry) => sum + entry.netAmount, 0);
      const entriesDelta = entriesToSettle.length;
      const payoutBatchId = `manual_${Date.now()}`;
      const balanceRef = doc(db, "vendor_balances", vendorId);

      const chunkSize = 400;
      for (let start = 0; start < entriesToSettle.length; start += chunkSize) {
        const chunk = entriesToSettle.slice(start, start + chunkSize);
        const isLastChunk = start + chunkSize >= entriesToSettle.length;
        const batch = writeBatch(db);

        chunk.forEach((entry) => {
          const ledgerRef = doc(db, "vendor_ledger", entry.id);
          batch.update(ledgerRef, {
            status: "paid",
            paidAt: serverTimestamp(),
            paidBatchId: payoutBatchId,
            updatedAt: serverTimestamp(),
          });
        });

        if (isLastChunk) {
          batch.set(
            balanceRef,
            {
              vendorId,
              pendingGrossAmount: increment(-grossDelta),
              pendingCommissionAmount: increment(-commissionDelta),
              pendingNetAmount: increment(-netDelta),
              pendingEntriesCount: increment(-entriesDelta),
              paidGrossAmount: increment(grossDelta),
              paidCommissionAmount: increment(commissionDelta),
              paidNetAmount: increment(netDelta),
              paidEntriesCount: increment(entriesDelta),
              lastPaidBatchId: payoutBatchId,
              lastPaidAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await batch.commit();
      }

      setSelectionModel([]);
      setActionFeedback(
        `${entriesToSettle.length} ligne(s) marquée(s) comme payée(s), total ${formatCurrency(
          netDelta
        )}.`
      );
    } catch (error) {
      console.error("Erreur paiement vendeur:", error);
      setActionError("Impossible de marquer ces lignes comme payées.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettleSelected = async () => {
    if (!selectedPendingEntries.length) {
      setActionError("Sélectionne au moins une ligne en attente.");
      return;
    }
    await settleEntries(selectedPendingEntries);
  };

  const handleSettleAllFilteredPending = async () => {
    const pendingEntries = filteredRows.filter((row) => row.status === "pending");
    if (!pendingEntries.length) {
      setActionError("Aucune ligne en attente dans le filtre actuel.");
      return;
    }
    await settleEntries(pendingEntries);
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
    vendorLabel || balance?.vendorName || entries.find((entry) => entry.vendorName)?.vendorName || "";

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
                {vendorLogo ? (
                  <button
                    type="button"
                    className="vendorPayouts__logoButton"
                    onClick={() =>
                      openImagePreview(
                        vendorLogo,
                        `Logo ${displayVendorName || vendorId}`
                      )
                    }
                    title="Voir le logo en grand"
                  >
                    <img
                      src={vendorLogo}
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
            </div>
          </div>

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

          <div className="vendorPayouts__footer">
            <button className="vendorPayouts__btn vendorPayouts__btn--light" onClick={() => navigate(-1)}>
              Revenir en arrière
            </button>
          </div>
        </div>

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
