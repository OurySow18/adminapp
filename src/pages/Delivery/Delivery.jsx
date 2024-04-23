/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Delivery Daten werden hier abgerufen
 *
 */
import "./delivery.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar"; 
import ListDelivered from "../../components/delivery/ListDelivered";

const Delivery = ({typeColumns, title}) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Delivery</div>
          <ListDelivered typeColumns={typeColumns} title={title} />
        </div>
      </div>
    </div>
  );
};

export default Delivery;
