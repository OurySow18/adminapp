import './datatable.scss'
import {Link} from "react-router-dom";
import {useState, useEffect} from "react"
import { DataGrid } from '@mui/x-data-grid'; 
import { collection, doc, deleteDoc, onSnapshot  } from "firebase/firestore";
import {db} from "../../firebase";


const Datatable = ({typeColumns, title}) => {

  const [data, setData] = useState([]); 

  const lien = title === "users" ? "users/new" : "product/new"

 useEffect(() =>{
  /*   const fetchData = async () =>{
      let list = [];
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
          list.push({id: doc.id, ...doc.data()});
        });
        setData(list);
      } catch (error) {
          console.log(error)
      }      
    }
    fetchData()*/

    //Real Time
    const unsub = onSnapshot(
      collection(db, title), 
      (snapShot) => {
      let list = [];
      snapShot.docs.forEach((doc)=>{
        list.push({ id: doc.id, ...doc.data() });
      });
      setData(list);
    }, 
      (error) => {
        console.log(error);
      }
    );
    return () => {
      unsub();
    };
    }, []);

  const handleDelete = async(id) => {
    try {
      await deleteDoc(doc(db, title, id));
      setData(data.filter((item) => item.id !== id));
    } catch (err) {
      console.log(err)
    }    
  };

    const actionColumn = [
      {
        field: "action",
        headername:"Action",
        width: 200,
        renderCell: (params) => {
            return(
                <div className="cellAction" >
                  <Link to="/users/test" style={{ textDecoration:"none" }}>
                    <div className="viewButton" >View</div>
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
    <div className="datatable" > 
      <div className="datatableTitle">
        Add new {title}
        <Link to="/users/new" className="link">
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
      /> 
    </div>
  )
}

export default Datatable