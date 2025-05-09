/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Listet die gegebenen Daten auf, hier products oder users
 */
import "./datatable.scss";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { collection, doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

const Datatable = ({ typeColumns, title }) => {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, title),
      (snapShot) => {
        let list = [];
        snapShot.docs.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        // Trier ici après récupération
        list.sort((a, b) => b.timeStamp.toDate() - a.timeStamp.toDate());
        setData(list);
        setCount(list.length);
        setLoading(false);
      },
      (error) => {
        console.log(error);
      }
    );
    return () => unsub();
  }, [title]);
  
  

  //löscht das entsprechende Produkte
  const handleDelete = async (id) => {
    const confirm = window.confirm("Voulez-vous vraiment supprimer ?");
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, title, id));
      setData(data.filter((item) => item.id !== id));
    } catch (err) {
      console.log(err);
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
