/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 *
 * Die Bestellungen weden hier agezeigt
 */
import "./order.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar"; 
import ListOrder from "../../components/order/ListOrder";

const Order = ({ typeColumns, title, listTitle = "Commandes", showFakeOrders = false }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">{listTitle}</div>
          <ListOrder
            typeColumns={typeColumns}
            title={title}
            showFakeOrders={showFakeOrders}
          />
        </div>
      </div>
    </div>
  );
};

export default Order;
