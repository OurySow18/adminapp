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

const Order = ({ typeColumns, title }) => {
  return (
    <div className="order">
      <Sidebar />
      <div className="orderContainer">
        <Navbar />
        <div className="listContainer">
          <div className="listTitle">Commandes</div>
          <ListOrder  typeColumns={typeColumns} title={title} />
        </div>
      </div>
    </div>
  );
};

export default Order;
