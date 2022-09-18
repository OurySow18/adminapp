/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Zeigt die Details des ausgewählten User
 */
import './single.scss'
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"
import Chart from "../../components/chart/Chart"
import List from "../../components/table/Table"
import {useState, useEffect} from "react"
import { useParams } from 'react-router-dom'
import { doc, onSnapshot  } from "firebase/firestore";
import {db} from "../../firebase";

const Single = ({title}) => {
  const [data, setData] = useState([]) 
  
  //bekommt die Daten durch die Navigationsparameters
  const params = useParams();
  
 //ruft die Details eines Produktes von Firestore ab
  useEffect(() =>{
    const unsub = onSnapshot(doc(db, title, params.id), (doc) =>  {       
      setData(doc.data());
    }, 
      (error) => {
        console.log(error);
      }
    );
    return () => {
      unsub();
    };
  }, []);

    return (
      <div className="single">
          <Sidebar />
          <div className="singleContainer">
            <Navbar/>
             <div className="top">
               <div className="left">
                 <div className="editButton">{data.status ? "Sperren" : "Aktivieren"}</div>
                 <h1 className="title" >Information</h1>
                 <div className="item">
                   <img 
                    src={data.img} 
                    alt="" 
                    className="itemImg" 
                    />
                    <div className="details">
                    <h1 className="itemTitle">{data.username}</h1>
                    <div className="detailItem">
                      <span className="itemKey">Email: </span>
                      <span className="itemValue">{data.email}</span>
                    </div>
                    <div className="detailItem">
                      <span className="itemKey">Phone: </span>
                      <span className="itemValue">{data.phone}</span>
                    </div>
                    <div className="detailItem">
                      <span className="itemKey">Adresse: </span>
                      <span className="itemValue">{data.addresse}</span>
                    </div>
                    <div className="detailItem">
                      <span className="itemKey">Country: </span>
                      <span className="itemValue">{data.country}</span>
                    </div>
                    <div className="detailItem">
                      <span className="itemKey">Status: </span>
                      <span className="itemValue">{data.status ? "Aktive" : "Gesperrt"}</span>
                    </div>
                    
                    </div>
                 </div>
               </div>
               <div className="right">
                 <Chart aspect={3/1} title="User spending (Last 6 Months)"/>
               </div>
             </div>
             <div className="bottom">
             <h1 className="title" >Information</h1>
               <List/>
             </div>
          </div>
      </div>
    ) 
}
export default Single;