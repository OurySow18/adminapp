import "./guineaCities.scss";
import { useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Link } from "react-router-dom";
import { onSnapshot } from "firebase/firestore";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import FeedbackPopup from "../../components/feedbackPopup/FeedbackPopup";
import { db } from "../../firebase";
import { getCitiesConfigRef, normalizeCitiesDocument } from "../../utils/citiesConfig";

const dataGridFrLocaleText = {
  noRowsLabel: "Aucune ligne",
  noResultsOverlayLabel: "Aucun resultat",
  errorOverlayDefaultLabel: "Une erreur est survenue.",
  footerRowSelected: (count) =>
    count > 1
      ? `${count.toLocaleString()} lignes selectionnees`
      : `${count.toLocaleString()} ligne selectionnee`,
  footerTotalRows: "Total lignes:",
  MuiTablePagination: {
    labelRowsPerPage: "Lignes par page",
    labelDisplayedRows: ({ from, to, count }) =>
      `${from}-${to} sur ${count !== -1 ? count : `plus de ${to}`}`,
  },
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

const GuineaCitiesList = () => {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState({
    open: false,
    type: "info",
    title: "",
    message: "",
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getCitiesConfigRef(db),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() || {} : {};
        const normalized = normalizeCitiesDocument(data);
        setCities(normalized.items);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur chargement villes:", error);
        setCities([]);
        setLoading(false);
        setFeedback({
          open: true,
          type: "error",
          title: "Chargement impossible",
          message: "Les villes n'ont pas pu etre chargees.",
        });
      }
    );

    return () => unsubscribe();
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!normalizedSearch) return cities;
    return cities.filter((row) => {
      const haystack = [row.city, row.region, row.type].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [cities, normalizedSearch]);

  const columns = useMemo(
    () => [
      {
        field: "city",
        headerName: "Ville",
        flex: 1.2,
        minWidth: 220,
      },
      {
        field: "region",
        headerName: "Region",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "type",
        headerName: "Type",
        flex: 1,
        minWidth: 220,
      },
      {
        field: "updatedAt",
        headerName: "Modification",
        flex: 1,
        minWidth: 190,
        valueGetter: (params) => formatDateTime(params.row.updatedAt),
      },
      {
        field: "action",
        headerName: "Action",
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Link to={`/cities/${params.row.id}`} className="guineaCitiesPage__link">
            Modifier
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <div className="guineaCitiesPage">
      <Sidebar />
      <div className="guineaCitiesPage__content">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Villes de Guinee</div>
          <div className="guineaCitiesPage__header">
            <div className="guineaCitiesPage__count">
              Nombre de villes: {rows.length}
            </div>
            <div className="guineaCitiesPage__actions">
              <Link to="/cities/new" className="guineaCitiesPage__primaryButton">
                Ajouter une ville
              </Link>
            </div>
          </div>
          <div className="guineaCitiesPage__toolbar">
            <input
              type="search"
              className="guineaCitiesPage__search"
              placeholder="Rechercher une ville ou une region..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="guineaCitiesPage__gridWrapper">
            <DataGrid
              className="guineaCitiesPage__datagrid"
              rows={rows}
              columns={columns}
              pageSize={pageSize}
              onPageSizeChange={(size) => setPageSize(size)}
              rowsPerPageOptions={[5, 9, 25, 50]}
              pagination
              autoHeight
              disableSelectionOnClick
              loading={loading}
              localeText={dataGridFrLocaleText}
            />
          </div>
        </div>
      </div>
      <FeedbackPopup
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() =>
          setFeedback((prev) => ({
            ...prev,
            open: false,
          }))
        }
      />
    </div>
  );
};

export default GuineaCitiesList;
