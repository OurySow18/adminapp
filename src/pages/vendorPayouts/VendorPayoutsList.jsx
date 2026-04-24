import "./vendorPayouts.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import { collection, onSnapshot } from "firebase/firestore";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db } from "../../firebase";
import { resolveVendorAccountState } from "../../utils/vendorStatus";

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

const formatDateTime = (value) => {
  if (!value) return "—";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString("fr-FR");
  }
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("fr-FR");
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

const getVendorIds = (docId, data) =>
  [
    docId,
    data?.vendorId,
    data?.uid,
    data?.userId,
    data?.ownerId,
    data?.profile?.uid,
    data?.profile?.vendorId,
  ].filter((value) => typeof value === "string" && value.trim());

const getInitials = (name = "") => {
  const clean = String(name || "").trim();
  if (!clean) return "V";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const getBalanceStatus = (row) => {
  if (
    row.pendingNetAmount < 0 ||
    row.pendingEntriesCount < 0 ||
    (row.pendingNetAmount > 0 && row.pendingEntriesCount <= 0) ||
    (row.pendingEntriesCount > 0 && row.pendingNetAmount <= 0)
  ) {
    return { key: "error", label: "Erreur solde" };
  }
  if (row.pendingNetAmount > 0) {
    return { key: "payable", label: "À payer" };
  }
  return { key: "settled", label: "Soldé" };
};

const VendorPayoutsList = () => {
  const navigate = useNavigate();
  const [balanceRows, setBalanceRows] = useState([]);
  const [vendorNamesById, setVendorNamesById] = useState({});
  const [vendorLogosById, setVendorLogosById] = useState({});
  const [vendorAccountsById, setVendorAccountsById] = useState({});
  const [deletedVendorsById, setDeletedVendorsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");
  const [payableOnly, setPayableOnly] = useState(true);
  const [reviewOnly, setReviewOnly] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vendor_balances"),
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            vendorId: data.vendorId || docSnap.id,
            vendorName: data.vendorName || "",
            pendingEntriesCount: toNumber(data.pendingEntriesCount),
            pendingGrossAmount: toNumber(data.pendingGrossAmount),
            pendingCommissionAmount: toNumber(data.pendingCommissionAmount),
            pendingNetAmount: toNumber(data.pendingNetAmount),
            paidEntriesCount: toNumber(data.paidEntriesCount),
            paidNetAmount: toNumber(data.paidNetAmount),
            lifetimeNetAmount: toNumber(data.lifetimeNetAmount),
            updatedAt: data.updatedAt || null,
          };
        });

        list.sort((a, b) => b.pendingNetAmount - a.pendingNetAmount);
        setBalanceRows(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur chargement balances vendeurs:", error);
        setBalanceRows([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vendors"),
      (snapshot) => {
        const map = {};
        const logosMap = {};
        const accountsMap = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const name = pickVendorName(data);
          const logoUrl = pickVendorLogo(data);
          const account = resolveVendorAccountState(data, null);
          const ids = getVendorIds(docSnap.id, data);
          ids.forEach((id) => {
            map[id] = name;
            accountsMap[id] = account;
            if (logoUrl) {
              logosMap[id] = logoUrl;
            }
          });
        });
        setVendorNamesById(map);
        setVendorLogosById(logosMap);
        setVendorAccountsById(accountsMap);
      },
      (error) => {
        console.error("Erreur chargement noms vendeurs:", error);
        setVendorNamesById({});
        setVendorLogosById({});
        setVendorAccountsById({});
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "deletedVendors"),
      (snapshot) => {
        const map = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const meta = {
            name: pickVendorName(data),
            logo: pickVendorLogo(data),
            account: resolveVendorAccountState(null, data),
          };
          getVendorIds(docSnap.id, data).forEach((id) => {
            map[id] = meta;
          });
        });
        setDeletedVendorsById(map);
      },
      (error) => {
        console.error("Erreur chargement vendeurs supprimés:", error);
        setDeletedVendorsById({});
      }
    );
    return () => unsubscribe();
  }, []);

  const rows = useMemo(
    () =>
      balanceRows.map((row) => ({
        ...row,
        payoutStatus: getBalanceStatus(row),
        vendorAccount:
          vendorAccountsById[row.vendorId] ||
          vendorAccountsById[row.id] ||
          deletedVendorsById[row.vendorId]?.account ||
          deletedVendorsById[row.id]?.account ||
          resolveVendorAccountState(null, null),
        vendorName:
          row.vendorName ||
          vendorNamesById[row.vendorId] ||
          vendorNamesById[row.id] ||
          deletedVendorsById[row.vendorId]?.name ||
          deletedVendorsById[row.id]?.name ||
          "—",
        vendorLogo:
          vendorLogosById[row.vendorId] ||
          vendorLogosById[row.id] ||
          deletedVendorsById[row.vendorId]?.logo ||
          deletedVendorsById[row.id]?.logo ||
          "",
      })),
    [balanceRows, vendorNamesById, vendorLogosById, vendorAccountsById, deletedVendorsById]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (payableOnly && row.pendingNetAmount <= 0) return false;
      if (reviewOnly && !row.vendorAccount?.requiresPayoutReview) return false;
      if (!normalizedSearch) return true;
      const candidates = [row.vendorId, row.vendorName, row.vendorAccount?.label];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [rows, normalizedSearch, payableOnly, reviewOnly]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.pendingNetAmount += row.pendingNetAmount;
          acc.pendingCommissionAmount += row.pendingCommissionAmount;
          acc.pendingEntriesCount += row.pendingEntriesCount;
          acc.paidNetAmount += row.paidNetAmount;
          if (row.vendorAccount?.requiresPayoutReview) acc.reviewCount += 1;
          return acc;
        },
        {
          pendingNetAmount: 0,
          pendingCommissionAmount: 0,
          pendingEntriesCount: 0,
          paidNetAmount: 0,
          reviewCount: 0,
        }
      ),
    [filteredRows]
  );

  const columns = useMemo(
    () => [
      {
        field: "vendorName",
        headerName: "Vendeur",
        minWidth: 220,
        flex: 1,
        valueGetter: (params) => params.row.vendorName || "—",
      },
      {
        field: "vendorLogo",
        headerName: "Logo",
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const logo = params.row.vendorLogo;
          const vendorName = params.row.vendorName || "";
          if (logo) {
            return (
              <div className="vendorPayouts__logoCell">
                <img
                  src={logo}
                  alt={`Logo ${vendorName || params.row.vendorId}`}
                  className="vendorPayouts__vendorLogo"
                />
              </div>
            );
          }
          return (
            <div className="vendorPayouts__logoCell">
              <span className="vendorPayouts__logoFallback">
                {getInitials(vendorName)}
              </span>
            </div>
          );
        },
      },
      {
        field: "payoutStatus",
        headerName: "Statut",
        width: 140,
        renderCell: (params) => {
          const status = params.row.payoutStatus || getBalanceStatus(params.row);
          return (
            <span className={`statusChip statusChip--${status.key}`}>
              {status.label}
            </span>
          );
        },
      },
      {
        field: "vendorAccount",
        headerName: "Compte vendeur",
        width: 160,
        renderCell: (params) => {
          const account = params.row.vendorAccount || resolveVendorAccountState(null, null);
          return (
            <span className={`statusChip statusChip--${account.key}`}>
              {account.label}
            </span>
          );
        },
      },
      {
        field: "pendingEntriesCount",
        headerName: "Lignes à payer",
        width: 130,
      },
      {
        field: "pendingNetAmount",
        headerName: "Net à payer",
        minWidth: 170,
        flex: 0.7,
        valueGetter: (params) => formatCurrency(params.row.pendingNetAmount),
      },
      {
        field: "pendingCommissionAmount",
        headerName: "Commission (5%)",
        minWidth: 170,
        flex: 0.7,
        valueGetter: (params) => formatCurrency(params.row.pendingCommissionAmount),
      },
      {
        field: "paidNetAmount",
        headerName: "Net déjà payé",
        minWidth: 170,
        flex: 0.7,
        valueGetter: (params) => formatCurrency(params.row.paidNetAmount),
      },
      {
        field: "updatedAt",
        headerName: "Dernière MAJ",
        minWidth: 180,
        flex: 0.7,
        valueGetter: (params) => formatDateTime(params.row.updatedAt),
      },
      {
        field: "action",
        headerName: "Action",
        width: 130,
        sortable: false,
        renderCell: (params) => (
          <div className="cellAction">
            <Link
              to={`/vendor-payouts/${params.row.vendorId}`}
              style={{ textDecoration: "none" }}
            >
              <div className="viewButton">Détails</div>
            </Link>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="vendorPayouts">
      <Sidebar />
      <div className="vendorPayoutsContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Paiements vendeurs</div>

          <div className="vendorPayouts__summary">
            <div className="vendorPayouts__card">
              <span className="label">Vendeurs affichés</span>
              <strong>{filteredRows.length}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">Net total à payer</span>
              <strong>{formatCurrency(totals.pendingNetAmount)}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">Commission en attente</span>
              <strong>{formatCurrency(totals.pendingCommissionAmount)}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">Lignes en attente</span>
              <strong>{totals.pendingEntriesCount}</strong>
            </div>
            <div className="vendorPayouts__card">
              <span className="label">À vérifier</span>
              <strong>{totals.reviewCount}</strong>
            </div>
          </div>

          <div className="vendorPayouts__toolbar">
            <label className="vendorPayouts__toggle">
              <input
                type="checkbox"
                checked={payableOnly}
                onChange={(event) => setPayableOnly(event.target.checked)}
              />
              <span>À payer uniquement</span>
            </label>
            <label className="vendorPayouts__toggle">
              <input
                type="checkbox"
                checked={reviewOnly}
                onChange={(event) => setReviewOnly(event.target.checked)}
              />
              <span>À vérifier</span>
            </label>
            <input
              type="search"
              className="vendorPayouts__searchInput"
              placeholder="Rechercher vendeur (nom ou UID)..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="vendorPayouts__gridWrapper">
            <DataGrid
              className="datagrid"
              rows={filteredRows}
              columns={columns}
              pagination
              pageSize={pageSize}
              onPageSizeChange={(size) => setPageSize(size)}
              rowsPerPageOptions={[5, 9, 25]}
              disableSelectionOnClick
              autoHeight
              loading={loading}
              localeText={dataGridFrLocaleText}
              onRowClick={(params) => navigate(`/vendor-payouts/${params.row.vendorId}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorPayoutsList;
