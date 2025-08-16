/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Liste les données (products/users/…) avec tri robuste par timeStamp.
 */
import "./datatable.scss";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { DataGrid } from "@mui/x-data-grid";
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";

const Datatable = ({ typeColumns, title }) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // utilitaires "safe"
  const getTimeSafe = (ts) => {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (ts instanceof Date) return ts.getTime?.() ?? 0;
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    return 0;
  };

  useEffect(() => {
    // On tente de trier côté Firestore si le champ existe
    // (si certaines collections n'ont pas timeStamp, ça marche quand même)
    const baseRef = collection(db, title);
    const q = query(baseRef, orderBy("timeStamp", "desc"));

    const unsub = onSnapshot(
      q,
      (snapShot) => {
        const list = snapShot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fallback: re-tri côté client si certains docs n'ont pas le champ
        list.sort((a, b) => getTimeSafe(b.timeStamp) - getTimeSafe(a.timeStamp));

        setData(list);
        setCount(list.length);
        setLoading(false);
      },
      (error) => {
        console.error("onSnapshot error:", error);
        // Plan B: sans orderBy (si jamais la requête est refusée)
        const unsubFallback = onSnapshot(baseRef, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort(
            (a, b) => getTimeSafe(b.timeStamp) - getTimeSafe(a.timeStamp)
          );
          setData(list);
          setCount(list.length);
          setLoading(false);
        });
        return () => unsubFallback();
      }
    );

    return () => unsub();
  }, [title]);

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
            <div
              className="deleteButton"
              onClick={() => handleDelete(params.row.id)}
            >
              Delete
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="datatable">
      <div className="datatableTitle">
        Number of {title} is {count}
        <Link to={{ pathname: "new" }} className="link">
          Add new
        </Link>
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
