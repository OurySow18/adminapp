/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Liste les donnees (products/users/...) avec tri robuste par timeStamp.
 */
import "./datatable.scss";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";

const firstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const toDateValue = (value) => {
  if (!value) return undefined;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (
    typeof value === "object" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    return new Date(value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6));
  }
  return undefined;
};

const formatDateForSearch = (value) => {
  const date = toDateValue(value);
  return date
    ? date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
};

const Datatable = ({
  typeColumns,
  title,
  dataFilter,
  pageTitle,
  disableCreate = false,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(9);
  const [searchQuery, setSearchQuery] = useState("");
  const enableSearch = ["products", "users", "vendors", "admin", "drivers"].includes(
    title
  );

  useEffect(() => {
    if (!enableSearch && searchQuery) {
      setSearchQuery("");
    }
  }, [enableSearch, searchQuery]);

  const applyFilter = useMemo(() => {
    if (!dataFilter) return null;
    return (rows) => {
      try {
        return rows.filter((row) => dataFilter(row));
      } catch (error) {
        console.warn(
          "Datatable filter failed, returning unfiltered dataset.",
          error
        );
        return rows;
      }
    };
  }, [dataFilter]);

  const getTimeSafe = (ts) => {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (ts instanceof Date) return ts.getTime?.() ?? 0;
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    return 0;
  };

  useEffect(() => {
    const collectionRef = collection(db, title);
    const unsubscribe = onSnapshot(
      collectionRef,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        list.sort((a, b) => getTimeSafe(b.timeStamp) - getTimeSafe(a.timeStamp));
        const filteredList = applyFilter ? applyFilter(list) : list;

        setData(filteredList);
        setLoading(false);
      },
      (error) => {
        console.error("onSnapshot error:", error);
        setData([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [title, applyFilter]);

  const handleDelete = async (id) => {
    const confirm = window.confirm("Voulez-vous vraiment supprimer ?");
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, title, id));
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const actionColumn = [
    {
      field: "action",
      headername: "Action",
      width: 90,
      renderCell: (params) => {
        return (
          <div className="cellAction">
            <Link to={String(params.id)} style={{ textDecoration: "none" }}>
              <div className="viewButton">View</div>
            </Link>
         {/*   <div
              className="deleteButton"
              onClick={() => handleDelete(params.row.id)}
            >
              Delete
            </div>*/}
          </div>
        );
      },
    },
  ];

  const headerTitle = pageTitle ?? title;
  const columns = useMemo(
    () => typeColumns.concat(actionColumn),
    [typeColumns]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const displayedRows = useMemo(() => {
    if (!enableSearch || !normalizedSearch) return data;
    return data.filter((row) => {
      const titleCandidate = firstValue(
        row.name,
        row.title,
        row.product,
        row.core?.title,
        row.draft?.core?.title,
        row.profile?.displayName,
        row.profile?.company?.name
      );
      const descriptionCandidate = firstValue(
        row.description,
        row.core?.description,
        row.draft?.core?.description,
        row.profile?.bio
      );
      const categoryCandidate = firstValue(
        row.category,
        row.categoryId,
        row.core?.categoryId,
        row.draft?.core?.categoryId,
        row.role,
        row.profile?.role
      );
      const createdAtCandidate = formatDateForSearch(
        firstValue(
          row.createdAt,
          row.core?.createdAt,
          row.draft?.core?.createdAt,
          row.profile?.createdAt,
          row.timeStamp,
          row.created_at
        )
      );
      const userEmailCandidate = firstValue(
        row.email,
        row.profile?.email,
        row.account?.email
      );
      const vendorEmailCandidate = firstValue(
        row.vendorEmail,
        row.company?.email,
        row.profile?.vendorEmail
      );
      const identifierCandidate = firstValue(
        row.product_id,
        row.vendorId,
        row.profile?.vendorId,
        row.id,
        row.uid
      );
      const vendorNameCandidate = firstValue(
        row.vendorName,
        row.displayName,
        row.profile?.displayName,
        row.profile?.company?.name,
        row.company?.name,
        row.vendor?.name
      );
      const vendorPhoneCandidate = firstValue(
        row.phone,
        row.profile?.phone,
        row.contact?.phone,
        row.company?.phone
      );
      const vendorStatusCandidate = firstValue(
        row.vendorStatus,
        row.status,
        row.profile?.status
      );
      const adminNameCandidate = firstValue(row.username, row.surname);
      const driverZoneCandidate = firstValue(row.zone, row.deliveryZone);

      const candidates = [
        identifierCandidate,
        titleCandidate,
        descriptionCandidate,
        categoryCandidate,
        createdAtCandidate,
        userEmailCandidate,
        vendorEmailCandidate,
        vendorNameCandidate,
        vendorPhoneCandidate,
        vendorStatusCandidate,
        adminNameCandidate,
        driverZoneCandidate,
      ];
      return candidates
        .filter((value) => typeof value === "string" && value.trim())
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [data, enableSearch, normalizedSearch]);

  const displayedCount = displayedRows.length;

  return (
    <div className="datatable">
      <div className="datatableTitle">
        <div className="datatableTitle__info">
          <span>
            Number of {headerTitle} is {displayedCount}
          </span>
          {!disableCreate && (
            <Link to={{ pathname: "new" }} className="link">
              Add new
            </Link>
          )}
        </div>
        {enableSearch && (
          <input
            type="search"
            className="datatableTitle__search"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        )}
      </div>
      <div className="datatable__gridWrapper">
        <DataGrid
          className="datagrid"
          rows={displayedRows}
          columns={columns}
          pageSize={pageSize}
          onPageSizeChange={(newSize) => setPageSize(newSize)}
          rowsPerPageOptions={[5, 9, 25]}
          autoHeight
          checkboxSelection
          disableSelectionOnClick
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Datatable;


