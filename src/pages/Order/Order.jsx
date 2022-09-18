/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Die Bestellungen weden hier agezeigt
 */
import "./order.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"
import Table from "../../components/table/Table"

const Order = () => {
   
    return (
      <div className="order">
          <Sidebar />
          <div className="orderContainer">
            <Navbar/>          
            <div className="listContainer">
              <div className="listTitle">Orders</div>
              <Table />
            </div>
          </div>
     </div>
    );
    }

export default Order;