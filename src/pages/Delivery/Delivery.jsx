/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Delivery Daten werden hier abgerufen
 *  
 */
import "./delivery.scss";
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"
import Table from "../../components/table/Table"

const Delivery = () => {
   
    return (
      <div className="order">
          <Sidebar />
          <div className="orderContainer">
            <Navbar/>          
            <div className="listContainer">
              <div className="listTitle">Derivery</div>
              <Table />
            </div>
          </div>
     </div>
    );
    }

export default Delivery;