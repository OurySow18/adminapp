/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Bestellungen weden hier agezeigt
 */
import "./deliveredOrders.scss";
import Sidebar from "../sidebar/Sidebar";
import Navbar from "../navbar/Navbar";  
import ListDeliveryOrder from "../listDeliveryOrder/ListDeliveryOrder";

const DelivredOrder = ({ typeColumns, title }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Commandes</div>
          <ListDeliveryOrder  typeColumns={typeColumns} title={title} />
        </div>
      </div>
    </div>
  );
};

export default DelivredOrder;
