import "./vendorPayouts.scss";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import { collection, onSnapshot } from "firebase/firestore";
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

const getInitials = (name = "") => {
  const clean = String(name || "").trim();
  if (!clean) return "V";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const VendorPayoutsList = () => {
  const navigate = useNavigate();
  const [balanceRows, setBalanceRows] = useState([]);
  const [vendorNamesById, setVendorNamesById] = useState({});
  const [vendorLogosById, setVendorLogosById] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");

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
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const name = pickVendorName(data);
          const logoUrl = pickVendorLogo(data);
          const ids = [
            docSnap.id,
            data?.vendorId,
            data?.profile?.vendorId,
          ].filter((value) => typeof value === "string" && value.trim());
          ids.forEach((id) => {
            map[id] = name;
            if (logoUrl) {
              logosMap[id] = logoUrl;
            }
          });
        });
        setVendorNamesById(map);
        setVendorLogosById(logosMap);
      },
      (error) => {
        console.error("Erreur chargement noms vendeurs:", error);
        setVendorNamesById({});
        setVendorLogosById({});
      }
    );
    return () => unsubscribe();
  }, []);

  const rows = useMemo(
    () =>
      balanceRows.map((row) => ({
        ...row,
        vendorName:
          row.vendorName ||
          vendorNamesById[row.vendorId] ||
          vendorNamesById[row.id] ||
          "—",
        vendorLogo:
          vendorLogosById[row.vendorId] ||
          vendorLogosById[row.id] ||
          "",
      })),
    [balanceRows, vendorNamesById, vendorLogosById]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return rows;
    return rows.filter((row) => {
      const candidates = [row.vendorId, row.vendorName];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [rows, normalizedSearch]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.pendingNetAmount += row.pendingNetAmount;
          acc.pendingCommissionAmount += row.pendingCommissionAmount;
          acc.pendingEntriesCount += row.pendingEntriesCount;
          acc.paidNetAmount += row.paidNetAmount;
          return acc;
        },
        {
          pendingNetAmount: 0,
          pendingCommissionAmount: 0,
          pendingEntriesCount: 0,
          paidNetAmount: 0,
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
          </div>

          <div className="vendorPayouts__toolbar">
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
