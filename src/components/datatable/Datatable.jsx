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

const Datatable = ({
  typeColumns,
  title,
  dataFilter,
  pageTitle,
  disableCreate = false,
}) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
        setCount(filteredList.length);
        setLoading(false);
      },
      (error) => {
        console.error("onSnapshot error:", error);
        setData([]);
        setCount(0);
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
      setCount((c) => c - 1);
    } catch (err) {
      console.error(err);
    }
  };

  const actionColumn = [
    {
      field: "action",
      headername: "Action",
      width: 200,
      renderCell: (params) => {
        return (
          <div className="cellAction">
            <Link
              to={{ pathname: params.id }}
              style={{ textDecoration: "none" }}
            >
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

  return (
    <div className="datatable">
      <div className="datatableTitle">
        <span>
          Number of {headerTitle} is {count}
        </span>
        {!disableCreate && (
          <Link to={{ pathname: "new" }} className="link">
            Add new
          </Link>
        )}
      </div>
      <DataGrid
        className="datagrid"
        rows={data}
        columns={typeColumns.concat(actionColumn)}
        pageSize={9}
        rowsPerPageOptions={[9]}
        checkboxSelection
        loading={loading}
      />
    </div>
  );
};

export default Datatable;
